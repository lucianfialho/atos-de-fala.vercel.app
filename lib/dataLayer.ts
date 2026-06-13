// Single entry point for the dataLayer (CLAUDE.md / docs/datalayer.md). Components NEVER call
// window.dataLayer.push directly — always dlPush, so the no-PII / consent contract is auditable
// in one place. NEVER push free text or personal identifiers (see docs/datalayer.md §2, §5).

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

export const CONSENT_KEY = "atos-analytics-consent"; // 'granted' | 'denied'

export function dlPush(payload: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(payload);
}

/** Tier C1 — update Consent Mode v2 analytics_storage after the user's banner choice. */
export function setAnalyticsConsent(granted: boolean): void {
  if (typeof window === "undefined") return;
  window.gtag?.("consent", "update", { analytics_storage: granted ? "granted" : "denied" });
  try {
    localStorage.setItem(CONSENT_KEY, granted ? "granted" : "denied");
  } catch {
    /* storage blocked — non-fatal */
  }
}

export function getStoredConsent(): "granted" | "denied" | null {
  if (typeof window === "undefined") return null;
  try {
    const v = localStorage.getItem(CONSENT_KEY);
    return v === "granted" || v === "denied" ? v : null;
  } catch {
    return null;
  }
}

// UF -> Brazilian macro-region (docs/datalayer.md §5: prefer `region` over `uf` when possible).
const UF_REGION: Record<string, string> = {
  AC: "N", AP: "N", AM: "N", PA: "N", RO: "N", RR: "N", TO: "N",
  AL: "NE", BA: "NE", CE: "NE", MA: "NE", PB: "NE", PE: "NE", PI: "NE", RN: "NE", SE: "NE",
  DF: "CO", GO: "CO", MT: "CO", MS: "CO",
  ES: "SE", MG: "SE", RJ: "SE", SP: "SE",
  PR: "S", RS: "S", SC: "S",
};

export function regionFromUf(uf: string): string {
  return UF_REGION[uf] ?? "";
}

/** Map a route to the contract's `section` enum (docs/datalayer.md §4). */
export function sectionFor(pathname: string): string {
  if (pathname === "/") return "participar";
  if (pathname.startsWith("/jogar") || pathname.startsWith("/assistir")) return "anotar";
  if (pathname.startsWith("/sobre")) return "sobre";
  if (pathname.startsWith("/painel")) return "painel";
  if (pathname.startsWith("/termo")) return "termo";
  return "outro";
}
