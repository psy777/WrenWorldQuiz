"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Game = { href: string; title: string };

const GAMES: Game[] = [
  { href: "/wordgap", title: "wordgap" },
  { href: "/wren", title: "World Map Quiz" },
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
        <h1>breaktime games</h1>
      </section>

      <div className="hub-cards">
        {GAMES.map((g) => (
          <Link key={g.href} className="hub-card" href={g.href}>
            <span className="hub-card-title">{g.title}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
