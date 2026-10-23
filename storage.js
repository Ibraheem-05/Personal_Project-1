"use strict";

window.FitNaijaStorage = (() => {
  const STORAGE_KEY = "fitnaija-training-v2";
  const LEGACY_KEY = "fitnaija-prototype-v1";
  const DATABASE_NAME = "karfivo-local";
  const DATABASE_VERSION = 1;
  const STORE_NAME = "training-state";
  const dayIds = new Set(window.FitNaijaData.days.map(day => day.id));
  const exerciseIds = new Set(window.FitNaijaData.exercises.map(exercise => exercise.id));
  let database = null;
  let writeQueue = Promise.resolve();
  let usingFallback = true;
  let indexedDbState = null;

  function defaultState() {
    return {
      version: 3,
      profile: { name: "", interests: ["strength", "cardio", "mobility", "general"], experience: "beginner", equipment: [], days: ["mon", "wed", "fri"], duration: 30, excluded: [] },
      exercises: [],
      routines: [],
      sessions: [],
      schedule: [],
      checkins: [],
      achievements: [],
      settings: { theme: "dark", reminders: false, units: "kg", experimental: { social: false, wearables: false } },
      foodSelection: []
    };
  }

  async function initialize() {
    if (!globalThis.indexedDB) return false;
    try {
      database = await openDatabase();
      usingFallback = false;
      const stored = await readDatabaseState();
      if (stored) {
        indexedDbState = normalize(stored);
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(indexedDbState)); } catch (error) {
          console.warn("Could not refresh the browser storage backup.", error);
        }
      } else {
        let existing = null;
        try {
          existing = localStorage.getItem(STORAGE_KEY);
        } catch (error) {
          console.warn("Could not read the browser storage backup; creating a fresh IndexedDB state.", error);
        }
        let initial;
        if (existing) {
          try {
            initial = normalize(JSON.parse(existing));
          } catch (error) {
            console.error("The browser storage backup is invalid; initializing from legacy food choices.", error);
            initial = loadLegacyState();
          }
        } else {
          initial = loadLegacyState();
        }
        await writeDatabaseState(initial);
        indexedDbState = initial;
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(initial)); } catch (error) {
          console.warn("Could not mirror the workout data to browser storage.", error);
        }
      }
      return true;
    } catch (error) {
      database = null;
      usingFallback = true;
      console.warn("IndexedDB is unavailable; continuing with browser local storage.", error);
      return false;
    }
  }

  function openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE_NAME)) {
          request.result.createObjectStore(STORE_NAME, { keyPath: "key" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Could not open the local workout database."));
      request.onblocked = () => reject(new Error("The local workout database is blocked by another open tab."));
    });
  }

  function readDatabaseState() {
    return new Promise((resolve, reject) => {
      const request = database.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get("training");
      request.onsuccess = () => resolve(request.result?.value || null);
      request.onerror = () => reject(request.error || new Error("Could not read the local workout database."));
    });
  }

  function writeDatabaseState(value) {
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).put({ key: "training", value });
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error("Could not save the local workout database."));
      transaction.onabort = () => reject(transaction.error || new Error("Saving the local workout database was cancelled."));
    });
  }

  function loadLegacyState() {
    const fresh = defaultState();
    migrateLegacyProfile(fresh);
    return fresh;
  }

  function load() {
    try {
      if (indexedDbState) return normalize(indexedDbState);
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return normalize(JSON.parse(raw));
      return loadLegacyState();
    } catch (error) {
      console.error("Could not read saved training data.", error);
      throw new Error("Saved training data could not be read. You can still retry after checking this browser's storage settings.");
    }
  }

  function migrateLegacyProfile(state) {
    try {
      const legacy = JSON.parse(localStorage.getItem(LEGACY_KEY) || "null");
      const focus = legacy?.profile?.goal === "muscle" ? "strength" : legacy?.profile?.goal === "energy" ? "cardio" : "general";
      if (legacy?.profile?.goal && ["lose", "muscle", "energy", "general"].includes(legacy.profile.goal)) {
        state.profile.interests = [focus];
      }
      if (Array.isArray(legacy?.selected)) {
        state.foodSelection = legacy.selected.filter(id => window.FitNaijaData.ingredients.some(food => food.id === id));
      }
      if (Array.isArray(legacy?.sessions)) {
        state.sessions = legacy.sessions.filter(item =>
          item && typeof item.title === "string" && item.title.trim() && item.title.length <= 60 &&
          validDateKey(item.date)
        ).slice(-500).map((item, index) => ({
          id: `legacy-${index}-${item.date}`,
          date: item.date,
          startAt: `${item.date}T12:00:00.000Z`,
          endAt: "",
          durationMinutes: 0,
          elapsedSeconds: 0,
          status: "completed",
          paused: false,
          name: item.title.trim(),
          focus: /strength/i.test(item.title) ? "strength" : /walk|cardio|dance/i.test(item.title) ? "cardio" : focus,
          notes: "Imported from an earlier movement check-in; no duration or set details were recorded.",
          exercises: []
        }));
      }
    } catch (error) {
      console.warn("Existing food planner data could not be migrated.", error);
    }
  }

  function normalize(input) {
    const base = defaultState();
    if (!input || typeof input !== "object") return base;
    const profile = input.profile && typeof input.profile === "object" ? input.profile : {};
    base.exercises = Array.isArray(input.exercises) ? input.exercises.filter(validCustomExercise).slice(0, 100) : [];
    const knownIds = new Set([...exerciseIds, ...base.exercises.map(exercise => exercise.id)]);
    base.profile = {
      name: text(profile.name, 40),
      interests: subset(profile.interests, new Set(["strength", "cardio", "mobility", "general"]), ["general"]),
      experience: ["beginner", "intermediate", "advanced"].includes(profile.experience) ? profile.experience : "beginner",
      equipment: subset(profile.equipment, new Set(window.FitNaijaData.equipment.map(item => item.id)), []),
      days: subset(profile.days, dayIds, ["mon", "wed", "fri"]),
      duration: integer(profile.duration, 15, 90, 30, 5),
      excluded: subset(profile.excluded, knownIds, [])
    };
    base.routines = Array.isArray(input.routines) ? input.routines.filter(routine => routine && typeof routine.id === "string" && typeof routine.name === "string" && Array.isArray(routine.exerciseIds)).map(routine => ({
      id: text(routine.id, 80),
      name: text(routine.name, 60),
      focus: ["strength", "cardio", "mobility", "general"].includes(routine.focus) ? routine.focus : "general",
      exerciseIds: routine.exerciseIds.filter(id => knownIds.has(id)).slice(0, 20),
      targetSets: Object.fromEntries(routine.exerciseIds.filter(id => knownIds.has(id)).slice(0, 20).map(id => [id, integer(routine.targetSets?.[id], 1, 20, 3, 1)])),
      createdAt: validDate(routine.createdAt) || new Date().toISOString()
    })).filter(routine => routine.id && routine.name).slice(-100) : [];
    base.sessions = Array.isArray(input.sessions) ? input.sessions.filter(validSession).map(session => normalizeSession(session, knownIds)).slice(-500) : [];
    const routineIds = new Set(base.routines.map(routine => routine.id));
    base.schedule = Array.isArray(input.schedule) ? input.schedule.filter(item => item && validDateKey(item.date) && ["workout", "rest"].includes(item.kind)).map(item => ({
      id: text(item.id, 80) || makeId(),
      date: item.date,
      kind: item.kind,
      routineId: routineIds.has(item.routineId) ? item.routineId : "",
      title: text(item.title, 60)
    })).slice(-1000) : [];
    base.checkins = Array.isArray(input.checkins) ? input.checkins.filter(item => item && validDateKey(item.date)).map(item => ({
      date: item.date, energy: optionalRating(item.energy), soreness: optionalRating(item.soreness), sleep: optionalRating(item.sleep), notes: text(item.notes, 300)
    })).slice(-500) : [];
    base.achievements = Array.isArray(input.achievements) ? input.achievements
      .filter(item => item && typeof item.id === "string")
      .map(item => ({ id: text(item.id, 80), earnedAt: validDate(item.earnedAt) || "" }))
      .filter(item => item.id).slice(0, 100) : [];
    const settings = input.settings && typeof input.settings === "object" ? input.settings : {};
    base.settings = {
      theme: settings.theme === "light" ? "light" : "dark",
      reminders: settings.reminders === true,
      units: settings.units === "lb" ? "lb" : "kg",
      experimental: { social: false, wearables: false }
    };
    base.foodSelection = Array.isArray(input.foodSelection) ? input.foodSelection.filter(id => window.FitNaijaData.ingredients.some(food => food.id === id)) : [];
    return base;
  }

  function validCustomExercise(item) {
    return item && typeof item.id === "string" && /^custom-[\w-]{1,70}$/.test(item.id) &&
      typeof item.name === "string" && item.name.trim().length > 0 && item.name.length <= 60 &&
      ["strength", "cardio", "mobility"].includes(item.type) &&
      Array.isArray(item.muscles) && item.muscles.every(value => typeof value === "string") &&
      Array.isArray(item.equipment) && item.equipment.length > 0 && item.equipment.every(value => ["bodyweight", "dumbbells", "barbell", "bands", "bench", "kettlebell", "cardio-machine", "other"].includes(value)) &&
      ["beginner", "intermediate", "advanced"].includes(item.level) &&
      typeof item.instructions === "string" && item.instructions.trim().length > 0 && item.instructions.length <= 500 &&
      typeof item.alternative === "string" && item.alternative.length <= 60 &&
      Number.isFinite(item.duration) && item.duration >= 1 && item.duration <= 180 &&
      Array.isArray(item.focus) && item.focus.length > 0 && item.focus.every(focus => ["strength", "cardio", "mobility", "general"].includes(focus));
  }

  function validSession(session) {
    return session && typeof session.id === "string" && validDateKey(session.date) &&
      ["draft", "completed"].includes(session.status) && Array.isArray(session.exercises);
  }

  function normalizeSession(session, knownIds) {
    const normalized = {
      id: text(session.id, 80),
      date: session.date,
      startAt: validDate(session.startAt) || `${session.date}T12:00:00.000Z`,
      endAt: validDate(session.endAt),
      durationMinutes: integer(session.durationMinutes, 0, 1440, 0, 1),
      elapsedSeconds: integer(session.elapsedSeconds, 0, 86400, 0, 1),
      status: session.status,
      paused: session.status === "draft" && session.paused === true,
      name: text(session.name, 60) || "My workout",
      focus: ["strength", "cardio", "mobility", "general"].includes(session.focus) ? session.focus : "general",
      notes: text(session.notes, 1000),
      exercises: session.exercises.filter(item => item && knownIds.has(item.exerciseId)).slice(0, 30).map(item => ({
        exerciseId: item.exerciseId,
        notes: text(item.notes, 300),
        sets: Array.isArray(item.sets) ? item.sets.slice(0, 50).filter(set => set && validOptionalNumber(set.reps, 0, 1000) && (set.reps === null || set.reps === undefined || Number.isInteger(Number(set.reps))) && validOptionalNumber(set.weight, 0, 5000) && validOptionalNumber(set.durationSeconds, 0, 86400) && validOptionalNumber(set.distanceMeters, 0, 1000000)).map(set => ({
          reps: numberOrNull(set.reps),
          weight: numberOrNull(set.weight),
          durationSeconds: numberOrNull(set.durationSeconds),
          distanceMeters: numberOrNull(set.distanceMeters),
          completed: set.completed === true,
          restSeconds: integer(set.restSeconds, 0, 3600, 60, 1)
        })) : []
      }))
    };
    if (session.status === "draft" && session.originalCompleted && validSession({ ...session.originalCompleted, status: "completed" })) {
      const snapshot = { ...session.originalCompleted, status: "completed", paused: false, originalCompleted: null };
      normalized.originalCompleted = normalizeSession(snapshot, knownIds);
    } else {
      normalized.originalCompleted = null;
    }
    return normalized;
  }

  function save(state) {
    try {
      const safeState = normalize(state);
      const serialized = JSON.stringify(safeState);
      if (!usingFallback) indexedDbState = safeState;
      let localSaved = false;
      try {
        localStorage.setItem(STORAGE_KEY, serialized);
        localSaved = true;
      } catch (error) {
        if (usingFallback) throw error;
        console.warn("Could not update the browser storage backup.", error);
      }
      if (database && !usingFallback) {
        writeQueue = writeQueue.then(() => writeDatabaseState(safeState)).catch(error => {
          console.error("Could not persist training data to IndexedDB.", error);
          window.dispatchEvent(new CustomEvent("karfivo-storage-error", { detail: "IndexedDB could not save your latest changes. Export a backup before closing this page." }));
        });
      }
      return localSaved || !!database;
    } catch (error) {
      console.error("Could not save training data.", error);
      return false;
    }
  }

  async function clear() {
    indexedDbState = null;
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(LEGACY_KEY);
    } catch (error) {
      if (usingFallback) throw error;
      console.warn("Could not remove the browser storage backup.", error);
    }
    if (database && !usingFallback) {
      await writeQueue;
      await new Promise((resolve, reject) => {
        const transaction = database.transaction(STORE_NAME, "readwrite");
        transaction.objectStore(STORE_NAME).clear();
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error || new Error("Could not clear the local workout database."));
        transaction.onabort = () => reject(transaction.error || new Error("Clearing the local workout database was cancelled."));
      });
    }
  }

  function flush() {
    return writeQueue;
  }

  function validateImport(input) {
    if (!input || typeof input !== "object" || Array.isArray(input) || !Number.isInteger(input.version) || ![2, 3].includes(input.version)) {
      throw new Error("This backup is not a supported KARFIVO workout export.");
    }
    for (const key of ["profile", "settings"]) {
      if (input[key] !== undefined && (!input[key] || typeof input[key] !== "object" || Array.isArray(input[key]))) {
        throw new Error(`The backup contains invalid ${key} data.`);
      }
    }
    for (const key of ["sessions", "routines", "schedule", "checkins", "exercises", "achievements", "foodSelection"]) {
      if (input[key] !== undefined && !Array.isArray(input[key])) {
        throw new Error(`The backup's ${key} data is invalid.`);
      }
    }
    return normalize(input);
  }

  function text(value, max) {
    return typeof value === "string" ? value.trim().slice(0, max) : "";
  }

  function subset(value, allowed, fallback) {
    if (!Array.isArray(value)) return [...fallback];
    return [...new Set(value.filter(item => allowed.has(item)))];
  }

  function integer(value, min, max, fallback, step) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    const rounded = step > 1 ? Math.round(number / step) * step : Math.round(number);
    return Math.min(max, Math.max(min, rounded));
  }

  function validOptionalNumber(value, min, max) {
    return value === null || value === undefined || (Number.isFinite(Number(value)) && Number(value) >= min && Number(value) <= max);
  }

  function numberOrNull(value) {
    return value === null || value === undefined || value === "" ? null : Number(value);
  }

  function optionalRating(value) {
    return value === null || value === undefined || value === "" ? null : integer(value, 1, 5, null, 1);
  }

  function validDate(value) {
    if (typeof value !== "string" || Number.isNaN(Date.parse(value))) return "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(value) && !validDateKey(value)) return "";
    return value.slice(0, 32);
  }

  function validDateKey(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T12:00:00`);
    return !Number.isNaN(date.getTime()) &&
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}` === value;
  }

  function makeId() {
    return globalThis.crypto?.randomUUID?.() || `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  return Object.freeze({ initialize, load, save, clear, flush, defaultState, makeId, normalize, validateImport });
})();
