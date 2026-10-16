/*
  Task Tracker - JTRONIX Frontend Internship Assessment
  Features:
  1. Add tasks with priority, due date, and validation.
  2. Mark tasks Completed/Pending with checkbox toggle.
  3. Inline edit task title, priority, and due date (Enter to save, Esc to cancel).
  4. Real-time Analytics Dashboard:
     - SVG Circular Donut completion chart
     - Priority distribution stacked bar chart
     - Live Overdue & Due Today urgency indicators
  5. Live keyword search bar with clear button.
  6. Multi-criteria filtering by Status and Priority.
  7. Multi-option sorting (Newest, Oldest, Priority, Due Date, Alphabetical).
  8. Demo tasks loader for instant testing.
  9. Undo delete toast notification.
  10. Export & Import JSON backup.
  11. Safe browser localStorage persistence.
*/

const STORAGE_KEY = "jtronix-task-tracker-v1";

// DOM Elements
const taskForm = document.getElementById("task-form");
const taskInput = document.getElementById("task-input");
const taskPriority = document.getElementById("task-priority");
const taskDueDate = document.getElementById("task-due-date");
const formMessage = document.getElementById("form-message");

const taskSearch = document.getElementById("task-search");
const clearSearchBtn = document.getElementById("clear-search");
const taskFilter = document.getElementById("task-filter");
const priorityFilter = document.getElementById("priority-filter");
const sortSelect = document.getElementById("sort-select");

const taskList = document.getElementById("task-list");
const totalCount = document.getElementById("total-count");
const completedCount = document.getElementById("completed-count");
const pendingCount = document.getElementById("pending-count");
const progressText = document.getElementById("progress-text");

// Analytics & Charts Elements
const donutStroke = document.getElementById("donut-stroke");
const donutPercent = document.getElementById("donut-percent");
const urgentBadgeContainer = document.getElementById("urgent-badge-container");
const distHigh = document.getElementById("dist-high");
const distMed = document.getElementById("dist-med");
const distLow = document.getElementById("dist-low");
const countHigh = document.getElementById("count-high");
const countMed = document.getElementById("count-med");
const countLow = document.getElementById("count-low");
const priorityBreakdownText = document.getElementById("priority-breakdown-text");

// Empty & Summary Elements
const emptyState = document.getElementById("empty-state");
const emptyTitle = document.getElementById("empty-title");
const emptyDescription = document.getElementById("empty-description");
const resetFiltersBtn = document.getElementById("reset-filters-btn");
const listSummary = document.getElementById("list-summary");
const clearCompletedButton = document.getElementById("clear-completed");

// Sample Data & Backup Elements
const loadSampleBtn = document.getElementById("load-sample-btn");
const emptySampleBtn = document.getElementById("empty-sample-btn");
const exportBtn = document.getElementById("export-btn");
const importInput = document.getElementById("import-input");

// Toast Notification
const toast = document.getElementById("toast");
const toastMessage = document.getElementById("toast-message");
const toastUndo = document.getElementById("toast-undo");

// Application State
let tasks = loadTasks();
let activeStatusFilter = "all";
let activePriorityFilter = "all";
let activeSortOrder = "newest";
let searchQuery = "";
let editingTaskId = null;
let lastDeleted = null;
let toastTimeoutId = null;

function loadTasks() {
  try {
    const savedTasks = localStorage.getItem(STORAGE_KEY);
    if (!savedTasks) return [];

    const parsedTasks = JSON.parse(savedTasks);
    if (!Array.isArray(parsedTasks)) return [];

    return parsedTasks
      .filter((task) =>
        task &&
        typeof task.id === "string" &&
        typeof task.title === "string" &&
        typeof task.completed === "boolean"
      )
      .map((task) => ({
        id: task.id,
        title: task.title,
        completed: task.completed,
        priority: ["low", "medium", "high"].includes(task.priority) ? task.priority : "medium",
        dueDate: typeof task.dueDate === "string" ? task.dueDate : "",
        createdAt: typeof task.createdAt === "string" ? task.createdAt : new Date().toISOString()
      }));
  } catch (error) {
    console.error("Could not load saved tasks:", error);
    return [];
  }
}

function saveTasks() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch (error) {
    console.error("Could not save tasks:", error);
    showMessage("Your browser could not save the tasks. Check storage settings.");
  }
}

function showMessage(message = "") {
  formMessage.textContent = message;
}

function showToast(text, onUndo) {
  if (toastTimeoutId) clearTimeout(toastTimeoutId);
  toastMessage.textContent = text;
  toast.hidden = false;

  toastUndo.onclick = () => {
    hideToast();
    if (onUndo) onUndo();
  };

  toastTimeoutId = setTimeout(hideToast, 4000);
}

function hideToast() {
  toast.hidden = true;
  if (toastTimeoutId) {
    clearTimeout(toastTimeoutId);
    toastTimeoutId = null;
  }
}

function createTask(title, priority = "medium", dueDate = "") {
  return {
    id: (typeof crypto !== "undefined" && crypto.randomUUID)
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    title,
    completed: false,
    priority: ["low", "medium", "high"].includes(priority) ? priority : "medium",
    dueDate: dueDate || "",
    createdAt: new Date().toISOString()
  };
}

function addTask(title, priority, dueDate) {
  const trimmedTitle = title.trim();

  if (!trimmedTitle) {
    showMessage("Please enter a task before clicking Add.");
    taskInput.focus();
    return;
  }

  tasks.unshift(createTask(trimmedTitle, priority, dueDate));
  saveTasks();
  showMessage("");

  // Reset form inputs
  taskInput.value = "";
  taskDueDate.value = "";
  taskPriority.value = "medium";
  taskInput.focus();

  if (activeStatusFilter === "completed") {
    activeStatusFilter = "all";
    taskFilter.value = "all";
  }

  render();
}

function toggleTask(taskId) {
  tasks = tasks.map((task) =>
    task.id === taskId ? { ...task, completed: !task.completed } : task
  );
  saveTasks();
  render();
}

function deleteTask(taskId) {
  const taskIndex = tasks.findIndex((t) => t.id === taskId);
  if (taskIndex === -1) return;

  const deletedTask = tasks[taskIndex];
  lastDeleted = { task: deletedTask, index: taskIndex };

  tasks = tasks.filter((t) => t.id !== taskId);
  if (editingTaskId === taskId) editingTaskId = null;
  saveTasks();
  render();

  showToast(`Deleted "${deletedTask.title}"`, () => {
    if (lastDeleted && lastDeleted.task.id === deletedTask.id) {
      tasks.splice(lastDeleted.index, 0, lastDeleted.task);
      saveTasks();
      render();
    }
  });
}

function startEdit(taskId) {
  editingTaskId = taskId;
  render();
}

function cancelEdit() {
  editingTaskId = null;
  render();
}

function saveEdit(taskId, updatedTitle, updatedPriority, updatedDueDate) {
  const trimmedTitle = updatedTitle.trim();
  if (!trimmedTitle) return;

  tasks = tasks.map((task) =>
    task.id === taskId
      ? {
          ...task,
          title: trimmedTitle,
          priority: ["low", "medium", "high"].includes(updatedPriority) ? updatedPriority : task.priority,
          dueDate: updatedDueDate || ""
        }
      : task
  );

  editingTaskId = null;
  saveTasks();
  render();
}

function clearCompletedTasks() {
  const completedList = tasks.filter((task) => task.completed);
  if (completedList.length === 0) return;

  tasks = tasks.filter((task) => !task.completed);
  saveTasks();
  render();

  showToast(`Cleared ${completedList.length} completed task${completedList.length > 1 ? "s" : ""}`, () => {
    tasks = [...tasks, ...completedList];
    saveTasks();
    render();
  });
}

function resetAllFilters() {
  activeStatusFilter = "all";
  activePriorityFilter = "all";
  activeSortOrder = "newest";
  searchQuery = "";

  taskFilter.value = "all";
  priorityFilter.value = "all";
  sortSelect.value = "newest";
  taskSearch.value = "";
  clearSearchBtn.hidden = true;

  render();
}

function loadSampleTasks() {
  const today = new Date();
  const formatYMD = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const todayStr = formatYMD(today);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const tomorrowStr = formatYMD(tomorrow);

  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const yesterdayStr = formatYMD(yesterday);

  tasks = [
    {
      id: "sample-1",
      title: "Review assessment guidelines & test responsive layout",
      completed: false,
      priority: "high",
      dueDate: todayStr,
      createdAt: new Date(Date.now() - 3600000).toISOString()
    },
    {
      id: "sample-2",
      title: "Implement interactive charts and priority breakdown bar",
      completed: false,
      priority: "medium",
      dueDate: tomorrowStr,
      createdAt: new Date(Date.now() - 7200000).toISOString()
    },
    {
      id: "sample-3",
      title: "Add real-time task search, status filter, and sorting",
      completed: true,
      priority: "high",
      dueDate: yesterdayStr,
      createdAt: new Date(Date.now() - 86400000).toISOString()
    },
    {
      id: "sample-4",
      title: "Configure localStorage persistence and error handling",
      completed: true,
      priority: "low",
      dueDate: "",
      createdAt: new Date(Date.now() - 90000000).toISOString()
    }
  ];

  resetAllFilters();
  saveTasks();
  render();
  showToast("Sample tasks loaded successfully!");
}

function exportTasks() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(tasks, null, 2));
  const downloadAnchor = document.createElement("a");
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `tasks-backup-${new Date().toISOString().slice(0, 10)}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

function importTasks(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const imported = JSON.parse(e.target.result);
      if (Array.isArray(imported)) {
        const valid = imported.filter((t) => t && typeof t.title === "string");
        tasks = valid.map((t) => ({
          id: t.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          title: t.title,
          completed: Boolean(t.completed),
          priority: ["low", "medium", "high"].includes(t.priority) ? t.priority : "medium",
          dueDate: typeof t.dueDate === "string" ? t.dueDate : "",
          createdAt: typeof t.createdAt === "string" ? t.createdAt : new Date().toISOString()
        }));
        saveTasks();
        render();
        showToast(`Imported ${tasks.length} tasks!`);
      }
    } catch (err) {
      console.error(err);
      alert("Invalid JSON file. Please select a valid task backup JSON.");
    }
  };
  reader.readAsText(file);
  event.target.value = "";
}

function formatDueDate(dueDateStr, isCompleted) {
  if (!dueDateStr) return null;

  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  const todayStr = `${year}-${month}-${day}`;

  const parts = dueDateStr.split("-");
  let formatted = dueDateStr;
  if (parts.length === 3) {
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    if (!isNaN(d.getTime())) {
      formatted = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    }
  }

  let statusClass = "due-badge";
  let label = `📅 ${formatted}`;

  if (isCompleted) {
    label = `✓ ${formatted}`;
  } else if (dueDateStr < todayStr) {
    statusClass += " due-overdue";
    label = `⚠️ Overdue (${formatted})`;
  } else if (dueDateStr === todayStr) {
    statusClass += " due-today";
    label = `⏳ Due today`;
  }

  return { label, statusClass, isOverdue: !isCompleted && dueDateStr < todayStr, isDueToday: !isCompleted && dueDateStr === todayStr };
}

function getVisibleTasks() {
  return tasks
    .filter((task) => {
      if (activeStatusFilter === "pending" && task.completed) return false;
      if (activeStatusFilter === "completed" && !task.completed) return false;

      if (activePriorityFilter !== "all" && task.priority !== activePriorityFilter) return false;

      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (!task.title.toLowerCase().includes(query)) return false;
      }

      return true;
    })
    .sort((a, b) => {
      if (activeSortOrder === "newest") {
        return new Date(b.createdAt) - new Date(a.createdAt);
      }
      if (activeSortOrder === "oldest") {
        return new Date(a.createdAt) - new Date(b.createdAt);
      }
      if (activeSortOrder === "priority") {
        const weights = { high: 3, medium: 2, low: 1 };
        const diff = (weights[b.priority] || 0) - (weights[a.priority] || 0);
        if (diff !== 0) return diff;
        return new Date(b.createdAt) - new Date(a.createdAt);
      }
      if (activeSortOrder === "due-date") {
        if (!a.dueDate && !b.dueDate) return new Date(b.createdAt) - new Date(a.createdAt);
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.localeCompare(b.dueDate);
      }
      if (activeSortOrder === "alphabetical") {
        return a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
      }
      return 0;
    });
}

function makeTaskElement(task) {
  const item = document.createElement("li");

  // Render Inline Edit Mode
  if (editingTaskId === task.id) {
    item.className = "task-item is-editing";

    const editForm = document.createElement("form");
    editForm.className = "edit-form";

    const editInput = document.createElement("input");
    editInput.type = "text";
    editInput.className = "edit-input";
    editInput.value = task.title;
    editInput.maxLength = 200;
    editInput.required = true;
    editInput.setAttribute("aria-label", "Edit task title");

    const metaRow = document.createElement("div");
    metaRow.className = "edit-meta-row";

    const editPriority = document.createElement("select");
    editPriority.className = "edit-priority";
    editPriority.setAttribute("aria-label", "Edit task priority");
    editPriority.innerHTML = `
      <option value="low" ${task.priority === "low" ? "selected" : ""}>🟢 Low</option>
      <option value="medium" ${task.priority === "medium" ? "selected" : ""}>🟡 Medium</option>
      <option value="high" ${task.priority === "high" ? "selected" : ""}>🔴 High</option>
    `;

    const editDueDate = document.createElement("input");
    editDueDate.type = "date";
    editDueDate.className = "edit-due-date";
    editDueDate.value = task.dueDate || "";
    editDueDate.setAttribute("aria-label", "Edit due date");

    const actions = document.createElement("div");
    actions.className = "edit-actions";

    const saveButton = document.createElement("button");
    saveButton.type = "submit";
    saveButton.className = "button button-primary button-sm";
    saveButton.textContent = "Save";

    const cancelButton = document.createElement("button");
    cancelButton.type = "button";
    cancelButton.className = "button button-secondary button-sm";
    cancelButton.textContent = "Cancel";
    cancelButton.addEventListener("click", cancelEdit);

    actions.append(saveButton, cancelButton);
    metaRow.append(editPriority, editDueDate, actions);
    editForm.append(editInput, metaRow);

    editForm.addEventListener("submit", (e) => {
      e.preventDefault();
      saveEdit(task.id, editInput.value, editPriority.value, editDueDate.value);
    });

    editInput.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        cancelEdit();
      }
    });

    item.appendChild(editForm);

    setTimeout(() => {
      editInput.focus();
      editInput.select();
    }, 0);

    return item;
  }

  // Render Standard View Mode with Priority Left Border
  item.className = `task-item priority-${task.priority}${task.completed ? " is-completed" : ""}`;

  const toggleButton = document.createElement("button");
  toggleButton.type = "button";
  toggleButton.className = "status-toggle";
  toggleButton.setAttribute("aria-pressed", String(task.completed));
  toggleButton.setAttribute(
    "aria-label",
    task.completed ? `Mark "${task.title}" as pending` : `Mark "${task.title}" as completed`
  );
  toggleButton.textContent = task.completed ? "✓" : "";
  toggleButton.addEventListener("click", () => toggleTask(task.id));

  const content = document.createElement("div");
  content.className = "task-content";

  const title = document.createElement("p");
  title.className = "task-title";
  title.textContent = task.title;

  const badges = document.createElement("div");
  badges.className = "task-badges";

  const statusBadge = document.createElement("span");
  statusBadge.className = "task-status";
  statusBadge.textContent = task.completed ? "Completed" : "Pending";
  badges.appendChild(statusBadge);

  const priorityBadge = document.createElement("span");
  priorityBadge.className = `priority-badge priority-${task.priority}`;
  priorityBadge.textContent = task.priority;
  badges.appendChild(priorityBadge);

  const dueInfo = formatDueDate(task.dueDate, task.completed);
  if (dueInfo) {
    const dueBadge = document.createElement("span");
    dueBadge.className = dueInfo.statusClass;
    dueBadge.textContent = dueInfo.label;
    badges.appendChild(dueBadge);
  }

  content.append(title, badges);

  const actions = document.createElement("div");
  actions.className = "task-actions";

  const editButton = document.createElement("button");
  editButton.type = "button";
  editButton.className = "action-button edit-button";
  editButton.textContent = "Edit";
  editButton.setAttribute("aria-label", `Edit "${task.title}"`);
  editButton.addEventListener("click", () => startEdit(task.id));

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "action-button delete-button";
  deleteButton.textContent = "Delete";
  deleteButton.setAttribute("aria-label", `Delete "${task.title}"`);
  deleteButton.addEventListener("click", () => deleteTask(task.id));

  actions.append(editButton, deleteButton);
  item.append(toggleButton, content, actions);
  return item;
}

function render() {
  const completed = tasks.filter((task) => task.completed).length;
  const pending = tasks.length - completed;
  const visibleTasks = getVisibleTasks();

  // Update Mini Metrics
  totalCount.textContent = String(tasks.length);
  completedCount.textContent = String(completed);
  pendingCount.textContent = String(pending);

  // Update SVG Donut Progress Chart
  const completionPercent = tasks.length === 0 ? 0 : Math.round((completed / tasks.length) * 100);
  const circumference = 251.2;
  const strokeOffset = circumference - (circumference * completionPercent) / 100;
  donutStroke.style.strokeDashoffset = String(strokeOffset);
  donutPercent.textContent = `${completionPercent}%`;
  progressText.textContent = tasks.length === 0
    ? "No tasks yet"
    : `${completed} of ${tasks.length} completed`;

  // Update Priority Breakdown Stacked Bar & Chips
  const highCount = tasks.filter((t) => t.priority === "high").length;
  const medCount = tasks.filter((t) => t.priority === "medium").length;
  const lowCount = tasks.filter((t) => t.priority === "low").length;
  const total = tasks.length || 1;

  countHigh.textContent = String(highCount);
  countMed.textContent = String(medCount);
  countLow.textContent = String(lowCount);
  priorityBreakdownText.textContent = `${highCount} High • ${medCount} Med • ${lowCount} Low`;

  distHigh.style.width = tasks.length ? `${(highCount / total) * 100}%` : "0%";
  distMed.style.width = tasks.length ? `${(medCount / total) * 100}%` : "0%";
  distLow.style.width = tasks.length ? `${(lowCount / total) * 100}%` : "0%";

  // Update Urgency Badges (Overdue & Due Today)
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  const todayStr = `${year}-${month}-${day}`;

  const overdueCount = tasks.filter((t) => !t.completed && t.dueDate && t.dueDate < todayStr).length;
  const dueTodayCount = tasks.filter((t) => !t.completed && t.dueDate && t.dueDate === todayStr).length;

  urgentBadgeContainer.replaceChildren();
  if (overdueCount > 0) {
    const overdueBadge = document.createElement("span");
    overdueBadge.className = "urgent-badge urgent-overdue";
    overdueBadge.textContent = `⚠️ ${overdueCount} Overdue`;
    urgentBadgeContainer.appendChild(overdueBadge);
  }
  if (dueTodayCount > 0) {
    const todayBadge = document.createElement("span");
    todayBadge.className = "urgent-badge urgent-today";
    todayBadge.textContent = `⏳ ${dueTodayCount} Due Today`;
    urgentBadgeContainer.appendChild(todayBadge);
  }

  // Update List Summary and Clear Completed Button
  if (visibleTasks.length === tasks.length) {
    listSummary.textContent = `${tasks.length} ${tasks.length === 1 ? "task" : "tasks"}`;
  } else {
    listSummary.textContent = `Showing ${visibleTasks.length} of ${tasks.length} tasks`;
  }
  clearCompletedButton.disabled = completed === 0;

  // Render Task Items
  taskList.replaceChildren();
  visibleTasks.forEach((task) => taskList.appendChild(makeTaskElement(task)));

  const hasVisibleTasks = visibleTasks.length > 0;
  emptyState.hidden = hasVisibleTasks;
  taskList.hidden = !hasVisibleTasks;

  if (!hasVisibleTasks) {
    if (tasks.length === 0) {
      emptyTitle.textContent = "Nothing on your list yet";
      emptyDescription.textContent = "Add your first task above or load sample tasks to get started.";
      resetFiltersBtn.hidden = true;
      emptySampleBtn.hidden = false;
    } else if (searchQuery) {
      emptyTitle.textContent = "No matching tasks found";
      emptyDescription.textContent = `No tasks matched your search "${searchQuery}".`;
      resetFiltersBtn.hidden = false;
      emptySampleBtn.hidden = true;
    } else if (activeStatusFilter !== "all" || activePriorityFilter !== "all") {
      emptyTitle.textContent = "No tasks match your filters";
      emptyDescription.textContent = "Try adjusting your status or priority filter to view other tasks.";
      resetFiltersBtn.hidden = false;
      emptySampleBtn.hidden = true;
    } else {
      emptyTitle.textContent = "No tasks to display";
      emptyDescription.textContent = "Add a task above to get started.";
      resetFiltersBtn.hidden = true;
      emptySampleBtn.hidden = true;
    }
  }
}

// Event Listeners
taskForm.addEventListener("submit", (event) => {
  event.preventDefault();
  addTask(taskInput.value, taskPriority.value, taskDueDate.value);
});

taskInput.addEventListener("input", () => {
  if (taskInput.value.trim()) showMessage("");
});

taskSearch.addEventListener("input", () => {
  searchQuery = taskSearch.value.trim();
  clearSearchBtn.hidden = !taskSearch.value;
  render();
});

clearSearchBtn.addEventListener("click", () => {
  taskSearch.value = "";
  searchQuery = "";
  clearSearchBtn.hidden = true;
  taskSearch.focus();
  render();
});

taskFilter.addEventListener("change", () => {
  activeStatusFilter = taskFilter.value;
  render();
});

priorityFilter.addEventListener("change", () => {
  activePriorityFilter = priorityFilter.value;
  render();
});

sortSelect.addEventListener("change", () => {
  activeSortOrder = sortSelect.value;
  render();
});

resetFiltersBtn.addEventListener("click", resetAllFilters);
loadSampleBtn.addEventListener("click", loadSampleTasks);
emptySampleBtn.addEventListener("click", loadSampleTasks);
clearCompletedButton.addEventListener("click", clearCompletedTasks);
exportBtn.addEventListener("click", exportTasks);
importInput.addEventListener("change", importTasks);

// Initial Render
render();


