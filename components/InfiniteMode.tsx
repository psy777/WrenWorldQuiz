"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { jget, jpost } from "@/lib/api";
import { letterValue, type Bonus } from "@/lib/scoring";
import { addReveal, addScore, frameWords, getFrame, getReveals, markFrameSeen, recordFrame, saveFound } from "@/lib/local-store";
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
    {particles(top ? 46 : 16, top ? 170 : 80)}
  </span>
);

// The biggest celebration — filling the whole frame.
const CompleteBurst = () => (
  <span className="completeburst" aria-hidden>
    {particles(72, 260)}
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
// One row of the always-visible clue list: an in-tier answer and its clue text
// (null when Datamuse had nothing usable — the row still shows, mask only).
type Clue = { word: string; clue: string | null; score: number; rank: number };
type CluesResp = { ok: boolean; clues?: Clue[]; reason?: string };


type ResumeReq = { start: string; end: string; len: number; bonuses: { index: number; mult: number }[]; frameId: string };

// Keep in sync with DAILY_TIER in lib/dictionary.ts — the daily is played at a
// fixed tier so the frame and its answers are identical for everyone.
const DAILY_TIER = "10k";
// Completion bonus scales with how hard the frame is to fill: more words and
// longer words = harder. ~1000 for a typical 8-word, 5-letter frame.
const completionBonus = (total: number, len: number) => Math.round((total * len * 25) / 10) * 10;
// Points a permanently revealed letter costs (the Reveal button).
const REVEAL_COST = 25;
// On-screen keyboard rows — taps are plain button clicks, so typing works on
// any touch device without soft-keyboard tricks.
const KB_ROWS = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];
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
  // Clue list and bought-letter counts, tagged with the frame they belong to —
  // a box from a previous frame simply reads as "not loaded yet".
  const [cluesBox, setCluesBox] = useState<{ frame: Frame; style: string; list: Clue[] } | null>(null);
  const [revealsBox, setRevealsBox] = useState<{ frame: Frame; counts: Record<string, number> } | null>(null);
  const [statsClosed, setStatsClosed] = useState(false);
  const [completeClosed, setCompleteClosed] = useState(false);
  const [defWord, setDefWord] = useState<{ word: string; exclude?: string } | null>(null);
  const [showBonus, setShowBonus] = useState(false);
  const [burst, setBurst] = useState<{ id: number; index: number; mult: number } | null>(null);
  const [flash, setFlash] = useState<{ id: number; top: boolean } | null>(null);
  const [completeBurst, setCompleteBurst] = useState(0);
  const [barBurst, setBarBurst] = useState(0);
  const [submitPop, setSubmitPop] = useState<{ id: number; text: string } | null>(null);
  const seq = useRef(0);
  const frameId = useRef("");
  const frameStart = useRef(0); // ms timestamp the current frame opened
  const resumeRef = useRef(resume); // captured at mount; a frame-click remounts this component

  const midLen = frame ? frame.len - 2 : 0;

  const activeTier = daily ? DAILY_TIER : tier;

  // null until the fetch for *this* frame (and clue style) lands. Reveals are
  // seeded from local storage in the same callback, so clues ≠ null ⇒ reveals ≠ null.
  const clues = cluesBox && cluesBox.frame === frame && cluesBox.style === hintStyle ? cluesBox.list : null;
  const reveals = revealsBox && revealsBox.frame === frame ? revealsBox.counts : null;

  // `fresh` = the player asked for a new random frame (New / Next frame). Without it
  // we honour a pending resume. We DON'T consume resumeRef here, so React's dev
  // double-invoke of this effect can't fall through to a random frame.
  const loadFrame = useCallback(async (fresh = false) => {
    setNotice(null);
    setStatsClosed(false);
    setCompleteClosed(false);
    setTyped([]);
    setFinds([]);
    frameStart.current = Date.now();
    if (fresh) resumeRef.current = null;
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
      const rec = getFrame(fid);
      setStatsClosed(!!rec?.topSeen);
      setCompleteClosed(!!rec?.doneSeen);
      return;
    }
    const r = resumeRef.current;
    if (r) {
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
      const rec = getFrame(r.frameId);
      setStatsClosed(!!rec?.topSeen);
      setCompleteClosed(!!rec?.doneSeen);
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
    if (data.bonus) setBarBurst((seq.current += 1)); // celebrate a bonus word on the finds bar
    const prevInTier = finds.filter((f) => !f.bonus).length;
    const inTierFound = newFinds.filter((f) => !f.bonus).length;
    // Filling the whole frame is the goal — award a one-time bonus on the completing
    // move only (not again for a bonus word found after the frame is already full).
    const justCompleted = data.total > 0 && prevInTier < data.total && inTierFound === data.total;
    const bonus = justCompleted ? completionBonus(data.total, frame.len) : 0;
    if (justCompleted) {
      setCompleteBurst((seq.current += 1));
      setCompleteClosed(false);
      addScore(bonus);
    }
    onPoints(data.score + timeBonus + bonus); // "+N pts" floats up by the profile
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

  // Every word's clue is on screen from the start — fetch the whole list when
  // the frame (or the clue style setting) changes.
  useEffect(() => {
    if (!frame) return;
    let stale = false;
    const fid = frameId.current;
    const land = (list: Clue[]) => {
      if (stale) return;
      setCluesBox({ frame, style: hintStyle, list });
      setRevealsBox((r) => (r && r.frame === frame ? r : { frame, counts: getReveals(fid) }));
    };
    jpost<CluesResp>("/api/frame/clues", {
      start: frame.start,
      end: frame.end,
      len: frame.len,
      bonuses: frame.bonuses,
      tier: activeTier,
      style: hintStyle,
    })
      .then(({ data }) => land(data.ok && data.clues ? data.clues : []))
      .catch(() => land([])); // offline — the finds list still works without clues
    return () => {
      stale = true;
    };
  }, [frame, activeTier, hintStyle]);

  // The Reveal button: buy the next letter (left to right) of the highest-scoring
  // unfound word. Revealed letters persist for the frame's lifetime.
  const revealLetter = () => {
    if (!frame || !clues) {
      setNotice({ id: (seq.current += 1), text: "Clues are still loading…" });
      return;
    }
    if (!clues.length) {
      setNotice({ id: (seq.current += 1), text: "Clues aren't available right now." });
      return;
    }
    const foundSet = new Set(finds.map((f) => f.word));
    const target = clues.find((c) => !foundSet.has(c.word) && (reveals?.[c.word] ?? 0) < frame.len - 2);
    if (!target) {
      setNotice({ id: (seq.current += 1), text: "Nothing left to reveal!" });
      return;
    }
    const n = addReveal(frameId.current, target.word);
    setRevealsBox({ frame, counts: { ...(reveals ?? {}), [target.word]: n } });
    onScore(addScore(-REVEAL_COST));
    onPoints(-REVEAL_COST);
  };

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

  // Append one letter, firing a burst if it lands on a multiplier tile. Shared by
  // the physical-keyboard listener and the mobile hidden-input handler.
  const addChar = useCallback(
    (key: string) => {
      setTyped((t) => {
        if (!frame || t.length >= midLen) return t;
        const idx = t.length + 1;
        const mult = frame.bonuses.find((b) => b.index === idx)?.mult;
        if (mult) setBurst({ id: (seq.current += 1), index: idx, mult });
        return [...t, key.toUpperCase()];
      });
    },
    [frame, midLen],
  );
  const backspace = useCallback(() => {
    setTyped((t) => t.slice(0, -1));
    setNotice(null);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault(); // don't let Enter re-trigger a focused button (e.g. New frame)
        if (e.repeat) return;
        submit();
      } else if (e.key === "Backspace") {
        e.preventDefault();
        backspace();
      } else if (/^[a-zA-Z]$/.test(e.key)) {
        addChar(e.key);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [submit, addChar, backspace]);

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
    if (!completeBurst) return;
    const t = setTimeout(() => setCompleteBurst(0), 1400);
    return () => clearTimeout(t);
  }, [completeBurst]);
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
  const frameComplete = frame.total > 0 && inTierFound === frame.total;
  // When the frame is done and you're not mid-word, display the winning word in the tiles.
  const showTop = frameComplete && typed.length === 0 && !!topFind;
  const framePoints = finds.reduce((s, f) => s + f.score, 0); // total points earned on this frame
  const frameBonus = completionBonus(frame.total, frame.len); // scales with frame difficulty

  const findRow = (f: Find) => (
    <div
      key={f.word}
      className={`find clickable ${f.rank === 1 ? "top" : ""}`}
      onClick={() => setDefWord({ word: f.word })}
      title="Tap for its definition"
    >
      <span className="w">
        {f.word}
        {f.rank === 1 && <span className="topmark" title="Top word">🏆</span>}
      </span>
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
  );

  const dismissTop = () => {
    setStatsClosed(true);
    markFrameSeen(frameId.current, { topSeen: true });
  };
  const dismissComplete = () => {
    setCompleteClosed(true);
    markFrameSeen(frameId.current, { doneSeen: true });
  };

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
            // Once the frame is filled, show the top word across the tiles (like the
            // solved frames in history) — but yield to live typing for bonus words.
            const solved = showTop;
            const ch = isStart
              ? frame.start
              : isEnd
                ? frame.end
                : solved && topFind
                  ? topFind.word[i].toUpperCase()
                  : typed[i - 1] ?? "";
            const active = !fixed && !solved && i - 1 === typed.length && typed.length < midLen;
            const mult = bonusAt.get(i);
            const bonusVar = mult === 3 ? "var(--tl)" : "var(--dl)";
            const cls = [
              "tile",
              fixed ? "fixed" : "",
              ch && !fixed ? "on" : "",
              active ? "active" : "",
              solved ? "solved" : "",
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
                {ch && !solved && (
                  <span className={`val ${mult ? "boosted" : ""}`} style={mult ? { color: bonusVar } : undefined}>
                    {letterValue(ch) * (mult ?? 1)}
                  </span>
                )}
                {burst && burst.index === i && <Burst key={burst.id} mult={burst.mult} />}
              </div>
            );
          })}
          {flash && <SubmitBurst key={flash.id} top={flash.top} />}
          {completeBurst > 0 && <CompleteBurst key={completeBurst} />}
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

        <div className="kb">
          {KB_ROWS.map((row, r) => (
            <div className="kbrow" key={r}>
              {/* blur() so a later physical Enter/Space doesn't re-fire the tapped key */}
              {r === 2 && (
                <button
                  className="kbkey kbwide"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    submit();
                  }}
                >
                  ENTER
                </button>
              )}
              {[...row].map((k) => (
                <button
                  key={k}
                  className="kbkey"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    addChar(k);
                  }}
                >
                  {k}
                </button>
              ))}
              {r === 2 && (
                <button
                  className="kbkey kbwide"
                  aria-label="Backspace"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    backspace();
                  }}
                >
                  ⌫
                </button>
              )}
            </div>
          ))}
        </div>
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
          <button className="toolbtn" onClick={() => loadFrame(true)} title="New frame">
            <span className="ico-mask ico-refresh" />
            <span className="toollabel">New frame</span>
          </button>
        )}
        <button
          className="toolbtn"
          onClick={revealLetter}
          title={`Reveal a letter of the best unfound word (−${REVEAL_COST} pts)`}
        >
          <span className="ico-mask ico-hint" />
          <span className="toollabel">Reveal −{REVEAL_COST}</span>
        </button>
      </div>

      <div className="finds">
        <div className="between finds-head">
          <span className="fhcount">
            <span className="muted">your finds</span>
            <span className="fcbar-wrap">
              <span
                className={`fcbar ${frameComplete ? "done" : ""}`}
                title={frameComplete ? "Frame complete — every word found!" : `${inTierFound} of ${frame.total} words found`}
              >
                <span className="fcbar-fill" style={{ width: `${wordsPct}%` }} />
                <span className="fcbar-label">
                  {frameComplete ? `✓ ${inTierFound}/${frame.total}` : `${inTierFound}/${frame.total}`}
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

          {clues === null && <div className="find hintrow muted">loading clues…</div>}

          {/* Every in-tier word gets a row up front: a clue row while unfound
              (mask + clue text), swapping to the normal find row once guessed. */}
          {clues?.length
            ? clues.map((c) => {
                const f = finds.find((x) => x.word === c.word);
                if (f) return findRow(f);
                const shown = reveals?.[c.word] ?? 0;
                const synClick = hintStyle !== "definition" && c.clue;
                return (
                  <div
                    key={c.word}
                    className={`find hintrow ${c.rank === 1 ? "top" : ""}`}
                    onClick={synClick ? () => setDefWord({ word: c.clue!, exclude: c.word }) : undefined}
                    title={synClick ? "Tap for the synonym's definition" : undefined}
                  >
                    <span className="cluemask" aria-hidden>
                      <b className="fix">{frame.start}</b>
                      {Array.from({ length: frame.len - 2 }, (_, k) => (
                        <b key={k} className={k < shown ? "rev" : ""}>
                          {k < shown ? c.word[k + 1] : "·"}
                        </b>
                      ))}
                      <b className="fix">{frame.end}</b>
                    </span>
                    <span className="w">
                      {c.clue ? (
                        hintStyle === "definition" ? (
                          <span className="hintdef">“{c.clue}”</span>
                        ) : (
                          <em>{c.clue}</em>
                        )
                      ) : (
                        <span className="hintdef">no clue for this one — a rare word</span>
                      )}
                    </span>
                    <span className="sc">
                      <b>{c.score}</b> pts
                    </span>
                    <span className="bar">
                      <span className="bar-fill" style={{ width: `${pointsBar(c.score)}%` }} />
                      <span className="bar-label">
                        {c.score}/{frame.best}
                      </span>
                    </span>
                  </div>
                );
              })
            : // clues unavailable (offline / API down) — plain finds list still works
              [...finds]
                .filter((f) => !f.bonus)
                .sort((a, b) => b.score - a.score || a.word.localeCompare(b.word))
                .map(findRow)}
      </div>

      {topFind && !statsClosed && !frameComplete && (
        <div className="modal-backdrop" onClick={dismissTop}>
          <div className="statscard" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" aria-label="Close" onClick={dismissTop}>
              ×
            </button>
            <div className="big">Top word! 🏆</div>
            <p className="muted" style={{ margin: "6px 0 14px" }}>
              <b style={{ color: "var(--ink)" }}>{topFind.word.toUpperCase()}</b> is the highest-scoring word that fits
              this frame — {topFind.score} pts. Now fill the rest:{" "}
              <b style={{ color: "var(--ink)" }}>{frame.total - inTierFound}</b> to go.
            </p>
            <div className="statrow">
              <div>
                <b>
                  {inTierFound}/{frame.total}
                </b>
                <span>words found</span>
              </div>
              <div>
                <b>{framePoints}</b>
                <span>points so far</span>
              </div>
              <div>
                <b>{frame.best}</b>
                <span>top score</span>
              </div>
            </div>
            <div className="statbtns">
              <button className="btn primary" onClick={dismissTop}>
                Keep filling →
              </button>
              {daily ? (
                <button className="btn" onClick={share}>
                  Share
                </button>
              ) : (
                <button className="btn" onClick={() => loadFrame(true)}>
                  New frame
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {frameComplete && !completeClosed && (
        <div className="modal-backdrop" onClick={dismissComplete}>
          <div className="statscard" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" aria-label="Close" onClick={dismissComplete}>
              ×
            </button>
            <div className="big">Frame complete! 🎉</div>
            <p className="muted" style={{ margin: "6px 0 14px" }}>
              You found every word that fits{" "}
              <b style={{ color: "var(--ink)" }}>
                {frame.start}
                {"·".repeat(Math.max(1, frame.len - 2))}
                {frame.end}
              </b>
              {bonusFinds.length > 0 ? <> — plus {bonusFinds.length} bonus.</> : "."}
            </p>
            <div className="statrow">
              <div>
                <b>{framePoints + frameBonus}</b>
                <span>total points</span>
              </div>
              <div>
                <b>+{frameBonus}</b>
                <span>frame bonus</span>
              </div>
              <div>
                <b>{frame.total}</b>
                <span>words</span>
              </div>
            </div>
            <div className="statbtns">
              {daily ? (
                <button className="btn primary" onClick={share}>
                  Share result
                </button>
              ) : (
                <button className="btn primary" onClick={() => loadFrame(true)}>
                  Next frame →
                </button>
              )}
              <button className="btn" onClick={dismissComplete}>
                Close
              </button>
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
                <b>Every word&apos;s clue</b> is listed below the frame. <b>Reveal</b> buys a letter of the best unfound
                word for {REVEAL_COST} pts. Tap any found word for its definition.
              </li>
              <li>
                <b>Fill the whole frame</b> — find every word that fits. The top word earns a 🏆; completing the frame is
                the goal. Every word you find adds points.
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
