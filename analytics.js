"use strict";

window.KarfivoAnalytics = (() => {
  const DAY_MS = 86400000;

  function dateKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function shiftDate(date, days) {
    const result = new Date(date.getFullYear(), date.getMonth(), date.getDate() + days, 12);
    return result;
  }

  function completed(sessions) {
    return sessions.filter(session => session.status === "completed" && /^\d{4}-\d{2}-\d{2}$/.test(session.date));
  }

  function filterSessions(sessions, range = "30", now = new Date()) {
    const items = completed(sessions);
    if (range === "all") return items.filter(session => session.date <= dateKey(now));
    const days = [7, 30, 90, 365].includes(Number(range)) ? Number(range) : 30;
    const firstDay = dateKey(shiftDate(now, 1 - days));
    const lastDay = dateKey(now);
    return items.filter(session => session.date >= firstDay && session.date <= lastDay);
  }

  function calculateStats(sessions) {
    const items = completed(sessions);
    return {
      sessions: items.length,
      minutes: items.reduce((sum, session) => sum + finiteNonnegative(session.durationMinutes), 0),
      activeDays: new Set(items.map(session => session.date)).size,
      sets: items.reduce((sum, session) => sum + (session.exercises || []).reduce((exerciseSum, exercise) =>
        exerciseSum + (exercise.sets || []).filter(set => set.completed === true).length, 0), 0)
    };
  }

  function bucketSessions(sessions, range = "30", now = new Date()) {
    const days = range === "all"
      ? Math.max(1, Math.floor((Date.parse(`${dateKey(now)}T12:00:00`) - oldestDate(sessions, now)) / DAY_MS) + 1)
      : [7, 30, 90, 365].includes(Number(range)) ? Number(range) : 30;
    const count = range === "all" ? Math.min(12, days) : days <= 7 ? 7 : days <= 30 ? 7 : 12;
    const first = shiftDate(now, 1 - days);
    const items = completed(sessions);
    return Array.from({ length: count }, (_, index) => {
      const begin = shiftDate(first, Math.floor(index * days / count));
      const end = shiftDate(first, Math.floor((index + 1) * days / count));
      const fromKey = dateKey(begin);
      const toKey = dateKey(end);
      const bucket = items.filter(session => session.date >= fromKey && session.date < toKey);
      return {
        label: days <= 7
          ? new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(begin)
          : days <= 30
            ? new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(begin)
            : new Intl.DateTimeFormat(undefined, { month: "short", year: "2-digit" }).format(begin),
        sessions: bucket.length,
        minutes: bucket.reduce((sum, session) => sum + finiteNonnegative(session.durationMinutes), 0),
        sets: bucket.reduce((sum, session) => sum + completedSetCount(session), 0)
      };
    });
  }

  function personalRecords(sessions) {
    const records = new Map();
    completed(sessions).forEach(session => {
      (session.exercises || []).forEach(exercise => (exercise.sets || []).filter(set => set.completed).forEach(set => {
        const record = records.get(exercise.exerciseId) || {
          exerciseId: exercise.exerciseId,
          weight: null, weightDate: "",
          reps: null, repsDate: "",
          durationSeconds: null, durationDate: "",
          distanceMeters: null, distanceDate: ""
        };
        updateRecord(record, "weight", set.weight, session.date);
        updateRecord(record, "reps", set.reps, session.date);
        updateRecord(record, "durationSeconds", set.durationSeconds, session.date);
        updateRecord(record, "distanceMeters", set.distanceMeters, session.date);
        records.set(exercise.exerciseId, record);
      }));
    });
    return [...records.values()].filter(record =>
      record.weight !== null || record.reps !== null || record.durationSeconds !== null || record.distanceMeters !== null);
  }

  function updateRecord(record, property, value, date) {
    const number = Number(value);
    if (value === null || value === undefined || value === "" || !Number.isFinite(number) || number < 0) return;
    if (record[property] === null || number > record[property] || number === record[property] && date > record[`${property}Date`]) {
      record[property] = number;
      record[`${property}Date`] = date;
    }
  }

  function categoryDistribution(sessions, exercises) {
    const types = new Map(exercises.map(exercise => [exercise.id, exercise.type]));
    const counts = { strength: 0, cardio: 0, mobility: 0 };
    completed(sessions).forEach(session => (session.exercises || []).forEach(exercise => {
      const type = types.get(exercise.exerciseId);
      if (Object.hasOwn(counts, type)) counts[type] += (exercise.sets || []).filter(set => set.completed).length;
    }));
    return Object.entries(counts).map(([type, sets]) => ({ type, sets })).filter(item => item.sets > 0);
  }

  function insights(sessions, exercises, now = new Date(), allSessions = sessions) {
    const items = completed(sessions);
    if (!items.length) return [];
    const exerciseNames = new Map(exercises.map(exercise => [exercise.id, exercise.name]));
    const exerciseCounts = new Map();
    const weekdays = new Map();
    items.forEach(session => {
      const day = new Date(`${session.date}T12:00:00`).getDay();
      weekdays.set(day, (weekdays.get(day) || 0) + 1);
      (session.exercises || []).forEach(exercise => {
        const sets = (exercise.sets || []).filter(set => set.completed).length;
        if (sets) exerciseCounts.set(exercise.exerciseId, (exerciseCounts.get(exercise.exerciseId) || 0) + sets);
      });
    });
    const result = [];
    const frequent = [...exerciseCounts.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))[0];
    if (frequent) result.push({ id: "frequent-exercise", text: `${exerciseNames.get(frequent[0]) || frequent[0]} is your most frequently logged exercise (${frequent[1]} completed sets).` });
    const activeDay = [...weekdays.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0];
    if (activeDay) {
      const label = new Intl.DateTimeFormat(undefined, { weekday: "long" }).format(new Date(2024, 0, 7 + activeDay[0], 12));
      result.push({ id: "active-weekday", text: `${label} is your most active training day (${activeDay[1]} ${activeDay[1] === 1 ? "session" : "sessions"}).` });
    }
    const timedSessions = items.filter(session => finiteNonnegative(session.durationMinutes) > 0);
    const minutes = timedSessions.reduce((sum, session) => sum + finiteNonnegative(session.durationMinutes), 0);
    if (timedSessions.length) result.push({ id: "average-duration", text: `Your average completed workout is ${Math.round(minutes / timedSessions.length)} minutes.` });
    const month = dateKey(now).slice(0, 7);
    const thisMonth = completed(allSessions).filter(session => session.date.slice(0, 7) === month).length;
    if (thisMonth) result.push({ id: "month-sessions", text: `You have completed ${thisMonth} ${thisMonth === 1 ? "session" : "sessions"} this month.` });
    return result;
  }

  function oldestDate(sessions, now) {
    const dates = completed(sessions).map(session => session.date).filter(date => date <= dateKey(now)).sort();
    return dates.length ? Date.parse(`${dates[0]}T12:00:00`) : Date.parse(`${dateKey(now)}T12:00:00`);
  }

  function completedSetCount(session) {
    return (session.exercises || []).reduce((sum, exercise) =>
      sum + (exercise.sets || []).filter(set => set.completed).length, 0);
  }

  function finiteNonnegative(value) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : 0;
  }

  return Object.freeze({ filterSessions, calculateStats, bucketSessions, personalRecords, categoryDistribution, insights });
})();
