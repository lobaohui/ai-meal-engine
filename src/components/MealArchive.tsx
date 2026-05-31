"use client";

import React from "react";
import { DailyMealPlan, Meal } from "@/lib/firebase";
import { BookOpen, Flame, Activity, TrendingUp, Sparkles, AlertCircle, Award, Coffee, Sun, Moon, Cookie } from "lucide-react";

interface MealArchiveProps {
  calendar: Record<string, DailyMealPlan>;
}

export default function MealArchive({ calendar }: MealArchiveProps) {
  // Aggregate all meals that are 'eaten' or 'eating-out'
  const getEatenHistory = (): { date: string; meal: Meal }[] => {
    const list: { date: string; meal: Meal }[] = [];
    
    // Sort dates descending
    const sortedDates = Object.keys(calendar).sort((a, b) => b.localeCompare(a));

    sortedDates.forEach((dateStr) => {
      const dayPlan = calendar[dateStr];
      dayPlan.meals.forEach((meal) => {
        if (meal.status === "eaten" || meal.status === "eating-out") {
          list.push({ date: dateStr, meal });
        }
      });
    });

    return list;
  };

  const history = getEatenHistory();

  // Aggregate stats
  const totalMeals = history.length;
  const totalCalories = history.reduce((acc, item) => {
    // If takeaway (eating-out), use originalRecipe macros which holds takeaway footprint
    const base = item.meal.status === "eating-out" && item.meal.originalRecipe ? item.meal.originalRecipe : item.meal;
    return acc + (base.calories || 0);
  }, 0);

  const totalProtein = history.reduce((acc, item) => {
    const base = item.meal.status === "eating-out" && item.meal.originalRecipe ? item.meal.originalRecipe : item.meal;
    return acc + (base.protein || 0);
  }, 0);

  // Count unique dates with eaten meals
  const uniqueDatesCount = new Set(history.map(x => x.date)).size || 1;
  const avgProtein = Math.round(totalProtein / uniqueDatesCount);
  const avgCalories = Math.round(totalCalories / uniqueDatesCount);

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
      {/* Historical Statistics widgets */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Total Meals Card */}
        <div className="bg-zinc-900/60 backdrop-blur-xl border border-zinc-800 rounded-3xl p-5 shadow-xl flex items-center justify-between">
          <div>
            <span className="text-xxs font-bold text-indigo-400 uppercase tracking-widest block">Logged Meals</span>
            <h3 className="text-3xl font-black text-zinc-100 mt-1">{totalMeals}</h3>
            <span className="text-xxs text-zinc-500 block mt-1">Eaten or eating-out</span>
          </div>
          <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-2xl">
            <Award className="w-6 h-6" />
          </div>
        </div>

        {/* Total Energy Eaten Card */}
        <div className="bg-zinc-900/60 backdrop-blur-xl border border-zinc-800 rounded-3xl p-5 shadow-xl flex items-center justify-between">
          <div>
            <span className="text-xxs font-bold text-amber-400 uppercase tracking-widest block">Total Caloric Volume</span>
            <h3 className="text-3xl font-black text-zinc-100 mt-1">{totalCalories} <span className="text-xs font-normal text-zinc-500">kcal</span></h3>
            <span className="text-xxs text-zinc-500 block mt-1">Accumulated history</span>
          </div>
          <div className="p-3 bg-amber-500/10 text-amber-400 rounded-2xl">
            <Flame className="w-6 h-6" />
          </div>
        </div>

        {/* Avg Daily Calories Eaten Card */}
        <div className="bg-zinc-900/60 backdrop-blur-xl border border-zinc-800 rounded-3xl p-5 shadow-xl flex items-center justify-between">
          <div>
            <span className="text-xxs font-bold text-emerald-400 uppercase tracking-widest block">Avg Daily Intake</span>
            <h3 className="text-3xl font-black text-zinc-100 mt-1">{avgCalories} <span className="text-xs font-normal text-zinc-500">kcal</span></h3>
            <span className="text-xxs text-zinc-500 block mt-1">Across {uniqueDatesCount} active days</span>
          </div>
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-2xl">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        {/* Avg Daily Protein Intake Card */}
        <div className="bg-zinc-900/60 backdrop-blur-xl border border-zinc-800 rounded-3xl p-5 shadow-xl flex items-center justify-between">
          <div>
            <span className="text-xxs font-bold text-red-400 uppercase tracking-widest block">Avg Daily Protein</span>
            <h3 className="text-3xl font-black text-zinc-100 mt-1">{avgProtein}g</h3>
            <span className="text-xxs text-zinc-500 block mt-1">Baseline recovery metric</span>
          </div>
          <div className="p-3 bg-red-500/10 text-red-400 rounded-2xl">
            <Activity className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Consumption Timeline journal */}
      <div className="bg-zinc-900/60 backdrop-blur-xl border border-zinc-800 rounded-3xl p-6 shadow-2xl min-h-[300px] flex flex-col">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-2xl">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-zinc-100">Consumption Timeline Journal</h2>
            <p className="text-xs text-zinc-400">Detailed historical record of your eating habits</p>
          </div>
        </div>

        {history.length > 0 ? (
          <div className="space-y-4 max-h-[450px] overflow-y-auto pr-2">
            {history.map((item, idx) => {
              const base = item.meal.status === "eating-out" && item.meal.originalRecipe ? item.meal.originalRecipe : item.meal;
              const isTakeaway = item.meal.status === "eating-out";

              return (
                <div
                  key={idx}
                  className={`p-4 border rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 transition duration-300 ${
                    isTakeaway 
                      ? "bg-amber-950/10 border-amber-500/30" 
                      : "bg-zinc-950/50 border-zinc-850"
                  }`}
                >
                  <div className="flex items-center gap-3.5">
                    {/* Meal Icon */}
                    <div className="p-2.5 bg-zinc-900 border border-zinc-800 rounded-xl shrink-0">
                      {getMealIcon(item.meal.type)}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-black text-zinc-300">{item.date}</span>
                        <span className="text-xxs text-zinc-500 uppercase tracking-widest font-black">
                          {item.meal.type}
                        </span>
                        {isTakeaway ? (
                          <span className="bg-amber-500/10 border border-amber-500/20 text-amber-500 text-xxs font-black px-2 py-0.5 rounded-lg">
                            Takeaway Logged
                          </span>
                        ) : (
                          <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xxs font-black px-2 py-0.5 rounded-lg">
                            Cooked Home Recipe
                          </span>
                        )}
                      </div>
                      
                      <h4 className="text-sm font-bold text-zinc-100 mt-1 leading-snug">
                        {isTakeaway ? `Logged Takeaway: "${item.meal.takeawayLog}"` : item.meal.recipeName}
                      </h4>
                    </div>
                  </div>

                  {/* Macros stats */}
                  <div className="flex items-center gap-4 border-t border-zinc-900 md:border-0 pt-3.5 md:pt-0 shrink-0">
                    <div className="text-right">
                      <span className="text-lg font-black text-zinc-100 block leading-none">{base.calories} <span className="text-xxs font-normal text-zinc-500">kcal</span></span>
                      <div className="flex gap-2 text-xxs text-zinc-400 mt-1">
                        <span>P: {base.protein}g</span>
                        <span>C: {base.carbs}g</span>
                        <span>F: {base.fat}g</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex-1 flex flex-col justify-center items-center py-20 border border-dashed border-zinc-850 rounded-2xl bg-zinc-950/20 text-center">
            <AlertCircle className="w-8 h-8 text-zinc-600 mb-3" />
            <h4 className="text-sm font-bold text-zinc-300">Journal Idle</h4>
            <p className="text-xxs text-zinc-500 max-w-xs mt-1 leading-relaxed">
              When you tick off scheduled calendar meals as "Eaten" or log takeaway dinners, they automatically populate here with full macro logs.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
