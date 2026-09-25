import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { db, newId } from "./db";

const COOKIE = "wg_session";
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export type PublicUser = { id: string; email: string | null; name: string; totalScore: number };

export function hashPassword(pw: string) {
  return bcrypt.hashSync(pw, 10);
}

async function setCookie(token: string, expiresAt: number) {
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    expires: new Date(expiresAt),
  });
}

export async function startSession(userId: string) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = Date.now() + MAX_AGE_MS;
  db().prepare("INSERT INTO sessions (token, userId, expiresAt) VALUES (?, ?, ?)").run(token, userId, expiresAt);
  await setCookie(token, expiresAt);
}

export async function endSession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) db().prepare("DELETE FROM sessions WHERE token = ?").run(token);
  jar.delete(COOKIE);
}

export async function currentUser(): Promise<PublicUser | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  const session = db().prepare("SELECT userId, expiresAt FROM sessions WHERE token = ?").get(token) as
    | { userId: string; expiresAt: number }
    | undefined;
  if (!session || session.expiresAt < Date.now()) return null;
  const user = db()
    .prepare("SELECT id, email, name, totalScore FROM users WHERE id = ?")
    .get(session.userId) as PublicUser | undefined;
  return user ?? null;
}

export function createUser(name: string, password: string, email: string | null): PublicUser {
  const id = newId();
  db()
    .prepare("INSERT INTO users (id, name, email, passwordHash, totalScore, createdAt) VALUES (?, ?, ?, ?, 0, ?)")
    .run(id, name, email, hashPassword(password), Date.now());
  return { id, email, name, totalScore: 0 };
}

export function findByName(name: string) {
  return db().prepare("SELECT * FROM users WHERE name = ?").get(name) as
    | { id: string; email: string | null; name: string; passwordHash: string; totalScore: number }
    | undefined;
}

export function verifyPassword(pw: string, hash: string) {
  return bcrypt.compareSync(pw, hash);
}
