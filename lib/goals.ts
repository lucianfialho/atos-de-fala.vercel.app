// Collection goals per domain (source). The eval needs ~30 consensus items per domain to be
// authoritative; "consensus" = an item with at least CONSENSUS_VOTES distinct votes. synthetic
// is the legacy seed (no goal — already well-voted); the real lever is the three new domains.

export const CONSENSUS_VOTES = 2;

export const GOALS: Record<string, { label: string }> = {
  sac: { label: "Atendimento" },
  entrevista: { label: "Entrevista" },
  review: { label: "Avaliações" },
};

export const GOAL_ORDER = ["sac", "entrevista", "review"];

// Progressive ("moving goalpost") milestones: the bar never stays full — when a domain hits a
// tier the target jumps to the next, so there's always a next level to chase. Tier 1 (30) is the
// real line ("pronto pro eval"); beyond is bonus that helps training. Honeypots + reliability
// keep volume incentives from turning into rubber-stamping.
export const TIERS = [30, 90, 180, 300, 500];
export const EVAL_READY = TIERS[0];

export function goalFor(consensus: number): { target: number; level: number } {
  const level = TIERS.filter((t) => consensus >= t).length;
  const target = TIERS.find((t) => t > consensus) ?? Math.ceil((consensus + 1) / 200) * 200;
  return { target, level };
}
