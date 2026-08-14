document.addEventListener("DOMContentLoaded", async () => {
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  document.getElementById("greeting").textContent = `${greeting} 👋`;
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
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(value);
}
