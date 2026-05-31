"use client";

import React, { useState, useEffect } from "react";
import {
  getUserProfile,
  getPantry,
  getCalendar,
  subscribeToDbUpdates,
  UserProfile,
  PantryItem,
  DailyMealPlan,
} from "@/lib/firebase";
import MetabolicDashboard from "@/components/MetabolicDashboard";
import TimelineCalendar from "@/components/TimelineCalendar";
import ReceiptTriage from "@/components/ReceiptTriage";
import ShoppingAssistant from "@/components/ShoppingAssistant";
import RecipeView from "@/components/RecipeView";
import MealArchive from "@/components/MealArchive";
import {
  Activity,
  Calendar as CalendarIcon,
  ChefHat,
  Receipt,
  ShoppingBag,
  BookOpen,
  Archive,
} from "lucide-react";

export default function DashboardHome() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [pantry, setPantry] = useState<PantryItem[]>([]);
  const [calendar, setCalendar] = useState<Record<string, DailyMealPlan>>({});
  const [activeTab, setActiveTab] = useState<"metabolic" | "calendar" | "receipt" | "shopping" | "recipes" | "archive">(
    "metabolic"
  );
  const [loading, setLoading] = useState(true);

  // Fetch all database slices
  const refreshDatabaseSlices = async () => {
    try {
      const uProfile = await getUserProfile();
      const uPantry = await getPantry();
      const uCalendar = await getCalendar();

      setProfile(uProfile);
      setPantry(uPantry);
      setCalendar(uCalendar);
    } catch (e) {
      console.error("Failed to load database states:", e);
    } finally {
      setLoading(false);
    }
  };

  // On mount: register real-time reactive sync listeners across all dashboard widgets!
  useEffect(() => {
    refreshDatabaseSlices();
    const unsubscribe = subscribeToDbUpdates(() => {
      refreshDatabaseSlices();
    });
    return () => unsubscribe();
  }, []);

  if (loading || !profile) {
    return (
      <div className="min-h-screen bg-black flex flex-col justify-center items-center font-sans">
        <div className="relative">
          <ChefHat className="w-12 h-12 text-indigo-500 animate-bounce" />
          <div className="absolute inset-0 bg-indigo-500/25 blur-xl rounded-full scale-150 animate-pulse" />
        </div>
        <span className="text-sm font-bold text-zinc-400 mt-4 tracking-wider uppercase">
          Synthesizing AI Meal Engine...
        </span>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-black text-zinc-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white pb-12">
      {/* Dynamic Ambient Background Blur Nodes */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0 no-print">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-900/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-emerald-900/10 blur-[120px] rounded-full" />
      </div>

      {/* Main Header / Glassmorphism Navbar */}
      <header className="relative z-10 border-b border-zinc-900/80 bg-black/40 backdrop-blur-xl sticky top-0 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col xl:flex-row justify-between items-center gap-4">
          {/* Logo Brand */}
          <div className="flex items-center gap-3">
            <div className="relative p-2.5 bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-2xl shadow-xl shadow-indigo-600/10">
              <ChefHat className="w-6 h-6" />
              <div className="absolute inset-0 bg-white/20 rounded-2xl opacity-0 hover:opacity-100 transition duration-300" />
            </div>
            <div>
              <h1 className="text-lg font-black bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent tracking-tight">
                ANTIGRAVITY MEAL ENGINE
              </h1>
              <p className="text-xxs text-zinc-500 uppercase tracking-widest font-black mt-0.5">
                Metabolic Adaptivity & Retail Rounded Triage
              </p>
            </div>
          </div>

          {/* Premium Glassmorphic Tab Selector Navigation */}
          <nav className="flex flex-wrap bg-zinc-950 p-1.5 rounded-2xl border border-zinc-900 shadow-inner justify-center gap-1">
            <button
              onClick={() => setActiveTab("metabolic")}
              className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl transition-all duration-300 cursor-pointer ${
                activeTab === "metabolic"
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/25"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Activity className="w-4 h-4" />
              Metabolic Center
            </button>

            <button
              onClick={() => setActiveTab("calendar")}
              className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl transition-all duration-300 cursor-pointer ${
                activeTab === "calendar"
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/25"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <CalendarIcon className="w-4 h-4" />
              Meal Calendar
            </button>

            <button
              onClick={() => setActiveTab("recipes")}
              className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl transition-all duration-300 cursor-pointer ${
                activeTab === "recipes"
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/25"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <BookOpen className="w-4 h-4" />
              Recipe Book
            </button>

            <button
              onClick={() => setActiveTab("receipt")}
              className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl transition-all duration-300 cursor-pointer ${
                activeTab === "receipt"
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/25"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Receipt className="w-4 h-4" />
              Receipt Triage
            </button>

            <button
              onClick={() => setActiveTab("shopping")}
              className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl transition-all duration-300 cursor-pointer ${
                activeTab === "shopping"
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/25"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <ShoppingBag className="w-4 h-4" />
              Shopping List
            </button>

            <button
              onClick={() => setActiveTab("archive")}
              className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl transition-all duration-300 cursor-pointer ${
                activeTab === "archive"
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/25"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Archive className="w-4 h-4" />
              Meal History
            </button>
          </nav>
        </div>
      </header>

      {/* Main Dashboard Workspace Content */}
      <section className="relative z-10 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 mt-8 flex-1">
        {/* Render active tab component */}
        {activeTab === "metabolic" && (
          <div className="space-y-6 animate-[fadeIn_0.4s_ease-out]">
            <MetabolicDashboard profile={profile} onProfileChange={setProfile} />
          </div>
        )}

        {activeTab === "calendar" && (
          <div className="animate-[fadeIn_0.4s_ease-out]">
            <TimelineCalendar
              calendar={calendar}
              pantry={pantry}
              profile={profile}
              onRefreshData={refreshDatabaseSlices}
            />
          </div>
        )}

        {activeTab === "recipes" && (
          <div className="animate-[fadeIn_0.4s_ease-out]">
            <RecipeView calendar={calendar} />
          </div>
        )}

        {activeTab === "receipt" && (
          <div className="animate-[fadeIn_0.4s_ease-out]">
            <ReceiptTriage onRefreshData={refreshDatabaseSlices} />
          </div>
        )}

        {activeTab === "shopping" && (
          <div className="animate-[fadeIn_0.4s_ease-out]">
            <ShoppingAssistant
              calendar={calendar}
              pantry={pantry}
              onRefreshData={refreshDatabaseSlices}
            />
          </div>
        )}

        {activeTab === "archive" && (
          <div className="animate-[fadeIn_0.4s_ease-out]">
            <MealArchive calendar={calendar} />
          </div>
        )}
      </section>
    </main>
  );
}
