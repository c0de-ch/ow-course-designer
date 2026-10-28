import { VersionTag } from "@/components/ui/VersionTag";

/** Bottom bar for the signed-in pages (dashboard, settings), aligned with AppHeader. */
export function AppFooter({ className = "max-w-5xl text-base-content/50" }: { className?: string }) {
  return (
    <footer className={`w-full mx-auto px-4 sm:px-6 py-4 text-xs ${className}`}>
      &copy; {new Date().getFullYear()} c0de.ch &middot; <VersionTag />
    </footer>
  );
}
