// Collection goals per domain (source). The eval needs ~30 consensus items per domain to be
// authoritative; "consensus" = an item with at least CONSENSUS_VOTES distinct votes. synthetic
// is the legacy seed (no goal — already well-voted); the real lever is the three new domains.

export const CONSENSUS_VOTES = 2;

export const GOALS: Record<string, { label: string; target: number }> = {
  sac: { label: "Atendimento", target: 30 },
  entrevista: { label: "Entrevista", target: 30 },
  review: { label: "Avaliações", target: 30 },
};

export const GOAL_ORDER = ["sac", "entrevista", "review"];
