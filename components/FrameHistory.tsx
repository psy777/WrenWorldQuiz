"use client";

import { useEffect, useState } from "react";
import { jget } from "@/lib/api";

type FrameRow = {
  frameId: string;
  startLetter: string;
  endLetter: string;
  len: number;
  bonuses: string;
  total: number;
  found: number;
  topFound: number;
  topWord: string | null;
};
type ResumeReq = { start: string; end: string; len: number; bonuses: { index: number; mult: number }[]; frameId: string };

export default function FrameHistory({ onSelect }: { onSelect: (r: ResumeReq) => void }) {
  const [frames, setFrames] = useState<FrameRow[] | null>(null);

  useEffect(() => {
    jget<{ ok: boolean; frames: FrameRow[] }>("/api/history").then(({ data }) => setFrames(data.frames ?? []));
  }, []);

  if (!frames) return <p className="muted">Loading history…</p>;
  if (!frames.length) return <p className="muted">No frames played yet — go find some words!</p>;

  return (
    <div className="fhist">
      <div className="muted" style={{ marginBottom: 8 }}>
        frame history · {frames.length}
      </div>
      {frames.map((r) => {
        let bonuses: { index: number; mult: number }[] = [];
        try {
          bonuses = JSON.parse(r.bonuses);
        } catch {
          /* ignore */
        }
        const mult = new Map(bonuses.map((b) => [b.index, b.mult]));
        const pct = r.total > 0 ? Math.round((r.found / r.total) * 100) : 0;
        const solved = !!(r.topFound && r.topWord);
        const top = (r.topWord ?? "").toUpperCase();
        return (
          <div
            key={r.frameId}
            className="frow"
            onClick={() => onSelect({ start: r.startLetter, end: r.endLetter, len: r.len, bonuses, frameId: r.frameId })}
            title="Continue playing this frame"
          >
            <span className="ftiles">
              {Array.from({ length: r.len }).map((_, i) => {
                if (solved) {
                  return (
                    <span key={i} className="ftile solved">
                      {top[i] ?? ""}
                    </span>
                  );
                }
                const m = mult.get(i);
                const label = i === 0 ? r.startLetter : i === r.len - 1 ? r.endLetter : m ? `×${m}` : "";
                return (
                  <span key={i} className={`ftile ${m === 2 ? "dl" : m === 3 ? "tl" : ""}`}>
                    {label}
                  </span>
                );
              })}
            </span>
            <span className="frow-right">
              <span className="fbar" title={`${r.found} of ${r.total} words`}>
                <span className="fbar-fill" style={{ width: `${pct}%` }} />
                <span className="fbar-label">
                  {r.found}/{r.total}
                </span>
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );
}
