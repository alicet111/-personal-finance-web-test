"use strict";

const FORMAL_STORAGE_KEY = "personal-finance-transactions";
const TEST_STORAGE_KEY = "personal-finance-transactions-test";
const isTestMode = new URLSearchParams(window.location.search).get("test") === "1";
const STORAGE_KEY = isTestMode ? TEST_STORAGE_KEY : FORMAL_STORAGE_KEY;

let storageReadError = false;
let storageErrorMessage = "";
let storageKeyExists = false;
let transactions = loadTransactions();

const transactionForm = document.querySelector("#transaction-form");
const transactionList = document.querySelector("#transaction-list");
const totalIncomeElement = document.querySelector("#total-income");
const totalExpenseElement = document.querySelector("#total-expense");
const currentBalanceElement = document.querySelector("#current-balance");
const totalSurplusElement = document.querySelector("#total-surplus");
const transactionCountElement = document.querySelector("#transaction-count");
const savingsRateElement = document.querySelector("#savings-rate");
const recordCountElement = document.querySelector("#record-count");
const amountInput = document.querySelector("#amount");
const categoryInput = document.querySelector("#category");
const categoryShortcuts = document.querySelector("#category-shortcuts");
const transactionDateInput = document.querySelector("#transaction-date");
const noteInput = document.querySelector("#note");
const amountError = document.querySelector("#amount-error");
const categoryError = document.querySelector("#category-error");
const transactionDateError = document.querySelector("#transaction-date-error");
const formMessage = document.querySelector("#form-message");
const submitButton = document.querySelector("#submit-button");
const cancelEditButton = document.querySelector("#cancel-edit-button");
const editingStatus = document.querySelector("#editing-status");
const environmentLabel = document.querySelector("#environment-label");
const storageStatus = document.querySelector("#storage-status");
const exportButton = document.querySelector("#export-button");
const importButton = document.querySelector("#import-button");
const backupFileInput = document.querySelector("#backup-file-input");
const dataMessage = document.querySelector("#data-message");
const importPreview = document.querySelector("#import-preview");
const previewDetails = document.querySelector("#preview-details");
const cancelImportButton = document.querySelector("#cancel-import-button");
const confirmImportButton = document.querySelector("#confirm-import-button");
const trendChart = document.querySelector("#trend-chart");
const rangeControls = document.querySelector("#range-controls");
const monthlySummaryElement = document.querySelector("#monthly-summary");
const categoryExpensesElement = document.querySelector("#category-expenses");
const financialInsightsElement = document.querySelector("#financial-insights");
const quickAddButton = document.querySelector("#quick-add-button");
const entryPanel = document.querySelector("#entry-panel");

let editingTransactionId = null;
let isSubmitting = false;
let pendingImport = null;
let selectedTrendRange = "30d";

transactionForm.addEventListener("submit", handleFormSubmit);
transactionList.addEventListener("click", handleTransactionListClick);
cancelEditButton.addEventListener("click", cancelEditing);
exportButton.addEventListener("click", exportTransactions);
importButton.addEventListener("click", () => backupFileInput.click());
backupFileInput.addEventListener("change", handleBackupFileSelection);
cancelImportButton.addEventListener("click", hideImportPreview);
confirmImportButton.addEventListener("click", restoreTransactions);
rangeControls.addEventListener("click", handleRangeChange);
quickAddButton.addEventListener("click", focusEntryForm);
categoryShortcuts.addEventListener("click", handleCategoryShortcutClick);
categoryInput.addEventListener("change", syncCategoryShortcuts);

renderPage();
updateFormMode();
updateEnvironmentStatus();
syncCategoryShortcuts();
transactionDateInput.value = getLocalDateValue();

if (storageReadError) {
  showFormMessage(storageErrorMessage, true);
}

function focusEntryForm() {
  entryPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  amountInput.focus({ preventScroll: true });
}

function handleCategoryShortcutClick(event) {
  const shortcut = event.target.closest("[data-category]");

  if (!shortcut) {
    return;
  }

  categoryInput.value = shortcut.dataset.category;
  syncCategoryShortcuts();
}

function syncCategoryShortcuts() {
  categoryShortcuts.querySelectorAll("[data-category]").forEach((shortcut) => {
    shortcut.classList.toggle("active", shortcut.dataset.category === categoryInput.value);
  });
}

function getLocalDateValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isValidDateValue(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function handleFormSubmit(event) {
  event.preventDefault();

  if (isSubmitting) {
    return;
  }

  isSubmitting = true;
  submitButton.disabled = true;
  clearValidationMessages();

  try {
    if (storageReadError) {
      showFormMessage(storageErrorMessage, true);
      return;
    }

    const formData = new FormData(transactionForm);
    const type = formData.get("type");
    const amountInCents = parseAmountToCents(formData.get("amount"));
    const category = String(formData.get("category") || "").trim();
    const note = String(formData.get("note") || "").trim();
    const transactionDate = String(formData.get("transactionDate") || "").trim();
    const editingTransaction = editingTransactionId === null
      ? null
      : transactions.find((transaction) => transaction.id === editingTransactionId);
    const mayKeepMissingLegacyDate = Boolean(editingTransaction && !getTransactionDateValue(editingTransaction) && !transactionDate);

    let isValid = true;

    if (type !== "income" && type !== "expense") {
      isValid = false;
    }

    if (amountInCents === null) {
      amountError.textContent = "请输入大于 0 且最多两位小数的金额。";
      isValid = false;
    }

    if (!category) {
      categoryError.textContent = "请选择一个分类。";
      isValid = false;
    }

    if (!isValidDateValue(transactionDate) && !mayKeepMissingLegacyDate) {
      transactionDateError.textContent = "请选择有效的交易日期。";
      isValid = false;
    }

    if (!isValid) {
      showFormMessage("请检查输入内容。", true);
      return;
    }

    const wasEditing = editingTransactionId !== null;
    const previousTransactions = transactions;

    if (!wasEditing) {
      transactions = [
        ...transactions,
        {
          id: createTransactionId(),
          type,
          amountInCents,
          category,
          note,
          createdAt: new Date().toISOString(),
          transactionDate
        }
      ];
    } else {
      const transactionExists = transactions.some(
        (transaction) => transaction.id === editingTransactionId
      );

      if (!transactionExists) {
        cancelEditing();
        showFormMessage("找不到要编辑的交易。", true);
        return;
      }

      transactions = transactions.map((transaction) => {
        if (transaction.id !== editingTransactionId) {
          return transaction;
        }

        const updatedTransaction = {
          ...transaction,
          type,
          amountInCents,
          category,
          note
        };

        if (isValidDateValue(transactionDate)) {
          updatedTransaction.transactionDate = transactionDate;
        }

        return updatedTransaction;
      });
    }

    if (!saveTransactions()) {
      transactions = previousTransactions;
      renderPage();
      return;
    }

    renderPage();
    const successMessage = wasEditing ? "修改已保存。" : "记录已添加。";
    cancelEditing();
    showFormMessage(successMessage, false);
    amountInput.focus();
  } finally {
    isSubmitting = false;
    submitButton.disabled = false;
  }
}

function handleTransactionListClick(event) {
  const editButton = event.target.closest("[data-edit-id]");

  if (editButton) {
    startEditing(editButton.dataset.editId);
    return;
  }

  const deleteButton = event.target.closest("[data-delete-id]");

  if (!deleteButton) {
    return;
  }

  const transactionId = deleteButton.dataset.deleteId;
  const transaction = transactions.find((item) => item.id === transactionId);

  if (!transaction) {
    return;
  }

  const transactionLabel = `${transaction.category} ${formatCurrency(transaction.amountInCents)}`;
  const shouldDelete = window.confirm(`确定要删除这笔记录吗？\n${transactionLabel}`);

  if (!shouldDelete) {
    return;
  }

  const previousTransactions = transactions;
  transactions = transactions.filter((item) => item.id !== transactionId);

  if (!saveTransactions()) {
    transactions = previousTransactions;
    renderPage();
    return;
  }

  if (editingTransactionId === transactionId) {
    cancelEditing();
  }
  renderPage();
}

function startEditing(transactionId) {
  const transaction = transactions.find((item) => item.id === transactionId);

  if (!transaction) {
    return;
  }

  editingTransactionId = transaction.id;
  transactionForm.elements.type.value = transaction.type;
  amountInput.value = (transaction.amountInCents / 100).toFixed(2);
  categoryInput.value = transaction.category;
  transactionDateInput.value = getTransactionDateValue(transaction) || "";
  noteInput.value = transaction.note;
  clearValidationMessages();
  updateFormMode();
  syncCategoryShortcuts();
  amountInput.focus();
}

function cancelEditing() {
  editingTransactionId = null;
  transactionForm.reset();
  clearValidationMessages();
  updateFormMode();
  transactionDateInput.value = getLocalDateValue();
  syncCategoryShortcuts();
}

function updateFormMode() {
  const isEditing = editingTransactionId !== null;

  submitButton.textContent = isEditing ? "保存修改" : "添加记录";
  cancelEditButton.hidden = !isEditing;
  editingStatus.hidden = !isEditing;
}

function renderPage() {
  renderSummary();
  renderAnalytics();
  renderTransactions();
  updateEnvironmentStatus();
}

function updateEnvironmentStatus() {
  environmentLabel.textContent = isTestMode ? "测试环境" : "正式数据环境";

  if (storageReadError) {
    storageStatus.textContent = isTestMode
      ? "测试数据状态：读取异常"
      : "正式数据状态：读取异常";
    return;
  }

  const statusLabel = isTestMode ? "测试数据状态" : "正式数据状态";

  if (!storageKeyExists) {
    storageStatus.textContent = `${statusLabel}：未初始化`;
    return;
  }

  if (transactions.length === 0) {
    storageStatus.textContent = `${statusLabel}：已初始化，当前交易：0 笔`;
    return;
  }

  storageStatus.textContent = `${statusLabel}：正常，当前交易：${transactions.length} 笔`;
}

function renderSummary() {
  const income = calculateTotalIncome(transactions);
  const expense = calculateTotalExpense(transactions);
  const balance = calculateBalance(transactions);
  const savingsRate = calculateSavingsRate(transactions);

  totalIncomeElement.textContent = formatCurrency(income);
  totalExpenseElement.textContent = formatCurrency(expense);
  currentBalanceElement.textContent = formatCurrency(balance);
  totalSurplusElement.textContent = formatCurrency(balance);
  transactionCountElement.textContent = `${calculateTransactionCount(transactions)} 笔`;
  savingsRateElement.textContent = savingsRate === null ? "暂无收入数据" : formatPercentage(savingsRate, false);
  currentBalanceElement.parentElement.classList.toggle("negative-balance", balance < 0);
}

function handleRangeChange(event) {
  const rangeButton = event.target.closest("[data-range]");

  if (!rangeButton) {
    return;
  }

  selectedTrendRange = rangeButton.dataset.range;
  rangeControls.querySelectorAll("[data-range]").forEach((button) => {
    button.classList.toggle("active", button === rangeButton);
  });
  renderAnalytics();
}

function renderAnalytics() {
  try {
    renderTrendChart(calculateTrendData(transactions, selectedTrendRange));
    renderMonthlySummary(calculateMonthlySummary(transactions));
    renderCategoryExpenses(calculateCategoryExpenses(transactions));
    renderFinancialInsights(calculateAnomalies(transactions));
  } catch (error) {
    const message = "统计暂时无法计算，请稍后重试。";
    trendChart.innerHTML = `<p class="trend-empty">${message}</p>`;
    monthlySummaryElement.innerHTML = `<p class="trend-empty">${message}</p>`;
    categoryExpensesElement.innerHTML = `<p class="category-empty">${message}</p>`;
    financialInsightsElement.innerHTML = `<p class="insight-empty">${message}</p>`;
  }
}

function renderTransactions() {
  const sortedTransactions = [...transactions].sort(
    (first, second) => new Date(second.createdAt) - new Date(first.createdAt)
  );

  recordCountElement.textContent = `${sortedTransactions.length} 笔`;

  if (sortedTransactions.length === 0) {
    transactionList.innerHTML = '<p class="empty-state">暂无交易记录</p>';
    return;
  }

  transactionList.innerHTML = sortedTransactions.map(createTransactionMarkup).join("");
}

function createTransactionMarkup(transaction) {
  const isIncome = transaction.type === "income";
  const typeClass = isIncome ? "income" : "expense";
  const sign = isIncome ? "+" : "-";
  const note = transaction.note || "无备注";
  const dateLabel = formatExpenseDate(getTransactionDateValue(transaction));

  return `
    <article class="transaction-item ${typeClass}">
      <div class="transaction-main">
        <p class="transaction-category">${escapeHtml(transaction.category)}</p>
        <p class="transaction-note">${escapeHtml(note)}</p>
      </div>
      <p class="transaction-amount ${typeClass}">${sign} ${formatCurrency(transaction.amountInCents)}</p>
      <p class="transaction-date">${escapeHtml(dateLabel)}</p>
      <div class="transaction-actions">
        <button class="edit-button" type="button" data-edit-id="${escapeHtml(transaction.id)}">编辑</button>
        <button class="delete-button" type="button" data-delete-id="${escapeHtml(transaction.id)}">删除</button>
      </div>
    </article>
  `;
}

function calculateTotalIncome(transactionList) {
  return transactionList.reduce(
    (total, transaction) => transaction.type === "income" ? total + transaction.amountInCents : total,
    0
  );
}

function calculateTotalExpense(transactionList) {
  return transactionList.reduce(
    (total, transaction) => transaction.type === "expense" ? total + transaction.amountInCents : total,
    0
  );
}

function calculateBalance(transactionList) {
  return calculateTotalIncome(transactionList) - calculateTotalExpense(transactionList);
}

function calculateTransactionCount(transactionList) {
  return transactionList.length;
}

function calculateSavingsRate(transactionList) {
  const income = calculateTotalIncome(transactionList);

  if (income === 0) {
    return null;
  }

  return ((income - calculateTotalExpense(transactionList)) / income) * 100;
}

function parseTransactionDate(transaction) {
  const value = getTransactionDateValue(transaction);

  if (!isValidDateValue(value)) {
    return null;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(0);
  date.setFullYear(year, month - 1, day);
  date.setHours(12, 0, 0, 0);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? date
    : null;
}

function getTransactionDateValue(transaction) {
  if (!transaction) {
    return "";
  }

  if (isValidDateValue(transaction.transactionDate)) {
    return transaction.transactionDate;
  }

  return isValidDateValue(transaction.expenseDate) ? transaction.expenseDate : "";
}

function getTransactionAnalysisDate(transaction) {
  return parseTransactionDate(transaction);
}

function formatExpenseDate(value) {
  if (!isValidDateValue(value)) {
    return "日期待补充";
  }

  return parseTransactionDate({ transactionDate: value }).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
}

function getDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getMonthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function startOfLocalDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function addMonths(date, months) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function filterTransactionsByRange(transactionList, range) {
  const today = startOfLocalDay(new Date());
  const start = range === "12m"
    ? addMonths(new Date(today.getFullYear(), today.getMonth(), 1), -11)
    : addDays(today, range === "90d" ? -89 : -29);
  const end = addDays(today, 1);

  return transactionList.filter((transaction) => {
    const date = getTransactionAnalysisDate(transaction);
    return date && date >= start && date < end;
  });
}

function calculateTrendData(transactionList, range) {
  const today = startOfLocalDay(new Date());
  const points = [];
  const bucketCount = range === "12m" ? 12 : range === "90d" ? 90 : 30;
  const start = range === "12m"
    ? addMonths(new Date(today.getFullYear(), today.getMonth(), 1), -11)
    : addDays(today, -(bucketCount - 1));
  const buckets = new Map();

  for (let index = 0; index < bucketCount; index += 1) {
    const date = range === "12m" ? addMonths(start, index) : addDays(start, index);
    const key = range === "12m" ? getMonthKey(date) : getDateKey(date);
    buckets.set(key, { label: key, incomeInCents: 0, expenseInCents: 0 });
  }

  for (const transaction of filterTransactionsByRange(transactionList, range)) {
    const date = getTransactionAnalysisDate(transaction);
    const key = range === "12m" ? getMonthKey(date) : getDateKey(date);
    const bucket = buckets.get(key);

    if (!bucket) {
      continue;
    }

    if (transaction.type === "income") {
      bucket.incomeInCents += transaction.amountInCents;
    } else if (transaction.type === "expense") {
      bucket.expenseInCents += transaction.amountInCents;
    }
  }

  points.push(...buckets.values());
  return {
    range,
    points,
    hasTransactions: filterTransactionsByRange(transactionList, range).length > 0
  };
}

function calculateMonthlySummary(transactionList) {
  const now = new Date();
  const currentMonth = getMonthKey(now);
  const previousMonth = getMonthKey(addMonths(new Date(now.getFullYear(), now.getMonth(), 1), -1));
  const totals = new Map();

  let unassignedTransactionCount = 0;
  let unassignedIncomeInCents = 0;
  let unassignedExpenseInCents = 0;

  for (const transaction of transactionList) {
    const date = getTransactionAnalysisDate(transaction);

    if (!date) {
      unassignedTransactionCount += 1;
      if (transaction.type === "expense") {
        unassignedExpenseInCents += transaction.amountInCents;
      } else {
        unassignedIncomeInCents += transaction.amountInCents;
      }
      continue;
    }

    const month = getMonthKey(date);
    const summary = totals.get(month) || { month, incomeInCents: 0, expenseInCents: 0 };

    if (transaction.type === "income") {
      summary.incomeInCents += transaction.amountInCents;
    } else if (transaction.type === "expense") {
      summary.expenseInCents += transaction.amountInCents;
    }

    totals.set(month, summary);
  }

  const createResult = (month) => {
    const summary = totals.get(month);
    return summary
      ? { ...summary, balanceInCents: summary.incomeInCents - summary.expenseInCents, hasData: true }
      : { month, incomeInCents: 0, expenseInCents: 0, balanceInCents: 0, hasData: false };
  };

  return {
    current: createResult(currentMonth),
    previous: createResult(previousMonth),
    unassignedTransactionCount,
    unassignedIncomeInCents,
    unassignedExpenseInCents,
    history: [...totals.values()].map((summary) => ({
      ...summary,
      balanceInCents: summary.incomeInCents - summary.expenseInCents
    }))
  };
}

function calculateMoM(currentValue, previousValue) {
  if (previousValue === 0 && currentValue === 0) {
    return { type: "text", value: "持平" };
  }

  if (previousValue === 0) {
    return { type: "text", value: "上月无数据" };
  }

  if (currentValue === 0 && previousValue > 0) {
    return { type: "text", value: "下降 100%" };
  }

  return { type: "percentage", value: ((currentValue - previousValue) / previousValue) * 100 };
}

function calculateCategoryExpenses(transactionList) {
  const totals = new Map();
  const totalExpense = calculateTotalExpense(transactionList);

  for (const transaction of transactionList) {
    if (transaction.type !== "expense") {
      continue;
    }

    const category = typeof transaction.category === "string" && transaction.category.trim()
      ? transaction.category.trim()
      : "未分类";
    totals.set(category, (totals.get(category) || 0) + transaction.amountInCents);
  }

  if (totalExpense === 0) {
    return [];
  }

  return [...totals.entries()]
    .map(([category, amountInCents]) => ({
      category,
      amountInCents,
      ratio: (amountInCents / totalExpense) * 100
    }))
    .sort((first, second) => second.amountInCents - first.amountInCents);
}

function calculateAnomalies(transactionList) {
  if (transactionList.length < 5) {
    return ["当前数据不足，暂不进行异常判断。"];
  }

  const expenses = transactionList
    .filter((transaction) => transaction.type === "expense")
    .map((transaction) => transaction.amountInCents)
    .sort((first, second) => first - second);

  if (expenses.length === 0) {
    return ["当前数据不足，暂不进行异常判断。"];
  }

  const median = expenses[Math.floor(expenses.length / 2)];
  const messages = [];

  if (median > 0 && expenses.some((amount) => amount > median * 2)) {
    messages.push("发现一笔明显高于历史平均水平的支出。");
  }

  const categoryCounts = new Map();
  const categoryTotals = new Map();

  transactionList.filter((transaction) => transaction.type === "expense").forEach((transaction) => {
    const category = transaction.category && transaction.category.trim() ? transaction.category.trim() : "未分类";
    categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1);
    categoryTotals.set(category, (categoryTotals.get(category) || 0) + transaction.amountInCents);
  });

  const totalExpense = calculateTotalExpense(transactionList);
  if ([...categoryCounts.entries()].some(([category, count]) => count >= 3 && categoryTotals.get(category) > totalExpense * 0.5)) {
    messages.push("某分类支出近期明显增加。");
  }

  const monthlyExpenses = calculateMonthlySummary(transactionList).history
    .filter((summary) => summary.expenseInCents > 0)
    .map((summary) => summary.expenseInCents);

  if (monthlyExpenses.length >= 3) {
    const currentMonthExpense = calculateMonthlySummary(transactionList).current.expenseInCents;
    const previousAverage = monthlyExpenses.reduce((sum, value) => sum + value, 0) / monthlyExpenses.length;

    if (currentMonthExpense > previousAverage * 1.5) {
      messages.push("本月支出明显高于此前月份。");
    }
  }

  return messages.length ? messages : ["暂未发现明显异常支出。"];
}

function renderTrendChart(trendData) {
  if (!trendData.hasTransactions) {
    trendChart.innerHTML = '<p class="trend-empty">当前时间范围暂无交易数据。</p>';
    return;
  }

  const width = 720;
  const height = 220;
  const padding = { top: 18, right: 18, bottom: 32, left: 54 };
  const maxValue = Math.max(...trendData.points.flatMap((point) => [point.incomeInCents, point.expenseInCents]), 1);
  const x = (index) => padding.left + (index / Math.max(trendData.points.length - 1, 1)) * (width - padding.left - padding.right);
  const y = (value) => height - padding.bottom - (value / maxValue) * (height - padding.top - padding.bottom);
  const createPath = (field) => trendData.points.map((point, index) => `${index === 0 ? "M" : "L"}${x(index).toFixed(1)},${y(point[field]).toFixed(1)}`).join(" ");
  const labelStep = Math.max(1, Math.ceil(trendData.points.length / 6));
  const labels = trendData.points.map((point, index) => index % labelStep === 0 || index === trendData.points.length - 1
    ? `<text x="${x(index)}" y="${height - 8}" text-anchor="middle">${escapeHtml(point.label.slice(5))}</text>`
    : "").join("");

  trendChart.innerHTML = `
    <svg class="trend-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="收入与支出趋势">
      <line x1="${padding.left}" y1="${height - padding.bottom}" x2="${width - padding.right}" y2="${height - padding.bottom}" stroke="#dce6e1" />
      <path d="${createPath("incomeInCents")}" fill="none" stroke="#18794e" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
      <path d="${createPath("expenseInCents")}" fill="none" stroke="#bf4d45" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
      <g fill="#6d7b79" font-size="11">${labels}</g>
      <g font-size="11"><text x="${padding.left}" y="14" fill="#18794e">收入</text><text x="${padding.left + 42}" y="14" fill="#bf4d45">支出</text></g>
    </svg>
  `;
}

function formatMoM(change) {
  return change.type === "text" ? change.value : formatPercentage(change.value);
}

function formatPercentage(value, includePlus = true) {
  if (!Number.isFinite(value)) {
    return "暂无数据";
  }

  return `${includePlus && value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function renderMonthlySummary(summary) {
  const current = summary.current;
  const previous = summary.previous;
  const currentRows = current.hasData
    ? `<div class="monthly-values"><span>收入 <strong>${formatCurrency(current.incomeInCents)}</strong></span><span>支出 <strong>${formatCurrency(current.expenseInCents)}</strong></span><span>结余 <strong>${formatCurrency(current.balanceInCents)}</strong></span></div>`
    : '<p class="trend-empty">当前月份暂无数据。</p>';
  const previousRows = previous.hasData
    ? `<div class="monthly-values"><span>收入 <strong>${formatCurrency(previous.incomeInCents)}</strong></span><span>支出 <strong>${formatCurrency(previous.expenseInCents)}</strong></span><span>结余 <strong>${formatCurrency(previous.balanceInCents)}</strong></span></div>`
    : '<p class="trend-empty">上月暂无数据。</p>';
  const changes = current.hasData && previous.hasData
    ? `<div class="monthly-changes"><span>收入环比 <strong>${formatMoM(calculateMoM(current.incomeInCents, previous.incomeInCents))}</strong></span><span>支出环比 <strong>${formatMoM(calculateMoM(current.expenseInCents, previous.expenseInCents))}</strong></span><span>结余环比 <strong>${formatMoM(calculateMoM(current.balanceInCents, previous.balanceInCents))}</strong></span></div>`
    : '<div class="monthly-changes"><span>环比 <strong>暂无上月数据</strong></span></div>';
  const unassignedNotice = summary.unassignedTransactionCount > 0
    ? `<p class="warning-message">${summary.unassignedTransactionCount} 笔记录日期待补充；未归属收入 ${formatCurrency(summary.unassignedIncomeInCents)}，未归属支出 ${formatCurrency(summary.unassignedExpenseInCents)}。这些记录仍计入全账本总额，但未归入月份统计。</p>`
    : "";

  monthlySummaryElement.innerHTML = `<div class="monthly-block"><h3>${current.month}（当前月份）</h3>${currentRows}</div><div class="monthly-block"><h3>${previous.month}（上月）</h3>${previousRows}</div><div class="monthly-block"><h3>环比</h3>${changes}</div>${unassignedNotice}`;
}

function renderCategoryExpenses(categories) {
  if (categories.length === 0) {
    categoryExpensesElement.innerHTML = '<p class="category-empty">暂无支出数据</p>';
    return;
  }

  categoryExpensesElement.innerHTML = categories.map((item) => `
    <div class="category-row">
      <div class="category-row-header"><span>${escapeHtml(item.category)}</span><span>${formatCurrency(item.amountInCents)} · ${item.ratio.toFixed(1)}%</span></div>
      <div class="category-bar"><span style="width: ${Math.min(item.ratio, 100)}%"></span></div>
    </div>
  `).join("");
}

function renderFinancialInsights(insights) {
  financialInsightsElement.innerHTML = insights.map((message) => `<p class="insight-item">${escapeHtml(message)}</p>`).join("");
}

function parseAmountToCents(value) {
  const amountText = String(value || "").trim();

  if (!/^\d+(?:\.\d{1,2})?$/.test(amountText)) {
    return null;
  }

  const [yuanPart, centPart = ""] = amountText.split(".");
  const centsText = `${centPart}00`.slice(0, 2);
  const yuan = Number(yuanPart);
  const cents = Number(centsText);
  const amountInCents = yuan * 100 + cents;

  if (!Number.isSafeInteger(amountInCents) || amountInCents <= 0) {
    return null;
  }

  return amountInCents;
}

function formatCurrency(amountInCents) {
  return `¥${(amountInCents / 100).toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

function formatDate(dateText) {
  const date = new Date(dateText);

  if (Number.isNaN(date.getTime())) {
    return "时间未知";
  }

  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
}

function loadTransactions() {
  try {
    const savedData = window.localStorage.getItem(STORAGE_KEY);
    if (savedData === null) {
      return [];
    }

    storageKeyExists = true;

    const parsedData = JSON.parse(savedData);

    if (!Array.isArray(parsedData) || !parsedData.every(isValidStoredTransaction)) {
      storageReadError = true;
      storageErrorMessage = "数据格式异常，已停止写入，请先备份或修复本地数据。";
      return [];
    }

    return parsedData;
  } catch (error) {
    storageReadError = true;
    storageErrorMessage = "数据读取失败，已停止写入，请检查本地数据。";
    return [];
  }
}

function saveTransactions() {
  if (storageReadError) {
    showFormMessage(storageErrorMessage, true);
    return false;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
    return true;
  } catch (error) {
    showFormMessage("数据保存失败，请检查浏览器存储权限。", true);
    return false;
  }
}

function isValidStoredTransaction(transaction) {
  return Boolean(
    transaction &&
    typeof transaction.id === "string" &&
    (transaction.type === "income" || transaction.type === "expense") &&
    Number.isSafeInteger(transaction.amountInCents) &&
    transaction.amountInCents > 0 &&
    typeof transaction.category === "string" &&
    typeof transaction.note === "string" &&
    typeof transaction.createdAt === "string" &&
    !Number.isNaN(new Date(transaction.createdAt).getTime()) &&
    (transaction.transactionDate === undefined || transaction.transactionDate === "" || isValidDateValue(transaction.transactionDate)) &&
    (transaction.expenseDate === undefined || transaction.expenseDate === "" || isValidDateValue(transaction.expenseDate))
  );
}

function createTransactionId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }

  return `transaction-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function clearValidationMessages() {
  amountError.textContent = "";
  categoryError.textContent = "";
  transactionDateError.textContent = "";
  formMessage.textContent = "";
  formMessage.classList.remove("error");
}

function showFormMessage(message, isError) {
  formMessage.textContent = message;
  formMessage.classList.toggle("error", isError);
}

function setDataMessage(message, isError) {
  dataMessage.textContent = message;
  dataMessage.classList.toggle("error", isError);
}

function exportTransactions() {
  const snapshot = readStoredTransactions();

  if (!snapshot.ok) {
    setDataMessage("当前数据读取异常，暂无法安全导出，请先检查数据。", true);
    return;
  }

  const backup = {
    backupVersion: "1.0",
    appVersion: "1.3",
    backupCreatedAt: new Date().toISOString(),
    storageKey: STORAGE_KEY,
    transactions: snapshot.transactions
  };

  const fileName = `personal-finance-backup-${formatFileTimestamp(new Date())}.json`;
  const downloadCreated = downloadJsonFile(backup, fileName);

  setDataMessage(
    downloadCreated ? `备份已导出：${fileName}` : "备份导出失败，请重试。",
    !downloadCreated
  );
}

async function handleBackupFileSelection(event) {
  const file = event.target.files[0];

  if (!file) {
    return;
  }

  hideImportPreview();

  try {
    const text = await file.text();
    const parsedData = JSON.parse(text);
    const validation = validateBackupData(parsedData);

    if (!validation.ok) {
      setDataMessage(validation.message, true);
      return;
    }

    pendingImport = {
      fileName: file.name,
      backup: parsedData,
      transactions: validation.transactions,
      summary: calculateSummary(validation.transactions)
    };
    showImportPreview();
  } catch (error) {
    setDataMessage("备份文件不是有效的 JSON 文件。", true);
  } finally {
    backupFileInput.value = "";
  }
}

function validateBackupData(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { ok: false, message: "备份文件格式错误。" };
  }

  if (data.backupVersion !== undefined && data.backupVersion !== "1.0") {
    return { ok: false, message: "备份文件不是当前环境生成的有效备份。" };
  }

  if (data.storageKey !== undefined && data.storageKey !== STORAGE_KEY) {
    return { ok: false, message: "备份文件不是当前环境生成的有效备份。" };
  }

  if (!Array.isArray(data.transactions)) {
    return { ok: false, message: "备份文件缺少有效的 transactions 数组。" };
  }

  const ids = new Set();

  for (const transaction of data.transactions) {
    if (!isValidStoredTransaction(transaction)) {
      return { ok: false, message: "备份文件中包含无效交易数据。" };
    }

    if (ids.has(transaction.id)) {
      return { ok: false, message: "备份文件中存在重复交易 ID。" };
    }

    ids.add(transaction.id);
  }

  return { ok: true, transactions: data.transactions };
}

function calculateSummary(transactionList) {
  return transactionList.reduce(
    (summary, transaction) => {
      if (transaction.type === "income") {
        summary.income += transaction.amountInCents;
      } else {
        summary.expense += transaction.amountInCents;
      }
      return summary;
    },
    { income: 0, expense: 0 }
  );
}

function showImportPreview() {
  const { backup, transactions: importedTransactions, summary } = pendingImport;
  const currentSnapshot = readStoredTransactions();

  if (!currentSnapshot.ok) {
    setDataMessage("当前数据读取异常，暂无法恢复，请先检查数据。", true);
    pendingImport = null;
    return;
  }

  previewDetails.innerHTML = [
    ["备份文件", pendingImport.fileName],
    ["备份版本", backup.backupVersion],
    ["备份时间", formatDate(backup.backupCreatedAt)],
    ["备份记录", `${importedTransactions.length} 条`],
    ["备份收入", formatCurrency(summary.income)],
    ["备份支出", formatCurrency(summary.expense)],
    ["备份余额", formatCurrency(summary.income - summary.expense)],
    ["当前数据", `${currentSnapshot.transactions.length} 条`],
    ["导入后数据", `${importedTransactions.length} 条`]
  ].map(([label, value]) => `<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd>`).join("");

  importPreview.hidden = false;
  setDataMessage("备份文件校验通过，请确认是否恢复。", false);
}

function hideImportPreview() {
  pendingImport = null;
  importPreview.hidden = true;
  previewDetails.replaceChildren();
}

function createSafetyBackup(transactionsToBackup) {
  const backup = {
    backupVersion: "1.0",
    appVersion: "1.3",
    backupCreatedAt: new Date().toISOString(),
    storageKey: STORAGE_KEY,
    transactions: transactionsToBackup
  };

  return downloadJsonFile(
    backup,
    `personal-finance-safety-backup-${formatFileTimestamp(new Date())}.json`
  );
}

function restoreTransactions() {
  if (!pendingImport || storageReadError) {
    setDataMessage("当前没有可恢复的有效备份。", true);
    return;
  }

  confirmImportButton.disabled = true;
  const originalSnapshot = readStoredTransactions();

  if (!originalSnapshot.ok) {
    setDataMessage("当前数据读取异常，已取消恢复。", true);
    confirmImportButton.disabled = false;
    return;
  }

  if (!createSafetyBackup(originalSnapshot.transactions)) {
    setDataMessage("恢复前安全备份创建失败，已取消恢复，当前数据未改变。", true);
    confirmImportButton.disabled = false;
    return;
  }

  const importedTransactions = pendingImport.transactions;
  let restoreWriteAttempted = false;

  try {
    restoreWriteAttempted = true;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(importedTransactions));
    const verification = readStoredTransactions();

    if (!verification.ok || !transactionsMatch(verification.transactions, importedTransactions)) {
      throw new Error("恢复后数据验证失败。");
    }

    transactions = verification.transactions;
    storageReadError = false;
    renderPage();
    hideImportPreview();
    setDataMessage("恢复成功。", false);
  } catch (error) {
    const rollbackSucceeded = rollbackTransactions(
      originalSnapshot.raw,
      restoreWriteAttempted
    );

    if (rollbackSucceeded) {
      transactions = originalSnapshot.transactions;
      renderPage();
      setDataMessage("恢复失败，原数据已经恢复，当前数据未改变。", true);
    } else {
      setDataMessage("严重错误：恢复失败且原数据回滚失败，请立即停止操作，并使用安全备份文件恢复。", true);
    }
  } finally {
    confirmImportButton.disabled = false;
  }
}

function rollbackTransactions(originalRaw, restoreWriteAttempted) {
  try {
    if (originalRaw === null) {
      if (!restoreWriteAttempted) {
        return false;
      }

      window.localStorage.removeItem(STORAGE_KEY);
      return window.localStorage.getItem(STORAGE_KEY) === null;
    }

    window.localStorage.setItem(STORAGE_KEY, originalRaw);
    const verification = readStoredTransactions();
    return verification.ok && verification.raw === originalRaw;
  } catch (error) {
    return false;
  }
}

function verifyStoredTransactions(expectedTransactions) {
  const snapshot = readStoredTransactions();
  return snapshot.ok && transactionsMatch(snapshot.transactions, expectedTransactions);
}

function transactionsMatch(first, second) {
  return JSON.stringify(first) === JSON.stringify(second);
}

function readStoredTransactions() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);

    if (raw === null) {
      return { ok: true, raw: null, transactions: [] };
    }

    const parsedData = JSON.parse(raw);

    if (!Array.isArray(parsedData) || !parsedData.every(isValidStoredTransaction)) {
      return { ok: false, raw, transactions: [] };
    }

    return { ok: true, raw, transactions: parsedData };
  } catch (error) {
    return { ok: false, raw: null, transactions: [] };
  }
}

function downloadJsonFile(data, fileName) {
  try {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
    return true;
  } catch (error) {
    return false;
  }
}

function formatFileTimestamp(date) {
  const pad = (value) => String(value).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}
