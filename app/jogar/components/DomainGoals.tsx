"use client";

// "Meta por categoria": shows how close each domain is to its collection goal, so players see
// what's missing (and which domain to focus). The fill = consensus items / target; we also show
// voted count, since with few voters consensus moves slower than raw votes.

import { useEffect, useState } from "react";
import { GOALS, GOAL_ORDER, goalFor, EVAL_READY } from "@/lib/goals";

type Prog = Record<string, { total: number; voted: number; consensus: number }>;

export default function DomainGoals({
  version,
  onPick,
}: {
  version: number;
  onPick?: (source: string) => void;
}) {
  const [prog, setProg] = useState<Prog | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/progress")
      .then((r) => r.json())
      .then((d) => { if (alive) setProg(d.progress ?? {}); })
      .catch(() => {});
    return () => { alive = false; };
  }, [version]);

  if (!prog) return null;

  return (
    <div style={{ margin: "0 0 22px", display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontSize: 12, letterSpacing: 0.4, textTransform: "uppercase", color: "var(--muted)" }}>
        Metas por categoria
      </div>
      {GOAL_ORDER.map((src) => {
        const g = GOALS[src];
        const p = prog[src] ?? { total: 0, voted: 0, consensus: 0 };
        const { target, level } = goalFor(p.consensus);
        const pct = Math.min(100, Math.round((p.consensus / target) * 100));
        const evalReady = p.consensus >= EVAL_READY;
        return (
          <button
            key={src}
            onClick={() => onPick?.(src)}
            title="focar nesta categoria"
            style={{ background: "transparent", border: "none", padding: 0, cursor: onPick ? "pointer" : "default", textAlign: "left" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: 13, marginBottom: 4, gap: 8 }}>
              <span style={{ color: "var(--ink)", display: "flex", alignItems: "center", gap: 6 }}>
                {g.label}
                {level > 0 && (
                  <span style={{ fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: 999, background: "var(--ink)", color: "var(--canvas)" }}>
                    Nv {level}
                  </span>
                )}
                {evalReady && <span style={{ fontSize: 11, color: "#3a7d44" }}>✓ pronto pro eval</span>}
              </span>
              <span style={{ color: "var(--muted)", whiteSpace: "nowrap" }}>
                {p.consensus}/{target} <span style={{ opacity: 0.7 }}>· {p.voted} votados</span>
              </span>
            </div>
            <div style={{ height: 6, borderRadius: 999, background: "var(--hairline)", overflow: "hidden" }}>
              <div style={{ width: `${pct}%`, height: "100%", background: evalReady ? "#3a7d44" : "var(--ink)", transition: "width .4s" }} />
            </div>
          </button>
        );
      })}
      <div style={{ fontSize: 11, color: "var(--muted)" }}>
        Meta = itens com consenso (≥2 votos no mesmo item). Bate 30 → pronto pro eval; daí sobe de
        nível (90, 180…) pra continuar ajudando. Precisa de gente votando os mesmos itens.
      </div>
    </div>
  );
}
