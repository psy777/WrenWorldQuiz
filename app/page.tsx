"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

type Game = { href: string; title: string; blurb: string; tag: string; icon: ReactNode };

const TileIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round">
    <rect x="3" y="6" width="7.5" height="12" rx="1.4" />
    <rect x="13.5" y="6" width="7.5" height="12" rx="1.4" />
  </svg>
);
const GlobeIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18" />
    <path d="M12 3c2.7 2.6 2.7 15.4 0 18M12 3c-2.7 2.6-2.7 15.4 0 18" />
  </svg>
);

const GAMES: Game[] = [
  {
    href: "/wordgap",
    title: "wordgap",
    blurb: "Fill the gap between two fixed letters. Rare letters and ×2/×3 tiles pile on points — hunt for the top word.",
    tag: "word game",
    icon: TileIcon,
  },
  {
    href: "/wren",
    title: "World Map Quiz",
    blurb: "How many of the world's countries can you place on the map? Beat the clock, one country at a time.",
    tag: "geography",
    icon: GlobeIcon,
  },
];

export default function Hub() {
  const [light, setLight] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("wg_theme") === "light";
    setLight(stored);
    document.documentElement.setAttribute("data-theme", stored ? "light" : "dark");
  }, []);

  function toggleTheme() {
    setLight((l) => {
      const next = !l;
      document.documentElement.setAttribute("data-theme", next ? "light" : "dark");
      localStorage.setItem("wg_theme", next ? "light" : "dark");
      return next;
    });
  }

  return (
    <div className="hub">
      <div className="hub-bg" aria-hidden />

      <header className="hub-top">
        <span className="hub-mark">
          wren<b>.gg</b>
        </span>
        <button className="hub-theme" title="Toggle light / dark" aria-label="Toggle light / dark" onClick={toggleTheme}>
          {light ? "☾" : "☀"}
        </button>
      </header>

      <section className="hub-hero">
        <h1>
          Little games,
          <br />
          made for a break.
        </h1>
        <p>A small, growing collection of things to poke at in a browser tab. Pick one and go.</p>
      </section>

      <div className="hub-cards">
        {GAMES.map((g) => (
          <Link key={g.href} className="hub-card" href={g.href}>
            <span className="hub-ico">{g.icon}</span>
            <span className="hub-card-body">
              <span className="hub-card-title">
                {g.title}
                <span className="hub-card-arrow">→</span>
              </span>
              <span className="hub-card-desc">{g.blurb}</span>
              <span className="hub-card-tag">{g.tag}</span>
            </span>
          </Link>
        ))}
      </div>

      <footer className="hub-foot">wren.gg — more soon.</footer>
    </div>
  );
}
