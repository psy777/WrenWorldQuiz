import { NextResponse } from "next/server";
import { frameClueWords } from "@/lib/dictionary";
import type { Bonus } from "@/lib/scoring";

// How many words get a Datamuse clue lookup per frame. Big-tier frames can hold
// hundreds of words; the rest still get rows, just without clue text.
const CLUE_LOOKUP_CAP = 60;

function parseBonuses(raw: unknown, len: number): Bonus[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (b): b is Bonus =>
        !!b && typeof b.index === "number" && b.index > 0 && b.index < len - 1 && (b.mult === 2 || b.mult === 3),
    )
    .map((b) => ({ index: b.index, mult: b.mult }));
}

// Clue text never changes for a word, so let Next cache the Datamuse responses.
async function rows(url: string): Promise<{ word?: string; score?: number }[]> {
  try {
    const r = await fetch(url, { cache: "force-cache" });
    if (!r.ok) return [];
    return (await r.json()) as { word?: string; score?: number }[];
  } catch {
    return [];
  }
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = a[i - 1] === b[j - 1] ? prev[j - 1] : 1 + Math.min(prev[j], cur[j - 1], prev[j - 1]);
    }
    prev = cur;
  }
  return prev[n];
}

// A clue is unusable if it's basically the answer (a near-identical spelling or a
// sub/superstring) or if it would itself fit the frame — a frame-fitting clue looks
// like a guessable answer even though it isn't in the game's dictionary.
function makeReject(target: string, start: string, end: string, len: number) {
  const s = start.toLowerCase();
  const e = end.toLowerCase();
  return (w: string): boolean => {
    if (!w || w === target) return true;
    if (w.includes(target) || target.includes(w)) return true;
    if (levenshtein(w, target) <= 2) return true;
    if (w.length === len && w[0] === s && w[w.length - 1] === e) return true; // fits the frame
    return false;
  };
}

// A one-word synonym for `word` (Datamuse, no key) that passes `reject`, or null.
async function synonymOf(word: string, reject: (w: string) => boolean): Promise<string | null> {
  const pick = (arr: { word?: string }[]) => {
    for (const it of arr) {
      const w = it.word?.toLowerCase();
      if (w && !w.includes(" ") && !reject(w)) return it.word!;
    }
    for (const it of arr) {
      const w = it.word?.toLowerCase();
      if (w && !reject(w)) return it.word!;
    }
    return null;
  };
  return (
    pick(await rows(`https://api.datamuse.com/words?rel_syn=${encodeURIComponent(word)}&max=8`)) ??
    pick(await rows(`https://api.datamuse.com/words?ml=${encodeURIComponent(word)}&max=10`))
  );
}

// A short definition of `word`, with the word itself masked so it isn't given away.
async function definitionOf(word: string): Promise<string | null> {
  const r = (await rows(`https://api.datamuse.com/words?sp=${encodeURIComponent(word)}&md=d&max=1`)) as {
    defs?: string[];
  }[];
  const defs = r[0]?.defs;
  if (!defs || !defs.length) return null;
  const [, ...rest] = defs[0].split("\t");
  let text = rest.join(" ").trim();
  text = text.replace(new RegExp(word, "gi"), "___");
  return text || null;
}

// One clue per in-tier word in the frame, highest score first, so the client can
// show the whole list at once (found words swap their clue row for a find row).
export async function POST(req: Request) {
  const { start, end, len, bonuses, tier, style } = await req.json().catch(() => ({}));
  if (typeof start !== "string" || typeof end !== "string" || typeof len !== "number")
    return NextResponse.json({ ok: false, reason: "Bad request." }, { status: 400 });

  const t = typeof tier === "string" ? tier : "10k";
  const useDef = style === "definition";
  const bz = parseBonuses(bonuses, len);
  const words = frameClueWords(start, end, len, bz, t);
  if (!words.length) return NextResponse.json({ ok: false, reason: "No such frame." });

  const looked = await Promise.all(
    words.slice(0, CLUE_LOOKUP_CAP).map(async (w) => {
      const clue = useDef ? await definitionOf(w.word) : await synonymOf(w.word, makeReject(w.word, start, end, len));
      return { ...w, clue };
    }),
  );
  const rest = words.slice(CLUE_LOOKUP_CAP).map((w) => ({ ...w, clue: null as string | null }));
  return NextResponse.json({ ok: true, clues: [...looked, ...rest] });
}
