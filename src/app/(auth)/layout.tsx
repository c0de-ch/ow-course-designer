import { BrandMark } from "@/components/ui/BrandMark";
import { VersionTag } from "@/components/ui/VersionTag";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh relative flex flex-col items-center justify-center px-4 py-10">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('/hero-bg.webp')" }}
        aria-hidden="true"
      />
      <div className="absolute inset-0 bg-slate-900/70" aria-hidden="true" />
      <div className="relative z-10 w-full max-w-md flex flex-col items-center gap-6">
        <BrandMark tone="light" />
        {children}
        <p className="text-xs text-white/50">&copy; {new Date().getFullYear()} c0de.ch &middot; <VersionTag /></p>
      </div>
    </div>
  );
}
