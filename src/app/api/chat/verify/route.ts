import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getRequestIp } from "@/lib/rate-limit";
import { withSpan } from "@/lib/otel/with-span";

export async function POST(req: NextRequest) {
  return withSpan("POST /api/chat/verify", async () => {
    const ip = getRequestIp(req.headers);
    const rate = checkRateLimit(`chat-verify:${ip}`, 20, 60_000);
    if (!rate.allowed) {
      return NextResponse.json(
        { ok: false, error: "Too many verification attempts." },
        { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } }
      );
    }

    const { provider, claudeApiKey, claudeModel, ollamaServerUrl, ollamaModel } =
      await req.json();

    if (provider === "claude") {
      if (!claudeApiKey) {
        return NextResponse.json(
          { ok: false, error: "API key is required" },
          { status: 400 }
        );
      }
      try {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": claudeApiKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: claudeModel || "claude-sonnet-4-6-20250514",
            max_tokens: 1,
            messages: [{ role: "user", content: "hi" }],
          }),
        });
        if (!res.ok) {
          const body = await res.text();
          let msg = `HTTP ${res.status}`;
          try {
            const parsed = JSON.parse(body);
            msg = parsed.error?.message || msg;
          } catch {}
          return NextResponse.json({ ok: false, error: msg });
        }
        return NextResponse.json({ ok: true });
      } catch (err) {
        return NextResponse.json({
          ok: false,
          error: (err as Error).message,
        });
      }
    }

    if (provider === "ollama") {
      if (!ollamaServerUrl) {
        return NextResponse.json(
          { ok: false, error: "Server URL is required" },
          { status: 400 }
        );
      }
      try {
        // First check server is reachable
        const tagsRes = await fetch(`${ollamaServerUrl}/api/tags`);
        if (!tagsRes.ok) {
          return NextResponse.json({
            ok: false,
            error: `Server returned ${tagsRes.status}`,
          });
        }
        const tagsData = await tagsRes.json();
        const models = (tagsData.models || []).map(
          (m: { name: string }) => m.name
        );

        // If a model is selected, verify it exists
        if (ollamaModel && !models.includes(ollamaModel)) {
          return NextResponse.json({
            ok: false,
            error: `Model "${ollamaModel}" not found on server`,
            models,
          });
        }

        return NextResponse.json({ ok: true, models });
      } catch (err) {
        return NextResponse.json({
          ok: false,
          error: `Cannot connect: ${(err as Error).message}`,
        });
      }
    }

    return NextResponse.json(
      { ok: false, error: "Unknown provider" },
      { status: 400 }
    );
  });
}
