"use client";

// Everything wordgap used to keep in SQLite behind an account now lives in the
// browser, like the other games on the hub. One JSON blob under a single key.

// The frame a word was found in — enough to redraw it (letters come from the word).
export type WordFrame = { start: string; end: string; len: number; bonuses: { index: number; mult: number }[] };
export type FoundWord = { word: string; score: number; createdAt: number; frame?: WordFrame };

export type FrameRecord = {
  frameId: string;
  startLetter: string;
  endLetter: string;
  len: number;
  bonuses: { index: number; mult: number }[];
  total: number;
  found: number;
  topFound: boolean;
  topWord: string | null;
  words: string[];
  createdAt: number;
  topSeen?: boolean; // the "top word" popup has been dismissed for this frame
  doneSeen?: boolean; // the "frame complete" popup has been dismissed for this frame
};

export type FramePatch = Omit<FrameRecord, "createdAt" | "topSeen" | "doneSeen">;

type Save = {
  score: number;
  found: Record<string, FoundWord>;
  frames: Record<string, FrameRecord>;
};

const KEY = "wg_save";
const empty = (): Save => ({ score: 0, found: {}, frames: {} });

function read(): Save {
  if (typeof window === "undefined") return empty();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const s = JSON.parse(raw) as Partial<Save>;
    return { score: s.score ?? 0, found: s.found ?? {}, frames: s.frames ?? {} };
  } catch {
    return empty();
  }
}

function write(s: Save) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* quota / private mode — progress just won't persist */
  }
}

export function getTotalScore(): number {
  return read().score;
}

// Add points to the running total (e.g. a frame-completion bonus); returns the new total.
export function addScore(points: number): number {
  const s = read();
  s.score += points;
  write(s);
  return s.score;
}

// Save a freshly found word and (once per distinct word) bank its points plus any
// time bonus. Best score seen for a word wins; first-found time is preserved.
export function saveFound(
  word: string,
  score: number,
  timeBonus = 0,
  frame?: WordFrame,
): { totalScore: number; isNew: boolean } {
  const s = read();
  const w = word.toLowerCase();
  const existing = s.found[w];
  const isNew = !existing;
  const isBest = !existing || score > existing.score;
  s.found[w] = {
    word: w,
    score: Math.max(score, existing?.score ?? 0),
    createdAt: existing?.createdAt ?? Date.now(),
    // Keep the frame that produced the best score for this word.
    frame: isBest ? frame ?? existing?.frame : existing?.frame,
  };
  if (isNew) s.score += score + Math.max(0, Math.floor(timeBonus));
  write(s);
  return { totalScore: s.score, isNew };
}

export function listFound(): FoundWord[] {
  return Object.values(read().found).sort((a, b) => b.createdAt - a.createdAt);
}

// Upsert a frame the player is working on. Progress only moves forward.
export function recordFrame(f: FramePatch) {
  const s = read();
  const prev = s.frames[f.frameId];
  s.frames[f.frameId] = {
    frameId: f.frameId,
    startLetter: f.startLetter.toUpperCase(),
    endLetter: f.endLetter.toUpperCase(),
    len: f.len,
    bonuses: f.bonuses,
    total: f.total,
    found: Math.max(prev?.found ?? 0, f.found),
    topFound: (prev?.topFound ?? false) || f.topFound,
    topWord: (f.topWord ? f.topWord.toUpperCase() : null) ?? prev?.topWord ?? null,
    words: f.words,
    createdAt: prev?.createdAt ?? Date.now(),
    topSeen: prev?.topSeen ?? false, // preserve "popup dismissed" flags across saves
    doneSeen: prev?.doneSeen ?? false,
  };
  write(s);
}

// The words the player found in a specific frame instance (for resume).
export function frameWords(frameId: string): string[] {
  return read().frames[frameId]?.words ?? [];
}

export function getFrame(frameId: string): FrameRecord | undefined {
  return read().frames[frameId];
}

// Remember that a frame's top-word / completion popup has been dismissed, so it
// isn't shown again for that frame (e.g. after a reload).
export function markFrameSeen(frameId: string, patch: { topSeen?: boolean; doneSeen?: boolean }) {
  const s = read();
  const rec = s.frames[frameId];
  if (!rec) return;
  if (patch.topSeen !== undefined) rec.topSeen = patch.topSeen;
  if (patch.doneSeen !== undefined) rec.doneSeen = patch.doneSeen;
  write(s);
}

export function listFrames(limit = 60): FrameRecord[] {
  return Object.values(read().frames)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, limit);
}

export function resetProgress() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
