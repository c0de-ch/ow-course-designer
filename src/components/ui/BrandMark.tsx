import Link from "next/link";

/** App logo + name. `tone="light"` for use on dark backgrounds. */
export function BrandMark({ tone = "dark", href = "/" }: { tone?: "dark" | "light"; href?: string }) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-2.5 font-bold tracking-tight ${tone === "light" ? "text-white" : "text-base-content"}`}
    >
      <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" rx="8" fill="#0284C7" />
        <path d="M5 21c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2 2-1 2-1" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
        <circle cx="21" cy="11" r="3.5" fill="#FBBF24" stroke="#fff" strokeWidth="1.5" />
        <path d="M8 15 13 10l4 3" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="2.5 2" />
      </svg>
      <span className="text-lg">OW Course Designer</span>
    </Link>
  );
}
