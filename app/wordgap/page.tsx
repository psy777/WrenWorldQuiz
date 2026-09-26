"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import InfiniteMode from "@/components/InfiniteMode";
import Dictionary from "@/components/Dictionary";
import FrameHistory from "@/components/FrameHistory";
import { getTotalScore, resetProgress } from "@/lib/local-store";

type Tab = "play" | "history" | "dictionary";
type Mode = "daily" | "infinite";
type ResumeReq = { start: string; end: string; len: number; bonuses: { index: number; mult: number }[]; frameId: string };
const TIERS = ["1k", "5k", "10k", "20k", "100k", "450k"] as const;

// 589300 -> "589.3K"; small numbers stay whole.
function fmtPoints(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}K`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}

// Local calendar date as YYYY-MM-DD — the day everyone shares.
function todayKey(): string {
  const n = new Date();
  const p = (x: number) => String(x).padStart(2, "0");
  return `${n.getFullYear()}-${p(n.getMonth() + 1)}-${p(n.getDate())}`;
}

export default function Home() {
  const [score, setScore] = useState(0);
  const [tab, setTab] = useState<Tab>("play");
  const [mode, setMode] = useState<Mode>("daily");
  const [dailyDate, setDailyDate] = useState("");
  const [showHelp, setShowHelp] = useState(false);
  const [light, setLight] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tier, setTier] = useState<string>("10k");
  const [multipliers, setMultipliers] = useState(true);
  const [hintStyle, setHintStyle] = useState<string>("synonym");
  const [resume, setResume] = useState<ResumeReq | null>(null);
  const clearResume = useCallback(() => setResume(null), []);
  const [pointsPop, setPointsPop] = useState<{ id: number; pts: number } | null>(null);
  const popId = useRef(0);

  useEffect(() => {
    if (!pointsPop) return;
    const t = setTimeout(() => setPointsPop(null), 1000);
    return () => clearTimeout(t);
  }, [pointsPop]);

  useEffect(() => {
    setScore(getTotalScore());
    const stored = localStorage.getItem("wg_theme") === "light";
    setLight(stored);
    document.documentElement.setAttribute("data-theme", stored ? "light" : "dark");
    const t = localStorage.getItem("wg_tier");
    if (t && (TIERS as readonly string[]).includes(t)) setTier(t);
    setMultipliers(localStorage.getItem("wg_mult") !== "off"); // multipliers on by default
    if (localStorage.getItem("wg_hint") === "definition") setHintStyle("definition");
    // A shared link (?d=YYYY-MM-DD) opens that exact daily; otherwise today's.
    const shared = new URLSearchParams(window.location.search).get("d");
    setDailyDate(shared && /^\d{4}-\d{2}-\d{2}$/.test(shared) ? shared : todayKey());
  }, []);

  const dailyProp = useMemo(
    () => (mode === "daily" && dailyDate ? { date: dailyDate } : null),
    [mode, dailyDate],
  );

  function toggleTheme() {
    setLight((l) => {
      const next = !l;
      document.documentElement.setAttribute("data-theme", next ? "light" : "dark");
      localStorage.setItem("wg_theme", next ? "light" : "dark");
      return next;
    });
  }

  function chooseTier(t: string) {
    setTier(t);
    localStorage.setItem("wg_tier", t);
  }
  function chooseMultipliers(on: boolean) {
    setMultipliers(on);
    localStorage.setItem("wg_mult", on ? "on" : "off");
  }
  function chooseHintStyle(v: string) {
    setHintStyle(v);
    localStorage.setItem("wg_hint", v);
  }

  function clearProgress() {
    if (!confirm("Erase all your words, points and frame history on this device?")) return;
    resetProgress();
    setScore(0);
    setMenuOpen(false);
    setTab("play");
  }

  return (
    <div className="wrap">
      <div className="brand">
        <div className="brandleft">
          <Link href="/" className="wordmark" title="All games">
            wren<b>.gg</b>
          </Link>
          <span className="crumb">/</span>
          <h1 onClick={() => setTab("play")} style={{ cursor: "pointer" }} title="Home">
            wordgap
          </h1>
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
          <div className="who">
            <div className="menu">
              <button
                className="menu-btn"
                onClick={() => setMenuOpen((o) => !o)}
                aria-haspopup="true"
                aria-expanded={menuOpen}
                title="Your progress"
              >
                <span className="username" title={`${score.toLocaleString()} points`}>
                  {fmtPoints(score)} pts
                </span>
                <span className="ico-mask ico-menu" />
              </button>
              {pointsPop && (
                <span className="pointspop" key={pointsPop.id} aria-hidden>
                  +{pointsPop.pts}
                </span>
              )}
              {menuOpen && (
                <>
                  <div className="menu-scrim" onClick={() => setMenuOpen(false)} />
                  <div className="menu-pop">
                    <div className="menu-head">
                      <b>your progress</b>
                      <span title={`${score.toLocaleString()} points`}>{fmtPoints(score)} pts</span>
                    </div>
                    <button
                      className="menu-item"
                      onClick={() => {
                        setTab("dictionary");
                        setMenuOpen(false);
                      }}
                    >
                      Dictionary
                    </button>
                    <button
                      className="menu-item"
                      onClick={() => {
                        setTab("history");
                        setMenuOpen(false);
                      }}
                    >
                      Frame history
                    </button>
                    <button className="menu-item" onClick={clearProgress}>
                      Reset progress
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {tab === "play" && settingsOpen && (
        <div className="modal-backdrop" onClick={() => setSettingsOpen(false)}>
          <div className="statscard settingscard" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" aria-label="Close" onClick={() => setSettingsOpen(false)}>
              ×
            </button>
            <div className="helphead">Game settings</div>
            {mode === "daily" ? (
              <p className="muted" style={{ margin: "0 0 4px", fontSize: 13 }}>
                The daily is fixed at the <b>10k</b> dictionary with multipliers so it&apos;s the same for everyone.
                Switch to <b>Infinite</b> to change these.
              </p>
            ) : (
              <>
                <div className="setrow">
                  <span className="setlabel">dictionary</span>
                  <div className="segmented">
                    {TIERS.map((t) => (
                      <button key={t} className={tier === t ? "on" : ""} onClick={() => chooseTier(t)}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="setrow">
                  <span className="setlabel">multipliers</span>
                  <div className="segmented">
                    <button className={multipliers ? "on" : ""} onClick={() => chooseMultipliers(true)}>
                      on
                    </button>
                    <button className={!multipliers ? "on" : ""} onClick={() => chooseMultipliers(false)}>
                      off
                    </button>
                  </div>
                </div>
              </>
            )}
            <div className="setrow">
              <span className="setlabel">hint</span>
              <div className="segmented">
                <button className={hintStyle === "synonym" ? "on" : ""} onClick={() => chooseHintStyle("synonym")}>
                  synonym
                </button>
                <button className={hintStyle === "definition" ? "on" : ""} onClick={() => chooseHintStyle("definition")}>
                  definition
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "play" && (
        <>
          <div className="playmode">
            <div className="segmented">
              <button className={mode === "daily" ? "on" : ""} onClick={() => setMode("daily")}>
                Daily
              </button>
              <button className={mode === "infinite" ? "on" : ""} onClick={() => setMode("infinite")}>
                Infinite
              </button>
            </div>
          </div>
          {mode === "daily" && !dailyDate ? (
            <p className="muted">Loading…</p>
          ) : (
            <InfiniteMode
              showHelp={showHelp}
              onCloseHelp={() => setShowHelp(false)}
              tier={tier}
              multipliers={multipliers}
              hintStyle={hintStyle}
              settingsOpen={settingsOpen}
              onToggleSettings={() => setSettingsOpen((o) => !o)}
              resume={resume}
              onResumeConsumed={clearResume}
              daily={dailyProp}
              onScore={(total) => setScore(total)}
              onPoints={(pts) => setPointsPop({ id: (popId.current += 1), pts })}
            />
          )}
        </>
      )}

      {tab === "dictionary" && <Dictionary />}

      {tab === "history" && (
        <div className="stack">
          <FrameHistory
            onSelect={(r) => {
              setResume(r);
              setMode("infinite");
              setTab("play");
            }}
          />
        </div>
      )}
    </div>
  );
}
