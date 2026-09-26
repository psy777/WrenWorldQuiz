"use client";

import { useEffect, useMemo, useState } from "react";
import { listFound, type FoundWord } from "@/lib/local-store";
import DefinitionModal from "./DefinitionModal";

type SortKey = "az" | "pts" | "eff";
type Sort = { key: SortKey; dir: "asc" | "desc" } | null;
type Def = { word: string; frame?: FoundWord["frame"]; score?: number };

const COLS: { key: SortKey; label: string }[] = [
  { key: "az", label: "A–Z" },
  { key: "pts", label: "PTS" },
  { key: "eff", label: "EFF" },
];
const perLetter = (w: FoundWord) => w.score / Math.max(1, w.word.length);

export default function Dictionary() {
  const [words, setWords] = useState<FoundWord[] | null>(null);
  const [def, setDef] = useState<Def | null>(null);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>(null);

  useEffect(() => {
    setWords(listFound());
  }, []);

  // Click a column: off → asc → desc → off. Switching columns starts at asc.
  const cycle = (key: SortKey) =>
    setSort((cur) =>
      !cur || cur.key !== key ? { key, dir: "asc" } : cur.dir === "asc" ? { key, dir: "desc" } : null,
    );

  const shown = useMemo(() => {
    if (!words) return [];
    const needle = q.trim().toLowerCase();
    const list = needle ? words.filter((w) => w.word.includes(needle)) : [...words];
    if (!sort) return list; // off → natural order (most recent first)
    const m = sort.dir === "asc" ? 1 : -1;
    if (sort.key === "az") list.sort((a, b) => m * a.word.localeCompare(b.word));
    else if (sort.key === "pts") list.sort((a, b) => m * (a.score - b.score) || a.word.localeCompare(b.word));
    else list.sort((a, b) => m * (perLetter(a) - perLetter(b)) || a.word.localeCompare(b.word));
    return list;
  }, [words, q, sort]);

  if (!words) return <p className="muted">Loading your dictionary…</p>;

  return (
    <div className="stack">
      <div className="dicttools">
        <input
          className="dictsearch"
          placeholder="search your words…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="segmented">
          {COLS.map(({ key, label }) => {
            const active = sort?.key === key;
            return (
              <button
                key={key}
                className={active ? "on" : ""}
                onClick={() => cycle(key)}
                title={key === "eff" ? "Efficiency — points per letter" : undefined}
              >
                {label}
                {active ? (sort!.dir === "asc" ? " ↑" : " ↓") : ""}
              </button>
            );
          })}
        </div>
      </div>

      <div className="between">
        <span className="muted">
          {shown.length} of {words.length} {words.length === 1 ? "word" : "words"}
        </span>
      </div>

      {shown.length === 0 ? (
        <p className="muted">{words.length ? "No matches." : "No words yet — go find some, then review them here."}</p>
      ) : (
        <div className="dictgrid">
          {shown.map((w) => (
            <button
              key={w.word}
              className="dictword"
              onClick={() => setDef({ word: w.word, frame: w.frame, score: w.score })}
              title="Tap for its definition"
            >
              <span className="dw">{w.word}</span>
              <span className="ds" title={sort?.key === "eff" ? `${w.score} pts` : undefined}>
                {sort?.key === "eff" ? perLetter(w).toFixed(1) : w.score}
              </span>
            </button>
          ))}
        </div>
      )}

      {def && (
        <DefinitionModal
          word={def.word}
          frame={def.frame}
          score={def.score}
          onClose={() => setDef(null)}
          onPick={(w) => setDef({ word: w })}
        />
      )}
    </div>
  );
}
