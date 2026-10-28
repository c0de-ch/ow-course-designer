import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { BrandMark } from "@/components/ui/BrandMark";
import { VersionTag } from "@/components/ui/VersionTag";
import { IconDownload, IconLink, IconMap } from "@/components/ui/icons";
import { OPEN_WATER_FAQ, OPEN_WATER_RESOURCES, jsonLd } from "@/lib/seo-content";
import { SITE_DESCRIPTION, SITE_NAME, siteUrl } from "@/lib/site";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
  openGraph: { url: "/" },
};

const EVENTS = [
  { title: "Open water races", text: "From 1.5 km age-group races to 5 km, 10 km and marathon swims, with laps, gates and a finish funnel." },
  { title: "Triathlon and swimrun", text: "Swim legs with beach or pontoon starts, turn buoys and the exit to transition." },
  { title: "Clubs and training", text: "Measured training loops in lakes, rivers and the sea, shared with the whole group." },
  { title: "Safety planning", text: "Rescue zones, feeding platforms and shore entries on one map for the safety crews." },
];

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
  const url = siteUrl();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd([
          {
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: SITE_NAME,
            description: SITE_DESCRIPTION,
            ...(url && { url }),
            applicationCategory: "SportsApplication",
            operatingSystem: "Web browser",
            offers: { "@type": "Offer", price: "0", priceCurrency: "CHF" },
            keywords: "open water swimming, swim course, marathon swimming, triathlon, buoys",
          },
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: OPEN_WATER_FAQ.map(({ q, a }) => ({
              "@type": "Question",
              name: q,
              acceptedAnswer: { "@type": "Answer", text: a },
            })),
          },
        ])}
      />
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

      </div>

      <div className="bg-base-100 text-base-content">
        <section className="max-w-5xl mx-auto px-5 sm:px-8 py-16">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Made for open water swimming events</h2>
          <p className="mt-3 text-base-content/70 max-w-2xl">
            Race directors, coaches, triathlon organisers and safety teams use one map to plan the swim
            course, measure it and brief everyone involved.
          </p>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {EVENTS.map((e) => (
              <li key={e.title} className="rounded-2xl bg-base-200 p-5">
                <h3 className="font-semibold">{e.title}</h3>
                <p className="mt-1 text-sm text-base-content/70">{e.text}</p>
              </li>
            ))}
          </ul>
          <p className="mt-8">
            <Link href="/open-water-swim-course-design" className="font-medium text-sky-700 hover:underline">
              Read the guide: how to plan an open water swimming course →
            </Link>
          </p>
        </section>

        <section className="bg-base-200">
          <div className="max-w-3xl mx-auto px-5 sm:px-8 py-16">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Questions</h2>
            <dl className="mt-6 divide-y divide-base-300">
              {OPEN_WATER_FAQ.map(({ q, a }) => (
                <div key={q} className="py-4">
                  <dt className="font-semibold">{q}</dt>
                  <dd className="mt-1 text-base-content/75">{a}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section className="max-w-5xl mx-auto px-5 sm:px-8 py-16">
          <h2 className="text-xl font-semibold">Open water swimming organisations</h2>
          <ul className="mt-4 grid gap-x-6 gap-y-2 sm:grid-cols-2 text-sm">
            {OPEN_WATER_RESOURCES.map((r) => (
              <li key={r.url}>
                <a href={r.url} target="_blank" rel="noopener" className="text-sky-700 hover:underline">{r.name}</a>
                <span className="text-base-content/60"> · {r.text}</span>
              </li>
            ))}
          </ul>
        </section>

        <footer className="text-center text-base-content/50 text-xs py-6 border-t border-base-300">
          &copy; {new Date().getFullYear()} c0de.ch &middot; <VersionTag />
        </footer>
      </div>
    </>
  );
}
