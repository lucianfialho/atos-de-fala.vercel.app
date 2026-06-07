"use client";

// "Meta por categoria": shows how close each domain is to its collection goal, so players see
// what's missing (and which domain to focus). The fill = consensus items / target; we also show
// voted count, since with few voters consensus moves slower than raw votes.

import { useEffect, useState } from "react";
import { GOALS, GOAL_ORDER } from "@/lib/goals";

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
        const pct = Math.min(100, Math.round((p.consensus / g.target) * 100));
        const done = p.consensus >= g.target;
        return (
          <button
            key={src}
            onClick={() => onPick?.(src)}
            title="focar nesta categoria"
            style={{ background: "transparent", border: "none", padding: 0, cursor: onPick ? "pointer" : "default", textAlign: "left" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
              <span style={{ color: "var(--ink)" }}>{done ? "✓ " : ""}{g.label}</span>
              <span style={{ color: "var(--muted)" }}>
                {p.consensus}/{g.target} <span style={{ opacity: 0.7 }}>· {p.voted} votados</span>
              </span>
            </div>
            <div style={{ height: 6, borderRadius: 999, background: "var(--hairline)", overflow: "hidden" }}>
              <div style={{ width: `${pct}%`, height: "100%", background: done ? "#3a7d44" : "var(--ink)", transition: "width .4s" }} />
            </div>
          </button>
        );
      })}
      <div style={{ fontSize: 11, color: "var(--muted)" }}>
        Meta = itens com consenso (≥2 votos no mesmo item). Precisa de gente votando os mesmos itens.
      </div>
    </div>
  );
}
