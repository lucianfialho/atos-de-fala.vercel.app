import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ACTS } from "@/lib/taxonomy";
import { POINTS_SPAN_ANNOTATION } from "@/lib/scoring";
import { getIp, rateLimit } from "@/lib/rateLimit";

const MAX_TEXT_LEN = 400;
const ACT_SET = new Set<string>(ACTS);
const VERDICTS = new Set(["confirmed", "corrected", "added"]);

// body: { participant, source, sourceRef, speaker, context, text, charStart, charEnd,
//         act, modelAct, verdict }
export async function POST(req: Request) {
  if (!(await rateLimit(`${getIp(req)}:annotation`, 80, 60))) {
    return NextResponse.json({ error: "muitas requisições, calma aí" }, { status: 429 });
  }
  const b = await req.json().catch(() => ({}));
  const { participant, source, sourceRef, speaker, context, text, charStart, charEnd, act, modelAct, verdict } = b;

  if (!participant || !source || !sourceRef || !context || !text || act == null) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }
  const clean = String(text).trim();
  if (!clean || clean.length > MAX_TEXT_LEN) {
    return NextResponse.json({ error: "texto inválido" }, { status: 400 });
  }
  if (!ACT_SET.has(act)) {
    return NextResponse.json({ error: "ato inválido" }, { status: 400 });
  }
  if (modelAct != null && !ACT_SET.has(modelAct)) {
    return NextResponse.json({ error: "modelAct inválido" }, { status: 400 });
  }
  const v = VERDICTS.has(verdict) ? verdict : "confirmed";
  const cs = Number.isInteger(charStart) ? charStart : 0;
  const ce = Number.isInteger(charEnd) ? charEnd : clean.length;

  try {
    await sql`insert into span_annotation
                (participant_id, source, source_ref, speaker, context, text, char_start, char_end, act, model_act, verdict)
              values
                (${participant}, ${source}, ${sourceRef}, ${speaker ?? null}, ${String(context)},
                 ${clean}, ${cs}, ${ce}, ${act}, ${modelAct ?? null}, ${v})`;
  } catch {
    return NextResponse.json({ error: "faça o cadastro primeiro" }, { status: 409 });
  }
  await sql`update participant_stats set points = points + ${POINTS_SPAN_ANNOTATION}
            where participant_id = ${participant}`;
  return NextResponse.json({ ok: true, awarded: POINTS_SPAN_ANNOTATION });
}
