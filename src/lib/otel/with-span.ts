import { SpanStatusCode } from "@opentelemetry/api";
import { tracer } from "./tracer";
import { httpRequestLatency } from "./metrics";

/**
 * Wrap an API-route handler body with a tracing span and latency histogram.
 *
 * `name` should read like `"GET /api/courses"` — used verbatim as the span
 * name and as the `route` attribute on the latency metric so traces and
 * metrics can be joined.
 */
export async function withSpan<T>(
  name: string,
  fn: (span: import("@opentelemetry/api").Span) => Promise<T>
): Promise<T> {
  const start = Date.now();
  return tracer.startActiveSpan(name, async (span) => {
    try {
      const result = await fn(span);
      if (span.isRecording()) span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (err) {
      span.recordException(err as Error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: (err as Error).message,
      });
      throw err;
    } finally {
      httpRequestLatency.record(Date.now() - start, { route: name });
      span.end();
    }
  });
}
