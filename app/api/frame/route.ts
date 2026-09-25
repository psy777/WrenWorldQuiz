import { NextResponse } from "next/server";
import { randomFrame } from "@/lib/dictionary";

// A fresh random frame for the chosen word-list tier, with or without multipliers.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const tier = url.searchParams.get("tier") ?? "10k";
  const multipliers = url.searchParams.get("multipliers") !== "off";
  return NextResponse.json(randomFrame(tier, multipliers));
}
