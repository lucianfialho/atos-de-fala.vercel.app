import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  dlPush,
  setAnalyticsConsent,
  getStoredConsent,
  regionFromUf,
  sectionFor,
  CONSENT_KEY,
} from "../../lib/dataLayer";

// Minimal browser-global polyfill so the window/localStorage-guarded helpers run under
// vitest's `node` environment (no jsdom dependency).
function installBrowserGlobals() {
  const store: Record<string, string> = {};
  (globalThis as Record<string, unknown>).localStorage = {
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => { store[k] = String(v); },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { for (const k of Object.keys(store)) delete store[k]; },
  };
  (globalThis as Record<string, unknown>).window = globalThis;
}

describe("regionFromUf", () => {
  it("maps UF to macro-region", () => {
    expect(regionFromUf("SP")).toBe("SE");
    expect(regionFromUf("BA")).toBe("NE");
    expect(regionFromUf("AM")).toBe("N");
    expect(regionFromUf("DF")).toBe("CO");
    expect(regionFromUf("RS")).toBe("S");
  });
  it("returns '' for unknown UF", () => {
    expect(regionFromUf("XX")).toBe("");
  });
});

describe("sectionFor", () => {
  it("maps routes to the contract section enum", () => {
    expect(sectionFor("/")).toBe("participar");
    expect(sectionFor("/jogar")).toBe("anotar");
    expect(sectionFor("/assistir")).toBe("anotar");
    expect(sectionFor("/sobre")).toBe("sobre");
    expect(sectionFor("/painel")).toBe("painel");
    expect(sectionFor("/termo")).toBe("termo");
  });
});

describe("dlPush", () => {
  beforeEach(() => {
    installBrowserGlobals();
    window.dataLayer = [];
  });
  it("pushes the payload onto window.dataLayer", () => {
    dlPush({ event: "annotation_submit", item_id: 42, verdict: "yes" });
    expect(window.dataLayer).toHaveLength(1);
    expect(window.dataLayer![0]).toEqual({ event: "annotation_submit", item_id: 42, verdict: "yes" });
  });
});

describe("analytics consent (LGPD consent-first)", () => {
  beforeEach(() => {
    installBrowserGlobals();
    window.gtag = vi.fn();
  });

  it("starts with no stored consent (default denied governs)", () => {
    expect(getStoredConsent()).toBeNull();
  });

  it("granting flips analytics_storage to granted and persists", () => {
    setAnalyticsConsent(true);
    expect(window.gtag).toHaveBeenCalledWith("consent", "update", { analytics_storage: "granted" });
    expect(localStorage.getItem(CONSENT_KEY)).toBe("granted");
    expect(getStoredConsent()).toBe("granted");
  });

  it("rejecting keeps analytics_storage denied and persists the refusal", () => {
    setAnalyticsConsent(false);
    expect(window.gtag).toHaveBeenCalledWith("consent", "update", { analytics_storage: "denied" });
    expect(getStoredConsent()).toBe("denied");
  });
});
