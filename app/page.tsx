"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Game = { href: string; title: string; static?: boolean };

const GAMES: Game[] = [
  { href: "/wordgap", title: "Wordgap" },
  { href: "/blackbox", title: "Black Box" },
  // The quiz is a standalone static app — full navigation, not client routing.
  { href: "/worldquiz", title: "World Map Quiz", static: true },
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

      <ul className="hub-list">
        {GAMES.map((g) =>
          g.static ? (
            <li key={g.href}>
              <a className="hub-link" href={g.href}>
                {g.title}
              </a>
            </li>
          ) : (
            <li key={g.href}>
              <Link className="hub-link" href={g.href}>
                {g.title}
              </Link>
            </li>
          ),
        )}
      </ul>
    </div>
  );
}
