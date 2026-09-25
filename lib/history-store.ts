import { db } from "./db";

export type FrameRow = {
  frameId: string;
  startLetter: string;
  endLetter: string;
  len: number;
  bonuses: string; // JSON: {index,mult}[]
  total: number;
  found: number;
  topFound: number; // 0 | 1
  topWord: string | null;
  createdAt: number;
};

export type FramePatch = {
  frameId: string;
  startLetter: string;
  endLetter: string;
  len: number;
  bonuses: string;
  total: number;
  found: number;
  topFound: boolean;
  topWord: string | null;
  words: string[]; // the words found in *this* frame instance
};

// Upsert a frame the player is working on. Progress only moves forward.
export function recordFrame(userId: string, f: FramePatch) {
  db()
    .prepare(
      `INSERT INTO frame_history
         (userId, frameId, startLetter, endLetter, len, bonuses, total, found, topFound, topWord, words, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(userId, frameId) DO UPDATE SET
         total = excluded.total,
         found = MAX(found, excluded.found),
         topFound = MAX(topFound, excluded.topFound),
         topWord = COALESCE(excluded.topWord, topWord),
         words = excluded.words`,
    )
    .run(
      userId,
      f.frameId,
      f.startLetter.toUpperCase(),
      f.endLetter.toUpperCase(),
      f.len,
      f.bonuses,
      f.total,
      f.found,
      f.topFound ? 1 : 0,
      f.topWord ? f.topWord.toUpperCase() : null,
      JSON.stringify(f.words),
      Date.now(),
    );
}

// The words the player found in a specific frame instance (for resume).
export function frameWords(userId: string, frameId: string): string[] {
  const row = db().prepare("SELECT words FROM frame_history WHERE userId = ? AND frameId = ?").get(userId, frameId) as
    | { words: string | null }
    | undefined;
  if (!row?.words) return [];
  try {
    const arr = JSON.parse(row.words);
    return Array.isArray(arr) ? arr.filter((w) => typeof w === "string") : [];
  } catch {
    return [];
  }
}

export function listFrames(userId: string, limit = 60): FrameRow[] {
  return db()
    .prepare(
      `SELECT frameId, startLetter, endLetter, len, bonuses, total, found, topFound, topWord, createdAt
       FROM frame_history WHERE userId = ? ORDER BY createdAt DESC LIMIT ?`,
    )
    .all(userId, limit) as FrameRow[];
}
