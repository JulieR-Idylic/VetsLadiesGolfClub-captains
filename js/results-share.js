(() => {
  const weekSelect = document.getElementById("weekSelect");
  const weekHeading = document.getElementById("weekHeading");
  const weekSubhead = document.getElementById("weekSubhead");
  const winnerCards = document.getElementById("winnerCards");
  const toggleDetails = document.getElementById("toggleDetails");
  const detailsPanel = document.getElementById("detailsPanel");
  const resultsTbody = document.getElementById("resultsTbody");
  const emptyState = document.getElementById("emptyState");
  const errorState = document.getElementById("errorState");
  const segButtons = Array.from(document.querySelectorAll(".seg-btn"));
  const shareResultsBtn = document.getElementById("shareResultsBtn");
  const captainContact = document.getElementById("captainContact");

  // Share modal elements
  const shareModal = document.getElementById("shareModal");
  const shareModalClose = document.getElementById("shareModalClose");
  const shareModalCancel = document.getElementById("shareModalCancel");
  const sharePreview = document.getElementById("sharePreview");
  const copyHtmlBtn = document.getElementById("copyHtmlBtn");
  const sendEmailBtn = document.getElementById("sendEmailBtn");
  const shareStatus = document.getElementById("shareStatus");
  const shareScope = document.getElementById("shareScope");

  const dom = {
    weekHeading,
    weekSubhead,
    winnerCards,
    toggleDetails,
    detailsPanel,
    resultsTbody,
    emptyState,
    errorState,
  };

  let db = null;
  let selectedDate = null;
  let holesFilter = "18";
  let currentRows = [];
  let currentGame = null;
  let currentSched = null;

  function setActiveSeg(btn) {
    segButtons.forEach((b) => {
      const active = b === btn;
      b.classList.toggle("is-active", active);
      b.setAttribute("aria-selected", active ? "true" : "false");
    });
  }

  function wireSegmentedControl() {
    segButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        holesFilter = btn.dataset.holes || "18";
        setActiveSeg(btn);
        if (selectedDate) renderSelectedWeek();
      });
    });
  }

  function wireWeekSelect() {
    weekSelect.addEventListener("change", () => {
      selectedDate = weekSelect.value;
      renderSelectedWeek();
    });
  }

  function renderCaptainContact(sched) {
    if (!captainContact) return;

    const raw = asStr(sched?.gamecaptain);
    if (!raw) {
      captainContact.textContent = "Game Captain: —";
      return;
    }

    const parts = raw.split("|").map((p) => p.trim());
    const name = parts[0] || "—";
    const phone = parts[1] || "—";
    const email = parts[2] || "—";

    captainContact.textContent = `Game Captain: ${name} | ${phone} | ${email}`;
  }

  function renderSelectedWeek() {
    if (!selectedDate) {
      showEmptyState(dom, "No published results found.");
      currentRows = [];
      currentGame = null;
      currentSched = null;
      renderCaptainContact(null);
      return;
    }

    const rendered = renderWeek(dom, db, selectedDate, holesFilter);
    currentRows = rendered.rows;
    currentGame = rendered.game;
    currentSched = rendered.sched;
    renderCaptainContact(currentSched);
  }

  function getRowsForHoles(dateISO, holes) {
    return rowsForWeek(db, dateISO, String(holes));
  }

  function getShareData(dateISO, scope) {
    const rows18 = getRowsForHoles(dateISO, 18);
    const rows9 = getRowsForHoles(dateISO, 9);

    if (scope === "18") {
      return {
        rows18,
        rows9: [],
        label: "18 holes"
      };
    }

    if (scope === "9") {
      return {
        rows18: [],
        rows9,
        label: "9 holes"
      };
    }

    return {
      rows18,
      rows9,
      label: "18-hole and 9-hole"
    };
  }

  function buildTableHtml(rows, game) {
    const plan = getDisplayPlan(game);
    const cols = buildTableColumns(plan, rows);

    const headerHtml = cols
      .map(
        (c) =>
          `<th style="text-align:left;padding:10px 12px;border:1px solid #d9d9d9;background:#f7f7f7;font-weight:700;">${escapeHTML(c.label)}</th>`
      )
      .join("");

    const bodyHtml = rows
      .map((r) => {
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

        const rowCells = cols
          .map(
            (c) =>
              `<td style="padding:10px 12px;border:1px solid #d9d9d9;vertical-align:top;">${escapeHTML(cellsByKey[c.key] ?? "—")}</td>`
          )
          .join("");

        return `<tr>${rowCells}</tr>`;
      })
      .join("");

    return `
      <table style="border-collapse:collapse;width:100%;max-width:100%;font-size:14px;margin:14px 0 24px 0;">
        <thead>
          <tr>${headerHtml}</tr>
        </thead>
        <tbody>
          ${bodyHtml}
        </tbody>
      </table>
    `;
  }

  function buildSectionHtml(title, rows, game) {
    if (!rows.length) {
      return `
        <p style="margin:18px 0 6px 0;font-size:16px;font-weight:700;">${escapeHTML(title)}</p>
        <p style="margin:0 0 18px 0;">No published results found.</p>
      `;
    }

    return `
      <p style="margin:18px 0 6px 0;font-size:16px;font-weight:700;">${escapeHTML(title)}</p>
      ${buildTableHtml(rows, game)}
    `;
  }

  function buildShareHtml(dateISO, scope, game) {
    const memberResultsUrl =
      `https://vetsladiesgolfclub-members.pages.dev/results.html?date=${encodeURIComponent(dateISO)}`;

    const shareData = getShareData(dateISO, scope);

    return `
      <div style="font-family:Arial,Helvetica,sans-serif;color:#111;line-height:1.45;">
        <h2 style="margin:0 0 10px 0;font-size:24px;font-weight:700;">Veterans Ladies Golf Club</h2>

        <p style="margin:0 0 22px 0;font-size:16px;">Weekly Results</p>

        <p style="margin:0 0 6px 0;font-size:16px;font-weight:700;">${escapeHTML(fmtWeekHeading(dateISO))}</p>
        ${game?.name ? `<p style="margin:0 0 6px 0;">${escapeHTML(asStr(game.name))}</p>` : ""}
        <p style="margin:0 0 22px 0;">${escapeHTML(shareData.label)}</p>

        ${shareData.rows18.length || scope === "18" || scope === "both"
          ? buildSectionHtml("18 Holes", shareData.rows18, game)
          : ""}

        ${shareData.rows9.length || scope === "9" || scope === "both"
          ? buildSectionHtml("9 Holes", shareData.rows9, game)
          : ""}

        <p style="margin:12px 0 0 0;">
          Member results page:
          <a href="${memberResultsUrl}">${memberResultsUrl}</a>
        </p>
      </div>
    `;
  }

  function openShareModal() {
    if (!selectedDate) return;

    refreshSharePreview();
    shareStatus.textContent = "";
    shareModal.hidden = false;
    document.body.classList.add("modal-open");
  }

  function refreshSharePreview() {
    if (!selectedDate || !sharePreview) return;

    const scope = shareScope ? shareScope.value : "both";
    const html = buildShareHtml(selectedDate, scope, currentGame);
    sharePreview.innerHTML = html;
  }

  function closeShareModal() {
    shareModal.hidden = true;
    document.body.classList.remove("modal-open");
    shareStatus.textContent = "";
  }

  async function copyHtmlToClipboard() {
    if (!selectedDate) return;

    const scope = shareScope ? shareScope.value : "both";
    const html = buildShareHtml(selectedDate, scope, currentGame);
    const text = sharePreview ? sharePreview.innerText : "";

    try {
      if (navigator.clipboard && window.ClipboardItem) {
        const item = new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([text], { type: "text/plain" }),
        });
        await navigator.clipboard.write([item]);
        shareStatus.textContent =
          "Formatted results copied. Open your email and paste into the message body.";
        return;
      }

      if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        shareStatus.textContent =
          "Copied preview text. Open your email and paste into the message body.";
        return;
      }

      shareStatus.textContent =
        "Clipboard copy is not supported on this device/browser.";
    } catch (err) {
      console.error(err);
      shareStatus.textContent = "Could not copy results.";
    }
  }

  function sendViaEmail() {
    if (!selectedDate) return;

    const scope = shareScope ? shareScope.value : "both";
    let subject = buildResultsEmailSubject(selectedDate, holesFilter, currentGame);

    if (scope === "both") {
      subject = `VLGC Results – ${fmtWeekHeading(selectedDate)} – 18-hole and 9-hole`;
    } else if (scope === "18") {
      subject = `VLGC Results – ${fmtWeekHeading(selectedDate)} – 18 holes`;
    } else if (scope === "9") {
      subject = `VLGC Results – ${fmtWeekHeading(selectedDate)} – 9 holes`;
    }

    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}`;
  }

  function wireShareModal() {
    if (!shareResultsBtn) return;

    shareResultsBtn.addEventListener("click", () => {
      if (!selectedDate) return;
      openShareModal();
    });

    if (shareScope) {
      shareScope.addEventListener("change", refreshSharePreview);
    }

    if (shareModalClose) {
      shareModalClose.addEventListener("click", closeShareModal);
    }

    if (shareModalCancel) {
      shareModalCancel.addEventListener("click", closeShareModal);
    }

    if (copyHtmlBtn) {
      copyHtmlBtn.addEventListener("click", copyHtmlToClipboard);
    }

    if (sendEmailBtn) {
      sendEmailBtn.addEventListener("click", sendViaEmail);
    }

    if (shareModal) {
      shareModal.addEventListener("click", (event) => {
        if (event.target === shareModal) {
          closeShareModal();
        }
      });
    }

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && shareModal && !shareModal.hidden) {
        closeShareModal();
      }
    });
  }

  async function init() {
    try {
      wireToggleDetails(dom);
      wireSegmentedControl();
      wireWeekSelect();
      wireShareModal();

      db = await loadResultsData();

      if (!db.publishedWeeks.length) {
        showEmptyState(dom, "No published results found.");
        renderCaptainContact(null);
        return;
      }

      const defaultDate = pickLikelyPublishedWeek(db.publishedWeeks);
      buildWeekSelect(weekSelect, db.publishedWeeks, defaultDate);

      holesFilter =
        segButtons.find((b) => b.classList.contains("is-active"))?.dataset?.holes || "18";

      selectedDate = weekSelect.value || defaultDate || db.publishedWeeks[0].date;
      if (selectedDate) weekSelect.value = selectedDate;

      renderSelectedWeek();
    } catch (err) {
      console.error(err);
      showErrorState(dom, "Couldn’t load results. Please try again later.");
      renderCaptainContact(null);
    }
  }

  init();
})();