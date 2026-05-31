"use client";

import React, { useState } from "react";
import {
  DailyMealPlan,
  Meal,
  PantryItem,
  UserProfile,
  updateMealStatus,
  deductFromPantry,
  saveDailyMealPlan,
  normalizePantryKey,
} from "@/lib/firebase";
import { calculateMetabolicTargets } from "@/lib/metabolic";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  AlertCircle,
  FileText,
  Sparkles,
  Check,
  X,
  Coffee,
  Sun,
  Moon,
  Cookie,
  ExternalLink,
  PackageCheck,
  PackageMinus,
  Info,
} from "lucide-react";
import jsPDF from "jspdf";

interface TimelineCalendarProps {
  calendar: Record<string, DailyMealPlan>;
  pantry: PantryItem[];
  profile: UserProfile;
  onRefreshData: () => void;
}

export default function TimelineCalendar({
  calendar,
  pantry,
  profile,
  onRefreshData,
}: TimelineCalendarProps) {
  const [viewMode, setViewMode] = useState<"week" | "month">("week");
  // Calculate today's date formatted as YYYY-MM-DD
  const getTodayString = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const [startDateStr, setStartDateStr] = useState(getTodayString());
  const [generationDays, setGenerationDays] = useState(7); // default 7 days AI generation selector
  const [isGenerating, setIsGenerating] = useState(false);
  const [isTakeawayModalOpen, setIsTakeawayModalOpen] = useState(false);
  const [takeawayText, setTakeawayText] = useState("");
  const [takeawayMealTarget, setTakeawayMealTarget] = useState<{ date: string; mealId: string } | null>(null);
  const [takeawayLoading, setTakeawayLoading] = useState(false);
  const [estimatedTakeaway, setEstimatedTakeaway] = useState<any>(null);

  // Derive dates to render based on viewMode
  const getDatesToRender = (): string[] => {
    const dates: string[] = [];
    const baseDate = new Date(startDateStr);
    const count = viewMode === "week" ? 7 : 28;

    for (let i = 0; i < count; i++) {
      const current = new Date(baseDate);
      current.setDate(baseDate.getDate() + i);
      const yyyy = current.getFullYear();
      const mm = String(current.getMonth() + 1).padStart(2, "0");
      const dd = String(current.getDate()).padStart(2, "0");
      dates.push(`${yyyy}-${mm}-${dd}`);
    }
    return dates;
  };

  const datesToRender = getDatesToRender();

  // Check if takeaway down-regulation is active
  const isDownRegulationActive = (): boolean => {
    let foundTakeaway = false;
    Object.values(calendar).forEach((dayPlan) => {
      dayPlan.meals.forEach((m) => {
        if (m.status === "eating-out") {
          foundTakeaway = true;
        }
      });
    });
    return foundTakeaway;
  };

  // Generate AI Meal Plan via API
  const handleGenerateMealPlan = async () => {
    setIsGenerating(true);
    try {
      const targets = calculateMetabolicTargets(profile);
      const downReg = isDownRegulationActive();

      // Dynamically compile target dates based on selected generationDays count!
      const datesToGen: string[] = [];
      const start = new Date(startDateStr);
      for (let i = 0; i < generationDays; i++) {
        const current = new Date(start);
        current.setDate(start.getDate() + i);
        const yyyy = current.getFullYear();
        const mm = String(current.getMonth() + 1).padStart(2, "0");
        const dd = String(current.getDate()).padStart(2, "0");
        datesToGen.push(`${yyyy}-${mm}-${dd}`);
      }

      const response = await fetch("/api/generate-meals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetCalories: targets.targetCalories,
          targetProtein: targets.targetProteinGrams,
          targetCarbs: targets.targetCarbsGrams,
          targetFat: targets.targetFatGrams,
          pantry,
          dates: datesToGen,
          profile,
          downRegulate: downReg,
        }),
      });

      const data = await response.json();
      if (data.plan) {
        for (const date of Object.keys(data.plan)) {
          await saveDailyMealPlan(date, data.plan[date]);
        }
        onRefreshData();
      }
    } catch (e) {
      console.error("Failed to generate plan", e);
    } finally {
      setIsGenerating(false);
    }
  };

  // Handle Mark as Eaten (Deducts actual ingredients from pantry)
  const handleMarkAsEaten = async (date: string, meal: Meal) => {
    const deductions = meal.ingredients.map((ing) => ({
      name: ing.name,
      quantity: ing.weight,
    }));
    await deductFromPantry(deductions);
    await updateMealStatus(date, meal.id, "eaten");
    onRefreshData();
  };

  // Handle Skip Meal (Redistribute targets to other pending meals of the same day)
  const handleSkipMeal = async (date: string, meal: Meal) => {
    await updateMealStatus(date, meal.id, "skipped", { originalRecipe: meal });
    onRefreshData();
  };

  // Open Log Takeaway Modal
  const openTakeawayModal = (date: string, mealId: string) => {
    setTakeawayMealTarget({ date, mealId });
    setTakeawayText("");
    setEstimatedTakeaway(null);
    setIsTakeawayModalOpen(true);
  };

  // Estimate Takeaway Macros using API
  const handleEstimateTakeaway = async () => {
    if (!takeawayText.trim()) return;
    setTakeawayLoading(true);
    try {
      const res = await fetch("/api/takeaway-estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: takeawayText }),
      });
      const data = await res.json();
      setEstimatedTakeaway(data);
    } catch (e) {
      console.error(e);
    } finally {
      setTakeawayLoading(false);
    }
  };

  // Confirm and save Takeaway Log
  const handleConfirmTakeaway = async () => {
    if (!takeawayMealTarget || !estimatedTakeaway) return;
    const { date, mealId } = takeawayMealTarget;

    await updateMealStatus(date, mealId, "eating-out", {
      takeawayLog: takeawayText,
      originalRecipe: estimatedTakeaway,
    });

    setIsTakeawayModalOpen(false);
    setTakeawayMealTarget(null);
    setEstimatedTakeaway(null);
    onRefreshData();
  };

  // Reset calendar status
  const handleResetMeal = async (date: string, mealId: string) => {
    await updateMealStatus(date, mealId, "pending");
    onRefreshData();
  };

  // Calculate redistributed macros for rendering (Live redistribution)
  const getRedistributedMacros = (dateStr: string, currentMeal: Meal) => {
    const dayPlan = calendar[dateStr];
    if (!dayPlan || currentMeal.status !== "pending") {
      return {
        calories: currentMeal.calories,
        protein: currentMeal.protein,
        carbs: currentMeal.carbs,
        fat: currentMeal.fat,
        isRedistributed: false,
        addedCal: 0,
        addedProt: 0,
      };
    }

    const skippedMeals = dayPlan.meals.filter((m) => m.status === "skipped");
    if (skippedMeals.length === 0) {
      return {
        calories: currentMeal.calories,
        protein: currentMeal.protein,
        carbs: currentMeal.carbs,
        fat: currentMeal.fat,
        isRedistributed: false,
        addedCal: 0,
        addedProt: 0,
      };
    }

    let totalSkippedCal = 0;
    let totalSkippedProt = 0;
    let totalSkippedCarbs = 0;
    let totalSkippedFat = 0;

    skippedMeals.forEach((sm) => {
      const base = sm.originalRecipe || sm;
      totalSkippedCal += base.calories;
      totalSkippedProt += base.protein;
      totalSkippedCarbs += base.carbs;
      totalSkippedFat += base.fat;
    });

    const pendingMeals = dayPlan.meals.filter((m) => m.status === "pending");
    if (pendingMeals.length === 0) {
      return {
        calories: currentMeal.calories,
        protein: currentMeal.protein,
        carbs: currentMeal.carbs,
        fat: currentMeal.fat,
        isRedistributed: false,
        addedCal: 0,
        addedProt: 0,
      };
    }

    const divisor = pendingMeals.length;
    const addedCal = Math.round(totalSkippedCal / divisor);
    const addedProt = Math.round(totalSkippedProt / divisor);
    const addedCarbs = Math.round(totalSkippedCarbs / divisor);
    const addedFat = Math.round(totalSkippedFat / divisor);

    return {
      calories: currentMeal.calories + addedCal,
      protein: currentMeal.protein + addedProt,
      carbs: currentMeal.carbs + addedCarbs,
      fat: currentMeal.fat + addedFat,
      isRedistributed: true,
      addedCal,
      addedProt,
    };
  };

  // Check pantry stock readiness for a meal
  const checkPantryReadiness = (meal: Meal): {
    isReady: boolean;
    missingIngredients: string[];
  } => {
    if (!meal.ingredients || meal.ingredients.length === 0) {
      return { isReady: true, missingIngredients: [] };
    }

    // Build map of current pantry levels
    const pantryMap = new Map<string, number>();
    pantry.forEach((item) => {
      pantryMap.set(normalizePantryKey(item.name), item.quantity);
    });

    const missingIngredients: string[] = [];

    meal.ingredients.forEach((ing) => {
      const key = normalizePantryKey(ing.name);
      const stocked = pantryMap.get(key) || 0;
      if (stocked < ing.weight) {
        missingIngredients.push(`${ing.name} (need ${ing.weight}${ing.unit}, got ${Math.round(stocked)}${ing.unit})`);
      }
    });

    return {
      isReady: missingIngredients.length === 0,
      missingIngredients,
    };
  };

  const handlePrevRange = () => {
    const d = new Date(startDateStr);
    d.setDate(d.getDate() - (viewMode === "week" ? 7 : 28));
    setStartDateStr(d.toISOString().split("T")[0]);
  };

  const handleNextRange = () => {
    const d = new Date(startDateStr);
    d.setDate(d.getDate() + (viewMode === "week" ? 7 : 28));
    setStartDateStr(d.toISOString().split("T")[0]);
  };

  const handleNativePrint = () => {
    window.print();
  };

  const handleExportPDF = () => {
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(23, 23, 23);
    doc.text("AI METABOLIC MEAL PLAN", 20, 20);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(115, 115, 115);
    doc.text(`Active Date Range: ${datesToRender[0]} to ${datesToRender[datesToRender.length - 1]}`, 20, 26);
    doc.text(`Profile Baseline Target: ${calculateMetabolicTargets(profile).targetCalories} kcal/day`, 20, 31);

    doc.setDrawColor(229, 229, 229);
    doc.line(20, 35, 190, 35);

    let y = 43;

    datesToRender.forEach((dateStr) => {
      const dayPlan = calendar[dateStr];
      if (!dayPlan) return;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(30, 41, 59);
      doc.text(dateStr, 20, y);
      y += 6;

      dayPlan.meals.forEach((meal) => {
        if (y > 270) {
          doc.addPage();
          y = 20;
        }

        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(79, 70, 229);
        doc.text(meal.type.toUpperCase(), 25, y);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(15, 23, 42);
        doc.text(meal.recipeName, 50, y);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(100, 116, 139);
        doc.text(`${meal.calories} kcal | P: ${meal.protein}g C: ${meal.carbs}g F: ${meal.fat}g [${meal.status.toUpperCase()}]`, 130, y);

        y += 5;
      });

      y += 4;
    });

    doc.save(`ai_meal_plan_${datesToRender[0]}.pdf`);
  };

  const getMealIcon = (type: Meal["type"]) => {
    switch (type) {
      case "breakfast": return <Coffee className="w-4 h-4 text-amber-400" />;
      case "lunch": return <Sun className="w-4 h-4 text-emerald-400" />;
      case "dinner": return <Moon className="w-4 h-4 text-purple-400" />;
      case "snack": return <Cookie className="w-4 h-4 text-indigo-400" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Calendar Header Navigation Controls */}
      <div className="flex flex-col xl:flex-row gap-4 justify-between items-center bg-zinc-900/60 backdrop-blur-xl border border-zinc-800 rounded-3xl p-6 shadow-2xl no-print">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-2xl">
            <CalendarIcon className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-zinc-100">Dynamic Culinary Timeline</h2>
            <p className="text-xs text-zinc-400">View and adjust your nutritional roadmap</p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap gap-2.5 items-center justify-center">
          {/* View Toggles */}
          <div className="flex bg-zinc-950 p-1 rounded-xl border border-zinc-850">
            <button
              onClick={() => setViewMode("week")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                viewMode === "week"
                  ? "bg-zinc-800 text-zinc-100 shadow"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Weekly Grid
            </button>
            <button
              onClick={() => setViewMode("month")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                viewMode === "month"
                  ? "bg-zinc-800 text-zinc-100 shadow"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Month Matrix
            </button>
          </div>

          {/* Date Slider Controls */}
          <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-xl border border-zinc-850">
            <button
              onClick={handlePrevRange}
              className="p-1.5 text-zinc-400 hover:text-zinc-200 rounded-lg hover:bg-zinc-900"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <input
              type="date"
              value={startDateStr}
              onChange={(e) => setStartDateStr(e.target.value)}
              className="bg-transparent text-xs text-zinc-300 font-bold border-none outline-none focus:ring-0 px-2 cursor-pointer"
            />
            <button
              onClick={handleNextRange}
              className="p-1.5 text-zinc-400 hover:text-zinc-200 rounded-lg hover:bg-zinc-900"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* PDF Buttons */}
          <button
            onClick={handleNativePrint}
            title="Open browser print interface"
            className="flex items-center gap-1.5 bg-zinc-950 hover:bg-zinc-900 border border-zinc-850 text-zinc-300 px-3 py-2 text-xs font-bold rounded-xl transition cursor-pointer"
          >
            <FileText className="w-4 h-4" />
            Print
          </button>

          <button
            onClick={handleExportPDF}
            title="Download formatted A4 PDF"
            className="flex items-center gap-1.5 bg-zinc-950 hover:bg-zinc-900 border border-zinc-850 text-zinc-300 px-3 py-2 text-xs font-bold rounded-xl transition cursor-pointer"
          >
            <ExternalLink className="w-4 h-4" />
            PDF Export
          </button>

          {/* Days Generation Count Selector */}
          <div className="flex items-center gap-2 bg-zinc-950 p-1 rounded-xl border border-zinc-850">
            <span className="text-xxs text-zinc-500 font-bold uppercase tracking-wider pl-2">Generate:</span>
            <select
              value={generationDays}
              onChange={(e) => setGenerationDays(parseInt(e.target.value))}
              className="bg-zinc-900 border-none text-xs font-bold rounded-lg text-zinc-300 py-1.5 px-2 focus:ring-0 focus:outline-none cursor-pointer"
            >
              <option value={3}>3 Days</option>
              <option value={7}>7 Days</option>
              <option value={14}>14 Days</option>
              <option value={30}>30 Days</option>
            </select>
          </div>

          {/* AI Generator Button */}
          <button
            onClick={handleGenerateMealPlan}
            disabled={isGenerating}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 disabled:bg-indigo-800 disabled:opacity-75 px-4 py-2 text-xs font-black rounded-xl transition cursor-pointer"
          >
            <Sparkles className="w-4 h-4 animate-pulse" />
            {isGenerating ? "Synthesizing..." : "AI Generate Plan"}
          </button>
        </div>
      </div>

      {/* Down-regulation Notification Widget */}
      {isDownRegulationActive() && (
        <div className="bg-amber-950/20 border border-amber-900/60 p-4 rounded-2xl flex items-start gap-3 no-print">
          <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-bold text-amber-300">Takeaway Down-Regulation Active</h4>
            <p className="text-xs text-amber-400/80 mt-0.5 leading-relaxed">
              We detected a takeaway dinner in your calendar. Subsequent meal plans automatically scale back carbohydrate and fat density by 35% while keeping proteins spiked, preserving your metabolic targets.
            </p>
          </div>
        </div>
      )}

      {/* Printable isolated calendar layout */}
      <div className="print-only hidden font-sans">
        <h1 className="text-2xl font-bold mb-2">AI Culinary Schedule</h1>
        <p className="text-sm text-gray-500 mb-6">Generated on: {new Date().toLocaleDateString()}</p>
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b-2 border-gray-300">
              <th className="text-left py-2 font-bold text-gray-700">Date</th>
              <th className="text-left py-2 font-bold text-gray-700">Breakfast</th>
              <th className="text-left py-2 font-bold text-gray-700">Lunch</th>
              <th className="text-left py-2 font-bold text-gray-700">Dinner</th>
              <th className="text-left py-2 font-bold text-gray-700">Snack (Daily Nuts)</th>
            </tr>
          </thead>
          <tbody>
            {datesToRender.map((dateStr) => {
              const dayPlan = calendar[dateStr];
              return (
                <tr key={dateStr} className="border-b border-gray-200">
                  <td className="py-3 font-bold text-gray-800 align-top pr-4">{dateStr}</td>
                  {["breakfast", "lunch", "dinner", "snack"].map((mType) => {
                    const m = dayPlan?.meals.find((x) => x.type === mType);
                    return (
                      <td key={mType} className="py-3 text-sm align-top pr-4">
                        {m ? (
                          <div>
                            <div className="font-bold text-gray-900">{m.recipeName}</div>
                            <div className="text-xs text-gray-500 mt-0.5">
                              {m.calories} kcal | P:{m.protein}g C:{m.carbs}g F:{m.fat}g
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-400 italic">Unscheduled</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Main Grid Render (Aesthetic Dark Mode UI) */}
      <div className={`grid grid-cols-1 ${viewMode === "week" ? "md:grid-cols-7" : "md:grid-cols-4"} gap-4 no-print`}>
        {datesToRender.map((dateStr) => {
          const dayPlan = calendar[dateStr];
          const hasMeals = dayPlan && dayPlan.meals && dayPlan.meals.length > 0;

          return (
            <div
              key={dateStr}
              className={`bg-zinc-900/40 border border-zinc-800 rounded-3xl p-4 shadow-xl flex flex-col justify-between ${
                getTodayString() === dateStr ? "ring-2 ring-indigo-500/80 bg-zinc-900/75" : ""
              }`}
            >
              <div>
                {/* Date Tag */}
                <div className="flex justify-between items-center mb-3.5 pb-2 border-b border-zinc-850">
                  <span className="text-xs font-black text-zinc-300">{dateStr}</span>
                  {getTodayString() === dateStr && (
                    <span className="bg-indigo-600 text-white text-xxs font-black px-2 py-0.5 rounded-full">TODAY</span>
                  )}
                </div>

                {/* Meals stack */}
                {hasMeals ? (
                  <div className="space-y-3">
                    {dayPlan.meals.map((meal) => {
                      const finalMacros = getRedistributedMacros(dateStr, meal);
                      const readiness = checkPantryReadiness(meal);

                      return (
                        <div
                          key={meal.id}
                          className="relative group" // added relative group to enable hover pop-up tooltips!
                        >
                          <div
                            className={`p-3 bg-zinc-950/70 border rounded-2xl flex flex-col justify-between transition-all duration-300 ${
                              meal.status === "eaten"
                                ? "border-emerald-500/30 bg-emerald-950/5/30"
                                : meal.status === "skipped"
                                ? "border-red-500/30 bg-red-950/5/30 opacity-60"
                                : meal.status === "eating-out"
                                ? "border-amber-500/30 bg-amber-950/5/30"
                                : "border-zinc-850 hover:border-zinc-800"
                            }`}
                          >
                            <div>
                              <div className="flex justify-between items-center mb-1">
                                <span className="flex items-center gap-1 text-xxs font-bold text-zinc-400 uppercase tracking-widest">
                                  {getMealIcon(meal.type)}
                                  {meal.type}
                                </span>
                                
                                <select
                                  value={meal.status}
                                  onChange={(e) => {
                                    const target = e.target.value as Meal["status"];
                                    if (target === "eaten") {
                                      handleMarkAsEaten(dateStr, meal);
                                    } else if (target === "skipped") {
                                      handleSkipMeal(dateStr, meal);
                                    } else if (target === "eating-out") {
                                      openTakeawayModal(dateStr, meal.id);
                                    } else {
                                      handleResetMeal(dateStr, meal.id);
                                    }
                                  }}
                                  className="bg-zinc-900 border-zinc-800 text-xxs font-semibold rounded-lg text-zinc-400 focus:ring-0 focus:border-zinc-700 py-0.5 px-1.5"
                                >
                                  <option value="pending">Pending</option>
                                  <option value="eaten">Mark Eaten</option>
                                  <option value="skipped">Skip Meal</option>
                                  <option value="eating-out">Log Takeaway</option>
                                </select>
                              </div>

                              <h4 className="text-xs font-bold text-zinc-100 line-clamp-1 mt-1 leading-snug">
                                {meal.recipeName}
                              </h4>
                            </div>

                            {/* Meal Macros Panel */}
                            <div className="mt-3.5 pt-2 border-t border-zinc-850/50 flex flex-wrap justify-between items-center gap-1">
                              <span className="text-xxs font-extrabold text-zinc-300">
                                {finalMacros.calories} <span className="font-normal text-zinc-500">kcal</span>
                              </span>
                              <div className="flex gap-1.5 text-xxs text-zinc-500">
                                <span>P:{finalMacros.protein}g</span>
                                <span>C:{finalMacros.carbs}g</span>
                                <span>F:{finalMacros.fat}g</span>
                              </div>
                            </div>

                            {/* Redistribution Indicator */}
                            {finalMacros.isRedistributed && (
                              <div className="mt-2 text-xxs text-emerald-400 font-bold bg-emerald-950/20 border border-emerald-900/30 py-0.5 px-1.5 rounded-lg flex items-center gap-1.5">
                                <TrendingUp className="w-3.5 h-3.5 shrink-0" />
                                <span>+{finalMacros.addedCal} kcal Skipped Bonus</span>
                              </div>
                            )}

                            {/* Takeaway Logging text snippet */}
                            {meal.status === "eating-out" && meal.takeawayLog && (
                              <div className="mt-2 text-xxs text-amber-400 bg-amber-950/20 border border-amber-900/30 py-1 px-1.5 rounded-lg">
                                Takeaway: "{meal.takeawayLog}"
                              </div>
                            )}
                          </div>

                          {/* ----------------------------------------------------
                             HOVER POP-UP TOOLTIP DIALOG
                             ---------------------------------------------------- */}
                          <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-3.5 hidden group-hover:block w-76 bg-zinc-950 border border-zinc-850 p-4 rounded-2xl shadow-2xl z-40 pointer-events-none transition duration-300 text-left space-y-3">
                            {/* Card title */}
                            <div>
                              <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest block mb-0.5">{meal.type} Preview</span>
                              <h4 className="text-xs font-black text-zinc-100 leading-snug">{meal.recipeName}</h4>
                            </div>

                            {/* Live Pantry Readiness Check */}
                            {meal.status !== "eating-out" && (
                              <div className="pt-2 border-t border-zinc-900">
                                {readiness.isReady ? (
                                  <div className="text-[10px] text-emerald-400 font-bold flex items-center gap-1.5 bg-emerald-950/20 border border-emerald-900/30 px-2 py-1 rounded-lg">
                                    <PackageCheck className="w-3.5 h-3.5 shrink-0" />
                                    <span>🟢 Fully Stocked in Pantry</span>
                                  </div>
                                ) : (
                                  <div className="bg-amber-950/20 border border-amber-900/30 p-2 rounded-lg space-y-1">
                                    <div className="text-[10px] text-amber-500 font-bold flex items-center gap-1.5">
                                      <PackageMinus className="w-3.5 h-3.5 shrink-0" />
                                      <span>🟠 Requires Shopping</span>
                                    </div>
                                    <div className="text-[9px] text-zinc-500 pl-5 leading-snug">
                                      Deficits: {readiness.missingIngredients.slice(0, 2).map((x, idx) => (
                                        <div key={idx}>• {x}</div>
                                      ))}
                                      {readiness.missingIngredients.length > 2 && <div>• and {readiness.missingIngredients.length - 2} more...</div>}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Macro card breakdown */}
                            <div className="grid grid-cols-4 gap-1.5 text-center text-[10px] pt-2 border-t border-zinc-900">
                              <div className="bg-zinc-900 py-1 rounded-lg border border-zinc-850"><span className="text-zinc-500 block font-bold">KCAL</span><span className="text-zinc-200 font-black">{finalMacros.calories}</span></div>
                              <div className="bg-zinc-900 py-1 rounded-lg border border-zinc-850"><span className="text-red-400 block font-bold">PRO</span><span className="text-zinc-200 font-black">{finalMacros.protein}g</span></div>
                              <div className="bg-zinc-900 py-1 rounded-lg border border-zinc-850"><span className="text-amber-400 block font-bold">CARB</span><span className="text-zinc-200 font-black">{finalMacros.carbs}g</span></div>
                              <div className="bg-zinc-900 py-1 rounded-lg border border-zinc-850"><span className="text-blue-400 block font-bold">FAT</span><span className="text-zinc-200 font-black">{finalMacros.fat}g</span></div>
                            </div>

                            {/* Recipe steps snippet */}
                            {meal.instructions && (
                              <div className="pt-2 border-t border-zinc-900 text-[10px] text-zinc-400 leading-normal flex items-start gap-1">
                                <Info className="w-3.5 h-3.5 text-zinc-500 shrink-0 mt-0.5" />
                                <p className="line-clamp-3">Instructions: {meal.instructions}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-10 border-2 border-dashed border-zinc-850 rounded-2xl flex flex-col justify-center items-center">
                    <Sparkles className="w-6 h-6 text-zinc-600 mb-2" />
                    <span className="text-xxs text-zinc-500 font-medium">No Meals Scheduled</span>
                  </div>
                )}
              </div>

              {/* Day Metrics summary */}
              {hasMeals && (
                <div className="mt-4 pt-3 border-t border-zinc-850/60 flex justify-between items-center text-xxs">
                  <span className="text-zinc-500 font-semibold uppercase">Daily Sum</span>
                  <span className="font-black text-zinc-200">
                    {dayPlan.meals.reduce((acc, m) => {
                      const final = getRedistributedMacros(dateStr, m);
                      return acc + final.calories;
                    }, 0)} kcal
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Dynamic Log Takeaway Overlay Dialog Modal */}
      {isTakeawayModalOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md flex justify-center items-center z-50 p-4 no-print">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 w-full max-w-md shadow-2xl relative">
            <button
              onClick={() => {
                setIsTakeawayModalOpen(false);
                setTakeawayMealTarget(null);
                setEstimatedTakeaway(null);
              }}
              className="absolute top-4 right-4 p-1 text-zinc-400 hover:text-zinc-200 rounded-full hover:bg-zinc-800"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-zinc-100 mb-2">Log Takeaway Dinner</h3>
            <p className="text-xs text-zinc-400 mb-4 leading-relaxed">
              Describe what takeaway you ate (e.g. "heavy double cheese burger with large crispy fries"). Gemini will dynamically compute the caloric burden and adapt future meal targets.
            </p>

            <div className="space-y-4">
              <textarea
                value={takeawayText}
                onChange={(e) => setTakeawayText(e.target.value)}
                placeholder="Describe your meal in natural language..."
                className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-4 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-indigo-500 h-28 resize-none"
              />

              {estimatedTakeaway ? (
                <div className="bg-zinc-950 border border-zinc-850 p-4 rounded-2xl space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-black text-indigo-400 uppercase tracking-wider">Nutrition Estimates</span>
                    <span className="bg-amber-500/10 border border-amber-500/20 text-amber-500 text-xxs font-black px-2 py-0.5 rounded-full">Estimated</span>
                  </div>
                  <div className="text-lg font-black text-zinc-100">
                    {estimatedTakeaway.calories} <span className="text-xs font-normal text-zinc-400">kcal</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xxs text-zinc-400 text-center">
                    <div className="bg-zinc-900 py-1.5 rounded-lg border border-zinc-850">P: {estimatedTakeaway.protein}g</div>
                    <div className="bg-zinc-900 py-1.5 rounded-lg border border-zinc-850">C: {estimatedTakeaway.carbs}g</div>
                    <div className="bg-zinc-900 py-1.5 rounded-lg border border-zinc-850">F: {estimatedTakeaway.fat}g</div>
                  </div>
                  <p className="text-xxs text-zinc-500 italic mt-1 leading-normal">
                    {estimatedTakeaway.friendlyDescription}
                  </p>
                </div>
              ) : null}

              {estimatedTakeaway ? (
                <button
                  onClick={handleConfirmTakeaway}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black text-sm py-3 rounded-2xl shadow-lg transition"
                >
                  Confirm & Commit Log
                </button>
              ) : (
                <button
                  onClick={handleEstimateTakeaway}
                  disabled={takeawayLoading || !takeawayText.trim()}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 disabled:opacity-50 text-white font-black text-sm py-3 rounded-2xl shadow-lg transition"
                >
                  {takeawayLoading ? "Consulting Nutritionist..." : "Estimate Nutritional Footprint"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
