/**
 * Finding the library entry an imported exercise probably means.
 *
 * The model is offered the library as a closed list and asked to name the
 * entry each exercise is, but it is deliberately cautious — and caution costs
 * you the video. "Upward wall angel" is a wall angel; "Bicep curls" is a bicep
 * curl. This is the second pass that catches those, on the names alone, and
 * what it finds is offered as a suggestion rather than applied: a wrong match
 * silently swapping one movement for another is worse than no match at all.
 */

/**
 * Words that describe how, not what, and shouldn't decide a match.
 *
 * "side" is deliberately absent: it reads as filler in "dead bug, each side"
 * but it is the whole difference in "side plank", and dropping it made the two
 * indistinguishable. "each" alone is enough to defuse the filler case.
 */
const NOISE = new Set([
  'the',
  'a',
  'and',
  'with',
  'to',
  'on',
  'in',
  'of',
  'for',
  'from',
  'each',
  'per',
  'both',
  'alternating',
  'alternate',
  'slow',
  'slowly',
  'gentle',
  'gentler',
  'easy',
  'light',
  'gently',
  'gradual',
  'controlled',
  'gym',
  'home',
  'gymversion',
]);

/** Endings that mark the same word, not a different one. */
function stem(word: string): string {
  if (word.length > 4 && word.endsWith('ies')) return `${word.slice(0, -3)}y`;
  if (word.length > 3 && word.endsWith('es') && !word.endsWith('ses')) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
}

export function words(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map(stem)
    .filter((word) => !NOISE.has(word));
}

export interface Candidate {
  id: string;
  name: string;
}

/**
 * How alike two names are, from 0 to 1.
 *
 * The same words in any form scores 1. One name containing every meaningful
 * word of the other scores high but not top, and lower the more is left over:
 * "Romanian deadlift" contains "deadlift", but it is not a deadlift, and a
 * plain containment score would let the shorter entry win the tie. Anything
 * else is scored on the share of words the two have in common.
 */
export function similarity(a: string, b: string): number {
  const left = new Set(words(a));
  const right = new Set(words(b));
  if (left.size === 0 || right.size === 0) return 0;

  let shared = 0;
  for (const word of left) if (right.has(word)) shared += 1;
  if (shared === 0) return 0;

  const smaller = Math.min(left.size, right.size);
  const larger = Math.max(left.size, right.size);

  if (shared === larger) return 1;
  if (shared === smaller) return 0.6 + 0.35 * (smaller / larger);

  return shared / (left.size + right.size - shared);
}

/**
 * The best candidate, if any is close enough to be worth offering.
 *
 * The bar is deliberately high: a suggestion the coach has to notice and undo
 * is a worse failure than one they have to make themselves.
 */
export function suggestMatch(
  name: string,
  candidates: Candidate[],
  threshold = 0.5,
): Candidate | null {
  let best: Candidate | null = null;
  let bestScore = 0;
  let bestExtra = Number.POSITIVE_INFINITY;

  const asked = words(name).length;

  for (const candidate of candidates) {
    const score = similarity(name, candidate.name);
    if (score < bestScore) continue;

    // On a tie, the candidate closest in length wins — it has the least said
    // about it that the imported name didn't say.
    const extra = Math.abs(words(candidate.name).length - asked);
    if (score > bestScore || extra < bestExtra) {
      bestScore = score;
      bestExtra = extra;
      best = candidate;
    }
  }

  return bestScore >= threshold ? best : null;
}
