"use client";

// Cookie/analytics consent banner (Tier C1). Consent Mode v2 defaults to denied (in layout,
// before GTM); this only flips analytics_storage to granted on accept. Reject is symmetric and
// persisted so we don't re-ask. This is the gate for every C1 analytics event (docs/datalayer.md §6).

import { useEffect, useState } from "react";
import { setAnalyticsConsent, getStoredConsent } from "@/lib/dataLayer";

export default function ConsentBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (getStoredConsent() === null) setShow(true);
  }, []);

  if (!show) return null;

  function choose(granted: boolean) {
    setAnalyticsConsent(granted);
    setShow(false);
  }

  return (
    <div
      role="dialog"
      aria-label="Consentimento de cookies"
      style={{
        position: "fixed", left: 16, right: 16, bottom: 16, zIndex: 1000, maxWidth: 680,
        margin: "0 auto", background: "var(--ink)", color: "var(--canvas)", borderRadius: 14,
        padding: "16px 18px", display: "flex", flexWrap: "wrap", alignItems: "center",
        gap: 12, boxShadow: "0 8px 30px rgba(0,0,0,.25)",
      }}
    >
      <p style={{ flex: "1 1 280px", margin: 0, fontSize: 13.5, lineHeight: 1.5 }}>
        Usamos cookies de <strong>analytics</strong> pra entender como o site é usado e melhorar a
        coleta. Sem isso, nada de medição com cookie.{" "}
        <a href="/termo" style={{ color: "var(--canvas)", textDecoration: "underline", textUnderlineOffset: 2 }}>
          Saiba mais
        </a>.
      </p>
      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
        <button
          onClick={() => choose(false)}
          style={{
            height: 38, padding: "0 16px", borderRadius: 999, fontSize: 13, cursor: "pointer",
            background: "transparent", color: "var(--canvas)", border: "1px solid rgba(255,255,255,.4)",
          }}
        >
          Recusar
        </button>
        <button
          onClick={() => choose(true)}
          style={{
            height: 38, padding: "0 16px", borderRadius: 999, fontSize: 13, fontWeight: 600,
            cursor: "pointer", background: "var(--canvas)", color: "var(--ink)", border: "none",
          }}
        >
          Aceitar
        </button>
      </div>
    </div>
  );
}
