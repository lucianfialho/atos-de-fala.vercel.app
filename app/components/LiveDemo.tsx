"use client";

import { useState } from "react";
import { getActTint } from "@/lib/actColors";
import { Arrow } from "@/app/components/marks";

type Segment = { text: string; act: string | null };

const DEFAULT_INPUT = "Bom dia! Você pode me revisar o relatório? Obrigado.";

const STATIC_SEGMENTS: Segment[] = [
  { text: "Bom dia!", act: "saudar" },
  { text: " ", act: null },
  { text: "Você pode me revisar o relatório?", act: "pedir" },
  { text: " ", act: null },
  { text: "Obrigado.", act: "agradecer" },
];

// ---------------------------------------------------------------------------
// Model singleton — loaded on demand, once per browser session
// ---------------------------------------------------------------------------

// Each token returned by Transformers.js token-classification
type RawToken = {
  entity: string;
  word: string;
  start: number;
  end: number;
  score: number;
  index: number;
};

let _pipe: Promise<(text: string) => Promise<RawToken[]>> | null = null;

async function getPipe(
  onProgress: (p: number) => void
): Promise<(text: string) => Promise<RawToken[]>> {
  if (_pipe) return _pipe;

  _pipe = (async () => {
    const { pipeline, env } = await import("@huggingface/transformers");

    // Disable local model cache in browser (use HF CDN directly)
    env.allowLocalModels = false;

    const opts = (device: "webgpu" | "wasm") => ({
      dtype: "q8" as const,
      device,
      progress_callback: (e: unknown) => {
        const ev = e as { progress?: number } | null;
        if (ev?.progress != null) onProgress(Math.round(ev.progress));
      },
    });

    try {
      return (await pipeline(
        "token-classification",
        "lucianfialho/atos-de-fala-ptbr",
        opts("webgpu")
      )) as unknown as (text: string) => Promise<RawToken[]>;
    } catch {
      return (await pipeline(
        "token-classification",
        "lucianfialho/atos-de-fala-ptbr",
        opts("wasm")
      )) as unknown as (text: string) => Promise<RawToken[]>;
    }
  })();

  return _pipe;
}

// ---------------------------------------------------------------------------
// Token → Segment decoder
// ---------------------------------------------------------------------------

function decodeSegments(raw: RawToken[], text: string): Segment[] {
  // Collect non-O spans, merging adjacent tokens that share the same act
  const spans: { start: number; end: number; act: string }[] = [];

  for (const tok of raw) {
    if (!tok.entity || tok.entity === "O") continue;
    // Entity tags are BIOES-style: "B-pedir", "I-pedir", "E-pedir", "S-pedir"
    const parts = tok.entity.split("-");
    const act = parts.length > 1 ? parts.slice(1).join("-") : parts[0];

    const last = spans[spans.length - 1];
    if (last && last.act === act && tok.start <= last.end + 1) {
      // extend the previous span
      last.end = tok.end;
    } else {
      spans.push({ start: tok.start, end: tok.end, act });
    }
  }

  // Build display segments covering the full text
  const segments: Segment[] = [];
  let cursor = 0;

  for (const span of spans.sort((a, b) => a.start - b.start)) {
    if (span.start > cursor) {
      segments.push({ text: text.slice(cursor, span.start), act: null });
    }
    segments.push({ text: text.slice(span.start, span.end), act: span.act });
    cursor = span.end;
  }
  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), act: null });
  }

  return segments.filter((s) => s.text.length > 0);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type InferStatus = "idle" | "loading-model" | "running" | "done";

export default function LiveDemo() {
  const [inputText, setInputText] = useState(DEFAULT_INPUT);
  const [segments, setSegments] = useState<Segment[]>(STATIC_SEGMENTS);
  const [status, setStatus] = useState<InferStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [usedFallback, setUsedFallback] = useState(false);
  const [rawOutput, setRawOutput] = useState<unknown>(null);

  const loading = status === "loading-model" || status === "running";
  const hasPedir = segments.some((s) => s.act === "pedir");

  // -------------------------------------------------------------------------
  // Server-side fallback (Hugging Face Space proxy via /api/demo)
  // -------------------------------------------------------------------------
  async function annotateFallback(text: string): Promise<void> {
    const res = await fetch("/api/demo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (res.status === 503) {
      setError("coldstart");
      return;
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "não consegui anotar agora");
      return;
    }
    const data = await res.json();
    if (data.segments && Array.isArray(data.segments)) {
      setSegments(data.segments as Segment[]);
      setRawOutput(data);
      setUsedFallback(true);
      setError(null);
    }
  }

  // -------------------------------------------------------------------------
  // Main annotate — tries in-browser first, falls back to server
  // -------------------------------------------------------------------------
  async function annotate() {
    if (!inputText.trim() || loading) return;
    setError(null);
    setUsedFallback(false);
    setRawOutput(null);
    setProgress(0);
    setStatus("loading-model");

    try {
      const pipe = await getPipe((p) => {
        setProgress(p);
      });

      setStatus("running");
      const raw = await pipe(inputText);
      const segs = decodeSegments(raw, inputText);
      setSegments(segs.length > 0 ? segs : [{ text: inputText, act: null }]);
      setRawOutput(raw);
      setStatus("done");
    } catch (err) {
      // Transformers.js failed entirely — fall back to server proxy
      console.warn("[LiveDemo] in-browser inference failed, falling back to server:", err);
      _pipe = null; // reset so next attempt re-tries
      setStatus("running");
      try {
        await annotateFallback(inputText);
      } catch {
        setError("não consegui anotar agora");
      }
      setStatus("done");
    }
  }

  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") annotate();
  }

  // -------------------------------------------------------------------------
  // Button label
  // -------------------------------------------------------------------------
  let btnLabel = "anotar";
  if (status === "loading-model") {
    btnLabel = progress > 0 ? `baixando… ${progress}%` : "baixando o modelo…";
  } else if (status === "running") {
    btnLabel = "anotando…";
  }

  return (
    <figure className="demo-card" aria-label="Demo interativo: anote sua frase com o modelo">
      <figcaption className="demo-card-head">
        <span className="demo-card-dot" aria-hidden="true" />
        <span className="demo-card-filename">o nosso modelo anotou:</span>
      </figcaption>

      {/* Input on its own line, chat-style; action row below */}
      <div className="live-demo-input-row">
        <input
          className="live-demo-input"
          type="text"
          maxLength={200}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Escreva uma frase e veja os atos de fala…"
          aria-label="Frase para anotar"
          disabled={loading}
        />
        <div className="live-demo-actions">
          <span className="live-demo-hint">roda no seu navegador — nada vai pro servidor</span>
          <button
            className="btn-ink live-demo-btn"
            onClick={annotate}
            disabled={loading || !inputText.trim()}
            aria-busy={loading}
          >
            {btnLabel}
          </button>
        </div>
      </div>

      {/* Loading progress bar when downloading model */}
      {status === "loading-model" && progress > 0 && (
        <div
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Progresso do download do modelo"
          style={{
            height: 3,
            background: "#f0e9d8",
            borderRadius: 2,
            marginTop: 6,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${progress}%`,
              background: "var(--ink, #1a1a1a)",
              borderRadius: 2,
              transition: "width 0.2s ease",
            }}
          />
        </div>
      )}

      {/* Error / cold-start notice */}
      {error === "coldstart" && (
        <p className="live-demo-notice" role="status">
          o modelo está acordando, tenta de novo em alguns segundos
        </p>
      )}
      {error && error !== "coldstart" && (
        <p className="live-demo-notice live-demo-notice-error" role="alert">
          {error}
        </p>
      )}

      {/* Fallback notice */}
      {usedFallback && !error && (
        <p className="live-demo-notice" role="status" style={{ fontSize: 12, opacity: 0.6 }}>
          rodou no servidor (WebGPU/wasm indisponível neste navegador)
        </p>
      )}

      {/* Annotated sentence — reads as one natural sentence, acts shown as
          colored underlines so the reading flow isn't chopped up */}
      <p className="live-demo-sentence">
        {segments.map((seg, i) => {
          if (!seg.act) {
            return <span key={i}>{seg.text}</span>;
          }
          const tint = getActTint(seg.act);
          return (
            <span
              key={i}
              className="live-demo-mark"
              style={{ ["--act-line" as string]: tint.text }}
            >
              {seg.text}
            </span>
          );
        })}
      </p>

      {/* Legend — each annotated trecho mapped to its act, tied by color */}
      <ul className="live-demo-legend">
        {segments
          .filter((s) => s.act)
          .map((seg, i) => {
            const tint = getActTint(seg.act as string);
            return (
              <li key={i} className="live-demo-legend-item">
                <span
                  className="live-demo-pill"
                  style={{ background: tint.bg, color: tint.text, borderColor: tint.border }}
                >
                  {seg.act}
                </span>
                <span
                  className="live-demo-legend-text"
                  style={{ ["--act-line" as string]: tint.text }}
                >
                  {seg.text}
                </span>
              </li>
            );
          })}
      </ul>

      {/* Raw model response — collapsible, so people can inspect the output */}
      {rawOutput != null && (
        <details className="live-demo-raw">
          <summary className="live-demo-raw-summary">
            ver resposta crua (JSON{usedFallback ? "" : " — saída do modelo no navegador"})
          </summary>
          <pre className="live-demo-raw-pre">
            <code>{JSON.stringify(rawOutput, null, 2)}</code>
          </pre>
        </details>
      )}

      {/* Hand-drawn arrow + note — shown when a "pedir" segment is present */}
      {hasPedir && (
        <div className="demo-arrow" aria-hidden="true">
          <Arrow width={64} height={50} />
          <span className="demo-arrow-note">pedido, não pergunta!</span>
        </div>
      )}
    </figure>
  );
}
