// Copy shared by the landing page and the course design guide, also used for
// their structured data (JSON-LD), so search engines see the same text.

export const OPEN_WATER_RESOURCES = [
  {
    name: "World Aquatics: Open Water Swimming",
    url: "https://www.worldaquatics.com/open-water",
    text: "Results, rankings and news from the international federation.",
  },
  {
    name: "World Aquatics Open Water Swimming World Cup 2026",
    url: "https://www.worldaquatics.com/series/205/world-aquatics-open-water-swimming-world-cup-2026",
    text: "The World Cup series calendar and race venues.",
  },
  {
    name: "World Aquatics competition regulations",
    url: "https://www.worldaquatics.com/rules/competition-regulations",
    text: "The current open water swimming rules for sanctioned events.",
  },
  {
    name: "European Aquatics: Open Water",
    url: "https://europeanaquatics.org/sports/open-water/",
    text: "European championships, cups and open water events.",
  },
  {
    name: "Swiss Aquatics",
    url: "https://www.swiss-aquatics.ch/",
    text: "The Swiss federation, including open water swimming.",
  },
  {
    name: "World Triathlon",
    url: "https://www.triathlon.org/",
    text: "Triathlon competition rules, including the swim leg.",
  },
];

export const OPEN_WATER_FAQ = [
  {
    q: "What is OW Course Designer?",
    a: "A free web app for planning open water swimming courses. You find the lake, river or sea venue on a satellite map, place turn buoys, gates, the start, the finish, feeding platforms and rescue zones, and see the exact course distance while you build it.",
  },
  {
    q: "Which events can I plan with it?",
    a: "Open water races such as 1.5 km, 5 km and 10 km events and marathon swims, triathlon and swimrun swim legs, masters and age-group races, charity swims, and regular club or training loops.",
  },
  {
    q: "How is the course distance measured?",
    a: "Along the swim route between the markers, using great-circle distance on the map. Multi-lap courses show the distance per lap and in total, including laps where some buoys are skipped.",
  },
  {
    q: "Can swimmers and the safety team see the course?",
    a: "Yes. A share link opens a read-only map on any phone or computer, and the course can be exported as PDF, PNG, GPX, KML or CSV for briefings, safety plans and GPS watches. A flyover video can be added for the race briefing.",
  },
  {
    q: "Does it replace the official rules?",
    a: "No. It helps you lay out and communicate the course. For sanctioned events, check the current World Aquatics, continental or national federation rules, and confirm the course on the water before the race.",
  },
];

/** Renders JSON-LD safely inside a <script> tag. */
export function jsonLd(data: unknown): { __html: string } {
  return { __html: JSON.stringify(data).replace(/</g, "\\u003c") };
}
