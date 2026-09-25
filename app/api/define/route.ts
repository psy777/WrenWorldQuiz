import { NextResponse } from "next/server";

const POS: Record<string, string> = { n: "noun", v: "verb", adj: "adjective", adv: "adverb", u: "" };

async function datamuse(url: string) {
  try {
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) return [];
    return (await r.json()) as { word?: string; defs?: string[] }[];
  } catch {
    return [];
  }
}

// A short definition + a few related words for `word`, via Datamuse (no key).
export async function GET(req: Request) {
  const word = (new URL(req.url).searchParams.get("word") ?? "").toLowerCase().trim();
  if (!word) return NextResponse.json({ ok: false, word, defs: [], related: [] }, { status: 400 });

  const [defRows, synRows] = await Promise.all([
    datamuse(`https://api.datamuse.com/words?sp=${encodeURIComponent(word)}&md=d&max=1`),
    datamuse(`https://api.datamuse.com/words?ml=${encodeURIComponent(word)}&max=12`),
  ]);

  const defs = (defRows[0]?.defs ?? []).slice(0, 4).map((d) => {
    const [pos, ...rest] = d.split("\t");
    const text = rest.join(" ").trim();
    const label = POS[pos] ?? pos;
    return label ? `(${label}) ${text}` : text;
  });

  const related = synRows
    .map((r) => r.word ?? "")
    .filter((w) => w && w !== word && !w.includes(" "))
    .slice(0, 8);

  return NextResponse.json({ ok: true, word, defs, related });
}
