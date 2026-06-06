import { describe, it, expect } from "vitest";
import { pickNextItem, Candidate } from "./serving";

const c = (id: number, isHoneypot: boolean, voteCount: number, priority?: number): Candidate =>
  ({ id, isHoneypot, voteCount, priority });

describe("pickNextItem", () => {
  it("returns null when no candidates", () => {
    expect(pickNextItem([], 0)).toBeNull();
  });
  it("normal turn serves the non-honeypot with fewest votes", () => {
    const got = pickNextItem([c(1, false, 5), c(2, false, 1), c(3, true, 0)], 0);
    expect(got!.id).toBe(2);
  });
  it("every 7th served item is a honeypot (fewest votes)", () => {
    // itemsDone=6 -> this is the 7th -> honeypot due
    const got = pickNextItem([c(1, false, 0), c(3, true, 9), c(4, true, 2)], 6);
    expect(got!.id).toBe(4);
  });
  it("falls back to normal when a honeypot is due but none left", () => {
    const got = pickNextItem([c(1, false, 3), c(2, false, 0)], 6);
    expect(got!.id).toBe(2);
  });
  it("falls back to honeypot when only honeypots remain on a normal turn", () => {
    const got = pickNextItem([c(5, true, 1)], 0);
    expect(got!.id).toBe(5);
  });
  it("randomizes among items tied at the minimum vote count (always picks a min-tied one)", () => {
    // four normals all at 0 votes -> any of them is valid; over many runs it must vary AND
    // never pick a higher-voted item.
    const pool = [c(1, false, 0), c(2, false, 0), c(3, false, 0), c(4, false, 0), c(9, false, 5)];
    const picked = new Set<number>();
    for (let i = 0; i < 60; i++) picked.add(pickNextItem(pool, 0)!.id);
    expect(picked.has(9)).toBe(false);            // never the higher-voted one
    expect([...picked].every((id) => id !== 9)).toBe(true);
    expect(picked.size).toBeGreaterThan(1);       // genuinely randomized across the tie band
  });

  it("exploit path serves the highest-priority item even if it has more votes", () => {
    // id 2 has more votes but higher priority -> chosen when exploiting (epsilon=0)
    const got = pickNextItem([c(1, false, 0, 0.1), c(2, false, 9, 0.9)], 0, 0);
    expect(got!.id).toBe(2);
  });

  it("breaks priority ties by fewest votes", () => {
    const got = pickNextItem([c(1, false, 5, 0.8), c(2, false, 1, 0.8)], 0, 0);
    expect(got!.id).toBe(2);
  });

  it("explore path (epsilon=1) ignores priority and uses fewest votes", () => {
    const got = pickNextItem([c(1, false, 0, 0.1), c(2, false, 9, 0.9)], 0, 1);
    expect(got!.id).toBe(1); // fewest votes wins when exploring
  });

  it("no priority data behaves like fewest-votes (back-compat)", () => {
    const got = pickNextItem([c(1, false, 5), c(2, false, 1)], 0, 0);
    expect(got!.id).toBe(2);
  });
});
