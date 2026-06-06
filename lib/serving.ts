// Pure next-item picker. The route supplies candidates = items the participant has NOT yet
// voted on (dedup done in SQL).
//
// Active-learning (fatia C): prefer the HIGHEST-priority items (priority = human disagreement
// + act rarity, written by `atos.collect score`), tie-broken by fewest votes. An ε-greedy
// slice still explores fewest-voted items so brand-new/unscored items get covered and the
// queue isn't identical for everyone. With no priority data this is exactly the old
// fewest-voted behavior. Honeypot due every 7th.

export type Candidate = { id: number; isHoneypot: boolean; voteCount: number; priority?: number };

const EXPLORE_EPSILON = 0.15;

// Random candidate among those tied at the lowest vote count (null if empty).
const fewestVotes = (xs: Candidate[]): Candidate | null => {
  if (xs.length === 0) return null;
  const min = Math.min(...xs.map((c) => c.voteCount));
  const tied = xs.filter((c) => c.voteCount === min);
  return tied[Math.floor(Math.random() * tied.length)];
};

// Highest priority, tie-broken by fewest votes (then random).
const byPriority = (xs: Candidate[]): Candidate | null => {
  if (xs.length === 0) return null;
  const maxP = Math.max(...xs.map((c) => c.priority ?? 0));
  const top = xs.filter((c) => (c.priority ?? 0) === maxP);
  return fewestVotes(top);
};

export function pickNextItem(
  candidates: Candidate[],
  itemsDone: number,
  epsilon: number = EXPLORE_EPSILON
): Candidate | null {
  if (candidates.length === 0) return null;
  const honeypotDue = (itemsDone + 1) % 7 === 0;
  const honeypots = candidates.filter((c) => c.isHoneypot);
  const normals = candidates.filter((c) => !c.isHoneypot);
  const primary = honeypotDue ? honeypots : normals;
  const fallback = honeypotDue ? normals : honeypots;
  const choose = Math.random() < epsilon ? fewestVotes : byPriority;
  return choose(primary) ?? choose(fallback);
}
