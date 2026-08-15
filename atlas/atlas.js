/* =========================================================
   ATLAS — command console
   Same Supabase project/keys as the Budget Tracker.
   No AI API involved — pure JS parsing + Supabase calls.
   Everything here is designed so a real LLM could later
   call the same handler functions as "tools".
========================================================= */

const SUPABASE_URL = "https://wmedotwgqrsgrhjdzbbn.supabase.co";
const SUPABASE_KEY = "sb_publishable_6NI-3Sg2gv0NSEm7mBddHw_kNi2sg-f";

const CATEGORIES = ["Bill", "Essential", "Savings", "Credit Card", "Non-Essential", "Extra"];

let supabaseClient = null;
try {
  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
} catch (e) {
  console.warn("Atlas: could not init Supabase, falling back to localStorage only.", e);
}

const logEl = document.getElementById("consoleLog");
const inputEl = document.getElementById("commandInput");
const buttonEl = document.getElementById("commandButton");
const suggestionsEl = document.getElementById("suggestions");

const SUGGESTIONS = ["/expense 200 food lunch", "/income 500 salary", "/balance", "/task buy milk", "/tasks", "/done buy milk", "/help"];

document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  const prefill = params.get("q");
  if (prefill) { inputEl.value = prefill; }

  SUGGESTIONS.forEach(s => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = s;
    b.addEventListener("click", () => { inputEl.value = s; inputEl.focus(); });
    suggestionsEl.appendChild(b);
  });

  buttonEl.addEventListener("click", handleSubmit);
  inputEl.addEventListener("keydown", e => { if (e.key === "Enter") handleSubmit(); });
});

async function handleSubmit() {
  const raw = inputEl.value.trim();
  if (!raw) return;
  appendLog("user", escapeHtml(raw));
  inputEl.value = "";

  let result;
  try {
    result = await routeCommand(raw);
  } catch (err) {
    console.error(err);
    result = { ok: false, message: "Something went wrong running that. Check the console for details." };
  }
  appendLog(result.ok === false ? "error" : "system", result.message);
}

/* =========================================================
   ROUTER — tries a slash command first, then natural phrasing
========================================================= */

async function routeCommand(raw) {
  const text = raw.trim();

  if (text.startsWith("/")) {
    const [cmd, ...rest] = text.slice(1).split(" ");
    const argText = rest.join(" ").trim();
    return runCommand(cmd.toLowerCase(), argText);
  }

  // natural-language aliases -> same handlers
  const lower = text.toLowerCase();

  let m = lower.match(/^(spent|spend|paid)\s+(\d+(\.\d+)?)\s*(on)?\s*(.*)$/);
  if (m) return runCommand("expense", `${m[2]} ${m[5]}`.trim());

  m = lower.match(/^(earned|got|received|income)\s+(\d+(\.\d+)?)\s*(from)?\s*(.*)$/);
  if (m) return runCommand("income", `${m[2]} ${m[5]}`.trim());

  if (/^(what'?s|whats|check)?\s*my balance\??$/.test(lower) || lower === "balance") {
    return runCommand("balance", "");
  }

  m = lower.match(/^(add task|remind me to|todo)\s+(.*)$/);
  if (m) return runCommand("task", m[2]);

  m = lower.match(/^(done|finished|complete[d]?)\s+(.*)$/);
  if (m) return runCommand("done", m[2]);

  if (/^(what are my tasks|show tasks|my tasks)\??$/.test(lower)) {
    return runCommand("tasks", "");
  }

  return {
    ok: false,
    message: `I didn't recognize that. Type <code>/help</code> to see what I understand, or try things like "spent 200 on food" or "add task buy milk".`
  };
}

async function runCommand(cmd, args) {
  switch (cmd) {
    case "expense": return addTransaction("expense", args);
    case "income":  return addTransaction("income", args);
    case "balance": return getBalance();
    case "task":    return addTask(args);
    case "tasks":   return listTasks();
    case "done":    return completeTask(args);
    case "help":    return help();
    default:
      return { ok: false, message: `Unknown command <code>/${escapeHtml(cmd)}</code>. Type <code>/help</code> for the list.` };
  }
}

/* =========================================================
   BUDGET — reuses the same "transactions" table/columns as
   the Budget Tracker, and the same localStorage key as fallback.
========================================================= */

async function addTransaction(type, args) {
  const match = args.match(/^(\d+(\.\d+)?)\s*(.*)$/);
  if (!match) {
    return { ok: false, message: `Give me an amount, e.g. <code>/${type} 200 food lunch</code>.` };
  }
  const amount = parseFloat(match[1]);
  const rest = match[3].trim();

  const foundCategory = CATEGORIES.find(c => rest.toLowerCase().includes(c.toLowerCase()));
  const description = rest || (type === "expense" ? "Expense" : "Income");
  const today = new Date().toISOString().slice(0, 10);

  const row = {
    transaction_date: today,
    description,
    amount,
    transaction_type: type,
    category: foundCategory || null,
    account: null,
    notes: null
  };

  if (supabaseClient) {
    const { error } = await supabaseClient.from("transactions").insert(row);
    if (error) {
      console.error(error);
      return { ok: false, message: `Couldn't save to Supabase (${escapeHtml(error.message)}). Saved locally instead.`, };
    }
  } else {
    saveLocalTransaction(row);
  }

  const sign = type === "expense" ? "−" : "+";
  return { ok: true, message: `Logged ${sign}${peso(amount)} — <strong>${escapeHtml(description)}</strong>${foundCategory ? ` (${foundCategory})` : ""}.` };
}

function saveLocalTransaction(row) {
  const raw = localStorage.getItem("budgetTracker_transactions");
  const list = raw ? JSON.parse(raw) : [];
  list.unshift({ id: `local-${Date.now()}`, ...row });
  localStorage.setItem("budgetTracker_transactions", JSON.stringify(list));
}

async function getBalance() {
  let rows = [];
  if (supabaseClient) {
    const { data, error } = await supabaseClient.from("transactions").select("*");
    if (!error && Array.isArray(data)) rows = data;
  }
  if (!rows.length) {
    const raw = localStorage.getItem("budgetTracker_transactions");
    rows = raw ? JSON.parse(raw) : [];
  }

  let balance = 0;
  for (const r of rows) {
    const amt = Number(r.amount) || 0;
    const type = r.transaction_type ?? r.type ?? "expense";
    balance += type === "income" ? amt : -amt;
  }
  return { ok: true, message: `Your current balance is <strong>${peso(balance)}</strong> across ${rows.length} transaction${rows.length === 1 ? "" : "s"}.` };
}

/* =========================================================
   TASKS — needs an "atlas_tasks" table in Supabase:

   create table atlas_tasks (
     id uuid primary key default gen_random_uuid(),
     title text not null,
     done boolean not null default false,
     created_at timestamptz not null default now()
   );

   Falls back to localStorage ("atlas_tasks") if that table
   doesn't exist yet or Supabase is unreachable.
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

  const items = open.slice(0, 8).map(t => `• ${escapeHtml(t.title)}`).join("<br>");
  return { ok: true, message: `<strong>Open tasks</strong><br>${items}` };
}

async function completeTask(titleFragment) {
  titleFragment = titleFragment.trim().toLowerCase();
  if (!titleFragment) return { ok: false, message: `Tell me which task, e.g. <code>/done buy milk</code>.` };

  if (supabaseClient) {
    const { data } = await supabaseClient.from("atlas_tasks").select("*").eq("done", false);
    const match = (data || []).find(t => t.title.toLowerCase().includes(titleFragment));
    if (match) {
      const { error } = await supabaseClient.from("atlas_tasks").update({ done: true }).eq("id", match.id);
      if (!error) return { ok: true, message: `Marked done: <strong>${escapeHtml(match.title)}</strong>.` };
    }
  }
  const list = getLocalTasks();
  const local = list.find(t => !t.done && t.title.toLowerCase().includes(titleFragment));
  if (local) {
    local.done = true;
    setLocalTasks(list);
    return { ok: true, message: `Marked done: <strong>${escapeHtml(local.title)}</strong>.` };
  }
  return { ok: false, message: `Couldn't find an open task matching "${escapeHtml(titleFragment)}".` };
}

function getLocalTasks() {
  const raw = localStorage.getItem("atlas_tasks");
  return raw ? JSON.parse(raw) : [];
}
function setLocalTasks(list) {
  localStorage.setItem("atlas_tasks", JSON.stringify(list));
}

/* =========================================================
   HELP + UTILITIES
========================================================= */

function help() {
  return {
    ok: true,
    message: `<strong>Commands</strong><br>
      <code>/expense 200 food lunch</code> — log an expense<br>
      <code>/income 500 salary</code> — log income<br>
      <code>/balance</code> — current balance<br>
      <code>/task buy milk</code> — add a task<br>
      <code>/tasks</code> — list open tasks<br>
      <code>/done buy milk</code> — complete a task<br><br>
      You can also just talk normally: "spent 200 on food", "add task buy milk", "what's my balance".`
  };
}

function appendLog(role, html) {
  const entry = document.createElement("div");
  entry.className = `log-entry log-${role}`;
  entry.innerHTML = `<div class="log-bubble"><strong>${role === "user" ? "You" : "Atlas"}</strong><p>${html}</p></div>`;
  logEl.appendChild(entry);
  logEl.scrollTop = logEl.scrollHeight;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function peso(value) {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(value);
}
