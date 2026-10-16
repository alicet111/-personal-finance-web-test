"use strict";

const FORMAL_STORAGE_KEY = "personal-finance-transactions";
const TEST_STORAGE_KEY = "personal-finance-transactions-test";
const isTestMode = new URLSearchParams(window.location.search).get("test") === "1";
const STORAGE_KEY = isTestMode ? TEST_STORAGE_KEY : FORMAL_STORAGE_KEY;
const FORMAL_EXPENSE_ITEMS_KEY = "personal-finance-expense-items";
const TEST_EXPENSE_ITEMS_KEY = "personal-finance-expense-items-test";
const EXPENSE_ITEMS_STORAGE_KEY = isTestMode ? TEST_EXPENSE_ITEMS_KEY : FORMAL_EXPENSE_ITEMS_KEY;
const REQUIRED_CATEGORIES = new Set(["居住", "餐饮", "交通"]);
const INCOME_CATEGORIES = new Set(["工资", "奖金"]);
const PRESET_EXPENSE_ITEMS = {
  "居住": [["residence-property", "物业费"], ["residence-water", "水费"], ["residence-electricity", "电费"], ["residence-gas", "燃气费"], ["residence-communications", "网络通信"], ["residence-other", "其他居住"]],
  "餐饮": [["dining-breakfast", "早餐"], ["dining-lunch", "午餐"], ["dining-dinner", "晚餐"], ["dining-groceries", "食材采购"], ["dining-drinks", "饮品"], ["dining-other", "其他餐饮"]],
  "交通": [["transport-bus", "公交"], ["transport-subway", "地铁"], ["transport-taxi", "打车"], ["transport-fuel", "燃油"], ["transport-parking", "停车"], ["transport-maintenance", "车辆维护"]],
  "购物": [["shopping-clothing", "服饰"], ["shopping-home", "家居用品"], ["shopping-daily", "日用品"], ["shopping-digital", "数码产品"], ["shopping-other", "其他购物"]],
  "娱乐": [["entertainment-movie", "电影"], ["entertainment-travel", "旅行"], ["entertainment-show", "演出"], ["entertainment-leisure", "休闲活动"], ["entertainment-other", "其他娱乐"]],
  "医疗": [["medical-clinic", "门诊"], ["medical-exam", "检查"], ["medical-medicine", "药品"], ["medical-treatment", "治疗"], ["medical-hospital", "住院"], ["medical-other", "其他医疗"]],
  "健康": [["health-fitness", "运动健身"], ["health-rehab", "康复训练"], ["health-management", "健康管理"], ["health-supplies", "健康用品"], ["health-other", "其他健康"]],
  "其他": [["other-expense", "其他项目"]]
};
const PRESET_EXPENSE_ITEMS_BY_CATEGORY = Object.fromEntries(
  Object.entries(PRESET_EXPENSE_ITEMS).map(([category, names]) => [
    category,
    names.map(([id, name]) => ({ id: `preset:${id}`, category, name }))
  ])
);

let storageReadError = false;
let storageErrorMessage = "";
let storageKeyExists = false;
let transactions = loadTransactions();
let expenseItemsReadError = false;
let expenseItemsErrorMessage = "";
let customExpenseItems = loadExpenseItems();

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
const categoryPlaceholder = categoryInput.querySelector('option[value=""]');
const incomeCategoryGroup = categoryInput.querySelector('[data-category-type="income"]');
const expenseCategoryGroup = categoryInput.querySelector('[data-category-type="expense"]');
const categoryShortcuts = document.querySelector("#category-shortcuts");
const spendingAttribute = document.querySelector("#spending-attribute");
const legacyCategoryOptions = document.querySelector("#legacy-category-options");
const expenseItemControl = document.querySelector("#expense-item-control");
const expenseItemInput = document.querySelector("#expense-item");
const expenseItemError = document.querySelector("#expense-item-error");
const addExpenseItemButton = document.querySelector("#add-expense-item-button");
const manageExpenseItemsButton = document.querySelector("#manage-expense-items-button");
const expenseItemManagement = document.querySelector("#expense-item-management");
const customExpenseItemList = document.querySelector("#custom-expense-item-list");
const customExpenseItemForm = document.querySelector("#custom-expense-item-form");
const customExpenseItemNameInput = document.querySelector("#custom-expense-item-name");
const customExpenseItemError = document.querySelector("#custom-expense-item-error");
const saveCustomExpenseItemButton = document.querySelector("#save-custom-expense-item-button");
const cancelCustomExpenseItemButton = document.querySelector("#cancel-custom-expense-item-button");
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
const restoreScopeWarning = document.querySelector("#restore-scope-warning");
const cancelImportButton = document.querySelector("#cancel-import-button");
const confirmImportButton = document.querySelector("#confirm-import-button");
const trendChart = document.querySelector("#trend-chart");
const rangeControls = document.querySelector("#range-controls");
const monthlySummaryElement = document.querySelector("#monthly-summary");
const categoryExpensesElement = document.querySelector("#category-expenses");
const categoryPeriodInput = document.querySelector("#category-period");
const categoryExpenseSummaryElement = document.querySelector("#category-expense-summary");
const historyRangeControls = document.querySelector(".history-range-controls");
const historyMonthInput = document.querySelector("#history-month");
const historySummaryElement = document.querySelector("#history-summary");
const financialInsightsElement = document.querySelector("#financial-insights");
const quickAddButton = document.querySelector("#quick-add-button");
const entryPanel = document.querySelector("#entry-panel");

let editingTransactionId = null;
let isSubmitting = false;
let selectedTrendRange = "30d";
let lastExpenseCategory = "";
let selectedCategoryPeriod = "month";
let categoryDrilldown = { level: 0, attribute: "", category: "" };
let selectedHistoryFilter = { type: "month", month: getMonthKey(new Date()) };

transactionForm.addEventListener("submit", handleFormSubmit);
transactionList.addEventListener("click", handleTransactionListClick);
cancelEditButton.addEventListener("click", cancelEditing);
exportButton.addEventListener("click", exportTransactions);
// ISOLATED TEST: disabled unvalidated STEP 2D: importButton.addEventListener("click", () => backupFileInput.click());
// ISOLATED TEST: disabled unvalidated STEP 2D: backupFileInput.addEventListener("change", handleBackupFileSelection);

// ISOLATED TEST: disabled unvalidated STEP 2D: confirmImportButton.addEventListener("click", restoreTransactions);
rangeControls.addEventListener("click", handleRangeChange);
categoryPeriodInput.addEventListener("change", handleCategoryPeriodChange);
categoryExpensesElement.addEventListener("click", handleCategoryDrilldownClick);
historyRangeControls.addEventListener("click", handleHistoryRangeChange);
historyMonthInput.addEventListener("change", handleHistoryMonthChange);
quickAddButton.addEventListener("click", focusEntryForm);
categoryShortcuts.addEventListener("click", handleCategoryShortcutClick);
categoryInput.addEventListener("change", syncCategoryShortcuts);
categoryInput.addEventListener("change", handleCategoryChange);
transactionForm.addEventListener("change", handleTransactionFormChange);
addExpenseItemButton.addEventListener("click", showCustomExpenseItemForm);
manageExpenseItemsButton.addEventListener("click", toggleExpenseItemManagement);
customExpenseItemList.addEventListener("click", handleExpenseItemManagementClick);
saveCustomExpenseItemButton.addEventListener("click", saveCustomExpenseItem);
cancelCustomExpenseItemButton.addEventListener("click", hideCustomExpenseItemForm);

renderPage();
updateFormMode();
updateEnvironmentStatus();
syncCategoryShortcuts();
syncCategoryControls();
transactionDateInput.value = getLocalDateValue();
historyMonthInput.value = selectedHistoryFilter.month;

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

  if (getSelectedTransactionType() !== "expense") {
    transactionForm.elements.type.value = "expense";
    expenseItemInput.value = "";
    syncCategoryControls({ clearCategory: true });
  }
  categoryInput.value = shortcut.dataset.category;
  categoryError.textContent = "";
  syncCategoryControls();
}

function syncCategoryShortcuts() {
  const isExpense = getSelectedTransactionType() === "expense";
  categoryShortcuts.hidden = !isExpense;
  categoryShortcuts.querySelectorAll("[data-category]").forEach((shortcut) => {
    shortcut.classList.toggle("active", isExpense && shortcut.dataset.category === categoryInput.value);
  });
}

function getSelectedTransactionType() {
  return transactionForm.elements.type.value;
}

function isExpenseCategory(category) {
  return !INCOME_CATEGORIES.has(category) && (
    Object.prototype.hasOwnProperty.call(PRESET_EXPENSE_ITEMS_BY_CATEGORY, category) ||
    Array.from(legacyCategoryOptions.children).some((option) => option.value === category)
  );
}

function isCategoryValidForType(type, category) {
  return type === "income"
    ? INCOME_CATEGORIES.has(category)
    : type === "expense" && isExpenseCategory(category);
}

function getExpenseCategoryAttribute(category) {
  return REQUIRED_CATEGORIES.has(category) ? "刚需" : "弹性";
}

function getExpenseItems(category) {
  const presetItems = PRESET_EXPENSE_ITEMS_BY_CATEGORY[category] || [
    { id: `preset:category-other:${encodeURIComponent(category)}`, category, name: "其他项目" }
  ];

  return [
    ...presetItems,
    ...customExpenseItems.filter((item) => item.category === category)
  ];
}

function makeOption(value, label) {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = label;
  return option;
}

function ensureLegacyCategoryOption(category) {
  if (!category || INCOME_CATEGORIES.has(category) || isExpenseCategory(category)) {
    return;
  }

  const option = makeOption(category, category);
  option.dataset.legacy = "true";
  legacyCategoryOptions.append(option);
  legacyCategoryOptions.hidden = false;
}

function syncCategoryControls({ preserveExpenseItem = false, clearCategory = false } = {}) {
  const type = getSelectedTransactionType();
  const isExpense = type === "expense";
  const category = clearCategory ? "" : categoryInput.value;
  const categoryChanged = Boolean(lastExpenseCategory && category && category !== lastExpenseCategory);

  if (clearCategory) {
    categoryInput.value = "";
  }

  if (categoryChanged && !preserveExpenseItem) {
    expenseItemInput.value = "";
    expenseItemError.classList.remove("success");
    expenseItemError.textContent = "";
  }

  categoryInput.replaceChildren(categoryPlaceholder);
  const activeCategoryGroup = isExpense ? expenseCategoryGroup : incomeCategoryGroup;
  activeCategoryGroup.hidden = false;
  categoryInput.append(activeCategoryGroup);
  legacyCategoryOptions.hidden = !isExpense || legacyCategoryOptions.children.length === 0;
  if (isExpense && legacyCategoryOptions.children.length > 0) {
    categoryInput.append(legacyCategoryOptions);
  }
  categoryInput.value = category;
  categoryShortcuts.hidden = !isExpense;
  spendingAttribute.hidden = !isExpense || !category;
  spendingAttribute.textContent = isExpense && category
    ? `消费属性：${getExpenseCategoryAttribute(category)}`
    : "";
  expenseItemControl.hidden = !isExpense || !category;

  const selectedItemId = expenseItemInput.value;
  expenseItemInput.replaceChildren(makeOption("", "请选择项目"));

  if (isExpense && category) {
    for (const item of getExpenseItems(category)) {
      expenseItemInput.append(makeOption(item.id, item.name));
    }

    if (selectedItemId && !getExpenseItems(category).some((item) => item.id === selectedItemId)) {
      expenseItemInput.append(makeOption(selectedItemId, "项目无法识别"));
    }
  }

  expenseItemInput.value = selectedItemId;
  expenseItemInput.disabled = expenseItemsReadError;
  addExpenseItemButton.disabled = expenseItemsReadError;
  manageExpenseItemsButton.disabled = expenseItemsReadError;
  if (expenseItemsReadError) {
    expenseItemError.textContent = expenseItemsErrorMessage;
  }

  lastExpenseCategory = isExpense ? category : "";
  renderExpenseItemManagement();
  syncCategoryShortcuts();
}

function renderExpenseItemManagement() {
  const category = categoryInput.value;
  customExpenseItemList.replaceChildren();
  const items = customExpenseItems.filter((item) => item.category === category);

  if (items.length === 0) {
    const emptyItem = document.createElement("li");
    emptyItem.textContent = "当前分类暂无自定义项目。";
    customExpenseItemList.append(emptyItem);
    return;
  }

  for (const item of items) {
    const row = document.createElement("li");
    row.className = "custom-expense-item-row";
    const name = document.createElement("span");
    name.textContent = item.name;
    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.dataset.deleteExpenseItem = item.id;
    removeButton.textContent = "删除";
    row.append(name, removeButton);
    customExpenseItemList.append(row);
  }
}

function toggleExpenseItemManagement() {
  const isOpening = expenseItemManagement.hidden;
  expenseItemManagement.hidden = !isOpening;
  manageExpenseItemsButton.setAttribute("aria-expanded", String(isOpening));
  if (isOpening) {
    renderExpenseItemManagement();
  }
}

function handleExpenseItemManagementClick(event) {
  const removeButton = event.target.closest("[data-delete-expense-item]");
  if (!removeButton) {
    return;
  }

  deleteCustomExpenseItem(removeButton.dataset.deleteExpenseItem);
}

function inspectCustomExpenseItemDeletion(itemId, category, transactionSnapshot, directorySnapshot) {
  if (!transactionSnapshot || !transactionSnapshot.ok || !Array.isArray(transactionSnapshot.transactions)) {
    return { ok: false, reason: "交易数据读取失败或格式异常，无法确认项目引用，禁止删除。" };
  }

  if (!directorySnapshot || !directorySnapshot.ok || !Array.isArray(directorySnapshot.items)) {
    return { ok: false, reason: "项目目录读取失败或格式异常，禁止删除。" };
  }

  const directoryValidation = validateExpenseItemsData({ version: 1, items: directorySnapshot.items });
  if (!directoryValidation.ok || JSON.stringify(directorySnapshot.items) !== JSON.stringify(customExpenseItems)) {
    return { ok: false, reason: "项目目录不一致或数据损坏，禁止删除。" };
  }

  if (typeof itemId !== "string" || !itemId.startsWith("custom:")) {
    return { ok: false, reason: "系统预设项目不可删除。" };
  }

  const matches = directorySnapshot.items.filter((item) => item.id === itemId);
  if (matches.length !== 1 || matches[0].category !== category) {
    return { ok: false, reason: "项目不存在、ID 不唯一或不属于当前分类，禁止删除。" };
  }

  for (const transaction of transactionSnapshot.transactions) {
    if (!isValidStoredTransaction(transaction)) {
      return { ok: false, reason: "交易数据异常，无法确认项目引用，禁止删除。" };
    }

    if (Object.prototype.hasOwnProperty.call(transaction, "expenseItemId") &&
      (typeof transaction.expenseItemId !== "string" || transaction.expenseItemId.length === 0)) {
      return { ok: false, reason: "交易项目引用字段异常，无法确认引用关系，禁止删除。" };
    }

    if (transaction.expenseItemId === itemId) {
      return { ok: false, reason: "该项目已被交易引用，禁止删除。" };
    }
  }

  return { ok: true, item: matches[0] };
}

function deleteCustomExpenseItem(itemId) {
  if (storageReadError || expenseItemsReadError) {
    expenseItemError.textContent = storageReadError
      ? storageErrorMessage
      : expenseItemsErrorMessage;
    return false;
  }

  const initialTransactions = readStoredTransactions();
  const initialDirectory = readStoredExpenseItems();
  const initialCheck = inspectCustomExpenseItemDeletion(
    itemId,
    categoryInput.value,
    initialTransactions,
    initialDirectory
  );
  if (!initialCheck.ok) {
    expenseItemError.textContent = initialCheck.reason;
    return false;
  }

  if (!window.confirm(`确认删除自定义项目“${initialCheck.item.name}”吗？此操作不可撤销。`)) {
    return false;
  }

  const confirmedTransactions = readStoredTransactions();
  const confirmedDirectory = readStoredExpenseItems();
  const confirmedCheck = inspectCustomExpenseItemDeletion(
    itemId,
    categoryInput.value,
    confirmedTransactions,
    confirmedDirectory
  );
  if (!confirmedCheck.ok) {
    expenseItemError.textContent = confirmedCheck.reason;
    return false;
  }

  const nextItems = confirmedDirectory.items.filter((item) => item.id !== itemId);
  const result = saveExpenseItems(nextItems);
  if (!result.ok) {
    expenseItemError.textContent = result.message;
    return false;
  }

  customExpenseItems = result.items;
  if (expenseItemInput.value === itemId) {
    expenseItemInput.value = "";
  }
  syncCategoryControls({ preserveExpenseItem: true });
  expenseItemError.classList.add("success");
  expenseItemError.textContent = "自定义项目已删除。";
  return true;
}

function handleCategoryChange() {
  categoryError.textContent = "";
  syncCategoryControls();
}

function handleTransactionFormChange(event) {
  if (event.target.matches('input[name="type"]')) {
    expenseItemInput.value = "";
    categoryError.textContent = "";
    expenseItemError.textContent = "";
    expenseItemError.classList.remove("success");
    syncCategoryControls({ clearCategory: true });
  }
}

function showCustomExpenseItemForm() {
  if (expenseItemsReadError) {
    expenseItemError.textContent = expenseItemsErrorMessage;
    return;
  }

  customExpenseItemError.textContent = "";
  customExpenseItemNameInput.value = "";
  customExpenseItemForm.hidden = false;
  customExpenseItemNameInput.focus();
}

function hideCustomExpenseItemForm() {
  customExpenseItemForm.hidden = true;
  customExpenseItemError.textContent = "";
  customExpenseItemNameInput.value = "";
}

function normalizeExpenseItemName(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function validateCustomExpenseItemName(name, category) {
  if (!name || name.length > 30 || /[\u0000-\u001f<>]/.test(name)) {
    return "项目名称须为 1 至 30 个字符，且不能包含控制符或尖括号。";
  }

  const normalizedName = name.toLocaleLowerCase("zh-CN");
  if (getExpenseItems(category).some((item) => item.name.toLocaleLowerCase("zh-CN") === normalizedName)) {
    return "该大类下已有同名项目。";
  }

  return "";
}

function createExpenseItemId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return `custom:${window.crypto.randomUUID()}`;
  }

  let id;
  do {
    id = `custom:${Date.now()}-${Math.random().toString(16).slice(2)}`;
  } while (customExpenseItems.some((item) => item.id === id));
  return id;
}

function saveCustomExpenseItem() {
  expenseItemError.classList.remove("success");

  if (expenseItemsReadError) {
    customExpenseItemError.textContent = expenseItemsErrorMessage;
    return;
  }

  const category = categoryInput.value;
  const name = normalizeExpenseItemName(customExpenseItemNameInput.value);
  const validationMessage = validateCustomExpenseItemName(name, category);

  if (!isExpenseCategory(category) || !name) {
    customExpenseItemError.textContent = "请选择有效的支出大类并填写项目名称。";
    return;
  }

  if (validationMessage) {
    customExpenseItemError.textContent = validationMessage;
    return;
  }

  const newItem = { id: createExpenseItemId(), category, name };
  const nextItems = [...customExpenseItems, newItem];
  const result = saveExpenseItems(nextItems);

  if (!result.ok) {
    customExpenseItemError.textContent = result.message;
    return;
  }

  customExpenseItems = result.items;
  syncCategoryControls({ preserveExpenseItem: true });
  expenseItemInput.value = newItem.id;
  customExpenseItemForm.hidden = true;
  customExpenseItemNameInput.value = "";
  expenseItemError.classList.add("success");
  expenseItemError.textContent = "自定义项目已保存并可选择。";
}

function resolveExpenseItem(category, expenseItemId) {
  if (!expenseItemId) {
    return { name: "历史未分类", recognized: true };
  }

  const item = getExpenseItems(category).find((candidate) => candidate.id === expenseItemId);
  return item
    ? { name: item.name, recognized: true }
    : { name: "项目无法识别", recognized: false };
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
    const expenseItemId = String(formData.get("expenseItemId") || "").trim();
    const editingTransaction = editingTransactionId === null
      ? null
      : transactions.find((transaction) => transaction.id === editingTransactionId);
    const mayKeepMissingLegacyDate = Boolean(editingTransaction && !getTransactionDateValue(editingTransaction) && !transactionDate);
    const mayKeepLegacyExpenseItem = Boolean(
      editingTransaction &&
      editingTransaction.type === "expense" &&
      type === "expense" &&
      editingTransaction.category === category &&
      !editingTransaction.expenseItemId &&
      !expenseItemId
    );
    const mayKeepUnrecognizedExpenseItem = Boolean(
      editingTransaction &&
      editingTransaction.type === "expense" &&
      type === "expense" &&
      editingTransaction.category === category &&
      editingTransaction.expenseItemId &&
      editingTransaction.expenseItemId === expenseItemId
    );

    let isValid = true;

    if (type !== "income" && type !== "expense") {
      isValid = false;
    }

    if (amountInCents === null) {
      amountError.textContent = "请输入大于 0 且最多两位小数的金额。";
      isValid = false;
    }

    if (!isCategoryValidForType(type, category)) {
      categoryError.textContent = type === "income"
        ? "请选择有效的收入分类（工资或奖金）。"
        : "请选择有效的支出大类。";
      isValid = false;
    }

    if (type === "income" && expenseItemId) {
      expenseItemError.textContent = "收入交易不能关联支出项目，请先清除项目选择。";
      isValid = false;
    }

    if (type === "expense" && expenseItemsReadError && !mayKeepLegacyExpenseItem) {
      expenseItemError.textContent = expenseItemsErrorMessage;
      isValid = false;
    } else if (type === "expense" && !mayKeepLegacyExpenseItem && !mayKeepUnrecognizedExpenseItem) {
      const selectedItem = getExpenseItems(category).find((item) => item.id === expenseItemId);
      if (!selectedItem) {
        expenseItemError.textContent = "请为这笔支出选择当前大类下的有效项目。";
        isValid = false;
      }
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
          transactionDate,
          ...(type === "expense" ? { expenseItemId } : {})
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

        if (type === "income") {
          delete updatedTransaction.expenseItemId;
        } else if (!mayKeepLegacyExpenseItem && !mayKeepUnrecognizedExpenseItem) {
          updatedTransaction.expenseItemId = expenseItemId;
        }

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
  categoryInput.value = "";
  expenseItemInput.value = "";
  if (transaction.type === "expense") {
    ensureLegacyCategoryOption(transaction.category);
  }
  transactionDateInput.value = getTransactionDateValue(transaction) || "";
  noteInput.value = transaction.note;
  clearValidationMessages();
  updateFormMode();
  syncCategoryControls();

  if (isCategoryValidForType(transaction.type, transaction.category)) {
    categoryInput.value = transaction.category;
    syncCategoryControls();
  } else {
    categoryError.textContent = "该历史记录的交易类型与分类不匹配，请主动选择有效分类后再保存。";
  }

  if (transaction.type === "expense" && categoryInput.value === transaction.category) {
    if (transaction.expenseItemId && !Array.from(expenseItemInput.options).some((option) => option.value === transaction.expenseItemId)) {
      expenseItemInput.append(makeOption(transaction.expenseItemId, "项目无法识别"));
    }
    expenseItemInput.value = transaction.expenseItemId || "";
    if (!transaction.expenseItemId) {
      expenseItemInput.options[0].textContent = "历史未分类（编辑其他字段时保持不变）";
    }
  }
  amountInput.focus();
}

function cancelEditing() {
  editingTransactionId = null;
  transactionForm.reset();
  clearValidationMessages();
  updateFormMode();
  transactionDateInput.value = getLocalDateValue();
  lastExpenseCategory = "";
  syncCategoryControls();
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

function handleCategoryPeriodChange() {
  selectedCategoryPeriod = categoryPeriodInput.value;
  categoryDrilldown = { level: 0, attribute: "", category: "" };
  renderAnalytics();
}

function handleCategoryDrilldownClick(event) {
  const backButton = event.target.closest("[data-category-back]");
  if (backButton) {
    categoryDrilldown = categoryDrilldown.level === 2
      ? { level: 1, attribute: categoryDrilldown.attribute, category: "" }
      : { level: 0, attribute: "", category: "" };
    renderAnalytics();
    return;
  }

  const attributeButton = event.target.closest("[data-category-attribute]");
  if (attributeButton) {
    categoryDrilldown = { level: 1, attribute: attributeButton.dataset.categoryAttribute, category: "" };
    renderAnalytics();
    return;
  }

  const categoryButton = event.target.closest("[data-category-drill-category]");
  if (categoryButton) {
    categoryDrilldown = {
      level: 2,
      attribute: categoryDrilldown.attribute,
      category: categoryButton.dataset.categoryDrillCategory
    };
    renderAnalytics();
  }
}

function handleHistoryRangeChange(event) {
  const button = event.target.closest("[data-history-range]");
  if (!button) {
    return;
  }

  selectedHistoryFilter = {
    type: button.dataset.historyRange,
    month: getMonthKey(new Date())
  };
  historyMonthInput.value = "";
  historyRangeControls.querySelectorAll("[data-history-range]").forEach((candidate) => {
    candidate.classList.toggle("active", candidate === button);
  });
  renderTransactions();
}

function handleHistoryMonthChange() {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(historyMonthInput.value)) {
    return;
  }

  selectedHistoryFilter = { type: "specific-month", month: historyMonthInput.value };
  historyRangeControls.querySelectorAll("[data-history-range]").forEach((button) => {
    button.classList.remove("active");
  });
  renderTransactions();
}

function renderAnalytics() {
  try {
    renderTrendChart(calculateTrendData(transactions, selectedTrendRange));
    renderMonthlySummary(calculateMonthlySummary(transactions));
    renderCategoryExpenses(calculateExpenseStructure(
      filterTransactionsByCategoryPeriod(transactions, selectedCategoryPeriod)
    ));
    renderFinancialInsights(calculateAnomalies(transactions));
  } catch (error) {
    const message = "统计暂时无法计算，请稍后重试。";
    trendChart.innerHTML = `<p class="trend-empty">${message}</p>`;
    monthlySummaryElement.innerHTML = `<p class="trend-empty">${message}</p>`;
    categoryExpensesElement.innerHTML = `<p class="category-empty">${message}</p>`;
    categoryExpenseSummaryElement.textContent = message;
    financialInsightsElement.innerHTML = `<p class="insight-empty">${message}</p>`;
  }
}

function renderTransactions() {
  const filteredTransactions = filterTransactionsByHistoryPeriod(transactions, selectedHistoryFilter);
  renderHistorySummary(filteredTransactions);
  const sortedTransactions = filteredTransactions
    .map((transaction, index) => ({ transaction, index }))
    .sort((first, second) => {
      const firstDate = getTransactionDateValue(first.transaction);
      const secondDate = getTransactionDateValue(second.transaction);

      if (firstDate !== secondDate) {
        if (!firstDate) return 1;
        if (!secondDate) return -1;
        return secondDate.localeCompare(firstDate);
      }

      if (!firstDate) {
        return first.index - second.index;
      }

      const firstCreatedAt = Date.parse(first.transaction.createdAt);
      const secondCreatedAt = Date.parse(second.transaction.createdAt);
      const firstHasValidCreatedAt = Number.isFinite(firstCreatedAt);
      const secondHasValidCreatedAt = Number.isFinite(secondCreatedAt);

      if (firstHasValidCreatedAt !== secondHasValidCreatedAt) {
        return firstHasValidCreatedAt ? -1 : 1;
      }

      if (firstHasValidCreatedAt && firstCreatedAt !== secondCreatedAt) {
        return secondCreatedAt - firstCreatedAt;
      }

      return first.index - second.index;
    })
    .map(({ transaction }) => transaction);

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
  const displayCategory = transaction.category === "物业水电" ? "居住" : transaction.category;
  const expenseItem = isIncome
    ? null
    : resolveExpenseItem(transaction.category, transaction.expenseItemId);
  const categoryLabel = isIncome
    ? displayCategory
    : `${displayCategory} / ${expenseItem.name}`;

  return `
    <article class="transaction-item ${typeClass}">
      <div class="transaction-main">
        <p class="transaction-category">${escapeHtml(categoryLabel)}</p>
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

function shiftMonthKey(monthKey, offset) {
  const [year, month] = monthKey.split("-").map(Number);
  return getMonthKey(new Date(year, month - 1 + offset, 1));
}

function getCategoryPeriodMonthRange(period, now = new Date()) {
  const currentMonth = getMonthKey(now);
  if (period === "all") {
    return null;
  }

  if (period === "previous-month") {
    return { start: shiftMonthKey(currentMonth, -1), end: currentMonth };
  }

  if (period === "three-months") {
    return { start: shiftMonthKey(currentMonth, -2), end: shiftMonthKey(currentMonth, 1) };
  }

  if (period === "year") {
    return { start: `${now.getFullYear()}-01`, end: `${now.getFullYear() + 1}-01` };
  }

  return { start: currentMonth, end: shiftMonthKey(currentMonth, 1) };
}

function filterTransactionsByCategoryPeriod(transactionList, period, now = new Date()) {
  const range = getCategoryPeriodMonthRange(period, now);
  if (!range) {
    return transactionList.slice();
  }

  return transactionList.filter((transaction) => {
    const dateValue = getTransactionDateValue(transaction);
    if (!dateValue) {
      return false;
    }

    const month = dateValue.slice(0, 7);
    return month >= range.start && month < range.end;
  });
}

function getHistoryMonth(filter, now = new Date()) {
  if (filter.type === "all") {
    return null;
  }
  if (filter.type === "previous-month") {
    return shiftMonthKey(getMonthKey(now), -1);
  }
  if (filter.type === "specific-month" && /^\d{4}-(0[1-9]|1[0-2])$/.test(filter.month)) {
    return filter.month;
  }
  return getMonthKey(now);
}

function filterTransactionsByHistoryPeriod(transactionList, filter, now = new Date()) {
  if (filter.type === "all") {
    return transactionList.slice();
  }

  const month = getHistoryMonth(filter, now);
  return transactionList.filter((transaction) => {
    const dateValue = getTransactionDateValue(transaction);
    return Boolean(dateValue && dateValue.slice(0, 7) === month);
  });
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

function getExpenseDisplayCategory(category) {
  const normalized = typeof category === "string" ? category.trim() : "";
  if (!normalized) {
    return "未分类";
  }
  return normalized === "物业水电" ? "居住" : normalized;
}

function getExpenseItemDisplayName(transaction, displayCategory) {
  if (!transaction.expenseItemId) {
    return "历史未分类";
  }

  const items = [
    ...Object.values(PRESET_EXPENSE_ITEMS_BY_CATEGORY).flat(),
    ...customExpenseItems
  ];
  const item = items.find((candidate) =>
    candidate.id === transaction.expenseItemId &&
    (candidate.category === transaction.category || candidate.category === displayCategory)
  );
  return item ? item.name : "项目无法识别";
}

function calculateExpenseStructure(transactionList) {
  const attributes = new Map();
  let totalExpenseInCents = 0;
  let totalCount = 0;

  for (const transaction of transactionList) {
    if (transaction.type !== "expense") {
      continue;
    }

    const category = getExpenseDisplayCategory(transaction.category);
    const attribute = REQUIRED_CATEGORIES.has(category) ? "刚需" : "弹性";
    const attributeNode = attributes.get(attribute) || {
      name: attribute,
      amountInCents: 0,
      count: 0,
      categories: new Map()
    };
    const categoryNode = attributeNode.categories.get(category) || {
      name: category,
      amountInCents: 0,
      count: 0,
      items: new Map()
    };
    const itemName = getExpenseItemDisplayName(transaction, category);
    const itemNode = categoryNode.items.get(itemName) || {
      name: itemName,
      amountInCents: 0,
      count: 0
    };

    itemNode.amountInCents += transaction.amountInCents;
    itemNode.count += 1;
    categoryNode.items.set(itemName, itemNode);
    categoryNode.amountInCents += transaction.amountInCents;
    categoryNode.count += 1;
    attributeNode.categories.set(category, categoryNode);
    attributeNode.amountInCents += transaction.amountInCents;
    attributeNode.count += 1;
    attributes.set(attribute, attributeNode);
    totalExpenseInCents += transaction.amountInCents;
    totalCount += 1;
  }

  return {
    totalExpenseInCents,
    totalCount,
    attributes: [...attributes.values()].map((attribute) => ({
      ...attribute,
      ratio: totalExpenseInCents ? attribute.amountInCents / totalExpenseInCents : 0,
      categories: [...attribute.categories.values()].map((category) => ({
        ...category,
        ratio: attribute.amountInCents ? category.amountInCents / attribute.amountInCents : 0,
        items: [...category.items.values()].map((item) => ({
          ...item,
          ratio: category.amountInCents ? item.amountInCents / category.amountInCents : 0
        })).sort((first, second) => second.amountInCents - first.amountInCents)
      })).sort((first, second) => second.amountInCents - first.amountInCents)
    })).sort((first, second) => second.amountInCents - first.amountInCents)
  };
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

function formatRatio(ratio) {
  return `${(ratio * 100).toFixed(1)}%`;
}

function createCategoryDrillRow(label, amountInCents, ratio, count, dataset = null) {
  const row = document.createElement("div");
  row.className = "category-drill-row";
  const name = document.createElement(dataset ? "button" : "span");
  name.textContent = label;
  if (dataset) {
    name.type = "button";
    Object.entries(dataset).forEach(([key, value]) => {
      name.dataset[key] = value;
    });
  }
  const value = document.createElement("span");
  value.className = "category-drill-value";
  value.textContent = `${formatCurrency(amountInCents)} · ${formatRatio(ratio)} · ${count} 笔`;
  row.append(name, value);
  return row;
}

function renderCategoryExpenses(structure) {
  categoryExpenseSummaryElement.replaceChildren();
  [["支出", formatCurrency(structure.totalExpenseInCents)], ["交易", `${structure.totalCount} 笔`]]
    .forEach(([label, value]) => {
      const entry = document.createElement("span");
      const strong = document.createElement("strong");
      strong.textContent = `${label} ${value}`;
      entry.append(strong);
      categoryExpenseSummaryElement.append(entry);
    });
  categoryExpensesElement.replaceChildren();

  if (structure.totalCount === 0) {
    const empty = document.createElement("p");
    empty.className = "category-empty";
    empty.textContent = "当前统计周期暂无支出数据。";
    categoryExpensesElement.append(empty);
    return;
  }

  const list = document.createElement("div");
  list.className = "category-drill-list";
  if (categoryDrilldown.level > 0) {
    const back = document.createElement("button");
    back.type = "button";
    back.className = "range-button category-drill-back";
    back.dataset.categoryBack = "true";
    back.textContent = "返回上级";
    categoryExpensesElement.append(back);
  }

  if (categoryDrilldown.level === 0) {
    structure.attributes.forEach((attribute) => {
      list.append(createCategoryDrillRow(
        attribute.name,
        attribute.amountInCents,
        attribute.ratio,
        attribute.count,
        { categoryAttribute: attribute.name }
      ));
    });
  } else {
    const attribute = structure.attributes.find((item) => item.name === categoryDrilldown.attribute);
    if (!attribute) {
      categoryDrilldown = { level: 0, attribute: "", category: "" };
      renderCategoryExpenses(structure);
      return;
    }

    if (categoryDrilldown.level === 1) {
      attribute.categories.forEach((category) => {
        list.append(createCategoryDrillRow(
          category.name,
          category.amountInCents,
          category.ratio,
          category.count,
          { categoryDrillCategory: category.name }
        ));
      });
    } else {
      const category = attribute.categories.find((item) => item.name === categoryDrilldown.category);
      if (!category) {
        categoryDrilldown = { level: 1, attribute: attribute.name, category: "" };
        renderCategoryExpenses(structure);
        return;
      }
      category.items.forEach((item) => {
        list.append(createCategoryDrillRow(item.name, item.amountInCents, item.ratio, item.count));
      });
    }
  }

  categoryExpensesElement.append(list);
}

function renderHistorySummary(filteredTransactions) {
  const income = calculateTotalIncome(filteredTransactions);
  const expense = calculateTotalExpense(filteredTransactions);
  const values = [
    ["收入", formatCurrency(income)],
    ["支出", formatCurrency(expense)],
    ["结余", formatCurrency(income - expense)],
    ["记录", `${filteredTransactions.length} 笔`]
  ];
  historySummaryElement.replaceChildren();
  values.forEach(([label, value]) => {
    const entry = document.createElement("span");
    const strong = document.createElement("strong");
    strong.textContent = `${label} ${value}`;
    entry.append(strong);
    historySummaryElement.append(entry);
  });
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

function isKnownExpenseCategory(category) {
  return typeof category === "string" && category.trim() !== "" &&
    category === category.trim() && !INCOME_CATEGORIES.has(category);
}

function validateExpenseItemsData(data) {
  if (!data || typeof data !== "object" || data.version !== 1 || !Array.isArray(data.items)) {
    return { ok: false, items: [] };
  }

  const ids = new Set();
  const names = new Set();
  for (const item of data.items) {
    if (!item || typeof item.id !== "string" || !item.id.startsWith("custom:") ||
      typeof item.category !== "string" || !isKnownExpenseCategory(item.category) ||
      typeof item.name !== "string" || normalizeExpenseItemName(item.name) !== item.name ||
      !item.name || item.name.length > 30 || /[\u0000-\u001f<>]/.test(item.name)) {
      return { ok: false, items: [] };
    }

    const nameKey = `${item.category}\u0000${item.name.toLocaleLowerCase("zh-CN")}`;
    if (ids.has(item.id) || names.has(nameKey) ||
      (PRESET_EXPENSE_ITEMS_BY_CATEGORY[item.category] || []).some(
        (preset) => preset.name.toLocaleLowerCase("zh-CN") === item.name.toLocaleLowerCase("zh-CN")
      )) {
      return { ok: false, items: [] };
    }

    ids.add(item.id);
    names.add(nameKey);
  }

  return { ok: true, items: data.items };
}

function readStoredExpenseItems() {
  try {
    const raw = window.localStorage.getItem(EXPENSE_ITEMS_STORAGE_KEY);
    if (raw === null) {
      return { ok: true, raw: null, items: [] };
    }

    const validation = validateExpenseItemsData(JSON.parse(raw));
    return validation.ok
      ? { ok: true, raw, items: validation.items }
      : { ok: false, raw, items: [] };
  } catch (error) {
    return { ok: false, raw: null, items: [] };
  }
}

function loadExpenseItems() {
  const snapshot = readStoredExpenseItems();
  if (!snapshot.ok) {
    expenseItemsReadError = true;
    expenseItemsErrorMessage = "自定义项目目录读取失败或格式异常，已停止目录写入。请先检查目录数据。";
    return [];
  }
  return snapshot.items;
}

function saveExpenseItems(items) {
  if (expenseItemsReadError) {
    return { ok: false, message: expenseItemsErrorMessage };
  }

  const validation = validateExpenseItemsData({ version: 1, items });
  if (!validation.ok) {
    return { ok: false, message: "项目目录校验失败，未保存。" };
  }

  const currentSnapshot = readStoredExpenseItems();
  if (!currentSnapshot.ok) {
    expenseItemsReadError = true;
    expenseItemsErrorMessage = "自定义项目目录读取失败，已停止目录写入。";
    return { ok: false, message: expenseItemsErrorMessage };
  }

  if (JSON.stringify(currentSnapshot.items) !== JSON.stringify(customExpenseItems)) {
    expenseItemsReadError = true;
    expenseItemsErrorMessage = "项目目录已在其他位置发生变化，已阻止覆盖；请重新载入页面后重试。";
    return { ok: false, message: expenseItemsErrorMessage };
  }

  try {
    const serialized = JSON.stringify({ version: 1, items: validation.items });
    window.localStorage.setItem(EXPENSE_ITEMS_STORAGE_KEY, serialized);
    const verification = readStoredExpenseItems();

    if (!verification.ok || verification.raw !== serialized) {
      expenseItemsReadError = true;
      expenseItemsErrorMessage = "项目目录写入后验证失败；项目不会加入可选列表。";
      return { ok: false, message: expenseItemsErrorMessage };
    }

    return { ok: true, items: verification.items };
  } catch (error) {
    return { ok: false, message: "项目目录保存失败，请检查浏览器存储空间；未将项目加入可选列表。" };
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
  expenseItemError.textContent = "";
  expenseItemError.classList.remove("success");
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

function validateBackupTransactions(transactionList, requireExpenseItemIdType) {
  if (!Array.isArray(transactionList)) {
    return { ok: false, message: "备份缺少有效的 transactions 数组。" };
  }

  const ids = new Set();
  for (const transaction of transactionList) {
    if (!isValidStoredTransaction(transaction)) {
      return { ok: false, message: "备份中包含无效交易数据。" };
    }

    if (ids.has(transaction.id)) {
      return { ok: false, message: "备份中存在重复交易 ID。" };
    }
    ids.add(transaction.id);

    if (requireExpenseItemIdType && Object.prototype.hasOwnProperty.call(transaction, "expenseItemId") &&
      (typeof transaction.expenseItemId !== "string" || transaction.expenseItemId.length === 0)) {
      return { ok: false, message: "备份中存在无效的 expenseItemId。" };
    }
  }

  return { ok: true, transactions: transactionList };
}

function countUnrecognizedExpenseItemReferences(transactionList, directoryItems) {
  const allItems = [
    ...Object.values(PRESET_EXPENSE_ITEMS_BY_CATEGORY).flat(),
    ...directoryItems
  ];

  return transactionList.reduce((count, transaction) => {
    if (!transaction.expenseItemId) {
      return count;
    }

    const displayCategory = transaction.category === "物业水电" ? "居住" : transaction.category;
    const recognized = allItems.some((item) =>
      item.id === transaction.expenseItemId &&
      (item.category === transaction.category || item.category === displayCategory)
    );
    return count + (recognized ? 0 : 1);
  }, 0);
}

function exportTransactions() {
  const transactionSnapshot = readStoredTransactions();
  const itemSnapshot = readStoredExpenseItems();

  if (!transactionSnapshot.ok) {
    setDataMessage("交易数据读取异常，已中止导出。", true);
    return;
  }

  if (!itemSnapshot.ok) {
    setDataMessage("自定义项目目录读取或校验失败，已中止导出。", true);
    return;
  }

  const transactionValidation = validateBackupTransactions(transactionSnapshot.transactions, true);
  const itemValidation = validateExpenseItemsData({ version: 1, items: itemSnapshot.items });
  if (!transactionValidation.ok || !itemValidation.ok) {
    setDataMessage(transactionValidation.message || "自定义项目目录校验失败，已中止导出。", true);
    return;
  }

  const backup = {
    backupVersion: "2.0",
    appVersion: "1.7",
    backupCreatedAt: new Date().toISOString(),
    storageKey: STORAGE_KEY,
    expenseItemsStorageKey: EXPENSE_ITEMS_STORAGE_KEY,
    transactions: transactionSnapshot.transactions,
    expenseItems: { version: 1, items: itemSnapshot.items }
  };

  const backupValidation = validateBackupData(backup);
  if (!backupValidation.ok) {
    setDataMessage("完整备份封装校验失败，未生成下载文件。", true);
    return;
  }

  const fileName = `personal-finance-snapshot-export-only-${formatFileTimestamp(new Date())}.json`;
  const downloadCreated = downloadJsonFile(backup, fileName);

  setDataMessage(
    downloadCreated ? `交易及自定义项目数据快照已导出：${fileName}（尚未验证恢复）` : "数据快照下载失败；未能确认文件已生成。",
    !downloadCreated
  );
}

function validateBackupData(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { ok: false, message: "备份文件格式错误。" };
  }

  const version = data.backupVersion === undefined ? "1.0" : data.backupVersion;
  if (version === "1.0") {
    if (data.storageKey !== undefined && data.storageKey !== STORAGE_KEY) {
      return { ok: false, message: "备份文件不是当前环境生成的有效备份。" };
    }

    const transactionValidation = validateBackupTransactions(data.transactions, false);
    return transactionValidation.ok
      ? { ok: true, version: "1.0", transactions: transactionValidation.transactions, expenseItems: null }
      : transactionValidation;
  }

  if (version !== "2.0" || data.storageKey !== STORAGE_KEY ||
    data.expenseItemsStorageKey !== EXPENSE_ITEMS_STORAGE_KEY ||
    data.appVersion !== "1.7" || typeof data.backupCreatedAt !== "string" ||
    !Number.isFinite(Date.parse(data.backupCreatedAt))) {
    return { ok: false, message: "V2.0 备份版本或环境存储键不匹配。" };
  }

  const transactionValidation = validateBackupTransactions(data.transactions, true);
  if (!transactionValidation.ok) {
    return transactionValidation;
  }

  const itemValidation = validateExpenseItemsData(data.expenseItems);
  if (!itemValidation.ok) {
    return { ok: false, message: "V2.0 备份中的自定义项目目录格式或内容无效。" };
  }

  return {
    ok: true,
    version: "2.0",
    transactions: transactionValidation.transactions,
    expenseItems: { version: 1, items: itemValidation.items },
    unrecognizedReferences: countUnrecognizedExpenseItemReferences(
      transactionValidation.transactions,
      itemValidation.items
    )
  };
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
