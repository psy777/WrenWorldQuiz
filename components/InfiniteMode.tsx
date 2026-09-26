"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { jget, jpost } from "@/lib/api";
import { letterValue, type Bonus } from "@/lib/scoring";
import { frameWords, recordFrame, saveFound } from "@/lib/local-store";
import DefinitionModal from "./DefinitionModal";

// A ring of particles. `n`/`dist` control how many and how far they fly.
function particles(n: number, dist: number) {
  return Array.from({ length: n }, (_, k) => {
    const ang = (k / n) * Math.PI * 2;
    const style = {
      "--dx": `${(Math.cos(ang) * dist).toFixed(1)}px`,
      "--dy": `${(Math.sin(ang) * dist).toFixed(1)}px`,
    } as CSSProperties;
    return <span key={k} className="particle" style={style} />;
  });
}

const Burst = ({ mult }: { mult: number }) => (
  <span className="burst" aria-hidden>
    {particles(mult >= 3 ? 16 : 9, mult >= 3 ? 46 : 30)}
  </span>
);

// A bigger burst over the whole board on submit; greener/larger for the top word.
const SubmitBurst = ({ top }: { top: boolean }) => (
  <span className={`submitburst ${top ? "top" : ""}`} aria-hidden>
    {particles(top ? 30 : 16, top ? 130 : 80)}
  </span>
);

type Frame = { start: string; end: string; len: number; total: number; best: number; bonuses: Bonus[] };
type Find = { word: string; score: number; rank: number; total: number; bonus: boolean; wordTier?: string };
type GuessResp =
  | { ok: false; reason: string }
  | {
      ok: true;
      word: string;
      score: number;
      rank: number;
      total: number;
      best: number;
      bonus: boolean;
      wordTier?: string;
    };
type HintResp = {
  ok: boolean;
  word?: string;
  synonym?: string;
  definition?: string;
  rhyme?: string | null;
  score?: number;
  rank?: number;
  total?: number;
  reason?: string;
};
type Hint = {
  word: string;
  synonym: string | null;
  definition: string | null;
  rhyme: string | null;
  score: number;
  rank: number;
  total: number;
};


type ResumeReq = { start: string; end: string; len: number; bonuses: { index: number; mult: number }[]; frameId: string };

// Keep in sync with DAILY_TIER in lib/dictionary.ts — the daily is played at a
// fixed tier so the frame and its answers are identical for everyone.
const DAILY_TIER = "10k";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function prettyDate(date: string): string {
  const [, m, d] = date.split("-").map(Number);
  return `${MONTHS[(m || 1) - 1]} ${d}`;
}

export default function InfiniteMode({
  showHelp,
  onCloseHelp,
  tier,
  multipliers,
  hintStyle,
  settingsOpen,
  onToggleSettings,
  resume,
  onResumeConsumed,
  onScore,
  onPoints,
  daily,
}: {
  showHelp: boolean;
  onCloseHelp: () => void;
  tier: string;
  multipliers: boolean;
  hintStyle: string;
  settingsOpen: boolean;
  onToggleSettings: () => void;
  resume: ResumeReq | null;
  onResumeConsumed: () => void;
  onScore: (total: number) => void;
  onPoints: (points: number) => void;
  daily: { date: string } | null;
}) {
  const [frame, setFrame] = useState<Frame | null>(null);
  const [typed, setTyped] = useState<string[]>([]);
  const [finds, setFinds] = useState<Find[]>([]);
  const [notice, setNotice] = useState<{ id: number; text: string; ok?: boolean } | null>(null);
  const [dailyNo, setDailyNo] = useState<number | null>(null);
  const [hint, setHint] = useState<Hint | null>(null);
  const [hintLoading, setHintLoading] = useState(false);
  const [statsClosed, setStatsClosed] = useState(false);
  const [defWord, setDefWord] = useState<{ word: string; exclude?: string } | null>(null);
  const [showBonus, setShowBonus] = useState(false);
  const [burst, setBurst] = useState<{ id: number; index: number; mult: number } | null>(null);
  const [flash, setFlash] = useState<{ id: number; top: boolean } | null>(null);
  const [barBurst, setBarBurst] = useState(0);
  const [submitPop, setSubmitPop] = useState<{ id: number; text: string } | null>(null);
  const seq = useRef(0);
  const frameId = useRef("");
  const frameStart = useRef(0); // ms timestamp the current frame opened
  const resumeRef = useRef(resume); // captured at mount; a frame-click remounts this component

  const midLen = frame ? frame.len - 2 : 0;

  const activeTier = daily ? DAILY_TIER : tier;

  const loadFrame = useCallback(async () => {
    setNotice(null);
    setHint(null);
    setStatsClosed(false);
    setTyped([]);
    setFinds([]);
    frameStart.current = Date.now();
    if (daily) {
      const fid = `daily-${daily.date}`;
      frameId.current = fid;
      const { data } = await jpost<Frame & { finds?: Find[]; number: number }>("/api/frame/daily", {
        date: daily.date,
        found: frameWords(fid),
      });
      setDailyNo(data.number);
      setFrame({ start: data.start, end: data.end, len: data.len, total: data.total, best: data.best, bonuses: data.bonuses ?? [] });
      setFinds(data.finds ?? []);
      return;
    }
    const r = resumeRef.current;
    if (r) {
      resumeRef.current = null; // consume, so a later New frame loads a random one
      onResumeConsumed();
      frameId.current = r.frameId;
      const { data } = await jpost<Frame & { finds?: Find[] }>("/api/frame/resume", {
        start: r.start,
        end: r.end,
        len: r.len,
        bonuses: r.bonuses,
        tier,
        found: frameWords(r.frameId),
      });
      setFrame({ start: data.start, end: data.end, len: data.len, total: data.total, best: data.best, bonuses: data.bonuses ?? [] });
      setFinds(data.finds ?? []);
      return;
    }
    frameId.current = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
    const { data } = await jget<Frame>(`/api/frame?tier=${tier}&multipliers=${multipliers ? "on" : "off"}`);
    setFrame({ ...data, bonuses: data.bonuses ?? [] });
  }, [tier, multipliers, onResumeConsumed, daily]);

  useEffect(() => {
    loadFrame();
  }, [loadFrame]);

  const submit = useCallback(async () => {
    if (!frame || typed.length !== midLen) {
      setNotice({ id: (seq.current += 1), text: "Fill every gap first." });
      return;
    }
    const word = (frame.start + typed.join("") + frame.end).toLowerCase();
    if (finds.some((f) => f.word === word)) {
      setNotice({ id: (seq.current += 1), text: `Already found ${word.toUpperCase()}.` });
      return;
    }
    const { data } = await jpost<GuessResp>("/api/frame/guess", {
      start: frame.start,
      end: frame.end,
      len: frame.len,
      word,
      bonuses: frame.bonuses,
      tier: activeTier,
    });
    if (!data.ok) {
      setNotice({ id: (seq.current += 1), text: data.reason });
      return;
    }
    const newFinds = [
      { word, score: data.score, rank: data.rank, total: data.total, bonus: data.bonus, wordTier: data.wordTier },
      ...finds,
    ];
    setFinds(newFinds);
    setTyped([]);
    setNotice(null);
    setFlash({ id: (seq.current += 1), top: data.rank === 1 });
    setSubmitPop({ id: (seq.current += 1), text: `${word.toUpperCase()} +${data.score} pts` });
    // extra points for time spent on the frame (+1 per 8s, capped)
    const timeBonus = Math.min(25, Math.floor((Date.now() - frameStart.current) / 8000));
    onPoints(data.score + timeBonus); // "+N pts" floats up by the profile
    if (data.bonus) setBarBurst((seq.current += 1)); // celebrate a bonus word on the finds bar
    const inTierFound = newFinds.filter((f) => !f.bonus).length;
    recordFrame({
      frameId: frameId.current,
      startLetter: frame.start,
      endLetter: frame.end,
      len: frame.len,
      bonuses: frame.bonuses,
      total: data.total,
      found: inTierFound,
      topFound: newFinds.some((f) => f.rank === 1),
      topWord: newFinds.find((f) => f.rank === 1)?.word ?? null,
      words: newFinds.map((f) => f.word),
    });
    const { totalScore } = saveFound(word, data.score, timeBonus, {
      start: frame.start,
      end: frame.end,
      len: frame.len,
      bonuses: frame.bonuses,
    });
    onScore(totalScore);
  }, [frame, typed, midLen, finds, activeTier, onScore, onPoints]);

  const getHint = useCallback(async () => {
    if (!frame) return;
    setHint(null);
    setHintLoading(true);
    const { data } = await jpost<HintResp>("/api/frame/hint", {
      start: frame.start,
      end: frame.end,
      len: frame.len,
      bonuses: frame.bonuses,
      found: finds.map((f) => f.word),
      tier: activeTier,
      style: hintStyle,
    });
    if (data.ok && (data.synonym || data.definition)) {
      setHint({
        word: data.word ?? "",
        synonym: data.synonym ?? null,
        definition: data.definition ?? null,
        rhyme: data.rhyme ?? null,
        score: data.score ?? 0,
        rank: data.rank ?? 0,
        total: data.total ?? 0,
      });
      setNotice(null);
    } else {
      setNotice({ id: (seq.current += 1), text: data.reason ?? "No hint available." });
    }
    setHintLoading(false);
  }, [frame, finds, activeTier, hintStyle]);

  const pickDef = useCallback((word: string) => setDefWord({ word }), []);

  const share = useCallback(async () => {
    if (!daily) return;
    const url = `${location.origin}/wordgap?d=${daily.date}`;
    const inTier = finds.filter((f) => !f.bonus).length;
    const top = finds.some((f) => f.rank === 1);
    const head = `wordgap · Daily${dailyNo ? ` #${dailyNo}` : ""}`;
    const line = `${inTier}/${frame?.total ?? 0} words${top ? " · found the top word 🏆" : ""}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "wordgap daily", text: `${head}\n${line}`, url });
        return;
      }
    } catch {
      /* user dismissed the share sheet — fall through to copy */
    }
    try {
      await navigator.clipboard.writeText(`${head} — ${line}\n${url}`);
      setNotice({ id: (seq.current += 1), text: "Link copied to clipboard.", ok: true });
    } catch {
      setNotice({ id: (seq.current += 1), text: url, ok: true });
    }
  }, [daily, dailyNo, finds, frame]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault(); // don't let Enter re-trigger a focused button (e.g. New frame)
        if (e.repeat) return;
        submit();
      } else if (e.key === "Backspace") {
        e.preventDefault();
        setTyped((t) => t.slice(0, -1));
        setNotice(null);
      } else if (/^[a-zA-Z]$/.test(e.key)) {
        if (!frame || typed.length >= midLen) return;
        const idx = typed.length + 1;
        const mult = frame.bonuses.find((b) => b.index === idx)?.mult;
        if (mult) setBurst({ id: (seq.current += 1), index: idx, mult });
        setTyped((t) => [...t, e.key.toUpperCase()]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [submit, midLen, typed, frame]);

  useEffect(() => {
    if (!burst) return;
    const t = setTimeout(() => setBurst(null), 650);
    return () => clearTimeout(t);
  }, [burst]);
  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 750);
    return () => clearTimeout(t);
  }, [flash]);
  useEffect(() => {
    if (!barBurst) return;
    const t = setTimeout(() => setBarBurst(0), 1000);
    return () => clearTimeout(t);
  }, [barBurst]);
  useEffect(() => {
    if (!submitPop) return;
    const t = setTimeout(() => setSubmitPop(null), 1000);
    return () => clearTimeout(t);
  }, [submitPop]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 2200);
    return () => clearTimeout(t);
  }, [notice]);

  if (!frame) return <p className="muted">Loading a frame…</p>;

  const bonusAt = new Map(frame.bonuses.map((b) => [b.index, b.mult]));
  const topFind = finds.find((f) => f.rank === 1);

  let liveScore = letterValue(frame.start) + letterValue(frame.end);
  typed.forEach((c, k) => (liveScore += letterValue(c) * (bonusAt.get(k + 1) ?? 1)));

  // per-word bar: this word's points as a share of the frame's best possible
  const pointsBar = (score: number) => (frame.best > 0 ? Math.min(100, Math.round((score / frame.best) * 100)) : 0);
  const bonusFinds = finds.filter((f) => f.bonus);
  const inTierFound = finds.length - bonusFinds.length;
  const wordsPct = frame.total > 0 ? Math.round((inTierFound / frame.total) * 100) : 0;

  return (
    <div className="infinite">
      {daily && (
        <div className="daily-banner">
          Daily{dailyNo ? ` #${dailyNo}` : ""} <span className="db-dot">·</span> {prettyDate(daily.date)}
        </div>
      )}
      <div className="playarea">
        <div className="tiles">
          {Array.from({ length: frame.len }).map((_, i) => {
            const isStart = i === 0;
            const isEnd = i === frame.len - 1;
            const fixed = isStart || isEnd;
            const ch = isStart ? frame.start : isEnd ? frame.end : typed[i - 1] ?? "";
            const active = !fixed && i - 1 === typed.length && typed.length < midLen;
            const mult = bonusAt.get(i);
            const bonusVar = mult === 3 ? "var(--tl)" : "var(--dl)";
            const cls = [
              "tile",
              fixed ? "fixed" : "",
              ch && !fixed ? "on" : "",
              active ? "active" : "",
              mult === 2 ? "dl" : mult === 3 ? "tl" : "",
            ]
              .filter(Boolean)
              .join(" ");
            return (
              <div key={i} className={cls}>
                {mult && !ch && (
                  <span className="bonus" title={mult === 3 ? "Triple letter" : "Double letter"}>
                    ×{mult}
                  </span>
                )}
                <span className="ch">{ch}</span>
                {ch && (
                  <span className={`val ${mult ? "boosted" : ""}`} style={mult ? { color: bonusVar } : undefined}>
                    {letterValue(ch) * (mult ?? 1)}
                  </span>
                )}
                {burst && burst.index === i && <Burst key={burst.id} mult={burst.mult} />}
              </div>
            );
          })}
          {flash && <SubmitBurst key={flash.id} top={flash.top} />}
        </div>

        <span className="submit-wrap">
          <button className="btn btn-sm" onClick={submit}>
            Submit <b>{liveScore}</b> pts
          </button>
          {submitPop && (
            <span className="submitpop" key={submitPop.id} aria-hidden>
              {submitPop.text}
            </span>
          )}
        </span>

      </div>

      {notice && (
        <div className={`toast ${notice.ok ? "ok" : ""}`} key={notice.id} role="alert">
          {!notice.ok && <span className="ico-mask ico-warn" />}
          {notice.text}
        </div>
      )}

      <div className="tools">
        <button
          className={`toolbtn ${settingsOpen ? "on" : ""}`}
          onClick={onToggleSettings}
          title="Game settings"
        >
          <span className="ico-mask ico-gear" />
          <span className="toollabel">Settings</span>
        </button>
        {daily ? (
          <button className="toolbtn" onClick={share} title="Share this daily">
            <span className="ico-mask ico-share" />
            <span className="toollabel">Share</span>
          </button>
        ) : (
          <button className="toolbtn" onClick={loadFrame} title="New frame">
            <span className="ico-mask ico-refresh" />
            <span className="toollabel">New frame</span>
          </button>
        )}
        <button className="toolbtn" onClick={getHint} title="Hint">
          <span className="ico-mask ico-hint" />
          <span className="toollabel">Hint</span>
        </button>
      </div>

      <div className="finds">
        <div className="between finds-head">
          <span className="fhcount">
            <span className="muted">your finds</span>
            <span className="fcbar-wrap">
              <span className="fcbar" title={`${inTierFound} of ${frame.total} words found`}>
                <span className="fcbar-fill" style={{ width: `${wordsPct}%` }} />
                <span className="fcbar-label">
                  {inTierFound}/{frame.total}
                </span>
              </span>
              {barBurst > 0 && (
                <span className="burst" key={barBurst} aria-hidden>
                  {particles(10, 26)}
                </span>
              )}
            </span>
            {bonusFinds.length > 0 && (
              <span className="bag-wrap">
                <button className="bagbtn" onClick={() => setShowBonus(true)} title="Bonus words found">
                  <span className="ico-mask ico-bag" />
                  <span className="bagcount">{bonusFinds.length}</span>
                </button>
                {barBurst > 0 && (
                  <span className="bonuspop" key={barBurst} aria-hidden>
                    Bonus Word!
                  </span>
                )}
              </span>
            )}
          </span>
        </div>

          {hintLoading && <div className="find hintrow muted">finding a hint…</div>}
          {hint &&
            (() => {
              const solved = finds.some((f) => f.word === hint.word);
              return (
                <div
                  className={`find hintrow ${solved ? "solved" : ""} ${hint.rank === 1 ? "top" : ""}`}
                  onClick={() => {
                    if (solved) setDefWord({ word: hint.word });
                    else if (hint.synonym) setDefWord({ word: hint.synonym, exclude: hint.word });
                  }}
                  title={solved || hint.synonym ? "Tap for its definition" : undefined}
                >
                  <span className="w">
                    {solved ? (
                      hint.word
                    ) : (
                      <>
                        {hint.definition ? (
                          <span className="hintdef">“{hint.definition}”</span>
                        ) : (
                          <em>{hint.synonym}</em>
                        )}
                        {hint.rhyme && <span className="rhymenote">rhymes with “{hint.rhyme}”</span>}
                      </>
                    )}
                  </span>
                  <span className="sc">
                    <b>{hint.score}</b> pts
                  </span>
                  <span className="bar">
                    <span className="bar-fill" style={{ width: `${pointsBar(hint.score)}%` }} />
                    <span className="bar-label">
                      {hint.score}/{frame.best}
                    </span>
                  </span>
                </div>
              );
            })()}

          {[...finds]
            .filter((f) => !f.bonus && (!hint || f.word !== hint.word))
            .sort((a, b) => b.score - a.score || a.word.localeCompare(b.word))
            .map((f) => (
              <div
                key={f.word}
                className={`find clickable ${f.rank === 1 ? "top" : ""}`}
                onClick={() => setDefWord({ word: f.word })}
                title="Tap for its definition"
              >
                <span className="w">{f.word}</span>
                <span className="sc">
                  <b>{f.score}</b> pts
                </span>
                <span className="bar">
                  <span className="bar-fill" style={{ width: `${pointsBar(f.score)}%` }} />
                  <span className="bar-label">
                    {f.score}/{frame.best}
                  </span>
                </span>
              </div>
            ))}
      </div>

      {topFind && !statsClosed && (
        <div className="modal-backdrop" onClick={() => setStatsClosed(true)}>
          <div className="statscard" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" aria-label="Close" onClick={() => setStatsClosed(true)}>
              ×
            </button>
            <div className="big">Top word! 🏆</div>
            <p className="muted" style={{ margin: "6px 0 14px" }}>
              <b style={{ color: "var(--ink)" }}>{topFind.word.toUpperCase()}</b> is the highest-scoring word that fits
              this frame — {topFind.score} pts.
            </p>
            <div className="statrow">
              <div>
                <b>{finds.length}</b>
                <span>guesses</span>
              </div>
              <div>
                <b>{frame.best}</b>
                <span>top score</span>
              </div>
              <div>
                <b>{frame.total}</b>
                <span>words fit</span>
              </div>
            </div>
            <div className="statbtns">
              {inTierFound < frame.total && (
                <button className="btn" onClick={() => setStatsClosed(true)}>
                  Continue
                </button>
              )}
              {daily ? (
                <button className="btn primary" onClick={share}>
                  Share result
                </button>
              ) : (
                <button className="btn primary" onClick={loadFrame}>
                  Next frame →
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {showBonus && (
        <div className="modal-backdrop" onClick={() => setShowBonus(false)}>
          <div className="statscard bonuscard" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" aria-label="Close" onClick={() => setShowBonus(false)}>
              ×
            </button>
            <div className="helphead">
              Bonus words <span className="bonuscount">· {bonusFinds.length}</span>
            </div>
            <p className="muted" style={{ margin: "0 0 12px", fontSize: 13 }}>
              Words that fit but sit outside the {activeTier} dictionary. Tap one for its definition.
            </p>
            <div className="bonuslist">
              {bonusFinds
                .slice()
                .sort((a, b) => b.score - a.score)
                .map((f) => (
                  <button key={f.word} className="bonusitem" onClick={() => setDefWord({ word: f.word })}>
                    <span className="w">
                      {f.word}
                      {f.wordTier && <span className="bonusdict">{f.wordTier}</span>}
                    </span>
                    <span className="sc">
                      <b>{f.score}</b> pts
                    </span>
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}

      {defWord && (
        <DefinitionModal
          word={defWord.word}
          exclude={defWord.exclude}
          onClose={() => setDefWord(null)}
          onPick={pickDef}
        />
      )}

      {showHelp && (
        <div className="modal-backdrop" onClick={onCloseHelp}>
          <div className="statscard helpcard" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" aria-label="Close" onClick={onCloseHelp}>
              ×
            </button>
            <div className="helphead">How to play</div>
            <ul className="helplist">
              <li>
                <b>Fill the gap.</b> Same start, same end, same length — every real word that fits counts.
              </li>
              <li>
                <b>Rare letters win.</b> Each letter has its own value (shown in the corner) — Z, Q and X score highest.
              </li>
              <li>
                <b>
                  <span className="chip-dl">×2</span> / <span className="chip-tl">×3</span> tiles
                </b>{" "}
                multiply the letter that lands on them.
              </li>
              <li>
                <b>Hint</b> gives a synonym, a rhyme and where the next-best word ranks. Tap any word for its definition.
              </li>
              <li>
                <b>Find the top word</b> to bank the frame and unlock a new one. Every word you find adds points.
              </li>
            </ul>
            <div className="helpkeys">
              <kbd>A–Z</kbd> type · <kbd>⌫</kbd> erase · <kbd>⏎</kbd> submit
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
