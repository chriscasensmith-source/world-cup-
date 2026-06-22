/* =====================================================================
   Fantasy WC26 — League 2 configuration
   A second, independent draft (8 players × 6 teams) that reads the SAME
   live World Cup results as the main league. Scoring is points-based:
   later rounds are worth more (see `scoring` below).
   Edit this file to change players, rosters, or the points ladder.
   ===================================================================== */
window.CONFIG = {
  // This league has no live API of its own — it reads the results that the
  // main league's GitHub Action already syncs to data/matches.json. The
  // tournament (and every match) is the same; only the owners + scoring differ.
  apiBase: "",
  apiToken: "",

  // Read results straight from the latest commit (same file the main league
  // uses), so both pages always show identical, up-to-the-minute scores.
  dataUrl: "https://raw.githubusercontent.com/chriscasensmith-source/world-cup-/main/data/matches.json",

  kicker: "2026 FIFA World Cup · League 2 · 8-player draft",
  title: "Fantasy WC26 — League 2",
  dates: "June 11 – July 19, 2026",

  // Points-based scoring. Each FINISHED match awards points to the owner of
  // the winning team (and, in the group stage, the draw). Later knockout
  // rounds are worth progressively more. Any stage not listed scores 0.
  scoring: {
    win:  { GROUP: 3, R32: 4, R16: 6, QF: 9, SF: 12, "3RD": 0, FINAL: 15 },
    draw: { GROUP: 1 }, // draws only score in the group stage
  },

  // Order here = display order. `color` drives the owner chips & card accents.
  players: [
    { id: "george", name: "George", color: "#ff4d6d" },
    { id: "mobley", name: "Mobley", color: "#8b5cf6" },
    { id: "brad",   name: "Brad",   color: "#22c993" },
    { id: "rex",    name: "Rex",    color: "#ff9a3d" },
    { id: "jansen", name: "Jansen", color: "#38bdf8" },
    { id: "greg",   name: "Greg",   color: "#eab308" },
    { id: "robbie", name: "Robbie", color: "#ec4899" },
    { id: "chris",  name: "Chris",  color: "#14b8a6" },
  ],

  // Each player drafted 6 teams (48 ÷ 8). Names here are the "canonical"
  // names — the live feed maps API names onto these via `aliases`.
  rosters: {
    george: ["Germany","Senegal","Scotland","New Zealand","Panama","Curaçao"],
    mobley: ["France","Colombia","Norway","Egypt","Algeria","Paraguay"],
    brad:   ["Spain","Japan","Sweden","Czechia","Cape Verde","South Africa"],
    rex:    ["England","Uruguay","Morocco","Bosnia & Herzegovina","Iran","Jordan"],
    jansen: ["Brazil","USA","Ecuador","Canada","Saudi Arabia","DR Congo"],
    greg:   ["Argentina","Mexico","Austria","Australia","Tunisia","Haiti"],
    robbie: ["Netherlands","Portugal","South Korea","Ivory Coast","Ghana","Iraq"],
    chris:  ["Belgium","Croatia","Switzerland","Türkiye","Qatar","Uzbekistan"],
  },

  // Flag emoji per canonical team name.
  flags: {
    "England":"🏴󠁧󠁢󠁥󠁮󠁧󠁿","Netherlands":"🇳🇱","Mexico":"🇲🇽","Morocco":"🇲🇦","South Korea":"🇰🇷","Colombia":"🇨🇴",
    "Austria":"🇦🇹","Sweden":"🇸🇪","DR Congo":"🇨🇩","Tunisia":"🇹🇳","Uzbekistan":"🇺🇿","Cape Verde":"🇨🇻",
    "France":"🇫🇷","USA":"🇺🇸","Belgium":"🇧🇪","Japan":"🇯🇵","Canada":"🇨🇦","Scotland":"🏴󠁧󠁢󠁳󠁣󠁴󠁿",
    "Iran":"🇮🇷","Egypt":"🇪🇬","Jordan":"🇯🇴","Czechia":"🇨🇿","Saudi Arabia":"🇸🇦","Haiti":"🇭🇹",
    "Spain":"🇪🇸","Argentina":"🇦🇷","Brazil":"🇧🇷","Uruguay":"🇺🇾","Switzerland":"🇨🇭","Ecuador":"🇪🇨",
    "Ghana":"🇬🇭","Bosnia & Herzegovina":"🇧🇦","Algeria":"🇩🇿","Senegal":"🇸🇳","Curaçao":"🇨🇼","Paraguay":"🇵🇾",
    "Portugal":"🇵🇹","Germany":"🇩🇪","Norway":"🇳🇴","Croatia":"🇭🇷","Ivory Coast":"🇨🇮","Türkiye":"🇹🇷",
    "Australia":"🇦🇺","Panama":"🇵🇦","New Zealand":"🇳🇿","South Africa":"🇿🇦","Qatar":"🇶🇦","Iraq":"🇮🇶",
  },

  // Maps the many ways a data source might spell a team -> our canonical name.
  aliases: {
    "Korea Republic":"South Korea","South Korea":"South Korea","Republic of Korea":"South Korea",
    "IR Iran":"Iran","Iran":"Iran",
    "USA":"USA","United States":"USA","United States of America":"USA","US":"USA",
    "Czech Republic":"Czechia","Czechia":"Czechia",
    "Türkiye":"Türkiye","Turkey":"Türkiye","Turkiye":"Türkiye",
    "Côte d'Ivoire":"Ivory Coast","Cote d'Ivoire":"Ivory Coast","Ivory Coast":"Ivory Coast",
    "Bosnia and Herzegovina":"Bosnia & Herzegovina","Bosnia & Herzegovina":"Bosnia & Herzegovina","Bosnia-Herzegovina":"Bosnia & Herzegovina",
    "DR Congo":"DR Congo","Congo DR":"DR Congo","Democratic Republic of the Congo":"DR Congo","Congo Democratic Republic":"DR Congo",
    "Cabo Verde":"Cape Verde","Cape Verde":"Cape Verde","Cape Verde Islands":"Cape Verde",
    "Curaçao":"Curaçao","Curacao":"Curaçao",
    "Saudi Arabia":"Saudi Arabia","KSA":"Saudi Arabia",
    "Netherlands":"Netherlands","Holland":"Netherlands",
  },

  // Stage labels + ordering (used for "deepest run" tiebreaker & section headers).
  stages: {
    GROUP:  { label: "Group Stage", rank: 1 },
    R32:    { label: "Round of 32", rank: 2 },
    R16:    { label: "Round of 16", rank: 3 },
    QF:     { label: "Quarter-finals", rank: 4 },
    SF:     { label: "Semi-finals", rank: 5 },
    "3RD":  { label: "Third-place Playoff", rank: 5 },
    FINAL:  { label: "Final", rank: 6 },
  },
};
