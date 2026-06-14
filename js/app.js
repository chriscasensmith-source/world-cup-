/* =====================================================================
   Fantasy WC26 — app logic
   - Loads results from data/matches.json (auto-synced by GitHub Action)
   - Merges local manual edits / additions (saved in this browser)
   - Computes standings, win tracker, draft & rules views
   ===================================================================== */
(function () {
  "use strict";

  const C = window.CONFIG;
  const LS_OVERRIDES = "wc26.overrides.v1"; // edits to existing matches, keyed by matchKey
  const LS_MANUAL    = "wc26.manual.v1";    // matches added by hand

  // ---- Derived lookups -------------------------------------------------
  const PLAYER_BY_ID = Object.fromEntries(C.players.map(p => [p.id, p]));
  const TEAM_OWNER = {};            // canonical team -> player id
  for (const [pid, teams] of Object.entries(C.rosters)) {
    teams.forEach(t => { TEAM_OWNER[t] = pid; });
  }

  const flag = t => C.flags[t] || "🏳️";
  const ownerId = t => TEAM_OWNER[canonical(t)] || null;
  const canonical = name => (name && C.aliases[name]) || name;
  const matchKey = m => `${m.stage}__${m.home}__${m.away}`;

  // ---- Persistence -----------------------------------------------------
  const load = (k, fallback) => {
    try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? fallback : v; }
    catch { return fallback; }
  };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

  let remote = { matches: [], lastSynced: null, source: "seed", syncNote: "" };
  let overrides = load(LS_OVERRIDES, {});
  let manual = load(LS_MANUAL, []);

  // ---- Merge remote + local into the live match list -------------------
  function liveMatches() {
    const all = [...remote.matches, ...manual];
    return all.map(m => {
      const ov = overrides[matchKey(m)];
      const merged = ov ? { ...m, ...ov, edited: true } : { ...m };
      // Normalise team names to canonical for owner resolution
      merged.home = canonical(merged.home);
      merged.away = canonical(merged.away);
      return merged;
    });
  }

  // ---- Standings -------------------------------------------------------
  function computeStandings() {
    const stats = {};
    C.players.forEach(p => {
      stats[p.id] = { ...p, wins: 0, goals: 0, played: 0, deepest: 0, teams: {} };
    });

    for (const m of liveMatches()) {
      const hasScore = Number.isFinite(m.homeScore) && Number.isFinite(m.awayScore);
      [["home", "away"], ["away", "home"]].forEach(([side, other]) => {
        const team = m[side];
        const pid = ownerId(team);
        if (!pid) return;
        const s = stats[pid];
        // deepest run = furthest stage this player's team appeared in
        const rank = (C.stages[m.stage] || {}).rank || 1;
        if (rank > s.deepest) s.deepest = rank;
        if (!hasScore) return;
        s.goals += m[side === "home" ? "homeScore" : "awayScore"];
        if (m.status === "FINISHED") {
          s.played += 1;
          if (m.winner && canonical(m.winner) === team) s.wins += 1;
        }
      });
    }

    return Object.values(stats).sort(rankPlayers);
  }

  // Tiebreakers: wins ▸ goals ▸ deepest run ▸ head-to-head ▸ tie
  function rankPlayers(a, b) {
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (b.goals !== a.goals) return b.goals - a.goals;
    if (b.deepest !== a.deepest) return b.deepest - a.deepest;
    return h2h(a.id, b.id);
  }
  function h2h(aId, bId) {
    let a = 0, b = 0;
    for (const m of liveMatches()) {
      if (m.status !== "FINISHED" || !m.winner) continue;
      const ho = ownerId(m.home), ao = ownerId(m.away);
      const pair = (ho === aId && ao === bId) || (ho === bId && ao === aId);
      if (!pair) continue;
      const w = ownerId(canonical(m.winner));
      if (w === aId) a++; else if (w === bId) b++;
    }
    return b - a;
  }

  // =====================================================================
  //  RENDERERS
  // =====================================================================
  const el = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  function chip(pid) {
    const p = PLAYER_BY_ID[pid];
    if (!p) return "";
    return `<span class="chip" style="--c:${p.color}">${esc(p.name)}</span>`;
  }

  function teamLine(teams) {
    return teams.map(t => `${flag(t)}&nbsp;${esc(t)}`).join(", ");
  }

  const medals = ["🥇", "🥈", "🥉"];

  // ---- STANDINGS -------------------------------------------------------
  function renderStandings() {
    const rows = computeStandings();
    const html = rows.map((s, i) => {
      const rank = medals[i] || `<span class="rank__num">${i + 1}</span>`;
      return `
      <div class="lb-card" style="--c:${s.color}">
        <div class="lb-rank">${rank}</div>
        <div class="lb-body">
          <div class="lb-name">${esc(s.name)}</div>
          <div class="lb-teams">${teamLine(C.rosters[s.id])}</div>
        </div>
        <div class="lb-score">
          <div class="lb-wins">${s.wins}</div>
          <div class="lb-wins-label">WINS</div>
          <div class="lb-goals">⚽ ${s.goals} goals</div>
        </div>
      </div>`;
    }).join("");

    el("panel-standings").innerHTML = `
      <h2 class="section-title">Leaderboard</h2>
      <div class="lb-list">${html}</div>`;
  }

  // ---- DRAFT -----------------------------------------------------------
  function renderDraft() {
    const cards = C.players.map(p => {
      const teams = C.rosters[p.id].map(t =>
        `<li><span class="dt-flag">${flag(t)}</span> ${esc(t)} <span class="dt-owner" style="--c:${p.color}"></span></li>`
      ).join("");
      return `
      <div class="draft-card" style="--c:${p.color}">
        <div class="draft-card__head"><h3>${esc(p.name)}</h3><span class="draft-card__count">${C.rosters[p.id].length} teams</span></div>
        <ul class="draft-card__teams">${teams}</ul>
      </div>`;
    }).join("");
    el("panel-draft").innerHTML = `
      <h2 class="section-title">The Draft — who owns whom</h2>
      <div class="draft-grid">${cards}</div>`;
  }

  // ---- WIN TRACKER -----------------------------------------------------
  function ownersFor(team) {
    const o = ownerId(team);
    return o ? chip(o) : `<span class="chip chip--none">unowned</span>`;
  }

  function stageSections() {
    // group by stage, then (for group stage) by group letter
    const ms = liveMatches();
    const order = Object.keys(C.stages);
    const buckets = {};
    ms.forEach(m => {
      const key = m.stage === "GROUP" ? `GROUP:${m.group || "?"}` : m.stage;
      (buckets[key] = buckets[key] || []).push(m);
    });
    const keys = Object.keys(buckets).sort((a, b) => {
      const ra = order.indexOf(a.split(":")[0]), rb = order.indexOf(b.split(":")[0]);
      if (ra !== rb) return ra - rb;
      return a.localeCompare(b);
    });
    return keys.map(k => {
      const [stage, grp] = k.split(":");
      const label = stage === "GROUP" ? `Group ${grp}` : (C.stages[stage] || {}).label || stage;
      const list = buckets[k].sort((a, b) => (a.date || "").localeCompare(b.date || ""));
      return { label, matches: list };
    });
  }

  function matchRow(m) {
    const k = matchKey(m);
    const hs = Number.isFinite(m.homeScore) ? m.homeScore : "";
    const as = Number.isFinite(m.awayScore) ? m.awayScore : "";
    const res = resultOf(m); // 'W' (home), 'D', 'L' (home lost) or ''
    const pill = (v, cls) => `<button class="pill pill--${cls} ${res === v ? "is-on" : ""}" data-result="${v}" data-key="${esc(k)}">${cls === "win" ? "W" : cls === "draw" ? "D" : "L"}</button>`;
    const liveTag = m.status === "IN_PLAY" || m.status === "PAUSED"
      ? `<span class="tag tag--live">LIVE</span>` : "";
    const editTag = m.edited ? `<span class="tag tag--edit">edited</span>` : "";
    return `
    <div class="match" data-key="${esc(k)}">
      <div class="match__teams">
        <div class="mt"><span class="mt__flag">${flag(m.home)}</span><span class="mt__name">${esc(m.home)}</span> ${ownersFor(m.home)}</div>
        <div class="mt__vs">vs ${liveTag}${editTag}</div>
        <div class="mt"><span class="mt__flag">${flag(m.away)}</span><span class="mt__name">${esc(m.away)}</span> ${ownersFor(m.away)}</div>
      </div>
      <div class="match__score">
        <input class="score" type="number" min="0" inputmode="numeric" value="${hs}" data-key="${esc(k)}" data-side="home" aria-label="${esc(m.home)} score" />
        <span class="score__dash">–</span>
        <input class="score" type="number" min="0" inputmode="numeric" value="${as}" data-key="${esc(k)}" data-side="away" aria-label="${esc(m.away)} score" />
      </div>
      <div class="match__pills">${pill("W", "win")}${pill("D", "draw")}${pill("L", "loss")}</div>
    </div>`;
  }

  // result from home team's perspective
  function resultOf(m) {
    if (m.status === "FINISHED" && m.winner) {
      const w = canonical(m.winner);
      if (w === m.home) return "W";
      if (w === m.away) return "L";
    }
    if (Number.isFinite(m.homeScore) && Number.isFinite(m.awayScore)) {
      if (m.homeScore > m.awayScore) return "W";
      if (m.homeScore < m.awayScore) return "L";
      if (m.status === "FINISHED") return "D";
    }
    return "";
  }

  function renderTracker() {
    const sections = stageSections().map(s => `
      <div class="trk-group">
        <h3 class="trk-group__title">${esc(s.label)}</h3>
        ${s.matches.map(matchRow).join("")}
      </div>`).join("");

    el("panel-tracker").innerHTML = `
      <h2 class="section-title">Win Tracker — log results &amp; goals</h2>
      <p class="trk-help">Type a score and tap <b>W / D / L</b> to record an outcome. In knockouts, mark the advancing team as the winner (penalty-shootout wins count). Your edits save automatically and override the synced feed.</p>
      ${sections || `<p class="empty">No matches yet — add one below or connect the live feed.</p>`}
      ${addMatchForm()}`;
  }

  function addMatchForm() {
    const opts = Object.values(C.rosters).flat().sort()
      .map(t => `<option value="${esc(t)}">${flag(t)} ${esc(t)}</option>`).join("");
    const stageOpts = Object.entries(C.stages)
      .map(([k, v]) => `<option value="${k}">${esc(v.label)}</option>`).join("");
    return `
    <details class="add-match">
      <summary>➕ Add a match manually</summary>
      <div class="add-match__grid">
        <label>Stage<select id="am-stage">${stageOpts}</select></label>
        <label>Group<input id="am-group" maxlength="2" placeholder="A" /></label>
        <label>Home<select id="am-home">${opts}</select></label>
        <label>Away<select id="am-away">${opts}</select></label>
        <label>Home goals<input id="am-hs" type="number" min="0" inputmode="numeric" /></label>
        <label>Away goals<input id="am-as" type="number" min="0" inputmode="numeric" /></label>
        <label class="add-match__full">Winner (knockouts)
          <select id="am-winner"><option value="">— auto from score —</option></select>
        </label>
      </div>
      <button class="btn btn--solid" id="am-save">Save match</button>
    </details>`;
  }

  // =====================================================================
  //  RULES
  // =====================================================================
  function renderRules() {
    el("panel-rules").innerHTML = `
      <h2 class="section-title">How it works</h2>
      <div class="rule-card">
        <h3>🎯 Objective</h3>
        <p>Each player drafts 12 of the 48 World Cup teams. At the end of the tournament, whoever's teams have the most combined <b>wins</b> wins the challenge.</p>
      </div>
      <div class="rule-card">
        <h3>📋 Draft Rules</h3>
        <ol>
          <li>Each player picks 12 teams (48 ÷ 4). No team can be owned by more than one player.</li>
          <li>Draft order is your call — snake draft, auction, or random assignment all work.</li>
          <li>Group-stage wins = 1 win. Knockout wins (Round of 32 onward) = 1 win.</li>
          <li>Draws do <b>NOT</b> count as wins (not even penalty-shootout wins in knockouts — those are recorded as a win for the advancing team).</li>
        </ol>
      </div>
      <div class="rule-card">
        <h3>🏅 Tiebreaker Order</h3>
        <ol>
          <li><b>Total wins</b> — most wins overall</li>
          <li><b>Goals scored</b> — total goals scored by your teams across all matches</li>
          <li><b>Deepest run</b> — whoever has the team that went furthest in the tournament</li>
          <li><b>Head-to-head</b> — if two players' teams played each other, the match winner breaks the tie</li>
          <li>If still tied — split the prize equally</li>
        </ol>
      </div>
      <div class="rule-card">
        <h3>🗓️ Tournament Format</h3>
        <p>48 teams · 12 groups of 4 · Top 2 from each group + 8 best 3rd-place teams advance to Round of 32 → Round of 16 → QF → SF → Final. Teams can play up to 8 matches total.</p>
      </div>
      <div class="rule-card">
        <h3>💰 Prize</h3>
        <p>Set your own stakes. Suggested: everyone throws in $20. Winner takes all. Or just eternal bragging rights.</p>
      </div>`;
  }

  // =====================================================================
  //  EVENTS
  // =====================================================================
  function setOverride(key, patch) {
    const base = liveMatches().find(m => matchKey(m) === key);
    if (!base) return;
    const next = { ...(overrides[key] || {}), ...patch };
    overrides[key] = next;
    save(LS_OVERRIDES, overrides);
    renderStandings();
    renderTracker();
  }

  function onTrackerInput(e) {
    const t = e.target;
    if (t.classList.contains("score")) {
      const key = t.dataset.key, side = t.dataset.side;
      const v = t.value === "" ? null : Math.max(0, parseInt(t.value, 10) || 0);
      const field = side === "home" ? "homeScore" : "awayScore";
      const patch = { [field]: v };
      // Auto-mark finished if both scores present
      const m = { ...liveMatches().find(x => matchKey(x) === key), ...overrides[key], [field]: v };
      if (Number.isFinite(m.homeScore) && Number.isFinite(m.awayScore)) {
        patch.status = "FINISHED";
        if (m.stage === "GROUP") {
          patch.winner = m.homeScore > m.awayScore ? m.home : m.homeScore < m.awayScore ? m.away : null;
        }
      }
      setOverride(key, patch);
    }
  }

  function onTrackerClick(e) {
    const pill = e.target.closest(".pill");
    if (pill) {
      const key = pill.dataset.key, r = pill.dataset.result;
      const m = liveMatches().find(x => matchKey(x) === key);
      let winner = null;
      if (r === "W") winner = m.home;
      else if (r === "L") winner = m.away;
      setOverride(key, { status: "FINISHED", winner });
      return;
    }
    const saveBtn = e.target.closest("#am-save");
    if (saveBtn) { saveManualMatch(); }
  }

  function saveManualMatch() {
    const v = id => (el(id) ? el(id).value : "");
    const home = v("am-home"), away = v("am-away");
    if (!home || !away || home === away) { alert("Pick two different teams."); return; }
    const hs = v("am-hs") === "" ? null : parseInt(v("am-hs"), 10);
    const as = v("am-as") === "" ? null : parseInt(v("am-as"), 10);
    const stage = v("am-stage") || "GROUP";
    const finished = Number.isFinite(hs) && Number.isFinite(as);
    let winner = null;
    if (finished) winner = hs > as ? home : as > hs ? away : null;
    const m = {
      id: "manual-" + Date.now(), stage, group: v("am-group").toUpperCase() || null,
      date: new Date().toISOString().slice(0, 10),
      home, away, homeScore: hs, awayScore: as,
      status: finished ? "FINISHED" : "SCHEDULED", winner,
    };
    manual.push(m);
    save(LS_MANUAL, manual);
    renderStandings();
    renderTracker();
  }

  // ---- Tabs ------------------------------------------------------------
  function initTabs() {
    document.querySelectorAll(".tab").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".tab").forEach(b => b.classList.toggle("is-active", b === btn));
        const name = btn.dataset.tab;
        document.querySelectorAll(".panel").forEach(p =>
          p.classList.toggle("is-active", p.id === "panel-" + name));
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    });
  }

  // ---- Import / Export -------------------------------------------------
  function initTools() {
    el("exportBtn").addEventListener("click", () => {
      const blob = new Blob([JSON.stringify({ overrides, manual, exportedAt: new Date().toISOString() }, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "fantasy-wc26-mydata.json";
      a.click();
    });
    el("importBtn").addEventListener("click", () => el("importFile").click());
    el("importFile").addEventListener("change", async e => {
      const file = e.target.files[0]; if (!file) return;
      try {
        const data = JSON.parse(await file.text());
        if (data.overrides) { overrides = data.overrides; save(LS_OVERRIDES, overrides); }
        if (data.manual) { manual = data.manual; save(LS_MANUAL, manual); }
        renderAll();
        alert("Imported your saved data.");
      } catch { alert("That file couldn't be read."); }
    });
    el("resetBtn").addEventListener("click", () => {
      if (!confirm("Clear your manual edits and added matches on this device? The synced feed stays.")) return;
      overrides = {}; manual = [];
      localStorage.removeItem(LS_OVERRIDES); localStorage.removeItem(LS_MANUAL);
      renderAll();
    });
    el("panel-tracker").addEventListener("input", onTrackerInput);
    el("panel-tracker").addEventListener("click", onTrackerClick);
  }

  // ---- Sync line -------------------------------------------------------
  function renderSync() {
    const when = remote.lastSynced
      ? new Date(remote.lastSynced).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })
      : "—";
    const src = remote.source === "seed"
      ? "demo data (live feed not connected yet)"
      : remote.source;
    el("syncLine").innerHTML = `🔄 Results last synced: <b>${esc(when)}</b> · source: ${esc(src)}`;
    el("heroKicker").textContent = C.kicker;
    el("heroPlayers").textContent = C.players.map(p => p.name).join(" · ");
    el("heroDates").textContent = C.dates;
  }

  function renderAll() {
    renderSync();
    renderStandings();
    renderDraft();
    renderTracker();
    renderRules();
  }

  // ---- Boot ------------------------------------------------------------
  async function boot() {
    initTabs();
    renderAll();          // render immediately with whatever we have
    initTools();
    try {
      const res = await fetch("data/matches.json", { cache: "no-store" });
      if (res.ok) { remote = await res.json(); renderAll(); }
    } catch { /* offline / file:// — seed view still works */ }
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
