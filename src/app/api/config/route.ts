import { NextResponse } from "next/server";
import { runtimeEnv } from "@/lib/app-url";

export const dynamic = "force-dynamic";

// Public settings the browser needs, read at runtime so one image works with
// any key. The Maps key is a browser key and visible to every visitor anyway;
// restrict it by HTTP referrer in Google Cloud.
export async function GET() {
  return NextResponse.json(
    {
      mapsApiKey: runtimeEnv("GOOGLE_MAPS_API_KEY") ?? "",
      mapId: runtimeEnv("GOOGLE_MAPS_MAP_ID") ?? null,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
