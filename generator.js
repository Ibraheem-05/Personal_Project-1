"use strict";

window.FitNaijaGenerator = (() => {
  const levelRank = { beginner: 0, intermediate: 1, advanced: 2 };

  function generateRoutine({ exercises, profile, sessions = [], focus = "general", now = new Date(), limit = 8 }) {
    const recent = sessions.filter(session => session.status === "completed" && Date.parse(session.date) >= now.getTime() - 14 * 86400000)
      .sort((a, b) => b.date.localeCompare(a.date) || (Date.parse(b.endAt || b.startAt) || 0) - (Date.parse(a.endAt || a.startAt) || 0));
    const recentIds = new Set(recent.slice(0, 2).flatMap(session => session.exercises.map(item => item.exerciseId)));
    const available = exercises.filter(exercise => {
      if (profile.excluded.includes(exercise.id)) return false;
      if (levelRank[exercise.level] > levelRank[profile.experience]) return false;
      if (!equipmentAvailable(exercise, profile.equipment)) return false;
      return exercise.focus.includes(focus) || focus === "general" || exercise.focus.includes("general");
    });
    const preferred = available.filter(exercise => !recentIds.has(exercise.id));
    const pool = preferred.length >= 3 ? preferred : available;
    const ordered = pool.map(exercise => ({
      exercise,
      score: (exercise.focus.includes(focus) ? 5 : 0) +
        (exercise.type === focus ? 3 : 0) +
        (exercise.level === profile.experience ? 1 : 0) +
        (recentIds.has(exercise.id) ? -5 : 0) +
        stableScore(exercise.id, localDate(now))
    })).sort((a, b) => b.score - a.score || a.exercise.name.localeCompare(b.exercise.name));

    const chosen = [];
    const muscles = new Set();
    const sessionMinutes = Math.max(15, Math.min(90, Number(profile.duration) || 30));
    let plannedMinutes = 5;
    for (const item of ordered) {
      if (chosen.length >= limit) break;
      const exercise = item.exercise;
      const hasNewMuscle = exercise.muscles.some(muscle => !muscles.has(muscle));
      if (!hasNewMuscle && chosen.length >= 3) continue;
      if (plannedMinutes + exercise.duration > sessionMinutes) continue;
      chosen.push(exercise);
      exercise.muscles.forEach(muscle => muscles.add(muscle));
      plannedMinutes += exercise.duration;
    }

    return {
      focus,
      exercises: chosen,
      durationMinutes: plannedMinutes,
      explanation: explain(chosen, focus, profile, recentIds.size),
      alternatives: available.filter(exercise => !chosen.includes(exercise)).slice(0, 4)
    };
  }

  function equipmentAvailable(exercise, available) {
    const equipment = exercise.equipment.filter(item => item !== "bodyweight");
    if (!equipment.length) return true;
    return exercise.equipmentMode === "any"
      ? equipment.some(item => available.includes(item))
      : equipment.every(item => available.includes(item));
  }

  function buildWeeklyPlan({ days = [], schedule = [], weekStart = new Date() }) {
    const start = new Date(weekStart);
    start.setHours(12, 0, 0, 0);
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    const preferredDays = new Set(days);
    const scheduledByDate = new Map(schedule.map(item => [item.date, item]));
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      const explicit = scheduledByDate.get(dateKey);
      const dayKey = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][date.getDay()];
      return {
        date: dateKey,
        kind: explicit?.kind || (preferredDays.has(dayKey) ? "workout" : "rest"),
        title: explicit?.title || (preferredDays.has(dayKey) ? "Suggested training" : "Rest and recover"),
        explicit: !!explicit,
        routineId: explicit?.routineId || ""
      };
    });
  }

  function explain(chosen, focus, profile, recentCount) {
    if (!chosen.length) return "No available exercises fit those preferences. Add equipment, remove an exclusion, or choose another focus.";
    const equipment = profile.equipment.length ? "your selected equipment" : "bodyweight options";
    const freshness = recentCount ? " We’ve also tried to vary recently trained moves." : "";
    return `${focusLabel(focus)} using ${equipment}, sized for about ${profile.duration} minutes and your ${profile.experience} experience.${freshness} You can edit the plan before starting.`;
  }

  function focusLabel(focus) {
    return { strength: "A strength session", cardio: "A cardio session", mobility: "A mobility session", general: "A balanced session" }[focus] || "A balanced session";
  }

  function stableScore(id, day) {
    return Array.from(`${id}-${day}`).reduce((score, char) => (score * 31 + char.charCodeAt(0)) % 997, 7) / 997;
  }

  function localDate(date) {
    return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
  }

  return Object.freeze({ generateRoutine, equipmentAvailable, buildWeeklyPlan });
})();
