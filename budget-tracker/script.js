/* =========================================================
   BUDGET TRACKER
   script.js
   Supabase + Local Fallback Version
========================================================= */

/* =========================================================
   SUPABASE CONFIGURATION
========================================================= */

/*
 * Replace these with your actual Supabase project values.
 *
 * IMPORTANT:
 * Use your PUBLISHABLE key here.
 * NEVER put your secret/service_role key in browser code.
 */
const SUPABASE_URL = "YOUR_SUPABASE_URL";
const SUPABASE_KEY = "YOUR_SUPABASE_PUBLISHABLE_KEY";

let supabaseClient = null;
let supabaseConnected = false;

/* =========================================================
   APPLICATION CONSTANTS
========================================================= */

const CATEGORIES = [
    "Bill",
    "Essential",
    "Savings",
    "Credit Card",
    "Non-Essential",
    "Extra"
];

const CATEGORY_COLORS = {
    "Bill": "#ef4444",
    "Essential": "#f97316",
    "Savings": "#8b5cf6",
    "Credit Card": "#ec4899",
    "Non-Essential": "#eab308",
    "Extra": "#06b6d4"
};

const DEFAULT_BUDGETS = {
    "Bill": 0,
    "Essential": 0,
    "Savings": 0,
    "Credit Card": 0,
    "Non-Essential": 0,
    "Extra": 0
};

const STORAGE_KEYS = {
    transactions: "budgetTracker_transactions",
    budgets: "budgetTracker_budgets"
};

/* =========================================================
   DATA
========================================================= */

let transactions = [];

let budgets = {
    ...DEFAULT_BUDGETS
};

let currentPeriod = "daily";

let sortField = "date";

let sortDirection = "desc";

let incomeExpenseChart = null;

let toastTimer = null;

/* =========================================================
   INITIALIZATION
========================================================= */

document.addEventListener("DOMContentLoaded", async () => {

    setDefaultDates();

    setupEvents();

    const connected = initializeSupabase();

    if (connected) {

        await Promise.all([
            loadTransactions(),
            loadBudgets()
        ]);

    } else {

        loadLocalData();

    }

    render();

});

/* =========================================================
   SUPABASE INITIALIZATION
========================================================= */

function initializeSupabase() {

    if (!window.supabase) {

        console.warn(
            "Supabase library was not loaded. Using local storage."
        );

        showToast(
            "Supabase unavailable. Using local storage."
        );

        return false;
    }

    if (
        !SUPABASE_URL ||
        SUPABASE_URL === "YOUR_SUPABASE_URL"
    ) {

        console.warn(
            "Supabase URL has not been configured."
        );

        return false;
    }

    if (
        !SUPABASE_KEY ||
        SUPABASE_KEY === "YOUR_SUPABASE_PUBLISHABLE_KEY"
    ) {

        console.warn(
            "Supabase publishable key has not been configured."
        );

        return false;
    }

    try {

        supabaseClient =
            window.supabase.createClient(
                SUPABASE_URL,
                SUPABASE_KEY
            );

        supabaseConnected = true;

        console.log(
            "Supabase connected."
        );

        return true;

    } catch (error) {

        console.error(
            "Supabase initialization error:",
            error
        );

        supabaseClient = null;
        supabaseConnected = false;

        showToast(
            "Could not connect to Supabase."
        );

        return false;
    }
}

/* =========================================================
   LOCAL STORAGE
========================================================= */

function loadLocalData() {

    try {

        const savedTransactions =
            localStorage.getItem(
                STORAGE_KEYS.transactions
            );

        const savedBudgets =
            localStorage.getItem(
                STORAGE_KEYS.budgets
            );

        transactions =
            savedTransactions
                ? JSON.parse(savedTransactions)
                : [];

        budgets = {
            ...DEFAULT_BUDGETS,
            ...(savedBudgets
                ? JSON.parse(savedBudgets)
                : {})
        };

    } catch (error) {

        console.error(
            "Could not load local data:",
            error
        );

        transactions = [];

        budgets = {
            ...DEFAULT_BUDGETS
        };
    }
}

function saveLocalData() {

    try {

        localStorage.setItem(
            STORAGE_KEYS.transactions,
            JSON.stringify(transactions)
        );

        localStorage.setItem(
            STORAGE_KEYS.budgets,
            JSON.stringify(budgets)
        );

    } catch (error) {

        console.error(
            "Could not save local data:",
            error
        );
    }
}

/* =========================================================
   LOAD TRANSACTIONS
========================================================= */

async function loadTransactions() {

    if (!supabaseClient) {

        loadLocalData();

        return;
    }

    try {

        const {
            data,
            error
        } = await supabaseClient
            .from("transactions")
            .select("*")
            .order(
                "transaction_date",
                {
                    ascending: false
                }
            );

        if (error) {

            console.error(
                "Error loading transactions:",
                error
            );

            showToast(
                "Could not load transactions."
            );

            loadLocalData();

            return;
        }

        transactions =
            (data || []).map(
                normalizeTransaction
            );

    } catch (error) {

        console.error(
            "Unexpected transaction loading error:",
            error
        );

        loadLocalData();
    }
}

/* =========================================================
   LOAD BUDGETS
========================================================= */

async function loadBudgets() {

    if (!supabaseClient) {

        return;
    }

    try {

        const {
            data,
            error
        } = await supabaseClient
            .from("budgets")
            .select("*");

        if (error) {

            console.error(
                "Error loading budgets:",
                error
            );

            /*
             * Keep default/local budgets instead
             * of destroying the current state.
             */
            loadLocalBudgets();

            return;
        }

        budgets = {
            ...DEFAULT_BUDGETS
        };

        (data || []).forEach(
            row => {

                if (
                    CATEGORIES.includes(
                        row.category
                    )
                ) {

                    budgets[row.category] =
                        Number(row.amount) || 0;
                }
            }
        );

        saveLocalBudgets();

    } catch (error) {

        console.error(
            "Unexpected budget loading error:",
            error
        );

        loadLocalBudgets();
    }
}

/* =========================================================
   LOCAL BUDGET HELPERS
========================================================= */

function loadLocalBudgets() {

    try {

        const saved =
            localStorage.getItem(
                STORAGE_KEYS.budgets
            );

        budgets = {
            ...DEFAULT_BUDGETS,
            ...(saved
                ? JSON.parse(saved)
                : {})
        };

    } catch {

        budgets = {
            ...DEFAULT_BUDGETS
        };
    }
}

function saveLocalBudgets() {

    try {

        localStorage.setItem(
            STORAGE_KEYS.budgets,
            JSON.stringify(budgets)
        );

    } catch (error) {

        console.error(
            "Could not save budgets locally:",
            error
        );
    }
}

/* =========================================================
   NORMALIZE TRANSACTION
========================================================= */

function normalizeTransaction(transaction) {

    return {

        id:
            transaction.id,

        type:
            transaction.transaction_type ??
            transaction.type ??
            "expense",

        amount:
            Number(
                transaction.amount
            ) || 0,

        date:
            transaction.transaction_date ??
            transaction.date ??
            "",

        category:
            transaction.category ??
            "",

        account:
            transaction.account ??
            "",

        description:
            transaction.description ??
            "",

        notes:
            transaction.notes ??
            ""

    };
}

/* =========================================================
   EVENT LISTENERS
========================================================= */

function setupEvents() {

    const transactionForm =
        document.getElementById(
            "transactionForm"
        );

    const budgetForm =
        document.getElementById(
            "budgetForm"
        );

    if (transactionForm) {

        transactionForm.addEventListener(
            "submit",
            addTransaction
        );
    }

    if (budgetForm) {

        budgetForm.addEventListener(
            "submit",
            saveBudgets
        );
    }

    const searchInput =
        document.getElementById(
            "searchInput"
        );

    if (searchInput) {

        searchInput.addEventListener(
            "input",
            renderTransactions
        );
    }

    const filterType =
        document.getElementById(
            "filterType"
        );

    if (filterType) {

        filterType.addEventListener(
            "change",
            renderTransactions
        );
    }

    const filterCategory =
        document.getElementById(
            "filterCategory"
        );

    if (filterCategory) {

        filterCategory.addEventListener(
            "change",
            renderTransactions
        );
    }

    const filterDateFrom =
        document.getElementById(
            "filterDateFrom"
        );

    if (filterDateFrom) {

        filterDateFrom.addEventListener(
            "change",
            renderTransactions
        );
    }

    const filterDateTo =
        document.getElementById(
            "filterDateTo"
        );

    if (filterDateTo) {

        filterDateTo.addEventListener(
            "change",
            renderTransactions
        );
    }

    const periodDate =
        document.getElementById(
            "periodDate"
        );

    if (periodDate) {

        periodDate.addEventListener(
            "change",
            render
        );
    }

    document
        .querySelectorAll(".period-btn")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    document
                        .querySelectorAll(
                            ".period-btn"
                        )
                        .forEach(
                            btn =>
                                btn.classList.remove(
                                    "active"
                                )
                        );

                    button.classList.add(
                        "active"
                    );

                    currentPeriod =
                        button.dataset.period ||
                        "daily";

                    render();
                }
            );

        });

    /*
     * Optional clear filters button.
     * Works if your HTML has:
     * id="clearFilters"
     */
    const clearFilters =
        document.getElementById(
            "clearFilters"
        );

    if (clearFilters) {

        clearFilters.addEventListener(
            "click",
            clearTransactionFilters
        );
    }

    /*
     * Optional refresh button.
     */
    const refreshButton =
        document.getElementById(
            "refreshData"
        );

    if (refreshButton) {

        refreshButton.addEventListener(
            "click",
            refreshData
        );
    }

    /*
     * Optional sort headers.
     */
    document
        .querySelectorAll(
            "[data-sort]"
        )
        .forEach(element => {

            element.addEventListener(
                "click",
                () => {

                    sortTransactions(
                        element.dataset.sort
                    );

                }
            );

        });
}

/* =========================================================
   ADD TRANSACTION
========================================================= */

async function addTransaction(event) {

    event.preventDefault();

    const type =
        document.getElementById(
            "transactionType"
        )?.value || "expense";

    const amount =
        Number(
            document.getElementById(
                "amount"
            )?.value
        );

    const date =
        document.getElementById(
            "transactionDate"
        )?.value ||
        getLocalDate();

    const category =
        document.getElementById(
            "category"
        )?.value || "";

    const account =
        document.getElementById(
            "account"
        )?.value || "";

    const description =
        document.getElementById(
            "description"
        )?.value.trim() || "";

    const notes =
        document.getElementById(
            "notes"
        )?.value.trim() || "";

    if (!Number.isFinite(amount) || amount <= 0) {

        showToast(
            "Please enter a valid amount."
        );

        return;
    }

    if (!date) {

        showToast(
            "Please select a date."
        );

        return;
    }

    if (!description) {

        showToast(
            "Please enter a description."
        );

        return;
    }

    if (
        type === "expense" &&
        !category
    ) {

        showToast(
            "Please select a category."
        );

        return;
    }

    const submitButton =
        event.target.querySelector(
            'button[type="submit"]'
        );

    if (submitButton) {

        submitButton.disabled = true;
        submitButton.dataset.originalText =
            submitButton.textContent;

        submitButton.textContent =
            "Saving...";
    }

    const localTransaction = {

        id:
            crypto?.randomUUID
                ? crypto.randomUUID()
                : String(Date.now()),

        type,

        amount,

        date,

        category,

        account,

        description,

        notes

    };

    try {

        /*
         * LOCAL MODE
         */
        if (!supabaseClient) {

            transactions.unshift(
                localTransaction
            );

            saveLocalData();

            render();

            closeTransactionModal();

            resetTransactionForm();

            showToast(
                "Transaction saved locally."
            );

            return;
        }

        /*
         * SUPABASE MODE
         */
        const {
            data,
            error
        } = await supabaseClient
            .from("transactions")
            .insert({
                transaction_date: date,
                description,
                amount,
                transaction_type: type,
                category: category || null,
                account: account || null,
                notes: notes || null
            })
            .select()
            .single();

        if (error) {

            console.error(
                "Error adding transaction:",
                error
            );

            showToast(
                error.message ||
                "Failed to save transaction."
            );

            return;
        }

        transactions.unshift(
            normalizeTransaction(data)
        );

        render();

        closeTransactionModal();

        resetTransactionForm();

        showToast(
            "Transaction saved!"
        );

    } catch (error) {

        console.error(
            "Unexpected add transaction error:",
            error
        );

        showToast(
            "Something went wrong while saving."
        );

    } finally {

        if (submitButton) {

            submitButton.disabled = false;

            submitButton.textContent =
                submitButton.dataset.originalText ||
                "Save";
        }
    }
}

/* =========================================================
   RESET TRANSACTION FORM
========================================================= */

function resetTransactionForm() {

    const form =
        document.getElementById(
            "transactionForm"
        );

    if (form) {

        form.reset();
    }

    const dateInput =
        document.getElementById(
            "transactionDate"
        );

    if (dateInput) {

        dateInput.value =
            getLocalDate();
    }
}

/* =========================================================
   DELETE TRANSACTION
========================================================= */

async function deleteTransaction(id) {

    const transaction =
        transactions.find(
            t =>
                String(t.id) ===
                String(id)
        );

    if (!transaction) {

        showToast(
            "Transaction not found."
        );

        return;
    }

    const confirmed =
        window.confirm(
            `Delete "${transaction.description}" (${formatMoney(transaction.amount)})?`
        );

    if (!confirmed) {

        return;
    }

    try {

        /*
         * LOCAL MODE
         */
        if (!supabaseClient) {

            transactions =
                transactions.filter(
                    t =>
                        String(t.id) !==
                        String(id)
                );

            saveLocalData();

            render();

            showToast(
                "Transaction deleted."
            );

            return;
        }

        /*
         * SUPABASE MODE
         */
        const {
            error
        } = await supabaseClient
            .from("transactions")
            .delete()
            .eq("id", id);

        if (error) {

            console.error(
                "Delete error:",
                error
            );

            showToast(
                error.message ||
                "Failed to delete transaction."
            );

            return;
        }

        transactions =
            transactions.filter(
                t =>
                    String(t.id) !==
                    String(id)
            );

        render();

        showToast(
            "Transaction deleted."
        );

    } catch (error) {

        console.error(
            "Unexpected delete error:",
            error
        );

        showToast(
            "Something went wrong."
        );
    }
}

/* =========================================================
   PERIOD TRANSACTIONS
========================================================= */

function getPeriodTransactions() {

    const periodDate =
        document.getElementById(
            "periodDate"
        );

    const selectedDate =
        periodDate?.value ||
        getLocalDate();

    if (!selectedDate) {

        return [...transactions];
    }

    /*
     * YYYY-MM-DD string comparisons are safe
     * for this type of filtering.
     */

    if (currentPeriod === "daily") {

        return transactions.filter(
            transaction =>
                transaction.date ===
                selectedDate
        );
    }

    const selected =
        new Date(
            `${selectedDate}T00:00:00`
        );

    if (
        Number.isNaN(
            selected.getTime()
        )
    ) {

        return [...transactions];
    }

    if (currentPeriod === "monthly") {

        const year =
            selected.getFullYear();

        const month =
            selected.getMonth();

        return transactions.filter(
            transaction => {

                const date =
                    new Date(
                        `${transaction.date}T00:00:00`
                    );

                return (
                    date.getFullYear() === year &&
                    date.getMonth() === month
                );
            }
        );
    }

    if (currentPeriod === "yearly") {

        const year =
            selected.getFullYear();

        return transactions.filter(
            transaction => {

                const date =
                    new Date(
                        `${transaction.date}T00:00:00`
                    );

                return (
                    date.getFullYear() === year
                );
            }
        );
    }

    return [...transactions];
}

/* =========================================================
   RENDER EVERYTHING
========================================================= */

function render() {

    renderSummary();

    renderCategories();

    renderBudgets();

    renderTransactions();

    renderChart();
}

/* =========================================================
   SUMMARY
========================================================= */

function renderSummary() {

    const data =
        getPeriodTransactions();

    const income =
        sumTransactions(
            data,
            "income"
        );

    const expense =
        sumTransactions(
            data,
            "expense"
        );

    const savings =
        data
            .filter(
                t =>
                    t.type === "expense" &&
                    t.category === "Savings"
            )
            .reduce(
                (sum, t) =>
                    sum + Number(t.amount || 0),
                0
            );

    const balance =
        income - expense;

    setText(
        "totalIncome",
        formatMoney(income)
    );

    setText(
        "totalExpense",
        formatMoney(expense)
    );

    setText(
        "totalSavings",
        formatMoney(savings)
    );

    const balanceElement =
        document.getElementById(
            "balance"
        );

    if (balanceElement) {

        balanceElement.textContent =
            formatMoney(balance);

        balanceElement.style.color =
            balance >= 0
                ? "var(--success)"
                : "var(--danger)";
    }
}

/* =========================================================
   CATEGORY BREAKDOWN
========================================================= */

function renderCategories() {

    const container =
        document.getElementById(
            "categoryBreakdown"
        );

    if (!container) {

        return;
    }

    const data =
        getPeriodTransactions();

    const totals = {};

    CATEGORIES.forEach(
        category => {

            totals[category] =
                data
                    .filter(
                        t =>
                            t.type === "expense" &&
                            t.category === category
                    )
                    .reduce(
                        (sum, t) =>
                            sum +
                            Number(t.amount || 0),
                        0
                    );
        }
    );

    const totalExpenses =
        Object.values(totals)
            .reduce(
                (sum, value) =>
                    sum + value,
                0
            );

    container.innerHTML =
        CATEGORIES
            .map(category => {

                const amount =
                    totals[category];

                const percent =
                    totalExpenses > 0
                        ? (amount / totalExpenses) * 100
                        : 0;

                return `
                    <div class="category-row">

                        <div class="category-top">

                            <span>
                                ${escapeHTML(category)}
                            </span>

                            <strong>
                                ${formatMoney(amount)}
                            </strong>

                        </div>

                        <div class="progress">

                            <div
                                class="progress-bar"
                                style="
                                    width:${Math.min(percent, 100)}%;
                                    background:${CATEGORY_COLORS[category]};
                                "
                            ></div>

                        </div>

                    </div>
                `;

            })
            .join("");
}

/* =========================================================
   BUDGET DISPLAY
========================================================= */

function renderBudgets() {

    const container =
        document.getElementById(
            "budgetList"
        );

    if (!container) {

        return;
    }

    const data =
        getPeriodTransactions();

    container.innerHTML =
        CATEGORIES
            .map(category => {

                const spent =
                    data
                        .filter(
                            t =>
                                t.type === "expense" &&
                                t.category === category
                        )
                        .reduce(
                            (sum, t) =>
                                sum +
                                Number(t.amount || 0),
                            0
                        );

                const limit =
                    Number(
                        budgets[category]
                    ) || 0;

                const percentage =
                    limit > 0
                        ? (spent / limit) * 100
                        : 0;

                const width =
                    Math.min(
                        Math.max(percentage, 0),
                        100
                    );

                let color =
                    "#16a34a";

                if (percentage >= 100) {

                    color =
                        "#dc2626";

                } else if (percentage >= 80) {

                    color =
                        "#f59e0b";
                }

                return `
                    <div class="budget-item">

                        <div class="budget-name">

                            <strong>
                                ${escapeHTML(category)}
                            </strong>

                            <span class="budget-number">

                                ${
                                    limit > 0
                                        ? `${formatMoney(spent)} / ${formatMoney(limit)}`
                                        : `${formatMoney(spent)} / No limit`
                                }

                            </span>

                        </div>

                        <div class="progress">

                            <div
                                class="progress-bar"
                                style="
                                    width:${width}%;
                                    background:${color};
                                "
                            ></div>

                        </div>

                        ${
                            limit > 0
                                ? `
                                    <div
                                        style="
                                            margin-top:5px;
                                            font-size:12px;
                                            color:${color};
                                        "
                                    >
                                        ${percentage.toFixed(0)}% used
                                    </div>
                                `
                                : ""
                        }

                    </div>
                `;

            })
            .join("");
}

/* =========================================================
   TRANSACTION TABLE
========================================================= */

function renderTransactions() {

    const tbody =
        document.getElementById(
            "transactionTable"
        );

    if (!tbody) {

        return;
    }

    let data =
        [...transactions];

    const search =
        (
            document.getElementById(
                "searchInput"
            )?.value || ""
        )
            .toLowerCase()
            .trim();

    const type =
        document.getElementById(
            "filterType"
        )?.value || "all";

    const category =
        document.getElementById(
            "filterCategory"
        )?.value || "all";

    const dateFrom =
        document.getElementById(
            "filterDateFrom"
        )?.value || "";

    const dateTo =
        document.getElementById(
            "filterDateTo"
        )?.value || "";

    /* SEARCH */

    if (search) {

        data =
            data.filter(t => {

                const searchable = [

                    t.description,

                    t.category,

                    t.account,

                    t.notes,

                    t.type,

                    t.date

                ]
                    .map(
                        value =>
                            String(
                                value ?? ""
                            ).toLowerCase()
                    )
                    .join(" ");

                return searchable.includes(
                    search
                );
            });
    }

    /* TYPE */

    if (type !== "all") {

        data =
            data.filter(
                t =>
                    t.type === type
            );
    }

    /* CATEGORY */

    if (category !== "all") {

        data =
            data.filter(
                t =>
                    t.category === category
            );
    }

    /* DATE FROM */

    if (dateFrom) {

        data =
            data.filter(
                t =>
                    t.date >= dateFrom
            );
    }

    /* DATE TO */

    if (dateTo) {

        data =
            data.filter(
                t =>
                    t.date <= dateTo
            );
    }

    /* SORT */

    data.sort(
        compareTransactions
    );

    /* EMPTY */

    if (!data.length) {

        tbody.innerHTML = `
            <tr>
                <td colspan="7">
                    <div class="empty">

                        <div style="font-size:40px;">
                            📭
                        </div>

                        <p>
                            No transactions found.
                        </p>

                    </div>
                </td>
            </tr>
        `;

        return;
    }

    /* TABLE */

    tbody.innerHTML =
        data
            .map(t => {

                const id =
                    escapeHTML(
                        String(t.id)
                    );

                return `
                    <tr>

                        <td>
                            ${formatDate(t.date)}
                        </td>

                        <td>

                            <strong>
                                ${escapeHTML(
                                    t.description
                                )}
                            </strong>

                            ${
                                t.notes
                                    ? `
                                        <div
                                            style="
                                                font-size:11px;
                                                color:#9ca3af;
                                                margin-top:3px;
                                            "
                                        >
                                            ${escapeHTML(t.notes)}
                                        </div>
                                    `
                                    : ""
                            }

                        </td>

                        <td>

                            <span class="badge">
                                ${escapeHTML(
                                    t.category || "—"
                                )}
                            </span>

                        </td>

                        <td>

                            ${
                                t.type === "income"
                                    ? `
                                        <span class="income-text">
                                            Money In
                                        </span>
                                    `
                                    : `
                                        <span class="expense-text">
                                            Money Out
                                        </span>
                                    `
                            }

                        </td>

                        <td>

                            <span
                                class="${
                                    t.type === "income"
                                        ? "income-text"
                                        : "expense-text"
                                }"
                            >

                                ${
                                    t.type === "income"
                                        ? "+"
                                        : "-"
                                }

                                ${formatMoney(t.amount)}

                            </span>

                        </td>

                        <td>
                            ${escapeHTML(
                                t.account || "—"
                            )}
                        </td>

                        <td>

                            <button
                                type="button"
                                class="delete-btn"
                                data-delete-id="${id}"
                                onclick="deleteTransaction(${JSON.stringify(String(t.id))})"
                            >
                                Delete
                            </button>

                        </td>

                    </tr>
                `;
            })
            .join("");
}

/* =========================================================
   SORT
========================================================= */

function sortTransactions(field) {

    const allowedFields = [
        "date",
        "amount",
        "description",
        "category",
        "account",
        "type"
    ];

    if (
        !allowedFields.includes(field)
    ) {

        field = "date";
    }

    if (sortField === field) {

        sortDirection =
            sortDirection === "asc"
                ? "desc"
                : "asc";

    } else {

        sortField =
            field;

        sortDirection =
            "desc";
    }

    renderTransactions();
}

function compareTransactions(a, b) {

    let valueA;
    let valueB;

    switch (sortField) {

        case "amount":

            valueA =
                Number(a.amount) || 0;

            valueB =
                Number(b.amount) || 0;

            break;

        case "description":

            valueA =
                String(
                    a.description || ""
                ).toLowerCase();

            valueB =
                String(
                    b.description || ""
                ).toLowerCase();

            break;

        case "category":

            valueA =
                String(
                    a.category || ""
                ).toLowerCase();

            valueB =
                String(
                    b.category || ""
                ).toLowerCase();

            break;

        case "account":

            valueA =
                String(
                    a.account || ""
                ).toLowerCase();

            valueB =
                String(
                    b.account || ""
                ).toLowerCase();

            break;

        case "type":

            valueA =
                String(
                    a.type || ""
                ).toLowerCase();

            valueB =
                String(
                    b.type || ""
                ).toLowerCase();

            break;

        case "date":

        default:

            valueA =
                a.date || "";

            valueB =
                b.date || "";

            break;
    }

    if (valueA < valueB) {

        return sortDirection === "asc"
            ? -1
            : 1;
    }

    if (valueA > valueB) {

        return sortDirection === "asc"
            ? 1
            : -1;
    }

    return 0;
}

/* =========================================================
   CHART
========================================================= */

function renderChart() {

    const canvas =
        document.getElementById(
            "incomeExpenseChart"
        );

    if (!canvas) {

        return;
    }

    if (
        typeof Chart ===
        "undefined"
    ) {

        console.warn(
            "Chart.js is not loaded."
        );

        return;
    }

    const data =
        getPeriodTransactions();

    const income =
        sumTransactions(
            data,
            "income"
        );

    const expense =
        sumTransactions(
            data,
            "expense"
        );

    if (incomeExpenseChart) {

        try {

            incomeExpenseChart.destroy();

        } catch {

            /* Ignore old chart errors. */
        }

        incomeExpenseChart = null;
    }

    const ctx =
        canvas.getContext("2d");

    if (!ctx) {

        return;
    }

    incomeExpenseChart =
        new Chart(
            ctx,
            {
                type: "bar",

                data: {

                    labels: [
                        "Income",
                        "Expenses"
                    ],

                    datasets: [
                        {
                            label: "Amount",

                            data: [
                                income,
                                expense
                            ],

                            backgroundColor: [
                                "#16a34a",
                                "#dc2626"
                            ],

                            borderRadius: 8,

                            borderSkipped: false
                        }
                    ]
                },

                options: {

                    responsive: true,

                    maintainAspectRatio: false,

                    plugins: {

                        legend: {
                            display: false
                        },

                        tooltip: {

                            callbacks: {

                                label: context =>
                                    formatMoney(
                                        context.raw
                                    )
                            }
                        }
                    },

                    scales: {

                        y: {

                            beginAtZero: true,

                            ticks: {

                                callback: value =>
                                    formatMoney(
                                        value
                                    )
                            }
                        }
                    }
                }
            }
        );
}

/* =========================================================
   BUDGET MODAL
========================================================= */

function openBudgetModal() {

    const modal =
        document.getElementById(
            "budgetModal"
        );

    if (!modal) {

        return;
    }

    const fields = {

        budgetBill:
            budgets["Bill"],

        budgetEssential:
            budgets["Essential"],

        budgetSavings:
            budgets["Savings"],

        budgetCreditCard:
            budgets["Credit Card"],

        budgetNonEssential:
            budgets["Non-Essential"],

        budgetExtra:
            budgets["Extra"]
    };

    Object.entries(fields)
        .forEach(
            ([id, value]) => {

                const field =
                    document.getElementById(
                        id
                    );

                if (field) {

                    field.value =
                        Number(value) > 0
                            ? value
                            : "";
                }
            }
        );

    modal.classList.add(
        "show"
    );
}

function closeBudgetModal() {

    const modal =
        document.getElementById(
            "budgetModal"
        );

    if (modal) {

        modal.classList.remove(
            "show"
        );
    }
}

/* =========================================================
   SAVE BUDGETS
========================================================= */

async function saveBudgets(event) {

    event.preventDefault();

    const newBudgets = {

        "Bill":
            getNumberValue(
                "budgetBill"
            ),

        "Essential":
            getNumberValue(
                "budgetEssential"
            ),

        "Savings":
            getNumberValue(
                "budgetSavings"
            ),

        "Credit Card":
            getNumberValue(
                "budgetCreditCard"
            ),

        "Non-Essential":
            getNumberValue(
                "budgetNonEssential"
            ),

        "Extra":
            getNumberValue(
                "budgetExtra"
            )
    };

    /*
     * Validate values.
     */
    for (
        const [category, amount]
        of Object.entries(newBudgets)
    ) {

        if (
            !Number.isFinite(amount) ||
            amount < 0
        ) {

            showToast(
                `Invalid budget for ${category}.`
            );

            return;
        }
    }

    const submitButton =
        event.target.querySelector(
            'button[type="submit"]'
        );

    if (submitButton) {

        submitButton.disabled = true;

        submitButton.dataset.originalText =
            submitButton.textContent;

        submitButton.textContent =
            "Saving...";
    }

    try {

        /*
         * LOCAL MODE
         */
        if (!supabaseClient) {

            budgets = {
                ...newBudgets
            };

            saveLocalBudgets();

            renderBudgets();

            closeBudgetModal();

            showToast(
                "Budgets saved locally."
            );

            return;
        }

        /*
         * SUPABASE MODE
         */
        const rows =
            Object.entries(
                newBudgets
            ).map(
                ([category, amount]) => ({
                    category,
                    amount
                })
            );

        const {
            error
        } = await supabaseClient
            .from("budgets")
            .upsert(
                rows,
                {
                    onConflict: "category"
                }
            );

        if (error) {

            console.error(
                "Budget save error:",
                error
            );

            showToast(
                error.message ||
                "Failed to save budgets."
            );

            return;
        }

        budgets = {
            ...newBudgets
        };

        saveLocalBudgets();

        renderBudgets();

        closeBudgetModal();

        showToast(
            "Budgets saved!"
        );

    } catch (error) {

        console.error(
            "Unexpected budget save error:",
            error
        );

        showToast(
            "Something went wrong."
        );

    } finally {

        if (submitButton) {

            submitButton.disabled = false;

            submitButton.textContent =
                submitButton.dataset.originalText ||
                "Save";
        }
    }
}

/* =========================================================
   TRANSACTION MODAL
========================================================= */

function openTransactionModal() {

    const modal =
        document.getElementById(
            "transactionModal"
        );

    if (!modal) {

        return;
    }

    modal.classList.add(
        "show"
    );

    const dateInput =
        document.getElementById(
            "transactionDate"
        );

    if (dateInput && !dateInput.value) {

        dateInput.value =
            getLocalDate();
    }
}

function closeTransactionModal() {

    const modal =
        document.getElementById(
            "transactionModal"
        );

    if (modal) {

        modal.classList.remove(
            "show"
        );
    }
}

/* =========================================================
   FILTERS
========================================================= */

function clearTransactionFilters() {

    const search =
        document.getElementById(
            "searchInput"
        );

    const type =
        document.getElementById(
            "filterType"
        );

    const category =
        document.getElementById(
            "filterCategory"
        );

    const dateFrom =
        document.getElementById(
            "filterDateFrom"
        );

    const dateTo =
        document.getElementById(
            "filterDateTo"
        );

    if (search) {
        search.value = "";
    }

    if (type) {
        type.value = "all";
    }

    if (category) {
        category.value = "all";
    }

    if (dateFrom) {
        dateFrom.value = "";
    }

    if (dateTo) {
        dateTo.value = "";
    }

    renderTransactions();

    showToast(
        "Filters cleared."
    );
}

/* =========================================================
   REFRESH
========================================================= */

async function refreshData() {

    if (!supabaseClient) {

        loadLocalData();

        render();

        showToast(
            "Local data refreshed."
        );

        return;
    }

    showToast(
        "Refreshing..."
    );

    await Promise.all([
        loadTransactions(),
        loadBudgets()
    ]);

    render();

    showToast(
        "Data refreshed."
    );
}

/* =========================================================
   EXCEL EXPORT
========================================================= */

function exportExcel() {

    if (
        typeof XLSX ===
        "undefined"
    ) {

        showToast(
            "Excel library is not loaded."
        );

        return;
    }

    const data =
        transactions.map(
            t => ({

                Date:
                    t.date,

                Description:
                    t.description,

                Category:
                    t.category,

                Type:
                    t.type === "income"
                        ? "Income"
                        : "Expense",

                Amount:
                    Number(
                        t.amount
                    ),

                Account:
                    t.account,

                Notes:
                    t.notes || ""
            })
        );

    const worksheet =
        XLSX.utils.json_to_sheet(
            data
        );

    const workbook =
        XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
        workbook,
        worksheet,
        "Transactions"
    );

    XLSX.writeFile(
        workbook,
        "budget-transactions.xlsx"
    );

    showToast(
        "Excel file exported!"
    );
}

/* =========================================================
   PDF EXPORT
========================================================= */

function exportPDF() {

    if (
        !window.jspdf ||
        typeof window.jspdf.jsPDF !==
            "function"
    ) {

        showToast(
            "PDF library is not loaded."
        );

        return;
    }

    const {
        jsPDF
    } = window.jspdf;

    const doc =
        new jsPDF();

    const data =
        getPeriodTransactions();

    const income =
        sumTransactions(
            data,
            "income"
        );

    const expense =
        sumTransactions(
            data,
            "expense"
        );

    const balance =
        income - expense;

    doc.setFontSize(20);

    doc.text(
        "Budget Tracker Report",
        14,
        20
    );

    doc.setFontSize(11);

    doc.text(
        `Period: ${currentPeriod.toUpperCase()}`,
        14,
        29
    );

    doc.text(
        `Income: ${formatMoney(income)}`,
        14,
        38
    );

    doc.text(
        `Expenses: ${formatMoney(expense)}`,
        14,
        45
    );

    doc.text(
        `Balance: ${formatMoney(balance)}`,
        14,
        52
    );

    const rows =
        data.map(
            t => [

                t.date,

                t.description,

                t.category || "—",

                t.type === "income"
                    ? "Income"
                    : "Expense",

                `PHP ${Number(
                    t.amount || 0
                ).toLocaleString(
                    "en-PH",
                    {
                        minimumFractionDigits:
                            2
                    }
                )}`,

                t.account || "—"
            ]
        );

    if (
        typeof doc.autoTable ===
        "function"
    ) {

        doc.autoTable({

            startY: 62,

            head: [[
                "Date",
                "Description",
                "Category",
                "Type",
                "Amount",
                "Account"
            ]],

            body: rows,

            styles: {
                fontSize: 8
            },

            headStyles: {
                fillColor: [
                    37,
                    99,
                    235
                ]
            },

            alternateRowStyles: {
                fillColor: [
                    245,
                    247,
                    250
                ]
            }
        });

    } else {

        /*
         * Still generate a PDF if AutoTable
         * isn't loaded.
         */
        let y = 65;

        doc.setFontSize(9);

        data.forEach(t => {

            const line =
                `${t.date} | ${t.description} | ${t.category || "—"} | ${formatMoney(t.amount)}`;

            doc.text(
                line.substring(
                    0,
                    110
                ),
                14,
                y
            );

            y += 6;

            if (y > 280) {

                doc.addPage();

                y = 20;
            }
        });
    }

    doc.save(
        "budget-report.pdf"
    );

    showToast(
        "PDF file exported!"
    );
}

/* =========================================================
   HELPER: SUM TRANSACTIONS
========================================================= */

function sumTransactions(
    data,
    type
) {

    return data
        .filter(
            t =>
                t.type === type
        )
        .reduce(
            (sum, t) =>
                sum +
                Number(t.amount || 0),
            0
        );
}

/* =========================================================
   HELPER: SET TEXT
========================================================= */

function setText(
    id,
    value
) {

    const element =
        document.getElementById(id);

    if (element) {

        element.textContent =
            value;
    }
}

/* =========================================================
   HELPER: NUMBER
========================================================= */

function getNumberValue(id) {

    const element =
        document.getElementById(id);

    if (!element) {

        return 0;
    }

    const value =
        Number(
            element.value
        );

    if (
        !Number.isFinite(value) ||
        value < 0
    ) {

        return 0;
    }

    return value;
}

/* =========================================================
   HELPER: MONEY
========================================================= */

function formatMoney(amount) {

    const value =
        Number(amount);

    return (
        Number.isFinite(value)
            ? value
            : 0
    ).toLocaleString(
        "en-PH",
        {
            style: "currency",
            currency: "PHP",
            minimumFractionDigits: 2
        }
    );
}

/* =========================================================
   HELPER: DATE
========================================================= */

function formatDate(dateString) {

    if (!dateString) {

        return "";
    }

    const date =
        new Date(
            `${dateString}T00:00:00`
        );

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return escapeHTML(
            dateString
        );
    }

    return date.toLocaleDateString(
        "en-PH",
        {
            year: "numeric",
            month: "short",
            day: "numeric"
        }
    );
}

/* =========================================================
   HELPER: LOCAL DATE
========================================================= */

function getLocalDate() {

    const date =
        new Date();

    const year =
        date.getFullYear();

    const month =
        String(
            date.getMonth() + 1
        ).padStart(
            2,
            "0"
        );

    const day =
        String(
            date.getDate()
        ).padStart(
            2,
            "0"
        );

    return `${year}-${month}-${day}`;
}

/* =========================================================
   SET DEFAULT DATES
========================================================= */

function setDefaultDates() {

    const today =
        getLocalDate();

    const periodDate =
        document.getElementById(
            "periodDate"
        );

    const transactionDate =
        document.getElementById(
            "transactionDate"
        );

    if (
        periodDate &&
        !periodDate.value
    ) {

        periodDate.value =
            today;
    }

    if (
        transactionDate &&
        !transactionDate.value
    ) {

        transactionDate.value =
            today;
    }
}

/* =========================================================
   HELPER: TOAST
========================================================= */

function showToast(message) {

    const toast =
        document.getElementById(
            "toast"
        );

    if (!toast) {

        console.log(
            message
        );

        return;
    }

    toast.textContent =
        String(message);

    toast.classList.add(
        "show"
    );

    if (toastTimer) {

        clearTimeout(
            toastTimer
        );
    }

    toastTimer =
        setTimeout(
            () => {

                toast.classList.remove(
                    "show"
                );

            },
            2500
        );
}

/* =========================================================
   HELPER: ESCAPE HTML
========================================================= */

function escapeHTML(value) {

    return String(
        value ?? ""
    )
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );
}

/* =========================================================
   CLOSE MODALS WHEN CLICKING BACKDROP
========================================================= */

window.addEventListener(
    "click",
    event => {

        const transactionModal =
            document.getElementById(
                "transactionModal"
            );

        const budgetModal =
            document.getElementById(
                "budgetModal"
            );

        if (
            transactionModal &&
            event.target ===
                transactionModal
        ) {

            closeTransactionModal();
        }

        if (
            budgetModal &&
            event.target ===
                budgetModal
        ) {

            closeBudgetModal();
        }
    }
);

/* =========================================================
   ESCAPE KEY
========================================================= */

window.addEventListener(
    "keydown",
    event => {

        if (
            event.key ===
            "Escape"
        ) {

            closeTransactionModal();

            closeBudgetModal();
        }
    }
);

/* =========================================================
   NAVIGATION
========================================================= */

function scrollToSection(id) {

    const section =
        document.getElementById(
            id
        );

    if (section) {

        section.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    }
}

/* =========================================================
   OPTIONAL GLOBAL API
========================================================= */

window.openTransactionModal =
    openTransactionModal;

window.closeTransactionModal =
    closeTransactionModal;

window.openBudgetModal =
    openBudgetModal;

window.closeBudgetModal =
    closeBudgetModal;

window.deleteTransaction =
    deleteTransaction;

window.sortTransactions =
    sortTransactions;

window.exportExcel =
    exportExcel;

window.exportPDF =
    exportPDF;

window.scrollToSection =
    scrollToSection;

window.clearTransactionFilters =
    clearTransactionFilters;

window.refreshData =
    refreshData;