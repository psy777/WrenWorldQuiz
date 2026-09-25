"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import WorldQuiz from "@/components/WorldQuiz";

export default function WrenPage() {
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
    <div className="wrap wide">
      <div className="brand">
        <div className="brandleft">
          <Link href="/" className="hubback" title="All games">
            wren.gg /
          </Link>
          <h1>world map quiz</h1>
        </div>
        <div className="topright">
          <button className="icon" title="Toggle light / dark" aria-label="Toggle light / dark" onClick={toggleTheme}>
            <span className={`ico-mask ${light ? "ico-moon" : "ico-sun"}`} />
          </button>
        </div>
      </div>

      <WorldQuiz />
    </div>
  );
}
