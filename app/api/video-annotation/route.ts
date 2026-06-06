import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ACTS } from "@/lib/taxonomy";
import { POINTS_VIDEO_ANNOTATION } from "@/lib/scoring";
import { getIp, rateLimit } from "@/lib/rateLimit";

const MAX_TEXT_LEN = 300;
const ACT_SET = new Set<string>(ACTS);

// body: { participant, videoId, ts, text, act, spanStart?, spanEnd? }
export async function POST(req: Request) {
  if (!(await rateLimit(`${getIp(req)}:video-annotation`, 40, 60))) {
    return NextResponse.json({ error: "muitas requisições, calma aí" }, { status: 429 });
  }
  const { participant, videoId, ts, text, act, spanStart, spanEnd } = await req.json();

  if (!participant || !videoId || text == null || act == null || ts == null) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }
  if (typeof videoId !== "string" || !/^[\w-]{11}$/.test(videoId)) {
    return NextResponse.json({ error: "video inválido" }, { status: 400 });
  }
  const seconds = Number(ts);
  if (!Number.isFinite(seconds) || seconds < 0) {
    return NextResponse.json({ error: "timestamp inválido" }, { status: 400 });
  }
  const clean = String(text).trim();
  if (!clean) {
    return NextResponse.json({ error: "escreva a fala" }, { status: 400 });
  }
  if (clean.length > MAX_TEXT_LEN) {
    return NextResponse.json({ error: `fala muito longa (máx ${MAX_TEXT_LEN})` }, { status: 400 });
  }
  if (!ACT_SET.has(act)) {
    return NextResponse.json({ error: "ato inválido" }, { status: 400 });
  }

  const ss = Number.isInteger(spanStart) ? spanStart : null;
  const se = Number.isInteger(spanEnd) ? spanEnd : null;

  try {
    await sql`insert into video_annotation (participant_id, video_id, ts_seconds, text, act, span_start, span_end)
              values (${participant}, ${videoId}, ${seconds}, ${clean}, ${act}, ${ss}, ${se})`;
  } catch {
    // FK violation = participant never registered (no demographics)
    return NextResponse.json({ error: "faça o cadastro primeiro" }, { status: 409 });
  }
  await sql`update participant_stats set points = points + ${POINTS_VIDEO_ANNOTATION}
            where participant_id = ${participant}`;
  return NextResponse.json({ ok: true, awarded: POINTS_VIDEO_ANNOTATION });
}
