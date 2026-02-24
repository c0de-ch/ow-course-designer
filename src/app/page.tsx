import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="min-h-screen relative flex flex-col items-center justify-center">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('/hero-bg.webp')" }}
      />
      <div className="absolute inset-0 bg-black/60" />
      <div className="relative z-10 text-center max-w-2xl px-8">
        <h1 className="text-5xl font-bold mb-4 text-white">OW Course Designer</h1>
        <p className="text-lg text-white/80 mb-2">
          A playground application for designing open-water swim courses.
        </p>
        <p className="text-base text-white/60 mb-8">
          Drop buoys, set gates, mark rescue zones, and export your course as GPX, PDF, or a shareable link.
        </p>
        <div className="flex gap-4 justify-center">
          <Link href="/dashboard" className="btn btn-primary btn-lg">
            Go to Dashboard
          </Link>
          <Link
            href="/register"
            className="btn btn-outline btn-lg text-white border-white hover:bg-white hover:text-black"
          >
            Create Account
          </Link>
        </div>
      </div>
      <footer className="absolute bottom-4 text-white/40 text-sm z-10">
        &copy; 2026 c0de.ch
      </footer>
    </div>
  );
}
