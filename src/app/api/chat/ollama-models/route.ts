import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { serverUrl } = await req.json();

  if (!serverUrl) {
    return NextResponse.json({ error: "Server URL required" }, { status: 400 });
  }

  try {
    const response = await fetch(`${serverUrl}/api/tags`);
    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch models: ${response.statusText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    const models = (data.models || []).map(
      (m: { name: string }) => m.name
    );
    return NextResponse.json({ models });
  } catch (err) {
    return NextResponse.json(
      {
        error: `Cannot connect to Ollama server: ${(err as Error).message}`,
      },
      { status: 502 }
    );
  }
}
