"use client";

import React, { useState, useEffect } from "react";
import { UserProfile, updateUserProfile } from "@/lib/firebase";
import {
  calculateMetabolicTargets,
  getActivityLevelDescription,
} from "@/lib/metabolic";
import { Flame, Activity, User, Info, Scale } from "lucide-react";

interface MetabolicDashboardProps {
  profile: UserProfile;
  onProfileChange: (newProfile: UserProfile) => void;
}

export default function MetabolicDashboard({
  profile,
  onProfileChange,
}: MetabolicDashboardProps) {
  const [age, setAge] = useState(profile.age);
  const [weight, setWeight] = useState(profile.weight);
  const [height, setHeight] = useState(profile.height);
  const [gender, setGender] = useState(profile.gender);
  const [activity, setActivity] = useState(profile.activityLevel);
  const [activeBurn, setActiveBurn] = useState(profile.caloriesBurnedToday);
  const [customBmr, setCustomBmr] = useState(profile.bmr);

  // Sync state with profile prop changes
  useEffect(() => {
    setAge(profile.age);
    setWeight(profile.weight);
    setHeight(profile.height);
    setGender(profile.gender);
    setActivity(profile.activityLevel);
    setActiveBurn(profile.caloriesBurnedToday);
    setCustomBmr(profile.bmr);
  }, [profile]);

  // Handle live database updates
  const handleUpdate = async (updates: Partial<UserProfile>) => {
    const updated = await updateUserProfile(updates);
    onProfileChange(updated);
  };

  const targets = calculateMetabolicTargets({
    age,
    gender,
    weight,
    height,
    bmr: customBmr,
    activityLevel: activity,
    caloriesBurnedToday: activeBurn,
  });

  const activityInfo = getActivityLevelDescription(activity);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Configuration Form Card */}
      <div className="lg:col-span-1 bg-zinc-900/60 backdrop-blur-xl border border-zinc-800 rounded-3xl p-6 shadow-2xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-2xl">
            <User className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-zinc-100">Biometrics</h2>
            <p className="text-xs text-zinc-400">Configure your baseline parameters</p>
          </div>
        </div>

        <div className="space-y-5">
          {/* Gender Selector Toggle */}
          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
              Gender Specification
            </label>
            <div className="grid grid-cols-2 gap-2 bg-zinc-950 p-1.5 rounded-2xl border border-zinc-850">
              <button
                type="button"
                onClick={() => {
                  setGender("male");
                  handleUpdate({ gender: "male" });
                }}
                className={`py-2 text-sm font-semibold rounded-xl transition-all duration-300 ${
                  gender === "male"
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Male
              </button>
              <button
                type="button"
                onClick={() => {
                  setGender("female");
                  handleUpdate({ gender: "female" });
                }}
                className={`py-2 text-sm font-semibold rounded-xl transition-all duration-300 ${
                  gender === "female"
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Female
              </button>
            </div>
          </div>

          {/* Age, Weight, Height Fields */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
                Age
              </label>
              <input
                type="number"
                value={age}
                onChange={(e) => {
                  const val = Math.max(1, parseInt(e.target.value) || 0);
                  setAge(val);
                  handleUpdate({ age: val });
                }}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
                Weight (kg)
              </label>
              <input
                type="number"
                value={weight}
                onChange={(e) => {
                  const val = Math.max(1, parseFloat(e.target.value) || 0);
                  setWeight(val);
                  handleUpdate({ weight: val });
                }}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
                Height (cm)
              </label>
              <input
                type="number"
                value={height}
                onChange={(e) => {
                  const val = Math.max(1, parseInt(e.target.value) || 0);
                  setHeight(val);
                  handleUpdate({ height: val });
                }}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Custom BMR Override */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                BMR Direct Adjustment
              </label>
              <span className="text-xxs text-zinc-500 italic">Mifflin-St Jeor: {targets.baseBmr} kcal</span>
            </div>
            <input
              type="number"
              placeholder="e.g. 1750 (0 to auto-calculate)"
              value={customBmr === 0 ? "" : customBmr}
              onChange={(e) => {
                const val = Math.max(0, parseInt(e.target.value) || 0);
                setCustomBmr(val);
                handleUpdate({ bmr: val });
              }}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Calories Burned Today (Acute Adjustment) */}
          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
              Calories Burned Today (Acute Active Burn)
            </label>
            <div className="relative">
              <input
                type="number"
                value={activeBurn === 0 ? "" : activeBurn}
                placeholder="0"
                onChange={(e) => {
                  const val = Math.max(0, parseInt(e.target.value) || 0);
                  setActiveBurn(val);
                  handleUpdate({ caloriesBurnedToday: val });
                }}
                className="w-full bg-zinc-950 border border-zinc-850 rounded-xl pl-10 pr-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-indigo-500"
              />
              <Flame className="w-4.5 h-4.5 text-orange-500 absolute left-3 top-1/2 -translate-y-1/2" />
            </div>
          </div>
        </div>
      </div>

      {/* Activity Slider Card */}
      <div className="lg:col-span-1 bg-zinc-900/60 backdrop-blur-xl border border-zinc-800 rounded-3xl p-6 shadow-2xl flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-2xl">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-zinc-100">Activity Multiplier</h2>
              <p className="text-xs text-zinc-400">Scale metabolic limits continuously</p>
            </div>
          </div>

          <div className="space-y-6">
            {/* Multiplier Slider */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-semibold text-zinc-200">Scale Coefficient</span>
                <span className="text-xl font-extrabold text-emerald-400">{activity.toFixed(3)}x</span>
              </div>
              <input
                type="range"
                min="1.2"
                max="1.9"
                step="0.025"
                value={activity}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setActivity(val);
                  handleUpdate({ activityLevel: val });
                }}
                className="w-full accent-emerald-500 bg-zinc-950 h-2 rounded-lg cursor-pointer"
              />
            </div>

            {/* Slider Value Description Widget */}
            <div className="p-4 bg-zinc-950/70 border border-zinc-850 rounded-2xl flex items-start gap-3">
              <Info className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold text-zinc-200">{activityInfo.title}</h4>
                <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{activityInfo.desc}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="text-zinc-500 text-xxs leading-snug mt-4 border-t border-zinc-850/60 pt-4">
          Adjusting the slider continuously scales your baseline energy allowance. Active burn adds to this ceiling instantly.
        </div>
      </div>

      {/* Target Outputs Card */}
      <div className="lg:col-span-1 bg-zinc-900/60 backdrop-blur-xl border border-zinc-800 rounded-3xl p-6 shadow-2xl flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-purple-500/10 text-purple-400 rounded-2xl">
              <Scale className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-zinc-100">Target Outputs</h2>
              <p className="text-xs text-zinc-400">Your ultimate daily energy requirements</p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Calories Card */}
            <div className="bg-gradient-to-br from-indigo-950/40 to-zinc-950 p-4 border border-zinc-850 rounded-2xl flex justify-between items-center">
              <div>
                <span className="text-xxs font-bold text-indigo-400 uppercase tracking-widest">Ultimate Calories</span>
                <h3 className="text-2xl font-black text-zinc-100 mt-1">{targets.targetCalories} <span className="text-xs font-normal text-zinc-400">kcal/day</span></h3>
              </div>
              <div className="text-right">
                <span className="text-xxs text-zinc-500">TDEE: {targets.tdee}</span>
                <br />
                <span className="text-xxs text-zinc-500">Active: +{activeBurn}</span>
              </div>
            </div>

            {/* Macros Breakdown */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-zinc-950 p-3 border border-zinc-850 rounded-xl text-center">
                <span className="text-xxs text-red-400 font-bold uppercase tracking-wider block">Protein</span>
                <span className="text-lg font-black text-zinc-200 block mt-1">{targets.targetProteinGrams}g</span>
                <span className="text-xxs text-zinc-500">({targets.targetProteinGrams * 4} kcal)</span>
              </div>
              <div className="bg-zinc-950 p-3 border border-zinc-850 rounded-xl text-center">
                <span className="text-xxs text-amber-400 font-bold uppercase tracking-wider block">Carbs</span>
                <span className="text-lg font-black text-zinc-200 block mt-1">{targets.targetCarbsGrams}g</span>
                <span className="text-xxs text-zinc-500">({targets.targetCarbsGrams * 4} kcal)</span>
              </div>
              <div className="bg-zinc-950 p-3 border border-zinc-850 rounded-xl text-center">
                <span className="text-xxs text-blue-400 font-bold uppercase tracking-wider block">Fats</span>
                <span className="text-lg font-black text-zinc-200 block mt-1">{targets.targetFatGrams}g</span>
                <span className="text-xxs text-zinc-500">({targets.targetFatGrams * 9} kcal)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Visual Target Bar */}
        <div className="mt-4 pt-4 border-t border-zinc-850/60">
          <div className="flex justify-between items-center text-xxs font-bold text-zinc-500 uppercase tracking-widest mb-1.5">
            <span>Macro Calorie Ratios</span>
            <span className="text-zinc-400">30% P / 45% C / 25% F</span>
          </div>
          <div className="w-full h-3.5 bg-zinc-950 rounded-full overflow-hidden flex border border-zinc-850">
            <div
              className="bg-red-500 h-full"
              style={{ width: `${(targets.targetProteinGrams * 4 / targets.targetCalories) * 100}%` }}
              title="Protein Calories"
            />
            <div
              className="bg-amber-500 h-full"
              style={{ width: `${(targets.targetCarbsGrams * 4 / targets.targetCalories) * 100}%` }}
              title="Carb Calories"
            />
            <div
              className="bg-blue-500 h-full"
              style={{ width: `${(targets.targetFatGrams * 9 / targets.targetCalories) * 100}%` }}
              title="Fat Calories"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
