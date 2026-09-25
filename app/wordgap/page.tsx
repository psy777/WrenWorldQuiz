"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { jget, jpost, type User } from "@/lib/api";
import InfiniteMode from "@/components/InfiniteMode";
import Dictionary from "@/components/Dictionary";
import FrameHistory from "@/components/FrameHistory";
import AuthPanel from "@/components/AuthPanel";

type Tab = "infinite" | "account" | "dictionary";
type ResumeReq = { start: string; end: string; len: number; bonuses: { index: number; mult: number }[]; frameId: string };
const TIERS = ["1k", "5k", "10k", "20k", "100k", "450k"] as const;

// 589300 -> "589.3K"; small numbers stay whole.
function fmtPoints(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}K`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [tab, setTab] = useState<Tab>("infinite");
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
    jget<{ user: User | null }>("/api/auth/me").then(({ data }) => setUser(data.user));
    const stored = localStorage.getItem("wg_theme") === "light";
    setLight(stored);
    document.documentElement.setAttribute("data-theme", stored ? "light" : "dark");
    const t = localStorage.getItem("wg_tier");
    if (t && (TIERS as readonly string[]).includes(t)) setTier(t);
    setMultipliers(localStorage.getItem("wg_mult") !== "off"); // multipliers on by default
    if (localStorage.getItem("wg_hint") === "definition") setHintStyle("definition");
  }, []);

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

  async function logout() {
    await jpost("/api/auth/logout");
    setUser(null);
    setTab("infinite");
  }

  return (
    <div className="wrap">
      <div className="brand">
        <div className="brandleft">
          <Link href="/" className="hubback" title="All games">
            wren.gg /
          </Link>
          <h1 onClick={() => setTab("infinite")} style={{ cursor: "pointer" }} title="Home">
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
            {user ? (
              <div className="menu">
                <button
                  className="menu-btn"
                  onClick={() => setMenuOpen((o) => !o)}
                  aria-haspopup="true"
                  aria-expanded={menuOpen}
                  title="Account"
                >
                  <span className="username">{user.name}</span>
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
                        <b>{user.name}</b>
                        <span title={`${user.totalScore.toLocaleString()} points`}>{fmtPoints(user.totalScore)} pts</span>
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
                          setTab("account");
                          setMenuOpen(false);
                        }}
                      >
                        Account
                      </button>
                      <button
                        className="menu-item"
                        onClick={() => {
                          logout();
                          setMenuOpen(false);
                        }}
                      >
                        Sign out
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <button className="linkbtn" onClick={() => setTab("account")}>
                sign in
              </button>
            )}
          </div>
        </div>
      </div>

      {tab === "infinite" && settingsOpen && (
        <div className="modal-backdrop" onClick={() => setSettingsOpen(false)}>
          <div className="statscard settingscard" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" aria-label="Close" onClick={() => setSettingsOpen(false)}>
              ×
            </button>
            <div className="helphead">Game settings</div>
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

      {tab === "infinite" && (
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
          onScore={(total) => setUser((u) => (u ? { ...u, totalScore: total } : u))}
          onPoints={(pts) => {
            if (user) setPointsPop({ id: (popId.current += 1), pts });
          }}
        />
      )}
      {tab === "dictionary" &&
        (user ? <Dictionary /> : <p className="muted">Sign in to keep a dictionary of the words you find.</p>)}
      {tab === "account" &&
        (user ? (
          <div className="stack">
            <div className="between acct-head">
              <p style={{ margin: 0 }}>
                Signed in as <b>{user.name}</b>
                {user.email ? ` (${user.email})` : ""} ·{" "}
                <span title={`${user.totalScore.toLocaleString()} points`}>{fmtPoints(user.totalScore)} pts</span>
              </p>
              <button className="btn btn-sm" onClick={logout}>
                Sign out
              </button>
            </div>
            <FrameHistory
              onSelect={(r) => {
                setResume(r);
                setTab("infinite");
              }}
            />
          </div>
        ) : (
          <AuthPanel
            onAuthed={(u) => {
              setUser(u);
              setTab("infinite");
            }}
          />
        ))}
    </div>
  );
}
