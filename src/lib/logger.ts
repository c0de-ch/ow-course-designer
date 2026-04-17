import pino from "pino";
import { trace } from "@opentelemetry/api";

// JSON to stdout in prod, pretty-printed if LOG_PRETTY=1 (dev convenience).
const base = pino({
  level: process.env.LOG_LEVEL ?? "info",
  transport:
    process.env.LOG_PRETTY === "1"
      ? {
          target: "pino-pretty",
          options: { translateTime: "HH:MM:ss", ignore: "pid,hostname" },
        }
      : undefined,
  // Attach the active trace/span IDs so logs and traces can be joined in
  // Grafana/Tempo without custom correlation plumbing.
  mixin() {
    const span = trace.getActiveSpan();
    if (!span) return {};
    const ctx = span.spanContext();
    return { traceId: ctx.traceId, spanId: ctx.spanId };
  },
});

export const logger = base;
