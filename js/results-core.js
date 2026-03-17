const RESULTS_API_BASE =
  "https://script.google.com/macros/s/AKfycbximdmeQ6IHZW3rUT9c-mg8VHA2LcBDIyKMqcC5-hLZIXcU6-LW1-jMWZTSwAS8z-XbgQ/exec";

function asStr(v) {
  return v == null ? "" : String(v).trim();
}

function normBool(v) {
  const s = asStr(v).toLowerCase();
  return s === "true" || s === "yes" || s === "y" || s === "1";
}

function parseISODate(iso) {
  const [y, m, d] = asStr(iso).split("-").map((x) => parseInt(x, 10));
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function fmtWeekHeading(iso) {
  const dt = parseISODate(iso);
  if (!dt) return iso;
  return dt.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function fmtCurrency(v) {
  const raw = asStr(v).replace(/[$,]/g, "");
  if (!raw) return "—";

  const n = Number(raw);
  if (!Number.isFinite(n)) return "—";

  return `$${n.toFixed(2)}`;
}

function fmtNumber(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  const hasDec = Math.abs(n % 1) > 0.000001;
  return hasDec ? n.toFixed(1).replace(/\.0$/, "") : String(n);
}

function holesToNum(holesText) {
  const s = asStr(holesText).toLowerCase();
  if (s.includes("18")) return 18;
  if (s.includes("9")) return 9;
  return null;
}

function placeRank(place) {
  const m = asStr(place).match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 999;
}

function placeLabel(rank) {
  if (rank === 1) return "1st Place";
  if (rank === 2) return "2nd Place";
  if (rank === 3) return "3rd Place";
  return `${rank}th Place`;
}

function payoutTypeLabel(payoutType) {
  const s = asStr(payoutType).toLowerCase();
  if (!s) return "";
  if (s === "net") return "Net";
  if (s === "gross") return "Gross";
  if (s === "putts") return "Putts";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function escapeHTML(s) {
  return asStr(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getDisplayPlan(game) {
  const template = asStr(game?.template);
  const usesAdj = normBool(game?.uses_adjustment);
  const usesHcp = normBool(game?.uses_handicap);
  const grossLabel = asStr(game?.gross_label) || "Gross";

  if (template === "gross_only") {
    return {
      template,
      grossLabel,
      showHandicap: false,
      showGross: true,
      showAdjustment: false,
      showAdjGross: false,
      showNet: false,
    };
  }

  if (template === "net_no_adj") {
    return {
      template,
      grossLabel,
      showHandicap: usesHcp,
      showGross: true,
      showAdjustment: false,
      showAdjGross: false,
      showNet: true,
    };
  }

  if (template === "net_with_adj") {
    return {
      template,
      grossLabel,
      showHandicap: usesHcp,
      showGross: true,
      showAdjustment: usesAdj,
      showAdjGross: usesAdj,
      showNet: true,
    };
  }

  if (template === "championship") {
    return {
      template,
      grossLabel,
      showHandicap: usesHcp,
      showGross: true,
      showAdjustment: false,
      showAdjGross: false,
      showNet: true,
    };
  }

  return {
    template,
    grossLabel,
    showHandicap: usesHcp,
    showGross: true,
    showAdjustment: usesAdj,
    showAdjGross: usesAdj,
    showNet: true,
  };
}

async function loadResultsData() {
  const res = await fetch(`${RESULTS_API_BASE}?mode=all`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
  const json = await res.json();

  const schedule = Array.isArray(json.schedule) ? json.schedule : [];
  const games = Array.isArray(json.games) ? json.games : [];
  const resultsWeeks = Array.isArray(json.resultsWeeks) ? json.resultsWeeks : [];
  const resultsScores = Array.isArray(json.resultsScores) ? json.resultsScores : [];

  const gameByAlias = new Map(games.map((g) => [asStr(g.game_alias), g]));
  const schedByDate = new Map(schedule.map((s) => [asStr(s.date), s]));

  const publishedWeeks = resultsWeeks
    .filter((w) => normBool(w.published))
    .map((w) => ({ date: asStr(w.date) }))
    .filter((w) => !!w.date)
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  return {
    schedule,
    games,
    resultsWeeks,
    resultsScores,
    gameByAlias,
    schedByDate,
    publishedWeeks,
    build: asStr(json.build),
  };
}

function getTargetWednesday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dayOfWeek = today.getDay();

  let offsetToWednesday;

  if (dayOfWeek === 1) offsetToWednesday = -5; // Mon
  else if (dayOfWeek === 2) offsetToWednesday = -6; // Tue
  else if (dayOfWeek === 3) offsetToWednesday = 0; // Wed
  else if (dayOfWeek === 4) offsetToWednesday = -1; // Thu
  else if (dayOfWeek === 5) offsetToWednesday = -2; // Fri
  else if (dayOfWeek === 6) offsetToWednesday = -3; // Sat
  else offsetToWednesday = -4; // Sun

  const target = new Date(today);
  target.setDate(today.getDate() + offsetToWednesday);
  return target;
}

function pickLikelyPublishedWeek(publishedWeeks) {
  if (!Array.isArray(publishedWeeks) || publishedWeeks.length === 0) return "";

  const target = getTargetWednesday();
  let bestDate = "";
  let bestDiff = Infinity;

  publishedWeeks.forEach((w) => {
    const dt = parseISODate(w.date);
    if (!dt) return;

    dt.setHours(0, 0, 0, 0);
    const diff = Math.abs(dt.getTime() - target.getTime());

    if (diff < bestDiff) {
      bestDiff = diff;
      bestDate = w.date;
    }
  });

  return bestDate || publishedWeeks[0].date;
}

function buildWeekSelect(weekSelect, weeks, selectedDate = "") {
  weekSelect.innerHTML = "";

  weeks.forEach((w) => {
    const opt = document.createElement("option");
    opt.value = w.date;
    opt.textContent = fmtWeekHeading(w.date);
    weekSelect.appendChild(opt);
  });

  if (selectedDate) {
    weekSelect.value = selectedDate;
  }
}

function rowsForWeek(db, dateISO, holesFilter) {
  const want = Number(holesFilter);

  return db.resultsScores
    .map((r) => ({
      date: asStr(r.date),
      holes: asStr(r.holes),
      holesNum: holesToNum(r.holes),
      name: asStr(r.name),
      flight: asStr(r.flight),
      gross: r.gross,
      adjustment: r.adjustment,
      adjGross: r.adjGross,
      handicap: r.handicap,
      net: r.net,
      payoutType: asStr(r.payoutType),
      place: asStr(r.place),
      winnings: r.winnings,
    }))
    .filter((r) => r.date === dateISO && r.holesNum === want);
}

function renderHeader(db, dateISO, weekHeading, weekSubhead) {
  const sched = db.schedByDate.get(dateISO);
  const alias = asStr(sched?.game_alias);
  const game = db.gameByAlias.get(alias);

  weekHeading.textContent = fmtWeekHeading(dateISO);

  const gameName = asStr(game?.name);
  const notes = asStr(sched?.notes);
  weekSubhead.textContent = gameName
    ? notes
      ? `${gameName} — ${notes}`
      : gameName
    : notes || "—";

  return { game, sched };
}

function clearTableHeader(resultsTbody) {
  const table = resultsTbody.closest("table");
  const thead = table ? table.querySelector("thead") : null;
  if (thead) thead.innerHTML = "";
}

function showEmptyState(dom, msg) {
  dom.errorState.classList.add("is-hidden");
  dom.emptyState.classList.remove("is-hidden");
  if (msg) dom.emptyState.textContent = msg;

  dom.winnerCards.innerHTML = "";
  dom.resultsTbody.innerHTML = "";
  clearTableHeader(dom.resultsTbody);

  dom.toggleDetails.disabled = true;
  closeDetails(dom);
}

function showErrorState(dom, msg) {
  dom.emptyState.classList.add("is-hidden");
  dom.errorState.classList.remove("is-hidden");
  if (msg) dom.errorState.textContent = msg;

  dom.winnerCards.innerHTML = "";
  dom.resultsTbody.innerHTML = "";
  clearTableHeader(dom.resultsTbody);

  dom.toggleDetails.disabled = true;
  closeDetails(dom);
}

function showContentState(dom) {
  dom.emptyState.classList.add("is-hidden");
  dom.errorState.classList.add("is-hidden");
  dom.toggleDetails.disabled = false;
}

function openDetails(dom) {
  dom.detailsPanel.classList.remove("is-collapsed");
  dom.toggleDetails.setAttribute("aria-expanded", "true");
  dom.toggleDetails.textContent = "Hide full results";
}

function closeDetails(dom) {
  dom.detailsPanel.classList.add("is-collapsed");
  dom.toggleDetails.setAttribute("aria-expanded", "false");
  dom.toggleDetails.textContent = "View full results";
}

function buildCardChips(row, game, plan) {
  const chips = [];
  const grossLabel = plan.grossLabel || asStr(game?.gross_label) || "Gross";

  if (plan.showGross) chips.push({ label: grossLabel, value: fmtNumber(row.gross) });

  if (plan.showAdjustment) {
    const adj = asStr(row.adjustment);
    chips.push({ label: "Adj", value: adj ? fmtNumber(adj) : "—" });
  }

  if (plan.showAdjGross) chips.push({ label: "Adj Gross", value: fmtNumber(row.adjGross) });

  if (plan.showHandicap) {
    const h = asStr(row.handicap);
    chips.push({ label: "HCP", value: h ? fmtNumber(h) : "—" });
  }

  if (plan.showNet) chips.push({ label: "Net", value: fmtNumber(row.net) });

  return chips;
}

function renderWinnerCards(winnerCards, rows, game) {
  winnerCards.innerHTML = "";
  if (!rows || !rows.length) return;

  const plan = getDisplayPlan(game);

  const payoutOrder = (pt) => {
    const s = payoutTypeLabel(pt).toLowerCase();
    if (s === "gross") return 0;
    if (s === "net") return 1;
    if (s === "putts") return 2;
    return 9;
  };

  const awarded = rows
    .map((r) => ({
      ...r,
      rank: placeRank(r.place),
      win: Number(r.winnings),
    }))
    .filter((r) => {
      const hasPlace = asStr(r.place) !== "" && Number.isFinite(r.rank) && r.rank !== 999;
      const hasPayout = Number.isFinite(r.win) && r.win > 0;
      return hasPlace && hasPayout;
    });

  if (!awarded.length) return;

  awarded.sort((a, b) => {
    const ar = Number.isFinite(a.rank) ? a.rank : 999;
    const br = Number.isFinite(b.rank) ? b.rank : 999;
    if (ar !== br) return ar - br;

    const ao = payoutOrder(a.payoutType);
    const bo = payoutOrder(b.payoutType);
    if (ao !== bo) return ao - bo;

    return asStr(a.name).localeCompare(asStr(b.name));
  });

  for (const row of awarded) {
    const basis = payoutTypeLabel(row.payoutType) || "—";
    const payoutText = Number.isFinite(row.win) && row.win > 0 ? fmtCurrency(row.win) : "—";
    const line2 = `${basis} — ${payoutText}`;

    const chips = buildCardChips(row, game, plan);
    const chipHTML = chips
      .map((c) => `<span class="pill">${escapeHTML(c.label)}: ${escapeHTML(c.value)}</span>`)
      .join("");

    winnerCards.insertAdjacentHTML(
      "beforeend",
      `
      <article class="winner-card">
        <div class="winner-rank">${escapeHTML(placeLabel(row.rank))}</div>
        <div class="winner-meta">${escapeHTML(line2)}</div>
        <div class="winner-name">${escapeHTML(row.name)}</div>
        <div class="winner-pills">${chipHTML}</div>
      </article>
      `
    );
  }
}

function buildTableColumns(plan, rows) {
  const payoutTypes = new Set(
    rows
      .map((r) => payoutTypeLabel(r.payoutType).toLowerCase())
      .filter((s) => !!s)
  );
  const showPayoutType = payoutTypes.size > 1;

  const cols = [];
  cols.push({ key: "name", label: "Name" });

  if (plan.template === "championship") cols.push({ key: "flight", label: "Flight" });

  if (plan.showHandicap) cols.push({ key: "hcp", label: "HCP", num: true });
  if (plan.showGross) cols.push({ key: "gross", label: plan.grossLabel || "Gross", num: true });
  if (plan.showAdjustment) cols.push({ key: "adj", label: "Adj", num: true });
  if (plan.showAdjGross) cols.push({ key: "adjGross", label: "Adj Gross", num: true });
  if (plan.showNet) cols.push({ key: "net", label: "Net", num: true });

  cols.push({ key: "place", label: "Place", num: true });

  if (showPayoutType) cols.push({ key: "payoutType", label: "Payout Type" });

  cols.push({ key: "payout", label: "Payout", num: true });

  return cols;
}

function renderTable(resultsTbody, rows, game) {
  resultsTbody.innerHTML = "";
  if (!rows.length) return;

  const plan = getDisplayPlan(game);
  const cols = buildTableColumns(plan, rows);

  const table = resultsTbody.closest("table");
  const thead = table ? table.querySelector("thead") : null;
  if (thead) {
    thead.innerHTML = `
      <tr>
        ${cols
          .map((c) => `<th${c.num ? ' class="num"' : ""}>${escapeHTML(c.label)}</th>`)
          .join("")}
      </tr>
    `;
  }

  const payoutOrder = (pt) => {
    const s = payoutTypeLabel(pt).toLowerCase();
    if (s === "gross") return 0;
    if (s === "net") return 1;
    if (s === "putts") return 2;
    return 9;
  };

  const sorted = [...rows].sort((a, b) => {
    const ra = placeRank(a.place);
    const rb = placeRank(b.place);
    if (ra !== rb) return ra - rb;

    const ao = payoutOrder(a.payoutType);
    const bo = payoutOrder(b.payoutType);
    if (ao !== bo) return ao - bo;

    if (plan.template === "championship") {
      const fa = asStr(a.flight);
      const fb = asStr(b.flight);
      if (fa !== fb) return fa.localeCompare(fb);
    }

    return asStr(a.name).localeCompare(asStr(b.name));
  });

  for (const r of sorted) {
    const win = Number(r.winnings);
    const payout = Number.isFinite(win) && win > 0 ? fmtCurrency(win) : "—";

    const cellsByKey = {
      name: asStr(r.name) || "—",
      flight: asStr(r.flight) || "—",
      hcp: asStr(r.handicap) ? fmtNumber(r.handicap) : "—",
      gross: asStr(r.gross) ? fmtNumber(r.gross) : "—",
      adj: asStr(r.adjustment) ? fmtNumber(r.adjustment) : "—",
      adjGross: asStr(r.adjGross) ? fmtNumber(r.adjGross) : "—",
      net: asStr(r.net) ? fmtNumber(r.net) : "—",
      place: asStr(r.place) || "—",
      payoutType: payoutTypeLabel(r.payoutType) || "—",
      payout,
    };

    resultsTbody.insertAdjacentHTML(
      "beforeend",
      `
      <tr>
        ${cols
          .map((c) => {
            const cls = c.num ? ' class="num"' : "";
            return `<td${cls}>${escapeHTML(cellsByKey[c.key])}</td>`;
          })
          .join("")}
      </tr>
      `
    );
  }
}

function wireToggleDetails(dom) {
  dom.toggleDetails.addEventListener("click", () => {
    if (dom.toggleDetails.disabled) return;

    const isCollapsed = dom.detailsPanel.classList.contains("is-collapsed");
    if (isCollapsed) openDetails(dom);
    else closeDetails(dom);
  });
}

function renderWeek(dom, db, dateISO, holesFilter) {
  if (!db.publishedWeeks.some((w) => w.date === dateISO)) {
    showEmptyState(dom, "No published results found.");
    return { rows: [], game: null, sched: null };
  }

  const { game, sched } = renderHeader(db, dateISO, dom.weekHeading, dom.weekSubhead);
  const rows = rowsForWeek(db, dateISO, holesFilter);

  if (!rows.length) {
    showEmptyState(dom, "No published results found.");
    return { rows: [], game, sched };
  }

  showContentState(dom);
  renderWinnerCards(dom.winnerCards, rows, game);
  renderTable(dom.resultsTbody, rows, game);
  closeDetails(dom);

  return { rows, game, sched };
}

function buildResultsEmailSubject(dateISO, holesFilter, game) {
  const parts = ["VLGC Results", fmtWeekHeading(dateISO), `${holesFilter} holes`];
  if (game?.name) parts.push(asStr(game.name));
  return parts.join(" – ");
}

function buildResultsEmailBody(dateISO, holesFilter, rows, game) {
  const MEMBER_RESULTS_URL = "https://vetsladiesgolfclub-members.pages.dev/results.html";

  const lines = [];
  const plan = getDisplayPlan(game);

  lines.push("Veterans Ladies Golf Club");
  lines.push("Weekly Results");
  lines.push("");
  lines.push(fmtWeekHeading(dateISO));

  if (game?.name) lines.push(asStr(game.name));

  lines.push(`${holesFilter} holes`);
  lines.push("");

  if (!rows.length) {
    lines.push("No published results found.");
    lines.push("");
    lines.push(`Member results page: ${MEMBER_RESULTS_URL}`);
    return lines.join("\n");
  }

  const sortedRows = [...rows].sort((a, b) => {
    const ra = placeRank(a.place);
    const rb = placeRank(b.place);
    if (ra !== rb) return ra - rb;

    return asStr(a.name).localeCompare(asStr(b.name));
  });

  const formattedRows = sortedRows.map((r) => {
    const place = asStr(r.place) || "—";
    const name = asStr(r.name) || "—";

    let score = "—";
    if (plan.showNet && asStr(r.net)) {
      score = fmtNumber(r.net);
    } else if (plan.showGross && asStr(r.gross)) {
      score = fmtNumber(r.gross);
    }

    const payoutNum = Number(r.winnings);
    const payout =
      Number.isFinite(payoutNum) && payoutNum > 0 ? fmtCurrency(payoutNum) : "—";

    return { place, name, score, payout };
  });

  const placeWidth = Math.max(
    "Place".length,
    ...formattedRows.map((r) => r.place.length)
  );
  const nameWidth = Math.max(
    "Name".length,
    ...formattedRows.map((r) => r.name.length)
  );
  const scoreWidth = Math.max(
    "Score".length,
    ...formattedRows.map((r) => r.score.length)
  );
  const payoutWidth = Math.max(
    "Payout".length,
    ...formattedRows.map((r) => r.payout.length)
  );

  const padRight = (value, width) => String(value).padEnd(width, " ");
  const padLeft = (value, width) => String(value).padStart(width, " ");

  lines.push(
    `${padRight("Place", placeWidth)}  ${padRight("Name", nameWidth)}  ${padLeft("Score", scoreWidth)}  ${padLeft("Payout", payoutWidth)}`
  );
  lines.push(
    `${"-".repeat(placeWidth)}  ${"-".repeat(nameWidth)}  ${"-".repeat(scoreWidth)}  ${"-".repeat(payoutWidth)}`
  );

  formattedRows.forEach((r) => {
    lines.push(
      `${padRight(r.place, placeWidth)}  ${padRight(r.name, nameWidth)}  ${padLeft(r.score, scoreWidth)}  ${padLeft(r.payout, payoutWidth)}`
    );
  });

  lines.push("");
  lines.push(`Member results page: ${MEMBER_RESULTS_URL}`);

  return lines.join("\n");
}

function buildMailto(subject, body) {
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}