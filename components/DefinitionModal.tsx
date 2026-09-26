"use client";

import { useEffect, useState } from "react";
import { jget } from "@/lib/api";
import type { WordFrame } from "@/lib/local-store";

type DefData = { ok: boolean; word: string; defs: string[]; related: string[] };

// A popup card with a word's definition and tappable related words.
// `onPick` swaps the card to a related word so you can wander the thesaurus.
// `frame`/`score`, when given, show the frame where the best score was earned.
export default function DefinitionModal({
  word,
  exclude,
  frame,
  score,
  onClose,
  onPick,
}: {
  word: string;
  exclude?: string;
  frame?: WordFrame;
  score?: number;
  onClose: () => void;
  onPick: (w: string) => void;
}) {
  const [data, setData] = useState<DefData | null>(null);

  useEffect(() => {
    let live = true;
    setData(null);
    jget<DefData>(`/api/define?word=${encodeURIComponent(word)}`).then(({ data }) => live && setData(data));
    return () => {
      live = false;
    };
  }, [word]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="statscard defcard" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" aria-label="Close" onClick={onClose}>
          ×
        </button>
        <div className="big defword">{word}</div>
        {frame && frame.len === word.length && (
          <div className="defframe-wrap">
            <div className="defframe-label">
              your best{typeof score === "number" ? <> — <b>{score}</b> pts</> : ""}
            </div>
            <div className="ftiles defframe">
              {word.split("").map((ch, i) => {
                const m = frame.bonuses.find((b) => b.index === i)?.mult;
                return (
                  <span key={i} className={`ftile ${m === 2 ? "dl" : m === 3 ? "tl" : ""}`}>
                    {ch.toUpperCase()}
                    {m ? <span className="dfmx">×{m}</span> : null}
                  </span>
                );
              })}
            </div>
          </div>
        )}
        {!data ? (
          <p className="muted">looking it up…</p>
        ) : (
          <>
            {data.defs.length ? (
              <ul className="deflist">
                {data.defs.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            ) : (
              <p className="muted">No definition found.</p>
            )}
            {(() => {
              const related = data.related.filter((w) => !exclude || w.toLowerCase() !== exclude.toLowerCase());
              return related.length > 0 ? (
                <div className="synrow">
                  <span className="muted">related</span>
                  <div className="chips">
                    {related.map((s) => (
                      <button key={s} className="chip" onClick={() => onPick(s)}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null;
            })()}
          </>
        )}
      </div>
    </div>
  );
}
