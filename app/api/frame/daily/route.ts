import { NextResponse } from "next/server";
import { dailyFrame, resumeInfo, DAILY_TIER } from "@/lib/dictionary";

// The same frame for everyone on `date` (YYYY-MM-DD), with the player's own
// already-found words (sent from their browser) scored back in for resume.
export async function POST(req: Request) {
  const { date, found } = await req.json().catch(() => ({}));
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date))
    return NextResponse.json({ error: "Bad date." }, { status: 400 });
  const foundArr: string[] = Array.isArray(found) ? found.filter((w) => typeof w === "string") : [];
  const f = dailyFrame(date);
  const info = resumeInfo(f.start, f.end, f.len, f.bonuses, DAILY_TIER, foundArr);
  return NextResponse.json({
    date,
    number: f.number,
    start: f.start,
    end: f.end,
    len: f.len,
    bonuses: f.bonuses,
    total: info.total,
    best: info.best,
    finds: info.finds,
  });
}
