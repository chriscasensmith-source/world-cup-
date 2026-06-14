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
    return `<span class="chip" data-player="${p.id}" style="--c:${p.color}">${esc(p.name)}</span>`;
  }

  function teamLine(teams) {
    return teams.map(t => `<span class="team-link" data-team="${esc(t)}">${flag(t)}&nbsp;${esc(t)}</span>`).join(", ");
  }

  const medals = ["🥇", "🥈", "🥉"];
  const RANK_LABEL = { 1: "Group stage", 2: "Round of 32", 3: "Round of 16", 4: "Quarter-finals", 5: "Semi-finals", 6: "Final / Champion" };
  const fmtDate = d => d ? new Date(d + "T12:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "";

  // ---- STANDINGS -------------------------------------------------------
  function renderStandings() {
    const rows = computeStandings();
    const html = rows.map((s, i) => {
      const rank = medals[i] || `<span class="rank__num">${i + 1}</span>`;
      return `
      <div class="lb-card clickable" data-player="${s.id}" style="--c:${s.color}">
        <div class="lb-rank">${rank}</div>
        <div class="lb-body">
          <div class="lb-name">${esc(s.name)}<span class="lb-go">›</span></div>
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
        return `<li class="team-link" data-team="${esc(t)}"><span class="dt-flag">${flag(t)}</span> <span class="dt-name">${esc(t)}</span> ${rec}${out}</li>`;
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
        <div class="match__team match__team--home team-link" data-team="${esc(m.home)}">
          <span class="mt__flag">${flag(m.home)}</span>
          <span class="mt__name">${esc(m.home)}</span>
          <span class="mt__chip">${ownersFor(m.home)}</span>
        </div>
        <div class="match__center">${center}</div>
        <div class="match__team match__team--away team-link" data-team="${esc(m.away)}">
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

  // =====================================================================
  //  DETAIL VIEWS (player & team breakdowns)
  // =====================================================================
  function teamRecord(team) {
    team = canonical(team);
    const ms = liveMatches()
      .filter(m => m.home === team || m.away === team)
      .sort((a, b) => (a.date || "").localeCompare(b.date || ""));
    let w = 0, d = 0, l = 0, gf = 0, ga = 0, best = 0, koOut = false;
    const rows = ms.map(m => {
      const home = m.home === team;
      const opp = home ? m.away : m.home;
      const hasScore = Number.isFinite(m.homeScore) && Number.isFinite(m.awayScore);
      const tf = home ? m.homeScore : m.awayScore;
      const ta = home ? m.awayScore : m.homeScore;
      const rank = (C.stages[m.stage] || {}).rank || 1;
      if (rank > best) best = rank;
      let res = "";
      if (hasScore) { gf += tf; ga += ta; }
      if (m.status === "FINISHED") {
        if (m.winner) {
          if (canonical(m.winner) === team) { w++; res = "W"; }
          else { l++; res = "L"; if (m.stage !== "GROUP") koOut = true; }
        } else { d++; res = "D"; }
      } else if (m.status === "IN_PLAY" || m.status === "PAUSED") {
        res = "LIVE";
      }
      return { m, opp, hasScore, tf, ta, res };
    });
    return { team, rows, w, d, l, gf, ga, best, koOut, played: w + d + l };
  }

  function resultBadge(res) {
    if (res === "W") return `<span class="rb rb--w">W</span>`;
    if (res === "L") return `<span class="rb rb--l">L</span>`;
    if (res === "D") return `<span class="rb rb--d">D</span>`;
    if (res === "LIVE") return `<span class="rb rb--live">LIVE</span>`;
    return "";
  }

  function teamDetailHTML(team) {
    const r = teamRecord(team);
    const owner = ownerId(team);
    const status = r.koOut ? "Eliminated"
      : r.best > 1 ? `Reached ${RANK_LABEL[r.best]}`
      : r.played ? "In the group stage"
      : "Yet to kick off";
    const matchRows = r.rows.map(x => {
      const { m, opp, hasScore, tf, ta, res } = x;
      const score = hasScore ? `${tf}–${ta}` : "vs";
      const stage = m.stage === "GROUP" ? `Group ${m.group || ""}` : (C.stages[m.stage] || {}).label || m.stage;
      return `
      <div class="dt-match">
        <div class="dt-match__opp"><span class="team-link" data-team="${esc(opp)}">${flag(opp)} ${esc(opp)}</span> ${ownersFor(opp)}</div>
        <div class="dt-match__score">${esc(score)} ${resultBadge(res)}</div>
        <div class="dt-match__meta">${esc(stage)}${m.date ? " · " + esc(fmtDate(m.date)) : ""}</div>
      </div>`;
    }).join("");
    return `
    <div class="detail">
      <div class="detail__head">
        <div class="detail__flag">${flag(r.team)}</div>
        <div>
          <div class="detail__title">${esc(r.team)}</div>
          <div class="detail__sub">${owner ? `Drafted by ${chip(owner)}` : "Not drafted"}</div>
        </div>
      </div>
      <div class="detail__stats">
        <div class="stat"><div class="stat__v">${r.w}</div><div class="stat__k">Wins</div></div>
        <div class="stat"><div class="stat__v">${r.d}</div><div class="stat__k">Draws</div></div>
        <div class="stat"><div class="stat__v">${r.l}</div><div class="stat__k">Losses</div></div>
        <div class="stat"><div class="stat__v">${r.gf}</div><div class="stat__k">Goals for</div></div>
        <div class="stat"><div class="stat__v">${r.ga}</div><div class="stat__k">Goals ag.</div></div>
      </div>
      <div class="detail__status ${r.koOut ? "is-out" : ""}">${esc(status)}</div>
      <h4 class="detail__h">Matches</h4>
      ${matchRows || `<p class="empty">No matches yet.</p>`}
    </div>`;
  }

  function playerDetailHTML(pid) {
    const standings = computeStandings();
    const idx = standings.findIndex(s => s.id === pid);
    const s = standings[idx];
    const p = PLAYER_BY_ID[pid];
    const recs = C.rosters[pid].map(teamRecord);
    const alive = recs.filter(r => !r.koOut).length;
    const rankBadge = medals[idx] || `#${idx + 1}`;
    const teamRows = recs.map(r => {
      const out = r.koOut ? `<span class="dt-out">OUT</span>` : "";
      const rec = r.played
        ? `${r.w}W-${r.d}D-${r.l}L · ⚽${r.gf}`
        : `<span class="muted">not started</span>`;
      return `
      <div class="pd-team team-link" data-team="${esc(r.team)}">
        <span class="pd-team__name">${flag(r.team)} ${esc(r.team)}</span>
        <span class="pd-team__rec">${rec} ${out}<span class="pd-go">›</span></span>
      </div>`;
    }).join("");
    return `
    <div class="detail">
      <div class="detail__head">
        <div class="detail__rank" style="--c:${p.color}">${rankBadge}</div>
        <div>
          <div class="detail__title" style="color:${p.color}">${esc(p.name)}</div>
          <div class="detail__sub">${s.wins} wins · ${s.goals} goals</div>
        </div>
      </div>
      <div class="detail__stats">
        <div class="stat"><div class="stat__v">${s.wins}</div><div class="stat__k">Wins</div></div>
        <div class="stat"><div class="stat__v">${s.goals}</div><div class="stat__k">Goals</div></div>
        <div class="stat"><div class="stat__v">${alive}/12</div><div class="stat__k">Alive</div></div>
        <div class="stat"><div class="stat__v stat__v--sm">${esc(RANK_LABEL[s.deepest] || "—")}</div><div class="stat__k">Deepest run</div></div>
      </div>
      <h4 class="detail__h">Squad — tap a team for details</h4>
      <div class="pd-teams">${teamRows}</div>
    </div>`;
  }

  // ---- Modal (with drill-down stack: player ▸ team) --------------------
  let modalStack = [];
  function renderModal() {
    const m = el("modal");
    if (!modalStack.length) { m.hidden = true; m.style.display = "none"; m.innerHTML = ""; document.body.classList.remove("modal-open"); return; }
    const top = modalStack[modalStack.length - 1];
    const inner = top.type === "player" ? playerDetailHTML(top.id) : teamDetailHTML(top.id);
    const back = modalStack.length > 1
      ? `<button class="modal__btn" data-modal="back">‹ Back</button>`
      : `<span></span>`;
    m.innerHTML = `
      <div class="modal__backdrop" data-modal="close"></div>
      <div class="modal__sheet" role="dialog" aria-modal="true">
        <div class="modal__bar">${back}<button class="modal__btn modal__close" data-modal="close">✕ Close</button></div>
        <div class="modal__content">${inner}</div>
      </div>`;
    m.hidden = false;
    m.style.display = "flex";
    document.body.classList.add("modal-open");
  }
  function openPlayer(id) { modalStack.push({ type: "player", id }); renderModal(); }
  function openTeam(id) { modalStack.push({ type: "team", id: canonical(id) }); renderModal(); }

  function initInteractions() {
    document.addEventListener("click", e => {
      const md = e.target.closest("[data-modal]");
      if (md) {
        if (md.dataset.modal === "close") modalStack = [];
        else if (md.dataset.modal === "back") modalStack.pop();
        renderModal();
        return;
      }
      const hit = e.target.closest("[data-team],[data-player]");
      if (!hit) return;
      if (hit.dataset.team !== undefined) openTeam(hit.dataset.team);
      else if (hit.dataset.player !== undefined) openPlayer(hit.dataset.player);
    });
    document.addEventListener("keydown", e => {
      if (e.key === "Escape" && modalStack.length) { modalStack.pop(); renderModal(); }
    });
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
    const synced = remote.lastSynced;
    const checked = remote.lastChecked || synced;
    const ago = timeAgo(checked);
    el("syncLine").innerHTML = `🔄 Checked for results <b>${esc(ago)}</b>`;
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
    if (modalStack.length) renderModal();   // keep an open breakdown current
  }

  // ---- Live refresh ----------------------------------------------------
  let lastFetchSig = "";
  async function refreshResults(flash) {
    try {
      const res = await fetch("data/matches.json?_=" + Date.now(), { cache: "no-store" });
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
    initInteractions();
    renderAll();
    await refreshResults(false);

    setInterval(() => refreshResults(true), 60 * 1000);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") refreshResults(true);
    });

    document.getElementById("hardReloadBtn")?.addEventListener("click", hardReload);

    if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
      navigator.serviceWorker.register("sw.js").then(reg => {
        // iOS PWA won't detect a new SW unless we call update() proactively.
        const checkUpdate = () => reg.update().catch(() => {});
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") checkUpdate();
        });
        setInterval(checkUpdate, 5 * 60 * 1000);

        reg.addEventListener("updatefound", () => {
          const newWorker = reg.installing;
          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              showUpdateBanner();
            }
          });
        });
      }).catch(() => {});
    }

    async function hardReload() {
      // Unregister SW and wipe all caches so the reload fetches everything fresh.
      try {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(r => r.unregister()));
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      } catch (_) {}
      location.reload();
    }

    function showUpdateBanner() {
      if (document.getElementById("update-banner")) return;
      const b = document.createElement("div");
      b.id = "update-banner";
      b.innerHTML = `<span>🆕 New version available</span><button id="update-btn">Tap to update</button>`;
      document.body.appendChild(b);
      document.getElementById("update-btn").addEventListener("click", hardReload);
    }
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
