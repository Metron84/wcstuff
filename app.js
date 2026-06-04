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
      save(); renderGroups();
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
        save(); renderGroups();
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
        save(); renderGroups();
      });
    });
  }

  /* ============================================================
     BRACKET PREDICTOR
     ============================================================ */
  // Resolve a slot label like "1A", "2C", "3CEFI", "WR32-1" to a team code (or label).
  function resolveSlot(slot) {
    if (!slot) return { label: "—" };
    // group winner / runner-up
    let m = /^([12])([A-L])$/.exec(slot);
    if (m) {
      const pos = +m[1] - 1, g = m[2];
      return { code: state.order[g][pos], label: (m[1] === "1" ? "Winner " : "Runner-up ") + "Group " + g };
    }
    // third-place destination: "3CEFI" etc. -> assigned third from the pool
    m = /^3([A-L]+)$/.exec(slot);
    if (m) {
      const assigned = state.thirdAssign[slot];
      if (assigned) return { code: assigned, label: "3rd place" };
      return { label: "3rd place (" + m[1].split("").join("/") + ")" };
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
      return { label: lbl };
    }
    return { label: slot };
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
    // greedy: fill most-constrained slots first
    const slots = [...thirdSlots].sort((a, b) => a.allowed.length - b.allowed.length);
    slots.forEach((sl) => {
      const pick = chosen.find((c) => !used.has(c.code) && sl.allowed.includes(c.group));
      if (pick) { assign[sl.slot] = pick.code; used.add(pick.code); }
    });
    state.thirdAssign = assign;
  }

  function renderBracket() {
    const root = document.getElementById("view-bracket");
    // current third-place candidates = the 3rd team of every group
    const thirdCandidates = Object.keys(GROUPS).map((g) => ({ g, code: state.order[g][2] }));
    autoAssignThirds();

    const order = ["R32", "R16", "QF", "SF", "TP", "FIN"];
    const roundsHtml = order.map((rk) => roundBlock(rk)).join("");

    const finRes = state.winners["FIN-1"];
    const finTie = BRACKET["FIN-1"];
    let champ = { label: "" };
    if (finRes) champ = resolveSlot(finTie[finRes]);

    root.innerHTML = `
      <div class="section-head">
        <h3>Knockout Predictor</h3>
        <div class="actions"><button class="btn danger" id="reset-bracket">Reset picks</button></div>
      </div>
      <div class="bracket-intro">
        Tap a team in any tie to send them through. Winners flow automatically into the next round,
        all the way to the final at MetLife Stadium on 19 July. Group winners and runners-up come
        straight from your standings; pick your eight best third-placed teams below.
      </div>
      ${thirdsPicker(thirdCandidates)}
      ${roundsHtml}
      <div class="champion">
        <div class="lbl">Your World Champion</div>
        <div class="who ${champ.code ? "" : "empty"}">
          ${champ.code ? `<span class="fl">${teamFlag(champ.code)}</span> ${teamName(champ.code)}` : "Awaiting the final…"}
        </div>
      </div>
    `;

    wireBracket(root);
    document.getElementById("reset-bracket").addEventListener("click", () => {
      state.winners = {}; state.thirds = []; state.thirdAssign = {};
      save(); renderBracket(); renderSchedule();
    });
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
    return `<div class="thirds">
      <h5>Best Third-Placed Teams <span class="ct ${full ? "full" : ""}">${state.thirds.length}/8 selected</span></h5>
      <p>Eight of the twelve third-placed teams advance to the Round of 32. Choose your eight.</p>
      <div class="thirds-row">${pills}</div>
    </div>`;
  }

  function roundBlock(rk) {
    const round = KNOCKOUT[rk];
    const ties = round.matches.map((mm) => tieCard(mm.id, round.label, mm)).join("");
    return `<div class="round">
      <div class="round-head">
        <h4>${round.label}</h4>
        <span class="rdate">${round.dateRange}</span>
        <span class="line"></span>
      </div>
      <div class="tie-grid">${ties}</div>
    </div>`;
  }

  function tieCard(id, label, mm) {
    const tie = BRACKET[id];
    const home = resolveSlot(tie.home);
    const away = resolveSlot(tie.away);
    const win = state.winners[id];
    const isFinal = id === "FIN-1";
    return `<div class="tie ${isFinal ? "final" : ""}">
      <div class="tie-meta"><span>${id}</span><span>${fmtDayNum.format(etToDate([...mm.date,16,0]))} ${fmtMonth.format(etToDate([...mm.date,16,0]))} · ${mm.city}</span></div>
      ${slotRow(id, "home", home, win === "home")}
      ${slotRow(id, "away", away, win === "away")}
    </div>`;
  }

  function slotRow(id, side, res, advanced) {
    const pickable = !!res.code;
    return `<div class="slot ${pickable ? "pickable" : ""} ${advanced ? "advanced" : ""}"
      data-match="${id}" data-side="${side}" ${pickable ? "" : 'aria-disabled="true"'}>
      ${res.code ? `<span class="fl">${teamFlag(res.code)}</span><span class="nm">${teamName(res.code)}</span>`
                 : `<span class="nm empty">${res.label}</span>`}
      <span class="chk">✓ through</span>
    </div>`;
  }

  function wireBracket(root) {
    root.querySelectorAll(".third-pill:not(.disabled)").forEach((p) => {
      p.addEventListener("click", () => {
        const code = p.dataset.code;
        const i = state.thirds.indexOf(code);
        if (i >= 0) state.thirds.splice(i, 1);
        else if (state.thirds.length < 8) state.thirds.push(code);
        // clear any knockout winners that depended on a now-removed third
        save(); renderBracket(); renderSchedule();
      });
    });
    root.querySelectorAll(".slot.pickable").forEach((s) => {
      s.addEventListener("click", () => {
        const id = s.dataset.match, side = s.dataset.side;
        if (state.winners[id] === side) delete state.winners[id];
        else state.winners[id] = side;
        clearDownstream(id);
        save(); renderBracket(); renderSchedule();
      });
    });
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
