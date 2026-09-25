import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { addScore, listFound, recordFound } from "@/lib/found-store";

// The signed-in player's personal word list.
export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false, words: [] }, { status: 401 });
  return NextResponse.json({ ok: true, words: listFound(user.id) });
}

// Save a freshly found word and add its points to the account. Points are added
// once per distinct word. No-ops (silently) when signed out.
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 200 });
  const { word, score, timeBonus } = await req.json().catch(() => ({}));
  if (typeof word !== "string" || !word.trim() || typeof score !== "number")
    return NextResponse.json({ ok: false }, { status: 400 });
  const bonus = typeof timeBonus === "number" && timeBonus > 0 ? Math.min(100, Math.floor(timeBonus)) : 0;
  const { isNew } = recordFound(user.id, word.trim(), score);
  const totalScore = isNew ? addScore(user.id, score + bonus) : user.totalScore;
  return NextResponse.json({ ok: true, totalScore });
}
