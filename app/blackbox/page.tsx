"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

const N = 8;
const DAILY_ATOMS = 4;
const ATOM_CHOICES = [4, 5] as const;
// Detour pairs cycle through these; hits use --bad and reflections --tl, so skip those.
const PAIR_COLORS = ["var(--accent)", "var(--dl)", "var(--good)", "var(--ink)"];

type Mode = "daily" | "infinite";
type PortMark = { kind: "hit" } | { kind: "reflect" } | { kind: "pair"; n: number };
type Trace = { type: "hit" } | { type: "reflect" } | { type: "exit"; port: number };
type Result = { score: number; wrong: number; newBest: boolean };
type DailySave = { marks: [number, PortMark][]; pairCount: number; guesses: number[]; result: Result | null };

// 32 edge ports: 0-7 top (firing down), 8-15 right (firing left),
// 16-23 bottom (firing up), 24-31 left (firing right).
function portStart(port: number) {
  const side = Math.floor(port / N);
  const i = port % N;
  if (side === 0) return { r: -1, c: i, dr: 1, dc: 0 };
  if (side === 1) return { r: i, c: N, dr: 0, dc: -1 };
  if (side === 2) return { r: N, c: i, dr: -1, dc: 0 };
  return { r: i, c: -1, dr: 0, dc: 1 };
}

// Map a just-outside-the-grid cell back to its port number.
function portAt(r: number, c: number): number {
  if (r === -1) return c;
  if (c === N) return N + r;
  if (r === N) return 2 * N + c;
  return 3 * N + r;
}

// Classic Black Box ray physics. Each step looks at the cell straight ahead:
// an atom there absorbs the ray; an atom on one front diagonal bends it 90°
// away; atoms on both reverse it. Any bend before the ray has entered the box
// is a reflection, as is the (rare) ray trapped bouncing between two atoms.
function traceRay(atoms: Set<number>, port: number): Trace {
  let { r, c, dr, dc } = portStart(port);
  const at = (rr: number, cc: number) => rr >= 0 && rr < N && cc >= 0 && cc < N && atoms.has(rr * N + cc);
  let entered = false;
  for (let step = 0; step < 500; step++) {
    const nr = r + dr;
    const nc = c + dc;
    if (at(nr, nc)) return { type: "hit" };
    const s1 = at(nr - dc, nc + dr);
    const s2 = at(nr + dc, nc - dr);
    if (s1 || s2) {
      if (!entered) return { type: "reflect" };
      if (s1 && s2) {
        dr = -dr;
        dc = -dc;
      } else {
        const t = dr;
        if (s1) {
          dr = dc;
          dc = -t;
        } else {
          dr = -dc;
          dc = t;
        }
      }
      continue;
    }
    r = nr;
    c = nc;
    if (r < 0 || r >= N || c < 0 || c >= N) return { type: "exit", port: portAt(r, c) };
    entered = true;
  }
  return { type: "reflect" };
}

function randomAtoms(count: number): Set<number> {
  const s = new Set<number>();
  while (s.size < count) s.add(Math.floor(Math.random() * N * N));
  return s;
}

// Deterministic atoms for the daily — everyone with the same date gets the same box.
function seededAtoms(seed: string, count: number): Set<number> {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  const rand = () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
  const s = new Set<number>();
  while (s.size < count) s.add(Math.floor(rand() * N * N));
  return s;
}

// Local calendar date as YYYY-MM-DD — the day everyone shares.
function todayKey(): string {
  const n = new Date();
  const p = (x: number) => String(x).padStart(2, "0");
  return `${n.getFullYear()}-${p(n.getMonth() + 1)}-${p(n.getDate())}`;
}

function bestKey(count: number): string {
  return `bb_best_${count}`;
}

function dailyKey(date: string): string {
  return `bb_daily_${date}`;
}

export default function BlackBox() {
  const [light, setLight] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [mode, setMode] = useState<Mode>("daily");
  const [dailyDate, setDailyDate] = useState("");
  const [atomCount, setAtomCount] = useState<number>(4);
  const [atoms, setAtoms] = useState<Set<number>>(new Set());
  const [marks, setMarks] = useState<Map<number, PortMark>>(new Map());
  const [pairCount, setPairCount] = useState(0);
  const [guesses, setGuesses] = useState<Set<number>>(new Set());
  const [result, setResult] = useState<Result | null>(null);
  const [best, setBest] = useState<number | null>(null);

  const done = result !== null;
  const atomsInPlay = mode === "daily" ? DAILY_ATOMS : atomCount;

  const startGame = useCallback((m: Mode, count: number) => {
    setMarks(new Map());
    setPairCount(0);
    setGuesses(new Set());
    setResult(null);
    if (m === "daily") {
      const date = todayKey();
      setDailyDate(date);
      setAtoms(seededAtoms(`bb-${date}`, DAILY_ATOMS));
      const raw = localStorage.getItem(dailyKey(date));
      if (raw) {
        try {
          const s = JSON.parse(raw) as DailySave;
          setMarks(new Map(s.marks));
          setPairCount(s.pairCount);
          setGuesses(new Set(s.guesses));
          setResult(s.result);
        } catch {
          // corrupt save — fall through to the fresh board already set above
        }
      }
    } else {
      setAtoms(randomAtoms(count));
      const b = localStorage.getItem(bestKey(count));
      setBest(b ? Number(b) : null);
    }
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem("wg_theme") === "light";
    setLight(stored);
    document.documentElement.setAttribute("data-theme", stored ? "light" : "dark");
    startGame("daily", DAILY_ATOMS);
  }, [startGame]);

  // The daily is one shared puzzle per day, so every move is saved — refreshing
  // the page resumes rather than re-rolling.
  useEffect(() => {
    if (mode !== "daily" || !dailyDate) return;
    const save: DailySave = { marks: [...marks.entries()], pairCount, guesses: [...guesses], result };
    localStorage.setItem(dailyKey(dailyDate), JSON.stringify(save));
  }, [mode, dailyDate, marks, pairCount, guesses, result]);

  function toggleTheme() {
    setLight((l) => {
      const next = !l;
      document.documentElement.setAttribute("data-theme", next ? "light" : "dark");
      localStorage.setItem("wg_theme", next ? "light" : "dark");
      return next;
    });
  }

  function switchMode(m: Mode) {
    if (m === mode) return;
    setMode(m);
    startGame(m, atomCount);
  }

  function chooseAtomCount(count: number) {
    setAtomCount(count);
    startGame("infinite", count);
  }

  function fire(port: number) {
    if (done || marks.has(port)) return;
    const res = traceRay(atoms, port);
    const next = new Map(marks);
    if (res.type === "hit") next.set(port, { kind: "hit" });
    else if (res.type === "reflect" || res.port === port) next.set(port, { kind: "reflect" });
    else {
      const n = pairCount + 1;
      setPairCount(n);
      next.set(port, { kind: "pair", n });
      next.set(res.port, { kind: "pair", n });
    }
    setMarks(next);
  }

  function toggleGuess(cell: number) {
    if (done) return;
    setGuesses((g) => {
      const next = new Set(g);
      if (next.has(cell)) next.delete(cell);
      else if (next.size < atomsInPlay) next.add(cell);
      return next;
    });
  }

  function reveal() {
    if (done || guesses.size !== atomsInPlay) return;
    let wrong = 0;
    guesses.forEach((g) => {
      if (!atoms.has(g)) wrong += 1;
    });
    const score = marks.size + wrong * 5;
    let newBest = false;
    if (mode === "infinite") {
      const prev = localStorage.getItem(bestKey(atomCount));
      newBest = prev === null || score < Number(prev);
      if (newBest) {
        localStorage.setItem(bestKey(atomCount), String(score));
        setBest(score);
      }
    }
    setResult({ score, wrong, newBest });
  }

  const board = [];
  for (let r = -1; r <= N; r++) {
    for (let c = -1; c <= N; c++) {
      const key = `${r},${c}`;
      const onEdgeRow = r === -1 || r === N;
      const onEdgeCol = c === -1 || c === N;
      if (onEdgeRow && onEdgeCol) {
        board.push(<span key={key} className="bb-corner" aria-hidden />);
        continue;
      }
      if (onEdgeRow || onEdgeCol) {
        const p = portAt(r, c);
        const m = marks.get(p);
        board.push(
          <button
            key={key}
            className={`bb-port${m ? ` marked ${m.kind}` : ""}`}
            style={m?.kind === "pair" ? { color: PAIR_COLORS[(m.n - 1) % PAIR_COLORS.length] } : undefined}
            disabled={done || !!m}
            onClick={() => fire(p)}
            aria-label={m ? `Ray result: ${m.kind === "pair" ? `detour ${m.n}` : m.kind}` : "Fire a ray"}
            title={m ? undefined : "Fire a ray"}
          >
            {m ? (m.kind === "hit" ? "H" : m.kind === "reflect" ? "R" : m.n) : ""}
          </button>,
        );
        continue;
      }
      const idx = r * N + c;
      const isAtom = atoms.has(idx);
      const isGuess = guesses.has(idx);
      let cls = "bb-cell";
      let sym = "";
      if (!done) {
        if (isGuess) {
          cls += " on";
          sym = "●";
        }
      } else if (isGuess && isAtom) {
        cls += " good";
        sym = "●";
      } else if (isGuess) {
        cls += " bad";
        sym = "×";
      } else if (isAtom) {
        cls += " atom";
        sym = "●";
      }
      board.push(
        <button
          key={key}
          className={cls}
          disabled={done}
          onClick={() => toggleGuess(idx)}
          aria-label={isGuess ? "Remove atom guess" : "Mark atom guess"}
        >
          {sym}
        </button>,
      );
    }
  }

  return (
    <div className="wrap bb-wrap">
      <div className="brand">
        <div className="brandleft">
          <Link href="/" className="wordmark" title="All games">
            wren<b>.gg</b>
          </Link>
          <span className="crumb">/</span>
          <h1>blackbox</h1>
          <button
            className={`icon ${showHelp ? "on" : ""}`}
            title="How to play"
            aria-label="How to play"
            onClick={() => setShowHelp((h) => !h)}
          >
            <span className="ico-mask ico-help" />
          </button>
          <button className="icon" title="Toggle light / dark" aria-label="Toggle light / dark" onClick={toggleTheme}>
            <span className={`ico-mask ${light ? "ico-moon" : "ico-sun"}`} />
          </button>
        </div>
        <div className="topright">
          <div className="segmented bb-mode">
            <button className={mode === "daily" ? "on" : ""} onClick={() => switchMode("daily")}>
              Daily
            </button>
            <button className={mode === "infinite" ? "on" : ""} onClick={() => switchMode("infinite")}>
              Infinite
            </button>
          </div>
        </div>
      </div>

      {showHelp && (
        <div className="modal-backdrop" onClick={() => setShowHelp(false)}>
          <div className="statscard helpcard" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" aria-label="Close" onClick={() => setShowHelp(false)}>
              ×
            </button>
            <div className="helphead">How to play</div>
            <ul className="helplist">
              <li>
                <b>{atomsInPlay} atoms</b> are hiding in the box. Fire rays from the edge holes to find them.
              </li>
              <li>
                <b className="bb-key-hit">H</b> — hit. The ray ran straight into an atom and was absorbed.
              </li>
              <li>
                <b className="bb-key-reflect">R</b> — reflection. The ray came back out of the hole it entered.
              </li>
              <li>
                <b>Matching numbers</b> — the ray went in one hole and out another. Rays bend 90° away from any
                atom they would pass diagonally beside, so the path can be twisty.
              </li>
              <li>
                An atom sitting beside your entry hole reflects the ray before it even gets in.
              </li>
              <li>
                <b>Scoring is golf.</b> Every hole you use costs 1 point. When you&apos;re sure, mark {atomsInPlay}{" "}
                cells in the box and reveal — each wrong guess costs 5. Lowest score wins.
              </li>
              <li>
                <b>Daily</b> is the same box for everyone, one try per day. <b>Infinite</b> deals a fresh box
                whenever you like.
              </li>
            </ul>
          </div>
        </div>
      )}

      <div className="bb-status">
        {mode === "daily" ? (
          <span className="muted">
            daily <b>{dailyDate || "…"}</b>
          </span>
        ) : (
          best !== null && (
            <span className="muted">
              best <b>{best}</b>
            </span>
          )
        )}
        <span className="muted">
          ray points <b>{marks.size}</b>
        </span>
        <span className="muted">
          atoms marked{" "}
          <b>
            {guesses.size}/{atomsInPlay}
          </b>
        </span>
      </div>

      <div className="bb-board" style={{ gridTemplateColumns: `repeat(${N + 2}, var(--bb-cell))` }}>
        {board}
      </div>

      {result && (
        <p className="bb-result">
          Final score <b>{result.score}</b> — {marks.size} ray point{marks.size === 1 ? "" : "s"}
          {result.wrong > 0 && (
            <>
              {" "}
              + {result.wrong} wrong guess{result.wrong === 1 ? "" : "es"} × 5
            </>
          )}
          {result.wrong === 0 && <>, every atom found</>}
          {result.newBest && (
            <>
              {" "}
              — <b className="bb-newbest">new best!</b>
            </>
          )}
        </p>
      )}

      <div className="controls">
        {!done && (
          <button className="btn primary" disabled={guesses.size !== atomsInPlay} onClick={reveal}>
            Reveal atoms
          </button>
        )}
        {mode === "infinite" && (
          <>
            <button className={`btn${done ? " primary" : ""}`} onClick={() => startGame("infinite", atomCount)}>
              New game
            </button>
            <div className="segmented" title="Atoms hidden in the box">
              {ATOM_CHOICES.map((n) => (
                <button key={n} className={atomCount === n ? "on" : ""} onClick={() => chooseAtomCount(n)}>
                  {n} atoms
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {mode === "daily" && done && (
        <p className="hint" style={{ textAlign: "center" }}>
          that&apos;s today&apos;s box — come back tomorrow, or switch to infinite for a fresh one
        </p>
      )}
      {!done && guesses.size !== atomsInPlay && (
        <p className="hint" style={{ textAlign: "center" }}>
          fire rays from the edge, then tap {atomsInPlay} cells inside the box where you think the atoms are
        </p>
      )}
    </div>
  );
}
