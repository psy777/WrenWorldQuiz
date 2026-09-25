import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import path from "node:path";

// Single connection reused across HMR reloads in dev.
const g = globalThis as unknown as { __wg_db?: DatabaseSync };

function init(): DatabaseSync {
  const file = path.join(process.cwd(), "data", "wordgap.db");
  const db = new DatabaseSync(file);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id           TEXT PRIMARY KEY,
      name         TEXT UNIQUE NOT NULL,
      email        TEXT,
      passwordHash TEXT NOT NULL,
      totalScore   INTEGER NOT NULL DEFAULT 0,
      createdAt    INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token     TEXT PRIMARY KEY,
      userId    TEXT NOT NULL,
      expiresAt INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS puzzles (
      id         TEXT PRIMARY KEY,
      theme      TEXT NOT NULL,
      clue       TEXT NOT NULL,
      answer     TEXT NOT NULL,
      crosses    TEXT NOT NULL,
      official   INTEGER NOT NULL DEFAULT 0,
      authorId   TEXT,
      authorName TEXT,
      createdAt  INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS solves (
      userId    TEXT NOT NULL,
      puzzleId  TEXT NOT NULL,
      points    INTEGER NOT NULL,
      createdAt INTEGER NOT NULL,
      PRIMARY KEY (userId, puzzleId)
    );
    CREATE TABLE IF NOT EXISTS found_words (
      userId    TEXT NOT NULL,
      word      TEXT NOT NULL,
      score     INTEGER NOT NULL,
      createdAt INTEGER NOT NULL,
      PRIMARY KEY (userId, word)
    );
    CREATE TABLE IF NOT EXISTS frame_history (
      userId      TEXT NOT NULL,
      frameId     TEXT NOT NULL,
      startLetter TEXT NOT NULL,
      endLetter   TEXT NOT NULL,
      len         INTEGER NOT NULL,
      bonuses     TEXT NOT NULL,
      total       INTEGER NOT NULL,
      found       INTEGER NOT NULL,
      topFound    INTEGER NOT NULL,
      topWord     TEXT,
      words       TEXT,
      createdAt   INTEGER NOT NULL,
      PRIMARY KEY (userId, frameId)
    );
  `);
  // migrate older DBs that predate these columns
  try {
    db.exec("ALTER TABLE frame_history ADD COLUMN topWord TEXT");
  } catch {
    /* column already exists */
  }
  try {
    db.exec("ALTER TABLE frame_history ADD COLUMN words TEXT");
  } catch {
    /* column already exists */
  }
  // migrate old users schema (email NOT NULL / name not unique) → email optional, name unique
  try {
    const cols = db.prepare("PRAGMA table_info(users)").all() as { name: string; notnull: number }[];
    const email = cols.find((c) => c.name === "email");
    if (email && email.notnull === 1) {
      db.exec(`
        CREATE TABLE users_new (
          id TEXT PRIMARY KEY, name TEXT UNIQUE NOT NULL, email TEXT,
          passwordHash TEXT NOT NULL, totalScore INTEGER NOT NULL DEFAULT 0, createdAt INTEGER NOT NULL
        );
        INSERT INTO users_new (id, name, email, passwordHash, totalScore, createdAt)
          SELECT id, name, email, passwordHash, totalScore, createdAt FROM users;
        DROP TABLE users;
        ALTER TABLE users_new RENAME TO users;
      `);
    }
  } catch {
    /* already migrated */
  }
  return db;
}

export function db(): DatabaseSync {
  if (!g.__wg_db) g.__wg_db = init();
  return g.__wg_db;
}

export const newId = () => randomUUID();
