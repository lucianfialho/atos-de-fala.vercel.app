"use client";

import { useEffect, useState } from "react";
import { getOrCreateParticipantId } from "@/lib/participant";
import { getPipe, annotateChunked } from "@/lib/inference";
import Nav from "@/app/components/Nav";
import Footer from "@/app/components/Footer";
import OnboardingForm from "@/app/components/OnboardingForm";
import TurnCard, { SpanState } from "./TurnCard";

type Turn = { speaker: string; text: string };
type Interview = { title: string; turns: Turn[]; sourceRef: string };

// Curated by act-focus: the model is weakest on discordar/sugerir/expressar_emocao/pedir
// (measured) + blind on the social acts. Each interview is picked to be rich in those.
const CATALOG: { name: string; url: string; youtubeId?: string; focus: string }[] = [
  { name: "Mano Brown (2007)", url: "https://rodaviva.fapesp.br/materia/470/entrevistados/mano_brown_2007.htm", youtubeId: "IaQWmNkqkSg", focus: "discordar · expressar_emocao · pedir" },
  { name: "Elza Soares (2002)", url: "https://rodaviva.fapesp.br/materia/74/entrevistados/elza_soares_2002.htm", youtubeId: "8ko447IATMk", focus: "expressar_emocao" },
  { name: "Mário Soares (1993)", url: "https://rodaviva.fapesp.br/materia/798/entrevistados/mario_soares_1993.htm", focus: "discordar · prometer" },
  { name: "Fidel Castro (1990)", url: "https://rodaviva.fapesp.br/materia/1/entrevistados/fidel_castro_1990.htm", youtubeId: "znY9e1AFCvc", focus: "discordar · prometer" },
  { name: "Pierre Lévy (2001)", url: "https://rodaviva.fapesp.br/materia/47/entrevistados/pierre_levy_2001.htm", youtubeId: "DzfKr2nUj8k", focus: "informar · sugerir" },
];

const SOURCE = "rodaviva";

export default function Assistir() {
  const [pid, setPid] = useState("");
  const [registered, setRegistered] = useState<boolean | null>(null);
  const [points, setPoints] = useState(0);

  const [f, setF] = useState({ ageBand: "", gender: "", region: "", education: "" });
  const [consent, setConsent] = useState(false);
  const onbReady = consent && f.ageBand && f.gender && f.region && f.education;

  const [urlInput, setUrlInput] = useState("");
  const [interview, setInterview] = useState<Interview | null>(null);
  const [videoId, setVideoId] = useState<string | null>(null);
  const [loadErr, setLoadErr] = useState("");
  const [loadingIv, setLoadingIv] = useState(false);

  const [spansByTurn, setSpansByTurn] = useState<Record<number, SpanState[]>>({});
  const [analyzingIdx, setAnalyzingIdx] = useState(-1);
  const [modelStatus, setModelStatus] = useState<"idle" | "loading" | "annotating" | "done">("idle");
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const id = getOrCreateParticipantId();
    setPid(id);
    fetch(`/api/me?participant=${id}`)
      .then((r) => r.json())
      .then((d) => { setRegistered(!!d.registered); setPoints(d.points ?? 0); })
      .catch(() => setRegistered(false));
  }, []);

  async function startOnboarding() {
    await fetch("/api/participant", { method: "POST", body: JSON.stringify({ id: pid, ...f }) });
    setRegistered(true);
  }

  async function loadInterview(url: string, youtubeId?: string) {
    setLoadErr("");
    setLoadingIv(true);
    setInterview(null);
    setVideoId(youtubeId ?? null);
    setSpansByTurn({});
    setModelStatus("idle");
    try {
      const r = await fetch(`/api/interview?url=${encodeURIComponent(url)}`).then((x) => x.json());
      if (r.error) { setLoadErr(r.error); return; }
      setInterview(r as Interview);
    } catch {
      setLoadErr("não consegui carregar a entrevista");
    } finally {
      setLoadingIv(false);
    }
  }

  async function annotateAll() {
    if (!interview || modelStatus === "loading" || modelStatus === "annotating") return;
    setModelStatus("loading");
    setProgress(0);
    try {
      const pipe = await getPipe((p) => setProgress(p));
      setModelStatus("annotating");
      for (let i = 0; i < interview.turns.length; i++) {
        setAnalyzingIdx(i);
        try {
          const spans = await annotateChunked(pipe, interview.turns[i].text);
          const states: SpanState[] = spans.map((s) => ({ ...s, modelAct: s.act, status: "pending" }));
          setSpansByTurn((prev) => ({ ...prev, [i]: states }));
        } catch {
          setSpansByTurn((prev) => ({ ...prev, [i]: [] }));
        }
      }
    } catch {
      setLoadErr("não consegui carregar o modelo neste navegador");
    } finally {
      setAnalyzingIdx(-1);
      setModelStatus("done");
    }
  }

  async function save(turnIdx: number, span: SpanState, verdict: "confirmed" | "corrected" | "added", act: string) {
    if (!interview) return;
    const turn = interview.turns[turnIdx];
    const res = await fetch("/api/annotation", {
      method: "POST",
      body: JSON.stringify({
        participant: pid,
        source: SOURCE,
        sourceRef: interview.sourceRef,
        speaker: turn.speaker,
        context: turn.text,
        text: turn.text.slice(span.start, span.end),
        charStart: span.start,
        charEnd: span.end,
        act,
        modelAct: span.modelAct,
        verdict,
      }),
    });
    if (res.ok) {
      const d = await res.json();
      setPoints((p) => p + (d.awarded ?? 0));
    }
  }

  function update(turnIdx: number, spanIdx: number, patch: Partial<SpanState>) {
    setSpansByTurn((prev) => {
      const arr = [...(prev[turnIdx] ?? [])];
      arr[spanIdx] = { ...arr[spanIdx], ...patch };
      return { ...prev, [turnIdx]: arr };
    });
  }

  function handleConfirm(turnIdx: number, spanIdx: number) {
    const span = spansByTurn[turnIdx]?.[spanIdx];
    if (!span) return;
    update(turnIdx, spanIdx, { status: "confirmed" });
    save(turnIdx, span, "confirmed", span.act);
  }
  function handleCorrect(turnIdx: number, spanIdx: number, act: string) {
    const span = spansByTurn[turnIdx]?.[spanIdx];
    if (!span) return;
    update(turnIdx, spanIdx, { act, status: "corrected" });
    save(turnIdx, span, "corrected", act);
  }
  function handleRemove(turnIdx: number, spanIdx: number) {
    update(turnIdx, spanIdx, { status: "removed" });
  }
  function handleAdd(turnIdx: number, start: number, end: number, act: string) {
    const span: SpanState = { start, end, act, modelAct: null, status: "added" };
    setSpansByTurn((prev) => ({ ...prev, [turnIdx]: [...(prev[turnIdx] ?? []), span] }));
    save(turnIdx, span, "added", act);
  }

  // ── render ──
  if (registered === null) {
    return (<><Nav /><main className="lp-wide" style={{ padding: "80px 0", minHeight: "60vh" }} /><Footer /></>);
  }

  if (!registered) {
    return (
      <>
        <Nav />
        <main className="lp-wide assistir-onb">
          <p className="label" style={{ marginBottom: 14 }}>ANOTAÇÃO POR TRANSCRIÇÃO</p>
          <h1 className="display assistir-title">
            O modelo lê a entrevista, você <mark className="hero-mark">corrige</mark>.
          </h1>
          <p className="assistir-sub">
            A gente mostra a transcrição de uma entrevista real, o modelo marca os atos de fala,
            e você conserta o que ele errou. Antes, conta um pouco sobre você — é anônimo e ajuda
            a estudar como perfis diferentes percebem a fala.
          </p>
          <div style={{ maxWidth: 460 }}>
            <OnboardingForm f={f} setF={setF} consent={consent} setConsent={setConsent} ready={!!onbReady} onStart={startOnboarding} />
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
            <p className="label" style={{ marginBottom: 8 }}>ANOTAÇÃO POR TRANSCRIÇÃO</p>
            <h1 className="display assistir-title">O modelo marca, você corrige</h1>
          </div>
          <span className="assistir-points">{points} pts</span>
        </div>

        <p className="assistir-sub">
          Escolha uma entrevista, o modelo anota os atos de fala em cada turno, e você confirma,
          troca ou remove. Sua correção é o que vira dado de treino. <strong>Foque em corrigir
          os atos que o modelo mais erra:</strong> discordar, sugerir, expressar_emocao, pedir
          (e qualquer oferta, promessa, desculpa ou despedida).
        </p>

        <div className="assistir-catalog">
          {CATALOG.map((c) => (
            <button key={c.url} className="btn-outline assistir-cat-btn" onClick={() => loadInterview(c.url, c.youtubeId)}>
              <span className="assistir-cat-name">{c.name}{c.youtubeId ? " 🎬" : ""}</span>
              <span className="assistir-cat-focus">{c.focus}</span>
            </button>
          ))}
        </div>
        <div className="assistir-urlrow">
          <input
            className="live-demo-input"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && urlInput.trim() && loadInterview(urlInput.trim())}
            placeholder="ou cole um link de entrevista do rodaviva.fapesp.br…"
            aria-label="Link da entrevista"
          />
          <button
            className="btn-ink"
            style={{ height: 48, padding: "0 22px", flexShrink: 0 }}
            onClick={() => urlInput.trim() && loadInterview(urlInput.trim())}
          >
            carregar
          </button>
        </div>
        {loadingIv && <p className="live-demo-notice">carregando entrevista…</p>}
        {loadErr && <p className="live-demo-notice live-demo-notice-error">{loadErr}</p>}

        {interview && (
          <>
            <div className="assistir-iv-head">
              <span className="assistir-iv-meta">{interview.turns.length} turnos</span>
              {modelStatus === "idle" && (
                <button className="btn-ink" style={{ height: 40 }} onClick={annotateAll}>
                  ▶ o modelo anota
                </button>
              )}
              {modelStatus === "loading" && (
                <span className="assistir-iv-meta">baixando o modelo… {progress > 0 ? `${progress}%` : ""}</span>
              )}
              {modelStatus === "annotating" && (
                <span className="assistir-iv-meta">anotando {analyzingIdx + 1}/{interview.turns.length}…</span>
              )}
              {modelStatus === "done" && <span className="assistir-iv-meta">✓ anotado — corrija à vontade</span>}
            </div>

            <div className={videoId ? "assistir-watch" : ""}>
              {videoId && (
                <div className="assistir-video-col">
                  <div className="yt-embed">
                    <iframe
                      src={`https://www.youtube.com/embed/${videoId}`}
                      title="Vídeo da entrevista"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                  <p className="assistir-video-note">o vídeo é só pra você ouvir o tom — a anotação é no texto ao lado</p>
                </div>
              )}
              <div className="assistir-transcript">
                {interview.turns.map((t, i) => (
                  <TurnCard
                    key={i}
                    speaker={t.speaker}
                    text={t.text}
                    spans={spansByTurn[i]}
                    analyzing={analyzingIdx === i}
                    onConfirm={(s) => handleConfirm(i, s)}
                    onCorrect={(s, a) => handleCorrect(i, s, a)}
                    onRemove={(s) => handleRemove(i, s)}
                    onAdd={(s, e, a) => handleAdd(i, s, e, a)}
                  />
                ))}
              </div>
            </div>
          </>
        )}
      </main>
      <Footer />
    </>
  );
}
