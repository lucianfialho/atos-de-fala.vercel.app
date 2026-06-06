"use client";

import { useState } from "react";
import { ACTS } from "@/lib/taxonomy";
import { getActTint } from "@/lib/actColors";
import type { Span } from "@/lib/inference";

export type SpanState = Span & {
  modelAct: string | null; // what the model proposed (null = human-added)
  status: "pending" | "confirmed" | "corrected" | "removed" | "added";
};

type Segment = { text: string; span: SpanState | null; index: number };

// Build display segments (plain stretches + spans) covering the full turn text.
function segmentize(text: string, spans: SpanState[]): Segment[] {
  const live = spans
    .filter((s) => s.status !== "removed")
    .sort((a, b) => a.start - b.start);
  const out: Segment[] = [];
  let cursor = 0;
  live.forEach((s) => {
    if (s.start > cursor) out.push({ text: text.slice(cursor, s.start), span: null, index: -1 });
    out.push({ text: text.slice(s.start, s.end), span: s, index: spans.indexOf(s) });
    cursor = Math.max(cursor, s.end);
  });
  if (cursor < text.length) out.push({ text: text.slice(cursor), span: null, index: -1 });
  return out;
}

export default function TurnCard({
  speaker,
  text,
  spans,
  analyzing,
  onConfirm,
  onCorrect,
  onRemove,
  onAdd,
}: {
  speaker: string;
  text: string;
  spans: SpanState[] | undefined;
  analyzing: boolean;
  onConfirm: (i: number) => void;
  onCorrect: (i: number, act: string) => void;
  onRemove: (i: number) => void;
  onAdd: (start: number, end: number, act: string) => void;
}) {
  const [openSpan, setOpenSpan] = useState<number | null>(null);
  const [changing, setChanging] = useState<number | null>(null);
  const [sel, setSel] = useState<{ start: number; end: number } | null>(null);

  // Compute char offset of a DOM position within the text container.
  function offsetIn(root: HTMLElement, node: Node, offset: number): number {
    let acc = 0;
    const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let n: Node | null;
    while ((n = walk.nextNode())) {
      if (n === node) return acc + offset;
      acc += (n.textContent ?? "").length;
    }
    return acc;
  }

  function onMouseUp(e: React.MouseEvent<HTMLDivElement>) {
    const s = window.getSelection();
    if (!s || s.isCollapsed || s.rangeCount === 0) {
      setSel(null);
      return;
    }
    const root = e.currentTarget;
    const range = s.getRangeAt(0);
    if (!root.contains(range.commonAncestorContainer)) return;
    let start = offsetIn(root, range.startContainer, range.startOffset);
    let end = offsetIn(root, range.endContainer, range.endOffset);
    if (start > end) [start, end] = [end, start];
    if (end - start < 1) {
      setSel(null);
      return;
    }
    setOpenSpan(null);
    setChanging(null);
    setSel({ start, end });
  }

  const segs = spans ? segmentize(text, spans) : null;

  return (
    <div className="turn-card">
      <span className="turn-speaker">{speaker}</span>
      <div className="turn-body" onMouseUp={onMouseUp}>
        {!segs && (
          <span className="turn-plain">
            {text}
            {analyzing && <span className="turn-analyzing"> · anotando…</span>}
          </span>
        )}
        {segs &&
          segs.map((seg, i) => {
            if (!seg.span) return <span key={i} className="turn-plain">{seg.text}</span>;
            const tint = getActTint(seg.span.act);
            const st = seg.span.status;
            return (
              <span key={i} className="turn-span-wrap">
                <span
                  className={`turn-span turn-span-${st}`}
                  style={{ background: tint.bg, ["--act-line" as string]: tint.text }}
                  onClick={() => {
                    setOpenSpan(openSpan === seg.index ? null : seg.index);
                    setChanging(null);
                    setSel(null);
                  }}
                >
                  {seg.text}
                  <span className="turn-span-pill" style={{ color: tint.text }}>
                    {st === "confirmed" ? "✓ " : ""}{seg.span.act}
                  </span>
                </span>

                {openSpan === seg.index && (
                  <span className="turn-menu">
                    {changing === seg.index ? (
                      <span className="turn-act-grid">
                        {ACTS.map((a) => {
                          const t = getActTint(a);
                          return (
                            <button
                              key={a}
                              className="turn-act-chip"
                              style={{ background: t.bg, color: t.text, borderColor: t.border }}
                              onClick={() => {
                                onCorrect(seg.index, a);
                                setOpenSpan(null);
                                setChanging(null);
                              }}
                            >
                              {a}
                            </button>
                          );
                        })}
                      </span>
                    ) : (
                      <>
                        <button className="turn-menu-btn ok" onClick={() => { onConfirm(seg.index); setOpenSpan(null); }}>
                          ✓ certo
                        </button>
                        <button className="turn-menu-btn" onClick={() => setChanging(seg.index)}>
                          trocar ato
                        </button>
                        <button className="turn-menu-btn rm" onClick={() => { onRemove(seg.index); setOpenSpan(null); }}>
                          ✕ não é ato
                        </button>
                      </>
                    )}
                  </span>
                )}
              </span>
            );
          })}
      </div>

      {/* Add a missed span from a text selection */}
      {sel && (
        <div className="turn-addbar">
          <span className="turn-addbar-label">
            marcar “{text.slice(sel.start, sel.end).slice(0, 40)}” como:
          </span>
          <span className="turn-act-grid">
            {ACTS.map((a) => {
              const t = getActTint(a);
              return (
                <button
                  key={a}
                  className="turn-act-chip"
                  style={{ background: t.bg, color: t.text, borderColor: t.border }}
                  onClick={() => {
                    onAdd(sel.start, sel.end, a);
                    setSel(null);
                  }}
                >
                  {a}
                </button>
              );
            })}
          </span>
          <button className="turn-menu-btn" onClick={() => setSel(null)}>cancelar</button>
        </div>
      )}
    </div>
  );
}
