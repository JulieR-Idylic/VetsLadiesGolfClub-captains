// js/results-entry.js
(() => {
  "use strict";

  const ROSTER_API_BASE =
    "https://script.google.com/macros/s/AKfycbxDkUJ-PCc92K-dV9ywfuf_SK6FoEGmR3xSIe84XGwA5V_6W5iVTlm4fc4CM6RCJt8Y3g/exec";

  // -------------------------------------------------
  // Stub state data kept for now (Tasks 8-10 later)
  // -------------------------------------------------
  const STUB_STATE_BY_DATE = {
    "2026-03-05": {
      status: "none",
      message: "No data exists for this date."
    },
    "2026-03-12": {
      status: "draft",
      message: "A draft already exists for this date."
    },
    "2026-03-19": {
      status: "published",
      message: "Published results already exist for this date."
    },
    "2026-03-26": {
      status: "both",
      message: "Published results and a draft both exist for this date."
    }
  };

  const STUB_DRAFT_BY_DATE = {
    "2026-03-12": {
      source: "draft",
      gameCaptain: "Julie",
      game: "Sweeps",
      rows: [
        makeRow("2026-03-12", "18", "Alice Brown", "", "88", "", "", "17", "71", "Net", "1", "12"),
        makeRow("2026-03-12", "18", "Becky Jones", "", "92", "", "", "18", "74", "Net", "2", "8"),
        makeRow("2026-03-12", "9", "Cara Smith", "", "", "", "", "", "", "", "", ""),
        makeRow("2026-03-12", "9", "Donna White", "", "", "", "", "", "", "", "", "")
      ]
    },
    "2026-03-26": {
      source: "draft",
      gameCaptain: "Julie",
      game: "Sub-Par",
      rows: [
        makeRow("2026-03-26", "18", "Alice Brown", "A", "86", "-3", "83", "14", "69", "Net", "1", "15"),
        makeRow("2026-03-26", "18", "Becky Jones", "A", "", "", "", "", "", "", "", ""),
        makeRow("2026-03-26", "9", "Cara Smith", "", "", "", "", "", "", "", "", ""),
        makeRow("2026-03-26", "9", "Donna White", "", "", "", "", "", "", "", "", "")
      ]
    }
  };

  const STUB_PUBLISHED_BY_DATE = {
    "2026-03-19": {
      source: "published",
      gameCaptain: "Julie",
      game: "Low Putts",
      rows: [
        makeRow("2026-03-19", "18", "Alice Brown", "", "29", "", "", "", "", "Putts", "1", "12"),
        makeRow("2026-03-19", "18", "Becky Jones", "", "31", "", "", "", "", "Putts", "2", "8"),
        makeRow("2026-03-19", "9", "Cara Smith", "", "15", "", "", "", "", "Putts", "1", "6"),
        makeRow("2026-03-19", "9", "Donna White", "", "17", "", "", "", "", "Putts", "2", "4")
      ]
    },
    "2026-03-26": {
      source: "published",
      gameCaptain: "Julie",
      game: "Sub-Par",
      rows: [
        makeRow("2026-03-26", "18", "Alice Brown", "A", "85", "-3", "82", "14", "68", "Net", "1", "15"),
        makeRow("2026-03-26", "18", "Becky Jones", "A", "88", "-2", "86", "16", "70", "Net", "2", "10"),
        makeRow("2026-03-26", "9", "Cara Smith", "", "40", "-1", "39", "5", "34", "Net", "1", "6"),
        makeRow("2026-03-26", "9", "Donna White", "", "43", "-1", "42", "6", "36", "Net", "2", "4")
      ]
    }
  };

  const els = {
    dateSelect: document.getElementById("resultsDateSelect"),
    statusArea: document.getElementById("statusArea"),
    statusMessage: document.getElementById("resultsEntryStatusMessage"),
    actionArea: document.getElementById("actionArea"),

    entrySection: document.getElementById("entrySection"),
    entryFormTitle: document.getElementById("entryFormTitle"),
    entryFormSubtext: document.getElementById("entryFormSubtext"),
    entryGameCaptain: document.getElementById("entryGameCaptain"),
    entryDateDisplay: document.getElementById("entryDateDisplay"),
    entryGameDisplay: document.getElementById("entryGameDisplay"),
    resultsEntryTableBody: document.getElementById("resultsEntryTableBody"),
    entryEmptyState: document.getElementById("entryEmptyState"),

    saveDraftBtn: document.getElementById("saveDraftBtn"),
    publishResultsBtn: document.getElementById("publishResultsBtn"),
    addPlayerRowBtn: document.getElementById("addPlayerRowBtn"),
    startOverBtn: document.getElementById("startOverBtn"),

    feedbackSection: document.getElementById("feedbackSection"),
    feedbackMessage: document.getElementById("resultsEntryFeedbackMessage")
  };

  let db = null;

  const state = {
    selectedDate: "",
    selectedDateLabel: "",
    selectedDateStatus: "",
    workingDraft: null,
    dirty: false
  };

  async function init() {
    if (!els.dateSelect) return;

    bindEvents();
    resetWorkflow();

    try {
      db = await loadResultsData();
      populateDateSelectFromSchedule(db);
    } catch (err) {
      console.error(err);
      showFeedback("Could not load available dates.", true);
    }
  }

  function bindEvents() {
    els.dateSelect.addEventListener("change", onDateChange);

    els.saveDraftBtn.addEventListener("click", onSaveDraft);
    els.publishResultsBtn.addEventListener("click", onPublish);
    els.addPlayerRowBtn.addEventListener("click", onAddPlayerRow);
    els.startOverBtn.addEventListener("click", onStartOver);

    els.entryGameCaptain.oninput = handleCaptainChange;
  }

  function populateDateSelectFromSchedule(dbObj) {
    const dates = buildEntryDates(dbObj);

    const options = ['<option value="">Select a date</option>']
      .concat(
        dates.map(
          ({ value, label }) =>
            `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`
        )
      )
      .join("");

    els.dateSelect.innerHTML = options;
  }

  function buildEntryDates(dbObj) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const seen = new Set();

    return (Array.isArray(dbObj?.schedule) ? dbObj.schedule : [])
      .map((s) => asStr(s.date))
      .filter((dateISO) => {
        if (!dateISO || seen.has(dateISO)) return false;

        const dt = parseISODate(dateISO);
        if (!dt) return false;

        dt.setHours(0, 0, 0, 0);
        if (dt.getTime() > today.getTime()) return false;

        seen.add(dateISO);
        return true;
      })
      .sort((a, b) => (a < b ? 1 : -1))
      .map((dateISO) => ({
        value: dateISO,
        label: fmtWeekHeading(dateISO)
      }));
  }

  function resetWorkflow() {
    hide(els.statusArea);
    hide(els.actionArea);
    hide(els.entrySection);
    hide(els.feedbackSection);

    els.statusMessage.textContent = "";
    els.actionArea.innerHTML = "";
    els.feedbackMessage.textContent = "";

    els.entryFormTitle.textContent = "Draft Entry";
    els.entryFormSubtext.textContent = "Load a draft to begin entering results.";
    els.entryGameCaptain.value = "";
    els.entryDateDisplay.value = "";
    els.entryGameDisplay.value = "";
    els.resultsEntryTableBody.innerHTML = "";
    els.entryEmptyState.textContent = "No draft is currently loaded.";
    show(els.entryEmptyState);

    els.saveDraftBtn.disabled = true;
    els.publishResultsBtn.disabled = true;
    if (els.addPlayerRowBtn) els.addPlayerRowBtn.disabled = true;
    hide(els.startOverBtn);

    state.selectedDate = "";
    state.selectedDateLabel = "";
    state.selectedDateStatus = "";
    state.workingDraft = null;
    state.dirty = false;
  }

  async function onDateChange() {
    const value = els.dateSelect.value;
    const label = getDateLabel(value);

    clearFeedback();

    if (!value) {
        resetWorkflow();
        return;
    }

    state.selectedDate = value;
    state.selectedDateLabel = label;
    state.selectedDateStatus = "";

    clearEntrySection();
    showFeedback("Checking saved state...", false);

    try {
        const result = await fetchEntryStateForDate(value);
        renderStatusAndActions(result);
        clearFeedback();
    } catch (err) {
        console.error(err);
        showFeedback(err.message || "Could not check saved state for this date.", true);
    }
  }

  async function fetchEntryStateForDate(dateISO) {
    const res = await fetch(
        `${RESULTS_API_BASE}?mode=entrystate&date=${encodeURIComponent(dateISO)}`,
        { cache: "no-store" }
    );

    if (!res.ok) {
        throw new Error(`State fetch failed: ${res.status}`);
    }

    const json = await res.json();

    if (!json?.ok) {
        throw new Error(json?.error || "Could not load saved state.");
    }

    let status = "none";
    let message = "No data exists for this date.";

    if (json.hasDraft && json.hasPublished) {
        status = "both";
        message = "Published results and a draft both exist for this date.";
    } else if (json.hasDraft) {
        status = "draft";
        message = "A draft already exists for this date.";
    } else if (json.hasPublished) {
        status = "published";
        message = "Published results already exist for this date.";
    }

    return {
        status,
        message
    };
  }

  function renderStatusAndActions(result) {
    state.selectedDateStatus = result.status;

    els.statusMessage.textContent = result.message;
    show(els.statusArea);

    const buttons = [];

    if (result.status === "none") {
      buttons.push(makeActionButton("startNewDraftBtn", "Start New Draft", handleStartNewDraft));
    } else if (result.status === "draft") {
      buttons.push(makeActionButton("openDraftBtn", "Open Draft to Edit", handleOpenDraft));
    } else if (result.status === "published") {
      buttons.push(makeActionButton("openPublishedBtn", "Open Published to Edit", handleOpenPublished));
    } else if (result.status === "both") {
      buttons.push(makeActionButton("openDraftBtn", "Open Draft to Edit", handleOpenDraft));
      buttons.push(makeActionButton("openPublishedBtn", "Open Published to Edit", handleOpenPublished));
    }

    els.actionArea.innerHTML = "";
    buttons.forEach((btn) => els.actionArea.appendChild(btn));
    show(els.actionArea);
  }

  function makeActionButton(id, label, handler) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.id = id;
    btn.className = "btn btn-secondary";
    btn.textContent = label;
    btn.addEventListener("click", handler);
    return btn;
  }

  async function handleStartNewDraft() {
    if (!state.selectedDate) return;

    clearFeedback();
    showFeedback("Loading roster...", false);

    try {
      const rosterData = await fetchRosterForDate(state.selectedDate);
      const draft = rosterResponseToDraft(rosterData, state.selectedDate);

      state.workingDraft = deepClone(draft);
      state.dirty = false;

      renderWorkingDraft({
        title: "New Draft Entry",
        subtext: "New draft created from roster. Changes will not be live until published.",
        showStartOver: false
      });

      showFeedback("New draft loaded from roster.", false);
    } catch (err) {
      console.error(err);
      showFeedback(err.message || "Could not create a new draft from the roster.", true);
    }
  }

    async function handleOpenDraft() {
        if (!state.selectedDate) return;

        clearFeedback();
        showFeedback("Loading saved draft...", false);

        try {
            const draft = await fetchDraftForDate(state.selectedDate);

            if (!draft.rows.length) {
            showFeedback("No saved draft rows were found for this date.", true);
            return;
            }

            state.workingDraft = deepClone(draft);
            state.dirty = false;

            renderWorkingDraft({
            title: "Draft Entry",
            subtext: "Editing saved draft. Changes will not affect the member site until published.",
            showStartOver: true
            });

            showFeedback("Draft loaded.", false);
        } catch (err) {
            console.error(err);
            showFeedback(err.message || "Could not open the saved draft for this date.", true);
        }
    }

  function handleOpenPublished() {
    const published = STUB_PUBLISHED_BY_DATE[state.selectedDate];
    if (!published) {
      showFeedback("Could not open published results for this date.", true);
      return;
    }

    state.workingDraft = deepClone(published);
    state.dirty = false;

    renderWorkingDraft({
      title: "Published Results Re-opened",
      subtext: "Editing a draft created from published results. Changes will not be live until republished.",
      showStartOver: state.selectedDateStatus === "both"
    });

    showFeedback("Published results loaded for editing.", false);
  }

  async function onStartOver() {
    if (!state.selectedDate) return;

    const ok = window.confirm(
      "Start over from the roster? Any unsaved changes currently on screen will be lost."
    );
    if (!ok) return;

    clearFeedback();
    showFeedback("Loading roster...", false);

    try {
      const rosterData = await fetchRosterForDate(state.selectedDate);
      const draft = rosterResponseToDraft(rosterData, state.selectedDate);

      state.workingDraft = deepClone(draft);
      state.dirty = false;

      renderWorkingDraft({
        title: "New Draft Entry",
        subtext: "New draft created from roster. Changes will not be live until published.",
        showStartOver: false
      });

      showFeedback("Draft reset from roster.", false);
    } catch (err) {
      console.error(err);
      showFeedback(err.message || "Could not reset the draft from the roster.", true);
    }
  }

  async function fetchRosterForDate(dateISO) {
    const url = `${ROSTER_API_BASE}?action=getResultsRoster&date=${encodeURIComponent(dateISO)}`;
    const res = await fetch(url, { cache: "no-store" });

    if (!res.ok) {
      throw new Error(`Roster fetch failed: ${res.status}`);
    }

    const json = await res.json();

    if (!json?.ok) {
      throw new Error(json?.error || "No roster data was returned.");
    }

    if (!Array.isArray(json.players) || !json.players.length) {
      throw new Error("No roster players were found for this date.");
    }

    return json;
  }

  function rosterResponseToDraft(rosterData, dateISO) {
    const sched = getScheduleForDate(dateISO);
    const game = getGameForDate(dateISO);

    return {
      source: "roster",
      gameCaptain: getCaptainNameFromSchedule(sched) || asStr(rosterData.gameCaptain),
      game: asStr(game?.name) || asStr(rosterData.game),
      rows: rosterData.players.map((player) =>
        makeBlankRow(dateISO, asStr(player.holes) || "18", asStr(player.name))
      )
    };
  }

  async function fetchDraftForDate(dateISO) {
    const res = await fetch(
        `${RESULTS_API_BASE}?mode=draft&date=${encodeURIComponent(dateISO)}`,
        { cache: "no-store" }
    );

    if (!res.ok) {
        throw new Error(`Draft fetch failed: ${res.status}`);
    }

    const json = await res.json();

    if (!json?.ok) {
        throw new Error(json?.error || "No saved draft was returned.");
    }

    const game = getGameForDate(dateISO);
    const sched = getScheduleForDate(dateISO);

    return {
        source: "draft",
        gameCaptain: getCaptainNameFromSchedule(sched) || "",
        game: asStr(game?.name),
        rows: (Array.isArray(json.rows) ? json.rows : []).map((row) =>
        makeRow(
            asStr(row.Date) || dateISO,
            asStr(row.Holes),
            asStr(row.Name),
            asStr(row.Flight),
            asStr(row.Gross),
            asStr(row.Adjustment),
            asStr(row.AdjGross),
            asStr(row.Handicap),
            asStr(row.Net),
            asStr(row.PayoutType),
            asStr(row.Place),
            asStr(row.Winnings)
        )
        )
    };
  }

  function getScheduleForDate(dateISO) {
    if (!db || !dateISO) return null;
    return db.schedByDate.get(dateISO) || null;
  }

  function getGameForDate(dateISO) {
    const sched = getScheduleForDate(dateISO);
    if (!sched) return null;
    const alias = asStr(sched.game_alias);
    return db.gameByAlias.get(alias) || null;
  }

  function getCaptainNameFromSchedule(sched) {
    const raw = asStr(sched?.gamecaptain);
    if (!raw) return "";
    return raw.split("|")[0].trim();
  }

  function renderWorkingDraft({ title, subtext, showStartOver }) {
    if (!state.workingDraft) return;

    els.entryFormTitle.textContent = title;
    els.entryFormSubtext.textContent = subtext;
    els.entryGameCaptain.value = state.workingDraft.gameCaptain || "";
    els.entryDateDisplay.value = state.selectedDateLabel || state.selectedDate;
    els.entryGameDisplay.value = state.workingDraft.game || "";

    state.workingDraft.rows = (state.workingDraft.rows || []).map((row) => ensureRowShape(row, state.selectedDate));

    renderRows(state.workingDraft.rows || []);

    els.entryEmptyState.textContent = "";
    hide(els.entryEmptyState);
    els.saveDraftBtn.disabled = false;
    els.publishResultsBtn.disabled = false;
    if (els.addPlayerRowBtn) els.addPlayerRowBtn.disabled = false;

    if (showStartOver) {
      show(els.startOverBtn);
    } else {
      hide(els.startOverBtn);
    }

    show(els.entrySection);
  }

  function clearEntrySection() {
    hide(els.entrySection);
    els.entryFormTitle.textContent = "Draft Entry";
    els.entryFormSubtext.textContent = "Load a draft to begin entering results.";
    els.entryGameCaptain.value = "";
    els.entryDateDisplay.value = "";
    els.entryGameDisplay.value = "";
    els.resultsEntryTableBody.innerHTML = "";
    els.entryEmptyState.textContent = "No draft is currently loaded.";
    show(els.entryEmptyState);
    els.saveDraftBtn.disabled = true;
    els.publishResultsBtn.disabled = true;
    if (els.addPlayerRowBtn) els.addPlayerRowBtn.disabled = true;
    hide(els.startOverBtn);
    state.workingDraft = null;
    state.dirty = false;
  }

  function renderRows(rows) {
    if (!rows.length) {
      els.resultsEntryTableBody.innerHTML = "";
      els.entryEmptyState.textContent = "No players were found for this draft.";
      show(els.entryEmptyState);
      return;
    }

    els.entryEmptyState.textContent = "";
    hide(els.entryEmptyState);

    els.resultsEntryTableBody.innerHTML = rows
    .map((row, index) => {
        const safeName = row.name || `row ${index + 1}`;
        return `
        <tr data-row-index="${index}">
            <td>
            <button type="button"
                class="btn btn-secondary btn-compact js-row-remove"
                aria-label="Remove ${escapeHtml(safeName)}">
                Remove
            </button>
            </td>

            <td>
            <input class="results-grid-input js-row-name" type="text"
                aria-label="Name for row ${index + 1}"
                value="${escapeHtml(row.name)}" />
            </td>

            <td>
            <select class="results-grid-input js-row-holes"
                aria-label="Holes for ${escapeHtml(safeName)}">
                <option value="18" ${row.holes === "18" ? "selected" : ""}>18</option>
                <option value="9" ${row.holes === "9" ? "selected" : ""}>9</option>
            </select>
            </td>

            <td>
            <input class="results-grid-input js-row-flight" type="text"
                aria-label="Flight for ${escapeHtml(safeName)}"
                value="${escapeHtml(row.flight)}" />
            </td>

            <td class="num">
            <input class="results-grid-input js-row-gross" type="text" inputmode="decimal"
                aria-label="Gross for ${escapeHtml(safeName)}"
                value="${escapeHtml(row.gross)}" />
            </td>

            <td class="num">
            <input class="results-grid-input js-row-adjustment" type="text" inputmode="decimal"
                aria-label="Adjustment for ${escapeHtml(safeName)}"
                value="${escapeHtml(row.adjustment)}" />
            </td>

            <td class="num">
            <input class="results-grid-input js-row-adjgross" type="text" inputmode="decimal"
                aria-label="Adjusted gross for ${escapeHtml(safeName)}"
                value="${escapeHtml(row.adjGross)}" />
            </td>

            <td class="num">
            <input class="results-grid-input js-row-handicap" type="text" inputmode="decimal"
                aria-label="Handicap for ${escapeHtml(safeName)}"
                value="${escapeHtml(row.handicap)}" />
            </td>

            <td class="num">
            <input class="results-grid-input js-row-net" type="text" inputmode="decimal"
                aria-label="Net for ${escapeHtml(safeName)}"
                value="${escapeHtml(row.net)}" />
            </td>

            <td>
            <select class="results-grid-input js-row-payouttype"
                aria-label="Payout type for ${escapeHtml(safeName)}">
                <option value="" ${row.payoutType === "" ? "selected" : ""}></option>
                <option value="Gross" ${row.payoutType === "Gross" ? "selected" : ""}>Gross</option>
                <option value="Net" ${row.payoutType === "Net" ? "selected" : ""}>Net</option>
                <option value="Putts" ${row.payoutType === "Putts" ? "selected" : ""}>Putts</option>
            </select>
            </td>

            <td class="num">
            <input class="results-grid-input js-row-place" type="text" inputmode="numeric"
                aria-label="Place for ${escapeHtml(safeName)}"
                value="${escapeHtml(row.place)}" />
            </td>

            <td class="num">
            <input class="results-grid-input js-row-winnings" type="text" inputmode="decimal"
                aria-label="Winnings for ${escapeHtml(safeName)}"
                value="${escapeHtml(row.winnings)}" />
            </td>

        </tr>
        `;
    })
    .join("");

    bindRowInputs();
  }

  function bindRowInputs() {
    const rows = els.resultsEntryTableBody.querySelectorAll("tr");

    rows.forEach((tr) => {
      const idx = Number(tr.dataset.rowIndex);

      bindRowField(tr, idx, ".js-row-name", "name", "input");
      bindRowField(tr, idx, ".js-row-holes", "holes", "change");
      bindRowField(tr, idx, ".js-row-flight", "flight", "input");
      bindRowField(tr, idx, ".js-row-gross", "gross", "input");
      bindRowField(tr, idx, ".js-row-adjustment", "adjustment", "input");
      bindRowField(tr, idx, ".js-row-adjgross", "adjGross", "input");
      bindRowField(tr, idx, ".js-row-handicap", "handicap", "input");
      bindRowField(tr, idx, ".js-row-net", "net", "input");
      bindRowField(tr, idx, ".js-row-payouttype", "payoutType", "change");
      bindRowField(tr, idx, ".js-row-place", "place", "input");
      bindRowField(tr, idx, ".js-row-winnings", "winnings", "input");

      const removeBtn = tr.querySelector(".js-row-remove");
      removeBtn.addEventListener("click", () => {
        removeRowAt(idx);
      });
    });
  }

  function bindRowField(tr, idx, selector, key, eventName) {
    const el = tr.querySelector(selector);
    if (!el) return;

    el.addEventListener(eventName, () => {
      state.workingDraft.rows[idx][key] = el.value;
      state.workingDraft.rows[idx].date = state.selectedDate;
      state.dirty = true;
    });
  }

  function onAddPlayerRow() {
    if (!state.workingDraft) {
      showFeedback("Load a draft before adding a player row.", true);
      return;
    }

    state.workingDraft.rows.push(makeBlankRow(state.selectedDate, "18", ""));
    state.dirty = true;

    renderRows(state.workingDraft.rows);
    showFeedback("Blank player row added.", false);
  }

  function removeRowAt(index) {
    if (!state.workingDraft) return;
    if (index < 0 || index >= state.workingDraft.rows.length) return;

    state.workingDraft.rows.splice(index, 1);
    state.dirty = true;

    renderRows(state.workingDraft.rows);
    showFeedback("Player row removed.", false);
  }

  function handleCaptainChange() {
    if (!state.workingDraft) return;
    state.workingDraft.gameCaptain = els.entryGameCaptain.value;
    state.dirty = true;
  }

  async function onSaveDraft() {
    if (!state.selectedDate || !state.workingDraft) {
      showFeedback("No draft is currently loaded.", true);
      return;
    }

    syncCaptainFromInput();

    try {
      showFeedback("Saving draft...", false);

      const draftToSave = normalizeDraftForSave(state.workingDraft, state.selectedDate);
      const payload = {
        date: state.selectedDate,
        status: "Draft",
        gameCaptain: draftToSave.gameCaptain || "",
        draft: draftToSave
      };

      const result = await saveDraftToApi(payload);

      // Keep local stub state aligned during this transition phase
      STUB_DRAFT_BY_DATE[state.selectedDate] = deepClone(draftToSave);

      STUB_STATE_BY_DATE[state.selectedDate] = {
        status: STUB_PUBLISHED_BY_DATE[state.selectedDate] ? "both" : "draft",
        message: STUB_PUBLISHED_BY_DATE[state.selectedDate]
          ? "Published results and a draft both exist for this date."
          : "A draft already exists for this date."
      };

      state.workingDraft = deepClone(draftToSave);
      state.dirty = false;
      showFeedback(`Draft saved${result?.savedAt ? ` (${result.savedAt})` : ""}.`, false);
      renderStatusAndActions({
        status: STUB_PUBLISHED_BY_DATE[state.selectedDate] ? "both" : "draft",
        message: STUB_PUBLISHED_BY_DATE[state.selectedDate]
            ? "Published results and a draft both exist for this date."
            : "A draft already exists for this date."
      });
    } catch (err) {
      console.error(err);
      showFeedback(err.message || "Could not save draft.", true);
    }
  }

  async function saveDraftToApi(payload) {
    const res = await fetch(`${RESULTS_API_BASE}?mode=saveDraft`, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      throw new Error(`Save draft failed: ${res.status}`);
    }

    const json = await res.json();

    if (!json?.ok) {
      throw new Error(json?.error || "Could not save draft.");
    }

    return json;
  }

  function onPublish() {
    if (!state.selectedDate || !state.workingDraft) {
      showFeedback("No draft is currently loaded.", true);
      return;
    }

    syncCaptainFromInput();

    const normalizedDraft = normalizeDraftForSave(state.workingDraft, state.selectedDate);

    STUB_PUBLISHED_BY_DATE[state.selectedDate] = deepClone(normalizedDraft);

    console.log("AUDIT Publish", {
      date: state.selectedDate,
      gameCaptain: normalizedDraft.gameCaptain || "",
      action: "Publish",
      timestamp: new Date().toISOString()
    });

    STUB_STATE_BY_DATE[state.selectedDate] = {
      status: "both",
      message: "Published results and a draft both exist for this date."
    };

    state.workingDraft = deepClone(normalizedDraft);
    state.dirty = false;
    showFeedback("Results published. The member site would now show the published version.", false);
    renderStatusAndActions({
        status: "both",
        message: "Published results and a draft both exist for this date."
    });
  }

  function normalizeDraftForSave(draft, dateISO) {
    return {
      source: asStr(draft?.source) || "draft",
      gameCaptain: asStr(draft?.gameCaptain),
      game: asStr(draft?.game),
      rows: (Array.isArray(draft?.rows) ? draft.rows : []).map((row) => ensureRowShape(row, dateISO))
    };
  }

  function ensureRowShape(row, dateISO) {
    return {
      date: asStr(row?.date) || dateISO,
      holes: asStr(row?.holes),
      name: asStr(row?.name),
      flight: asStr(row?.flight),
      gross: asStr(row?.gross),
      adjustment: asStr(row?.adjustment),
      adjGross: asStr(row?.adjGross),
      handicap: asStr(row?.handicap),
      net: asStr(row?.net),
      payoutType: asStr(row?.payoutType),
      place: asStr(row?.place),
      winnings: asStr(row?.winnings)
    };
  }

  function syncCaptainFromInput() {
    if (!state.workingDraft) return;
    state.workingDraft.gameCaptain = els.entryGameCaptain.value.trim();
  }

  function makeBlankRow(date, holes = "18", name = "") {
    return makeRow(date, holes, name, "", "", "", "", "", "", "", "", "");
  }

  function makeRow(date, holes, name, flight, gross, adjustment, adjGross, handicap, net, payoutType, place, winnings) {
    return {
      date: asStr(date),
      holes: asStr(holes),
      name: asStr(name),
      flight: asStr(flight),
      gross: asStr(gross),
      adjustment: asStr(adjustment),
      adjGross: asStr(adjGross),
      handicap: asStr(handicap),
      net: asStr(net),
      payoutType: asStr(payoutType),
      place: asStr(place),
      winnings: asStr(winnings)
    };
  }

  function getDateLabel(value) {
    return value ? fmtWeekHeading(value) : "";
  }

  function showFeedback(message, isError) {
    els.feedbackMessage.textContent = message || "";
    els.feedbackMessage.classList.toggle("is-error", !!isError);
    show(els.feedbackSection);
  }

  function clearFeedback() {
    els.feedbackMessage.textContent = "";
    els.feedbackMessage.classList.remove("is-error");
    hide(els.feedbackSection);
  }

  function show(el) {
    if (!el) return;
    el.classList.remove("is-hidden");
  }

  function hide(el) {
    if (!el) return;
    el.classList.add("is-hidden");
  }

  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  document.addEventListener("DOMContentLoaded", init);
})();