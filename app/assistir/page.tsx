"use client";

import { useEffect, useRef, useState } from "react";
import { getOrCreateParticipantId } from "@/lib/participant";
import { ACTS } from "@/lib/taxonomy";
import { getActTint } from "@/lib/actColors";
import Nav from "@/app/components/Nav";
import Footer from "@/app/components/Footer";
import OnboardingForm from "@/app/components/OnboardingForm";
import YouTubePlayer, { PlayerHandle } from "./YouTubePlayer";

function parseVideoId(input: string): string | null {
  const s = input.trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  try {
    const u = new URL(s.startsWith("http") ? s : `https://${s}`);
    if (u.hostname === "youtu.be") {
      const id = u.pathname.slice(1, 12);
      return /^[\w-]{11}$/.test(id) ? id : null;
    }
    const v = u.searchParams.get("v");
    if (v && /^[\w-]{11}$/.test(v)) return v;
    const m = u.pathname.match(/\/(?:embed|shorts|live)\/([\w-]{11})/);
    if (m) return m[1];
  } catch {
    /* not a url */
  }
  return null;
}

function fmt(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

type Mark = { ts: number; text: string; act: string };

export default function Assistir() {
  const [pid, setPid] = useState("");
  const [registered, setRegistered] = useState<boolean | null>(null);

  // onboarding local state (mirrors landing page)
  const [f, setF] = useState({ ageBand: "", gender: "", region: "", education: "" });
  const [consent, setConsent] = useState(false);
  const onbReady = consent && f.ageBand && f.gender && f.region && f.education;

  const [urlInput, setUrlInput] = useState("");
  const [videoId, setVideoId] = useState<string | null>(null);
  const [urlError, setUrlError] = useState("");

  const playerRef = useRef<PlayerHandle | null>(null);
  const [marking, setMarking] = useState(false);
  const [markTs, setMarkTs] = useState(0);
  const [draftText, setDraftText] = useState("");
  const [draftAct, setDraftAct] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const [marks, setMarks] = useState<Mark[]>([]);
  const [points, setPoints] = useState(0);

  useEffect(() => {
    const id = getOrCreateParticipantId();
    setPid(id);
    fetch(`/api/me?participant=${id}`)
      .then((r) => r.json())
      .then((d) => {
        setRegistered(!!d.registered);
        setPoints(d.points ?? 0);
      })
      .catch(() => setRegistered(false));
  }, []);

  async function startOnboarding() {
    await fetch("/api/participant", {
      method: "POST",
      body: JSON.stringify({ id: pid, ...f }),
    });
    setRegistered(true);
  }

  function loadVideo() {
    const id = parseVideoId(urlInput);
    if (!id) {
      setUrlError("não reconheci esse link do YouTube");
      return;
    }
    setUrlError("");
    setMarks([]);
    setVideoId(id);
  }

  function openMark() {
    const ts = playerRef.current?.getCurrentTime?.() ?? 0;
    playerRef.current?.pause?.();
    setMarkTs(ts);
    setDraftText("");
    setDraftAct("");
    setSaveError("");
    setMarking(true);
  }

  function cancelMark() {
    setMarking(false);
    playerRef.current?.play?.();
  }

  async function saveMark() {
    if (!videoId || !draftText.trim() || !draftAct || saving) return;
    setSaving(true);
    setSaveError("");
    const res = await fetch("/api/video-annotation", {
      method: "POST",
      body: JSON.stringify({
        participant: pid,
        videoId,
        ts: markTs,
        text: draftText.trim(),
        act: draftAct,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setSaveError(d.error ?? "não consegui salvar");
      return;
    }
    const d = await res.json();
    setMarks((m) => [{ ts: markTs, text: draftText.trim(), act: draftAct }, ...m]);
    setPoints((p) => p + (d.awarded ?? 0));
    setMarking(false);
    playerRef.current?.play?.();
  }

  // ── render ──────────────────────────────────────────────────────────
  if (registered === null) {
    return (
      <>
        <Nav />
        <main className="lp-wide" style={{ padding: "80px 0", minHeight: "60vh" }} />
        <Footer />
      </>
    );
  }

  if (!registered) {
    return (
      <>
        <Nav />
        <main className="lp-wide assistir-onb">
          <p className="label" style={{ marginBottom: 14 }}>ANOTAÇÃO POR VÍDEO</p>
          <h1 className="display assistir-title">
            Assista, ouça o tom, marque a <mark className="hero-mark">intenção</mark>.
          </h1>
          <p className="assistir-sub">
            Cole um vídeo do YouTube, e cada vez que alguém falar com uma intenção clara
            (um pedido, uma promessa, uma crítica), você marca. Antes, conta um pouco sobre você —
            é anônimo e ajuda a estudar como perfis diferentes percebem a fala.
          </p>
          <div style={{ maxWidth: 460 }}>
            <OnboardingForm
              f={f}
              setF={setF}
              consent={consent}
              setConsent={setConsent}
              ready={!!onbReady}
              onStart={startOnboarding}
            />
          </div>
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Nav />
      <main className="lp-wide assistir-main">
        <div className="assistir-head">
          <div>
            <p className="label" style={{ marginBottom: 8 }}>ANOTAÇÃO POR VÍDEO</p>
            <h1 className="display assistir-title">Marque a intenção enquanto assiste</h1>
          </div>
          <span className="assistir-points">{points} pts</span>
        </div>

        <p className="assistir-sub">
          Cole qualquer vídeo do YouTube (entrevista, debate). Dê play, e quando ouvir uma
          fala com intenção clara, clique em <strong>marcar fala</strong>: escreva o que foi dito
          e escolha o ato de fala. O texto que você escreve vira dado real de treino.
        </p>

        <div className="assistir-urlrow">
          <input
            className="live-demo-input"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && loadVideo()}
            placeholder="cole o link do YouTube…"
            aria-label="Link do YouTube"
          />
          <button className="btn-ink" style={{ height: 48, padding: "0 22px", flexShrink: 0 }} onClick={loadVideo}>
            carregar
          </button>
        </div>
        {urlError && <p className="live-demo-notice live-demo-notice-error">{urlError}</p>}

        {videoId && (
          <div className="assistir-stage">
            <div className="assistir-video">
              <YouTubePlayer videoId={videoId} onReady={(h) => (playerRef.current = h)} />
              <button className="btn-ink assistir-mark-btn" onClick={openMark}>
                ✋ marcar fala
              </button>
            </div>

            <aside className="assistir-marks">
              <p className="label" style={{ marginBottom: 12 }}>
                falas marcadas ({marks.length})
              </p>
              {marks.length === 0 && (
                <p className="assistir-empty">
                  nada ainda — dê play e marque a primeira fala com intenção.
                </p>
              )}
              <ul className="assistir-mark-list">
                {marks.map((m, i) => {
                  const tint = getActTint(m.act);
                  return (
                    <li key={i} className="assistir-mark-item">
                      <button
                        className="assistir-mark-ts"
                        onClick={() => {
                          playerRef.current?.seekTo?.(m.ts);
                          playerRef.current?.play?.();
                        }}
                        title="reassistir esse trecho"
                      >
                        {fmt(m.ts)}
                      </button>
                      <span className="assistir-mark-text">{m.text}</span>
                      <span
                        className="live-demo-pill"
                        style={{ background: tint.bg, color: tint.text, borderColor: tint.border }}
                      >
                        {m.act}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </aside>
          </div>
        )}
      </main>

      {/* Mark modal */}
      {marking && (
        <div className="assistir-modal-overlay" onClick={cancelMark}>
          <div className="assistir-modal" onClick={(e) => e.stopPropagation()}>
            <p className="label" style={{ marginBottom: 4 }}>
              fala em {fmt(markTs)}
            </p>
            <textarea
              className="assistir-textarea"
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
              maxLength={300}
              autoFocus
              placeholder="escreva o que a pessoa disse…"
            />
            <p className="field-label" style={{ margin: "4px 0 8px" }}>qual o ato de fala?</p>
            <div className="assistir-act-grid">
              {ACTS.map((a) => {
                const tint = getActTint(a);
                const on = draftAct === a;
                return (
                  <button
                    key={a}
                    className="assistir-act-chip"
                    onClick={() => setDraftAct(a)}
                    style={{
                      background: on ? tint.text : tint.bg,
                      color: on ? "#fff" : tint.text,
                      borderColor: tint.border,
                    }}
                  >
                    {a}
                  </button>
                );
              })}
            </div>
            {saveError && <p className="live-demo-notice live-demo-notice-error">{saveError}</p>}
            <div className="assistir-modal-actions">
              <button className="btn-outline" style={{ height: 40 }} onClick={cancelMark}>
                cancelar
              </button>
              <button
                className="btn-ink"
                style={{ height: 40 }}
                onClick={saveMark}
                disabled={!draftText.trim() || !draftAct || saving}
              >
                {saving ? "salvando…" : "salvar (+15)"}
              </button>
            </div>
          </div>
        </div>
      )}
      <Footer />
    </>
  );
}
