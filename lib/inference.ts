// In-browser token-classification (Transformers.js / WebGPU, wasm fallback).
// Same model as the live demo; shared so /assistir can pre-annotate transcript turns.
//
// NOTE: this pipeline returns tokens with { entity, score, index, word } and NO char
// offsets, so we reconstruct char spans by walking the original text (handling WordPiece
// "##" continuations). Reading tok.start/tok.end directly yields garbage.

export type Span = { start: number; end: number; act: string };

type RawToken = { entity: string; word: string; index: number; score: number };

const MODEL = "lucianfialho/atos-de-fala-ptbr";
// Pin a tagged revision so returning visitors don't keep a stale cached model.
// Bump this (and create the matching HF tag) whenever a new model is published.
const MODEL_REVISION = "v2";

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
      revision: MODEL_REVISION,
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

// BERTimbau caps at 512 positions. Keep chunks well under that (chars ≈ a few per token),
// preferring sentence/space boundaries, so long transcript turns don't overflow the model.
const MAX_CHARS = 600;

function splitChunks(text: string): { text: string; offset: number }[] {
  if (text.length <= MAX_CHARS) return [{ text, offset: 0 }];
  const chunks: { text: string; offset: number }[] = [];
  let i = 0;
  while (i < text.length) {
    let end = Math.min(i + MAX_CHARS, text.length);
    if (end < text.length) {
      const slice = text.slice(i, end);
      const dot = slice.lastIndexOf(". ");
      const sp = slice.lastIndexOf(" ");
      const cut = dot > 50 ? dot + 1 : sp > 50 ? sp : slice.length;
      end = i + cut;
    }
    chunks.push({ text: text.slice(i, end), offset: i });
    i = end;
  }
  return chunks;
}

function mergeAdjacent(spans: Span[]): Span[] {
  const sorted = [...spans].sort((a, b) => a.start - b.start);
  const out: Span[] = [];
  for (const s of sorted) {
    const last = out[out.length - 1];
    if (last && last.act === s.act && s.start <= last.end + 1) last.end = Math.max(last.end, s.end);
    else out.push({ ...s });
  }
  return out;
}

// Annotate arbitrarily long text by chunking under the model's token limit.
export async function annotateChunked(
  pipe: (text: string) => Promise<RawToken[]>,
  text: string
): Promise<Span[]> {
  const all: Span[] = [];
  for (const chunk of splitChunks(text)) {
    if (!chunk.text.trim()) continue;
    const raw = await pipe(chunk.text);
    for (const s of tokensToSpans(raw, chunk.text)) {
      all.push({ start: s.start + chunk.offset, end: s.end + chunk.offset, act: s.act });
    }
  }
  return mergeAdjacent(all);
}

// Run the model on one text and return character spans.
export async function annotate(text: string, onProgress?: (p: number) => void): Promise<Span[]> {
  const pipe = await getPipe(onProgress);
  return annotateChunked(pipe, text);
}
