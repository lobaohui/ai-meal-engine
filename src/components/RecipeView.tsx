"use client";

import React, { useState } from "react";
import { DailyMealPlan, Meal } from "@/lib/firebase";
import { Search, ChefHat, Clock, Flame, Scale, BookOpen, AlertCircle } from "lucide-react";

interface RecipeViewProps {
  calendar: Record<string, DailyMealPlan>;
}

export default function RecipeView({ calendar }: RecipeViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMeal, setSelectedMeal] = useState<Meal | null>(null);

  // Extract all unique recipes from calendar database
  const getUniqueRecipes = (): Meal[] => {
    const seen = new Set<string>();
    const recipes: Meal[] = [];

    Object.values(calendar).forEach((dayPlan) => {
      dayPlan.meals.forEach((meal) => {
        // Exclude skipped, eating-out, or placeholder meals that don't have ingredients
        if (meal.status !== "eating-out" && meal.ingredients && meal.ingredients.length > 0) {
          const key = meal.recipeName.toLowerCase().trim();
          if (!seen.has(key)) {
            seen.add(key);
            recipes.push(meal);
          }
        }
      });
    });

    return recipes;
  };

  const allRecipes = getUniqueRecipes();

  // Filter recipes by search query
  const filteredRecipes = allRecipes.filter((recipe) =>
    recipe.recipeName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Search & Recipe List Panel */}
      <div className="lg:col-span-1 bg-zinc-900/60 backdrop-blur-xl border border-zinc-800 rounded-3xl p-6 shadow-2xl flex flex-col min-h-[400px]">
        <div className="flex items-center gap-3 mb-5">
          <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-2xl">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-zinc-100">Recipe Book</h2>
            <p className="text-xs text-zinc-400">Your AI-generated culinary library</p>
          </div>
        </div>

        {/* Search input */}
        <div className="relative mb-4">
          <input
            type="text"
            placeholder="Search recipes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-850 rounded-2xl pl-10 pr-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-indigo-500"
          />
          <Search className="w-4.5 h-4.5 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
        </div>

        {/* Recipe card grid list */}
        {filteredRecipes.length > 0 ? (
          <div className="flex-1 overflow-y-auto max-h-[450px] space-y-2 pr-1">
            {filteredRecipes.map((recipe) => (
              <div
                key={recipe.id}
                onClick={() => setSelectedMeal(recipe)}
                className={`p-4 border rounded-2xl cursor-pointer transition duration-300 flex justify-between items-center ${
                  selectedMeal?.recipeName === recipe.recipeName
                    ? "bg-indigo-950/20 border-indigo-500/50"
                    : "bg-zinc-950/40 border-zinc-850 hover:bg-zinc-900/40"
                }`}
              >
                <div>
                  <h4 className="text-xs font-bold text-zinc-100 leading-snug">{recipe.recipeName}</h4>
                  <span className="text-xxs text-zinc-500 uppercase font-black tracking-widest mt-1 block">
                    {recipe.type}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-black text-indigo-400">{recipe.calories} kcal</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex-1 flex flex-col justify-center items-center border border-dashed border-zinc-850 rounded-2xl bg-zinc-950/20 p-6 text-center">
            <AlertCircle className="w-8 h-8 text-zinc-600 mb-3" />
            <h4 className="text-xs font-bold text-zinc-300">No Recipes Found</h4>
            <p className="text-xxs text-zinc-500 max-w-xs mt-1">
              Generate meal plans on the Calendar tab to expand your active kitchen booklet library!
            </p>
          </div>
        )}
      </div>

      {/* Recipe Detail Presentation Panel */}
      <div className="lg:col-span-2 bg-zinc-900/60 backdrop-blur-xl border border-zinc-800 rounded-3xl p-6 shadow-2xl min-h-[400px] flex flex-col justify-between">
        {selectedMeal ? (
          <div className="space-y-6">
            {/* Header info */}
            <div className="flex justify-between items-start border-b border-zinc-850 pb-4">
              <div>
                <span className="text-xxs font-black text-indigo-400 uppercase tracking-widest block mb-1">
                  {selectedMeal.type}
                </span>
                <h2 className="text-2xl font-black text-zinc-100 leading-snug">{selectedMeal.recipeName}</h2>
              </div>
              <div className="bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 text-xs font-black px-3.5 py-1.5 rounded-xl flex items-center gap-1.5">
                <Flame className="w-4 h-4" />
                {selectedMeal.calories} kcal
              </div>
            </div>

            {/* Macro break cards */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-zinc-950 p-3 border border-zinc-850 rounded-2xl text-center">
                <span className="text-xxs text-red-400 font-bold uppercase tracking-wider block">Protein</span>
                <span className="text-lg font-black text-zinc-200 block mt-1">{selectedMeal.protein}g</span>
                <span className="text-xxs text-zinc-500">({selectedMeal.protein * 4} kcal)</span>
              </div>
              <div className="bg-zinc-950 p-3 border border-zinc-850 rounded-2xl text-center">
                <span className="text-xxs text-amber-400 font-bold uppercase tracking-wider block">Carbohydrates</span>
                <span className="text-lg font-black text-zinc-200 block mt-1">{selectedMeal.carbs}g</span>
                <span className="text-xxs text-zinc-500">({selectedMeal.carbs * 4} kcal)</span>
              </div>
              <div className="bg-zinc-950 p-3 border border-zinc-850 rounded-2xl text-center">
                <span className="text-xxs text-blue-400 font-bold uppercase tracking-wider block">Healthy Fats</span>
                <span className="text-lg font-black text-zinc-200 block mt-1">{selectedMeal.fat}g</span>
                <span className="text-xxs text-zinc-500">({selectedMeal.fat * 9} kcal)</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-zinc-850/50">
              {/* Ingredients card list */}
              <div>
                <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-3.5 flex items-center gap-2">
                  <Scale className="w-4 h-4 text-indigo-400" />
                  Ingredients List
                </h3>
                <div className="bg-zinc-950/70 border border-zinc-850 p-4 rounded-2xl space-y-2 max-h-56 overflow-y-auto">
                  {selectedMeal.ingredients.map((ing, idx) => (
                    <div key={idx} className="flex justify-between items-center py-1.5 border-b border-zinc-900 last:border-0 text-xs">
                      <span className="text-zinc-200 font-medium">{ing.name}</span>
                      <span className="bg-zinc-900 border border-zinc-850 text-zinc-400 px-2 py-0.5 rounded-lg text-xxs font-semibold">
                        {ing.weight}{ing.unit}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Cooking directions card */}
              <div>
                <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-3.5 flex items-center gap-2">
                  <ChefHat className="w-4 h-4 text-indigo-400" />
                  Cooking Instructions
                </h3>
                <div className="bg-zinc-950/70 border border-zinc-850 p-4 rounded-2xl space-y-4 max-h-56 overflow-y-auto text-xs text-zinc-300 leading-relaxed">
                  {selectedMeal.instructions.split('.').map((step, idx) => {
                    const cleanStep = step.trim();
                    if (!cleanStep) return null;
                    return (
                      <div key={idx} className="flex gap-3 items-start">
                        <span className="bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 rounded-lg w-5 h-5 shrink-0 flex items-center justify-center font-bold text-xxs mt-0.5">
                          {idx + 1}
                        </span>
                        <p className="flex-1">{cleanStep}.</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col justify-center items-center py-24 text-center">
            <div className="p-4 bg-zinc-950 rounded-full border border-zinc-850 mb-4 animate-pulse">
              <ChefHat className="w-8 h-8 text-zinc-500" />
            </div>
            <h3 className="text-sm font-bold text-zinc-300">Select a Recipe</h3>
            <p className="text-xxs text-zinc-500 max-w-xs mt-1 leading-normal">
              Click any recipe in the book to inspect its culinary instructions, macro breakdowns, and granular weight listings.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
