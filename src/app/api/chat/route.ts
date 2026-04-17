import { NextRequest } from "next/server";
import { buildSystemPrompt } from "@/lib/help-context";
import { getManualContext } from "@/lib/help-manual";

interface ChatRequestBody {
  messages: { role: "user" | "assistant"; content: string }[];
  settings: {
    provider: "claude" | "ollama";
    claudeApiKey?: string;
    claudeModel?: string;
    ollamaServerUrl?: string;
    ollamaModel?: string;
    language?: string;
  };
  context: { pathname: string };
}

export async function POST(req: NextRequest) {
  const body: ChatRequestBody = await req.json();
  const { messages, settings, context } = body;

  if (!messages?.length) {
    return new Response("No messages provided", { status: 400 });
  }

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
