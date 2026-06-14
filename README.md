# Fantasy WC26 🏆⚽

A live standings site for our **2026 FIFA World Cup** fantasy draft
(Chris · Jarrett · Justin · Ryan). Each player drafted 12 of the 48 teams;
whoever's teams rack up the most **wins** takes the crown.

It's a plain static site (no server, no build step) with four tabs that match
the original design: **Standings · Draft · Win Tracker · Rules**.

## How results stay up to date

There are two layers, so it works whether or not the live feed is connected:

1. **Auto-sync (hands-off).** A scheduled GitHub Action runs every 30 minutes,
   pulls live World Cup results, and commits them to `data/matches.json`.
   Because they're committed to the repo, every result is saved permanently and
   the site simply reads the latest file.
2. **Manual entry / override (always available).** On the **Win Tracker** tab
   you can type any score and tap **W / D / L**. Your edits are saved in your
   browser and override the synced feed. Use **Export / Import** to share your
   data with the group.

Wins follow the house rules: group-stage and knockout wins each count as 1;
draws don't count; in knockouts the **advancing team** gets the win (including
penalty-shootout wins).

## Extras
- **Live refresh** — an open tab re-checks for new results every minute and when
  you switch back to it, so scores update without reloading.
- **Install to home screen / offline** — it's a PWA (manifest + service worker),
  so you can add it to your phone's home screen and it still loads at the bar
  with no signal (results refresh when you're back online).
- **Per-team records** — the Draft tab shows each team's wins/goals and an
  **OUT** badge once a team loses a knockout match.
- **Champion banner** — when the Final is decided, the winning team and its owner
  are celebrated at the top of Standings.

## One-time setup

### 1. Turn on the live feed (optional but recommended)
1. Get a free API token at <https://www.football-data.org/client/register>.
2. In this repo: **Settings → Secrets and variables → Actions → New repository
   secret**. Name it `FOOTBALL_DATA_API_TOKEN`, paste your token.
3. Go to the **Actions** tab → *Update World Cup results* → **Run workflow** to
   sync immediately. After that it runs automatically every 30 minutes.

> No token? The site still works fully with manual entry — it just won't
> auto-update. The free tier covers the World Cup; if your plan doesn't return
> matches, the script leaves the existing file untouched.

### 2. Publish the site
1. **Settings → Pages → Source = "GitHub Actions"**.
2. Push to the branch (already wired in `deploy-pages.yml`) and the site goes
   live at the URL shown in the Pages settings. Share that link with everyone.

You can also just open `index.html` locally to preview.

## Editing the league
Everything configurable lives in **`js/config.js`**: players, colors, the 12-team
rosters, flag emoji, team-name aliases, and stage labels. The fetch script reads
the same rosters/aliases, so changing a name in one place keeps both in sync.

## Project layout
```
index.html                      the app (4 tabs)
css/styles.css                  dark navy/gold theme
js/config.js                    players, rosters, flags, aliases  ← edit here
js/app.js                       rendering + standings logic
data/matches.json               results (auto-synced + committed)
scripts/fetch-results.mjs       fetches live results (Node 18+, no deps)
.github/workflows/
  update-results.yml            cron sync → commit
  deploy-pages.yml              publish to GitHub Pages
```

## Notes on the seed data
`data/matches.json` ships with Group A pre-filled from the early results
(Mexico 2–0 South Africa, South Korea 2–1 South Africa). Standings are computed
**only from logged matches**, so totals will fill in as the feed syncs or as you
log more results — they won't match a screenshot until the rest are entered.
