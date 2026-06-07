import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { CONSENSUS_VOTES } from "@/lib/goals";

// Per-domain collection progress for the /jogar goal bars: how many items are voted (≥1) and
// how many have reached consensus (≥ CONSENSUS_VOTES). Drives the "meta por categoria" UI.
export async function GET() {
  const rows = (await sql`
    select i.source,
           count(distinct i.id) as total,
           count(distinct case when vc.n >= 1 then i.id end) as voted,
           count(distinct case when vc.n >= ${CONSENSUS_VOTES} then i.id end) as consensus
    from item i
    left join (
      select s.item_id, count(*) n
      from vote v join item_span s on s.id = v.item_span_id
      group by s.item_id
    ) vc on vc.item_id = i.id
    group by i.source`) as { source: string; total: number; voted: number; consensus: number }[];

  const by: Record<string, { total: number; voted: number; consensus: number }> = {};
  for (const r of rows) {
    by[r.source] = { total: Number(r.total), voted: Number(r.voted), consensus: Number(r.consensus) };
  }
  return NextResponse.json({ progress: by });
}
