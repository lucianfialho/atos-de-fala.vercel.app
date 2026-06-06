// In-browser token-classification (Transformers.js / WebGPU, wasm fallback).
// Same model as the live demo; shared so /assistir can pre-annotate transcript turns.
//
// NOTE: this pipeline returns tokens with { entity, score, index, word } and NO char
// offsets, so we reconstruct char spans by walking the original text (handling WordPiece
// "##" continuations). Reading tok.start/tok.end directly yields garbage.

export type Span = { start: number; end: number; act: string };

type RawToken = { entity: string; word: string; index: number; score: number };

const MODEL = "lucianfialho/atos-de-fala-ptbr";

let _pipe: Promise<(text: string) => Promise<RawToken[]>> | null = null;

export function modelReady(): boolean {
  return _pipe !== null;
}

export async function getPipe(
  onProgress?: (p: number) => void
): Promise<(text: string) => Promise<RawToken[]>> {
  if (_pipe) return _pipe;

  _pipe = (async () => {
    const { pipeline, env } = await import("@huggingface/transformers");
    env.allowLocalModels = false;

    const opts = (device: "webgpu" | "wasm") => ({
      dtype: "q8" as const,
      device,
      progress_callback: (e: unknown) => {
        const ev = e as { progress?: number } | null;
        if (ev?.progress != null) onProgress?.(Math.round(ev.progress));
      },
    });

    try {
      return (await pipeline("token-classification", MODEL, opts("webgpu"))) as unknown as (
        text: string
      ) => Promise<RawToken[]>;
    } catch {
      return (await pipeline("token-classification", MODEL, opts("wasm"))) as unknown as (
        text: string
      ) => Promise<RawToken[]>;
    }
  })();

  // Don't cache a rejected promise — allow a later retry to rebuild the pipeline.
  _pipe.catch(() => {
    _pipe = null;
  });

  return _pipe;
}

// Reconstruct character spans from BIOES word-tokens by walking `text`.
export function tokensToSpans(tokens: RawToken[], text: string): Span[] {
  let cursor = 0;
  const spans: Span[] = [];
  for (const tok of tokens) {
    if (!tok.entity || tok.entity === "O") continue;
    const w = String(tok.word).replace(/^##/, "");
    if (!w) continue;
    const idx = text.indexOf(w, cursor);
    if (idx < 0) continue; // [UNK] or mismatch — skip rather than corrupt offsets
    const start = idx;
    const end = idx + w.length;
    cursor = end;
    const act = tok.entity.includes("-") ? tok.entity.split("-").slice(1).join("-") : tok.entity;
    const last = spans[spans.length - 1];
    if (last && last.act === act && start <= last.end + 1) {
      last.end = end;
    } else {
      spans.push({ start, end, act });
    }
  }
  return spans;
}

// Build display segments covering the full text (act = null for plain stretches).
export function spansToSegments(spans: Span[], text: string): { text: string; act: string | null }[] {
  const segments: { text: string; act: string | null }[] = [];
  let cursor = 0;
  for (const s of [...spans].sort((a, b) => a.start - b.start)) {
    if (s.start > cursor) segments.push({ text: text.slice(cursor, s.start), act: null });
    segments.push({ text: text.slice(s.start, s.end), act: s.act });
    cursor = s.end;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor), act: null });
  return segments.filter((seg) => seg.text.length > 0);
}

// Run the model on one text and return character spans.
export async function annotate(text: string, onProgress?: (p: number) => void): Promise<Span[]> {
  const pipe = await getPipe(onProgress);
  const raw = await pipe(text);
  return tokensToSpans(raw, text);
}
