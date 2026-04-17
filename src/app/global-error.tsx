"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global-error]", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: 0,
          padding: 16,
          background: "#f3f4f6",
        }}
      >
        <div
          style={{
            maxWidth: 480,
            width: "100%",
            background: "white",
            borderRadius: 12,
            padding: 24,
            boxShadow: "0 10px 25px rgba(0,0,0,0.08)",
          }}
        >
          <h1 style={{ margin: "0 0 12px", fontSize: 22 }}>
            Application error
          </h1>
          <p style={{ margin: "0 0 16px", color: "#4b5563", fontSize: 14 }}>
            We hit a fatal error. Try reloading — if it persists, come back in a
            few minutes.
          </p>
          {error.digest && (
            <p
              style={{
                margin: "0 0 16px",
                color: "#9ca3af",
                fontSize: 12,
                fontFamily: "ui-monospace, monospace",
              }}
            >
              Ref: {error.digest}
            </p>
          )}
          <button
            onClick={reset}
            style={{
              appearance: "none",
              border: "none",
              cursor: "pointer",
              padding: "10px 16px",
              borderRadius: 8,
              background: "#2563eb",
              color: "white",
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
