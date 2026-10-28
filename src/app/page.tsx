import Link from "next/link";
import { auth } from "@/lib/auth";
import { BrandMark } from "@/components/ui/BrandMark";
import { VersionTag } from "@/components/ui/VersionTag";
import { IconDownload, IconLink, IconMap } from "@/components/ui/icons";

const FEATURES = [
  {
    icon: IconMap,
    title: "Draw on the real lake",
    text: "Find your venue, then place buoys, gates, start, finish, feeding platforms and rescue zones on satellite imagery.",
  },
  {
    icon: IconDownload,
    title: "Exact distances",
    text: "The course length updates as you build it, lap by lap. Export to PDF, PNG, GPX, KML or CSV.",
  },
  {
    icon: IconLink,
    title: "Share with one link",
    text: "Send swimmers and safety crews a read-only map they can open on any phone, with an optional flyover video.",
  },
];

export default async function LandingPage() {
  const session = await auth();
  const signedIn = !!session?.user;

  return (
    <div className="min-h-dvh relative flex flex-col">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('/hero-bg.webp')" }}
        aria-hidden="true"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-slate-900/70 via-slate-900/60 to-slate-900/90" aria-hidden="true" />

      <header className="relative z-10 flex items-center justify-between px-5 sm:px-8 py-5">
        <BrandMark tone="light" />
        {signedIn ? (
          <Link href="/dashboard" className="btn btn-sm bg-white/10 text-white border border-white/30 hover:bg-white/20">
            My courses
          </Link>
        ) : (
          <Link href="/login" className="btn btn-sm bg-white/10 text-white border border-white/30 hover:bg-white/20">
            Sign in
          </Link>
        )}
      </header>

      <main className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-5 sm:px-8 py-12">
        <h1 className="text-4xl sm:text-6xl font-bold tracking-tight text-white max-w-3xl">
          Design open-water swim courses in minutes
        </h1>
        <p className="mt-5 text-lg text-white/80 max-w-xl">
          Plan the course on a map, get the exact distance, and share it with swimmers,
          officials and safety crews.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          {signedIn ? (
            <Link href="/dashboard" className="btn btn-primary btn-lg">
              Open my courses
            </Link>
          ) : (
            <>
              <Link href="/register" className="btn btn-primary btn-lg">
                Create a free account
              </Link>
              <Link
                href="/login"
                className="btn btn-lg bg-transparent text-white border border-white/70 hover:bg-white hover:text-slate-900"
              >
                Sign in
              </Link>
            </>
          )}
        </div>

        <ul className="mt-16 grid gap-4 sm:grid-cols-3 max-w-5xl w-full text-left">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <li key={title} className="rounded-2xl bg-white/10 backdrop-blur-sm ring-1 ring-white/15 p-5">
              <Icon size={22} className="text-sky-300" />
              <h2 className="mt-3 font-semibold text-white">{title}</h2>
              <p className="mt-1 text-sm text-white/70">{text}</p>
            </li>
          ))}
        </ul>
      </main>

      <footer className="relative z-10 text-center text-white/45 text-xs py-5">
        &copy; {new Date().getFullYear()} c0de.ch &middot; <VersionTag />
      </footer>
    </div>
  );
}
