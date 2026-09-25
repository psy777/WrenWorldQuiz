import { NextResponse } from "next/server";
import { rankGuess } from "@/lib/dictionary";
import type { Bonus } from "@/lib/scoring";

function parseBonuses(raw: unknown, len: number): Bonus[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (b): b is Bonus =>
        !!b &&
        typeof b.index === "number" &&
        b.index > 0 &&
        b.index < len - 1 &&
        (b.mult === 2 || b.mult === 3),
    )
    .map((b) => ({ index: b.index, mult: b.mult }));
}

export async function POST(req: Request) {
  const { start, end, len, word, bonuses, tier } = await req.json().catch(() => ({}));
  if (typeof start !== "string" || typeof end !== "string" || typeof len !== "number" || typeof word !== "string")
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  return NextResponse.json(
    rankGuess(start, end, len, word, parseBonuses(bonuses, len), typeof tier === "string" ? tier : "10k"),
  );
}
