"use client";

import { geoNaturalEarth1, geoPath, type GeoPermissibleObjects } from "d3-geo";
import { useEffect, useMemo, useRef, useState } from "react";

type Feature = { type: "Feature"; properties: { name: string }; geometry: unknown };
type World = { type: "FeatureCollection"; features: Feature[] };
type Status = "correct" | "missed" | "wrong";

const W = 960;
const H = 480;
const ROUND = 15;
const SKIP = new Set(["Antarctica"]);

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function WorldQuiz() {
  const [world, setWorld] = useState<World | null>(null);
  const [order, setOrder] = useState<string[]>([]);
  const [idx, setIdx] = useState(0);
  const [status, setStatus] = useState<Record<string, Status>>({});
  const [score, setScore] = useState(0);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<"intro" | "play" | "done">("intro");
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(0);

  useEffect(() => {
    fetch("/wren/world.geo.json")
      .then((r) => r.json())
      .then(setWorld)
      .catch(() => setWorld(null));
  }, []);

  useEffect(() => {
    if (phase !== "play") return;
    const t = setInterval(() => setElapsed(Math.round((Date.now() - startRef.current) / 1000)), 500);
    return () => clearInterval(t);
  }, [phase]);

  // project once, precompute each country's SVG path + which are big enough to ask
  const { shapes, askable } = useMemo(() => {
    if (!world) return { shapes: [] as { name: string; d: string }[], askable: [] as string[] };
    const projection = geoNaturalEarth1().fitSize([W, H], world as unknown as GeoPermissibleObjects);
    const path = geoPath(projection);
    const shapes: { name: string; d: string }[] = [];
    const askable: string[] = [];
    for (const f of world.features) {
      const d = path(f as unknown as GeoPermissibleObjects) || "";
      if (!d) continue;
      shapes.push({ name: f.properties.name, d });
      const b = path.bounds(f as unknown as GeoPermissibleObjects);
      const area = Math.max(0, b[1][0] - b[0][0]) * Math.max(0, b[1][1] - b[0][1]);
      if (area > 55 && !SKIP.has(f.properties.name)) askable.push(f.properties.name);
    }
    return { shapes, askable };
  }, [world]);

  const target = phase === "play" && idx < order.length ? order[idx] : null;

  function start() {
    setOrder(shuffle(askable).slice(0, ROUND));
    setIdx(0);
    setStatus({});
    setScore(0);
    setBusy(false);
    setElapsed(0);
    startRef.current = Date.now();
    setPhase("play");
  }

  function advance() {
    setIdx((i) => {
      const n = i + 1;
      if (n >= order.length) setPhase("done");
      return n;
    });
  }

  function pick(name: string) {
    if (phase !== "play" || busy || !target) return;
    if (name === target) {
      setStatus((s) => ({ ...s, [target]: "correct" }));
      setScore((v) => v + 1);
      advance();
    } else {
      setBusy(true);
      setStatus((s) => ({ ...s, [name]: "wrong", [target]: "missed" }));
      setTimeout(() => {
        setStatus((s) => {
          const n = { ...s };
          if (n[name] === "wrong") delete n[name];
          return n;
        });
        setBusy(false);
        advance();
      }, 850);
    }
  }

  function skip() {
    if (phase !== "play" || busy || !target) return;
    setStatus((s) => ({ ...s, [target]: "missed" }));
    advance();
  }

  return (
    <div className="mq">
      <div className="mq-hud">
        {phase === "intro" && (
          <>
            <p className="mq-lead">Click the country you&apos;re asked to find. {askable.length ? `${askable.length} in the pool.` : "Loading the map…"}</p>
            <button className="btn primary" onClick={start} disabled={!askable.length}>
              Start
            </button>
          </>
        )}
        {phase === "play" && (
          <>
            <div className="mq-target">
              Find <b>{target}</b>
            </div>
            <div className="mq-meta">
              <span>
                {idx + 1}/{order.length}
              </span>
              <span className="mq-good">{score} found</span>
              <span>{elapsed}s</span>
              <button className="btn btn-sm" onClick={skip} disabled={busy}>
                Skip
              </button>
            </div>
          </>
        )}
        {phase === "done" && (
          <>
            <div className="mq-target">
              You found <b>{score}</b> / {order.length} in {elapsed}s
            </div>
            <button className="btn primary" onClick={start}>
              Play again
            </button>
          </>
        )}
      </div>

      <div className="mq-mapwrap">
        <svg viewBox={`0 0 ${W} ${H}`} className="mq-map" role="img" aria-label="World map">
          {shapes.map((s) => (
            <path
              key={s.name}
              d={s.d}
              className={`mq-country ${status[s.name] ?? ""} ${phase === "play" && !busy ? "live" : ""}`}
              onClick={() => pick(s.name)}
            >
              {(status[s.name] === "correct" || status[s.name] === "missed") && <title>{s.name}</title>}
            </path>
          ))}
        </svg>
      </div>
    </div>
  );
}
