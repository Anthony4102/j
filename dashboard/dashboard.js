const TOOLS = [
  { id: "budget", label: "Budget Tracker" },
  { id: "tasks", label: "Tasks & Habits" },
  { id: "notes", label: "Notes" },
  { id: "goals", label: "Goals" },
  { id: "calendar", label: "Calendar" },
  { id: "assistant", label: "Atlas Assistant" }
];

document.addEventListener("DOMContentLoaded", async () => {
  const now = new Date();
  const hour = now.getHours();
  const greetingWord = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const settings = getAtlasSettings();
  document.getElementById("greeting").textContent = settings.name
    ? `${greetingWord}, ${settings.name} 👋`
    : `${greetingWord} 👋`;
  document.getElementById("today").textContent = now.toLocaleDateString(undefined, {
    weekday: "long", year: "numeric", month: "long", day: "numeric"
  });

  document.getElementById("commandButton").addEventListener("click", () => {
    const value = document.getElementById("commandInput").value.trim();
    if (value) window.location.href = `../atlas/?q=${encodeURIComponent(value)}`;
  });
  document.getElementById("commandInput").addEventListener("keydown", e => {
    if (e.key === "Enter") document.getElementById("commandButton").click();
  });

  applyHiddenTools(settings.hiddenTools);
  initSettingsPanel();

  const local = readLocalTransactions();
  if (local) renderTransactions(local);

  const client = getAtlasSupabase();
  if (!client) return;
  try {
    const { data, error } = await client.from("transactions").select("*").order("transaction_date", { ascending: false });
    if (!error && Array.isArray(data)) renderTransactions(data);
  } catch (error) {
    console.warn("Atlas dashboard could not read transactions:", error);
  }
});

/* =========================================================
   SETTINGS PANEL
========================================================= */

function initSettingsPanel() {
  const panel = document.getElementById("settingsPanel");
  const overlay = document.getElementById("settingsOverlay");
  const openBtn = document.getElementById("settingsToggle");
  const closeBtn = document.getElementById("settingsClose");
  const nameInput = document.getElementById("settingName");
  const themeSwitch = document.getElementById("settingTheme");
  const currencySelect = document.getElementById("settingCurrency");
  const checklist = document.getElementById("toolVisibilityList");
  const checkConnBtn = document.getElementById("checkConnection");
  const connStatus = document.getElementById("connectionStatus");
  const clearCacheBtn = document.getElementById("clearCache");

  const settings = getAtlasSettings();
  nameInput.value = settings.name;
  currencySelect.value = settings.currency;
  themeSwitch.setAttribute("aria-checked", settings.theme === "dark" ? "true" : "false");

  TOOLS.forEach(tool => {
    const label = document.createElement("label");
    const checked = !settings.hiddenTools.includes(tool.id) ? "checked" : "";
    label.innerHTML = `<input type="checkbox" data-tool-id="${tool.id}" ${checked}> ${tool.label}`;
    checklist.appendChild(label);
  });

  function open() {
    panel.classList.add("open");
    overlay.classList.add("open");
    panel.setAttribute("aria-hidden", "false");
  }
  function close() {
    panel.classList.remove("open");
    overlay.classList.remove("open");
    panel.setAttribute("aria-hidden", "true");
  }

  openBtn.addEventListener("click", open);
  closeBtn.addEventListener("click", close);
  overlay.addEventListener("click", close);
  document.addEventListener("keydown", e => { if (e.key === "Escape") close(); });

  nameInput.addEventListener("input", () => {
    const next = saveAtlasSettings({ name: nameInput.value.trim() });
    const hour = new Date().getHours();
    const greetingWord = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
    document.getElementById("greeting").textContent = next.name ? `${greetingWord}, ${next.name} 👋` : `${greetingWord} 👋`;
  });

  themeSwitch.addEventListener("click", () => {
    const isDark = themeSwitch.getAttribute("aria-checked") === "true";
    themeSwitch.setAttribute("aria-checked", (!isDark).toString());
    saveAtlasSettings({ theme: isDark ? "light" : "dark" });
  });

  currencySelect.addEventListener("change", () => {
    saveAtlasSettings({ currency: currencySelect.value });
    const local = readLocalTransactions();
    if (local) renderTransactions(local);
  });

  checklist.addEventListener("change", () => {
    const hidden = Array.from(checklist.querySelectorAll("input"))
      .filter(cb => !cb.checked)
      .map(cb => cb.dataset.toolId);
    saveAtlasSettings({ hiddenTools: hidden });
    applyHiddenTools(hidden);
  });

  checkConnBtn.addEventListener("click", async () => {
    connStatus.textContent = "Checking…";
    const client = getAtlasSupabase();
    if (!client) {
      connStatus.textContent = "No Supabase client found — running on localStorage only.";
      return;
    }
    try {
      const { error } = await client.from("transactions").select("id").limit(1);
      connStatus.textContent = error
        ? `Connected, but query failed: ${error.message}`
        : "Connected to Supabase ✓";
    } catch (err) {
      connStatus.textContent = "Could not reach Supabase — check your connection or project status.";
    }
  });

  clearCacheBtn.addEventListener("click", () => {
    if (!confirm("Clear locally saved transactions, tasks and notes on this device? This does not touch your Supabase data.")) return;
    ["budgetTracker_transactions", "atlas_tasks", "atlas_notes"].forEach(k => localStorage.removeItem(k));
    connStatus.textContent = "Local cache cleared.";
    location.reload();
  });
}

function applyHiddenTools(hiddenIds) {
  document.querySelectorAll("[data-tool]").forEach(el => {
    el.hidden = hiddenIds.includes(el.dataset.tool);
  });
}

function readLocalTransactions() {
  try {
    const raw = localStorage.getItem("budgetTracker_transactions");
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function renderTransactions(rows) {
  const today = new Date();
  const isoToday = today.toISOString().slice(0, 10);
  let income = 0, expense = 0, balance = 0;
  for (const row of rows) {
    const amount = Number(row.amount) || 0;
    const type = row.transaction_type ?? row.type ?? "expense";
    const date = row.transaction_date ?? row.date ?? "";
    if (type === "income") balance += amount;
    else balance -= amount;
    if (date === isoToday) {
      if (type === "income") income += amount;
      else expense += amount;
    }
  }
  document.getElementById("balance").textContent = peso(balance);
  document.getElementById("income").textContent = peso(income);
  document.getElementById("expense").textContent = peso(expense);
}

function peso(value) {
  return formatAtlasCurrency(value);
}