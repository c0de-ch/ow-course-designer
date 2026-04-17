import { NextRequest } from "next/server";
import { z } from "zod";
import { buildSystemPrompt } from "@/lib/help-context";
import { getManualContext } from "@/lib/help-manual";
import { checkRateLimit, getRequestIp } from "@/lib/rate-limit";
import { withSpan } from "@/lib/otel/with-span";

const MAX_MESSAGES = 40;
const MAX_MESSAGE_CHARS = 8000;
const MAX_PATHNAME_CHARS = 512;
const RATE_LIMIT_PER_MIN = 20;

const chatBodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(MAX_MESSAGE_CHARS),
      })
    )
    .min(1)
    .max(MAX_MESSAGES),
  settings: z.object({
    provider: z.enum(["claude", "ollama"]),
    claudeApiKey: z.string().max(256).optional(),
    claudeModel: z.string().max(128).optional(),
    ollamaServerUrl: z.string().max(512).optional(),
    ollamaModel: z.string().max(128).optional(),
    language: z.string().max(8).optional(),
  }),
  context: z.object({
    pathname: z.string().max(MAX_PATHNAME_CHARS),
  }),
});

type ChatRequestBody = z.infer<typeof chatBodySchema>;

export async function POST(req: NextRequest) {
  return withSpan("POST /api/chat", async () => {
    const ip = getRequestIp(req.headers);
    const limit = checkRateLimit(`chat:${ip}`, RATE_LIMIT_PER_MIN, 60_000);
    if (!limit.allowed) {
      return new Response("Too many requests", {
        status: 429,
        headers: { "Retry-After": String(limit.retryAfterSec) },
      });
    }

    let body: ChatRequestBody;
    try {
      body = chatBodySchema.parse(await req.json());
    } catch {
      return new Response("Invalid request body", { status: 400 });
    }
    const { messages, settings, context } = body;

    const systemPrompt = buildSystemPrompt(
      context.pathname,
      settings.language ?? "en"
    );
    const manualContext = getManualContext();
    const fullSystem = `${systemPrompt}\n\n## Application Manual (use this to answer common questions)\n${manualContext}`;

    if (settings.provider === "claude") {
      return streamFromClaude(messages, fullSystem, settings);
    }
    return streamFromOllama(messages, fullSystem, settings);
  });
}

async function streamFromClaude(
  messages: { role: string; content: string }[],
  systemPrompt: string,
  settings: ChatRequestBody["settings"]
) {
  const apiKey = settings.claudeApiKey;
  if (!apiKey) {
    return new Response("Claude API key not configured", { status: 400 });
  }

  const model = settings.claudeModel || "claude-sonnet-4-6-20250514";

  let response: Response;
  try {
    response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 2048,
        stream: true,
        system: systemPrompt,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      }),
    });
  } catch (err) {
    return new Response(`Failed to connect to Claude API: ${(err as Error).message}`, { status: 502 });
  }

  if (!response.ok) {
    const error = await response.text();
    return new Response(`Claude API error: ${error}`, { status: response.status });
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const stream = new ReadableStream({
    async start(controller) {
      const reader = response.body!.getReader();
      let buffer = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6).trim();
              if (data === "[DONE]") continue;
              try {
                const parsed = JSON.parse(data);
                if (
                  parsed.type === "content_block_delta" &&
                  parsed.delta?.text
                ) {
                  controller.enqueue(encoder.encode(parsed.delta.text));
                }
              } catch {
                // skip unparseable SSE lines
              }
            }
          }
        }
      } catch (err) {
        controller.error(err);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}

async function streamFromOllama(
  messages: { role: string; content: string }[],
  systemPrompt: string,
  settings: ChatRequestBody["settings"]
) {
  const serverUrl = settings.ollamaServerUrl || "http://localhost:11434";
  const model = settings.ollamaModel;

  if (!model) {
    return new Response("Ollama model not selected", { status: 400 });
  }

  const ollamaMessages = [
    { role: "system", content: systemPrompt },
    ...messages.map((m) => ({ role: m.role, content: m.content })),
  ];

  let response: Response;
  try {
    response = await fetch(`${serverUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages: ollamaMessages, stream: true }),
    });
  } catch (err) {
    return new Response(`Failed to connect to Ollama: ${(err as Error).message}`, { status: 502 });
  }

  if (!response.ok) {
    const error = await response.text();
    return new Response(`Ollama error: ${error}`, { status: response.status });
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const stream = new ReadableStream({
    async start(controller) {
      const reader = response.body!.getReader();
      let buffer = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const parsed = JSON.parse(line);
              if (parsed.message?.content) {
                controller.enqueue(encoder.encode(parsed.message.content));
              }
            } catch {
              // skip unparseable lines
            }
          }
        }
      } catch (err) {
        controller.error(err);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}
