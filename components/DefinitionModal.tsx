"use client";

import { useEffect, useState } from "react";
import { jget } from "@/lib/api";

type DefData = { ok: boolean; word: string; defs: string[]; related: string[] };

// A popup card with a word's definition and tappable related words.
// `onPick` swaps the card to a related word so you can wander the thesaurus.
export default function DefinitionModal({
  word,
  exclude,
  onClose,
  onPick,
}: {
  word: string;
  exclude?: string;
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
