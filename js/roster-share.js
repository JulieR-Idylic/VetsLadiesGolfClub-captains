// js/roster-share.js
// Placeholder for roster-share functionality.
// Will populate dates, load roster preview, and build the email share link.

const API_BASE = "https://script.google.com/macros/s/AKfycbxDkUJ-PCc92K-dV9ywfuf_SK6FoEGmR3xSIe84XGwA5V_6W5iVTlm4fc4CM6RCJt8Y3g/exec";

const rosterDateSelect = document.getElementById("rosterDate");
const loadRosterBtn = document.getElementById("loadRosterBtn");
const shareRosterBtn = document.getElementById("shareRosterBtn");
const rosterPreview = document.getElementById("rosterPreview");

let currentRosterData = null;
let currentRosterEmailBody = "";
let currentRosterSubject = "";

document.addEventListener("DOMContentLoaded", initRosterShare);

function initRosterShare() {
  if (!rosterDateSelect || !loadRosterBtn || !shareRosterBtn || !rosterPreview) {
    return;
  }

  shareRosterBtn.setAttribute("aria-disabled", "true");
  shareRosterBtn.addEventListener("click", handleShareClick);
  loadRosterBtn.addEventListener("click", handleLoadRoster);

  loadSchedule();
}

async function loadSchedule() {
  setPreviewLoading("Loading schedule...");

  try {
    const url = `${API_BASE}?action=getSchedule`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Schedule request failed: ${response.status}`);
    }

    const schedule = await response.json();
    populateScheduleDropdown(schedule);
    setPreviewEmpty();
  } catch (error) {
    console.error(error);
    setPreviewError("Could not load the game schedule.");
  }
}

function populateScheduleDropdown(schedule) {
  rosterDateSelect.innerHTML = `<option value="">Select a date</option>`;

  if (!Array.isArray(schedule) || schedule.length === 0) {
    return;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let defaultValue = "";

  schedule.forEach((item) => {
    const option = document.createElement("option");
    option.value = item.day;
    option.textContent = item.label;
    option.dataset.game = item.game || "";
    option.dataset.scramble = String(!!item.scramble);
    rosterDateSelect.appendChild(option);

    const optionDate = parseMonthDay(item.day);
    if (!defaultValue && optionDate && optionDate >= today) {
      defaultValue = item.day;
    }
  });

  if (defaultValue) {
    rosterDateSelect.value = defaultValue;
  }
}

async function handleLoadRoster() {
  const selectedDay = rosterDateSelect.value;

  resetShareState();

  if (!selectedDay) {
    setPreviewError("Please select a game date first.");
    return;
  }

  setPreviewLoading("Loading roster...");

  try {
    const url = `${API_BASE}?action=getRoster&day=${encodeURIComponent(selectedDay)}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Roster request failed: ${response.status}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error);
    }

    currentRosterData = data;
    currentRosterEmailBody = buildRosterEmailBody(data);
    currentRosterSubject = buildRosterSubject(data);

    renderRosterPreview(data);
    enableShareButton();
  } catch (error) {
    console.error(error);
    setPreviewError("Could not load the roster for that date.");
  }
}

function handleShareClick(event) {
  if (!currentRosterEmailBody || !currentRosterSubject) {
    event.preventDefault();
    return;
  }

  const mailto = buildMailtoLink(currentRosterSubject, currentRosterEmailBody);
  shareRosterBtn.href = mailto;
}

function renderRosterPreview(data) {
  const heading = `${escapeHtml(data.day || "")}${data.game ? ` – ${escapeHtml(data.game)}` : ""}`;

  if (data.type === "scramble") {
    rosterPreview.innerHTML = `
      <p class="muted"><strong>Status:</strong> Roster loaded.</p>
      <div class="results-preview-block">
        <p><strong>${heading}</strong></p>

        ${renderScrambleSection("18-Hole Scramble Players", data.scramble18)}
        ${renderScrambleSection("9-Hole Scramble Players", data.scramble9)}
        ${renderScrambleSection("Not Playing in Scramble", data.notPlayingScramble)}
      </div>
    `;
    return;
  }

  rosterPreview.innerHTML = `
    <p class="muted"><strong>Status:</strong> Roster loaded.</p>
    <div class="results-preview-block">
      <p><strong>${heading}</strong></p>

      ${renderRegularSection("18 Holes", data.holes18)}
      ${renderRegularSection("9 Holes", data.holes9)}
    </div>
  `;
}

function renderRegularSection(title, groups) {
  if (!Array.isArray(groups) || groups.length === 0) {
    return `
      <hr class="tool-divider" />
      <p><strong>${escapeHtml(title)}</strong></p>
      <p class="muted">No players listed.</p>
    `;
  }

  const groupsHtml = groups
    .map((group) => {
      const playersHtml = (group.players || [])
        .map((player) => `<div>${escapeHtml(cleanName(player))}</div>`)
        .join("");

        return `
        <div class="roster-group">
            <p><strong>${escapeHtml(group.teeTime || "")}</strong></p>
            <div class="roster-players">
            ${playersHtml}
            </div>
        </div>
        `;
    })
    .join("");

  return `
    <hr class="tool-divider" />
    <p><strong>${escapeHtml(title)}</strong></p>
    ${groupsHtml}
  `;
}

function renderScrambleSection(title, players) {
  if (!Array.isArray(players) || players.length === 0) {
    return `
      <hr class="tool-divider" />
      <p><strong>${escapeHtml(title)}</strong></p>
      <p class="muted">None listed.</p>
    `;
  }

  const playersHtml = players
    .map((player) => `<div>${escapeHtml(cleanName(player))}</div>`)
    .join("");

    return `
    <hr class="tool-divider" />
    <p><strong>${escapeHtml(title)}</strong></p>
    <div class="roster-players">
        ${playersHtml}
    </div>
    `;
}

function buildRosterSubject(data) {
  const parts = ["VLGC Roster"];
  if (data.day) parts.push(data.day);
  return parts.join(" – ");
}

function buildRosterEmailBody(data) {
  const lines = [];
  const heading = `${data.day || ""}${data.game ? ` – ${data.game}` : ""}`;

  lines.push("Veterans Ladies Golf Club");
  lines.push("Weekly Roster");
  lines.push("");

  if (heading.trim()) {
    lines.push(heading);
    lines.push("");
  }

  if (data.type === "scramble") {
    appendPlayerList(lines, "18-Hole Scramble Players", data.scramble18);
    appendPlayerList(lines, "9-Hole Scramble Players", data.scramble9);
    appendPlayerList(lines, "Not Playing in Scramble", data.notPlayingScramble);
  } else {
    appendTeeTimeGroups(lines, "18 Holes", data.holes18);
    appendTeeTimeGroups(lines, "9 Holes", data.holes9);
  }

  return lines.join("\n").trim();
}

function appendTeeTimeGroups(lines, title, groups) {
  lines.push(title);

  if (!Array.isArray(groups) || groups.length === 0) {
    lines.push("No players listed.");
    lines.push("");
    return;
  }

  groups.forEach((group) => {
    lines.push(group.teeTime || "");
    (group.players || []).forEach((player) => {
      lines.push(cleanName(player));
    });
    lines.push("");
  });
}

function appendPlayerList(lines, title, players) {
  lines.push(title);

  if (!Array.isArray(players) || players.length === 0) {
    lines.push("None listed.");
    lines.push("");
    return;
  }

  players.forEach((player) => {
    lines.push(cleanName(player));
  });
  lines.push("");
}

function buildMailtoLink(subject, body) {
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function enableShareButton() {
  shareRosterBtn.setAttribute("aria-disabled", "false");
}

function resetShareState() {
  currentRosterData = null;
  currentRosterEmailBody = "";
  currentRosterSubject = "";
  shareRosterBtn.setAttribute("aria-disabled", "true");
  shareRosterBtn.href = "#";
}

function setPreviewLoading(message) {
  rosterPreview.innerHTML = `
    <p class="muted"><strong>Status:</strong> ${escapeHtml(message)}</p>
  `;
}

function setPreviewEmpty() {
  rosterPreview.innerHTML = `
    <p class="muted"><strong>Status:</strong> No roster loaded yet.</p>
    <p>
      Select a game date and click <strong>Load Roster</strong> to preview
      the roster before sharing it with the course.
    </p>
  `;
}

function setPreviewError(message) {
  rosterPreview.innerHTML = `
    <p class="muted"><strong>Status:</strong> Error</p>
    <p>${escapeHtml(message)}</p>
  `;
}

function cleanName(name) {
  return String(name || "").trim();
}

function parseMonthDay(dayLabel) {
  if (!dayLabel) return null;

  const parts = dayLabel.split(" ");
  if (parts.length !== 2) return null;

  const [monthAbbr, dayStr] = parts;
  const monthMap = {
    Jan: 0,
    Feb: 1,
    Mar: 2,
    Apr: 3,
    May: 4,
    Jun: 5,
    Jul: 6,
    Aug: 7,
    Sep: 8,
    Oct: 9,
    Nov: 10,
    Dec: 11
  };

  const monthIndex = monthMap[monthAbbr];
  const dayNum = Number(dayStr);

  if (monthIndex === undefined || Number.isNaN(dayNum)) {
    return null;
  }

  const now = new Date();
  return new Date(now.getFullYear(), monthIndex, dayNum);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}