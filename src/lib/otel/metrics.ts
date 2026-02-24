import { metrics } from "@opentelemetry/api";

const meter = metrics.getMeter("ow-course-designer");

export const exportDurationHistogram = meter.createHistogram(
  "export.duration_ms",
  { description: "Duration of PDF/PNG export generation in milliseconds", unit: "ms" }
);

export const httpRequestLatency = meter.createHistogram(
  "http.request.latency_ms",
  { description: "API request latency in milliseconds", unit: "ms" }
);

export const coursesCreatedCounter = meter.createCounter(
  "courses.created",
  { description: "Number of courses created" }
);

export const exportsSuccessCounter = meter.createCounter(
  "exports.success",
  { description: "Number of successful exports" }
);

export const exportsFailureCounter = meter.createCounter(
  "exports.failure",
  { description: "Number of failed exports" }
);
