/* =========================================================
   ATLAS — command console
   Same Supabase project/keys as the Budget Tracker.
   No AI API involved — pure JS parsing + Supabase calls.
   Handler functions are written so a real LLM could later
   call the same functions as "tools".
========================================================= */

/* Atlas auth (atlas-auth.js, loaded before this file) already created
   ONE Supabase client for the whole page. Reusing it here — instead of
   creating a second client — is what keeps commands actually
   authenticated against your Supabase data. */
const supabaseClient = typeof atlasAuthClient !== "undefined" ? atlasAuthClient : null;
if (!supabaseClient) console.warn("Atlas: no shared Supabase client found — falling back to localStorage only.");

const CATEGORIES = ["Bill", "Essential", "Savings", "Credit Card", "Non-Essential", "Extra"];
const ACCOUNTS = ["Cash", "Bank", "GCash", "Maya", "Credit Card", "Other"];

const logEl = document.getElementById("consoleLog");
const inputEl = document.getElementById("commandInput");
const composerEl = document.getElementById("composer");
const suggestionsEl = document.getElementById("suggestions");
const clearBtn = document.getElementById("clearBtn");

const SUGGESTIONS = [
  "/expense 200 food", "/income 500 salary", "/balance", "/undo",
  "/task buy milk", "/tasks", "/note", "/deletenote", "/help"
];

document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  const prefill = params.get("q");
  if (prefill) inputEl.value = prefill;

  SUGGESTIONS.forEach(s => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = s;
    b.addEventListener("click", () => { inputEl.value = s + (s.endsWith(" ") ? "" : " "); inputEl.focus(); });
    suggestionsEl.appendChild(b);
  });

  const sendBtn = document.getElementById("commandButton");
  const updateSendState = () => { sendBtn.disabled = !inputEl.value.trim(); };
  inputEl.addEventListener("input", updateSendState);
  updateSendState();

  composerEl.addEventListener("submit", e => { e.preventDefault(); handleSubmit(); });
  clearBtn.addEventListener("click", () => {
    if (!logEl.children.length) return;
    if (!confirm("Clear this console? Your data isn't affected, only this chat view.")) return;
    logEl.innerHTML = "";
    appendLog("atlas", "Console cleared.");
  });
});

async function handleSubmit() {
  const raw = inputEl.value.trim();
  if (!raw) return;

  if (/^\/delete\b/i.test(raw)) {
    const target = raw.replace(/^\/delete\s*/i, "");
    if (!confirm(`Delete the task matching "${target}"? This can't be undone.`)) return;
  }
  if (/^\/removetx\b/i.test(raw)) {
    const target = raw.replace(/^\/removetx\s*/i, "");
    if (!confirm(`Delete the transaction matching "${target}"? This can't be undone.`)) return;
  }
  if (/^\/undo\b/i.test(raw)) {
    if (!confirm("Undo your most recently added transaction? This can't be undone.")) return;
  }
  if (/^\/deletenote\b/i.test(raw)) {
    const target = raw.replace(/^\/deletenote\s*/i, "");
    if (!confirm(`Delete the note matching "${target}"? This can't be undone.`)) return;
  }
  if (/^\/cleartasks\b/i.test(raw)) {
    if (!confirm("Clear all completed tasks? This can't be undone.")) return;
  }

  appendLog("user", escapeHtml(raw));
  inputEl.value = "";
  document.getElementById("commandButton").disabled = true;

  showTyping();
  let result;
  try {
    result = await routeCommand(raw);
  } catch (err) {
    console.error(err);
    result = { ok: false, message: "Something went wrong running that — nothing was saved. Try again, or check the browser console for details." };
  }
  hideTyping();
  appendLog(result.ok === false ? "error" : "atlas", result.message);
  inputEl.focus();
}

function showTyping() {
  const entry = document.createElement("div");
  entry.className = "log-row log-atlas log-typing";
  entry.id = "typingIndicator";
  entry.innerHTML = `<div class="log-bubble"><span class="dot"></span><span class="dot"></span><span class="dot"></span></div>`;
  logEl.appendChild(entry);
  logEl.scrollTop = logEl.scrollHeight;
}

function hideTyping() {
  const el = document.getElementById("typingIndicator");
  if (el) el.remove();
}

/* =========================================================
   ROUTER — tries a slash command first, then natural phrasing
========================================================= */

async function routeCommand(raw) {
  const text = raw.trim();

  if (text.startsWith("/")) {
    const [cmd, ...rest] = text.slice(1).split(" ");
    return runCommand(cmd.toLowerCase(), rest.join(" ").trim());
  }

  const lower = text.toLowerCase();

  let m = lower.match(/^(spent|spend|paid)\s+(\d+(\.\d+)?)\s*(on)?\s*(.*)$/);
  if (m) return runCommand("expense", `${m[2]} ${m[5]}`.trim());

  m = lower.match(/^(earned|got|received|income)\s+(\d+(\.\d+)?)\s*(from)?\s*(.*)$/);
  if (m) return runCommand("income", `${m[2]} ${m[5]}`.trim());

  if (/^(what'?s|whats|check)?\s*my balance\??$/.test(lower) || lower === "balance") return runCommand("balance", "");
  if (/^(how much (did i|have i) spent? today|today'?s (spend|expenses|summary))\??$/.test(lower)) return runCommand("today", "");
  if (/^(this week|weekly summary|how'?s? my week)\??$/.test(lower)) return runCommand("week", "");
  if (/^(undo|undo that|undo last( transaction)?)\??$/.test(lower)) return runCommand("undo", "");

  m = lower.match(/^(remove|delete) (transaction|expense|income)\s+(.*)$/);
  if (m) return runCommand("removetx", m[3]);

  m = lower.match(/^(add task|remind me to|todo)\s+(.*)$/);
  if (m) return runCommand("task", m[2]);

  m = lower.match(/^(done|finished|complete[d]?)\s+(.*)$/);
  if (m) return runCommand("done", m[2]);

  if (/^(what are my tasks|show tasks|my tasks)\??$/.test(lower)) return runCommand("tasks", "");

  m = lower.match(/^note\s*(:|that)?\s*(.*)$/);
  if (m && m[2]) return runCommand("note", m[2]);

  m = lower.match(/^(delete note|remove note)\s+(.*)$/);
  if (m) return runCommand("deletenote", m[2]);

  return {
    ok: false,
    message: `I didn't recognize that. Type <code>/help</code> to see everything, or try things like "spent 200 on food" or "add task buy milk".`
  };
}

async function runCommand(cmd, args) {
  switch (cmd) {
    case "expense":    return addTransaction("expense", args);
    case "income":     return addTransaction("income", args);
    case "balance":    return getBalance();
    case "today":      return getSummary(1);
    case "week":       return getSummary(7);
    case "categories": return getCategoryBreakdown();
    case "removetx":   return removeTransaction(args);
    case "undo":       return undoLastTransaction();
    case "task":       return addTask(args);
    case "tasks":      return listTasks();
    case "done":       return completeTask(args, true);
    case "undone":     return completeTask(args, false);
    case "delete":     return deleteTask(args);
    case "note":       return addNote(args);
    case "notes":      return listNotes();
    case "deletenote": return deleteNote(args);
    case "cleartasks": return clearCompletedTasks();
    case "clear":
      logEl.innerHTML = "";
      return { ok: true, message: "Console cleared." };
    case "help":       return help();
    default:
      return { ok: false, message: `Unknown command <code>/${escapeHtml(cmd)}</code>. Type <code>/help</code> for the list.` };
  }
}

/* =========================================================
   BUDGET — same "transactions" table/columns as Budget Tracker
========================================================= */

async function addTransaction(type, args) {
  const match = args.match(/^(\d+(\.\d+)?)\s*(.*)$/);
  if (!match) return { ok: false, message: `Give me an amount, e.g. <code>/${type} 200 food lunch</code>.` };

  const amount = parseFloat(match[1]);
  const rest = match[3].trim();
  const foundCategory = CATEGORIES.find(c => rest.toLowerCase().includes(c.toLowerCase()));
  const foundAccount = ACCOUNTS.find(a => rest.toLowerCase().includes(a.toLowerCase()));
  const description = rest || (type === "expense" ? "Expense" : "Income");
  const today = new Date().toISOString().slice(0, 10);

  const row = {
    transaction_date: today, description, amount,
    transaction_type: type, category: foundCategory || "Extra", account: foundAccount || "Cash", notes: null
  };

  if (supabaseClient) {
    const { error } = await supabaseClient.from("transactions").insert(row);
    if (error) {
      console.error(error);
      if (isAuthError(error)) {
        return { ok: false, message: `Couldn't save — you may be signed out. Try refreshing the page and signing in again. (${escapeHtml(error.message)})` };
      }
      saveLocalTransaction(row);
      return { ok: true, message: `Couldn't save to Supabase (${escapeHtml(error.message)}) — saved locally instead. Logged ${type === "expense" ? "−" : "+"}${peso(amount)} — <strong>${escapeHtml(description)}</strong>.` };
    }
  } else {
    saveLocalTransaction(row);
  }

  const sign = type === "expense" ? "−" : "+";
  const tags = [foundCategory, foundAccount].filter(Boolean).join(" · ");
  return { ok: true, message: `Logged ${sign}${peso(amount)} — <strong>${escapeHtml(description)}</strong>${tags ? ` (${tags})` : ""}.` };
}

function isAuthError(error) {
  const msg = (error?.message || "").toLowerCase();
  return msg.includes("row-level security") || msg.includes("permission denied") || msg.includes("jwt") || error?.code === "42501";
}

function saveLocalTransaction(row) {
  const raw = localStorage.getItem("budgetTracker_transactions");
  const list = raw ? JSON.parse(raw) : [];
  list.unshift({ id: `local-${Date.now()}`, ...row });
  localStorage.setItem("budgetTracker_transactions", JSON.stringify(list));
}

async function getAllTransactions() {
  if (supabaseClient) {
    const { data, error } = await supabaseClient.from("transactions").select("*");
    if (!error && Array.isArray(data) && data.length) return data;
  }
  const raw = localStorage.getItem("budgetTracker_transactions");
  return raw ? JSON.parse(raw) : [];
}

async function getBalance() {
  const rows = await getAllTransactions();
  let balance = 0;
  for (const r of rows) balance += rowSignedAmount(r);
  return { ok: true, message: `Your current balance is <strong>${peso(balance)}</strong> across ${rows.length} transaction${rows.length === 1 ? "" : "s"}.` };
}

async function getSummary(days) {
  const rows = await getAllTransactions();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - (days - 1));
  cutoff.setHours(0, 0, 0, 0);

  let income = 0, expense = 0, count = 0;
  for (const r of rows) {
    const date = new Date(r.transaction_date ?? r.date ?? 0);
    if (date < cutoff) continue;
    const amt = Number(r.amount) || 0;
    const type = r.transaction_type ?? r.type ?? "expense";
    if (type === "income") income += amt; else expense += amt;
    count++;
  }
  const label = days === 1 ? "today" : `the last ${days} days`;
  return {
    ok: true,
    message: `<strong>${days === 1 ? "Today" : "This week"}</strong> — in: ${peso(income)}, out: ${peso(expense)}, net: ${peso(income - expense)} (${count} transaction${count === 1 ? "" : "s"}, ${label}).`
  };
}

async function getCategoryBreakdown() {
  const rows = await getAllTransactions();
  const totals = {};
  for (const r of rows) {
    if ((r.transaction_type ?? r.type) !== "expense") continue;
    const cat = r.category || "Uncategorized";
    totals[cat] = (totals[cat] || 0) + (Number(r.amount) || 0);
  }
  const entries = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  if (!entries.length) return { ok: true, message: "No expenses logged yet." };
  const lines = entries.map(([cat, amt]) => `• ${cat}: ${peso(amt)}`).join("<br>");
  return { ok: true, message: `<strong>Spending by category</strong><br>${lines}` };
}

function rowSignedAmount(r) {
  const amt = Number(r.amount) || 0;
  const type = r.transaction_type ?? r.type ?? "expense";
  return type === "income" ? amt : -amt;
}

/* =========================================================
   TASKS — needs an "atlas_tasks" table:

   create table atlas_tasks (
     id uuid primary key default gen_random_uuid(),
     title text not null,
     done boolean not null default false,
     created_at timestamptz not null default now()
   );
========================================================= */

async function addTask(title) {
  title = title.trim();
  if (!title) return { ok: false, message: `Tell me what the task is, e.g. <code>/task buy milk</code>.` };

  if (supabaseClient) {
    const { error } = await supabaseClient.from("atlas_tasks").insert({ title, done: false });
    if (!error) return { ok: true, message: `Added task: <strong>${escapeHtml(title)}</strong>.` };
    console.warn("Supabase task insert failed, using localStorage:", error.message);
  }
  const list = getLocalTasks();
  list.unshift({ id: `local-${Date.now()}`, title, done: false });
  setLocalTasks(list);
  return { ok: true, message: `Added task: <strong>${escapeHtml(title)}</strong> (saved locally).` };
}

async function listTasks() {
  let rows = [];
  if (supabaseClient) {
    const { data, error } = await supabaseClient.from("atlas_tasks").select("*").order("created_at", { ascending: false });
    if (!error && Array.isArray(data)) rows = data;
  }
  if (!rows.length) rows = getLocalTasks();

  const open = rows.filter(t => !t.done);
  if (!open.length) return { ok: true, message: `No open tasks — you're clear! 🎉` };
  const items = open.slice(0, 10).map(t => `• ${escapeHtml(t.title)}`).join("<br>");
  return { ok: true, message: `<strong>Open tasks</strong><br>${items}` };
}

async function completeTask(titleFragment, done) {
  titleFragment = titleFragment.trim().toLowerCase();
  if (!titleFragment) return { ok: false, message: `Tell me which task, e.g. <code>/${done ? "done" : "undone"} buy milk</code>.` };

  if (supabaseClient) {
    const { data } = await supabaseClient.from("atlas_tasks").select("*").eq("done", !done);
    const match = (data || []).find(t => t.title.toLowerCase().includes(titleFragment));
    if (match) {
      const { error } = await supabaseClient.from("atlas_tasks").update({ done }).eq("id", match.id);
      if (!error) return { ok: true, message: `Marked ${done ? "done" : "not done"}: <strong>${escapeHtml(match.title)}</strong>.` };
    }
  }
  const list = getLocalTasks();
  const local = list.find(t => t.done === !done && t.title.toLowerCase().includes(titleFragment));
  if (local) {
    local.done = done;
    setLocalTasks(list);
    return { ok: true, message: `Marked ${done ? "done" : "not done"}: <strong>${escapeHtml(local.title)}</strong>.` };
  }
  return { ok: false, message: `Couldn't find a matching task for "${escapeHtml(titleFragment)}".` };
}

async function deleteTask(titleFragment) {
  titleFragment = titleFragment.trim().toLowerCase();
  if (!titleFragment) return { ok: false, message: `Tell me which task to delete, e.g. <code>/delete buy milk</code>.` };

  if (supabaseClient) {
    const { data } = await supabaseClient.from("atlas_tasks").select("*");
    const match = (data || []).find(t => t.title.toLowerCase().includes(titleFragment));
    if (match) {
      const { error } = await supabaseClient.from("atlas_tasks").delete().eq("id", match.id);
      if (!error) return { ok: true, message: `Deleted task: <strong>${escapeHtml(match.title)}</strong>.` };
    }
  }
  const list = getLocalTasks();
  const idx = list.findIndex(t => t.title.toLowerCase().includes(titleFragment));
  if (idx >= 0) {
    const [removed] = list.splice(idx, 1);
    setLocalTasks(list);
    return { ok: true, message: `Deleted task: <strong>${escapeHtml(removed.title)}</strong>.` };
  }
  return { ok: false, message: `Couldn't find a task matching "${escapeHtml(titleFragment)}".` };
}

function getLocalTasks() {
  const raw = localStorage.getItem("atlas_tasks");
  return raw ? JSON.parse(raw) : [];
}
function setLocalTasks(list) { localStorage.setItem("atlas_tasks", JSON.stringify(list)); }

/* =========================================================
   NOTES — needs an "atlas_notes" table:

   create table atlas_notes (
     id uuid primary key default gen_random_uuid(),
     content text not null,
     created_at timestamptz not null default now()
   );
========================================================= */

async function addNote(content) {
  content = content.trim();
  if (!content) return { ok: false, message: `Give me something to save, e.g. <code>/note call the landlord</code>.` };

  if (supabaseClient) {
    const { error } = await supabaseClient.from("atlas_notes").insert({ content });
    if (!error) return { ok: true, message: `Saved note: <em>${escapeHtml(content)}</em>` };
    console.warn("Supabase note insert failed, using localStorage:", error.message);
  }
  const list = getLocalNotes();
  list.unshift({ id: `local-${Date.now()}`, content, created_at: new Date().toISOString() });
  setLocalNotes(list);
  return { ok: true, message: `Saved note (locally): <em>${escapeHtml(content)}</em>` };
}

async function listNotes() {
  let rows = [];
  if (supabaseClient) {
    const { data, error } = await supabaseClient.from("atlas_notes").select("*").order("created_at", { ascending: false });
    if (!error && Array.isArray(data)) rows = data;
  }
  if (!rows.length) rows = getLocalNotes();
  if (!rows.length) return { ok: true, message: "No notes yet." };
  const items = rows.slice(0, 8).map(n => `• ${escapeHtml(n.content)}`).join("<br>");
  return { ok: true, message: `<strong>Recent notes</strong><br>${items}` };
}

function getLocalNotes() {
  const raw = localStorage.getItem("atlas_notes");
  return raw ? JSON.parse(raw) : [];
}
function setLocalNotes(list) { localStorage.setItem("atlas_notes", JSON.stringify(list)); }

async function deleteNote(fragment) {
  fragment = fragment.trim().toLowerCase();
  if (!fragment) return { ok: false, message: `Tell me which note, e.g. <code>/deletenote landlord</code>.` };

  if (supabaseClient) {
    const { data } = await supabaseClient.from("atlas_notes").select("*");
    const match = (data || []).find(n => n.content.toLowerCase().includes(fragment));
    if (match) {
      const { error } = await supabaseClient.from("atlas_notes").delete().eq("id", match.id);
      if (!error) return { ok: true, message: `Deleted note: <em>${escapeHtml(match.content)}</em>` };
    }
  }
  const list = getLocalNotes();
  const idx = list.findIndex(n => n.content.toLowerCase().includes(fragment));
  if (idx >= 0) {
    const [removed] = list.splice(idx, 1);
    setLocalNotes(list);
    return { ok: true, message: `Deleted note: <em>${escapeHtml(removed.content)}</em>` };
  }
  return { ok: false, message: `Couldn't find a note matching "${escapeHtml(fragment)}".` };
}

async function clearCompletedTasks() {
  let count = 0;
  if (supabaseClient) {
    const { data } = await supabaseClient.from("atlas_tasks").select("id").eq("done", true);
    if (data && data.length) {
      const { error } = await supabaseClient.from("atlas_tasks").delete().eq("done", true);
      if (!error) count += data.length;
    }
  }
  const list = getLocalTasks();
  const remaining = list.filter(t => !t.done);
  count += list.length - remaining.length;
  setLocalTasks(remaining);
  return { ok: true, message: count ? `Cleared ${count} completed task${count === 1 ? "" : "s"}.` : "No completed tasks to clear." };
}

/* =========================================================
   HELP + UTILITIES
========================================================= */

function help() {
  return {
    ok: true,
    message: `<strong>Money</strong><br>
      <code>/expense 200 food lunch</code> · <code>/income 500 salary</code><br>
      <code>/balance</code> · <code>/today</code> · <code>/week</code> · <code>/categories</code><br>
      <code>/undo</code> — delete your most recent transaction<br>
      <code>/removetx groceries</code> — delete a transaction by description<br><br>
      <strong>Tasks</strong><br>
      <code>/task buy milk</code> · <code>/tasks</code> · <code>/done buy milk</code> · <code>/undone buy milk</code><br>
      <code>/delete buy milk</code> — delete a task · <code>/cleartasks</code> — clear all completed<br><br>
      <strong>Notes</strong><br>
      <code>/note call landlord</code> · <code>/notes</code> · <code>/deletenote landlord</code><br><br>
      <strong>Other</strong><br>
      <code>/clear</code> — clear this console<br><br>
      Natural phrasing also works: "spent 200 on food", "undo", "delete note landlord".`
  };
}

function appendLog(role, html) {
  const entry = document.createElement("div");
  entry.className = `log-row log-${role}`;
  entry.innerHTML = `<div class="log-bubble"><p>${html}</p></div>`;
  logEl.appendChild(entry);
  logEl.scrollTop = logEl.scrollHeight;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function peso(value) {
  return typeof formatAtlasCurrency === "function" ? formatAtlasCurrency(value)
    : new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(value);
}