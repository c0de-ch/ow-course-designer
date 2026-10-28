import { VersionTag } from "@/components/ui/VersionTag";

/** Bottom bar for the signed-in pages (dashboard, settings), aligned with AppHeader. */
export function AppFooter() {
  return (
    <footer className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-4 text-xs text-base-content/50">
      &copy; {new Date().getFullYear()} c0de.ch &middot; <VersionTag />
    </footer>
  );
}
