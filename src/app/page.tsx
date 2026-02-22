import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-base-200 flex flex-col items-center justify-center gap-8 p-8">
      <div className="text-center max-w-2xl">
        <h1 className="text-5xl font-bold mb-4">OW Parcour Designer</h1>
        <p className="text-xl text-base-content/70 mb-8">
          Design open-water swim courses. Drop buoys, set gates, mark rescue zones, and export
          your course as GPX, PDF, or a shareable link.
        </p>
        <div className="flex gap-4 justify-center">
          <Link href="/dashboard" className="btn btn-primary btn-lg">
            Go to Dashboard
          </Link>
          <Link href="/register" className="btn btn-outline btn-lg">
            Create Account
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-2xl w-full">
        {[
          { icon: "🟡", label: "Buoys" },
          { icon: "⬛", label: "Gates" },
          { icon: "⛑", label: "Rescue Zones" },
          { icon: "📍", label: "GPX Export" },
        ].map(({ icon, label }) => (
          <div
            key={label}
            className="card bg-base-100 shadow text-center p-4"
          >
            <div className="text-3xl mb-2">{icon}</div>
            <div className="text-sm font-medium">{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
