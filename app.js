"use strict";

(() => {
  const Data = window.FitNaijaData;
  const Store = window.FitNaijaStorage;
  const Generator = window.FitNaijaGenerator;
  const Analytics = window.KarfivoAnalytics;
  const $ = selector => document.querySelector(selector);
  const $$ = selector => Array.from(document.querySelectorAll(selector));
  const today = () => localDateKey(new Date());
  let state;
  let timerId = null;
  let restTimerId = null;
  let restRemaining = 60;
  let activeSessionId = null;
  let calendarMode = "week";
  let editingRoutineId = null;
  let routineDraftExercises = [];
  let editingScheduleId = null;

  function initialize() {
    try {
      state = Store.load();
    } catch (error) {
      state = Store.defaultState();
      showStorageError(error.message);
    }
    bindNavigation();
    setupProfile();
    bindWorkoutLogger();
    bindExerciseLibrary();
    bindCalendar();
    bindProgress();
    bindCheckinsAndPrivacy();
    bindFoodPlanner();
    bindTheme();
    renderAll();
    restoreDraft();
    scheduleReminder();
  }

  function bindNavigation() {
    window.addEventListener("hashchange", showRoute);
    $$("[data-nav]").forEach(link => link.addEventListener("click", () => setTimeout(showRoute, 0)));
    showRoute();
  }

  function showRoute() {
    const requested = location.hash.replace("#", "") || "home";
    const page = $(`[data-view="${CSS.escape(requested)}"]`) || $('[data-view="home"]');
    $$(".page-view").forEach(view => view.classList.toggle("active", view === page));
    $$("[data-nav]").forEach(link => link.classList.toggle("active", link.dataset.nav === page.dataset.view));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function bindTheme() {
    $("#theme-toggle").addEventListener("click", () => {
      state.settings.theme = state.settings.theme === "dark" ? "light" : "dark";
      applyTheme();
      persist();
    });
    applyTheme();
  }

  function applyTheme() {
    document.documentElement.dataset.theme = state.settings.theme;
    const themeToggle = $("#theme-toggle");
    const nextTheme = state.settings.theme === "dark" ? "light" : "dark";
    themeToggle.setAttribute("aria-label", `Switch to ${nextTheme} mode`);
    themeToggle.title = `Switch to ${nextTheme} mode`;
    themeToggle.querySelector("use").setAttribute("href", state.settings.theme === "dark" ? "#icon-sun" : "#icon-moon");
  }

  function setupProfile() {
    const form = $("#profile-form");
    const profile = state.profile;
    form.elements.name.value = profile.name;
    form.elements.experience.value = profile.experience;
    form.elements.duration.value = profile.duration;
    form.elements.units.value = state.settings.units;
    $("#duration-label").textContent = `${profile.duration} min`;
    renderChoiceGroup("#interest-options", Data.interests, profile.interests, "interests");
    renderChoiceGroup("#equipment-options", Data.equipment, profile.equipment, "equipment");
    renderChoiceGroup("#day-options", Data.days, profile.days, "days", true);
    renderChoiceGroup("#exclusion-options", allExercises(), profile.excluded, "excluded", false, true);
    form.elements.duration.addEventListener("input", () => {
      $("#duration-label").textContent = `${form.elements.duration.value} min`;
    });
    form.addEventListener("submit", event => {
      event.preventDefault();
      const name = form.elements.name.value.trim();
      if (name.length > 40) return setStatus("#profile-status", "Name must be 40 characters or fewer.");
      const checked = group => $(`#${group}-options`).querySelectorAll("input:checked");
      const interests = Array.from(checked("interest"), input => input.value);
      const days = Array.from(checked("day"), input => input.value);
      if (!interests.length) return setStatus("#profile-status", "Choose at least one training interest.");
      if (!days.length) return setStatus("#profile-status", "Choose at least one day, or add a day when your schedule changes.");
      const previousUnits = state.settings.units;
      profile.name = name;
      profile.experience = form.elements.experience.value;
      profile.duration = Number(form.elements.duration.value);
      profile.interests = interests;
      profile.equipment = Array.from(checked("equipment"), input => input.value);
      profile.days = days;
      profile.excluded = Array.from(checked("exclusion"), input => input.value);
      state.settings.units = form.elements.units.value;
      if (previousUnits !== state.settings.units) {
        const factor = state.settings.units === "lb" ? 2.2046226218 : 1 / 2.2046226218;
        state.sessions.forEach(session => session.exercises.forEach(item => item.sets.forEach(set => {
          if (set.weight !== null && set.weight !== undefined) set.weight = Math.round(set.weight * factor * 100) / 100;
        })));
      }
      setStatus("#profile-status", persist() ? "Preferences saved on this device." : "Could not save preferences. Check browser storage settings.");
      renderAll();
    });
  }

  function renderChoiceGroup(selector, items, selected, property, days = false, exclusions = false) {
    const root = $(selector);
    root.replaceChildren();
    for (const item of items) {
      const value = days ? item.id : item.id;
      const labelText = days ? item.label : exclusions ? item.name : item.label;
      const label = document.createElement("label");
      label.className = days ? "day-choice" : "choice-chip";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.value = value;
      input.checked = selected.includes(value);
      input.name = property;
      const span = document.createElement("span");
      span.textContent = days ? item.short || labelText.slice(0, 1) : labelText;
      if (days) span.title = labelText;
      label.append(input, span);
      root.append(label);
    }
  }

  function bindWorkoutLogger() {
    $("#session-start").addEventListener("click", startOrResume);
    $("#session-pause").addEventListener("click", togglePause);
    $("#cancel-session").addEventListener("click", cancelSession);
    $("#session-name").addEventListener("input", () => {
      const session = getActiveDraft();
      if (session) { session.name = $("#session-name").value.slice(0, 60); persist(); }
    });
    $("#session-date").addEventListener("change", () => {
      const session = getActiveDraft();
      if (session && /^\d{4}-\d{2}-\d{2}$/.test($("#session-date").value)) {
        session.date = $("#session-date").value;
        persist();
        renderHome();
      }
    });
    $("#add-exercise-session").addEventListener("click", openExercisePicker);
    $("#finish-session").addEventListener("click", finishSession);
    $("#save-routine").addEventListener("click", () => saveCurrentRoutine($("#session-name").value.trim() || "My routine"));
    $("#routine-form").addEventListener("submit", event => {
      event.preventDefault();
      saveCurrentRoutine($("#routine-name").value.trim());
    });
    $("#new-routine").addEventListener("click", () => openRoutineEditor());
    $("#routine-editor-form").addEventListener("submit", saveRoutineEditor);
    $("#routine-add-exercise").addEventListener("click", addRoutineExercise);
    $("#routine-exercise-select").addEventListener("change", () => {
      $("#routine-add-exercise").disabled = !$("#routine-exercise-select").value;
    });
    $("#import-json").addEventListener("change", importJson);
    $("#generate-workout").addEventListener("click", generateAndPreview);
    $("#exercise-search").addEventListener("input", renderExercises);
    $("#exercise-type-filter").addEventListener("change", renderExercises);
    $("#exercise-equipment-filter").addEventListener("change", renderExercises);
    $("#exercise-level-filter").addEventListener("change", renderExercises);
    $("#open-custom-exercise").addEventListener("click", () => $("#custom-exercise-dialog").showModal());
    $("#custom-exercise-form").addEventListener("submit", createCustomExercise);
    $("#session-exercise-search").addEventListener("input", renderExercisePicker);
    $("#rest-duration").addEventListener("change", resetRestTimer);
    $("#rest-start").addEventListener("click", startRestTimer);
    $("#rest-reset").addEventListener("click", resetRestTimer);
    $$("[data-close-dialog]").forEach(button => button.addEventListener("click", () => button.closest("dialog").close()));
    document.addEventListener("click", event => {
      if (event.target instanceof HTMLDialogElement && event.target.open && event.target.id !== "session-exercise-dialog") event.target.close();
    });
    document.addEventListener("visibilitychange", refreshTimers);
    window.addEventListener("karfivo-storage-error", event => showStorageError(event.detail));
  }

  function startOrResume() {
    const session = getActiveDraft();
    if (!session) {
      const fresh = createSession({ name: $("#session-name").value.trim() || "My workout", focus: $("#generator-focus").value });
      activeSessionId = fresh.id;
      fresh.paused = false;
      fresh.startAt = new Date().toISOString();
      persist();
      setStatus("#session-status", "Session started. Your draft saves as you go.");
    } else if (session.paused) {
      session.paused = false;
      session.startAt = new Date().toISOString();
      persist();
      setStatus("#session-status", "Session resumed.");
    }
    startSessionClock();
    renderSession();
  }

  function createSession({ name, focus = "general", date = today(), exerciseIds = [], targetSets = {}, existingId = null }) {
    const session = {
      id: existingId || Store.makeId(), date, startAt: "", endAt: "", durationMinutes: 0, elapsedSeconds: 0,
      status: "draft", paused: true, name: name.slice(0, 60), focus, notes: "",
      exercises: exerciseIds.map(id => createSessionExercise(id, targetSets[id]))
    };
    state.sessions.push(session);
    activeSessionId = session.id;
    return session;
  }

  function createSessionExercise(exerciseId, targetCount = null) {
    const exercise = findExercise(exerciseId);
    const target = Math.max(1, Math.min(20, Number(targetCount) || (exercise?.type === "strength" ? 3 : 1)));
    return {
      exerciseId,
      notes: "",
      sets: Array.from({ length: target }, () => ({ reps: exercise?.type === "strength" ? 8 : null, weight: null, durationSeconds: exercise?.type === "strength" ? null : Math.max(60, (exercise?.duration || 5) * 60), distanceMeters: null, completed: false, restSeconds: 60 }))
    };
  }

  function getActiveDraft() {
    return activeSessionId ? state.sessions.find(session => session.id === activeSessionId && session.status === "draft") || null
      : state.sessions.find(session => session.status === "draft") || null;
  }

  function restoreDraft() {
    const draft = state.sessions.find(session => session.status === "draft");
    if (!draft) return;
    activeSessionId = draft.id;
    $("#session-name").value = draft.name;
    $("#session-date").value = draft.date;
    $("#session-notes").value = draft.notes;
    $("#session-start").textContent = draft.paused ? "Resume session" : "Continue session";
    renderSession();
    if (!draft.paused) startSessionClock();
    setStatus("#session-status", "Your saved draft is ready to continue.");
  }

  function startSessionClock() {
    if (timerId) clearInterval(timerId);
    timerId = setInterval(() => {
      const session = getActiveDraft();
      if (!session || session.paused) return;
      $("#session-clock").textContent = formatDuration(elapsedSeconds(session));
      if (Math.floor(elapsedSeconds(session)) % 15 === 0) persist();
    }, 1000);
  }

  function elapsedSeconds(session) {
    return session.elapsedSeconds + (session.paused || !session.startAt ? 0 : Math.max(0, (Date.now() - Date.parse(session.startAt)) / 1000));
  }

  function togglePause() {
    const session = getActiveDraft();
    if (!session) return;
    if (!session.paused) {
      session.elapsedSeconds = Math.round(elapsedSeconds(session));
      session.paused = true;
      session.startAt = "";
      if (timerId) clearInterval(timerId);
      $("#session-clock").textContent = formatDuration(session.elapsedSeconds);
      $("#session-pause").textContent = "Resume";
      $("#session-start").textContent = "Resume session";
      setStatus("#session-status", "Session paused. Your draft is saved.");
    } else {
      startOrResume();
      return;
    }
    persist();
    renderSession();
  }

  function cancelSession() {
    const session = getActiveDraft();
    if (!session) return;
    const editingHistory = !!session.originalCompleted;
    const message = editingHistory
      ? "Cancel editing and restore the original completed workout?"
      : "Cancel this workout and permanently discard its unfinished draft?";
    if (!window.confirm(message)) return;
    state.sessions = editingHistory
      ? state.sessions.map(item => item.id === session.id ? session.originalCompleted : item)
      : state.sessions.filter(item => item.id !== session.id);
    activeSessionId = null;
    if (timerId) clearInterval(timerId);
    timerId = null;
    persist();
    renderAll();
    setStatus("#session-status", "Unfinished workout cancelled.");
  }

  function moveSessionExercise(index, direction) {
    const session = getActiveDraft();
    const target = index + direction;
    if (!session || target < 0 || target >= session.exercises.length) return;
    [session.exercises[index], session.exercises[target]] = [session.exercises[target], session.exercises[index]];
    saveDraftAndRender();
  }

  function renderSession() {
    const session = getActiveDraft();
    const body = $("#session-exercises");
    body.replaceChildren();
    const active = !!session;
    $("#session-empty").classList.toggle("hidden", !!session?.exercises.length);
    $("#session-heading").textContent = session?.name || "Workout logger";
    $("#session-eyebrow").textContent = session ? "YOUR SESSION" : "QUICK TO START";
    $("#session-name").value = session?.name || $("#session-name").value || "My workout";
    $("#session-date").value = session?.date || $("#session-date").value || today();
    $("#session-notes").value = session?.notes || "";
    $("#session-start").disabled = !!session && !session.paused;
    $("#session-start").textContent = session ? session.paused ? "Resume session" : "In progress" : "Start session";
    $("#session-pause").disabled = !session;
    $("#session-pause").textContent = session?.paused ? "Resume" : "Pause";
    $("#finish-session").disabled = !session || !session.exercises.length;
    $("#save-routine").disabled = !session || !session.exercises.length;
    $("#cancel-session").disabled = !session;
    $("#cancel-session").textContent = session?.originalCompleted ? "Cancel edit" : "Cancel workout";
    $("#add-exercise-session").disabled = false;
    $("#draft-status").textContent = session ? session.paused ? "Draft saved" : "Session in progress" : "Ready when you are";
    $("#session-clock").textContent = session?.paused ? formatDuration(session.elapsedSeconds) : session ? $("#session-clock").textContent : "00:00";

    if (session) {
      session.exercises.forEach((item, exerciseIndex) => {
        const exercise = findExercise(item.exerciseId);
        if (!exercise) return;
        item.sets.forEach((set, setIndex) => {
          const row = document.createElement("tr");
          row.append(textCell(setIndex === 0 ? exercise.name : ""));
          row.append(textCell(String(setIndex + 1)));
          row.append(textCell(setIndex === 0 ? previousSetLabel(exercise.id) : "—"));
          row.append(numberInputCell(set, "reps", exercise.type === "strength" ? "reps" : "—", 0, 1000, exercise.type !== "strength", false, "", `${exercise.name}, set ${setIndex + 1}, reps`));
          row.append(numberInputCell(set, "weight", state.settings.units, 0, 5000, exercise.type !== "strength", false, "", `${exercise.name}, set ${setIndex + 1}, load in ${state.settings.units}`));
          row.append(numberInputCell(set, "durationSeconds", "min", 0, 1440, exercise.type === "strength", true, "", `${exercise.name}, set ${setIndex + 1}, duration in minutes`));
          row.append(numberInputCell(set, "distanceMeters", state.settings.units === "lb" ? "mi" : "km", 0, state.settings.units === "lb" ? 621 : 1000, exercise.type !== "cardio", false, state.settings.units, `${exercise.name}, set ${setIndex + 1}, distance`));
          const checkCell = document.createElement("td");
          const checkbox = document.createElement("input");
          checkbox.type = "checkbox";
          checkbox.className = "set-check";
          checkbox.checked = set.completed;
          checkbox.setAttribute("aria-label", `${exercise.name}, set ${setIndex + 1} complete`);
          checkbox.addEventListener("change", () => {
            set.completed = checkbox.checked;
            persist();
            if (checkbox.checked) startRestTimer();
            renderSession();
          });
          checkCell.append(checkbox);
          row.append(checkCell);
          const actionCell = document.createElement("td");
          const deleteSet = createButton("×", "remove-button", () => {
            item.sets.splice(setIndex, 1);
            saveDraftAndRender();
          }, `Delete set ${setIndex + 1} of ${exercise.name}`);
          actionCell.append(deleteSet);
          if (setIndex === 0) {
            actionCell.append(createButton("↑", "tiny-button", () => moveSessionExercise(exerciseIndex, -1), `Move ${exercise.name} up`));
            actionCell.append(createButton("↓", "tiny-button", () => moveSessionExercise(exerciseIndex, 1), `Move ${exercise.name} down`));
          }
          if (setIndex === item.sets.length - 1) {
            const add = createButton("+ set", "tiny-button", () => {
              item.sets.push({ reps: exercise.type === "strength" ? 8 : null, weight: null, durationSeconds: exercise.type === "strength" ? null : Math.max(60, (exercise.duration || 5) * 60), distanceMeters: null, completed: false, restSeconds: 60 });
              saveDraftAndRender();
            });
            add.setAttribute("aria-label", `Add set to ${exercise.name}`);
            actionCell.append(add);
            actionCell.append(createButton("×", "remove-button", () => removeSessionExercise(exerciseIndex), `Remove ${exercise.name}`));
          }
          row.append(actionCell);
          body.append(row);
        });
        const divider = document.createElement("tr");
        divider.className = "exercise-note-row";
        const noteCell = document.createElement("td");
        noteCell.colSpan = 9;
        const noteInput = document.createElement("input");
        noteInput.type = "text";
        noteInput.maxLength = 300;
        noteInput.placeholder = `${exercise.name} note or alternative: ${exercise.alternative || "choose a comfortable variation"}`;
        noteInput.value = item.notes;
        noteInput.setAttribute("aria-label", `${exercise.name} notes`);
        noteInput.addEventListener("input", () => { item.notes = noteInput.value; persist(); });
        noteCell.append(noteInput);
        divider.append(noteCell);
        body.append(divider);
      });
    }
    $("#session-notes").oninput = () => {
      const current = getActiveDraft();
      if (current) { current.notes = $("#session-notes").value; persist(); }
    };
  }

  function numberInputCell(set, property, placeholder, min, max, disabled = false, minutes = false, distanceUnit = "", ariaLabel = "") {
    const cell = document.createElement("td");
    const input = document.createElement("input");
    input.type = "number";
    input.min = String(min);
    input.max = String(max);
    input.step = property === "reps" ? "1" : "0.1";
    input.inputMode = "decimal";
    input.className = "set-number";
    input.placeholder = placeholder;
    input.value = minutes ? set.durationSeconds ? String(set.durationSeconds / 60) : ""
      : distanceUnit && set.distanceMeters ? String((set.distanceMeters / (distanceUnit === "lb" ? 1609.344 : 1000)).toFixed(1))
        : set[property] ?? "";
    input.disabled = disabled;
    input.setAttribute("aria-label", ariaLabel || placeholder);
    input.addEventListener("change", () => {
      const value = input.value === "" ? null : Number(input.value);
      if (value !== null && (!Number.isFinite(value) || value < min || value > max)) {
        input.setCustomValidity(`Enter a value between ${min} and ${max}.`);
        input.reportValidity();
        return;
      }
      input.setCustomValidity("");
      set[property] = minutes && value !== null ? Math.round(value * 60)
        : distanceUnit && value !== null ? Math.round(value * (distanceUnit === "lb" ? 1609.344 : 1000))
          : value;
      persist();
    });
    cell.append(input);
    return cell;
  }

  function previousSetLabel(exerciseId) {
    const values = state.sessions.filter(session => session.status === "completed").sort((a, b) => a.date.localeCompare(b.date)).flatMap(session =>
      session.exercises.filter(item => item.exerciseId === exerciseId).flatMap(item => item.sets.filter(set => set.completed))
    );
    const previous = values.at(-1);
    if (!previous) return "First time";
    if (previous.weight !== null && previous.weight > 0) return `${previous.weight} ${state.settings.units} × ${previous.reps ?? "—"}`;
    if (previous.durationSeconds) return `${formatDuration(previous.durationSeconds)}`;
    return previous.reps ? `${previous.reps} reps` : "Logged";
  }

  function saveDraftAndRender() {
    if (!persist()) setStatus("#session-status", "Draft couldn't save. Your changes are still visible until this page closes.");
    renderSession();
  }

  function removeSessionExercise(index) {
    const session = getActiveDraft();
    if (!session) return;
    session.exercises.splice(index, 1);
    saveDraftAndRender();
  }

  function addExerciseToSession(exerciseId) {
    let session = getActiveDraft();
    if (!session) {
      session = createSession({ name: $("#session-name").value.trim() || "My workout", focus: $("#generator-focus").value });
      $("#session-date").value = session.date;
    }
    if (session.exercises.some(item => item.exerciseId === exerciseId)) {
      const existing = session.exercises.find(item => item.exerciseId === exerciseId);
      existing.sets.push({ reps: 8, weight: null, durationSeconds: null, completed: false, restSeconds: 60 });
    } else {
      session.exercises.push(createSessionExercise(exerciseId));
    }
    persist();
    $("#session-exercise-dialog").close();
    renderSession();
    setStatus("#session-status", `${findExercise(exerciseId)?.name || "Exercise"} added to your session.`);
  }

  function openExercisePicker() {
    $("#session-exercise-search").value = "";
    renderExercisePicker();
    $("#session-exercise-dialog").showModal();
  }

  function renderExercisePicker() {
    const root = $("#session-exercise-options");
    const query = $("#session-exercise-search").value.trim().toLowerCase();
    root.replaceChildren();
    allExercises().filter(exercise => exercise.name.toLowerCase().includes(query) || exercise.muscles.join(" ").toLowerCase().includes(query))
      .forEach(exercise => {
        const button = createButton("", "exercise-option", () => addExerciseToSession(exercise.id));
        const title = document.createElement("strong");
        title.textContent = exercise.name;
        const detail = document.createElement("span");
        detail.textContent = `${exercise.type} · ${exercise.muscles.join(", ")}`;
        button.append(title, detail);
        root.append(button);
      });
    if (!root.childElementCount) root.append(emptyState("No exercises found. Try another search."));
  }

  function finishSession() {
    const session = getActiveDraft();
    if (!session) return;
    const completed = session.exercises.reduce((count, item) => count + item.sets.filter(set => set.completed).length, 0);
    if (!completed) {
      setStatus("#session-status", "Log at least one set before finishing. You can leave this as a draft.");
      return;
    }
    session.durationMinutes = Math.max(1, Math.round(elapsedSeconds(session) / 60));
    session.endAt = new Date().toISOString();
    session.status = "completed";
    session.paused = false;
    session.startAt = "";
    session.originalCompleted = null;
    if (timerId) clearInterval(timerId);
    activeSessionId = null;
    persist();
    setStatus("#session-status", "Workout saved. Nice work showing up.");
    renderSession();
    renderAll();
  }

  function generateAndPreview() {
    const focus = $("#generator-focus").value;
    if (!state.profile.interests.includes(focus) && focus !== "general") {
      setStatus("#generator-explanation", `Your profile doesn't currently include ${focus}. Update your interests in Profile or choose another focus.`);
      $("#generated-preview").replaceChildren();
      return;
    }
    const result = Generator.generateRoutine({ exercises: allExercises(), profile: state.profile, sessions: state.sessions, focus });
    $("#generator-explanation").textContent = result.explanation;
    const root = $("#generated-preview");
    root.replaceChildren();
    if (!result.exercises.length) return;
    const list = document.createElement("ol");
    list.className = "generated-list";
    result.exercises.forEach(exercise => {
      const item = document.createElement("li");
      item.textContent = exercise.name;
      list.append(item);
    });
    const start = createButton("Use this workout", "button button-primary full-width", () => {
      const active = getActiveDraft();
      if (active) {
        active.exercises = result.exercises.map(exercise => createSessionExercise(exercise.id));
        active.focus = focus;
        active.name = `${focus[0].toUpperCase()}${focus.slice(1)} session`;
        active.paused = true;
        $("#session-name").value = active.name;
      } else {
        createSession({ name: `${focus[0].toUpperCase()}${focus.slice(1)} session`, focus, exerciseIds: result.exercises.map(exercise => exercise.id) });
      }
      persist();
      renderSession();
      setStatus("#session-status", "Suggested plan loaded. Edit anything, then start when ready.");
      location.hash = "#workouts";
      $("#session-heading").scrollIntoView({ behavior: "smooth", block: "start" });
    });
    const save = createButton("Save suggestion as routine", "button button-soft full-width", () => {
      saveRoutine({ name: `${focus[0].toUpperCase()}${focus.slice(1)} plan`, focus, exerciseIds: result.exercises.map(exercise => exercise.id) });
      renderSavedRoutines();
    });
    root.append(list, document.createTextNode(`About ${result.durationMinutes} min · editable`), start, save);
  }

  function saveCurrentRoutine(name) {
    const session = getActiveDraft();
    if (!session?.exercises.length) {
      setStatus("#session-status", "Add an exercise before saving a routine.");
      return;
    }
    saveRoutine({ name, focus: session.focus, exerciseIds: session.exercises.map(item => item.exerciseId) });
    $("#routine-name").value = "";
    setStatus("#session-status", "Routine saved on this device.");
    renderSavedRoutines();
  }

  function saveRoutine({ name, focus, exerciseIds }) {
    const uniqueIds = [...new Set(exerciseIds)];
    const current = getActiveDraft();
    const targetSets = Object.fromEntries(uniqueIds.map(id => [id, current?.exercises.find(item => item.exerciseId === id)?.sets.length || (findExercise(id)?.type === "strength" ? 3 : 1)]));
    state.routines.push({ id: Store.makeId(), name: name.slice(0, 60), focus, exerciseIds: uniqueIds, targetSets, createdAt: new Date().toISOString() });
    persist();
    renderScheduleRoutineOptions();
    renderMilestones(state.sessions.filter(session => session.status === "completed"));
  }

  function openRoutineEditor(routine = null) {
    editingRoutineId = routine?.id || null;
    routineDraftExercises = routine ? routine.exerciseIds.map(id => ({ id, sets: routine.targetSets?.[id] || 3 })) : [];
    const form = $("#routine-editor-form");
    form.elements.name.value = routine?.name || "";
    form.elements.focus.value = routine?.focus || state.profile.interests[0] || "strength";
    $("#routine-editor-title").textContent = routine ? "Edit routine" : "New routine";
    const select = $("#routine-exercise-select");
    select.replaceChildren(new Option("Choose an exercise", ""));
    allExercises().forEach(exercise => select.add(new Option(exercise.name, exercise.id)));
    renderRoutineEditorExercises();
    $("#routine-editor-dialog").showModal();
  }

  function addRoutineExercise() {
    const id = $("#routine-exercise-select").value;
    const exercise = findExercise(id);
    if (!exercise || routineDraftExercises.some(item => item.id === id)) return;
    routineDraftExercises.push({ id, sets: exercise.type === "strength" ? 3 : 1 });
    $("#routine-exercise-select").value = "";
    $("#routine-add-exercise").disabled = true;
    renderRoutineEditorExercises();
  }

  function renderRoutineEditorExercises() {
    const root = $("#routine-editor-exercises");
    root.replaceChildren();
    routineDraftExercises.forEach((item, index) => {
      const row = document.createElement("div");
      row.className = "routine-editor-row";
      const name = document.createElement("strong");
      name.textContent = findExercise(item.id)?.name || "Unavailable exercise";
      const label = document.createElement("label");
      label.className = "routine-set-count";
      label.textContent = "Sets";
      const input = document.createElement("input");
      input.type = "number";
      input.min = "1";
      input.max = "20";
      input.value = String(item.sets);
      input.setAttribute("aria-label", `${name.textContent} target sets`);
      input.addEventListener("change", () => {
        item.sets = Math.max(1, Math.min(20, Math.floor(Number(input.value) || 1)));
        input.value = String(item.sets);
      });
      label.append(input);
      row.append(name, label, createButton("Remove", "tiny-button muted-button", () => {
        routineDraftExercises.splice(index, 1);
        renderRoutineEditorExercises();
      }));
      root.append(row);
    });
    if (!routineDraftExercises.length) root.append(emptyState("Add exercises to shape this routine."));
  }

  function saveRoutineEditor(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const name = form.elements.name.value.trim();
    if (!name || !routineDraftExercises.length) {
      setStatus("#routine-editor-status", "Add a name and at least one exercise.");
      return;
    }
    const routine = {
      id: editingRoutineId || Store.makeId(),
      name: name.slice(0, 60),
      focus: form.elements.focus.value,
      exerciseIds: routineDraftExercises.map(item => item.id),
      targetSets: Object.fromEntries(routineDraftExercises.map(item => [item.id, item.sets])),
      createdAt: state.routines.find(item => item.id === editingRoutineId)?.createdAt || new Date().toISOString()
    };
    if (editingRoutineId) state.routines = state.routines.map(item => item.id === editingRoutineId ? routine : item);
    else state.routines.push(routine);
    if (editingRoutineId) {
      state.schedule = state.schedule.map(item => item.routineId === editingRoutineId ? { ...item, title: routine.name } : item);
    }
    persist();
    renderSavedRoutines();
    renderScheduleRoutineOptions();
    $("#routine-editor-dialog").close();
  }

  function startRoutine(routine) {
    if (getActiveDraft()) {
      location.hash = "#workouts";
      setStatus("#session-status", "Finish, cancel, or keep your current draft before starting another routine.");
      return;
    }
    const session = createSession({
      name: routine.name, focus: routine.focus, exerciseIds: routine.exerciseIds, targetSets: routine.targetSets || {}
    });
    persist();
    renderSession();
    location.hash = "#workouts";
    setStatus("#session-status", "Routine loaded. Start when you’re ready.");
  }

  function renderSavedRoutines() {
    const root = $("#saved-routines");
    root.replaceChildren();
    if (!state.routines.length) {
      root.append(emptyState("Save a workout to keep a routine here."));
      return;
    }
    state.routines.slice().reverse().forEach(routine => {
      const row = document.createElement("div");
      row.className = "saved-routine";
      const info = document.createElement("div");
      const title = document.createElement("strong");
      title.textContent = routine.name;
      const detail = document.createElement("small");
      detail.textContent = `${routine.exerciseIds.length} exercises · ${routine.focus}`;
      info.append(title, detail);
      row.append(info,
        createButton("Start", "tiny-button", () => startRoutine(routine)),
        createButton("Edit", "tiny-button", () => openRoutineEditor(routine)),
        createButton("Duplicate", "tiny-button", () => {
          state.routines.push({ ...structuredClone(routine), id: Store.makeId(), name: `${routine.name} copy`, createdAt: new Date().toISOString() });
          persist();
          renderSavedRoutines();
          renderScheduleRoutineOptions();
        }),
        createButton("Delete", "tiny-button muted-button", () => {
          if (!window.confirm(`Delete the routine “${routine.name}”? Scheduled items will remain as workout entries.`)) return;
          state.routines = state.routines.filter(item => item.id !== routine.id);
          state.schedule = state.schedule.map(item => item.routineId === routine.id ? { ...item, routineId: "", title: routine.name } : item);
          persist();
          renderSavedRoutines();
          renderScheduleRoutineOptions();
          renderCalendar();
        }));
      root.append(row);
    });
  }

  function bindExerciseLibrary() {
    $("#exercise-equipment-filter").replaceChildren(new Option("Any equipment", "all"), new Option("Bodyweight", "bodyweight"));
    Data.equipment.forEach(item => $("#exercise-equipment-filter").add(new Option(item.label, item.id)));
    renderExercises();
  }

  function renderExercises() {
    const query = $("#exercise-search").value.trim().toLowerCase();
    const type = $("#exercise-type-filter").value;
    const equipment = $("#exercise-equipment-filter").value;
    const level = $("#exercise-level-filter").value;
    const results = allExercises().filter(exercise => {
      const searchable = [exercise.name, ...exercise.muscles, exercise.equipment.join(" "), exercise.instructions].join(" ").toLowerCase();
      return (!query || searchable.includes(query)) &&
        (type === "all" || exercise.type === type) &&
        (equipment === "all" || exercise.equipment.includes(equipment)) &&
        (level === "all" || exercise.level === level);
    });
    $("#exercise-result-count").textContent = `${results.length} ${results.length === 1 ? "exercise" : "exercises"}`;
    const root = $("#exercise-library");
    root.replaceChildren();
    if (!results.length) {
      root.append(emptyState("No matches yet. Adjust your filters or add a custom exercise."));
      return;
    }
    results.forEach(exercise => {
      const card = document.createElement("article");
      card.className = "exercise-card";
      const top = document.createElement("div");
      top.className = "exercise-card-top";
      top.append(tag(exercise.type), tag(exercise.level));
      if (exercise.custom) top.append(tag("custom"));
      const title = document.createElement("h3");
      title.textContent = exercise.name;
      const detail = document.createElement("p");
      detail.className = "exercise-meta";
      detail.textContent = `${exercise.muscles.join(" · ")}  /  ${exercise.equipment.map(equipmentLabel).join(", ")}`;
      const instructions = document.createElement("ol");
      instructions.className = "exercise-steps";
      exercise.steps.forEach(step => {
        const item = document.createElement("li");
        item.textContent = step;
        instructions.append(item);
      });
      const safety = document.createElement("p");
      safety.className = "exercise-safety";
      safety.textContent = `Form & safety: ${exercise.safety}`;
      const alt = document.createElement("p");
      alt.className = "exercise-alternative";
      alt.textContent = `Try instead: ${exercise.alternative || "adjust the range or use a comfortable variation"}`;
      const add = createButton("＋ Add to workout", "button button-soft", () => {
        addExerciseToSession(exercise.id);
        location.hash = "#workouts";
      });
      card.append(top, title, detail, instructions, safety, alt, add);
      root.append(card);
    });
  }

  function createCustomExercise(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const name = form.elements.name.value.trim();
    const instructions = form.elements.instructions.value.trim();
    if (!name || !instructions) return setStatus("#exercise-form-status", "Exercise name and instructions are required.");
    const equipmentText = form.elements.equipment.value.trim().toLowerCase();
    const equipment = equipmentText.includes("dumbbell") ? ["dumbbells"] :
      equipmentText.includes("barbell") ? ["barbell"] :
        equipmentText.includes("band") ? ["bands"] :
          equipmentText.includes("bench") ? ["bench"] :
            equipmentText.includes("kettlebell") ? ["kettlebell"] :
              equipmentText.includes("machine") ? ["cardio-machine"] : equipmentText ? ["other"] : ["bodyweight"];
    const exercise = {
      id: `custom-${Store.makeId().replaceAll("-", "")}`, name: name.slice(0, 60),
      type: form.elements.type.value, muscles: form.elements.muscles.value.split(",").map(value => value.trim()).filter(Boolean).slice(0, 6),
      equipment, level: form.elements.level.value, duration: 5, instructions: instructions.slice(0, 500),
      alternative: form.elements.alternative.value.trim().slice(0, 60),
      safety: form.elements.safety.value.trim().slice(0, 300) || "Use a stable setup and a comfortable range; stop if you feel pain, dizzy, or unwell.",
      focus: [form.elements.type.value, "general"], custom: true
    };
    state.exercises.push(exercise);
    const saved = persist();
    if (!saved) setStatus("#exercise-form-status", "Exercise added for this session, but could not be saved.");
    form.reset();
    $("#custom-exercise-dialog").close();
    renderExercises();
    renderChoiceGroup("#exclusion-options", allExercises(), state.profile.excluded, "excluded", false, true);
  }

  function allExercises() {
    const defaultSafety = "Use a stable setup, move within a comfortable range, and stop if you feel pain, dizzy, or unwell.";
    return [...Data.exercises, ...state.exercises].map(exercise => ({
      ...exercise,
      steps: exercise.steps || exercise.instructions.split(/(?:[.!?]\s+|;\s+)/).map(step => step.trim()).filter(Boolean),
      safety: exercise.safety || defaultSafety,
      alternatives: exercise.alternatives || [exercise.alternative]
    }));
  }

  function findExercise(id) {
    return allExercises().find(exercise => exercise.id === id);
  }

  function bindCalendar() {
    $("#calendar-prev").addEventListener("click", () => moveCalendar(calendarMode === "week" ? -7 : -1));
    $("#calendar-next").addEventListener("click", () => moveCalendar(calendarMode === "week" ? 7 : 1));
    $("#calendar-today").addEventListener("click", () => { calendarAnchor = new Date(); renderCalendar(); });
    $("#calendar-week-mode").addEventListener("click", () => { calendarMode = "week"; renderCalendar(); });
    $("#calendar-month-mode").addEventListener("click", () => { calendarMode = "month"; renderCalendar(); });
    $("#schedule-form").addEventListener("submit", saveScheduleItem);
    $("#schedule-delete").addEventListener("click", removeScheduleItem);
    renderScheduleRoutineOptions();
  }

  let calendarAnchor = new Date();

  function moveCalendar(days) {
    if (calendarMode === "month") {
      calendarAnchor = new Date(calendarAnchor.getFullYear(), calendarAnchor.getMonth() + days, 1, 12);
    } else {
      calendarAnchor.setDate(calendarAnchor.getDate() + days);
    }
    renderCalendar();
  }

  function renderScheduleRoutineOptions() {
    const select = $("#schedule-routine");
    if (!select) return;
    select.replaceChildren(new Option("Suggested workout", "recommended"));
    state.routines.forEach(routine => select.add(new Option(routine.name, routine.id)));
  }

  function renderCalendar() {
    const weekStart = new Date(calendarAnchor);
    weekStart.setHours(12, 0, 0, 0);
    weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
    let start = weekStart;
    let count = 7;
    if (calendarMode === "month") {
      start = new Date(calendarAnchor.getFullYear(), calendarAnchor.getMonth(), 1, 12);
      start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
      count = 42;
    }
    const dates = Array.from({ length: count }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return localDateKey(date);
    });
    const first = new Date(`${dates[0]}T12:00:00`);
    const last = new Date(`${dates[6]}T12:00:00`);
    $("#calendar-title").textContent = calendarMode === "month"
      ? new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(calendarAnchor)
      : `${new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(first)} – ${new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(last)}`;
    $("#calendar-grid").classList.toggle("month-mode", calendarMode === "month");
    $("#calendar-week-mode").classList.toggle("active", calendarMode === "week");
    $("#calendar-month-mode").classList.toggle("active", calendarMode === "month");
    $("#calendar-week-mode").setAttribute("aria-pressed", String(calendarMode === "week"));
    $("#calendar-month-mode").setAttribute("aria-pressed", String(calendarMode === "month"));
    const plans = Array.from({ length: count / 7 }, (_, week) => {
      const monday = new Date(start);
      monday.setDate(start.getDate() + week * 7);
      return Generator.buildWeeklyPlan({ days: state.profile.days, schedule: state.schedule, weekStart: monday });
    });
    const root = $("#calendar-grid");
    root.replaceChildren();
    dates.forEach((dateValue, index) => {
      const date = new Date(`${dateValue}T12:00:00`);
      const column = document.createElement("article");
      column.className = `calendar-day${dateValue === today() ? " today" : ""}`;
      const header = document.createElement("div");
      header.className = "calendar-day-heading";
      const dayName = document.createElement("span");
      dayName.textContent = Data.days[index % 7].label.slice(0, 3);
      const dayDate = document.createElement("strong");
      dayDate.textContent = String(date.getDate());
      header.append(dayName, dayDate);
      column.append(header);
      const scheduleItems = state.schedule.filter(item => item.date === dateValue);
      const sessions = state.sessions.filter(item => item.date === dateValue && item.status === "completed");
      const suggested = plans[Math.floor(index / 7)][index % 7];
      column.classList.toggle("outside-month", calendarMode === "month" && date.getMonth() !== calendarAnchor.getMonth());
      if (!scheduleItems.length && !sessions.length) {
        const suggestionLabel = document.createElement("div");
        suggestionLabel.className = `calendar-item ${suggested.kind === "rest" ? "rest" : ""}`;
        suggestionLabel.textContent = suggested.title;
        column.append(suggestionLabel);
      }
      scheduleItems.forEach(item => {
        const label = document.createElement("div");
        label.className = `calendar-item ${item.kind}`;
        label.textContent = item.kind === "rest" ? "Rest day" : item.title || routineName(item.routineId);
        column.append(label);
      });
      sessions.forEach(session => {
        const label = document.createElement("div");
        label.className = "calendar-item completed";
        label.textContent = `✓ ${session.name}`;
        column.append(label);
      });
      column.append(createButton("+ Plan", "plan-day-button", () => openScheduleDialog(dateValue)));
      if (scheduleItems.length) {
        const reschedule = createButton("Move / edit", "calendar-edit-button", () => openScheduleDialog(dateValue, scheduleItems[0]));
        column.append(reschedule);
      }
      root.append(column);
    });
    renderUpcoming();
  }

  function openScheduleDialog(date, item = null) {
    const form = $("#schedule-form");
    editingScheduleId = item?.id || null;
    form.elements.date.value = date;
    form.elements.kind.value = item?.kind || "workout";
    form.elements.routine.value = item?.routineId || "recommended";
    $("#schedule-heading").textContent = item ? "Reschedule this day" : `Plan ${formatDate(date, { weekday: "long", month: "short", day: "numeric" })}`;
    $("#schedule-delete").hidden = !item;
    $("#schedule-dialog").showModal();
  }

  function saveScheduleItem(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const date = form.elements.date.value;
    const kind = form.elements.kind.value;
    if (!validDateKey(date) || !["workout", "rest"].includes(kind)) return;
    const routineId = kind === "workout" ? form.elements.routine.value : "";
    if (routineId !== "recommended" && routineId && !state.routines.some(item => item.id === routineId)) return;
    state.schedule = state.schedule.filter(item => item.id !== editingScheduleId && item.date !== date);
    state.schedule.push({ id: editingScheduleId || Store.makeId(), date, kind, routineId, title: kind === "rest" ? "Rest day" : routineName(routineId) });
    editingScheduleId = null;
    persist();
    $("#schedule-dialog").close();
    renderCalendar();
    renderHome();
  }

  function removeScheduleItem() {
    if (!editingScheduleId || !window.confirm("Remove this scheduled plan? Completed workouts and saved routines will remain.")) return;
    state.schedule = state.schedule.filter(item => item.id !== editingScheduleId);
    editingScheduleId = null;
    persist();
    $("#schedule-dialog").close();
    renderCalendar();
    renderHome();
  }

  function validDateKey(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(value) && localDateKey(new Date(`${value}T12:00:00`)) === value;
  }

  function routineName(id) {
    return state.routines.find(routine => routine.id === id)?.name || (id === "recommended" ? "Suggested workout" : "Workout");
  }

  function renderUpcoming() {
    const root = $("#upcoming-sessions");
    root.replaceChildren();
    const upcoming = state.schedule.filter(item => item.date >= today()).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 7);
    if (!upcoming.length) root.append(emptyState("No plans yet. Choose a day above to add a workout or a rest day."));
    upcoming.forEach(item => {
      const row = document.createElement("div");
      row.className = "upcoming-row";
      const date = document.createElement("strong");
      date.textContent = formatDate(item.date, { weekday: "short", month: "short", day: "numeric" });
      const title = document.createElement("span");
      title.textContent = item.kind === "rest" ? "Rest and recover" : item.title;
      row.append(date, title);
      if (item.kind === "workout") {
        row.append(createButton("Start", "tiny-button", () => startScheduledWorkout(item)));
      }
      root.append(row);
    });
  }

  function startScheduledWorkout(item) {
    if (getActiveDraft()) {
      location.hash = "#workouts";
      setStatus("#session-status", "Finish or keep your current draft before loading another session.");
      return;
    }
    let routine = state.routines.find(entry => entry.id === item.routineId);
    if (item.routineId === "recommended" || !routine) {
      const focus = state.profile.interests[0] || "general";
      const suggested = Generator.generateRoutine({ exercises: allExercises(), profile: state.profile, sessions: state.sessions, focus });
      if (!suggested.exercises.length) {
        location.hash = "#workouts";
        setStatus("#session-status", suggested.explanation);
        return;
      }
      routine = { name: `${focus[0].toUpperCase()}${focus.slice(1)} session`, focus, exerciseIds: suggested.exercises.map(exercise => exercise.id) };
    }
    createSession({ name: routine.name, focus: routine.focus, exerciseIds: routine.exerciseIds });
    persist();
    renderSession();
    location.hash = "#workouts";
    setStatus("#session-status", "Scheduled workout loaded. Start whenever you’re ready.");
  }

  function bindProgress() {
    $("#progress-range").addEventListener("change", renderProgress);
    $("#progress-exercise").addEventListener("change", () => {
      const sessions = selectedSessions();
      renderProgression(sessions);
      renderExerciseHistory(sessions);
    });
  }

  function selectedSessions() {
    return Analytics.filterSessions(state.sessions, $("#progress-range").value, new Date());
  }

  function calculateStats(sessions) {
    return Analytics.calculateStats(sessions);
  }

  function renderProgress() {
    if (!$("#progress-range")) return;
    const sessions = selectedSessions();
    const stats = calculateStats(sessions);
    $("#progress-sessions").textContent = String(stats.sessions);
    $("#progress-minutes").textContent = `${stats.minutes} min`;
    $("#progress-days").textContent = String(stats.activeDays);
    $("#progress-sets").textContent = String(stats.sets);
    const buckets = bucketSessions(sessions);
    renderBarChart("#consistency-chart", buckets, "sessions", "sessions");
    renderBarChart("#minutes-chart", buckets, "minutes", "min");
    renderProgression(sessions);
    renderExerciseHistory(sessions);
    renderRecords();
    renderInsights(sessions);
    renderCategoryDistribution(sessions);
    renderHistory();
  }

  function bucketSessions(sessions) {
    return Analytics.bucketSessions(sessions, $("#progress-range").value, new Date());
  }

  function renderBarChart(selector, data, key, unit) {
    const root = $(selector);
    root.replaceChildren();
    if (!data.some(item => item[key] > 0)) {
      root.append(emptyState("Complete a workout to see your training trend."));
      return;
    }
    const max = Math.max(1, ...data.map(item => item[key]));
    data.forEach(item => {
      const barItem = document.createElement("div");
      barItem.className = "chart-bar-item";
      const value = document.createElement("span");
      value.className = "chart-value";
      value.textContent = String(item[key]);
      const wrap = document.createElement("span");
      wrap.className = "chart-bar-wrap";
      const bar = document.createElement("span");
      bar.className = "chart-bar";
      bar.style.height = `${item[key] ? Math.max(8, item[key] / max * 100) : 3}%`;
      bar.setAttribute("aria-hidden", "true");
      wrap.append(bar);
      const label = document.createElement("span");
      label.className = "chart-label";
      label.textContent = item.label;
      barItem.title = `${item.label}: ${item[key]} ${unit}`;
      barItem.setAttribute("aria-label", `${item.label}: ${item[key]} ${unit}`);
      barItem.setAttribute("role", "group");
      barItem.append(value, wrap, label);
      root.append(barItem);
    });
  }

  function renderProgression(sessions) {
    const select = $("#progress-exercise");
    const allIds = [...new Set(sessions.flatMap(session => session.exercises.map(item => item.exerciseId)))];
    const previous = select.value;
    select.replaceChildren(new Option("Choose an exercise", ""));
    allIds.forEach(id => {
      const exercise = findExercise(id);
      if (exercise) select.add(new Option(exercise.name, id));
    });
    if (allIds.includes(previous)) select.value = previous;
    const id = select.value;
    const root = $("#progression-chart");
    root.replaceChildren();
    if (!id) {
      root.append(emptyState("Choose an exercise to compare its logged performance."));
      return;
    }
    const exerciseSets = sessions.flatMap(session => session.exercises.filter(item => item.exerciseId === id)
      .flatMap(item => item.sets.filter(set => set.completed).map(set => ({ ...set, date: session.date }))))
      .sort((a, b) => a.date.localeCompare(b.date));
    const metric = exerciseSets.some(set => set.weight !== null && set.weight !== undefined)
      ? "weight"
      : exerciseSets.some(set => set.durationSeconds)
        ? "durationSeconds"
        : exerciseSets.some(set => set.distanceMeters)
          ? "distanceMeters"
          : "reps";
    const points = exerciseSets.filter(set => Number(set[metric]) > 0).map(set => ({
      date: set.date,
      label: metric === "weight" ? `${set.weight} ${state.settings.units}` :
        metric === "durationSeconds" ? formatDuration(set.durationSeconds) :
          metric === "distanceMeters" ? `${(set.distanceMeters / (state.settings.units === "lb" ? 1609.344 : 1000)).toFixed(1)} ${state.settings.units === "lb" ? "mi" : "km"}` :
            `${set.reps} reps`,
      score: Number(set[metric])
    }));
    if (!points.length) {
      root.append(emptyState("Log a completed set with reps, load, or duration to see progression."));
      return;
    }
    const max = Math.max(1, ...points.map(point => point.score));
    points.slice(-12).forEach(point => {
      const node = document.createElement("div");
      node.className = "chart-bar-item";
      node.setAttribute("role", "group");
      const value = document.createElement("span");
      value.className = "chart-value";
      value.textContent = point.label;
      const wrap = document.createElement("span");
      wrap.className = "chart-bar-wrap";
      const bar = document.createElement("span");
      bar.className = "chart-bar";
      bar.style.height = `${Math.max(8, point.score / max * 100)}%`;
      bar.setAttribute("aria-hidden", "true");
      wrap.append(bar);
      const label = document.createElement("span");
      label.className = "chart-label";
      label.textContent = formatDate(point.date, { month: "short", day: "numeric" });
      node.append(value, wrap, label);
      root.append(node);
    });
  }

  function renderExerciseHistory(sessions) {
    const root = $("#exercise-history");
    root.replaceChildren();
    const id = $("#progress-exercise").value;
    if (!id) return;
    const rows = sessions.flatMap(session => session.exercises.filter(item => item.exerciseId === id)
      .flatMap(item => item.sets.map((set, index) => ({ session, set, index }))))
      .filter(item => item.set.completed)
      .sort((a, b) => b.session.date.localeCompare(a.session.date))
      .slice(0, 20);
    if (!rows.length) {
      root.append(emptyState("No completed sets for this exercise in the selected date range."));
      return;
    }
    const list = document.createElement("ol");
    list.className = "exercise-history-list";
    list.setAttribute("aria-label", "Recent logged exercise sets");
    rows.forEach(({ session, set, index }) => {
      const row = document.createElement("li");
      const date = formatDate(session.date, { month: "short", day: "numeric", year: "numeric" });
      const values = [`Set ${index + 1}`, `${set.reps ?? 0} reps`];
      if (set.weight !== null && set.weight !== undefined) values.push(`${set.weight} ${state.settings.units}`);
      if (set.durationSeconds) values.push(formatDuration(set.durationSeconds));
      if (set.distanceMeters) values.push(`${(set.distanceMeters / (state.settings.units === "lb" ? 1609.344 : 1000)).toFixed(1)} ${state.settings.units === "lb" ? "mi" : "km"}`);
      row.textContent = `${date}: ${values.join(" · ")}`;
      list.append(row);
    });
    root.append(list);
  }

  function renderInsights(sessions) {
    const root = $("#progress-insights");
    root.replaceChildren();
    const items = Analytics.insights(sessions, allExercises(), new Date(), state.sessions);
    if (!items.length) {
      root.append(emptyState("Insights appear after you record completed workouts."));
      return;
    }
    items.forEach(item => {
      const paragraph = document.createElement("p");
      paragraph.className = "insight-row";
      paragraph.textContent = item.text;
      root.append(paragraph);
    });
  }

  function renderCategoryDistribution(sessions) {
    const root = $("#category-distribution");
    root.replaceChildren();
    const entries = Analytics.categoryDistribution(sessions, allExercises());
    if (!entries.length) {
      root.append(emptyState("Complete and log exercise sets to see your training mix."));
      return;
    }
    const total = entries.reduce((sum, entry) => sum + entry.sets, 0);
    entries.forEach(entry => {
      const row = document.createElement("div");
      row.className = "distribution-row";
      const label = document.createElement("span");
      label.textContent = `${entry.type[0].toUpperCase()}${entry.type.slice(1)}`;
      const track = document.createElement("span");
      track.className = "distribution-track";
      const fill = document.createElement("span");
      fill.className = "distribution-fill";
      fill.style.width = `${entry.sets / total * 100}%`;
      fill.setAttribute("aria-hidden", "true");
      track.append(fill);
      const value = document.createElement("strong");
      value.textContent = `${entry.sets} sets`;
      row.setAttribute("aria-label", `${label.textContent}: ${entry.sets} completed sets, ${Math.round(entry.sets / total * 100)} percent`);
      row.append(label, track, value);
      root.append(row);
    });
  }

  function getRecords() {
    return Analytics.personalRecords(state.sessions).map(record => ({
      ...record,
      exercise: findExercise(record.exerciseId)?.name || record.exerciseId
    }));
  }

  function renderRecords() {
    const root = $("#personal-records");
    root.replaceChildren();
    const records = getRecords().sort((a, b) =>
      (b.weight ?? -1) - (a.weight ?? -1) ||
      (b.durationSeconds ?? -1) - (a.durationSeconds ?? -1) ||
      (b.distanceMeters ?? -1) - (a.distanceMeters ?? -1) ||
      (b.reps ?? -1) - (a.reps ?? -1)
    ).slice(0, 8);
    if (!records.length) {
      root.append(emptyState("Your best efforts will appear here as you log sets."));
      return;
    }
    records.forEach(record => {
      const row = document.createElement("div");
      row.className = "record-row";
      const name = document.createElement("strong");
      name.textContent = record.exercise;
      const value = document.createElement("span");
      const values = [];
      if (record.weight !== null) values.push(`${record.weight} ${state.settings.units}`);
      if (record.reps !== null) values.push(`${record.reps} reps`);
      if (record.durationSeconds !== null) values.push(formatDuration(record.durationSeconds));
      if (record.distanceMeters !== null) values.push(`${(record.distanceMeters / (state.settings.units === "lb" ? 1609.344 : 1000)).toFixed(1)} ${state.settings.units === "lb" ? "mi" : "km"}`);
      value.textContent = values.join(" · ");
      row.append(name, value);
      root.append(row);
    });
  }

  function renderHistory() {
    const root = $("#session-history");
    root.replaceChildren();
    const sessions = state.sessions.filter(session => session.status === "completed").sort((a, b) => b.date.localeCompare(a.date));
    if (!sessions.length) {
      root.append(emptyState("No completed sessions yet. Your workout history will build here."));
      return;
    }
    sessions.forEach(session => {
      const row = document.createElement("article");
      row.className = "history-row";
      const info = document.createElement("div");
      const title = document.createElement("strong");
      title.textContent = session.name;
      const detail = document.createElement("small");
      detail.textContent = `${formatDate(session.date, { weekday: "short", month: "short", day: "numeric", year: "numeric" })} · ${session.durationMinutes} min · ${session.exercises.length} exercises`;
      info.append(title, detail);
      const disclosure = document.createElement("details");
      disclosure.className = "history-details";
      const summary = document.createElement("summary");
      summary.textContent = "Workout details";
      disclosure.append(summary);
      if (session.notes) {
        const notes = document.createElement("p");
        notes.textContent = session.notes;
        disclosure.append(notes);
      }
      const exerciseList = document.createElement("ul");
      session.exercises.forEach(item => {
        const exercise = findExercise(item.exerciseId);
        const exerciseLine = document.createElement("li");
        const loggedSets = item.sets.map(set => {
          const values = [];
          if (set.completed) values.push("done");
          if (set.reps !== null && set.reps !== undefined) values.push(`${set.reps} reps`);
          if (set.weight) values.push(`${set.weight} ${state.settings.units}`);
          if (set.durationSeconds) values.push(formatDuration(set.durationSeconds));
          if (set.distanceMeters) values.push(`${(set.distanceMeters / (state.settings.units === "lb" ? 1609.344 : 1000)).toFixed(1)} ${state.settings.units === "lb" ? "mi" : "km"}`);
          return values.join(" · ");
        }).filter(Boolean);
        exerciseLine.textContent = `${exercise?.name || item.exerciseId}: ${loggedSets.join(" / ") || "no sets logged"}`;
        exerciseList.append(exerciseLine);
      });
      disclosure.append(exerciseList);
      row.append(info, createButton("Reuse", "tiny-button", () => reuseSession(session.id)), createButton("Edit", "tiny-button", () => editSession(session.id)), createButton("Delete", "tiny-button muted-button", () => deleteSession(session.id)), disclosure);
      root.append(row);
    });
  }

  function reuseSession(id) {
    const source = state.sessions.find(item => item.id === id && item.status === "completed");
    if (!source) return;
    if (getActiveDraft()) {
      location.hash = "#workouts";
      setStatus("#session-status", "Finish, cancel, or keep your current draft before reusing a workout.");
      return;
    }
    const session = createSession({
      name: source.name,
      focus: source.focus,
      exerciseIds: source.exercises.map(item => item.exerciseId),
      targetSets: Object.fromEntries(source.exercises.map(item => [item.exerciseId, item.sets.length]))
    });
    session.exercises.forEach(item => {
      const previous = source.exercises.find(old => old.exerciseId === item.exerciseId);
      item.notes = previous?.notes || "";
      item.sets.forEach((set, index) => {
        const oldSet = previous?.sets[index];
        if (oldSet) {
          set.reps = oldSet.reps;
          set.weight = oldSet.weight;
          set.durationSeconds = oldSet.durationSeconds;
          set.distanceMeters = oldSet.distanceMeters || null;
        }
      });
    });
    persist();
    renderSession();
    location.hash = "#workouts";
  }

  function editSession(id) {
    const session = state.sessions.find(item => item.id === id);
    if (!session) return;
    const originalCompleted = structuredClone(session);
    session.status = "draft";
    session.paused = true;
    session.endAt = "";
    session.originalCompleted = originalCompleted;
    activeSessionId = id;
    $("#session-name").value = session.name;
    $("#session-date").value = session.date;
    $("#session-notes").value = session.notes;
    persist();
    renderAll();
    location.hash = "#workouts";
    setStatus("#session-status", "Editing this saved workout. Finish it again to update your history.");
  }

  function deleteSession(id) {
    if (!window.confirm("Delete this session from local workout history?")) return;
    state.sessions = state.sessions.filter(session => session.id !== id);
    persist();
    renderAll();
  }

  function bindCheckinsAndPrivacy() {
    $("#checkin-form").addEventListener("submit", event => {
      event.preventDefault();
      const form = event.currentTarget;
      const values = Object.fromEntries(new FormData(form));
      const entry = {
        date: today(),
        energy: optionalRating(values.energy),
        soreness: optionalRating(values.soreness),
        sleep: optionalRating(values.sleep),
        notes: String(values.notes || "").trim().slice(0, 300)
      };
      state.checkins = state.checkins.filter(item => item.date !== entry.date);
      state.checkins.push(entry);
      setStatus("#checkin-status", persist() ? "Check-in saved privately on this device." : "Could not save this check-in.");
    });
    $("#reminder-toggle").checked = state.settings.reminders;
    $("#reminder-toggle").addEventListener("change", async event => {
      if (event.target.checked) {
        if (!("Notification" in window)) {
          event.target.checked = false;
          return setStatus("#reminder-status", "This browser does not support notifications.");
        }
        let permission;
        try {
          permission = await Notification.requestPermission();
        } catch (error) {
          console.error("Could not request notification permission.", error);
          event.target.checked = false;
          return setStatus("#reminder-status", "Could not request notification permission. Check browser settings and try again.");
        }
        if (permission !== "granted") {
          event.target.checked = false;
          return setStatus("#reminder-status", "Notifications are blocked. You can change this in browser settings.");
        }
      }
      state.settings.reminders = event.target.checked;
      persist();
      scheduleReminder();
      setStatus("#reminder-status", event.target.checked ? "Daily nudge enabled while this page stays open." : "Daily nudge turned off.");
    });
    $("#export-json").addEventListener("click", exportJson);
    $("#export-csv").addEventListener("click", exportCsv);
    $("#delete-data").addEventListener("click", () => { void deleteAllData(); });
  }

  function optionalRating(value) {
    if (value === "" || value === undefined) return null;
    const numeric = Number(value);
    return Number.isInteger(numeric) && numeric >= 1 && numeric <= 5 ? numeric : null;
  }

  function scheduleReminder() {
    if (window.reminderTimeout) clearTimeout(window.reminderTimeout);
    if (!state.settings.reminders || !("Notification" in window) || Notification.permission !== "granted") return;
    const notify = () => {
      if (document.visibilityState !== "visible") return;
      try {
        new Notification("A little movement, your way", { body: "If it suits today, your training plan is ready. Rest is always okay too." });
      } catch (error) {
        console.error("Could not show the optional training reminder.", error);
        setStatus("#reminder-status", "Could not show a notification. Check browser settings.");
        state.settings.reminders = false;
        $("#reminder-toggle").checked = false;
        persist();
        if (window.reminderTimeout) clearInterval(window.reminderTimeout);
      }
    };
    const next = new Date();
    next.setHours(18, 0, 0, 0);
    if (next <= new Date()) next.setDate(next.getDate() + 1);
    window.reminderTimeout = setTimeout(() => {
      notify();
      window.reminderTimeout = setInterval(notify, 86400000);
    }, next.getTime() - Date.now());
  }

  function exportJson() {
    download(`karfivo-training-${today()}.json`, JSON.stringify(state, null, 2), "application/json");
    setStatus("#data-status", "Training data exported as JSON.");
  }

  async function importJson(event) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    try {
      const imported = Store.validateImport(JSON.parse(await file.text()));
      if (!window.confirm("Import this KARFIVO backup? It will replace the profile, routines, and workout data currently stored on this device.")) return;
      await Store.clear();
      state = imported;
      activeSessionId = null;
      if (!persist()) throw new Error("The imported data could not be saved in this browser.");
      await Store.flush();
      location.reload();
    } catch (error) {
      console.error("Could not import KARFIVO workout data.", error);
      setStatus("#data-status", error instanceof SyntaxError ? "This file is not valid JSON." : error.message || "Could not import this backup.");
    } finally {
      input.value = "";
    }
  }

  function exportCsv() {
    const rows = [["date", "session", "duration_minutes", "focus", "exercise", "set", "reps", `weight_${state.settings.units}`, "duration_seconds", "distance_meters", "completed", "session_notes"]];
    state.sessions.filter(session => session.status === "completed").forEach(session => {
      session.exercises.forEach(item => item.sets.forEach((set, index) => {
        rows.push([session.date, session.name, session.durationMinutes, session.focus, findExercise(item.exerciseId)?.name || item.exerciseId,
          index + 1, set.reps ?? "", set.weight ?? "", set.durationSeconds ?? "", set.distanceMeters ?? "", set.completed, session.notes]);
      }));
    });
    const csv = rows.map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\r\n");
    download(`karfivo-sessions-${today()}.csv`, csv, "text/csv;charset=utf-8");
    setStatus("#data-status", "Completed training sets exported as CSV.");
  }

  async function deleteAllData() {
    if (!window.confirm("Permanently delete your saved profile, workouts, routines, calendar, check-ins, and local food choices from this browser?")) return;
    try {
      await Store.clear();
      state = Store.defaultState();
      activeSessionId = null;
      if (timerId) clearInterval(timerId);
      if (restTimerId) clearInterval(restTimerId);
      const profileForm = $("#profile-form");
      profileForm.reset();
      $("#session-name").value = "My workout";
      $("#session-date").value = today();
      $("#session-notes").value = "";
      profileForm.elements.experience.value = state.profile.experience;
      profileForm.elements.duration.value = state.profile.duration;
      profileForm.elements.units.value = state.settings.units;
      $("#duration-label").textContent = `${state.profile.duration} min`;
      renderChoiceGroup("#interest-options", Data.interests, state.profile.interests, "interests");
      renderChoiceGroup("#equipment-options", Data.equipment, state.profile.equipment, "equipment");
      renderChoiceGroup("#day-options", Data.days, state.profile.days, "days", true);
      renderChoiceGroup("#exclusion-options", allExercises(), state.profile.excluded, "excluded", false, true);
      $("#checkin-form").reset();
      $("#reminder-toggle").checked = false;
      applyTheme();
      setStatus("#data-status", "All saved KARFIVO data was deleted from this browser.");
      renderAll();
      renderSession();
    } catch (error) {
      console.error("Could not delete saved KARFIVO data.", error);
      setStatus("#data-status", "Could not delete data. Check this browser's storage settings.");
    }
  }

  function download(filename, contents, type) {
    const blob = new Blob([contents], { type });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function bindFoodPlanner() {
    $("#ingredient-search").addEventListener("input", renderIngredients);
    renderIngredients();
    renderMeals();
  }

  function renderIngredients() {
    const root = $("#ingredient-list");
    const query = $("#ingredient-search").value.trim().toLowerCase();
    root.replaceChildren();
    const groups = new Map();
    Data.ingredients.filter(food => food.name.toLowerCase().includes(query)).forEach(food => {
      if (!groups.has(food.group)) groups.set(food.group, []);
      groups.get(food.group).push(food);
    });
    groups.forEach((foods, group) => {
      const heading = document.createElement("p");
      heading.className = "ingredient-group-label";
      heading.textContent = group;
      root.append(heading);
      foods.forEach(food => {
        const label = document.createElement("label");
        label.className = "food-chip";
        const input = document.createElement("input");
        input.type = "checkbox";
        input.value = food.id;
        input.checked = state.foodSelection.includes(food.id);
        input.setAttribute("aria-label", food.name);
        input.addEventListener("change", () => {
          state.foodSelection = input.checked ? [...new Set([...state.foodSelection, food.id])] : state.foodSelection.filter(id => id !== food.id);
          persist();
          renderMeals();
        });
        const span = document.createElement("span");
        span.textContent = food.name;
        label.append(input, span);
        root.append(label);
      });
    });
  }

  function renderMeals() {
    const root = $("#meal-list");
    root.replaceChildren();
    if (!state.foodSelection.length) {
      root.append(emptyState("Select ingredients above to see meal ideas."));
      return;
    }
    Data.meals.map(meal => ({
      ...meal,
      matched: meal.ingredients.filter(id => state.foodSelection.includes(id)),
      missing: meal.ingredients.filter(id => !state.foodSelection.includes(id))
    })).filter(meal => meal.matched.length).sort((a, b) => b.matched.length / b.ingredients.length - a.matched.length / a.ingredients.length).slice(0, 3)
      .forEach(meal => {
        const card = document.createElement("article");
        card.className = "meal-card";
        const title = document.createElement("strong");
        title.textContent = meal.name;
        const note = document.createElement("p");
        note.textContent = meal.note;
        const have = document.createElement("small");
        have.textContent = `On hand: ${meal.matched.map(id => Data.ingredients.find(food => food.id === id)?.name).join(", ")}`;
        card.append(title, note, have);
        root.append(card);
      });
  }

  function renderHome() {
    const recent = state.sessions.filter(session => session.status === "completed").sort((a, b) => b.date.localeCompare(a.date));
    const thisWeek = recent.filter(session => isThisWeek(session.date));
    $("#week-sessions").textContent = `${thisWeek.length} ${thisWeek.length === 1 ? "session" : "sessions"}`;
    $("#week-minutes").textContent = `${thisWeek.reduce((total, session) => total + session.durationMinutes, 0)} min`;
    const name = state.profile.name.trim();
    $("#profile-name").textContent = name || "My plan";
    const greeting = $("#home-greeting");
    greeting.replaceChildren(document.createTextNode(name ? `Welcome, ${name}.` : "Move with purpose."));
    greeting.append(document.createElement("br"));
    const greetingSecondLine = document.createElement("span");
    greetingSecondLine.textContent = name ? "Strength in motion." : "Grow at your pace.";
    greeting.append(greetingSecondLine);
    const todayPlan = state.schedule.find(item => item.date === today());
    const nextPlan = state.schedule.filter(item => item.date >= today() && item.kind === "workout").sort((a, b) => a.date.localeCompare(b.date))[0];
    const suggestedNext = nextSuggestedWorkoutDay(recent);
    $("#next-workout").textContent = todayPlan?.kind === "workout"
      ? todayPlan.title
      : todayPlan?.kind === "rest" && (nextPlan || suggestedNext)
        ? `Rest today · ${formatDate((nextPlan || suggestedNext).date, { weekday: "short" })} next`
        : nextPlan
          ? `${formatDate(nextPlan.date, { weekday: "short" })} · ${nextPlan.title}`
          : suggestedNext
            ? `${formatDate(suggestedNext.date, { weekday: "short" })} · Suggested training`
            : todayPlan?.kind === "rest" ? "Rest and recover" : "Set your training days";

    const suggestion = Generator.generateRoutine({ exercises: allExercises(), profile: state.profile, sessions: recent, focus: state.profile.interests[0] || "general" });
    const target = $("#home-recommendation");
    target.replaceChildren();
    if (!suggestion.exercises.length) {
      target.append(emptyState(suggestion.explanation));
    } else {
      const info = document.createElement("p");
      info.className = "recommendation-copy";
      info.textContent = suggestion.explanation;
      const chips = document.createElement("div");
      chips.className = "recommendation-chips";
      suggestion.exercises.slice(0, 5).forEach(exercise => {
        const chip = document.createElement("span");
        chip.className = "exercise-tag";
        chip.textContent = exercise.name;
        chips.append(chip);
      });
      const button = createButton("Preview and edit workout", "button button-primary", () => {
        $("#generator-focus").value = state.profile.interests[0] || "general";
        generateAndPreview();
        location.hash = "#workouts";
      });
      target.append(info, chips, button);
    }
    renderMiniWeek();
    renderRecentSessions(recent.slice(0, 3));
    renderMilestones(recent);
  }

  function nextSuggestedWorkoutDay(recentSessions) {
    const todayDate = new Date(`${today()}T12:00:00`);
    for (let week = 0; week < 2; week++) {
      const monday = startOfWeek(todayDate);
      monday.setDate(monday.getDate() + week * 7);
      const plan = Generator.buildWeeklyPlan({ days: state.profile.days, schedule: state.schedule, weekStart: monday });
      const next = plan.find(day => day.date >= today() && day.kind === "workout" &&
        !recentSessions.some(session => session.date === day.date));
      if (next) return next;
    }
    return null;
  }

  function renderMiniWeek() {
    const root = $("#mini-week");
    root.replaceChildren();
    const monday = startOfWeek(new Date());
    const suggestedPlan = Generator.buildWeeklyPlan({ days: state.profile.days, schedule: state.schedule, weekStart: monday });
    Data.days.forEach((day, index) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + index);
      const key = localDateKey(date);
      const item = document.createElement("div");
      item.className = `mini-day${key === today() ? " today" : ""}`;
      const label = document.createElement("span");
      label.textContent = day.short;
      const dateNumber = document.createElement("strong");
      dateNumber.textContent = String(date.getDate());
      const planned = suggestedPlan[index]?.kind === "workout";
      const trained = state.sessions.some(session => session.status === "completed" && session.date === key);
      const mark = document.createElement("span");
      mark.className = `mini-mark${trained ? " done" : planned ? " planned" : ""}`;
      mark.textContent = trained ? "✓" : planned ? "•" : "–";
      item.append(label, dateNumber, mark);
      root.append(item);
    });
  }

  function renderRecentSessions(sessions) {
    const root = $("#recent-sessions");
    root.replaceChildren();
    if (!sessions.length) {
      root.append(emptyState("Your completed sessions will show up here. Start with a gentle workout when you’re ready."));
      return;
    }
    sessions.forEach(session => {
      const row = document.createElement("div");
      row.className = "recent-row";
      const title = document.createElement("strong");
      title.textContent = session.name;
      const detail = document.createElement("small");
      detail.textContent = `${formatDate(session.date, { month: "short", day: "numeric" })} · ${session.durationMinutes} min`;
      row.append(title, detail);
      root.append(row);
    });
  }

  function renderMilestones(sessions) {
    const root = $("#home-milestones");
    root.replaceChildren();
    const achievements = [
      { id: "first-workout", name: "First session", detail: "Complete your first workout", icon: "first", earned: sessions.length >= 1 },
      { id: "first-routine", name: "Plan maker", detail: "Save your first routine", icon: "routine", earned: state.routines.length > 0 },
      { id: "five-workouts", name: "Building a rhythm", detail: "Complete five workouts", icon: "five", earned: sessions.length >= 5 },
      { id: "ten-workouts", name: "Ten in the books", detail: "Complete ten workouts", icon: "ten", earned: sessions.length >= 10 },
      { id: "first-record", name: "Personal best", detail: "Log your first completed exercise set", icon: "record", earned: getRecords().length > 0 },
      { id: "first-month", name: "A month of movement", detail: "Record training across at least 30 days", icon: "month", earned: trainingSpanDays(sessions) >= 30 }
    ];
    const savedIds = new Set(state.achievements.map(item => item.id));
    const newlyEarned = achievements.filter(item => item.earned && !savedIds.has(item.id))
      .map(item => ({ id: item.id, earnedAt: today() }));
    if (newlyEarned.length) {
      state.achievements = [...state.achievements, ...newlyEarned];
      persist();
    }
    achievements.forEach(achievement => {
      const isEarned = savedIds.has(achievement.id) || achievement.earned;
      const row = document.createElement("div");
      row.className = `milestone-row${isEarned ? " earned" : ""}`;
      const icon = document.createElement("span");
      icon.className = "achievement-icon";
      icon.setAttribute("aria-hidden", "true");
      icon.append(makeAchievementIcon(achievement.icon, isEarned));
      const copy = document.createElement("span");
      const title = document.createElement("strong");
      title.textContent = achievement.name;
      const detail = document.createElement("small");
      const saved = state.achievements.find(item => item.id === achievement.id);
      const earnedDate = saved?.earnedAt && validDateKey(saved.earnedAt.slice(0, 10))
        ? ` · earned ${formatDate(saved.earnedAt, { month: "short", day: "numeric", year: "numeric" })}`
        : "";
      detail.textContent = isEarned ? `${achievement.detail}${earnedDate}` : achievement.detail;
      copy.append(title, detail);
      row.append(icon, copy);
      root.append(row);
    });
  }

  function trainingSpanDays(sessions) {
    if (sessions.length < 2) return 0;
    const dates = sessions.map(session => Date.parse(`${session.date}T12:00:00`)).filter(Number.isFinite);
    return dates.length < 2 ? 0 : Math.floor((Math.max(...dates) - Math.min(...dates)) / 86400000) + 1;
  }

  function makeAchievementIcon(kind, earned) {
    const paths = {
      first: "M12 3v18M3 12h18",
      routine: "M5 3h14v18H5zM8 8h8M8 12h8M8 16h5",
      five: "M7 4h11l-1 6H8l-2 11",
      ten: "M12 3 21 8v8l-9 5-9-5V8z",
      record: "m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9z",
      month: "M3 7h18v14H3zM7 3v8M17 3v8M3 11h18"
    };
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", paths[kind]);
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", "currentColor");
    path.setAttribute("stroke-width", "1.8");
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("stroke-linejoin", "round");
    svg.append(path);
    if (!earned) svg.classList.add("achievement-icon-locked");
    return svg;
  }

  function renderAll() {
    renderSession();
    renderSavedRoutines();
    renderExercises();
    renderScheduleRoutineOptions();
    renderCalendar();
    renderHome();
    renderProgress();
    renderIngredients();
    renderMeals();
    $("#today-label").textContent = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" }).format(new Date()).toUpperCase();
    $("#reminder-toggle").checked = state.settings.reminders;
  }

  function persist() {
    const saved = Store.save(state);
    if (!saved) showStorageError("Changes are visible in this session but couldn't be saved. Check browser storage settings.");
    return saved;
  }

  function showStorageError(message) {
    if ($("#session-status")) setStatus("#session-status", message);
    console.error(message);
  }

  function bindRestTimer() {
    resetRestTimer();
  }

  function registerServiceWorker() {
    const status = $("#app-install-status");
    if (!["http:", "https:"].includes(location.protocol) || !("serviceWorker" in navigator)) {
      status.textContent = "Free to use. Install and offline support require a compatible browser on localhost or HTTPS.";
      return;
    }
    status.textContent = "Free to use. Checking optional offline installation support…";
    let registrationChecked = false;
    const checkTimeout = setTimeout(() => {
      if (!registrationChecked) status.textContent = "Free to use. Offline installation could not be confirmed here; online use remains available.";
    }, 8000);
    let registrationPromise;
    try {
      registrationPromise = navigator.serviceWorker.register("./service-worker.js");
    } catch (error) {
      registrationChecked = true;
      clearTimeout(checkTimeout);
      console.error("Could not register the KARFIVO offline app shell.", error);
      status.textContent = "Free to use. Offline installation is unavailable in this browser; online use is unaffected.";
      return;
    }
    registrationPromise.then(registration => {
      registrationChecked = true;
      clearTimeout(checkTimeout);
      const worker = registration.active || registration.waiting || registration.installing;
      if (registration.active) {
        status.textContent = "Free to use. Installable on supported browsers; your training records remain on this device.";
        return;
      }
      if (!worker) {
        status.textContent = "Free to use. Offline installation is not active in this browser; online use remains available.";
        return;
      }
      status.textContent = "Free to use. Offline app setup is in progress; training records remain on this device.";
      worker.addEventListener("statechange", () => {
        if (worker.state === "activated") status.textContent = "Free to use. Installable on supported browsers; your training records remain on this device.";
        if (worker.state === "redundant") status.textContent = "Free to use. Offline installation is unavailable here; online use remains available.";
      });
    }).catch(error => {
      registrationChecked = true;
      clearTimeout(checkTimeout);
      console.error("Could not register the KARFIVO offline app shell.", error);
      status.textContent = "Free to use. Offline installation is unavailable in this browser; online use is unaffected.";
    });
  }

  function startRestTimer() {
    if (restTimerId) clearInterval(restTimerId);
    if (restRemaining <= 0) restRemaining = Number($("#rest-duration").value);
    window.restTimerEndsAt = Date.now() + restRemaining * 1000;
    $("#rest-start").disabled = true;
    restTimerId = setInterval(() => {
      refreshRestTimer();
    }, 1000);
    $("#rest-start").textContent = "Resting…";
  }

  function resetRestTimer() {
    if (restTimerId) clearInterval(restTimerId);
    restTimerId = null;
    restRemaining = Number($("#rest-duration").value);
    window.restTimerEndsAt = null;
    $("#rest-clock").textContent = formatDuration(restRemaining);
    $("#rest-clock").classList.remove("timer-done");
    $("#rest-start").disabled = false;
    $("#rest-start").textContent = "Start rest";
  }

  function refreshTimers() {
    const session = getActiveDraft();
    if (session && !session.paused) $("#session-clock").textContent = formatDuration(elapsedSeconds(session));
    if (window.restTimerEndsAt) refreshRestTimer();
  }

  function refreshRestTimer() {
    restRemaining = Math.max(0, Math.ceil((window.restTimerEndsAt - Date.now()) / 1000));
    $("#rest-clock").textContent = formatDuration(restRemaining);
    if (restRemaining === 0) {
      clearInterval(restTimerId);
      restTimerId = null;
      window.restTimerEndsAt = null;
      $("#rest-start").disabled = false;
      $("#rest-start").textContent = "Start rest";
      $("#rest-clock").classList.add("timer-done");
    }
  }

  function createButton(text, className, onClick, label = "") {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.textContent = text;
    if (label) button.setAttribute("aria-label", label);
    button.addEventListener("click", onClick);
    return button;
  }

  function textCell(text) {
    const cell = document.createElement("td");
    cell.textContent = text;
    return cell;
  }

  function emptyState(text) {
    const box = document.createElement("div");
    box.className = "empty-state";
    const copy = document.createElement("span");
    copy.textContent = text;
    box.append(copy);
    return box;
  }

  function tag(text) {
    const node = document.createElement("span");
    node.className = "exercise-tag";
    node.textContent = text;
    return node;
  }

  function equipmentLabel(id) {
    return id === "bodyweight" ? "Bodyweight" : Data.equipment.find(item => item.id === id)?.label || id;
  }

  function setStatus(selector, text) {
    const element = $(selector);
    if (element) element.textContent = text;
  }

  function formatDuration(seconds) {
    const total = Math.max(0, Math.floor(Number(seconds) || 0));
    return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
  }

  function formatDate(value, options) {
    const date = new Date(`${value.slice(0, 10)}T12:00:00`);
    return new Intl.DateTimeFormat(undefined, options).format(date);
  }

  function localDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function startOfWeek(date) {
    const result = new Date(date);
    result.setHours(12, 0, 0, 0);
    result.setDate(result.getDate() - ((result.getDay() + 6) % 7));
    return result;
  }

  function isThisWeek(value) {
    const date = new Date(`${value.slice(0, 10)}T12:00:00`);
    const start = startOfWeek(new Date());
    const end = new Date(start);
    end.setDate(start.getDate() + 7);
    return date >= start && date < end;
  }

  window.FitNaija = Object.freeze({
    generateRoutine: options => Generator.generateRoutine(options),
    buildWeeklyPlan: options => Generator.buildWeeklyPlan(options),
    calculateStats,
    filterSessions: Analytics.filterSessions,
    categoryDistribution: Analytics.categoryDistribution,
    getRecords,
    validateSet: (set, exercise) => {
      if (!set || typeof set !== "object" || !exercise) return false;
      const bound = (value, max) => value === null || value === undefined || Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= max;
      return bound(set.reps, 1000) && (set.reps === null || set.reps === undefined || Number.isInteger(Number(set.reps))) &&
        bound(set.weight, 5000) && bound(set.durationSeconds, 86400) && bound(set.distanceMeters, 1000000);
    },
    getState: () => structuredClone(state)
  });

  document.addEventListener("DOMContentLoaded", async () => {
    registerServiceWorker();
    const indexedDbEnabled = await Store.initialize();
    initialize();
    bindRestTimer();
    if (!indexedDbEnabled) setStatus("#data-status", "This browser is using local storage instead of IndexedDB. Data remains on this device; keep a JSON backup.");
  });
})();
