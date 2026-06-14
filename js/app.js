/* =====================================================================
   Fantasy WC26 — app logic
   - Loads results from data/matches.json (auto-synced by GitHub Action every 30 min)
   - Computes standings, win tracker, draft & rules views
   ===================================================================== */
(function () {
  "use strict";

  const C = window.CONFIG;

  // ---- Derived lookups -------------------------------------------------
  const PLAYER_BY_ID = Object.fromEntries(C.players.map(p => [p.id, p]));
  const TEAM_OWNER = {};
  for (const [pid, teams] of Object.entries(C.rosters)) {
    teams.forEach(t => { TEAM_OWNER[t] = pid; });
  }

  const flag = t => C.flags[t] || "🏳️";
  const ownerId = t => TEAM_OWNER[canonical(t)] || null;
  const canonical = name => (name && C.aliases[name]) || name;

  let remote = { matches: [], lastSynced: null, source: "live", syncNote: "" };

  function liveMatches() {
    return remote.matches.map(m => ({
      ...m,
      home: canonical(m.home),
      away: canonical(m.away),
    }));
  }

  // ---- Standings -------------------------------------------------------
  function computeStandings() {
    const stats = {};
    C.players.forEach(p => {
      stats[p.id] = { ...p, wins: 0, goals: 0, played: 0, deepest: 0 };
    });

    for (const m of liveMatches()) {
      const hasScore = Number.isFinite(m.homeScore) && Number.isFinite(m.awayScore);
      [["home", "away"], ["away", "home"]].forEach(([side]) => {
        const team = m[side];
        const pid = ownerId(team);
        if (!pid) return;
        const s = stats[pid];
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

  // ---- Per-team records ------------------------------------------------
  function teamStats() {
    const t = {};
    const ensure = name => (t[name] = t[name] || { w: 0, d: 0, l: 0, goals: 0, played: 0, koOut: false, bestStage: 0 });
    for (const m of liveMatches()) {
      const hasScore = Number.isFinite(m.homeScore) && Number.isFinite(m.awayScore);
      [["home", "homeScore"], ["away", "awayScore"]].forEach(([side, scoreKey]) => {
        const team = m[side];
        if (!ownerId(team)) return;
        const s = ensure(team);
        const rank = (C.stages[m.stage] || {}).rank || 1;
        if (rank > s.bestStage) s.bestStage = rank;
        if (!hasScore) return;
        s.goals += m[scoreKey];
        if (m.status !== "FINISHED") return;
        s.played += 1;
        const w = m.winner && canonical(m.winner);
        if (w === team) s.w += 1;
        else if (w) { s.l += 1; if (m.stage !== "GROUP") s.koOut = true; }
        else s.d += 1;
      });
    }
    return t;
  }

  function champion() {
    const fin = liveMatches().find(m => m.stage === "FINAL" && m.status === "FINISHED" && m.winner);
    if (!fin) return null;
    const team = canonical(fin.winner);
    return { team, owner: ownerId(team) };
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

    const champ = champion();
    const banner = champ ? `
      <div class="champ-banner">
        <div class="champ-banner__cup">🏆</div>
        <div>
          <div class="champ-banner__title">${flag(champ.team)} ${esc(champ.team)} are World Champions!</div>
          ${champ.owner ? `<div class="champ-banner__owner">Drafted by ${chip(champ.owner)}</div>` : ""}
        </div>
      </div>` : "";

    el("panel-standings").innerHTML = `
      ${banner}
      <h2 class="section-title">Leaderboard</h2>
      <div class="lb-list">${html}</div>`;

    // Highlight current leader card
    const cards = el("panel-standings").querySelectorAll(".lb-card");
    if (cards.length) cards[0].classList.add("is-leader");
  }

  // ---- DRAFT -----------------------------------------------------------
  function renderDraft() {
    const ts = teamStats();
    const cards = C.players.map(p => {
      let pw = 0, pg = 0;
      const teams = C.rosters[p.id].map(t => {
        const s = ts[t] || { w: 0, goals: 0, koOut: false, played: 0 };
        pw += s.w; pg += s.goals;
        const rec = s.played ? `<span class="dt-rec">${s.w}W · ⚽${s.goals}</span>` : `<span class="dt-rec dt-rec--none">—</span>`;
        const out = s.koOut ? `<span class="dt-out">OUT</span>` : "";
        return `<li><span class="dt-flag">${flag(t)}</span> <span class="dt-name">${esc(t)}</span> ${rec}${out}</li>`;
      }).join("");
      return `
      <div class="draft-card" style="--c:${p.color}">
        <div class="draft-card__head"><h3>${esc(p.name)}</h3><span class="draft-card__count">${pw}W · ⚽${pg}</span></div>
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

  function matchRow(m) {
    const isLive = m.status === "IN_PLAY" || m.status === "PAUSED";
    const hasScore = Number.isFinite(m.homeScore) && Number.isFinite(m.awayScore);
    const hs = hasScore ? m.homeScore : "–";
    const as = hasScore ? m.awayScore : "–";
    const res = resultOf(m);

    let cardClass = "match";
    if (isLive) cardClass += " is-live";
    else if (res === "W") cardClass += " is-home-win";
    else if (res === "L") cardClass += " is-away-win";
    else if (res === "D") cardClass += " is-draw";
    else cardClass += " is-scheduled";

    let center = "";
    if (isLive) {
      center = `<div class="match__score-display">${hs} – ${as}</div><span class="tag--live">LIVE</span>`;
    } else if (hasScore) {
      let badge = "";
      if (res === "W") badge = `<span class="result-badge result-badge--w">${esc(m.home)} win</span>`;
      else if (res === "L") badge = `<span class="result-badge result-badge--l">${esc(m.away)} win</span>`;
      else if (res === "D") badge = `<span class="result-badge result-badge--d">Draw</span>`;
      center = `<div class="match__score-display">${hs} – ${as}</div>${badge}`;
    } else {
      const d = m.date ? new Date(m.date + "T12:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "";
      center = `<div class="match__score-display is-pending">vs</div>${d ? `<div class="match__date">${esc(d)}</div>` : ""}`;
    }

    return `
    <div class="${cardClass}">
      <div class="match__scoreboard">
        <div class="match__team match__team--home">
          <span class="mt__flag">${flag(m.home)}</span>
          <span class="mt__name">${esc(m.home)}</span>
          <span class="mt__chip">${ownersFor(m.home)}</span>
        </div>
        <div class="match__center">${center}</div>
        <div class="match__team match__team--away">
          <span class="mt__flag">${flag(m.away)}</span>
          <span class="mt__name">${esc(m.away)}</span>
          <span class="mt__chip">${ownersFor(m.away)}</span>
        </div>
      </div>
    </div>`;
  }

  function renderTracker() {
    const sections = stageSections().map(s => `
      <div class="trk-group">
        <h3 class="trk-group__title">${esc(s.label)}</h3>
        ${s.matches.map(matchRow).join("")}
      </div>`).join("");

    el("panel-tracker").innerHTML = `
      <h2 class="section-title">Win Tracker</h2>
      ${sections || `<p class="empty">Results loading — check back shortly.</p>`}`;
  }

  // ---- RULES -----------------------------------------------------------
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

  // ---- Sync line -------------------------------------------------------
  function timeAgo(iso) {
    if (!iso) return "—";
    const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins} min ago`;
    const hrs = Math.round(mins / 60);
    return hrs === 1 ? "1 hour ago" : `${hrs} hours ago`;
  }

  function renderSync() {
    el("syncLine").innerHTML = `🔄 Last synced <b>${esc(timeAgo(remote.lastSynced))}</b> · auto-updates every 30 min`;
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

  // ---- Live refresh ----------------------------------------------------
  let lastFetchSig = "";
  async function refreshResults(flash) {
    try {
      const res = await fetch("data/matches.json", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      const sig = JSON.stringify(data.matches) + (data.lastSynced || "");
      if (sig === lastFetchSig) return;
      lastFetchSig = sig;
      remote = data;
      renderAll();
      if (flash) {
        const line = el("syncLine");
        if (line) { line.classList.add("is-flash"); setTimeout(() => line.classList.remove("is-flash"), 1200); }
      }
    } catch { /* offline — keep showing what we have */ }
  }

  // ---- Boot ------------------------------------------------------------
  async function boot() {
    initTabs();
    renderAll();
    await refreshResults(false);

    setInterval(() => refreshResults(true), 60 * 1000);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") refreshResults(true);
    });

    if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    }
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
