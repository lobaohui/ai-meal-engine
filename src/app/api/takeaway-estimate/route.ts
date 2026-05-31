import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;
const ai = apiKey && apiKey !== "undefined" ? new GoogleGenAI({ apiKey }) : null;

export async function POST(req: NextRequest) {
  try {
    const { description } = await req.json();

    if (!description) {
      return NextResponse.json({ error: "Missing description" }, { status: 400 });
    }

    if (ai) {
      const prompt = `
        You are a highly skilled nutritionist. Analyze the following user text describing a takeaway meal they ate:
        "${description}"

        Estimate the macronutrient profile of this meal. Provide realistic values based on typical restaurant portion sizes:
        - "calories": Total energy content in kilocalories (as an integer number)
        - "protein": Total protein in grams (as an integer number)
        - "carbs": Total carbohydrates in grams (as an integer number)
        - "fat": Total fats in grams (as an integer number)
        - "friendlyDescription": A 1-sentence supportive and professional summary of the nutritional footprint you estimated.

        Return ONLY a raw JSON object containing these 5 fields. Do not include markdown code blocks or any other explanation.
      `;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });

      const responseText = response.text || "";
      const cleanJson = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
      const result = JSON.parse(cleanJson);

      return NextResponse.json(result);
    } else {
      // DYNAMIC KEYWORD MOCK ESTIMATOR
      console.log("GEMINI_API_KEY not configured. Running Takeaway Heuristic Keyword Parser...");
      await new Promise((resolve) => setTimeout(resolve, 800));

      const input = description.toLowerCase();
      let calories = 650;
      let protein = 25;
      let carbs = 70;
      let fat = 25;
      let friendlyDescription = "Estimated nutritional footprint based on a standard restaurant meal portion.";

      if (input.includes("burger") || input.includes("cheeseburger") || input.includes("chips") || input.includes("fries")) {
        calories = 950;
        protein = 38;
        carbs = 90;
        fat = 46;
        friendlyDescription = "A dense, carbohydrate and fat-heavy meal profile (heavy burger & fries). Adjusting subsequent meals.";
      } else if (input.includes("pizza")) {
        calories = 1100;
        protein = 42;
        carbs = 135;
        fat = 39;
        friendlyDescription = "Carbohydrate-rich pizza meal. Future plans will compensate by prioritizing lean proteins and greens.";
      } else if (input.includes("sushi") || input.includes("japanese")) {
        calories = 550;
        protein = 28;
        carbs = 80;
        fat = 10;
        friendlyDescription = "A clean, moderate carbohydrate and lean protein sushi dinner with very low fat density.";
      } else if (input.includes("salad") || input.includes("chicken salad")) {
        calories = 400;
        protein = 30;
        carbs = 15;
        fat = 22;
        friendlyDescription = "Excellent low-carbohydrate choice. High-density protein and healthy fats logged.";
      } else if (input.includes("curry") || input.includes("indian") || input.includes("korma") || input.includes("naan")) {
        calories = 880;
        protein = 32;
        carbs = 95;
        fat = 38;
        friendlyDescription = "Rich curry dish with high fat and carbohydrate density. Subsequent slots will lean out.";
      } else if (input.includes("kebab") || input.includes("shawarma")) {
        calories = 780;
        protein = 40;
        carbs = 60;
        fat = 35;
        friendlyDescription = "High-protein takeaway with substantial sodium and moderate fat content.";
      }

      return NextResponse.json({
        calories,
        protein,
        carbs,
        fat,
        friendlyDescription,
      });
    }
  } catch (error: any) {
    console.error("Takeaway estimation api error:", error);
    return NextResponse.json(
      { error: "Failed to estimate takeaway: " + error.message },
      { status: 500 }
    );
  }
}
