// ============================================================
// Helpers
// ============================================================
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function showToast(message, isError = false) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.toggle("is-error", isError);
  toast.classList.add("is-visible");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.remove("is-visible"), 3200);
}

function setError(scope, message) {
  const el = $(`[data-error-for="${scope}"]`);
  if (el) el.textContent = message || "";
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

// ============================================================
// View routing (auth screen <-> app screen, and panels within app)
// ============================================================
function hideBootLoader() {
  $("#boot-loader")?.classList.add("hidden");
}

function showAuthScreen() {
  $("#view-auth").classList.remove("hidden");
  $("#view-app").classList.remove("is-active");
  hideBootLoader();
}

function showAppScreen() {
  $("#view-auth").classList.add("hidden");
  $("#view-app").classList.add("is-active");
  const user = Auth.getUser();
  $("#user-name").textContent = user?.name || "athlete";
  $("#rail-admin-btn").classList.toggle("hidden", user?.role !== "admin");
  hideBootLoader();
}

function switchPanel(name) {
  $$(".panel").forEach((p) => p.classList.toggle("is-active", p.dataset.panel === name));
  $$(".rail-btn[data-view]").forEach((b) => b.classList.toggle("is-active", b.dataset.view === name));

  if (name === "overview") loadOverview();
  if (name === "workouts") loadWorkouts();
  if (name === "planner") loadPlanner();
  if (name === "food") loadFoods();
  if (name === "metrics") loadMetrics();
  if (name === "water") loadWater();
  if (name === "feedback") loadMyFeedback();
  if (name === "admin") loadAdmin();
  if (name === "premium") loadPremium();
}

// ============================================================
// Auth
// ============================================================
function initAuthTabs() {
  $$(".auth-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      $$(".auth-tab").forEach((t) => t.classList.remove("is-active"));
      $$(".auth-form").forEach((f) => f.classList.remove("is-active"));
      tab.classList.add("is-active");
      $(`#form-${tab.dataset.tab}`).classList.add("is-active");
    });
  });
}

async function handleLogin(e) {
  e.preventDefault();
  setError("login", "");
  const form = e.target;
  const email = form.email.value.trim();
  const password = form.password.value;
  const btn = form.querySelector("button");

  btn.disabled = true;
  try {
    const res = await Api.login(email, password);
    Auth.setSession(res.data.token, res.data.user);
    form.reset();
    enterApp();
  } catch (err) {
    setError("login", err.message);
  } finally {
    btn.disabled = false;
  }
}

async function handleRegister(e) {
  e.preventDefault();
  setError("register", "");
  $("#register-login-hint").classList.add("hidden");
  const form = e.target;
  const name = form.name.value.trim();
  const email = form.email.value.trim();
  const password = form.password.value;
  const btn = form.querySelector("button");

  btn.disabled = true;
  try {
    const res = await Api.register(name, email, password);
    Auth.setSession(res.data.token, res.data.user);
    form.reset();
    enterApp();
  } catch (err) {
    setError("register", err.message);
    if (/already exists/i.test(err.message)) {
      $("#register-login-hint").classList.remove("hidden");
      pendingLoginEmail = email;
    }
  } finally {
    btn.disabled = false;
  }
}

let pendingLoginEmail = "";

function gotoLoginTab(prefillEmail = "") {
  $$(".auth-tab").forEach((t) => t.classList.toggle("is-active", t.dataset.tab === "login"));
  $$(".auth-form").forEach((f) => f.classList.toggle("is-active", f.id === "form-login"));
  if (prefillEmail) $('#form-login input[name="email"]').value = prefillEmail;
  $('#form-login input[name="password"]').focus();
}

function handleLogout() {
  Auth.clearSession();
  showAuthScreen();
  showToast("Logged out");
}

function enterApp() {
  showAppScreen();
  switchPanel("overview");
}

// ============================================================
// Overview
// ============================================================
async function loadOverview() {
  const list = $("#recent-list");
  list.innerHTML = `<p class="empty-note">Loading…</p>`;

  try {
    const res = await Api.getWorkouts();
    const workouts = res.data.workouts;

    const total = workouts.length;
    const avgDuration = total
      ? Math.round(workouts.reduce((s, w) => s + w.duration, 0) / total)
      : 0;
    const totalCalories = workouts.reduce((s, w) => s + w.caloriesBurned, 0);

    $("#stat-total").textContent = total;
    $("#stat-duration").textContent = avgDuration;
    $("#stat-calories").textContent = totalCalories;

    renderWorkoutRows(list, workouts.slice(0, 5), { compact: true });
  } catch (err) {
    list.innerHTML = `<p class="empty-note">${err.message}</p>`;
  }
}

// ============================================================
// Workouts panel
// ============================================================
let currentWorkouts = [];

async function loadWorkouts() {
  const list = $("#workout-list");
  list.innerHTML = `<p class="empty-note">Loading…</p>`;
  try {
    const res = await Api.getWorkouts();
    currentWorkouts = res.data.workouts;
    renderWorkoutRows(list, currentWorkouts);
  } catch (err) {
    list.innerHTML = `<p class="empty-note">${err.message}</p>`;
  }
}

function renderWorkoutRows(container, workouts, { compact = false } = {}) {
  if (!workouts.length) {
    container.innerHTML = `<p class="empty-note">Nothing logged yet. Add your first workout.</p>`;
    return;
  }

  container.innerHTML = workouts
    .map(
      (w) => `
    <div class="log-row" data-id="${w._id}">
      <div>
        <div class="lname">${escapeHtml(w.workoutName)}</div>
        <span class="lcat">${escapeHtml(w.category)}</span>
      </div>
      <div class="lmeta">${w.duration} min</div>
      <div class="lmeta">${w.caloriesBurned} kcal</div>
      <div class="lmeta">${formatDate(w.workoutDate)}</div>
      ${
        compact
          ? ""
          : `<div class="lactions">
              <button class="btn btn-ghost btn-sm" data-action="edit">Edit</button>
              <button class="btn btn-danger btn-sm" data-action="delete">Delete</button>
            </div>`
      }
    </div>`
    )
    .join("");

  if (!compact) {
    $$(".log-row", container).forEach((row) => {
      const id = row.dataset.id;
      row.querySelector('[data-action="edit"]')?.addEventListener("click", () => openWorkoutModal(id));
      row.querySelector('[data-action="delete"]')?.addEventListener("click", () => confirmDelete(id));
    });
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

async function handleSearch() {
  const list = $("#workout-list");
  list.innerHTML = `<p class="empty-note">Searching…</p>`;
  try {
    const res = await Api.searchWorkouts({
      name: $("#search-name").value.trim(),
      category: $("#search-category").value.trim(),
      date: $("#search-date").value,
    });
    currentWorkouts = res.data.workouts;
    renderWorkoutRows(list, currentWorkouts);
  } catch (err) {
    list.innerHTML = `<p class="empty-note">${err.message}</p>`;
  }
}

function clearSearch() {
  $("#search-name").value = "";
  $("#search-category").value = "";
  $("#search-date").value = "";
  loadWorkouts();
}

async function confirmDelete(id) {
  if (!confirm("Delete this workout? This can't be undone.")) return;
  try {
    await Api.deleteWorkout(id);
    showToast("Workout deleted");
    loadWorkouts();
  } catch (err) {
    showToast(err.message, true);
  }
}

// ---- Modal (add/edit workout) ----
function openWorkoutModal(id = null) {
  const form = $("#form-workout");
  form.reset();
  setError("workout", "");

  if (id) {
    const w = currentWorkouts.find((x) => x._id === id);
    $("#modal-title").textContent = "Edit workout";
    form.id.value = id;
    form.workoutName.value = w.workoutName;
    form.category.value = w.category;
    form.duration.value = w.duration;
    form.caloriesBurned.value = w.caloriesBurned;
    form.workoutDate.value = new Date(w.workoutDate).toISOString().slice(0, 10);
  } else {
    $("#modal-title").textContent = "Add workout";
    form.id.value = "";
    form.workoutDate.value = todayISO();
  }

  $("#modal-backdrop").classList.add("is-active");
}

function closeWorkoutModal() {
  $("#modal-backdrop").classList.remove("is-active");
}

async function handleWorkoutSubmit(e) {
  e.preventDefault();
  setError("workout", "");
  const form = e.target;
  const id = form.id.value;
  const btn = form.querySelector("button[type=submit]");

  const payload = {
    workoutName: form.workoutName.value.trim(),
    category: form.category.value.trim(),
    duration: Number(form.duration.value),
    caloriesBurned: Number(form.caloriesBurned.value),
    workoutDate: form.workoutDate.value,
  };

  btn.disabled = true;
  try {
    if (id) {
      await Api.updateWorkout(id, payload);
      showToast("Workout updated");
    } else {
      await Api.addWorkout(payload);
      showToast("Workout added");
    }
    closeWorkoutModal();
    loadWorkouts();
  } catch (err) {
    setError("workout", err.message);
  } finally {
    btn.disabled = false;
  }
}

const CATEGORY_ICON = { Cardio: "🏃", Strength: "🏋️", Flexibility: "🧘" };

function renderWorkoutTemplate() {
  const el = $("#workout-template");
  if (!el || typeof getCoreWorkoutTemplate !== "function") return;
  el.innerHTML = getCoreWorkoutTemplate()
    .map(
      (w) => `
      <div class="template-card">
        <span class="ticon">${CATEGORY_ICON[w.category] || "💪"}</span>
        <div class="ttime">${w.time}</div>
        <div class="tname">${escapeHtml(w.workoutName)}</div>
        <div class="tmeta">${w.duration} min · ${w.caloriesBurned} kcal</div>
      </div>`
    )
    .join("");
}

function renderMealTemplate() {
  const el = $("#meal-template");
  if (!el || typeof getCoreMealTemplate !== "function") return;
  el.innerHTML = getCoreMealTemplate()
    .map(
      (m) => `
      <div class="template-card">
        <span class="ticon">${m.icon}</span>
        <div class="ttime">${m.mealType}</div>
        <div class="tname">${escapeHtml(m.foodName)}</div>
        <div class="tmeta">${escapeHtml(m.quantity)} · ${m.calories} kcal</div>
      </div>`
    )
    .join("");
}

// ============================================================
// Planner (day-wise view of workouts)
// ============================================================
async function loadPlanner() {
  renderWorkoutTemplate();
  const container = $("#planner-list");
  container.innerHTML = `<p class="empty-note">Loading…</p>`;

  try {
    const res = await Api.getWorkouts();
    const workouts = res.data.workouts;

    if (!workouts.length) {
      container.innerHTML = `<p class="empty-note">Nothing logged yet. Add a workout to see it here by day.</p>`;
      return;
    }

    // Group workouts by calendar day (YYYY-MM-DD), most recent day first
    const groups = new Map();
    workouts.forEach((w) => {
      const key = new Date(w.workoutDate).toISOString().slice(0, 10);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(w);
    });

    const sortedKeys = Array.from(groups.keys()).sort((a, b) => (a < b ? 1 : -1));

    container.innerHTML = sortedKeys
      .map((key) => {
        const dayWorkouts = groups.get(key);
        const totalMinutes = dayWorkouts.reduce((s, w) => s + w.duration, 0);
        return `
        <div class="day-card">
          <div class="day-card-head">
            <span class="dtitle">${formatDate(key)}</span>
            <span class="day-count">${dayWorkouts.length} workout${dayWorkouts.length > 1 ? "s" : ""} · ${totalMinutes} min</span>
          </div>
          <div class="day-card-body">
            ${dayWorkouts
              .map(
                (w) => `
              <div class="day-item">
                <span>${escapeHtml(w.workoutName)}<span class="lcat">${escapeHtml(w.category)}</span></span>
                <span class="lmeta">${w.duration} min · ${w.caloriesBurned} kcal</span>
              </div>`
              )
              .join("")}
          </div>
        </div>`;
      })
      .join("");
  } catch (err) {
    container.innerHTML = `<p class="empty-note">${err.message}</p>`;
  }
}

// ============================================================
// Food log
// ============================================================
let currentFoods = [];

async function loadFoods() {
  renderMealTemplate();
  const list = $("#food-list");
  list.innerHTML = `<p class="empty-note">Loading…</p>`;
  try {
    const res = await Api.getFoods();
    currentFoods = res.data.foods;
    renderFoodRows(list, currentFoods);
  } catch (err) {
    list.innerHTML = `<p class="empty-note">${err.message}</p>`;
  }
}

function renderFoodRows(container, foods) {
  if (!foods.length) {
    container.innerHTML = `<p class="empty-note">Nothing logged yet. Add what you ate.</p>`;
    return;
  }

  container.innerHTML = foods
    .map(
      (f) => `
    <div class="log-row" data-id="${f._id}">
      <div>
        <div class="lname">${escapeHtml(f.foodName)}</div>
        <span class="lcat">${escapeHtml(f.mealType)}</span>
      </div>
      <div class="lmeta">${escapeHtml(f.quantity || "—")}</div>
      <div class="lmeta">${f.calories} kcal</div>
      <div class="lmeta">${formatDate(f.foodDate)}</div>
      <div class="lactions">
        <button class="btn btn-ghost btn-sm" data-action="edit">Edit</button>
        <button class="btn btn-danger btn-sm" data-action="delete">Delete</button>
      </div>
    </div>`
    )
    .join("");

  $$(".log-row", container).forEach((row) => {
    const id = row.dataset.id;
    row.querySelector('[data-action="edit"]')?.addEventListener("click", () => openFoodModal(id));
    row.querySelector('[data-action="delete"]')?.addEventListener("click", () => confirmDeleteFood(id));
  });
}

async function handleFoodSearch() {
  const list = $("#food-list");
  list.innerHTML = `<p class="empty-note">Searching…</p>`;
  try {
    const res = await Api.searchFoods({
      name: $("#food-search-name").value.trim(),
      mealType: $("#food-search-meal").value,
      date: $("#food-search-date").value,
    });
    currentFoods = res.data.foods;
    renderFoodRows(list, currentFoods);
  } catch (err) {
    list.innerHTML = `<p class="empty-note">${err.message}</p>`;
  }
}

function clearFoodSearch() {
  $("#food-search-name").value = "";
  $("#food-search-meal").value = "";
  $("#food-search-date").value = "";
  loadFoods();
}

async function confirmDeleteFood(id) {
  if (!confirm("Delete this food entry?")) return;
  try {
    await Api.deleteFood(id);
    showToast("Food entry deleted");
    loadFoods();
  } catch (err) {
    showToast(err.message, true);
  }
}

function openFoodModal(id = null) {
  const form = $("#form-food");
  form.reset();
  setError("food", "");

  if (id) {
    const f = currentFoods.find((x) => x._id === id);
    $("#food-modal-title").textContent = "Edit food entry";
    form.id.value = id;
    form.foodName.value = f.foodName;
    form.mealType.value = f.mealType;
    form.calories.value = f.calories;
    form.quantity.value = f.quantity || "";
    form.foodDate.value = new Date(f.foodDate).toISOString().slice(0, 10);
  } else {
    $("#food-modal-title").textContent = "Log food";
    form.id.value = "";
    form.foodDate.value = todayISO();
  }

  $("#food-modal-backdrop").classList.add("is-active");
}

function closeFoodModal() {
  $("#food-modal-backdrop").classList.remove("is-active");
}

async function handleFoodSubmit(e) {
  e.preventDefault();
  setError("food", "");
  const form = e.target;
  const id = form.id.value;
  const btn = form.querySelector("button[type=submit]");

  const payload = {
    foodName: form.foodName.value.trim(),
    mealType: form.mealType.value,
    quantity: form.quantity.value.trim(),
    calories: Number(form.calories.value),
    foodDate: form.foodDate.value,
  };

  btn.disabled = true;
  try {
    if (id) {
      await Api.updateFood(id, payload);
      showToast("Food entry updated");
    } else {
      await Api.addFood(payload);
      showToast("Food entry added");
    }
    closeFoodModal();
    loadFoods();
  } catch (err) {
    setError("food", err.message);
  } finally {
    btn.disabled = false;
  }
}

async function handleLoadWorkoutPlan() {
  const entries = buildWorkoutPlan();
  if (!confirm(`This adds ${entries.length} workouts across the next 30 days, starting today. Continue?`)) return;

  const btn = $("#btn-load-workout-plan");
  btn.disabled = true;
  btn.textContent = "Loading…";

  let done = 0;
  try {
    for (const e of entries) {
      await Api.addWorkout({
        workoutName: e.workoutName,
        category: e.category,
        duration: e.duration,
        caloriesBurned: e.caloriesBurned,
        workoutDate: e.workoutDate,
      });
      done++;
    }
    showToast(`Loaded ${done} workouts over 30 days`);
    loadWorkouts();
  } catch (err) {
    showToast(`Stopped after ${done} entries: ${err.message}`, true);
  } finally {
    btn.disabled = false;
    btn.textContent = "Load 30-day plan";
  }
}

async function handleLoadFoodPlan() {
  const entries = buildFoodPlan();
  if (!confirm(`This adds ${entries.length} food entries across the next 30 days, starting today. Continue?`)) return;

  const btn = $("#btn-load-food-plan");
  btn.disabled = true;
  btn.textContent = "Loading…";

  let done = 0;
  try {
    for (const e of entries) {
      await Api.addFood({
        foodName: e.foodName,
        mealType: e.mealType,
        quantity: e.quantity,
        calories: e.calories,
        foodDate: e.foodDate,
      });
      done++;
    }
    showToast(`Loaded ${done} food entries over 30 days`);
    loadFoods();
  } catch (err) {
    showToast(`Stopped after ${done} entries: ${err.message}`, true);
  } finally {
    btn.disabled = false;
    btn.textContent = "Load 30-day plan";
  }
}

// ============================================================
// AI Coach (recommendation)
// ============================================================
async function handleCoachSubmit(e) {
  e.preventDefault();
  setError("coach", "");
  const form = e.target;
  const resultBox = $("#coach-result");
  const loading = $("#coach-loading");
  resultBox.innerHTML = "";

  const payload = {
    age: Number(form.age.value),
    fitnessGoal: form.fitnessGoal.value,
    experienceLevel: form.experienceLevel.value,
  };

  loading.classList.remove("hidden");
  try {
    const res = await Api.getRecommendation(payload);
    resultBox.innerHTML = renderRecommendation(res.data.recommendation);
  } catch (err) {
    setError("coach", err.message);
  } finally {
    loading.classList.add("hidden");
  }
}

function renderRecommendation(rec) {
  if (!rec || rec.raw) {
    return `<div class="ai-block"><p class="ai-raw">${escapeHtml(rec?.raw || "No recommendation returned.")}</p></div>`;
  }

  const list = (title, items) =>
    items?.length
      ? `<div class="ai-block"><h4>${title}</h4><ul>${items.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</ul></div>`
      : "";

  return [
    list("Weekly plan", rec.weeklyPlan),
    list("Suggested exercises", rec.suggestedExercises),
    list("Training tips", rec.trainingTips),
    list("Safety recommendations", rec.safetyRecommendations),
    rec.motivationalMessage
      ? `<div class="ai-block"><h4>From your coach</h4><p>${escapeHtml(rec.motivationalMessage)}</p></div>`
      : "",
  ].join("");
}

// ============================================================
// AI Insights
// ============================================================
async function handleRunInsights() {
  setError("insights", "");
  const resultBox = $("#insights-result");
  const loading = $("#insights-loading");
  resultBox.innerHTML = "";
  loading.classList.remove("hidden");

  try {
    const res = await Api.getInsights();
    resultBox.innerHTML = renderInsights(res.data.insights);
  } catch (err) {
    setError("insights", err.message);
  } finally {
    loading.classList.add("hidden");
  }
}

function renderInsights(insights) {
  if (!insights || insights.raw) {
    return `<div class="ai-block"><p class="ai-raw">${escapeHtml(insights?.raw || "No insights returned.")}</p></div>`;
  }

  const blocks = [];
  if (insights.performanceAnalysis) {
    blocks.push(`<div class="ai-block"><h4>Performance analysis</h4><p>${escapeHtml(insights.performanceAnalysis)}</p></div>`);
  }
  if (insights.improvementSuggestions?.length) {
    blocks.push(
      `<div class="ai-block"><h4>Improvement suggestions</h4><ul>${insights.improvementSuggestions
        .map((i) => `<li>${escapeHtml(i)}</li>`)
        .join("")}</ul></div>`
    );
  }
  if (insights.motivationalAdvice) {
    blocks.push(`<div class="ai-block"><h4>Motivational advice</h4><p>${escapeHtml(insights.motivationalAdvice)}</p></div>`);
  }
  if (insights.fitnessProgressSummary) {
    blocks.push(`<div class="ai-block"><h4>Progress summary</h4><p>${escapeHtml(insights.fitnessProgressSummary)}</p></div>`);
  }
  return blocks.join("");
}

// ============================================================
// Body Metrics
// ============================================================
function bmiInfo(weight, heightCm) {
  if (!weight || !heightCm) return null;
  const bmi = weight / Math.pow(heightCm / 100, 2);
  const label = bmi < 18.5 ? "Underweight" : bmi < 25 ? "Healthy" : bmi < 30 ? "Overweight" : "Obese";
  return { bmi: bmi.toFixed(1), label };
}

function renderMetricChart(container, metrics) {
  const pts = metrics.slice(0, 30).reverse();
  if (pts.length < 2) {
    container.innerHTML = `<p class="empty-note">Add at least 2 entries to see your trend.</p>`;
    return;
  }
  const w = 600, h = 140, pad = 12;
  const vals = pts.map((m) => m.weight);
  const min = Math.min(...vals), max = Math.max(...vals);
  const span = max - min || 1;
  const coords = pts.map((m, i) => {
    const x = pad + (i / (pts.length - 1)) * (w - pad * 2);
    const y = h - pad - ((m.weight - min) / span) * (h - pad * 2);
    return [x, y];
  });
  const line = coords.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const dots = coords.map(([x, y]) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3" />`).join("");
  container.innerHTML = `
    <svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="Weight trend">
      <polyline points="${line}" fill="none" stroke="currentColor" stroke-width="2" />
      ${dots}
    </svg>
    <div class="metric-chart-range"><span>${min} kg</span><span>${max} kg</span></div>`;
}

async function loadMetrics() {
  const list = $("#metric-list");
  const form = $("#form-metric");
  if (!form.metricDate.value) form.metricDate.value = todayISO();
  list.innerHTML = `<p class="empty-note">Loading…</p>`;
  try {
    const res = await Api.getMetrics();
    const metrics = res.data.metrics;
    // Remember the last-used height so the user doesn't retype it
    const lastHeight = (metrics.find((m) => m.height) || {}).height;
    if (lastHeight && !form.height.value) form.height.value = lastHeight;

    const latest = metrics[0];
    const first = metrics[metrics.length - 1];
    const summary = $("#metric-summary");
    if (latest) {
      const info = bmiInfo(latest.weight, latest.height || lastHeight);
      const change = metrics.length > 1 ? (latest.weight - first.weight).toFixed(1) : null;
      summary.innerHTML = `
        <div class="stat"><span class="stat-num">${latest.weight}</span><span class="stat-label">Current kg</span></div>
        <div class="stat"><span class="stat-num">${info ? info.bmi : "—"}</span><span class="stat-label">BMI ${info ? "· " + info.label : ""}</span></div>
        <div class="stat"><span class="stat-num">${change === null ? "—" : (change > 0 ? "+" : "") + change}</span><span class="stat-label">kg since first entry</span></div>`;
    } else {
      summary.innerHTML = "";
    }
    renderMetricChart($("#metric-chart"), metrics);

    if (!metrics.length) {
      list.innerHTML = `<p class="empty-note">No entries yet.</p>`;
      return;
    }
    list.innerHTML = metrics
      .map(
        (m) => `
      <div class="log-row" style="grid-template-columns: 1fr auto auto auto;">
        <div><div class="lname">${m.weight} kg</div>${m.note ? `<div class="lmeta">${escapeHtml(m.note)}</div>` : ""}</div>
        <div class="lmeta">${m.height ? m.height + " cm" : "—"}</div>
        <div class="lmeta">${formatDate(m.metricDate)}</div>
        <div class="lactions"><button class="btn" data-del-metric="${m._id}">Delete</button></div>
      </div>`
      )
      .join("");
    $$("[data-del-metric]", list).forEach((b) =>
      b.addEventListener("click", async () => {
        if (!confirm("Delete this entry?")) return;
        try {
          await Api.deleteMetric(b.dataset.delMetric);
          showToast("Entry deleted");
          loadMetrics();
        } catch (err) {
          showToast(err.message, true);
        }
      })
    );
  } catch (err) {
    list.innerHTML = `<p class="empty-note">${err.message}</p>`;
  }
}

async function handleMetricSubmit(e) {
  e.preventDefault();
  setError("metric", "");
  const form = e.target;
  const btn = form.querySelector("button[type=submit]");
  btn.disabled = true;
  try {
    await Api.addMetric({
      weight: Number(form.weight.value),
      height: form.height.value ? Number(form.height.value) : undefined,
      note: form.note.value.trim(),
      metricDate: form.metricDate.value,
    });
    form.weight.value = "";
    form.note.value = "";
    showToast("Entry added");
    loadMetrics();
  } catch (err) {
    setError("metric", err.message);
  } finally {
    btn.disabled = false;
  }
}

// ============================================================
// Water
// ============================================================
const WATER_GOAL_ML = 2500;

async function loadWater() {
  const list = $("#water-list");
  list.innerHTML = `<p class="empty-note">Loading…</p>`;
  try {
    const res = await Api.getWater();
    const entries = res.data.entries;
    const today = todayISO();
    const total = entries
      .filter((e) => String(e.waterDate).slice(0, 10) === today)
      .reduce((sum, e) => sum + e.amount, 0);
    $("#water-bar").style.width = Math.min(100, (total / WATER_GOAL_ML) * 100) + "%";
    $("#water-total").textContent = `${total} / ${WATER_GOAL_ML} ml` + (total >= WATER_GOAL_ML ? " — goal reached 🎉" : "");

    if (!entries.length) {
      list.innerHTML = `<p class="empty-note">Nothing logged yet.</p>`;
      return;
    }
    list.innerHTML = entries
      .slice(0, 20)
      .map(
        (e) => `
      <div class="log-row" style="grid-template-columns: 1fr auto auto;">
        <div class="lname">${e.amount} ml</div>
        <div class="lmeta">${formatDate(e.waterDate)}</div>
        <div class="lactions"><button class="btn" data-del-water="${e._id}">Delete</button></div>
      </div>`
      )
      .join("");
    $$("[data-del-water]", list).forEach((b) =>
      b.addEventListener("click", async () => {
        try {
          await Api.deleteWater(b.dataset.delWater);
          loadWater();
        } catch (err) {
          showToast(err.message, true);
        }
      })
    );
  } catch (err) {
    list.innerHTML = `<p class="empty-note">${err.message}</p>`;
  }
}

async function handleWaterAdd(e) {
  setError("water", "");
  const btn = e.currentTarget;
  btn.disabled = true;
  try {
    await Api.addWater(Number(btn.dataset.water), todayISO());
    loadWater();
  } catch (err) {
    setError("water", err.message);
  } finally {
    btn.disabled = false;
  }
}

// ============================================================
// Feedback
// ============================================================
async function loadMyFeedback() {
  const list = $("#feedback-list");
  list.innerHTML = `<p class="empty-note">Loading…</p>`;
  try {
    const res = await Api.getMyFeedback();
    renderFeedbackRows(list, res.data.feedback);
  } catch (err) {
    list.innerHTML = `<p class="empty-note">${err.message}</p>`;
  }
}

function renderFeedbackRows(container, items, { showUser = false } = {}) {
  if (!items.length) {
    container.innerHTML = `<p class="empty-note">No feedback yet.</p>`;
    return;
  }
  container.innerHTML = items
    .map(
      (f) => `
    <div class="log-row" style="grid-template-columns: 1fr auto auto;">
      <div>
        ${showUser ? `<div class="lname">${escapeHtml(f.user?.name || "Unknown")} <span class="lcat">${escapeHtml(f.user?.email || "")}</span></div>` : ""}
        <div class="${showUser ? "lmeta" : "lname"}">${escapeHtml(f.message)}</div>
      </div>
      <div class="lmeta">${f.rating ? "★".repeat(f.rating) + "☆".repeat(5 - f.rating) : "—"}</div>
      <div class="lmeta">${formatDate(f.createdAt)}</div>
    </div>`
    )
    .join("");
}

async function handleFeedbackSubmit(e) {
  e.preventDefault();
  setError("feedback", "");
  const form = e.target;
  const btn = form.querySelector("button[type=submit]");

  btn.disabled = true;
  try {
    await Api.submitFeedback(form.message.value.trim(), form.rating.value);
    form.reset();
    showToast("Thanks for the feedback!");
    loadMyFeedback();
  } catch (err) {
    setError("feedback", err.message);
  } finally {
    btn.disabled = false;
  }
}

// ============================================================
// Admin
// ============================================================
async function loadAdmin() {
  const usersList = $("#admin-users-list");
  const feedbackList = $("#admin-feedback-list");
  usersList.innerHTML = `<p class="empty-note">Loading…</p>`;
  feedbackList.innerHTML = `<p class="empty-note">Loading…</p>`;

  try {
    const [stats, users, feedback] = await Promise.all([
      Api.getAdminStats(),
      Api.getAdminUsers(),
      Api.getAllFeedback(),
    ]);

    $("#admin-stat-users").textContent = stats.data.totalUsers;
    $("#admin-stat-workouts").textContent = stats.data.totalWorkouts;
    $("#admin-stat-food").textContent = stats.data.totalFood;
    $("#admin-stat-feedback").textContent = stats.data.totalFeedback;

    if (!users.data.users.length) {
      usersList.innerHTML = `<p class="empty-note">No users yet.</p>`;
    } else {
      usersList.innerHTML = users.data.users
        .map(
          (u) => `
        <div class="log-row" style="grid-template-columns: 1fr auto auto;">
          <div>
            <div class="lname">${escapeHtml(u.name)}</div>
            <span class="lcat">${u.role}</span>
          </div>
          <div class="lmeta">${escapeHtml(u.email)}</div>
          <div class="lmeta">${formatDate(u.createdAt)}</div>
        </div>`
        )
        .join("");
    }

    renderFeedbackRows(feedbackList, feedback.data.feedback, { showUser: true });
  } catch (err) {
    usersList.innerHTML = `<p class="empty-note">${err.message}</p>`;
    feedbackList.innerHTML = "";
  }
}

// ============================================================
// Premium (payments)
// ============================================================
async function loadPremium() {
  const user = Auth.getUser();
  $("#premium-status").innerHTML = user?.isPremium
    ? `★ Premium <span>— ${escapeHtml(user.premiumPlan || "")} plan</span>`
    : "Free plan";

  const list = $("#payment-list");
  list.innerHTML = `<p class="empty-note">Loading…</p>`;
  try {
    const res = await Api.getMyPayments();
    renderPaymentRows(list, res.data.payments);
  } catch (err) {
    list.innerHTML = `<p class="empty-note">${err.message}</p>`;
  }
}

function renderPaymentRows(container, payments) {
  if (!payments.length) {
    container.innerHTML = `<p class="empty-note">No payments yet.</p>`;
    return;
  }
  container.innerHTML = payments
    .map(
      (p) => `
    <div class="log-row" style="grid-template-columns: 1fr auto auto auto;">
      <div class="lname">${p.plan === "yearly" ? "Yearly plan" : "Monthly plan"}</div>
      <div class="lmeta">₹${(p.amount / 100).toFixed(2)}</div>
      <span class="lcat">${p.status}</span>
      <div class="lmeta">${formatDate(p.createdAt)}</div>
    </div>`
    )
    .join("");
}

async function handleUpgradeClick(e) {
  const btn = e.currentTarget;
  const plan = btn.dataset.plan;
  setError("premium", "");
  const originalLabel = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Redirecting…";

  try {
    const returnUrl = window.location.origin + window.location.pathname;
    const res = await Api.createCheckoutSession(plan, returnUrl);
    window.location.href = res.data.url; // hand off to Stripe Checkout
  } catch (err) {
    setError("premium", err.message);
    btn.disabled = false;
    btn.textContent = originalLabel;
  }
}

/**
 * Runs once on load. If we're arriving back from Stripe Checkout
 * (?payment=success&session_id=... or ?payment=cancelled), handle it and
 * clean the URL before the app renders normally.
 */
async function handlePaymentReturn() {
  const params = new URLSearchParams(window.location.search);
  const payment = params.get("payment");
  if (!payment) return;

  if (payment === "success") {
    const sessionId = params.get("session_id");
    if (sessionId && Auth.isLoggedIn()) {
      try {
        const res = await Api.verifyPayment(sessionId);
        if (res.data.user) Auth.setSession(Auth.getToken(), res.data.user);
        showToast(res.data.payment?.status === "paid" ? "Payment confirmed — welcome to Premium!" : "Payment was not completed");
      } catch (err) {
        showToast(err.message, true);
      }
    }
  } else if (payment === "cancelled") {
    showToast("Payment cancelled", true);
  }

  window.history.replaceState({}, document.title, window.location.pathname);
}

// ============================================================
// AI Chat
// ============================================================
let chatHistory = []; // [{ role: "user"|"assistant", content }]

function appendChatBubble(text, who) {
  const window_ = $("#chat-window");
  const bubble = document.createElement("div");
  bubble.className = `chat-bubble ${who}`;
  bubble.textContent = text;
  window_.appendChild(bubble);
  window_.scrollTop = window_.scrollHeight;
  return bubble;
}

async function handleChatSubmit(e) {
  e.preventDefault();
  setError("chat", "");
  const input = $("#chat-input");
  const message = input.value.trim();
  if (!message) return;

  input.value = "";
  appendChatBubble(message, "user");
  chatHistory.push({ role: "user", content: message });

  const typingBubble = appendChatBubble("Thinking…", "bot typing");

  try {
    const res = await Api.chat(message, chatHistory);
    typingBubble.remove();
    appendChatBubble(res.data.reply, "bot");
    chatHistory.push({ role: "assistant", content: res.data.reply });
  } catch (err) {
    typingBubble.remove();
    setError("chat", err.message);
  }
}

// ============================================================
// Init
// ============================================================
async function init() {
  initAuthTabs();

  $("#form-login").addEventListener("submit", handleLogin);
  $("#form-register").addEventListener("submit", handleRegister);
  $("#btn-logout").addEventListener("click", handleLogout);

  $$(".rail-btn[data-view]").forEach((btn) =>
    btn.addEventListener("click", () => switchPanel(btn.dataset.view))
  );

  $("#btn-new-workout").addEventListener("click", () => openWorkoutModal());
  $("#modal-close").addEventListener("click", closeWorkoutModal);
  $("#modal-backdrop").addEventListener("click", (e) => {
    if (e.target.id === "modal-backdrop") closeWorkoutModal();
  });
  $("#form-workout").addEventListener("submit", handleWorkoutSubmit);

  $("#btn-search").addEventListener("click", handleSearch);
  $("#btn-clear-search").addEventListener("click", clearSearch);
  $("#btn-load-workout-plan").addEventListener("click", handleLoadWorkoutPlan);

  $("#link-goto-login").addEventListener("click", (e) => {
    e.preventDefault();
    gotoLoginTab(pendingLoginEmail);
  });

  $("#btn-new-food").addEventListener("click", () => openFoodModal());
  $("#food-modal-close").addEventListener("click", closeFoodModal);
  $("#food-modal-backdrop").addEventListener("click", (e) => {
    if (e.target.id === "food-modal-backdrop") closeFoodModal();
  });
  $("#form-food").addEventListener("submit", handleFoodSubmit);
  $("#btn-food-search").addEventListener("click", handleFoodSearch);
  $("#btn-food-clear-search").addEventListener("click", clearFoodSearch);
  $("#btn-load-food-plan").addEventListener("click", handleLoadFoodPlan);

  $("#form-coach").addEventListener("submit", handleCoachSubmit);
  $("#btn-run-insights").addEventListener("click", handleRunInsights);
  $("#form-chat").addEventListener("submit", handleChatSubmit);
  $("#form-feedback").addEventListener("submit", handleFeedbackSubmit);
  $("#form-metric").addEventListener("submit", handleMetricSubmit);
  $$("[data-water]").forEach((btn) => btn.addEventListener("click", handleWaterAdd));
  $$("[data-plan]").forEach((btn) => btn.addEventListener("click", handleUpgradeClick));

  await handlePaymentReturn();

  if (Auth.isLoggedIn()) {
    validateSession();
  } else {
    showAuthScreen();
  }
}

/**
 * A token can exist in localStorage but no longer be valid (server restarted
 * with a different secret, token expired, etc). Confirm it works before
 * trusting it and jumping straight to the app.
 */
async function validateSession() {
  try {
    const res = await Api.getProfile();
    Auth.setSession(Auth.getToken(), res.data.user);
    enterApp();
  } catch (err) {
    Auth.clearSession();
    showAuthScreen();
    setError("login", "Your session expired. Please log in again.");
  }
}

// If any request anywhere in the app comes back 401, snap back to login
// instead of leaving broken panels behind.
window.addEventListener("fittrack:unauthorized", () => {
  if (!Auth.isLoggedIn()) {
    showAuthScreen();
    setError("login", "Your session expired. Please log in again.");
  }
});

document.addEventListener("DOMContentLoaded", init);
