import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;
const ai = apiKey && apiKey !== "undefined" ? new GoogleGenAI({ apiKey }) : null;

export async function POST(req: NextRequest) {
  try {
    const {
      targetCalories,
      targetProtein,
      targetCarbs,
      targetFat,
      pantry,
      dates,
      profile,
      downRegulate, // if true, down-regulate carbs and fat by 35%
    } = await req.json();

    if (!dates || !dates.length) {
      return NextResponse.json({ error: "Missing dates" }, { status: 400 });
    }

    // Determine target macronutrients per day, applying down-regulation to carbs/fats if takeaway log is active
    const adjCarbs = downRegulate ? Math.round(targetCarbs * 0.65) : targetCarbs;
    const adjFat = downRegulate ? Math.round(targetFat * 0.65) : targetFat;
    const adjCalories = Math.round(targetProtein * 4 + adjCarbs * 4 + adjFat * 9);

    if (ai) {
      const prompt = `
        You are an elite AI Culinary Engine and Chef. Generate a fully structured meal plan for the following dates:
        ${JSON.stringify(dates)}

        Metabolic Requirements per day:
        - Target Calories: ${adjCalories} kcal
        - Target Protein: ${targetProtein}g
        - Target Carbs: ${adjCarbs}g
        - Target Fat: ${adjFat}g

        Available Pantry Stock (use these ingredients to minimize grocery deficit):
        ${JSON.stringify(pantry)}

        Strict Guidelines:
        1. For each date, output 4 meal slots: "breakfast", "lunch", "dinner", and "snack".
        2. To reduce friction and cooking time, scale leftovers so that Lunch on any day is a duplicate of the previous day's Dinner (maximum 2-day window). For the first day, Lunch can be a fresh quick meal or leftover of Day 1 Breakfast/Lunch.
        3. Exclude protein powders completely. Focus on whole high-protein foods (chicken breast, salmon, eggs, cottage cheese, Greek yogurt).
        4. Integrate a mandatory snack of raw healthy nuts (almonds, walnuts) every single day to support hormonal health and meet micronutrient requirements.
        5. For each meal, specify:
           - "id": A unique short string (e.g. "b1", "l1", "d1")
           - "type": "breakfast" | "lunch" | "dinner" | "snack"
           - "recipeName": A premium, culinary-focused dish name
           - "instructions": Concise 2-3 step preparation instructions
           - "calories", "protein", "carbs", "fat": Accurate macronutrients (integers)
           - "ingredients": An array of ingredients used with "name", "weight" (in grams or ml), "unit" ("g", "ml", "unit"), and "category" ("Proteins", "Produce", "Fats/Nuts", "Flavor Bridges")
        6. The sum of calories, protein, carbs, and fat across the 4 meals of each day must be within +/- 5% of the daily targets.

        Return ONLY a raw JSON object with the dates as keys, mapping to the daily plan:
        {
          "YYYY-MM-DD": {
            "date": "YYYY-MM-DD",
            "meals": [ ... ]
          }
        }
        Do not include markdown code blocks, backticks, or any other wrapper.
      `;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });

      const responseText = response.text || "";
      const cleanJson = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
      const plan = JSON.parse(cleanJson);

      return NextResponse.json({ plan });
    } else {
      // HIGH-FIDELITY MEAL CULINARY ENGINE SIMULATOR
      console.log("GEMINI_API_KEY not configured. Generating meal plan via Local Culinary Engine Simulator...");
      await new Promise((resolve) => setTimeout(resolve, 1500));

      const plan: Record<string, any> = {};

      // Seed recipes database for simulator
      const getMockRecipes = (dayIndex: number, isDownRegulated: boolean) => {
        const carbFactor = isDownRegulated ? 0.65 : 1.0;
        const fatFactor = isDownRegulated ? 0.65 : 1.0;

        // Base recipe sizes scaled to targets
        const pRatio = targetProtein / 160; // scale based on protein target
        const cRatio = (targetCarbs * carbFactor) / 180;
        const fRatio = (targetFat * fatFactor) / 60;

        const breakfast = {
          id: `b-${dayIndex}`,
          type: "breakfast" as const,
          recipeName: dayIndex % 2 === 0 ? "Aesthetic Salmon Avocado Toast" : "Egg White Spinach Scramble",
          instructions: "Whisk egg whites with chopped spinach. Toast whole grain bread, spread mashed avocado, and layer with smoked salmon or scrambled eggs. Season lightly with black pepper.",
          ingredients: dayIndex % 2 === 0 ? [
            { name: "Fresh Atlantic Salmon", weight: Math.round(100 * pRatio), unit: "g", category: "Proteins" },
            { name: "Egg", weight: 2, unit: "unit", category: "Proteins" },
            { name: "Avocado", weight: Math.round(60 * fRatio), unit: "g", category: "Fats/Nuts" },
            { name: "Bread Slice", weight: Math.round(50 * cRatio), unit: "g", category: "Produce" }
          ] : [
            { name: "Egg", weight: 4, unit: "unit", category: "Proteins" },
            { name: "Organic Baby Spinach", weight: Math.round(50 * cRatio), unit: "g", category: "Produce" },
            { name: "Cold Pressed Olive Oil", weight: Math.round(5 * fRatio), unit: "ml", category: "Fats/Nuts" },
            { name: "Bread Slice", weight: Math.round(50 * cRatio), unit: "g", category: "Produce" }
          ],
          calories: Math.round(400 * ((pRatio + cRatio + fRatio) / 3)),
          protein: Math.round(35 * pRatio),
          carbs: Math.round(30 * cRatio),
          fat: Math.round(15 * fRatio),
          status: "pending" as const
        };

        const dinner = {
          id: `d-${dayIndex}`,
          type: "dinner" as const,
          recipeName: dayIndex % 2 === 0 ? "Lemon Garlic Chicken & Broccoli" : "Glazed Soy Ginger Salmon",
          instructions: dayIndex % 2 === 0 
            ? "Pan-sear chicken breast in olive oil with minced garlic. Steam broccoli florets. Serve hot with a squeeze of fresh lemon."
            : "Bake salmon fillet topped with a soy-ginger glaze. Stir-fry baby spinach with sesame seeds and serve alongside baked sweet potato.",
          ingredients: dayIndex % 2 === 0 ? [
            { name: "Premium Chicken Breast", weight: Math.round(250 * pRatio), unit: "g", category: "Proteins" },
            { name: "Broccoli Florets", weight: Math.round(150 * cRatio), unit: "g", category: "Produce" },
            { name: "Cold Pressed Olive Oil", weight: Math.round(10 * fRatio), unit: "ml", category: "Fats/Nuts" },
            { name: "Fresh Garlic Bulb", weight: 1, unit: "unit", category: "Flavor Bridges" }
          ] : [
            { name: "Fresh Atlantic Salmon", weight: Math.round(220 * pRatio), unit: "g", category: "Proteins" },
            { name: "Organic Baby Spinach", weight: Math.round(150 * cRatio), unit: "g", category: "Produce" },
            { name: "Organic Soy Sauce", weight: Math.round(15 * cRatio), unit: "ml", category: "Flavor Bridges" },
            { name: "Cold Pressed Olive Oil", weight: Math.round(5 * fRatio), unit: "ml", category: "Fats/Nuts" }
          ],
          calories: Math.round(500 * ((pRatio + cRatio + fRatio) / 3)),
          protein: Math.round(55 * pRatio),
          carbs: Math.round(20 * cRatio),
          fat: Math.round(20 * fRatio),
          status: "pending" as const
        };

        // Leftover logic: Lunch is dinner of the previous day!
        const lunch = {
          id: `l-${dayIndex}`,
          type: "lunch" as const,
          recipeName: dayIndex === 0 
            ? "Pan-Seared Salmon Salad Bowl" // Day 1 lunch is fresh
            : `Leftover: ${dayIndex % 2 === 1 ? "Lemon Garlic Chicken & Broccoli" : "Glazed Soy Ginger Salmon"}`,
          instructions: dayIndex === 0 
            ? "Toss grilled salmon with baby spinach, shredded broccoli, and dress with a light olive oil dressing."
            : "Reheat the leftover dinner from yesterday. Fast, high-protein, and ready to go.",
          ingredients: dayIndex === 0 ? [
            { name: "Fresh Atlantic Salmon", weight: Math.round(150 * pRatio), unit: "g", category: "Proteins" },
            { name: "Organic Baby Spinach", weight: Math.round(80 * cRatio), unit: "g", category: "Produce" },
            { name: "Cold Pressed Olive Oil", weight: Math.round(5 * fRatio), unit: "ml", category: "Fats/Nuts" }
          ] : (dayIndex % 2 === 1 ? [
            { name: "Premium Chicken Breast", weight: Math.round(250 * pRatio), unit: "g", category: "Proteins" },
            { name: "Broccoli Florets", weight: Math.round(150 * cRatio), unit: "g", category: "Produce" },
            { name: "Cold Pressed Olive Oil", weight: Math.round(10 * fRatio), unit: "ml", category: "Fats/Nuts" }
          ] : [
            { name: "Fresh Atlantic Salmon", weight: Math.round(220 * pRatio), unit: "g", category: "Proteins" },
            { name: "Organic Baby Spinach", weight: Math.round(150 * cRatio), unit: "g", category: "Produce" },
            { name: "Cold Pressed Olive Oil", weight: Math.round(5 * fRatio), unit: "ml", category: "Fats/Nuts" }
          ]),
          calories: dayIndex === 0 ? Math.round(400 * ((pRatio + cRatio + fRatio) / 3)) : Math.round(500 * ((pRatio + cRatio + fRatio) / 3)),
          protein: dayIndex === 0 ? Math.round(35 * pRatio) : Math.round(55 * pRatio),
          carbs: dayIndex === 0 ? Math.round(10 * cRatio) : Math.round(20 * cRatio),
          fat: dayIndex === 0 ? Math.round(12 * fRatio) : Math.round(20 * fRatio),
          status: "pending" as const
        };

        const snack = {
          id: `s-${dayIndex}`,
          type: "snack" as const,
          recipeName: "Raw Almond & Walnut Hormonal Bridge",
          instructions: "Measure out raw almonds and walnuts. Consume alongside water or unsweetened herbal tea for immediate micronutrient replenishment.",
          ingredients: [
            { name: "Raw Unsalted Almonds", weight: Math.round(30 * fRatio), unit: "g", category: "Fats/Nuts" }
          ],
          calories: Math.round(180 * fRatio),
          protein: Math.round(6 * pRatio),
          carbs: Math.round(6 * cRatio),
          fat: Math.round(15 * fRatio),
          status: "pending" as const
        };

        // Align daily totals to target macro inputs
        const mealsList = [breakfast, lunch, dinner, snack];
        const sumCalories = mealsList.reduce((acc, m) => acc + m.calories, 0);
        const sumProtein = mealsList.reduce((acc, m) => acc + m.protein, 0);
        const sumCarbs = mealsList.reduce((acc, m) => acc + m.carbs, 0);
        const sumFat = mealsList.reduce((acc, m) => acc + m.fat, 0);

        // Adjust snack slightly to perfectly match targets
        snack.calories += adjCalories - sumCalories;
        snack.protein += targetProtein - sumProtein;
        snack.carbs += adjCarbs - sumCarbs;
        snack.fat += adjFat - sumFat;

        return mealsList;
      };

      dates.forEach((date: string, i: number) => {
        plan[date] = {
          date,
          meals: getMockRecipes(i, downRegulate),
        };
      });

      return NextResponse.json({ plan });
    }
  } catch (error: any) {
    console.error("Meal generation api error:", error);
    return NextResponse.json(
      { error: "Failed to generate meals: " + error.message },
      { status: 500 }
    );
  }
}
