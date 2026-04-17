"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function SegmentError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[segment-error]", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-base-200 p-4">
      <div className="card w-full max-w-md shadow-xl bg-base-100">
        <div className="card-body gap-4">
          <h1 className="card-title text-2xl">Something went wrong</h1>
          <p className="text-content2 text-sm">
            We hit an unexpected error loading this page. You can try again, or
            head back to the dashboard.
          </p>
          {error.digest && (
            <p className="text-xs text-content3 font-mono">
              Ref: {error.digest}
            </p>
          )}
          <div className="flex gap-2">
            <button onClick={reset} className="btn btn-primary flex-1">
              Try again
            </button>
            <Link href="/dashboard" className="btn btn-outline flex-1">
              Dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
