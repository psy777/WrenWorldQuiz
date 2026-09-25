import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { listFrames, recordFrame } from "@/lib/history-store";

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false, frames: [] }, { status: 401 });
  return NextResponse.json({ ok: true, frames: listFrames(user.id) });
}

// Record/update a frame the player is working on. No-ops when signed out.
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 200 });
  const b = await req.json().catch(() => ({}));
  if (
    typeof b.frameId !== "string" ||
    typeof b.startLetter !== "string" ||
    typeof b.endLetter !== "string" ||
    typeof b.len !== "number"
  )
    return NextResponse.json({ ok: false }, { status: 400 });
  recordFrame(user.id, {
    frameId: b.frameId,
    startLetter: b.startLetter,
    endLetter: b.endLetter,
    len: b.len,
    bonuses: JSON.stringify(Array.isArray(b.bonuses) ? b.bonuses : []),
    total: Number(b.total) || 0,
    found: Number(b.found) || 0,
    topFound: !!b.topFound,
    topWord: typeof b.topWord === "string" ? b.topWord : null,
    words: Array.isArray(b.words) ? b.words.filter((w: unknown) => typeof w === "string") : [],
  });
  return NextResponse.json({ ok: true });
}
