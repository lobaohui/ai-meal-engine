import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { normalizePantryKey } from "@/lib/firebase";

const apiKey = process.env.GEMINI_API_KEY;
const ai = apiKey && apiKey !== "undefined" ? new GoogleGenAI({ apiKey }) : null;

interface DeficitItem {
  name: string;
  required: number;
  stocked: number;
  deficit: number;
  unit: "g" | "ml" | "unit";
  category: string;
}

export async function POST(req: NextRequest) {
  try {
    const { requiredIngredients, pantry } = await req.json();

    if (!requiredIngredients) {
      return NextResponse.json({ error: "Missing required ingredients" }, { status: 400 });
    }

    // 1. Map current pantry items by normalized name
    const pantryMap = new Map<string, number>();
    pantry.forEach((item: any) => {
      pantryMap.set(normalizePantryKey(item.name), item.quantity);
    });

    // 2. Aggregate all required ingredients across the date range
    const reqAggMap = new Map<string, { name: string; required: number; unit: any; category: string }>();
    requiredIngredients.forEach((ing: any) => {
      const key = normalizePantryKey(ing.name);
      const existing = reqAggMap.get(key);
      if (existing) {
        existing.required += ing.weight;
      } else {
        reqAggMap.set(key, {
          name: ing.name,
          required: ing.weight,
          unit: ing.unit,
          category: ing.category,
        });
      }
    });

    // 3. Compute net deficits
    const deficits: DeficitItem[] = [];
    reqAggMap.forEach((val, key) => {
      const stocked = pantryMap.get(key) || 0;
      const deficit = val.required - stocked;
      if (deficit > 0) {
        deficits.push({
          name: val.name,
          required: Math.round(val.required),
          stocked: Math.round(stocked),
          deficit: Math.round(deficit),
          unit: val.unit,
          category: val.category,
        });
      }
    });

    if (deficits.length === 0) {
      return NextResponse.json({ shoppingList: [] });
    }

    if (ai) {
      const prompt = `
        You are a smart shopping list compiler. Review these ingredient deficits (amount needed vs stocked in pantry):
        ${JSON.stringify(deficits)}

        Convert each mathematical deficit into a realistic retail commercial packaging size.
        For example:
        - Chicken Breast deficit of 420g -> "1x 500g Pack" (packSize: 500, purchaseQty: 1, packageUnit: "g", packageName: "500g Pack")
        - Spinach deficit of 260g -> "2x 200g Bag" (packSize: 200, purchaseQty: 2, packageUnit: "g", packageName: "200g Bag")
        - Egg deficit of 8 units -> "1x Carton of 10" or "2x Carton of 6" (packSize: 10 or 6, purchaseQty: 1 or 2, packageUnit: "unit", packageName: "Carton of 10")
        - Olive Oil deficit of 120ml -> "1x 250ml Bottle" (packSize: 250, purchaseQty: 1, packageUnit: "ml", packageName: "250ml Bottle")

        For each item, output a JSON array of objects with the exact fields:
        - "name": Original ingredient name
        - "deficitQty": The deficit amount (number)
        - "unit": "g" | "ml" | "unit"
        - "packageName": Description of the packaging (e.g. "500g Pack", "Carton of 6")
        - "packageSize": The size of ONE package (number, e.g. 500 or 6)
        - "packageUnit": "g" | "ml" | "unit"
        - "purchaseQty": The number of packages to buy (number, e.g. 1, 2)
        - "category": The food category (one of: "Proteins", "Produce", "Fats/Nuts", "Flavor Bridges")

        Calculate "purchaseQty" so that: (purchaseQty * packageSize) >= deficitQty.
        Return ONLY a raw JSON array matching this schema, without markdown formatting or other text.
      `;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });

      const responseText = response.text || "";
      const cleanJson = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
      const shoppingList = JSON.parse(cleanJson);

      return NextResponse.json({ shoppingList });
    } else {
      // RULE-BASED PACKAGING ROUNDER SIMULATOR
      console.log("GEMINI_API_KEY not configured. Running Rule-Based Packaging Rounder Simulator...");
      await new Promise((resolve) => setTimeout(resolve, 800));

      const shoppingList = deficits.map((def) => {
        const norm = normalizePantryKey(def.name);
        let packageSize = 250;
        let packageName = "250g Pack";
        let packageUnit = def.unit;

        if (norm.includes("chicken")) {
          packageSize = 500;
          packageName = "500g Pack";
        } else if (norm.includes("salmon")) {
          packageSize = 300;
          packageName = "300g Pack";
        } else if (norm.includes("spinach")) {
          packageSize = 200;
          packageName = "200g Bag";
        } else if (norm.includes("broccoli")) {
          packageSize = 250;
          packageName = "250g Bag";
        } else if (norm.includes("potato")) {
          packageSize = 500;
          packageName = "500g Bag";
        } else if (norm.includes("almond")) {
          packageSize = 200;
          packageName = "200g Bag";
        } else if (norm.includes("oil")) {
          packageSize = 500;
          packageName = "500ml Bottle";
          packageUnit = "ml";
        } else if (norm.includes("sauce")) {
          packageSize = 250;
          packageName = "250ml Bottle";
          packageUnit = "ml";
        } else if (norm.includes("egg")) {
          packageSize = 6;
          packageName = "Carton of 6";
          packageUnit = "unit";
        } else if (norm.includes("garlic")) {
          packageSize = 3;
          packageName = "3x Mesh Bag";
          packageUnit = "unit";
        } else {
          // Fallback sizes
          if (def.unit === "g") {
            packageSize = def.deficit > 250 ? 500 : 250;
            packageName = `${packageSize}g Pack`;
          } else if (def.unit === "ml") {
            packageSize = 250;
            packageName = "250ml Bottle";
          } else {
            packageSize = 1;
            packageName = "1x Single Unit";
          }
        }

        const purchaseQty = Math.ceil(def.deficit / packageSize);

        return {
          name: def.name,
          deficitQty: def.deficit,
          unit: def.unit,
          packageName,
          packageSize,
          packageUnit,
          purchaseQty,
          category: def.category,
        };
      });

      return NextResponse.json({ shoppingList });
    }
  } catch (error: any) {
    console.error("Shopping list rounding api error:", error);
    return NextResponse.json(
      { error: "Failed to compile shopping list: " + error.message },
      { status: 500 }
    );
  }
}
