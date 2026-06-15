/* =====================================================================
   Fetch live 2026 World Cup results and write data/matches.json.
   Runs in GitHub Actions on a schedule (see .github/workflows).

   Data source: football-data.org (free tier).
   Set a repo secret FOOTBALL_DATA_API_TOKEN with your free token from
   https://www.football-data.org/client/register

   No npm dependencies — uses Node 18+ global fetch.
   ===================================================================== */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT = join(ROOT, "data", "matches.json");

const TOKEN = process.env.FOOTBALL_DATA_API_TOKEN;
const COMPETITION = process.env.WC_COMPETITION || "WC"; // football-data code for the World Cup

// Pull canonical names + aliases out of js/config.js without importing the browser file.
function loadConfig() {
  const src = readFileSync(join(ROOT, "js", "config.js"), "utf8");
  const json = src.replace(/^[\s\S]*?window\.CONFIG\s*=\s*/, "").replace(/;\s*$/, "");
  // eslint-disable-next-line no-new-func
  return Function(`"use strict";return (${json});`)();
}

const CONFIG = loadConfig();
const ALIASES = CONFIG.aliases || {};
const canonical = n => (n && ALIASES[n]) || (n || "").trim();

// football-data stage -> our stage code
const STAGE_MAP = {
  GROUP_STAGE: "GROUP",
  LAST_32: "R32",
  LAST_16: "R16",
  QUARTER_FINALS: "QF",
  QUARTER_FINAL: "QF",
  SEMI_FINALS: "SF",
  SEMI_FINAL: "SF",
  THIRD_PLACE: "3RD",
  FINAL: "FINAL",
};

const STATUS_MAP = {
  SCHEDULED: "SCHEDULED", TIMED: "SCHEDULED",
  IN_PLAY: "IN_PLAY", PAUSED: "PAUSED",
  FINISHED: "FINISHED", AWARDED: "FINISHED",
  POSTPONED: "SCHEDULED", SUSPENDED: "SCHEDULED", CANCELLED: "SCHEDULED",
};

function deriveWinner(m, home, away) {
  const ft = m.score?.fullTime || {};
  const pens = m.score?.penalties || {};
  const w = m.score?.winner; // HOME_TEAM | AWAY_TEAM | DRAW | null
  const isKO = STAGE_MAP[m.stage] && STAGE_MAP[m.stage] !== "GROUP";
  if (w === "HOME_TEAM") return home;
  if (w === "AWAY_TEAM") return away;
  if (w === "DRAW") {
    // group-stage draw = no winner; knockout draw = decided on penalties
    if (isKO && Number.isFinite(pens.home) && Number.isFinite(pens.away)) {
      return pens.home > pens.away ? home : away;
    }
    return null;
  }
  // Fallback from full-time score (only safe for group stage)
  if (Number.isFinite(ft.home) && Number.isFinite(ft.away) && !isKO) {
    if (ft.home > ft.away) return home;
    if (ft.away > ft.home) return away;
  }
  return null;
}

async function main() {
  if (!TOKEN) {
    console.error("No FOOTBALL_DATA_API_TOKEN set — leaving data/matches.json unchanged.");
    process.exit(0);
  }

  const url = `https://api.football-data.org/v4/competitions/${COMPETITION}/matches`;
  const res = await fetch(url, { headers: { "X-Auth-Token": TOKEN } });
  if (!res.ok) {
    console.error(`API responded ${res.status} ${res.statusText} — leaving file unchanged.`);
    process.exit(0);
  }
  const data = await res.json();
  const raw = Array.isArray(data.matches) ? data.matches : [];
  if (!raw.length) {
    console.error("API returned 0 matches — leaving file unchanged.");
    process.exit(0);
  }

  const matches = raw.map(m => {
    const home = canonical(m.homeTeam?.name || m.homeTeam?.shortName || "");
    const away = canonical(m.awayTeam?.name || m.awayTeam?.shortName || "");
    const stage = STAGE_MAP[m.stage] || "GROUP";
    const ft = m.score?.fullTime || {};
    return {
      id: `fd-${m.id}`,
      stage,
      group: m.group ? String(m.group).replace(/GROUP[_\s]?/i, "") : null,
      date: (m.utcDate || "").slice(0, 10),
      home, away,
      homeScore: Number.isFinite(ft.home) ? ft.home : null,
      awayScore: Number.isFinite(ft.away) ? ft.away : null,
      status: STATUS_MAP[m.status] || "SCHEDULED",
      winner: deriveWinner(m, home, away),
    };
  }).filter(m => m.home && m.away);

  // Read existing file to detect if match data actually changed.
  let existing = { matches: [], lastSynced: null };
  try { existing = JSON.parse(readFileSync(OUT, "utf8")); } catch {}
  const existingSig = JSON.stringify(existing.matches);
  const newSig = JSON.stringify(matches);
  const scoresChanged = existingSig !== newSig;

  // Only rewrite the file when match data actually changes. Writing on every
  // poll (just to bump a timestamp) would commit every ~90s and blow past
  // GitHub Pages' build rate limit, freezing the published site.
  if (!scoresChanged && existing.matches?.length) {
    console.log("No score changes — leaving file unchanged.");
    return;
  }

  const now = new Date().toISOString();
  const out = {
    lastChecked: now,
    lastSynced: now,
    syncNote: `Auto-synced from football-data.org (${COMPETITION}).`,
    source: "football-data.org",
    matches,
  };

  writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n");
  console.log(`Wrote ${matches.length} matches (scores changed).`);
}

main().catch(err => { console.error(err); process.exit(1); });
