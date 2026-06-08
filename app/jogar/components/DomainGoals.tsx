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
    fetch("/api/progress", { cache: "no-store" })
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
        // Bar tracks the player's own contribution (voted) so it moves every vote; consensus
        // (needs ≥2 people on an item) is the quality gate shown as the "pronto pro eval" mark.
        const { target, level } = goalFor(p.voted);
        const pct = Math.min(100, Math.round((p.voted / target) * 100));
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
                {p.voted}/{target} <span style={{ opacity: 0.7 }}>· {p.consensus} c/ consenso</span>
              </span>
            </div>
            <div style={{ height: 6, borderRadius: 999, background: "var(--hairline)", overflow: "hidden" }}>
              <div style={{ width: `${pct}%`, height: "100%", background: evalReady ? "#3a7d44" : "var(--ink)", transition: "width .4s" }} />
            </div>
          </button>
        );
      })}
      <div style={{ fontSize: 11, color: "var(--muted)" }}>
        A barra é a sua contribuição (sobe a cada marcação, nível 30→90→180…). Vira ✓ pronto pro
        eval quando 30 itens têm consenso — ≥2 pessoas no mesmo item. Por isso vale chamar gente.
      </div>
    </div>
  );
}
