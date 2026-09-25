import { NextResponse } from "next/server";
import { findByName, startSession, verifyPassword } from "@/lib/auth";

export async function POST(req: Request) {
  const { name, password } = await req.json().catch(() => ({}));
  if (typeof name !== "string" || typeof password !== "string")
    return NextResponse.json({ error: "Username and password required." }, { status: 400 });

  const row = findByName(name.trim());
  if (!row || !verifyPassword(password, row.passwordHash))
    return NextResponse.json({ error: "Wrong username or password." }, { status: 401 });

  await startSession(row.id);
  return NextResponse.json({
    user: { id: row.id, email: row.email, name: row.name, totalScore: row.totalScore },
  });
}
