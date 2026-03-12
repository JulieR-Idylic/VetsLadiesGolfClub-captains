const API_BASE = "https://script.google.com/macros/s/AKfycbxDkUJ-PCc92K-dV9ywfuf_SK6FoEGmR3xSIe84XGwA5V_6W5iVTlm4fc4CM6RCJt8Y3g/exec";

const gcScheduleBody = document.getElementById("gcScheduleBody");

document.addEventListener("DOMContentLoaded", initGcSchedule);

function initGcSchedule() {
  if (!gcScheduleBody) return;
  loadCaptainSchedule();
}

async function loadCaptainSchedule() {
  setLoadingRow();

  try {
    const url = `${API_BASE}?action=getCaptainSchedule`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Captain schedule request failed: ${response.status}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error);
    }

    renderCaptainSchedule(data);
  } catch (error) {
    console.error(error);
    setErrorRow("Could not load the Game Captain schedule.");
  }
}

function renderCaptainSchedule(data) {
  if (!Array.isArray(data) || data.length === 0) {
    gcScheduleBody.innerHTML = `
      <tr>
        <td colspan="4">No Game Captain schedule found.</td>
      </tr>
    `;
    return;
  }

  const rowsHtml = data.map((item) => {
    const email = cleanValue(item.email);
    const emailCell = email
      ? `<a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a>`
      : "";

    return `
      <tr>
        <td>${escapeHtml(cleanValue(item.month))}</td>
        <td>${escapeHtml(cleanValue(item.name))}</td>
        <td>${escapeHtml(cleanValue(item.phone))}</td>
        <td>${emailCell}</td>
      </tr>
    `;
  }).join("");

  gcScheduleBody.innerHTML = rowsHtml;
}

function setLoadingRow() {
  gcScheduleBody.innerHTML = `
    <tr>
      <td colspan="4">Loading schedule...</td>
    </tr>
  `;
}

function setErrorRow(message) {
  gcScheduleBody.innerHTML = `
    <tr>
      <td colspan="4">${escapeHtml(message)}</td>
    </tr>
  `;
}

function cleanValue(value) {
  return String(value || "").trim();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}