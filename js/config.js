/* =====================================================================
   Fantasy WC26 — League configuration
   Edit this file to change players, rosters, or tournament details.
   ===================================================================== */
window.CONFIG = {
  // Live results come from data/matches.json, refreshed every ~90s by the
  // GitHub Action poller (.github/workflows/update-results.yml).
  //
  // football-data.org blocks direct browser calls (CORS), so to fetch live in
  // the browser you need a proxy that adds CORS headers (e.g. a free Cloudflare
  // Worker). Put that proxy URL in `apiBase` and your token in `apiToken` to
  // enable instant in-browser updates. Left blank = use the polled file.
  apiBase: "",
  apiToken: "1bd33a67a606424a9d9bc76eb1062f9f",

  // Read results straight from the latest commit (bypasses GitHub Pages, which
  // only rebuilds ~10x/hour and would serve stale data). raw.githubusercontent
  // updates within ~1 min of each poller commit and allows cross-origin reads.
  dataUrl: "https://raw.githubusercontent.com/chriscasensmith-source/world-cup-/main/data/matches.json",

  kicker: "2026 FIFA World Cup · USA / Canada / Mexico",
  title: "Fantasy WC26",
  dates: "June 11 – July 19, 2026",

  // Order here = display order. `color` drives the owner chips & card accents.
  players: [
    { id: "chris",   name: "Chris",   color: "#ff4d6d" },
    { id: "jarrett", name: "Jarrett", color: "#8b5cf6" },
    { id: "justin",  name: "Justin",  color: "#22c993" },
    { id: "ryan",    name: "Ryan",    color: "#ff9a3d" },
  ],

  // Each player drafted 12 teams (48 ÷ 4). Names here are the "canonical"
  // names — the fetch script maps live API names onto these via `aliases`.
  rosters: {
    chris:   ["England","Netherlands","Mexico","Morocco","South Korea","Colombia","Austria","Sweden","DR Congo","Tunisia","Uzbekistan","Cape Verde"],
    jarrett: ["France","USA","Belgium","Japan","Canada","Scotland","Iran","Egypt","Jordan","Czechia","Saudi Arabia","Haiti"],
    justin:  ["Spain","Argentina","Brazil","Uruguay","Switzerland","Ecuador","Ghana","Bosnia & Herzegovina","Algeria","Senegal","Curaçao","Paraguay"],
    ryan:    ["Portugal","Germany","Norway","Croatia","Ivory Coast","Türkiye","Australia","Panama","New Zealand","South Africa","Qatar","Iraq"],
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
  // Used by both the browser and the GitHub Action fetch script.
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
