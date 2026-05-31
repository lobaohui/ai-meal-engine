import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc, collection, getDocs, updateDoc } from "firebase/firestore";

// Firebase Client configuration
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Check if we have Firebase keys configured
const isFirebaseConfigured =
  firebaseConfig.apiKey &&
  firebaseConfig.projectId &&
  firebaseConfig.apiKey !== "undefined" &&
  firebaseConfig.projectId !== "undefined";

let app: any = null;
let db: any = null;

if (isFirebaseConfigured) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    db = getFirestore(app);
    console.log("Firebase initialized successfully in production cloud driver mode.");
  } catch (error) {
    console.warn("Failed to initialize Firebase SDK. Falling back to LocalStorage driver.", error);
    db = null;
  }
} else {
  console.log("Firebase keys not detected in environment. Using high-fidelity LocalStorage driver.");
}

// Interfaces
export interface UserProfile {
  age: number;
  gender: "male" | "female";
  weight: number; // in kg
  height: number; // in cm
  bmr: number; // calculated or custom overridden BMR
  activityLevel: number; // slider continuous multiplier (1.2 - 1.9)
  caloriesBurnedToday: number; // acute daily burn
}

export interface PantryItem {
  name: string;
  quantity: number; // in grams or individual units
  unit: "g" | "unit" | "ml";
  category: "Proteins" | "Produce" | "Fats/Nuts" | "Flavor Bridges";
}

export interface Ingredient {
  name: string;
  weight: number;
  unit: string;
  category: string;
}

export interface Meal {
  id: string;
  type: "breakfast" | "lunch" | "dinner" | "snack";
  recipeName: string;
  instructions: string;
  ingredients: Ingredient[];
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  status: "pending" | "cooked" | "skipped" | "eating-out" | "eaten";
  takeawayLog?: string;
  originalRecipe?: any; // backup when status is modified
}

export interface DailyMealPlan {
  date: string; // YYYY-MM-DD
  meals: Meal[];
}

// ----------------------------------------------------
// DB DRIVERS & SUBSCRIBER REGISTRY
// ----------------------------------------------------
type DbListener = () => void;
const listeners = new Set<DbListener>();

export function subscribeToDbUpdates(callback: DbListener): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

function notifyDbSubscribers() {
  listeners.forEach((cb) => {
    try {
      cb();
    } catch (e) {
      console.error("Error running listener", e);
    }
  });
}

// LocalStorage fallback mock DB helper
const LOCAL_STORAGE_KEYS = {
  PROFILE: "meal_planner_profile",
  PANTRY: "meal_planner_pantry",
  CALENDAR: "meal_planner_calendar",
};

// Initial Mock Seed Data
const DEFAULT_PROFILE: UserProfile = {
  age: 30,
  gender: "male",
  weight: 78,
  height: 180,
  bmr: 1730,
  activityLevel: 1.375,
  caloriesBurnedToday: 0,
};

const DEFAULT_PANTRY: Record<string, PantryItem> = {
  "chicken_breast": { name: "Chicken Breast", quantity: 600, unit: "g", category: "Proteins" },
  "salmon_fillet": { name: "Salmon Fillet", quantity: 300, unit: "g", category: "Proteins" },
  "fresh_baby_spinach": { name: "Fresh Baby Spinach", quantity: 150, unit: "g", category: "Produce" },
  "broccoli": { name: "Broccoli", quantity: 300, unit: "g", category: "Produce" },
  "sweet_potato": { name: "Sweet Potato", quantity: 500, unit: "g", category: "Produce" },
  "almonds": { name: "Almonds", quantity: 200, unit: "g", category: "Fats/Nuts" },
  "olive_oil": { name: "Olive Oil", quantity: 250, unit: "ml", category: "Fats/Nuts" },
  "garlic": { name: "Garlic", quantity: 4, unit: "unit", category: "Flavor Bridges" },
  "soy_sauce": { name: "Soy Sauce", quantity: 150, unit: "ml", category: "Flavor Bridges" },
};

const DEFAULT_CALENDAR: Record<string, DailyMealPlan> = {};

// Helper to normalize pantry keys
export function normalizePantryKey(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_");
}

// ----------------------------------------------------
// PROFILE INTERACTION METHODS
// ----------------------------------------------------
export async function getUserProfile(): Promise<UserProfile> {
  if (db) {
    try {
      const docRef = doc(db, "user_profiles", "default");
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return docSnap.data() as UserProfile;
      } else {
        await setDoc(docRef, DEFAULT_PROFILE);
        return DEFAULT_PROFILE;
      }
    } catch (e) {
      console.warn("Firestore error reading user profile. Falling back to local storage.", e);
    }
  }

  // Fallback
  if (typeof window !== "undefined") {
    const local = localStorage.getItem(LOCAL_STORAGE_KEYS.PROFILE);
    if (local) {
      try {
        return JSON.parse(local);
      } catch {
        return DEFAULT_PROFILE;
      }
    }
    localStorage.setItem(LOCAL_STORAGE_KEYS.PROFILE, JSON.stringify(DEFAULT_PROFILE));
  }
  return DEFAULT_PROFILE;
}

export async function updateUserProfile(profile: Partial<UserProfile>): Promise<UserProfile> {
  const current = await getUserProfile();
  const updated = { ...current, ...profile };

  if (db) {
    try {
      const docRef = doc(db, "user_profiles", "default");
      await setDoc(docRef, updated);
      notifyDbSubscribers();
      return updated;
    } catch (e) {
      console.warn("Firestore error saving user profile. Falling back to local storage.", e);
    }
  }

  // Fallback
  if (typeof window !== "undefined") {
    localStorage.setItem(LOCAL_STORAGE_KEYS.PROFILE, JSON.stringify(updated));
  }
  notifyDbSubscribers();
  return updated;
}

// ----------------------------------------------------
// PANTRY INTERACTION METHODS
// ----------------------------------------------------
export async function getPantry(): Promise<PantryItem[]> {
  if (db) {
    try {
      const querySnapshot = await getDocs(collection(db, "pantry"));
      const items: PantryItem[] = [];
      querySnapshot.forEach((d) => {
        items.push(d.data() as PantryItem);
      });
      if (items.length > 0) {
        return items;
      }
    } catch (e) {
      console.warn("Firestore error reading pantry. Falling back to local storage.", e);
    }
  }

  // Fallback
  if (typeof window !== "undefined") {
    const local = localStorage.getItem(LOCAL_STORAGE_KEYS.PANTRY);
    if (local) {
      try {
        const parsed = JSON.parse(local);
        return Object.values(parsed);
      } catch {
        return Object.values(DEFAULT_PANTRY);
      }
    }
    localStorage.setItem(LOCAL_STORAGE_KEYS.PANTRY, JSON.stringify(DEFAULT_PANTRY));
  }
  return Object.values(DEFAULT_PANTRY);
}

export async function updatePantryItem(name: string, quantity: number, unit: "g" | "unit" | "ml", category: "Proteins" | "Produce" | "Fats/Nuts" | "Flavor Bridges"): Promise<void> {
  const key = normalizePantryKey(name);
  const item: PantryItem = { name, quantity, unit, category };

  if (db) {
    try {
      const docRef = doc(db, "pantry", key);
      await setDoc(docRef, item);
      notifyDbSubscribers();
      return;
    } catch (e) {
      console.warn("Firestore error saving pantry item. Falling back to local storage.", e);
    }
  }

  // Fallback
  if (typeof window !== "undefined") {
    const local = localStorage.getItem(LOCAL_STORAGE_KEYS.PANTRY);
    const pantry = local ? JSON.parse(local) : { ...DEFAULT_PANTRY };
    pantry[key] = item;
    localStorage.setItem(LOCAL_STORAGE_KEYS.PANTRY, JSON.stringify(pantry));
  }
  notifyDbSubscribers();
}

export async function commitToPantry(items: PantryItem[]): Promise<void> {
  const currentPantry = await getPantry();
  const currentMap = new Map<string, PantryItem>();
  currentPantry.forEach(item => {
    currentMap.set(normalizePantryKey(item.name), item);
  });

  for (const item of items) {
    const key = normalizePantryKey(item.name);
    const existing = currentMap.get(key);
    const updatedQty = existing ? existing.quantity + item.quantity : item.quantity;
    
    if (db) {
      try {
        const docRef = doc(db, "pantry", key);
        await setDoc(docRef, {
          name: existing ? existing.name : item.name,
          quantity: updatedQty,
          unit: item.unit,
          category: item.category
        });
      } catch (e) {
        console.warn("Firestore write in bulk commit failed. LocalStorage fallback will be triggered.", e);
      }
    }
  }

  // LocalStorage Fallback sync
  if (typeof window !== "undefined") {
    const local = localStorage.getItem(LOCAL_STORAGE_KEYS.PANTRY);
    const pantry = local ? JSON.parse(local) : { ...DEFAULT_PANTRY };
    for (const item of items) {
      const key = normalizePantryKey(item.name);
      const existing = pantry[key];
      pantry[key] = {
        name: existing ? existing.name : item.name,
        quantity: existing ? existing.quantity + item.quantity : item.quantity,
        unit: item.unit,
        category: item.category
      };
    }
    localStorage.setItem(LOCAL_STORAGE_KEYS.PANTRY, JSON.stringify(pantry));
  }
  notifyDbSubscribers();
}

export async function deductFromPantry(items: { name: string; quantity: number }[]): Promise<void> {
  const currentPantry = await getPantry();
  const currentMap = new Map<string, PantryItem>();
  currentPantry.forEach(item => {
    currentMap.set(normalizePantryKey(item.name), item);
  });

  for (const item of items) {
    const key = normalizePantryKey(item.name);
    const existing = currentMap.get(key);
    if (existing) {
      const updatedQty = Math.max(0, existing.quantity - item.quantity);
      if (db) {
        try {
          const docRef = doc(db, "pantry", key);
          await setDoc(docRef, { ...existing, quantity: updatedQty });
        } catch (e) {
          console.warn("Firestore deduction failed", e);
        }
      }
    }
  }

  if (typeof window !== "undefined") {
    const local = localStorage.getItem(LOCAL_STORAGE_KEYS.PANTRY);
    if (local) {
      const pantry = JSON.parse(local);
      for (const item of items) {
        const key = normalizePantryKey(item.name);
        const existing = pantry[key];
        if (existing) {
          pantry[key].quantity = Math.max(0, existing.quantity - item.quantity);
        }
      }
      localStorage.setItem(LOCAL_STORAGE_KEYS.PANTRY, JSON.stringify(pantry));
    }
  }
  notifyDbSubscribers();
}

// ----------------------------------------------------
// CALENDAR INTERACTION METHODS
// ----------------------------------------------------
export async function getCalendar(): Promise<Record<string, DailyMealPlan>> {
  if (db) {
    try {
      const querySnapshot = await getDocs(collection(db, "calendar"));
      const calendar: Record<string, DailyMealPlan> = {};
      querySnapshot.forEach((d) => {
        calendar[d.id] = d.data() as DailyMealPlan;
      });
      if (Object.keys(calendar).length > 0) {
        return calendar;
      }
    } catch (e) {
      console.warn("Firestore error reading calendar. Falling back to local storage.", e);
    }
  }

  // Fallback
  if (typeof window !== "undefined") {
    const local = localStorage.getItem(LOCAL_STORAGE_KEYS.CALENDAR);
    if (local) {
      try {
        return JSON.parse(local);
      } catch {
        return DEFAULT_CALENDAR;
      }
    }
    localStorage.setItem(LOCAL_STORAGE_KEYS.CALENDAR, JSON.stringify(DEFAULT_CALENDAR));
  }
  return DEFAULT_CALENDAR;
}

export async function saveDailyMealPlan(date: string, mealPlan: DailyMealPlan): Promise<void> {
  if (db) {
    try {
      const docRef = doc(db, "calendar", date);
      await setDoc(docRef, mealPlan);
      notifyDbSubscribers();
      return;
    } catch (e) {
      console.warn("Firestore error saving meal plan. Falling back to local storage.", e);
    }
  }

  // Fallback
  if (typeof window !== "undefined") {
    const local = localStorage.getItem(LOCAL_STORAGE_KEYS.CALENDAR);
    const calendar = local ? JSON.parse(local) : {};
    calendar[date] = mealPlan;
    localStorage.setItem(LOCAL_STORAGE_KEYS.CALENDAR, JSON.stringify(calendar));
  }
  notifyDbSubscribers();
}

export async function updateMealStatus(
  date: string,
  mealId: string,
  status: Meal["status"],
  extra?: { takeawayLog?: string; originalRecipe?: any }
): Promise<void> {
  const calendar = await getCalendar();
  const dayPlan = calendar[date];
  if (!dayPlan) return;

  const updatedMeals = dayPlan.meals.map((meal) => {
    if (meal.id === mealId) {
      const uMeal = { ...meal, status };
      if (extra?.takeawayLog !== undefined) uMeal.takeawayLog = extra.takeawayLog;
      if (extra?.originalRecipe !== undefined) uMeal.originalRecipe = extra.originalRecipe;
      return uMeal;
    }
    return meal;
  });

  const updatedDayPlan = { ...dayPlan, meals: updatedMeals };
  await saveDailyMealPlan(date, updatedDayPlan);
}
