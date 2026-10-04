# wren.gg

A little collection of games to play with — my take on [neal.fun](https://neal.fun).
A single [Next.js](https://nextjs.org) app: a hub landing page that links out to
each experience.

## What's inside

| Route | What |
| --- | --- |
| `/` | The hub — lists the games. |
| `/wordgap` | **wordgap** — fill the gap between two fixed letters. Distinct per-letter scores, ×2/×3 multiplier tiles, blind ranking, an always-visible clue list with buy-a-letter reveals (clues via the free [Datamuse](https://www.datamuse.com/api/) API), tiered dictionaries (1k–450k) with bonus words, a personal dictionary, and per-frame history with resume. |
| `/wren/index.html` | **World Map Quiz** — a self-contained country-finding game, served statically from `public/wren/`. |

The word engine (`/api/frame`, `/api/frame/guess`, `/api/frame/clues`, `/api/define`,
`/api/frame/resume`) is stateless. Accounts + a personal dictionary/history are stored
in a local SQLite file (`data/wordgap.db`, git-ignored, created on first run).

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploy (Render / any Node host)

It's a standard Next.js server app:

- **Build command:** `npm install && npm run build`
- **Start command:** `npm run start`

SQLite writes to `data/`, so give the service a writable disk if you want accounts
to persist across restarts. The static quiz needs no server; it fetches its map data
at runtime.

## Adding a game

Drop a self-contained build into `public/<name>/` (like `public/wren/`), or add a
route under `app/<name>/`, then add a card to `GAMES` in `app/page.tsx`.
