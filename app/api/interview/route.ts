import { NextResponse } from "next/server";
import { parseInterview } from "@/lib/fapesp";

// GET /api/interview?url=<rodaviva.fapesp.br interview page>
// Fetches a Memória Roda Viva transcript (ISO-8859-1) and returns clean turns.
export async function GET(req: Request) {
  const url = new URL(req.url).searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "url required" }, { status: 400 });
  }
  let target: URL;
  try {
    target = new URL(url);
  } catch {
    return NextResponse.json({ error: "url inválida" }, { status: 400 });
  }
  if (target.hostname !== "rodaviva.fapesp.br") {
    return NextResponse.json({ error: "só aceito links do rodaviva.fapesp.br" }, { status: 400 });
  }

  let html: string;
  try {
    // Cache aggressively — the FAPESP archive is static.
    const res = await fetch(target.toString(), { next: { revalidate: 86400 } });
    if (!res.ok) {
      return NextResponse.json({ error: `fapesp respondeu ${res.status}` }, { status: 502 });
    }
    html = Buffer.from(await res.arrayBuffer()).toString("latin1");
  } catch {
    return NextResponse.json({ error: "não consegui buscar a entrevista" }, { status: 502 });
  }

  const interview = parseInterview(html);
  if (interview.turns.length === 0) {
    return NextResponse.json({ error: "não achei falas nessa página" }, { status: 422 });
  }
  return NextResponse.json({ ...interview, sourceRef: target.toString() });
}
