import { NextResponse } from "next/server";
import { resumeInfo } from "@/lib/dictionary";
import { currentUser } from "@/lib/auth";
import { frameWords } from "@/lib/history-store";
import type { Bonus } from "@/lib/scoring";

function parseBonuses(raw: unknown, len: number): Bonus[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (b): b is Bonus =>
        !!b && typeof b.index === "number" && b.index > 0 && b.index < len - 1 && (b.mult === 2 || b.mult === 3),
    )
    .map((b) => ({ index: b.index, mult: b.mult }));
}

// Re-open a specific frame, restoring only the finds from that frame instance.
export async function POST(req: Request) {
  const { start, end, len, bonuses, tier, frameId } = await req.json().catch(() => ({}));
  if (typeof start !== "string" || typeof end !== "string" || typeof len !== "number")
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  const bz = parseBonuses(bonuses, len);
  const t = typeof tier === "string" ? tier : "10k";
  const user = await currentUser();
  const found = user && typeof frameId === "string" ? frameWords(user.id, frameId) : [];
  const info = resumeInfo(start, end, len, bz, t, found);
  return NextResponse.json({
    start: start.toUpperCase(),
    end: end.toUpperCase(),
    len,
    bonuses: bz,
    total: info.total,
    best: info.best,
    finds: info.finds,
  });
}
