"use client";

import React, { useState, useEffect } from "react";
import { DailyMealPlan, PantryItem, commitToPantry } from "@/lib/firebase";
import {
  ShoppingBag,
  Sparkles,
  Clipboard,
  Check,
  Calendar,
  AlertCircle,
  TrendingUp,
  Package,
} from "lucide-react";

interface ShoppingAssistantProps {
  calendar: Record<string, DailyMealPlan>;
  pantry: PantryItem[];
  onRefreshData: () => void;
}

interface RoundedShoppingItem {
  name: string;
  deficitQty: number;
  unit: "g" | "ml" | "unit";
  packageName: string;
  packageSize: number;
  packageUnit: "g" | "ml" | "unit";
  purchaseQty: number;
  category: "Proteins" | "Produce" | "Fats/Nuts" | "Flavor Bridges";
  bought?: boolean;
}

export default function ShoppingAssistant({
  calendar,
  pantry,
  onRefreshData,
}: ShoppingAssistantProps) {
  // Get date range for rolling week
  const getTodayString = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const getWeekLaterString = () => {
    const today = new Date();
    today.setDate(today.getDate() + 6);
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const [startDateStr, setStartDateStr] = useState(getTodayString());
  const [endDateStr, setEndDateStr] = useState(getWeekLaterString());
  const [shoppingList, setShoppingList] = useState<RoundedShoppingItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [commitSuccess, setCommitSuccess] = useState(false);

  // Derive dates within range
  const getDatesInRange = (): string[] => {
    const dates: string[] = [];
    const start = new Date(startDateStr);
    const end = new Date(endDateStr);
    const current = new Date(start);

    while (current <= end) {
      const yyyy = current.getFullYear();
      const mm = String(current.getMonth() + 1).padStart(2, "0");
      const dd = String(current.getDate()).padStart(2, "0");
      dates.push(`${yyyy}-${mm}-${dd}`);
      current.setDate(current.getDate() + 1);
    }
    return dates;
  };

  // Compile required list and call rounding API
  const compileShoppingList = async () => {
    setLoading(true);
    setCommitSuccess(false);
    try {
      const dates = getDatesInRange();
      const requiredIngredients: any[] = [];

      // Accumulate ingredients from calendar
      dates.forEach((date) => {
        const dayPlan = calendar[date];
        if (dayPlan && dayPlan.meals) {
          dayPlan.meals.forEach((meal) => {
            // Only aggregate ingredients for pending/cooked meals (skip eaten or eating-out)
            if (meal.status === "pending" || meal.status === "cooked") {
              meal.ingredients.forEach((ing) => {
                requiredIngredients.push({
                  name: ing.name,
                  weight: ing.weight,
                  unit: ing.unit,
                  category: ing.category,
                });
              });
            }
          });
        }
      });

      if (requiredIngredients.length === 0) {
        setShoppingList([]);
        return;
      }

      // Fetch commercially rounded items from serverless API
      const res = await fetch("/api/round-shopping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requiredIngredients, pantry }),
      });
      const data = await res.json();
      if (data.shoppingList) {
        const mapped = data.shoppingList.map((item: any) => ({
          ...item,
          bought: true, // checked by default to commit
        }));
        setShoppingList(mapped);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    compileShoppingList();
  }, [calendar, pantry, startDateStr, endDateStr]);

  // Toggle item purchase check
  const toggleItemBought = (name: string) => {
    setShoppingList((prev) =>
      prev.map((item) => (item.name === name ? { ...item, bought: !item.bought } : item))
    );
  };

  // Export checklist as clean text copy to clipboard
  const handleClipboardExport = () => {
    if (shoppingList.length === 0) return;
    
    let text = `🛒 AI ROUNDED GROCERY SHOPPING LIST\n`;
    text += `Range: ${startDateStr} to ${endDateStr}\n`;
    text += `=====================================\n\n`;

    const categories = ["Proteins", "Produce", "Fats/Nuts", "Flavor Bridges"];
    categories.forEach((cat) => {
      const catItems = shoppingList.filter((x) => x.category === cat);
      if (catItems.length === 0) return;

      text += `● ${cat.toUpperCase()}\n`;
      catItems.forEach((x) => {
        text += `  [ ] ${x.purchaseQty}x ${x.packageName} - ${x.name} (Deficit: ${Math.round(x.deficitQty)}${x.unit})\n`;
      });
      text += `\n`;
    });

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Commit selected commercial packages to the pantry database
  const handleCommitPurchases = async () => {
    const checked = shoppingList.filter((x) => x.bought);
    if (checked.length === 0) return;

    // Convert commercial sizes to pantry additions
    const pantryAdditions: PantryItem[] = checked.map((x) => ({
      name: x.name,
      // Total weight purchased = packageCount * packageSize (e.g. 2x 500g = 1000g chicken breast added)
      quantity: x.purchaseQty * x.packageSize,
      unit: x.packageUnit,
      category: x.category,
    }));

    await commitToPantry(pantryAdditions);
    setCommitSuccess(true);
    setShoppingList([]);
    onRefreshData();
  };

  // Group items by category
  const categories = ["Proteins", "Produce", "Fats/Nuts", "Flavor Bridges"] as const;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Date Range Selection & Stats Panel */}
      <div className="lg:col-span-1 bg-zinc-900/60 backdrop-blur-xl border border-zinc-800 rounded-3xl p-6 shadow-2xl flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-2xl">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-zinc-100">Shopping Range</h2>
              <p className="text-xs text-zinc-400">Specify dates to scan for deficits</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
                Start Date
              </label>
              <input
                type="date"
                value={startDateStr}
                onChange={(e) => setStartDateStr(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-850 rounded-xl px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
                End Date
              </label>
              <input
                type="date"
                value={endDateStr}
                onChange={(e) => setEndDateStr(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-850 rounded-xl px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <button
              onClick={compileShoppingList}
              className="w-full bg-zinc-950 border border-zinc-850 hover:bg-zinc-900 text-zinc-300 text-xs font-bold py-2.5 rounded-xl transition cursor-pointer"
            >
              Recalculate Deficits
            </button>
          </div>
        </div>

        {/* Buffer explain card */}
        <div className="mt-6 p-4 bg-indigo-950/20 border border-indigo-900/40 rounded-2xl space-y-2">
          <div className="flex items-center gap-2 text-xxs font-bold text-indigo-400 uppercase tracking-widest">
            <Package className="w-4 h-4" />
            <span>Smart Retail Rounding</span>
          </div>
          <p className="text-xxs text-zinc-400 leading-normal">
            Instead of mathematical quantities, we round deficits up to commercial packaging. When you commit purchases, the total packages enter your pantry. As you mark meals eaten, the recipe weights deduct, automatically reserving leftover buffers!
          </p>
        </div>

        {commitSuccess && (
          <div className="mt-4 p-4 bg-emerald-950/20 border border-emerald-900/40 rounded-2xl flex items-start gap-2.5">
            <Check className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-emerald-300">Purchases Hydrated!</h4>
              <p className="text-xxs text-emerald-400/80 mt-0.5 leading-relaxed">
                Full retail packaging volumes added back to active kitchen stocks. Surplus buffers calculated.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Grocery Checklist Panel */}
      <div className="lg:col-span-2 bg-zinc-900/60 backdrop-blur-xl border border-zinc-800 rounded-3xl p-6 shadow-2xl flex flex-col justify-between min-h-[400px]">
        <div>
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-2xl">
                <ShoppingBag className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-zinc-100">Smart Shopping List</h2>
                <p className="text-xs text-zinc-400">Commercially-rounded grocery checklist</p>
              </div>
            </div>

            {shoppingList.length > 0 && (
              <button
                onClick={handleClipboardExport}
                className="flex items-center gap-1.5 bg-zinc-950 border border-zinc-850 hover:bg-zinc-900 text-zinc-300 text-xs font-bold px-3 py-2 rounded-xl transition cursor-pointer"
              >
                <Clipboard className="w-4 h-4" />
                {copied ? "Copied!" : "Export List"}
              </button>
            )}
          </div>

          {loading ? (
            <div className="flex-1 flex flex-col justify-center items-center py-20 text-center">
              <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4" />
              <span className="text-xs text-zinc-400">Compiling shopping inventory deficits...</span>
            </div>
          ) : shoppingList.length > 0 ? (
            <div className="space-y-6 max-h-[450px] overflow-y-auto pr-2">
              {categories.map((cat) => {
                const catItems = shoppingList.filter((x) => x.category === cat);
                if (catItems.length === 0) return null;

                return (
                  <div key={cat} className="space-y-2">
                    <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-widest border-b border-zinc-850 pb-1 mb-3">
                      {cat}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {catItems.map((item) => (
                        <div
                          key={item.name}
                          onClick={() => toggleItemBought(item.name)}
                          className={`p-3 border rounded-2xl flex items-center justify-between transition duration-300 cursor-pointer ${
                            item.bought
                              ? "bg-indigo-950/10 border-indigo-500/30"
                              : "bg-zinc-950/40 border-zinc-850 opacity-40 hover:opacity-70"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg shrink-0 ${
                              item.bought ? "bg-indigo-600/10 text-indigo-400" : "bg-zinc-900 text-zinc-600"
                            }`}>
                              {item.bought ? <Check className="w-4 h-4" /> : <Package className="w-4 h-4" />}
                            </div>
                            <div>
                              <h4 className="text-xs font-bold text-zinc-100">{item.name}</h4>
                              <p className="text-xxs text-zinc-400 mt-0.5">
                                Deficit: {Math.round(item.deficitQty)}{item.unit}
                              </p>
                            </div>
                          </div>

                          <div className="text-right">
                            <span className="bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xxs font-black px-2 py-0.5 rounded-lg">
                              {item.purchaseQty}x {item.packageName}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex-1 flex flex-col justify-center items-center py-20 border border-dashed border-zinc-850 rounded-2xl bg-zinc-950/20 text-center">
              <Sparkles className="w-8 h-8 text-zinc-600 mb-3" />
              <h4 className="text-sm font-bold text-zinc-300">Pantry fully optimized</h4>
              <p className="text-xxs text-zinc-500 max-w-xs mt-1 leading-relaxed">
                You have sufficient stock in your kitchen for the selected calendar range! No deficits detected.
              </p>
            </div>
          )}
        </div>

        {/* Action Commit */}
        {shoppingList.length > 0 && (
          <div className="mt-6 pt-4 border-t border-zinc-850/60 flex justify-between items-center">
            <span className="text-xxs text-zinc-500 font-semibold uppercase">
              Ready: {shoppingList.filter((x) => x.bought).length} purchases to commit
            </span>
            <button
              onClick={handleCommitPurchases}
              className="bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 font-black text-xs px-5 py-2.5 rounded-xl transition cursor-pointer"
            >
              Commit Purchases to Pantry
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
