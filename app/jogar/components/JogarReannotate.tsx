"use client";

// "Dividir / re-marcar" mode for /jogar. Reuses the /assistir select-and-mark UI (TurnCard).
// IMPORTANT: this writes a NEW span_annotation per span — it NEVER edits the model's proposed
// item_span. The crowd can't corrupt the source annotation; their re-annotation is one more
// opinion, reconciled by consensus + reliability at aggregation time. Single-label per span
// (v1); seeded with the model's spans so splitting/removing/re-bounding is a few taps.

import { useState } from "react";
import TurnCard, { SpanState } from "@/app/assistir/TurnCard";

type ItemSpan = { id: number; char_start: number; char_end: number; ai_act: string };
type Item = { id: number; text: string; source?: string; spans: ItemSpan[] };

export default function JogarReannotate({
  item,
  pid,
  onDone,
  onAward,
}: {
  item: Item;
  pid: string;
  onDone: () => void;
  onAward?: (pts: number) => void;
}) {
  const [spans, setSpans] = useState<SpanState[]>(
    item.spans.map((s) => ({
      start: s.char_start,
      end: s.char_end,
      act: s.ai_act,
      modelAct: s.ai_act,
      status: "pending",
    }))
  );
  const [saved, setSaved] = useState(0);
  const [err, setErr] = useState("");

  async function save(span: SpanState, verdict: "confirmed" | "corrected" | "added", act: string) {
    const res = await fetch("/api/annotation", {
      method: "POST",
      body: JSON.stringify({
        participant: pid,
        source: item.source || "synthetic",
        sourceRef: `item:${item.id}`,
        speaker: null,
        context: item.text,
        text: item.text.slice(span.start, span.end),
        charStart: span.start,
        charEnd: span.end,
        act,
        modelAct: span.modelAct,
        verdict,
      }),
    });
    if (res.ok) {
      const d = await res.json().catch(() => ({}));
      setSaved((n) => n + 1);
      if (d.awarded) onAward?.(d.awarded);
    } else if (res.status === 409) {
      setErr("Faça o cadastro na página inicial pra registrar suas anotações.");
    }
  }

  const update = (i: number, patch: Partial<SpanState>) =>
    setSpans((prev) => prev.map((s, j) => (j === i ? { ...s, ...patch } : s)));

  return (
    <div style={{ marginBottom: 24 }}>
      <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 12px" }}>
        Re-marque os trechos: clique num span pra confirmar/trocar/remover, ou selecione um
        trecho novo pra marcar. Isso cria uma <strong>anotação nova</strong> — não altera a do
        modelo.
      </p>
      <TurnCard
        speaker="sua anotação"
        text={item.text}
        spans={spans}
        analyzing={false}
        onConfirm={(i) => { update(i, { status: "confirmed" }); save(spans[i], "confirmed", spans[i].act); }}
        onCorrect={(i, a) => { update(i, { act: a, status: "corrected" }); save(spans[i], "corrected", a); }}
        onRemove={(i) => update(i, { status: "removed" })}
        onAdd={(start, end, act) => {
          const span: SpanState = { start, end, act, modelAct: null, status: "added" };
          setSpans((prev) => [...prev, span]);
          save(span, "added", act);
        }}
      />
      {err && <p style={{ fontSize: 13, color: "#b4431f", marginTop: 8 }}>{err}</p>}
      <button
        className="btn-ink"
        onClick={onDone}
        style={{ width: "100%", height: 48, fontSize: 16, marginTop: 16 }}
      >
        {saved > 0 ? `Concluir (${saved} marcado${saved > 1 ? "s" : ""}) →` : "Concluir →"}
      </button>
    </div>
  );
}
