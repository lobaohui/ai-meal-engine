import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

// Initialize Gemini AI Client
const apiKey = process.env.GEMINI_API_KEY;
const ai = apiKey && apiKey !== "undefined" ? new GoogleGenAI({ apiKey }) : null;

export async function POST(req: NextRequest) {
  try {
    const { image } = await req.json();

    if (!image) {
      return NextResponse.json({ error: "Missing image data" }, { status: 400 });
    }

    // Check if Gemini is configured, otherwise fallback to the high-fidelity simulator
    if (ai) {
      // image is a base64 data URL (e.g. "data:image/jpeg;base64,...")
      // Extract the mime type and raw base64 data
      const match = image.match(/^data:([^;]+);base64,(.+)$/);
      if (!match) {
        return NextResponse.json({ error: "Invalid image format" }, { status: 400 });
      }

      const mimeType = match[1];
      const base64Data = match[2];

      const prompt = `
        Analyze this grocery store receipt image. Parse all purchased food items.
        Normalize the parsed items into a clean JSON array of ingredients with the following exact fields:
        - "name": Standardized food name (e.g., "Chicken Breast", "Baby Spinach", "Almonds")
        - "quantity": The weight or number of units bought (as a number, e.g., 500, 1, 250)
        - "unit": "g" for weight, "ml" for liquids, "unit" for individual items like eggs, onions, garlic
        - "category": Must be one of: "Proteins", "Produce", "Fats/Nuts", "Flavor Bridges"

        Ensure standard packaging sizes are converted to grams (e.g., "0.5 kg" -> 500, "250 gram" -> 250).
        If you see non-food items (e.g. bags, cleaning supplies, utensils), ignore them.
        Return ONLY a raw JSON array matching this schema, without markdown code fences or any other text.
      `;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          prompt,
          {
            inlineData: {
              data: base64Data,
              mimeType: mimeType,
            },
          },
        ],
      });

      const responseText = response.text || "";
      // Clean up markdown block formatting if Gemini returns it
      const cleanJson = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
      const parsedItems = JSON.parse(cleanJson);

      return NextResponse.json({ items: parsedItems });
    } else {
      // HIGH-FIDELITY SIMULATOR
      console.log("GEMINI_API_KEY not configured. Triggering Receipt Triage Mock Simulator...");
      
      // Artificial delay to simulate real OCR scanning
      await new Promise((resolve) => setTimeout(resolve, 1500));

      const mockParsedReceipt = [
        { name: "Premium Chicken Breast", quantity: 1200, unit: "g", category: "Proteins" },
        { name: "Fresh Atlantic Salmon", quantity: 600, unit: "g", category: "Proteins" },
        { name: "Organic Baby Spinach", quantity: 200, unit: "g", category: "Produce" },
        { name: "Broccoli Florets", quantity: 400, unit: "g", category: "Produce" },
        { name: "Raw Unsalted Almonds", quantity: 250, unit: "g", category: "Fats/Nuts" },
        { name: "Cold Pressed Olive Oil", quantity: 500, unit: "ml", category: "Fats/Nuts" },
        { name: "Fresh Garlic Bulb", quantity: 3, unit: "unit", category: "Flavor Bridges" },
        { name: "Organic Soy Sauce", quantity: 150, unit: "ml", category: "Flavor Bridges" },
        { name: "Shared Paper Napkins (Non-User)", quantity: 1, unit: "unit", category: "Flavor Bridges" }, // Item to showcase triage unchecking!
      ];

      return NextResponse.json({ items: mockParsedReceipt });
    }
  } catch (error: any) {
    console.error("Receipt parsing api error:", error);
    return NextResponse.json(
      { error: "Failed to parse receipt: " + error.message },
      { status: 500 }
    );
  }
}
