// Every letter has a distinct value, ranked by English-text rarity: the most
// common letter (E) is worth 1, the rarest (Z) is worth 26. Rarer letters score
// higher, so maximizing score rewards fancier words — but no two letters tie.
export const VALUES: Record<string, number> = {
  e: 1, t: 2, a: 3, o: 4, i: 5, n: 6, s: 7, r: 8, h: 9, l: 10, d: 11, c: 12, u: 13,
  m: 14, f: 15, p: 16, g: 17, w: 18, y: 19, b: 20, v: 21, k: 22, j: 23, x: 24, q: 25, z: 26,
};

export const letterValue = (ch: string): number => VALUES[(ch ?? "").toLowerCase()] ?? 0;

export const scoreWord = (word: string): number =>
  [...word.toLowerCase()].reduce((sum, ch) => sum + letterValue(ch), 0);

// Board bonus on a single tile: a double- or triple-letter square. `index` is
// the absolute tile position (0 = start letter, len-1 = end letter).
export type Bonus = { index: number; mult: 2 | 3 };

// Score a word, multiplying the letters that land on bonus squares.
export const scoreWithBonuses = (word: string, bonuses: Bonus[] = []): number => {
  const mult = new Map(bonuses.map((b) => [b.index, b.mult]));
  return [...word.toLowerCase()].reduce((sum, ch, i) => sum + letterValue(ch) * (mult.get(i) ?? 1), 0);
};

export const bestScore = (words: string[], bonuses: Bonus[] = []): number =>
  words.reduce((max, w) => Math.max(max, scoreWithBonuses(w, bonuses)), 0);
