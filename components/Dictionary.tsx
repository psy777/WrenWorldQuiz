"use client";

import { useEffect, useMemo, useState } from "react";
import { listFound } from "@/lib/local-store";
import DefinitionModal from "./DefinitionModal";

type Entry = { word: string; score: number; createdAt: number };
type Sort = "az" | "hi" | "lo";

export default function Dictionary() {
  const [words, setWords] = useState<Entry[] | null>(null);
  const [defWord, setDefWord] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("az");

  useEffect(() => {
    setWords(listFound());
  }, []);

  const shown = useMemo(() => {
    if (!words) return [];
    const needle = q.trim().toLowerCase();
    const list = needle ? words.filter((w) => w.word.includes(needle)) : [...words];
    if (sort === "az") list.sort((a, b) => a.word.localeCompare(b.word));
    else if (sort === "hi") list.sort((a, b) => b.score - a.score || a.word.localeCompare(b.word));
    else list.sort((a, b) => a.score - b.score || a.word.localeCompare(b.word));
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
          <button className={sort === "az" ? "on" : ""} onClick={() => setSort("az")}>
            A–Z
          </button>
          <button className={sort === "hi" ? "on" : ""} onClick={() => setSort("hi")}>
            pts ↓
          </button>
          <button className={sort === "lo" ? "on" : ""} onClick={() => setSort("lo")}>
            pts ↑
          </button>
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
            <button key={w.word} className="dictword" onClick={() => setDefWord(w.word)} title="Tap for its definition">
              <span className="dw">{w.word}</span>
              <span className="ds">{w.score}</span>
            </button>
          ))}
        </div>
      )}

      {defWord && <DefinitionModal word={defWord} onClose={() => setDefWord(null)} onPick={setDefWord} />}
    </div>
  );
}
