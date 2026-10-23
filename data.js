"use strict";

window.FitNaijaData = Object.freeze({
  days: [
    { id: "mon", label: "Monday", short: "M" },
    { id: "tue", label: "Tuesday", short: "T" },
    { id: "wed", label: "Wednesday", short: "W" },
    { id: "thu", label: "Thursday", short: "T" },
    { id: "fri", label: "Friday", short: "F" },
    { id: "sat", label: "Saturday", short: "S" },
    { id: "sun", label: "Sunday", short: "S" }
  ],
  interests: [
    { id: "strength", label: "Strength" },
    { id: "cardio", label: "Cardio" },
    { id: "mobility", label: "Mobility" },
    { id: "general", label: "General fitness" }
  ],
  equipment: [
    { id: "dumbbells", label: "Dumbbells" },
    { id: "barbell", label: "Barbell" },
    { id: "bands", label: "Resistance bands" },
    { id: "bench", label: "Bench" },
    { id: "kettlebell", label: "Kettlebell" },
    { id: "cardio-machine", label: "Cardio machine" },
    { id: "other", label: "Other equipment" }
  ],
  exercises: [
    { id: "squat", name: "Chair squat", type: "strength", muscles: ["legs", "glutes"], equipment: ["bodyweight"], level: "beginner", duration: 5, instructions: "Stand in front of a stable chair. Sit your hips back until you lightly touch it, then stand with control. Keep the range comfortable.", alternative: "Sit-to-stand with arm support", focus: ["strength", "general"] },
    { id: "pushup-wall", name: "Wall push-up", type: "strength", muscles: ["chest", "shoulders", "arms"], equipment: ["bodyweight"], level: "beginner", duration: 5, instructions: "Place your palms on a wall at chest height. Keep your body in a comfortable straight line, bend your elbows toward the wall, and press away.", alternative: "Wall press with a shorter range", focus: ["strength", "general"] },
    { id: "hinge", name: "Hip hinge", type: "strength", muscles: ["glutes", "hamstrings", "back"], equipment: ["bodyweight"], level: "beginner", duration: 5, instructions: "Stand tall, soften your knees, and gently send your hips back while keeping your back comfortable. Return to standing.", alternative: "Seated hip hinge", focus: ["strength", "general"] },
    { id: "glute-bridge", name: "Glute bridge", type: "strength", muscles: ["glutes", "hamstrings"], equipment: ["bodyweight"], level: "beginner", duration: 5, instructions: "Lie on your back with knees bent. Gently press through your feet and lift your hips to a comfortable height; lower with control.", alternative: "Standing glute squeeze", focus: ["strength", "general"] },
    { id: "calf-raise", name: "Supported calf raise", type: "strength", muscles: ["calves"], equipment: ["bodyweight"], level: "beginner", duration: 4, instructions: "Hold a stable support, rise onto the balls of your feet, pause briefly, then lower with control.", alternative: "Seated calf raise", focus: ["strength", "general"] },
    { id: "step-up", name: "Low step-up", type: "strength", muscles: ["legs", "glutes"], equipment: ["bodyweight", "bench"], level: "beginner", duration: 5, instructions: "Use a low, stable step. Step up and down with control, holding a rail if helpful. Choose a height that feels steady.", alternative: "Chair sit-to-stand", focus: ["strength", "general"] },
    { id: "row-band", name: "Resistance-band row", type: "strength", muscles: ["back", "arms"], equipment: ["bands"], level: "beginner", duration: 6, instructions: "Secure the band safely at chest height. Pull your elbows back, keeping shoulders relaxed; return slowly.", alternative: "Light band pull-apart", focus: ["strength", "general"] },
    { id: "row-dumbbell", name: "Supported dumbbell row", type: "strength", muscles: ["back", "arms"], equipment: ["dumbbells", "bench"], level: "intermediate", duration: 6, instructions: "Support yourself on a bench or chair. Row one dumbbell toward your hip while keeping your back comfortable; lower slowly.", alternative: "Resistance-band row", focus: ["strength", "general"] },
    { id: "press-dumbbell", name: "Seated dumbbell press", type: "strength", muscles: ["shoulders", "arms"], equipment: ["dumbbells"], level: "intermediate", duration: 6, instructions: "Sit with feet grounded. Press light dumbbells upward only through a comfortable shoulder range; lower with control.", alternative: "Wall push-up", focus: ["strength", "general"] },
    { id: "deadlift-kettlebell", name: "Kettlebell deadlift", type: "strength", muscles: ["glutes", "hamstrings", "back"], equipment: ["kettlebell"], level: "intermediate", duration: 6, instructions: "Stand over the kettlebell with feet comfortable. Hinge at the hips, hold the handle, and stand tall without rushing. Start light.", alternative: "Bodyweight hip hinge", focus: ["strength", "general"] },
    { id: "squat-goblet", name: "Goblet squat", type: "strength", muscles: ["legs", "glutes", "core"], equipment: ["dumbbells", "kettlebell"], equipmentMode: "any", level: "intermediate", duration: 6, instructions: "Hold a light weight close to your chest. Sit your hips back and bend your knees through a comfortable range; stand with control.", alternative: "Chair squat", focus: ["strength", "general"] },
    { id: "march", name: "Easy march in place", type: "cardio", muscles: ["legs", "heart"], equipment: ["bodyweight"], level: "beginner", duration: 5, instructions: "March at a pace that lets you stay comfortable. Use a wall or chair for balance if helpful.", alternative: "Seated march", focus: ["cardio", "general"] },
    { id: "walk", name: "Brisk walk", type: "cardio", muscles: ["legs", "heart"], equipment: ["bodyweight"], level: "beginner", duration: 10, instructions: "Walk at a pace that feels lively but manageable. Slow down or pause whenever you need.", alternative: "Easy indoor walk", focus: ["cardio", "general"] },
    { id: "step-jack", name: "Step jack", type: "cardio", muscles: ["legs", "heart"], equipment: ["bodyweight"], level: "beginner", duration: 5, instructions: "Step one foot out at a time while raising your arms only as far as comfortable. Keep this low impact.", alternative: "Seated side taps", focus: ["cardio", "general"] },
    { id: "bike", name: "Easy bike ride", type: "cardio", muscles: ["legs", "heart"], equipment: ["cardio-machine"], level: "beginner", duration: 10, instructions: "Choose an easy, steady pace on a stationary or outdoor bike. Adjust resistance to a level that feels manageable.", alternative: "Easy walk", focus: ["cardio", "general"] },
    { id: "box-breathing", name: "Gentle breathing reset", type: "mobility", muscles: ["breathing"], equipment: ["bodyweight"], level: "beginner", duration: 4, instructions: "Sit comfortably. Let your breathing stay natural and easy for a few minutes; skip counted breath holds if uncomfortable.", alternative: "Quiet seated rest", focus: ["mobility", "general"] },
    { id: "cat-cow", name: "Gentle cat-cow", type: "mobility", muscles: ["back", "core"], equipment: ["bodyweight"], level: "beginner", duration: 5, instructions: "On hands and knees or seated, gently alternate rounding and lengthening your back within a comfortable range.", alternative: "Seated shoulder rolls", focus: ["mobility", "general"] },
    { id: "hip-mobility", name: "Standing hip circles", type: "mobility", muscles: ["hips"], equipment: ["bodyweight"], level: "beginner", duration: 4, instructions: "Stand near a support. Make small, slow hip circles in each direction without forcing the range.", alternative: "Seated ankle circles", focus: ["mobility", "general"] },
    { id: "shoulder-roll", name: "Shoulder rolls", type: "mobility", muscles: ["shoulders", "upper back"], equipment: ["bodyweight"], level: "beginner", duration: 3, instructions: "Sit or stand tall. Gently roll your shoulders up, back, and down; keep the movement relaxed.", alternative: "Small shoulder shrugs", focus: ["mobility", "general"] },
    { id: "stretch-hamstring", name: "Seated hamstring stretch", type: "mobility", muscles: ["hamstrings"], equipment: ["bodyweight"], level: "beginner", duration: 4, instructions: "Sit near the edge of a stable chair. Extend one leg comfortably and hinge forward slightly until you feel a gentle stretch; never bounce.", alternative: "Lying hamstring stretch with a towel", focus: ["mobility", "general"] }
  ],
  ingredients: [
    { id: "rice", name: "Rice", group: "Staples" }, { id: "beans", name: "Beans", group: "Staples" },
    { id: "yam", name: "Yam", group: "Staples" }, { id: "plantain", name: "Plantain", group: "Staples" },
    { id: "sweet-potato", name: "Sweet potato", group: "Staples" }, { id: "oats", name: "Oats", group: "Staples" },
    { id: "garri", name: "Garri", group: "Staples" }, { id: "millet", name: "Millet", group: "Staples" },
    { id: "tomato", name: "Tomato", group: "Vegetables & fruit" }, { id: "onion", name: "Onion", group: "Vegetables & fruit" },
    { id: "pepper", name: "Pepper", group: "Vegetables & fruit" }, { id: "ugu", name: "Ugu / pumpkin leaves", group: "Vegetables & fruit" },
    { id: "spinach", name: "Spinach", group: "Vegetables & fruit" }, { id: "okra", name: "Okra", group: "Vegetables & fruit" },
    { id: "banana", name: "Banana", group: "Vegetables & fruit" }, { id: "eggs", name: "Eggs", group: "Protein foods" },
    { id: "fish", name: "Fish", group: "Protein foods" }, { id: "sardines", name: "Sardines", group: "Protein foods" },
    { id: "chicken", name: "Chicken", group: "Protein foods" }, { id: "groundnut", name: "Groundnuts / peanut", group: "Protein foods" },
    { id: "egusi", name: "Egusi / melon seeds", group: "Protein foods" }, { id: "black-eyed-peas", name: "Black-eyed peas", group: "Protein foods" },
    { id: "palm-oil", name: "Palm oil", group: "Pantry" }, { id: "oil", name: "Cooking oil", group: "Pantry" }
  ],
  meals: [
    { name: "Beans & rice with tomato stew", ingredients: ["beans", "rice", "tomato", "onion", "pepper"], note: "Cook beans until tender; serve with rice and tomato-onion-pepper stew." },
    { name: "Yam with egg and tomato", ingredients: ["yam", "eggs", "tomato", "onion", "pepper"], note: "Boil yam and pair with eggs gently scrambled in tomato, onion, and pepper." },
    { name: "Ugu and fish soup", ingredients: ["ugu", "fish", "tomato", "onion", "pepper", "palm-oil"], note: "Simmer fish with tomato, onion, and pepper; fold in ugu near the end." },
    { name: "Okra and sardine bowl", ingredients: ["okra", "sardines", "tomato", "onion", "pepper"], note: "Cook chopped okra with tomato and seasoning; add sardines near the end." },
    { name: "Moi moi-inspired bean pudding", ingredients: ["black-eyed-peas", "eggs", "onion", "pepper", "oil"], note: "Blend soaked peas with onion and pepper; steam in a heat-safe dish until set." },
    { name: "Jollof-style rice with chicken", ingredients: ["rice", "chicken", "tomato", "onion", "pepper", "oil"], note: "Cook rice in a tomato-pepper base and serve with thoroughly cooked chicken." },
    { name: "Plantain, beans and greens", ingredients: ["plantain", "beans", "spinach", "onion", "pepper"], note: "Pair beans with cooked plantain and a quick spinach, onion, and pepper sauté." },
    { name: "Egusi and leafy greens", ingredients: ["egusi", "ugu", "spinach", "fish", "tomato", "onion", "palm-oil"], note: "Simmer ground egusi with greens and fish; adjust oil to your preference." },
    { name: "Oats, banana and groundnuts", ingredients: ["oats", "banana", "groundnut"], note: "Prepare oats and top with sliced banana and a small handful of groundnuts." },
    { name: "Sweet potato with sardines and greens", ingredients: ["sweet-potato", "sardines", "spinach", "tomato", "onion"], note: "Bake or boil sweet potato; serve with sardines and lightly cooked greens." },
    { name: "Millet porridge with banana", ingredients: ["millet", "banana", "groundnut"], note: "Cook millet into a soft porridge and top with banana and groundnuts." },
    { name: "Garri with okra and fish", ingredients: ["garri", "okra", "fish", "tomato", "onion", "pepper"], note: "Prepare garri according to package instructions and serve with okra and fish stew." }
  ]
});
