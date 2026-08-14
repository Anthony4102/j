/* =========================================================
   BUDGET TRACKER
   script.js
========================================================= */


/* =========================================================
   DATA
========================================================= */

let transactions =
    JSON.parse(
        localStorage.getItem("budgetTransactions")
    ) || [];


let budgets =
    JSON.parse(
        localStorage.getItem("budgetBudgets")
    ) || {

        "Bill": 0,

        "Essential": 0,

        "Savings": 0,

        "Credit Card": 0,

        "Non-Essential": 0,

        "Extra": 0
    };


let currentPeriod = "daily";

let sortField = "date";

let sortDirection = "desc";

let incomeExpenseChart = null;


/* =========================================================
   INITIALIZATION
========================================================= */

document.addEventListener("DOMContentLoaded", () => {

    const today = getLocalDate();


    const periodDate =
        document.getElementById("periodDate");

    const transactionDate =
        document.getElementById("transactionDate");


    if (periodDate) {

        periodDate.value = today;

    }


    if (transactionDate) {

        transactionDate.value = today;

    }


    setupEvents();

    render();

});


/* =========================================================
   EVENT LISTENERS
========================================================= */

function setupEvents() {

    const transactionForm =
        document.getElementById("transactionForm");


    const budgetForm =
        document.getElementById("budgetForm");


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
        document.getElementById("searchInput");


    if (searchInput) {

        searchInput.addEventListener(
            "input",
            renderTransactions
        );

    }


    const filterType =
        document.getElementById("filterType");


    if (filterType) {

        filterType.addEventListener(
            "change",
            renderTransactions
        );

    }


    const filterCategory =
        document.getElementById("filterCategory");


    if (filterCategory) {

        filterCategory.addEventListener(
            "change",
            renderTransactions
        );

    }


    const filterDateFrom =
        document.getElementById("filterDateFrom");


    if (filterDateFrom) {

        filterDateFrom.addEventListener(
            "change",
            renderTransactions
        );

    }


    const filterDateTo =
        document.getElementById("filterDateTo");


    if (filterDateTo) {

        filterDateTo.addEventListener(
            "change",
            renderTransactions
        );

    }


    const periodDate =
        document.getElementById("periodDate");


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
                        .querySelectorAll(".period-btn")
                        .forEach(btn => {

                            btn.classList.remove(
                                "active"
                            );

                        });


                    button.classList.add(
                        "active"
                    );


                    currentPeriod =
                        button.dataset.period;


                    render();

                }
            );

        });

}


/* =========================================================
   ADD TRANSACTION
========================================================= */

function addTransaction(event) {

    event.preventDefault();


    const type =
        document.getElementById(
            "transactionType"
        ).value;


    const amount =
        Number(
            document.getElementById(
                "amount"
            ).value
        );


    const date =
        document.getElementById(
            "transactionDate"
        ).value;


    const category =
        document.getElementById(
            "category"
        ).value;


    const account =
        document.getElementById(
            "account"
        ).value;


    const description =
        document.getElementById(
            "description"
        ).value.trim();


    const notes =
        document.getElementById(
            "notes"
        ).value.trim();


    if (!amount || amount <= 0) {

        showToast(
            "Please enter a valid amount."
        );

        return;

    }


    if (!description) {

        showToast(
            "Please enter a description."
        );

        return;

    }


    const transaction = {

        id: Date.now(),

        type: type,

        amount: amount,

        date: date,

        category: category,

        account: account,

        description: description,

        notes: notes

    };


    transactions.push(transaction);


    saveTransactions();


    render();


    closeTransactionModal();


    document
        .getElementById(
            "transactionForm"
        )
        .reset();


    document
        .getElementById(
            "transactionDate"
        )
        .value = getLocalDate();


    showToast(
        "Transaction added successfully!"
    );

}


/* =========================================================
   DELETE TRANSACTION
========================================================= */

function deleteTransaction(id) {

    const transaction =
        transactions.find(
            t => t.id === id
        );


    if (!transaction) {

        return;

    }


    const confirmed =
        confirm(
            `Delete "${transaction.description}" (${formatMoney(transaction.amount)})?`
        );


    if (!confirmed) {

        return;

    }


    transactions =
        transactions.filter(
            t => t.id !== id
        );


    saveTransactions();


    render();


    showToast(
        "Transaction deleted."
    );

}


/* =========================================================
   SAVE TRANSACTIONS
========================================================= */

function saveTransactions() {

    localStorage.setItem(
        "budgetTransactions",
        JSON.stringify(transactions)
    );

}


/* =========================================================
   SAVE BUDGETS
========================================================= */

function saveBudgetsToStorage() {

    localStorage.setItem(
        "budgetBudgets",
        JSON.stringify(budgets)
    );

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
        periodDate
            ? periodDate.value
            : getLocalDate();


    if (!selectedDate) {

        return transactions;

    }


    const date =
        new Date(
            selectedDate + "T00:00:00"
        );


    return transactions.filter(
        transaction => {

            const transactionDate =
                new Date(
                    transaction.date +
                    "T00:00:00"
                );


            /* DAILY */

            if (
                currentPeriod ===
                "daily"
            ) {

                return (
                    transaction.date ===
                    selectedDate
                );

            }


            /* MONTHLY */

            if (
                currentPeriod ===
                "monthly"
            ) {

                return (

                    transactionDate
                        .getFullYear()
                    ===
                    date.getFullYear()

                    &&

                    transactionDate
                        .getMonth()
                    ===
                    date.getMonth()

                );

            }


            /* YEARLY */

            if (
                currentPeriod ===
                "yearly"
            ) {

                return (

                    transactionDate
                        .getFullYear()
                    ===
                    date.getFullYear()

                );

            }


            return true;

        }
    );

}


/* =========================================================
   RENDER
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
        data

            .filter(
                t =>
                    t.type === "income"
            )

            .reduce(
                (sum, t) =>
                    sum + Number(t.amount),

                0
            );


    const expense =
        data

            .filter(
                t =>
                    t.type === "expense"
            )

            .reduce(
                (sum, t) =>
                    sum + Number(t.amount),

                0
            );


    const savings =
        data

            .filter(
                t =>
                    t.type === "expense"
                    &&
                    t.category === "Savings"
            )

            .reduce(
                (sum, t) =>
                    sum + Number(t.amount),

                0
            );


    const balance =
        income - expense;


    const totalIncome =
        document.getElementById(
            "totalIncome"
        );


    const totalExpense =
        document.getElementById(
            "totalExpense"
        );


    const totalSavings =
        document.getElementById(
            "totalSavings"
        );


    const balanceElement =
        document.getElementById(
            "balance"
        );


    if (totalIncome) {

        totalIncome.textContent =
            formatMoney(income);

    }


    if (totalExpense) {

        totalExpense.textContent =
            formatMoney(expense);

    }


    if (totalSavings) {

        totalSavings.textContent =
            formatMoney(savings);

    }


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


    const categories = [

        "Bill",

        "Essential",

        "Savings",

        "Credit Card",

        "Non-Essential",

        "Extra"

    ];


    const colors = {

        "Bill": "#ef4444",

        "Essential": "#f97316",

        "Savings": "#8b5cf6",

        "Credit Card": "#ec4899",

        "Non-Essential": "#eab308",

        "Extra": "#06b6d4"

    };


    const totals = {};


    categories.forEach(
        category => {

            totals[category] =
                data

                    .filter(
                        t =>
                            t.type ===
                            "expense"
                            &&
                            t.category ===
                            category
                    )

                    .reduce(
                        (sum, t) =>
                            sum +
                            Number(
                                t.amount
                            ),

                        0
                    );

        }
    );


    const totalExpenses =
        Object.values(totals)
            .reduce(
                (a, b) => a + b,
                0
            );


    container.innerHTML =

        categories
            .map(
                category => {

                    const amount =
                        totals[category];


                    const percent =
                        totalExpenses > 0

                            ? (
                                amount /
                                totalExpenses
                            ) * 100

                            : 0;


                    return `

                        <div class="category-row">

                            <div class="category-top">

                                <span>
                                    ${category}
                                </span>

                                <strong>
                                    ${formatMoney(amount)}
                                </strong>

                            </div>

                            <div class="progress">

                                <div
                                    class="progress-bar"
                                    style="
                                        width:${percent}%;
                                        background:${colors[category]};
                                    "
                                ></div>

                            </div>

                        </div>

                    `;

                }
            )
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


    const categories = [

        "Bill",

        "Essential",

        "Savings",

        "Credit Card",

        "Non-Essential",

        "Extra"

    ];


    container.innerHTML =

        categories

            .map(
                category => {

                    const spent =
                        data

                            .filter(
                                t =>
                                    t.type ===
                                    "expense"
                                    &&
                                    t.category ===
                                    category
                            )

                            .reduce(
                                (sum, t) =>
                                    sum +
                                    Number(
                                        t.amount
                                    ),

                                0
                            );


                    const limit =
                        Number(
                            budgets[category]
                        ) || 0;


                    const percentage =
                        limit > 0

                            ? (
                                spent /
                                limit
                            ) * 100

                            : 0;


                    const width =
                        Math.min(
                            percentage,
                            100
                        );


                    let color =
                        "#16a34a";


                    if (
                        percentage >=
                        100
                    ) {

                        color =
                            "#dc2626";

                    } else if (
                        percentage >=
                        80
                    ) {

                        color =
                            "#f59e0b";

                    }


                    return `

                        <div class="budget-item">

                            <div class="budget-name">

                                <strong>
                                    ${category}
                                </strong>

                                <span class="budget-number">

                                    ${
                                        limit > 0

                                            ? `
                                                ${formatMoney(spent)}
                                                /
                                                ${formatMoney(limit)}
                                            `

                                            : `
                                                ${formatMoney(spent)}
                                                / No limit
                                            `
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

                }
            )
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
            data.filter(
                t =>

                    t.description
                        .toLowerCase()
                        .includes(search)

                    ||

                    t.category
                        .toLowerCase()
                        .includes(search)

                    ||

                    t.account
                        .toLowerCase()
                        .includes(search)

                    ||

                    (t.notes || "")
                        .toLowerCase()
                        .includes(search)

            );

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
                    t.category ===
                    category
            );

    }


    /* DATE FROM */

    if (dateFrom) {

        data =
            data.filter(
                t =>
                    t.date >=
                    dateFrom
            );

    }


    /* DATE TO */

    if (dateTo) {

        data =
            data.filter(
                t =>
                    t.date <=
                    dateTo
            );

    }


    /* SORT */

    data.sort(
        (a, b) => {

            let valueA;

            let valueB;


            if (
                sortField ===
                "amount"
            ) {

                valueA =
                    Number(a.amount);

                valueB =
                    Number(b.amount);

            } else {

                valueA =
                    a.date;

                valueB =
                    b.date;

            }


            if (
                valueA <
                valueB
            ) {

                return sortDirection ===
                    "asc"
                    ? -1
                    : 1;

            }


            if (
                valueA >
                valueB
            ) {

                return sortDirection ===
                    "asc"
                    ? 1
                    : -1;

            }


            return 0;

        }
    );


    /* EMPTY */

    if (data.length === 0) {

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

            .map(
                t => `

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
                                            ${escapeHTML(
                                                t.notes
                                            )}
                                        </div>

                                    `

                                    : ""
                            }

                        </td>


                        <td>

                            <span class="badge">

                                ${escapeHTML(
                                    t.category
                                )}

                            </span>

                        </td>


                        <td>

                            ${
                                t.type ===
                                "income"

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
                                    t.type ===
                                    "income"
                                        ? "income-text"
                                        : "expense-text"
                                }"
                            >

                                ${
                                    t.type ===
                                    "income"
                                        ? "+"
                                        : "-"
                                }

                                ${formatMoney(
                                    t.amount
                                )}

                            </span>

                        </td>


                        <td>
                            ${escapeHTML(
                                t.account
                            )}
                        </td>


                        <td>

                            <button
                                class="delete-btn"
                                onclick="deleteTransaction(${t.id})"
                            >
                                Delete
                            </button>

                        </td>

                    </tr>

                `
            )

            .join("");

}


/* =========================================================
   SORT TRANSACTIONS
========================================================= */

function sortTransactions(field) {

    if (
        sortField ===
        field
    ) {

        sortDirection =
            sortDirection ===
            "asc"

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


    const ctx =
        canvas.getContext(
            "2d"
        );


    const data =
        getPeriodTransactions();


    const income =
        data

            .filter(
                t =>
                    t.type ===
                    "income"
            )

            .reduce(
                (sum, t) =>
                    sum +
                    Number(t.amount),

                0
            );


    const expense =
        data

            .filter(
                t =>
                    t.type ===
                    "expense"
            )

            .reduce(
                (sum, t) =>
                    sum +
                    Number(t.amount),

                0
            );


    if (incomeExpenseChart) {

        incomeExpenseChart.destroy();

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

                            label:
                                "Amount",

                            data: [

                                income,

                                expense

                            ],


                            backgroundColor: [

                                "#16a34a",

                                "#dc2626"

                            ],


                            borderRadius: 8

                        }

                    ]

                },


                options: {

                    responsive: true,

                    maintainAspectRatio:
                        false,


                    plugins: {

                        legend: {

                            display:
                                false

                        }

                    },


                    scales: {

                        y: {

                            beginAtZero:
                                true,


                            ticks: {

                                callback:
                                    function (
                                        value
                                    ) {

                                        return (
                                            "₱" +
                                            Number(
                                                value
                                            )
                                                .toLocaleString()
                                        );

                                    }

                            }

                        }

                    }

                }

            }
        );

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


    if (dateInput) {

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
                        value || "";

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

function saveBudgets(event) {

    event.preventDefault();


    budgets = {

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


    saveBudgetsToStorage();


    renderBudgets();


    closeBudgetModal();


    showToast(
        "Budgets saved successfully!"
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
                    t.type ===
                    "income"
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
        !window.jspdf
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
        data

            .filter(
                t =>
                    t.type ===
                    "income"
            )

            .reduce(
                (sum, t) =>
                    sum +
                    Number(
                        t.amount
                    ),

                0
            );


    const expense =
        data

            .filter(
                t =>
                    t.type ===
                    "expense"
            )

            .reduce(
                (sum, t) =>
                    sum +
                    Number(
                        t.amount
                    ),

                0
            );


    const balance =
        income - expense;


    doc.setFontSize(
        20
    );


    doc.text(
        "Budget Tracker Report",

        14,

        20
    );


    doc.setFontSize(
        11
    );


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

                t.category,

                t.type ===
                    "income"
                    ? "Income"
                    : "Expense",

                `PHP ${Number(
                    t.amount
                ).toLocaleString(
                    "en-PH",
                    {
                        minimumFractionDigits:
                            2
                    }
                )}`,

                t.account

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
   HELPER: NUMBER
========================================================= */

function getNumberValue(id) {

    const element =
        document.getElementById(
            id
        );


    if (!element) {

        return 0;

    }


    return (
        Number(
            element.value
        ) || 0
    );

}


/* =========================================================
   HELPER: MONEY
========================================================= */

function formatMoney(amount) {

    return Number(
        amount || 0
    ).toLocaleString(
        "en-PH",
        {

            style: "currency",

            currency: "PHP",

            minimumFractionDigits:
                2

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
            dateString +
            "T00:00:00"
        );


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
   HELPER: TOAST
========================================================= */

function showToast(message) {

    const toast =
        document.getElementById(
            "toast"
        );


    if (!toast) {

        return;

    }


    toast.textContent =
        message;


    toast.classList.add(
        "show"
    );


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
   CLOSE MODALS
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
            event.target ===
            transactionModal
        ) {

            closeTransactionModal();

        }


        if (
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
   SMALL NAVIGATION HELPER
========================================================= */


function scrollToSection(id) {

    const section =
        document.getElementById(id);

    if (section) {

        section.scrollIntoView({
            behavior: "smooth"
        });

    }

}