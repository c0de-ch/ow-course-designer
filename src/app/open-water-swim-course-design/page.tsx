import type { Metadata } from "next";
import Link from "next/link";
import { BrandMark } from "@/components/ui/BrandMark";
import { VersionTag } from "@/components/ui/VersionTag";
import { OPEN_WATER_RESOURCES, jsonLd } from "@/lib/seo-content";
import { SITE_NAME } from "@/lib/site";

const TITLE = "How to plan an open water swimming course";
const DESCRIPTION =
  "A practical guide to laying out an open water swim course: distances and laps, turn buoys and " +
  "swim direction, start and finish, feeding stations, safety cover, and sharing the course with " +
  "swimmers and officials.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/open-water-swim-course-design" },
  openGraph: {
    type: "article",
    title: TITLE,
    description: DESCRIPTION,
    url: "/open-water-swim-course-design",
    // Setting openGraph here replaces the inherited one, image included
    images: [{ url: "/opengraph-image.jpg", width: 1200, height: 630 }],
  },
};

const SECTIONS: { id: string; title: string; body: string[] }[] = [
  {
    id: "distance",
    title: "1. Choose the distance and the number of laps",
    body: [
      "Start from the race distance: short races of 500 m to 1.5 km, the classic 5 km and 10 km (the Olympic marathon swimming distance), or longer marathon swims. Triathlon swim legs follow the distances of their format.",
      "A loop that is swum several times is easier to mark and to watch than one long line, but every extra lap means more traffic at the turns and lapped swimmers in the field. Measure each lap, not only the total: with the lap editor you can skip a buoy on some laps, for example to shorten the last lap towards the finish, and still see the exact distance of every lap.",
    ],
  },
  {
    id: "buoys",
    title: "2. Place the turn buoys and fix the swim direction",
    body: [
      "Turn buoys define the course. Use large, clearly visible buoys in a colour that stands out from the water and the shore, and give the finish approach a different colour if you can.",
      "Decide for every turn whether swimmers keep the buoy on their left or on their right, and keep it consistent where possible. Avoid a sharp turn right after the start, where the field is still packed, and keep long straights between turns so the field can spread out. Mark sighting buoys on long legs.",
    ],
  },
  {
    id: "start-finish",
    title: "3. Lay out the start and the finish",
    body: [
      "The start line should be wide enough for the whole wave and square to the first leg, so no position has a shorter way to the first buoy. Water starts, beach starts and pontoon starts each need their own space and marshals.",
      "Lead swimmers into the finish with a funnel of buoys or lane lines towards the finish gate, so that the order of arrival is clear for the timing team and the judges.",
    ],
  },
  {
    id: "feeding",
    title: "4. Plan feeding stations",
    body: [
      "Races of 10 km and longer usually have feeding platforms or pontoons where coaches hand drinks to their swimmers. Place them on a straight part of the loop, out of the way of the turns, with room for the coaches and officials who stand on them.",
    ],
  },
  {
    id: "safety",
    title: "5. Plan the safety cover",
    body: [
      "Mark rescue and exit zones, the positions of safety boats, kayaks and paddle boards, and where medical staff wait on shore. Every part of the course should be in sight of a safety craft, with more cover at the start, at the turns and in cold water.",
      "Check the depth, currents, boat traffic, water quality and temperature, and agree the course with the local authorities and the owner of the water.",
    ],
  },
  {
    id: "share",
    title: "6. Share the course and check it on the water",
    body: [
      "Give swimmers, officials, safety crews and volunteers the same map: as a link they can open on their phone, a PDF or PNG for the race briefing, and GPX or KML files to place the buoys with a GPS. A flyover video helps swimmers picture the course before the start.",
      "Finally, place the buoys and check the course on the water. Wind and currents move buoys, so check their positions again on race morning.",
    ],
  },
];

export default function CourseDesignGuidePage() {
  return (
    <div className="min-h-dvh bg-base-200 flex flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd({
          "@context": "https://schema.org",
          "@type": "Article",
          headline: TITLE,
          description: DESCRIPTION,
          about: ["Open water swimming", "Swim course design", "Marathon swimming", "Triathlon"],
          publisher: { "@type": "Organization", name: SITE_NAME },
        })}
      />

      <header className="bg-base-100 border-b border-base-300">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-4 px-4 sm:px-6 h-16">
          <BrandMark href="/" />
          <Link href="/register" className="btn btn-primary btn-sm">Plan a course</Link>
        </div>
      </header>

      <main className="w-full flex-1 max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <article>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">{TITLE}</h1>
          <p className="mt-4 text-lg text-base-content/70">{DESCRIPTION}</p>

          <nav aria-label="Contents" className="mt-6 rounded-xl bg-base-100 ring-1 ring-base-300 p-4">
            <ul className="grid gap-1 text-sm">
              {SECTIONS.map((s) => (
                <li key={s.id}><a href={`#${s.id}`} className="text-sky-700 hover:underline">{s.title}</a></li>
              ))}
            </ul>
          </nav>

          {SECTIONS.map((s) => (
            <section key={s.id} id={s.id} className="mt-10 scroll-mt-6">
              <h2 className="text-xl font-semibold">{s.title}</h2>
              {s.body.map((p, i) => (
                <p key={i} className="mt-3 leading-relaxed text-base-content/85">{p}</p>
              ))}
            </section>
          ))}

          <section className="mt-12 rounded-2xl bg-sky-50 ring-1 ring-sky-200 p-6">
            <h2 className="text-xl font-semibold">Draw your course on the map</h2>
            <p className="mt-2 text-base-content/80">
              {SITE_NAME} lets you place buoys, gates, start, finish, feeding platforms and rescue zones on
              satellite imagery of your venue, shows the distance of every lap, and shares the course with one link.
            </p>
            <Link href="/register" className="btn btn-primary mt-4">Create a free account</Link>
          </section>

          <section className="mt-12">
            <h2 className="text-xl font-semibold">Rules and open water organisations</h2>
            <p className="mt-2 text-base-content/70">
              For sanctioned events, the federation rules decide. Always check the current regulations.
            </p>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {OPEN_WATER_RESOURCES.map((r) => (
                <li key={r.url} className="rounded-xl bg-base-100 ring-1 ring-base-300 p-4">
                  <a href={r.url} target="_blank" rel="noopener" className="font-medium text-sky-700 hover:underline">
                    {r.name}
                  </a>
                  <p className="mt-1 text-sm text-base-content/70">{r.text}</p>
                </li>
              ))}
            </ul>
          </section>
        </article>
      </main>

      <footer className="w-full max-w-3xl mx-auto px-4 sm:px-6 py-4 text-xs text-base-content/50">
        &copy; {new Date().getFullYear()} c0de.ch &middot; <VersionTag />
      </footer>
    </div>
  );
}
