import fs from "node:fs";
import path from "node:path";
import rawWords from "an-array-of-english-words";
import { scoreWord, scoreWithBonuses, type Bonus } from "./scoring";

// Frames are start-letter + end-letter + length. Keep the pool to sane word
// lengths so generated frames are playable and the index stays lean.
const MIN_LEN = 4;
const MAX_LEN = 8;

// Word-list tiers (like Monkeytype): a word belongs to a tier if its frequency
// rank is below the tier size. "450k" = every word. `min` is how many in-tier
// words a frame needs to be worth offering in that tier (smaller lists → looser).
export type TierLabel = "1k" | "5k" | "10k" | "20k" | "100k" | "450k";
const TIERS: { label: TierLabel; size: number; min: number }[] = [
  { label: "1k", size: 1000, min: 3 },
  { label: "5k", size: 5000, min: 5 },
  { label: "10k", size: 10000, min: 6 },
  { label: "20k", size: 20000, min: 8 },
  { label: "100k", size: 100000, min: 8 },
  { label: "450k", size: Infinity, min: 12 },
];
const TIER_SIZE = Object.fromEntries(TIERS.map((t) => [t.label, t.size])) as Record<TierLabel, number>;
export const TIER_LABELS = TIERS.map((t) => t.label);
export function tierSize(label: string): number {
  return TIER_SIZE[label as TierLabel] ?? Infinity;
}

// The smallest word-list tier a word belongs to (its "home" dictionary).
export function wordTier(word: string): TierLabel {
  const rank = dict().rankOf.get(word.toLowerCase()) ?? Infinity;
  for (const t of TIERS) if (rank < t.size) return t.label;
  return "450k";
}

type Entry = { word: string; score: number; rank: number }; // rank = frequency rank (Infinity if unranked)
type Index = {
  wordSet: Set<string>;
  rankOf: Map<string, number>;
  byFrame: Map<string, Entry[]>; // key: start+end+len -> entries sorted by score desc
  frameKeysByTier: Record<TierLabel, string[]>;
};

const g = globalThis as unknown as { __wg_dict?: Index };

function keyFor(start: string, end: string, len: number) {
  return `${start}${end}${len}`;
}

function build(): Index {
  const wordSet = new Set<string>();
  const rankOf = new Map<string, number>();
  try {
    const txt = fs.readFileSync(path.join(process.cwd(), "lib", "freq-words.txt"), "utf8");
    txt.split("\n").forEach((w, i) => {
      if (w) rankOf.set(w, i);
    });
  } catch {
    // no frequency data → every finite tier is empty, everything lives in "450k"
  }

  const byFrame = new Map<string, Entry[]>();
  for (const w of rawWords as string[]) {
    if (!/^[a-z]+$/.test(w)) continue;
    wordSet.add(w);
    const len = w.length;
    if (len < MIN_LEN || len > MAX_LEN) continue;
    const key = keyFor(w[0], w[len - 1], len);
    let arr = byFrame.get(key);
    if (!arr) byFrame.set(key, (arr = []));
    arr.push({ word: w, score: scoreWord(w), rank: rankOf.get(w) ?? Infinity });
  }
  for (const arr of byFrame.values()) {
    arr.sort((a, b) => b.score - a.score || a.word.localeCompare(b.word));
  }

  const frameKeysByTier = Object.fromEntries(TIERS.map((t) => [t.label, [] as string[]])) as Record<
    TierLabel,
    string[]
  >;
  for (const [key, arr] of byFrame) {
    for (const t of TIERS) {
      const n = t.size === Infinity ? arr.length : arr.reduce((c, e) => c + (e.rank < t.size ? 1 : 0), 0);
      if (n >= t.min) frameKeysByTier[t.label].push(key);
    }
  }
  return { wordSet, rankOf, byFrame, frameKeysByTier };
}

export function dict(): Index {
  if (!g.__wg_dict) g.__wg_dict = build();
  return g.__wg_dict;
}

const inTier = (e: Entry, size: number) => size === Infinity || e.rank < size;

// Sprinkle double / triple-letter squares onto the fillable (middle) tiles.
function randomBonuses(len: number): Bonus[] {
  const mid: number[] = [];
  for (let i = 1; i < len - 1; i++) mid.push(i);
  const count = Math.min(mid.length, [0, 1, 1, 2][Math.floor(Math.random() * 4)]);
  const bonuses: Bonus[] = [];
  const pool = [...mid];
  for (let n = 0; n < count && pool.length; n++) {
    const idx = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
    bonuses.push({ index: idx, mult: Math.random() < 0.6 ? 2 : 3 });
  }
  return bonuses.sort((a, b) => a.index - b.index);
}

function bestWithBonuses(entries: Entry[], bonuses: Bonus[]): number {
  if (!entries.length) return 0;
  if (!bonuses.length) return entries[0].score; // pre-sorted by base score
  return entries.reduce((max, e) => Math.max(max, scoreWithBonuses(e.word, bonuses)), 0);
}

export function randomFrame(tier: string = "10k", multipliers: boolean = true) {
  const d = dict();
  const size = tierSize(tier);
  const keys = d.frameKeysByTier[tier as TierLabel] ?? d.frameKeysByTier["450k"];
  const key = keys[Math.floor(Math.random() * keys.length)];
  const len = Number(key.slice(2));
  const arr = d.byFrame.get(key)!;
  const entries = size === Infinity ? arr : arr.filter((e) => inTier(e, size));
  const bonuses = multipliers ? randomBonuses(len) : [];
  return {
    start: key[0].toUpperCase(),
    end: key[1].toUpperCase(),
    len,
    total: entries.length,
    best: bestWithBonuses(entries, bonuses),
    bonuses,
  };
}

// Where a (bonus-adjusted) score ranks among a frame's in-tier words.
export function frameScoreStats(
  start: string,
  end: string,
  len: number,
  bonuses: Bonus[],
  score: number,
  tier: string = "10k",
): { rank: number; total: number; best: number } {
  const d = dict();
  const size = tierSize(tier);
  const arr = d.byFrame.get(keyFor(start.toLowerCase(), end.toLowerCase(), len));
  if (!arr) return { rank: 1, total: 0, best: 0 };
  let higher = 0;
  let best = 0;
  let total = 0;
  for (const e of arr) {
    if (!inTier(e, size)) continue;
    total++;
    const es = bonuses.length ? scoreWithBonuses(e.word, bonuses) : e.score;
    if (es > best) best = es;
    if (es > score) higher++;
  }
  return { rank: higher + 1, total, best };
}

// Re-open a specific frame: its total/best for the tier, plus the player's
// already-found words that fit it (restored from their dictionary).
export function resumeInfo(
  start: string,
  end: string,
  len: number,
  bonuses: Bonus[],
  tier: string,
  found: string[],
): {
  total: number;
  best: number;
  finds: { word: string; score: number; rank: number; total: number; bonus: boolean; wordTier: string }[];
} {
  const d = dict();
  const size = tierSize(tier);
  const arr = d.byFrame.get(keyFor(start.toLowerCase(), end.toLowerCase(), len));
  if (!arr) return { total: 0, best: 0, finds: [] };
  const entries = arr.filter((e) => inTier(e, size)).map((e) => ({ word: e.word, score: scoreWithBonuses(e.word, bonuses) }));
  const total = entries.length;
  const best = entries.reduce((m, e) => Math.max(m, e.score), 0);
  const inTierScore = new Map(entries.map((e) => [e.word, e.score]));
  const allScore = new Map(arr.map((e) => [e.word, scoreWithBonuses(e.word, bonuses)]));
  const finds: { word: string; score: number; rank: number; total: number; bonus: boolean; wordTier: string }[] = [];
  for (const w of found) {
    const lw = w.toLowerCase();
    const score = allScore.get(lw);
    if (score === undefined) continue; // doesn't fit this frame
    const bonus = !inTierScore.has(lw);
    const rank = bonus ? 0 : entries.reduce((c, e) => c + (e.score > score ? 1 : 0), 0) + 1;
    finds.push({ word: lw, score, rank, total, bonus, wordTier: wordTier(lw) });
  }
  finds.sort((a, b) => b.score - a.score || a.word.localeCompare(b.word));
  return { total, best, finds };
}

// Hint targets: the unfound in-tier words just above the player's best find,
// nearest first; once topped out, the best remaining, until none are left.
export function hintCandidates(
  start: string,
  end: string,
  len: number,
  bonuses: Bonus[],
  found: string[],
  tier: string = "10k",
  limit = 6,
): { word: string; score: number }[] {
  const d = dict();
  const size = tierSize(tier);
  const arr = d.byFrame.get(keyFor(start.toLowerCase(), end.toLowerCase(), len));
  if (!arr) return [];
  const foundSet = new Set(found.map((w) => w.toLowerCase()));
  const scored = arr
    .filter((e) => inTier(e, size))
    .map((e) => ({ word: e.word, score: bonuses.length ? scoreWithBonuses(e.word, bonuses) : e.score }));
  let bestFound = -Infinity;
  for (const s of scored) if (foundSet.has(s.word) && s.score > bestFound) bestFound = s.score;
  const unfound = scored.filter((s) => !foundSet.has(s.word));
  const above = unfound
    .filter((s) => s.score > bestFound)
    .sort((a, b) => a.score - b.score || a.word.localeCompare(b.word));
  if (above.length) return above.slice(0, limit);
  return unfound.sort((a, b) => b.score - a.score || a.word.localeCompare(b.word)).slice(0, limit);
}

export type GuessResult =
  | { ok: false; reason: string }
  // `bonus` = a valid word that fits but sits outside the chosen tier; it still counts.
  // `wordTier` = the smallest dictionary the word belongs to.
  | {
      ok: true;
      word: string;
      score: number;
      rank: number;
      total: number;
      best: number;
      bonus: boolean;
      wordTier: string;
    };

export function rankGuess(
  start: string,
  end: string,
  len: number,
  raw: string,
  bonuses: Bonus[] = [],
  tier: string = "10k",
): GuessResult {
  const word = raw.toLowerCase().trim();
  const d = dict();
  const s = start.toLowerCase();
  const e = end.toLowerCase();
  const size = tierSize(tier);
  if (word.length !== len) return { ok: false, reason: `Must be ${len} letters.` };
  if (word[0] !== s || word[word.length - 1] !== e)
    return { ok: false, reason: `Must start with ${start} and end with ${end}.` };
  if (!d.wordSet.has(word)) return { ok: false, reason: `"${word.toUpperCase()}" isn't in the dictionary.` };
  const arr = d.byFrame.get(keyFor(s, e, len));
  if (!arr) return { ok: false, reason: "No such frame." };
  const score = scoreWithBonuses(word, bonuses);
  const inTierWord = size === Infinity || (d.rankOf.get(word) ?? Infinity) < size;
  let higher = 0;
  let best = 0;
  let total = 0;
  for (const entry of arr) {
    if (!inTier(entry, size)) continue;
    total++;
    const es = bonuses.length ? scoreWithBonuses(entry.word, bonuses) : entry.score;
    if (es > score) higher++;
    if (es > best) best = es;
  }
  // Out-of-tier words that fit are accepted as "bonus" words — no tier rank.
  if (!inTierWord) return { ok: true, word, score, rank: 0, total, best, bonus: true, wordTier: wordTier(word) };
  return { ok: true, word, score, rank: higher + 1, total, best, bonus: false, wordTier: wordTier(word) };
}
