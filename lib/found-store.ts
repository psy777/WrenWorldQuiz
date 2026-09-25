import { db } from "./db";

export type FoundWord = { word: string; score: number; createdAt: number };

// Remember a word a signed-in player found. The best score seen for a word wins;
// the first-found time is preserved. Returns whether this was a brand-new word.
export function recordFound(userId: string, word: string, score: number): { isNew: boolean } {
  const w = word.toLowerCase();
  const existing = db().prepare("SELECT 1 FROM found_words WHERE userId = ? AND word = ?").get(userId, w);
  db()
    .prepare(
      `INSERT INTO found_words (userId, word, score, createdAt) VALUES (?, ?, ?, ?)
       ON CONFLICT(userId, word) DO UPDATE SET score = MAX(score, excluded.score)`,
    )
    .run(userId, w, score, Date.now());
  return { isNew: !existing };
}

// Add points to a user's running total; returns the new total.
export function addScore(userId: string, points: number): number {
  db().prepare("UPDATE users SET totalScore = totalScore + ? WHERE id = ?").run(points, userId);
  const row = db().prepare("SELECT totalScore FROM users WHERE id = ?").get(userId) as { totalScore: number } | undefined;
  return row?.totalScore ?? 0;
}

export function listFound(userId: string): FoundWord[] {
  return db()
    .prepare("SELECT word, score, createdAt FROM found_words WHERE userId = ? ORDER BY createdAt DESC")
    .all(userId) as FoundWord[];
}
