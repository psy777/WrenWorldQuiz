import { NextResponse } from "next/server";
import { createUser, findByName, startSession } from "@/lib/auth";

// Strong password: at least 8 characters, with a letter and a number.
const STRONG = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

export async function POST(req: Request) {
  const { name, password, email } = await req.json().catch(() => ({}));
  if (typeof name !== "string" || name.trim().length < 2)
    return NextResponse.json({ error: "Choose a username (2+ characters)." }, { status: 400 });
  if (typeof password !== "string" || !STRONG.test(password))
    return NextResponse.json({ error: "Password needs 8+ characters, including a letter and a number." }, { status: 400 });

  const cleanEmail = typeof email === "string" && email.trim() ? email.trim().toLowerCase() : null;
  if (cleanEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cleanEmail))
    return NextResponse.json({ error: "That email doesn't look right." }, { status: 400 });

  if (findByName(name.trim())) return NextResponse.json({ error: "That username is taken." }, { status: 409 });

  const user = createUser(name.trim(), password, cleanEmail);
  await startSession(user.id);
  return NextResponse.json({ user });
}
