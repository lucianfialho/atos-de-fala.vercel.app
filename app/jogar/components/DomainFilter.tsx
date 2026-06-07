"use client";

// Lets the player focus a collection session on one domain (source), so we can fill the
// known gaps (atendimento/SAC carries the commissive acts the model is weakest on) instead
// of getting items at random. Empty value = all domains. Choice is persisted by the parent.

export const DOMAINS: { value: string; label: string }[] = [
  { value: "", label: "Todos" },
  { value: "sac", label: "Atendimento" },
  { value: "entrevista", label: "Entrevista" },
  { value: "review", label: "Avaliações" },
  { value: "synthetic", label: "Geral" },
];

export default function DomainFilter({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Filtrar por domínio"
      style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", margin: "4px 0 20px" }}
    >
      {DOMAINS.map((d) => {
        const active = d.value === value;
        return (
          <button
            key={d.value || "all"}
            onClick={() => onChange(d.value)}
            aria-pressed={active}
            style={{
              height: 32,
              padding: "0 14px",
              borderRadius: 999,
              fontSize: 13,
              cursor: "pointer",
              transition: "background .15s, color .15s, border-color .15s",
              background: active ? "var(--ink)" : "transparent",
              color: active ? "var(--canvas)" : "var(--muted)",
              border: `1px solid ${active ? "var(--ink)" : "var(--hairline)"}`,
            }}
          >
            {d.label}
          </button>
        );
      })}
    </div>
  );
}
