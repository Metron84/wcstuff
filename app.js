/* ============================================================
   THE REFLECTIVE — World Cup 2026  ·  app logic
   ============================================================ */
(function () {
  const { TEAMS, GROUPS, GROUP_MATCHES, KNOCKOUT, BRACKET } = window.WC;
  const TZ = "Asia/Dubai";
  const STORE_KEY = "reflective-wc26-v1";

  /* ---------- persistent state ---------- */
  const state = loadState();
  function loadState() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return {
      order: Object.fromEntries(Object.entries(GROUPS).map(([g, t]) => [g, [...t]])),
      thirds: [],          // up to 8 codes chosen as best third-placed teams
      thirdAssign: {},      // slotKey -> team code (auto by default)
      winners: {},          // matchId -> "home"|"away"
    };
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) {}
  }

  /* ---------- time helpers (ET -> UTC -> Dubai) ---------- */
  // Eastern Daylight Time in June/July 2026 is UTC-4, so UTC = ET + 4h.
  function etToDate(et) {
    const [y, m, d, h, min] = et;
    return new Date(Date.UTC(y, m - 1, d, h + 4, min));
  }
  const fmtTime = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false,
  });
  const fmtDayKey = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
  });
  const fmtWeekday = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, weekday: "long" });
  const fmtDayNum = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, day: "numeric" });
  const fmtMonth = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, month: "short" });
  const fmtWeekdayShort = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, weekday: "short" });

  function dayKey(date) { return fmtDayKey.format(date); }
  function teamName(code) { return TEAMS[code] ? TEAMS[code].name : code; }
  function teamFlag(code) { return TEAMS[code] ? TEAMS[code].flag : "⚽"; }

  /* ---------- build the full day-by-day schedule ---------- */
  // Group matches -> objects with a Dubai Date.
  const allMatches = [];
  GROUP_MATCHES.forEach((m, i) => {
    const date = etToDate(m.et);
    allMatches.push({
      kind: "group", group: m.g, home: m.h, away: m.a,
      venue: m.venue, city: m.city, date, sortable: true,
      number: i + 1,
    });
  });
  // Knockout matches -> noon-ET anchor on their date (time confirmed later by FIFA).
  Object.entries(KNOCKOUT).forEach(([rk, round]) => {
    round.matches.forEach((mm) => {
      const date = etToDate([...mm.date, 16, 0]); // 16:00 ET placeholder
      allMatches.push({
        kind: "ko", round: rk, roundLabel: round.label, id: mm.id,
        venue: mm.venue, city: mm.city, date, sortable: false,
      });
    });
  });
  allMatches.sort((a, b) => a.date - b.date);

  // Group by Dubai day
  const days = [];
  const dayIndex = {};
  allMatches.forEach((m) => {
    const k = dayKey(m.date);
    if (!(k in dayIndex)) {
      dayIndex[k] = days.length;
      days.push({ key: k, date: m.date, matches: [] });
    }
    days[dayIndex[k]].matches.push(m);
  });

  /* ============================================================
     SCHEDULE VIEW
     ============================================================ */
  function renderSchedule() {
    const root = document.getElementById("view-schedule");
    const todayKey = dayKey(new Date());

    // day chips
    const chips = days.map((d, i) => {
      const isToday = d.key === todayKey;
      return `<button class="chip ${isToday ? "today" : ""}" data-day="${i}">
        <span class="d">${fmtDayNum.format(d.date)} ${fmtMonth.format(d.date)}</span>
        · ${fmtWeekdayShort.format(d.date)}${isToday ? " ●" : ""}
      </button>`;
    }).join("");

    const blocks = days.map((d, i) => {
      const rows = d.matches.map((m) => matchCard(m)).join("");
      return `<div class="day-block" id="day-${i}" data-day="${i}">
        <div class="day-label">
          <span class="dnum">${fmtDayNum.format(d.date)}</span>
          <span>
            <span class="dmonth">${fmtMonth.format(d.date)} 2026</span><br>
            <span class="dweek">${fmtWeekday.format(d.date)}</span>
          </span>
          <span class="line"></span>
          <span class="count">${d.matches.length} ${d.matches.length === 1 ? "match" : "matches"}</span>
        </div>
        ${rows}
      </div>`;
    }).join("");

    root.innerHTML = `
      <div class="section-head">
        <h3>Match Calendar</h3>
        <span class="note">All kick-offs shown in UAE time (GST, UTC+4)</span>
      </div>
      <div class="daybar">${chips}</div>
      ${blocks}
    `;

    root.querySelectorAll(".chip").forEach((c) => {
      c.addEventListener("click", () => {
        root.querySelectorAll(".chip").forEach((x) => x.classList.remove("active"));
        c.classList.add("active");
        const el = document.getElementById("day-" + c.dataset.day);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });

    // jump to today (or nearest upcoming) on first render
    let target = days.findIndex((d) => d.key >= todayKey);
    if (target < 0) target = 0;
    const chip = root.querySelector(`.chip[data-day="${target}"]`);
    if (chip) chip.classList.add("active");
  }

  function matchCard(m) {
    const time = fmtTime.format(m.date);
    if (m.kind === "group") {
      return `<div class="match">
        <div class="time">${time}<small>GST</small></div>
        <div class="fixture">
          <div class="teams">
            <span class="t"><span class="fl">${teamFlag(m.home)}</span><span class="nm">${teamName(m.home)}</span></span>
            <span class="v">v</span>
            <span class="t"><span class="fl">${teamFlag(m.away)}</span><span class="nm">${teamName(m.away)}</span></span>
          </div>
          <div class="place"><span class="gp">GROUP ${m.group}</span> ${m.venue} · ${m.city}</div>
        </div>
        <div class="badge">M${m.number}</div>
      </div>`;
    }
    // knockout: resolve slots from current predictions
    const tie = BRACKET[m.id];
    const home = resolveSlot(tie.home);
    const away = resolveSlot(tie.away);
    return `<div class="match ko">
      <div class="time">${time}<small>GST · TBC</small></div>
      <div class="fixture">
        <div class="teams">
          ${slotInline(home)}
          <span class="v">v</span>
          ${slotInline(away)}
        </div>
        <div class="place"><span class="gp">${m.roundLabel.toUpperCase()}</span> ${m.venue} · ${m.city}</div>
      </div>
      <div class="badge">${m.id}</div>
    </div>`;
  }
  function slotInline(res) {
    if (res.code) {
      return `<span class="t"><span class="fl">${teamFlag(res.code)}</span><span class="nm">${teamName(res.code)}</span></span>`;
    }
    return `<span class="t"><span class="nm slot">${res.label}</span></span>`;
  }

  /* ============================================================
     STANDINGS / GROUPS VIEW  (editable order)
     ============================================================ */
  // Keep dependents in sync whenever the group order changes.
  function pruneThirds() {
    const valid = new Set(Object.keys(GROUPS).map((g) => state.order[g][2]));
    state.thirds = state.thirds.filter((c) => valid.has(c));
  }
  function syncFromGroups() {
    pruneThirds();
    save();
    renderGroups();
    renderBracket();   // R32 seeds + third-place picker update live
    renderSchedule();  // knockout fixtures reflect new group finishers
  }

  function renderGroups() {
    const root = document.getElementById("view-groups");
    const cards = Object.keys(GROUPS).map((g) => groupCard(g)).join("");
    root.innerHTML = `
      <div class="section-head">
        <h3>Group Standings — Your Call</h3>
        <div class="actions">
          <button class="btn danger" id="reset-groups">Reset order</button>
        </div>
      </div>
      <p class="note" style="margin-bottom:16px;color:var(--bone-faint)">
        Drag a team, or use the arrows, to set your predicted finishing order in each group.
        Top two qualify automatically; third place enters the race for the eight best third-placed spots.
      </p>
      <div class="groups-grid">${cards}</div>
    `;
    wireGroupControls(root);
    document.getElementById("reset-groups").addEventListener("click", () => {
      state.order = Object.fromEntries(Object.entries(GROUPS).map(([g, t]) => [g, [...t]]));
      syncFromGroups();
    });
  }

  function groupCard(g) {
    const order = state.order[g];
    const rows = order.map((code, i) => {
      const cls = i === 0 ? "q1" : i === 1 ? "q2" : i === 2 ? "q3" : "";
      const tag = i < 2 ? "Advance" : i === 2 ? "3rd race" : "";
      return `<div class="srow ${cls}" draggable="true" data-group="${g}" data-idx="${i}">
        <div class="pos">${i + 1}</div>
        <div class="team" data-group="${g}" data-idx="${i}">
          <span class="fl">${teamFlag(code)}</span>
          <span class="nm">${teamName(code)}</span>
          ${tag ? `<span class="qtag">${tag}</span>` : ""}
        </div>
        <div class="move">
          <button data-act="up" data-group="${g}" data-idx="${i}" ${i === 0 ? "disabled" : ""} aria-label="Move up">↑</button>
          <button data-act="down" data-group="${g}" data-idx="${i}" ${i === 3 ? "disabled" : ""} aria-label="Move down">↓</button>
        </div>
      </div>`;
    }).join("");
    return `<div class="gcard">
      <div class="gh"><span class="gtitle">Group ${g}</span><span class="ghelp">drag to reorder</span></div>
      <div class="standings" data-group="${g}">${rows}</div>
      <div class="gfoot">
        <span class="key"><span class="dot b"></span> Top 2 advance</span>
        <span class="key"><span class="dot g"></span> 3rd-place race</span>
      </div>
    </div>`;
  }

  function wireGroupControls(root) {
    // arrows
    root.querySelectorAll(".move button").forEach((b) => {
      b.addEventListener("click", () => {
        const g = b.dataset.group, i = +b.dataset.idx;
        const arr = state.order[g];
        const j = b.dataset.act === "up" ? i - 1 : i + 1;
        if (j < 0 || j > 3) return;
        [arr[i], arr[j]] = [arr[j], arr[i]];
        syncFromGroups();
      });
    });
    // drag & drop
    let dragG = null, dragI = null;
    root.querySelectorAll(".srow").forEach((row) => {
      row.addEventListener("dragstart", (e) => {
        dragG = row.dataset.group; dragI = +row.dataset.idx;
        row.classList.add("dragging");
        e.dataTransfer.effectAllowed = "move";
      });
      row.addEventListener("dragend", () => row.classList.remove("dragging"));
      row.addEventListener("dragover", (e) => {
        if (row.dataset.group !== dragG) return;
        e.preventDefault(); row.classList.add("dragover");
      });
      row.addEventListener("dragleave", () => row.classList.remove("dragover"));
      row.addEventListener("drop", (e) => {
        e.preventDefault(); row.classList.remove("dragover");
        const g = row.dataset.group, ti = +row.dataset.idx;
        if (g !== dragG || ti === dragI) return;
        const arr = state.order[g];
        const [moved] = arr.splice(dragI, 1);
        arr.splice(ti, 0, moved);
        syncFromGroups();
      });
    });
  }

  /* ============================================================
     BRACKET PREDICTOR
     ============================================================ */
  // Resolve a slot label like "1A", "2C", "3CEFI", "WR32-1" to a team code (or label).
  function resolveSlot(slot) {
    if (!slot) return { label: "—", short: "—" };
    // group winner / runner-up
    let m = /^([12])([A-L])$/.exec(slot);
    if (m) {
      const pos = +m[1] - 1, g = m[2];
      return { code: state.order[g][pos], label: (m[1] === "1" ? "Winner " : "Runner-up ") + "Group " + g, short: slot };
    }
    // third-place destination: "3CEFI" etc. -> assigned third from the pool
    m = /^3([A-L]+)$/.exec(slot);
    if (m) {
      const assigned = state.thirdAssign[slot];
      if (assigned) return { code: assigned, label: "3rd place" };
      return { label: "3rd place (" + m[1].split("").join("/") + ")", short: "3rd " + m[1] };
    }
    // winner / loser of a previous tie
    m = /^([WL])([A-Z0-9]+-\d+)$/.exec(slot);
    if (m) {
      const prevId = m[2];
      const w = state.winners[prevId];
      const tie = BRACKET[prevId];
      if (w && tie) {
        const res = resolveSlot(tie[w]);
        if (res.code) return { code: res.code, label: "" };
      }
      const lbl = (m[1] === "W" ? "Winner " : "Loser ") + prevId;
      return { label: lbl, short: (m[1] === "W" ? "▸ " : "▹ ") + prevId };
    }
    return { label: slot, short: slot };
  }

  // The eight best third-placed teams the user has selected, auto-assigned to slots in order.
  function autoAssignThirds() {
    // collect the third-placed team in each group
    const thirdSlots = []; // {slot, allowed:[groups]}
    Object.values(BRACKET).forEach((t) => {
      ["home", "away"].forEach((side) => {
        const s = t[side];
        const mm = /^3([A-L]+)$/.exec(s || "");
        if (mm) thirdSlots.push({ slot: s, allowed: mm[1].split("") });
      });
    });
    // chosen thirds (codes), mapped to their group
    const chosen = state.thirds.slice(0, 8).map((code) => {
      const g = Object.keys(GROUPS).find((gg) => state.order[gg][2] === code);
      return { code, group: g };
    }).filter((x) => x.group);

    const assign = {};
    const used = new Set();
    // greedy: fill most-constrained slots first, honouring the group filter
    const slots = [...thirdSlots].sort((a, b) => a.allowed.length - b.allowed.length);
    slots.forEach((sl) => {
      const pick = chosen.find((c) => !used.has(c.code) && sl.allowed.includes(c.group));
      if (pick) { assign[sl.slot] = pick.code; used.add(pick.code); }
    });
    // fallback: any still-empty slot takes any remaining chosen third, so all
    // eight always make the bracket (FIFA's exact allocation table is finalised
    // only once the real third-placed groups are known).
    slots.forEach((sl) => {
      if (assign[sl.slot]) return;
      const pick = chosen.find((c) => !used.has(c.code));
      if (pick) { assign[sl.slot] = pick.code; used.add(pick.code); }
    });
    state.thirdAssign = assign;
  }

  // Drop any knockout pick whose chosen side no longer resolves to a team
  // (e.g. after a group reorder changes who finishes where). Cascades.
  function validateWinners() {
    let changed = true;
    while (changed) {
      changed = false;
      Object.keys(state.winners).forEach((id) => {
        const tie = BRACKET[id];
        if (!tie) { delete state.winners[id]; changed = true; return; }
        const res = resolveSlot(tie[state.winners[id]]);
        if (!res.code) { delete state.winners[id]; changed = true; }
      });
    }
  }

  /* ---- knockout match info (date/city/round) keyed by id ---- */
  const KO_INFO = {};
  Object.entries(KNOCKOUT).forEach(([rk, r]) =>
    r.matches.forEach((mm) => { KO_INFO[mm.id] = { date: mm.date, city: mm.city, round: r.label, rk }; })
  );

  let bracketScale = 0;          // 0 = not yet set
  let bracketResizeBound = false;
  let panScroll = { l: 0, t: 0 }, restorePan = false;
  function stashScroll() {
    const vp = document.getElementById("bviewport");
    if (vp) { panScroll = { l: vp.scrollLeft, t: vp.scrollTop }; restorePan = true; }
  }

  function renderBracket() {
    const root = document.getElementById("view-bracket");
    const thirdCandidates = Object.keys(GROUPS).map((g) => ({ g, code: state.order[g][2] }));
    autoAssignThirds();
    validateWinners();

    const finRes = state.winners["FIN-1"];
    let champ = { label: "" };
    if (finRes) champ = resolveSlot(BRACKET["FIN-1"][finRes]);

    // left half (top), right half (bottom), centre = final
    const L = {
      R32: ["R32-1","R32-2","R32-3","R32-4","R32-5","R32-6","R32-7","R32-8"],
      R16: ["R16-1","R16-2","R16-3","R16-4"],
      QF:  ["QF-1","QF-2"],
      SF:  ["SF-1"],
    };
    const R = {
      R32: ["R32-9","R32-10","R32-11","R32-12","R32-13","R32-14","R32-15","R32-16"],
      R16: ["R16-5","R16-6","R16-7","R16-8"],
      QF:  ["QF-3","QF-4"],
      SF:  ["SF-2"],
    };

    const leftSide = `
      <div class="bcol c-r32">${L.R32.map(bnode).join("")}</div>
      <div class="bcol c-r16">${L.R16.map(bnode).join("")}</div>
      <div class="bcol c-qf">${L.QF.map(bnode).join("")}</div>
      <div class="bcol c-sf">${L.SF.map(bnode).join("")}</div>`;
    const rightSide = `
      <div class="bcol c-sf">${R.SF.map(bnode).join("")}</div>
      <div class="bcol c-qf">${R.QF.map(bnode).join("")}</div>
      <div class="bcol c-r16">${R.R16.map(bnode).join("")}</div>
      <div class="bcol c-r32">${R.R32.map(bnode).join("")}</div>`;
    const centre = `
      <div class="bcol c-final">
        <div class="final-stack">
          ${bnode("FIN-1")}
          <div class="champ-plate ${champ.code ? "" : "empty"}">
            <span class="lbl">Champion</span>
            <span class="who">${champ.code
              ? `<span class="fl">${teamFlag(champ.code)}</span> ${teamName(champ.code)}`
              : "—"}</span>
          </div>
          ${bnode("TP-1")}
        </div>
      </div>`;

    root.innerHTML = `
      <div class="section-head">
        <h3>Knockout Predictor</h3>
        <div class="actions">
          <div class="zoomer">
            <button class="zbtn" id="z-out" aria-label="Zoom out">−</button>
            <button class="zbtn wide" id="z-fit">Fit</button>
            <span id="zoom-lbl" class="zlbl">100%</span>
            <button class="zbtn" id="z-in" aria-label="Zoom in">+</button>
          </div>
          <button class="btn danger" id="reset-bracket">Reset</button>
        </div>
      </div>

      <details class="thirds-d" id="thirds-d" ${state.thirds.length < 8 ? "open" : ""}>
        <summary>Best third-placed teams <b class="${state.thirds.length>=8?"full":""}">${state.thirds.length}/8</b><span class="hint">— tap to choose the eight that reach the Round of 32</span></summary>
        ${thirdsPicker(thirdCandidates)}
      </details>

      <div class="bracket-viewport" id="bviewport">
        <div class="bracket-sizer" id="bsizer">
          <div class="bracket-canvas" id="bcanvas">
            <svg class="bsvg" id="bsvg" xmlns="http://www.w3.org/2000/svg"></svg>
            <div class="bside left">${leftSide}</div>
            ${centre}
            <div class="bside right">${rightSide}</div>
          </div>
        </div>
      </div>
      <p class="bracket-hint">Tap a team to send them through · drag to pan · pinch or use ＋ / − to zoom</p>
    `;

    wireBracket(root);
    document.getElementById("reset-bracket").addEventListener("click", () => {
      state.winners = {}; state.thirds = []; state.thirdAssign = {};
      save(); renderBracket(); renderSchedule();
    });
    document.getElementById("z-in").addEventListener("click", () => applyScale(Math.min(1.8, (bracketScale||1) + 0.15)));
    document.getElementById("z-out").addEventListener("click", () => applyScale(Math.max(0.3, (bracketScale||1) - 0.15)));
    document.getElementById("z-fit").addEventListener("click", () => applyScale(fitScale()));

    if (!bracketResizeBound) {
      window.addEventListener("resize", () => {
        if (document.getElementById("view-bracket").classList.contains("active")) applyScale(bracketScale || fitScale());
      });
      bracketResizeBound = true;
    }
    // draw once layout settles (only meaningful when visible)
    requestAnimationFrame(() => {
      if (document.getElementById("view-bracket").classList.contains("active")) {
        applyScale(bracketScale || fitScale());
      }
    });
  }

  function bnode(id) {
    const tie = BRACKET[id];
    const info = KO_INFO[id];
    const home = resolveSlot(tie.home);
    const away = resolveSlot(tie.away);
    const win = state.winners[id];
    const d = info ? etToDate([...info.date, 16, 0]) : null;
    const dstr = d ? `${fmtDayNum.format(d)} ${fmtMonth.format(d)}` : "";
    const tag = id === "FIN-1" ? "FINAL" : id === "TP-1" ? "3RD PLACE" : id;
    const cls = id === "FIN-1" ? "final" : id === "TP-1" ? "tp" : "";
    return `<div class="bnode ${cls}" data-id="${id}">
      <div class="bn-meta"><span>${tag}</span><span>${dstr}</span></div>
      ${slotRow(id, "home", home, win === "home")}
      ${slotRow(id, "away", away, win === "away")}
    </div>`;
  }

  function thirdsPicker(candidates) {
    const full = state.thirds.length >= 8;
    const pills = candidates.map(({ g, code }) => {
      const on = state.thirds.includes(code);
      const disabled = !on && full;
      return `<button class="third-pill ${on ? "on" : "off"} ${disabled ? "disabled" : ""}"
        data-code="${code}" ${disabled ? "disabled" : ""}>
        <span class="fl">${teamFlag(code)}</span> ${teamName(code)}
        <span class="ct">3${g}</span>
      </button>`;
    }).join("");
    return `<div class="thirds-row">${pills}</div>`;
  }

  function slotRow(id, side, res, advanced) {
    const pickable = !!res.code;
    const inner = res.code
      ? `<span class="fl">${teamFlag(res.code)}</span><span class="nm" title="${teamName(res.code)}">${teamName(res.code)}</span>`
      : `<span class="nm empty" title="${res.label || ""}">${res.short || res.label || "—"}</span>`;
    return `<div class="slot ${pickable ? "pickable" : ""} ${advanced ? "advanced" : ""}"
      data-match="${id}" data-side="${side}" ${pickable ? "" : 'aria-disabled="true"'}>
      ${inner}<span class="chk">✓</span>
    </div>`;
  }

  /* ---- zoom + pan-aware connector rendering ---- */
  function fitScale() {
    const vp = document.getElementById("bviewport");
    const canvas = document.getElementById("bcanvas");
    if (!vp || !canvas) return 1;
    const w = canvas.offsetWidth || 1;
    return Math.max(0.3, Math.min(1, (vp.clientWidth - 6) / w));
  }
  function applyScale(s) {
    bracketScale = s;
    const canvas = document.getElementById("bcanvas");
    const sizer = document.getElementById("bsizer");
    const lbl = document.getElementById("zoom-lbl");
    if (!canvas || !sizer) return;
    canvas.style.transform = `scale(${s})`;
    sizer.style.width = canvas.offsetWidth * s + "px";
    sizer.style.height = canvas.offsetHeight * s + "px";
    if (lbl) lbl.textContent = Math.round(s * 100) + "%";
    drawConnectors();
    const vp = document.getElementById("bviewport");
    if (vp && restorePan) { vp.scrollLeft = panScroll.l; vp.scrollTop = panScroll.t; restorePan = false; }
  }
  function bracketEdges() {
    const edges = [];
    Object.entries(BRACKET).forEach(([id, tie]) => {
      ["home", "away"].forEach((side) => {
        const m = /^([WL])(.+)$/.exec(tie[side] || "");
        if (m) edges.push({ from: m[2], to: id, type: m[1] === "W" ? "win" : "lose" });
      });
    });
    return edges;
  }
  function drawConnectors() {
    const canvas = document.getElementById("bcanvas");
    const svg = document.getElementById("bsvg");
    if (!canvas || !svg) return;
    const s = bracketScale || 1;
    const W = canvas.offsetWidth, H = canvas.offsetHeight;
    if (!W || !H) return;
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.style.width = W + "px"; svg.style.height = H + "px";
    const cr = canvas.getBoundingClientRect();
    const pos = (id) => {
      const el = canvas.querySelector(`.bnode[data-id="${id}"]`);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return {
        left: (r.left - cr.left) / s,
        right: (r.right - cr.left) / s,
        cy: (r.top - cr.top) / s + r.height / s / 2,
      };
    };
    let paths = "";
    bracketEdges().forEach((e) => {
      const a = pos(e.from), b = pos(e.to);
      if (!a || !b) return;
      let sx, ex;
      if (a.right <= b.left + 1) { sx = a.right; ex = b.left; }
      else { sx = a.left; ex = b.right; }
      const mx = (sx + ex) / 2;
      paths += `<path class="cn ${e.type === "lose" ? "lose" : ""}" d="M ${sx.toFixed(1)} ${a.cy.toFixed(1)} H ${mx.toFixed(1)} V ${b.cy.toFixed(1)} H ${ex.toFixed(1)}"/>`;
    });
    svg.innerHTML = paths;
  }
  // called when the predictor tab becomes visible
  function showBracket() {
    applyScale(bracketScale || fitScale());
  }

  function wireBracket(root) {
    root.querySelectorAll(".third-pill:not(.disabled)").forEach((p) => {
      p.addEventListener("click", () => {
        const code = p.dataset.code;
        const i = state.thirds.indexOf(code);
        if (i >= 0) state.thirds.splice(i, 1);
        else if (state.thirds.length < 8) state.thirds.push(code);
        stashScroll();
        save(); renderBracket(); renderSchedule();
        const d = document.getElementById("thirds-d"); if (d) d.open = true;
      });
    });
    root.querySelectorAll(".slot.pickable").forEach((s) => {
      s.addEventListener("click", () => {
        const id = s.dataset.match, side = s.dataset.side;
        if (state.winners[id] === side) delete state.winners[id];
        else state.winners[id] = side;
        clearDownstream(id);
        stashScroll();
        save(); renderBracket(); renderSchedule();
      });
    });

    // desktop drag-to-pan (touch uses native scroll)
    const vp = document.getElementById("bviewport");
    if (vp) {
      let down = false, sx = 0, sy = 0, sl = 0, st = 0;
      vp.addEventListener("pointerdown", (e) => {
        if (e.pointerType !== "mouse") return;
        if (e.target.closest(".slot.pickable") || e.target.closest("button")) return;
        down = true; sx = e.clientX; sy = e.clientY;
        sl = vp.scrollLeft; st = vp.scrollTop;
        vp.setPointerCapture(e.pointerId); vp.classList.add("grabbing");
      });
      vp.addEventListener("pointermove", (e) => {
        if (!down) return;
        vp.scrollLeft = sl - (e.clientX - sx);
        vp.scrollTop = st - (e.clientY - sy);
      });
      const end = () => { down = false; vp.classList.remove("grabbing"); };
      vp.addEventListener("pointerup", end);
      vp.addEventListener("pointercancel", end);
    }
  }

  // if a result changes, drop any later picks that relied on its old winner
  function clearDownstream(changedId) {
    let changed = true;
    while (changed) {
      changed = false;
      Object.keys(state.winners).forEach((id) => {
        const tie = BRACKET[id];
        if (!tie) return;
        ["home", "away"].forEach((side) => {
          const dep = /^[WL]([A-Z0-9]+-\d+)$/.exec(tie[side] || "");
          if (dep && (dep[1] === changedId)) {
            const res = resolveSlot(tie[side]);
            if (!res.code) { delete state.winners[id]; changed = true; }
          }
        });
      });
    }
  }

  /* ============================================================
     TABS + INIT
     ============================================================ */
  function initTabs() {
    const tabs = document.querySelectorAll(".tab");
    tabs.forEach((t) => {
      t.addEventListener("click", () => {
        tabs.forEach((x) => x.classList.remove("active"));
        document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
        t.classList.add("active");
        document.getElementById("view-" + t.dataset.view).classList.add("active");
        window.scrollTo({ top: 0, behavior: "smooth" });
        if (t.dataset.view === "bracket") requestAnimationFrame(showBracket);
      });
    });
  }

  renderSchedule();
  renderGroups();
  renderBracket();
  initTabs();

  /* ---------- PWA install + service worker ---------- */
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(() => {});
    });
  }
  let deferredPrompt = null;
  const toast = document.getElementById("install-toast");
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); deferredPrompt = e;
    if (toast) toast.classList.add("show");
  });
  if (toast) {
    toast.querySelector("[data-install]").addEventListener("click", async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt(); await deferredPrompt.userChoice;
      deferredPrompt = null; toast.classList.remove("show");
    });
    toast.querySelector("[data-dismiss]").addEventListener("click", () => toast.classList.remove("show"));
  }
})();
