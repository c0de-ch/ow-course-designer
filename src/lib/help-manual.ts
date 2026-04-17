interface ManualEntry {
  keywords: string[];
  answer: string;
}

const manual: ManualEntry[] = [
  {
    keywords: ["what", "ow course designer", "about", "purpose", "app"],
    answer: `**OW Course Designer** is a tool for designing open-water swim courses. You can:

1. Search for any body of water (lake, bay, ocean) using Google Places
2. Drop markers on a map to define your swim course
3. See live distance calculations
4. Export your course as PDF, PNG, GPX, or KML
5. Share your course with others via a public link
6. Record flyover videos of your course`,
  },
  {
    keywords: ["create", "new", "course", "start", "begin"],
    answer: `To create a new course:

1. Go to the **Dashboard** (log in first if needed)
2. Click the **"+ New Course"** button
3. You'll be taken to the designer where you can start adding markers
4. Use the search bar to find your body of water
5. Select tools from the left sidebar to start placing markers`,
  },
  {
    keywords: ["buoy", "place", "add", "marker"],
    answer: `To add markers:

1. Select the desired tool from the **left sidebar** (Buoy, Start, Finish, Gate, Shore Entry, or Rescue Zone)
2. **Click on the map** where you want to place the marker
3. For **Gates**: click twice — first for the left post, then for the right post
4. For **Rescue Zones**: click to add vertices, then **double-click** to close the polygon
5. Use the **Select tool** to drag markers to new positions
6. **Right-click** a marker to delete it`,
  },
  {
    keywords: ["move", "drag", "reposition"],
    answer: `To move markers:

1. Select the **Select tool** (pointer icon) from the left sidebar
2. **Click and drag** any marker to move it
3. The distance updates automatically as you move markers
4. Changes are auto-saved after 2 seconds`,
  },
  {
    keywords: ["delete", "remove"],
    answer: `To delete a marker:

1. Select the **Select tool** from the left sidebar
2. **Right-click** on the marker you want to delete
3. The marker will be removed and the route distance will update`,
  },
  {
    keywords: ["export", "pdf", "png", "download", "print"],
    answer: `To export your course:

1. In the designer, find the **Export** section in the left sidebar
2. Choose your format:
   - **PDF** — printable document with map and course details
   - **PNG** — image file of the course map
   - **GPX** — GPS exchange format (for GPS devices and apps)
   - **KML** — for Google Earth
3. Click the export button and the file will download`,
  },
  {
    keywords: ["share", "link", "public", "url"],
    answer: `To share your course:

1. In the designer, find the **Share** button in the Export section
2. Click **"Create Share Link"**
3. A public URL will be generated — copy and send it to anyone
4. The shared view is **read-only** — viewers can see the map and export
5. The share link captures a snapshot, so later edits won't affect it`,
  },
  {
    keywords: ["gate", "how", "create"],
    answer: `Gates require two clicks:

1. Select the **Gate tool** from the left sidebar
2. **First click**: places the left gate post
3. **Second click**: places the right gate post
4. The gate appears as a line between the two posts

Gates are useful for marking swim course entry/exit points or turning points.`,
  },
  {
    keywords: ["rescue", "zone", "safety"],
    answer: `Rescue zones are polygon areas on the map:

1. Select the **Rescue Zone tool** from the left sidebar
2. **Click** on the map to add polygon vertices
3. **Double-click** to close the polygon and create the zone
4. The zone will be displayed as a shaded area on the map

Use rescue zones to mark safety boat positions or emergency meeting points.`,
  },
  {
    keywords: ["save", "autosave", "auto-save"],
    answer: `Courses are **auto-saved** automatically:

- Changes are saved **2 seconds** after your last edit
- A save indicator in the top bar shows the save status
- You don't need to manually save
- If you close the browser, your course will be there when you come back`,
  },
  {
    keywords: ["distance", "length", "how far", "measure"],
    answer: `The course distance is calculated automatically:

- Distance is measured along the route defined by your markers
- It uses the **Haversine formula** for accurate distance
- The distance updates in **real-time** as you add, move, or remove markers
- Distance is shown in the course stats area`,
  },
  {
    keywords: ["flyover", "video", "record", "animation"],
    answer: `Flyover videos let you create an animated tour of your course:

1. In the Export section, find the **Flyover** option
2. Click to open the flyover modal
3. The video is recorded by animating the map camera along your route
4. Once recorded, you can upload it to attach to your shared course link
5. Viewers of the shared link can watch the flyover video`,
  },
  {
    keywords: ["account", "register", "sign up", "create account"],
    answer: `To create an account:

1. Go to the **Register** page
2. You can register with:
   - **Email and password**: fill in the form and click Register
   - **Google account**: click "Sign in with Google"
3. After registering, you'll be redirected to the dashboard`,
  },
  {
    keywords: ["login", "sign in", "google", "oauth"],
    answer: `To sign in:

1. Go to the **Login** page
2. Choose your method:
   - **Email and password**: enter your credentials
   - **Google**: click "Sign in with Google"
3. After signing in, you'll be taken to your dashboard`,
  },
  {
    keywords: ["shore", "entry", "exit", "beach"],
    answer: `Shore entries mark where swimmers enter or exit the water:

1. Select the **Shore Entry tool** from the left sidebar
2. Click on the map at the entry/exit point
3. Shore entries are shown with a distinct marker

They're useful for marking beach start/finish locations or water entry points.`,
  },
  {
    keywords: ["feeding", "platform", "station", "food"],
    answer: `Feeding platforms mark where swimmers can receive nutrition:

1. Select the **Feeding Platform tool** from the left sidebar
2. Click on the map to place the platform
3. Feeding platforms appear with a distinct marker on the map`,
  },
  {
    keywords: ["freehand", "draw", "line", "shape"],
    answer: `The freehand tool lets you draw custom shapes on the map:

1. Select the **Freehand tool** from the left sidebar
2. Click and drag on the map to draw
3. Release to finish the shape
4. You can customize the label and color of freehand drawings`,
  },
];

const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "can", "do", "does",
  "for", "from", "how", "i", "if", "in", "is", "it", "its", "me", "my",
  "of", "on", "or", "the", "this", "to", "want", "we", "what", "when",
  "where", "which", "who", "why", "will", "with", "you", "your",
]);

function tokenize(text: string): Set<string> {
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t))
    .map((t) => t.replace(/(ies|es|s)$/, (m) => (m === "ies" ? "y" : "")));
  return new Set(tokens);
}

export function findCachedResponse(message: string): string | null {
  const messageTokens = tokenize(message);
  if (messageTokens.size === 0) return null;

  let bestMatch: ManualEntry | null = null;
  let bestScore = 0;

  for (const entry of manual) {
    const keywordTokens = tokenize(entry.keywords.join(" "));
    let score = 0;
    for (const kw of keywordTokens) {
      if (messageTokens.has(kw)) score++;
    }
    if (score >= 2 && score > bestScore) {
      bestScore = score;
      bestMatch = entry;
    }
  }

  return bestMatch?.answer ?? null;
}

export function getManualContext(): string {
  return manual
    .map((e) => `Q: [${e.keywords.slice(0, 3).join(", ")}]\nA: ${e.answer}`)
    .join("\n\n---\n\n");
}
