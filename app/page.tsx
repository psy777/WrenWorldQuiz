"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Game = { href: string; title: string; blurb: string; glyph: string; external?: boolean };

const GAMES: Game[] = [
  {
    href: "/wordgap",
    title: "wordgap",
    blurb: "Fill the gap between two fixed letters. Rare letters and ×2/×3 tiles rack up points — chase the top word.",
    glyph: "▦",
  },
  {
    href: "/wren/index.html",
    title: "World Map Quiz",
    blurb: "How many of the world's countries can you find on the map? Race the clock across several game modes.",
    glyph: "◍",
    external: true,
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
    <div className="wrap">
      <div className="brand">
        <div className="brandleft">
          <h1>psy.fun</h1>
        </div>
        <div className="topright">
          <button className="icon" title="Toggle light / dark" aria-label="Toggle light / dark" onClick={toggleTheme}>
            <span className={`ico-mask ${light ? "ico-moon" : "ico-sun"}`} />
          </button>
        </div>
      </div>

      <p className="hubtag">a little collection of things to play with.</p>

      <div className="hubgrid">
        {GAMES.map((g) =>
          g.external ? (
            <a key={g.href} className="hubcard" href={g.href}>
              <span className="hubglyph">{g.glyph}</span>
              <span className="hubtitle">{g.title}</span>
              <span className="hubblurb">{g.blurb}</span>
            </a>
          ) : (
            <Link key={g.href} className="hubcard" href={g.href}>
              <span className="hubglyph">{g.glyph}</span>
              <span className="hubtitle">{g.title}</span>
              <span className="hubblurb">{g.blurb}</span>
            </Link>
          ),
        )}
      </div>
    </div>
  );
}
