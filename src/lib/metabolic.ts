import { UserProfile } from "./firebase";

/**
 * Calculates the Base Metabolic Rate (BMR) using the Mifflin-St Jeor equation.
 * Male: BMR = 10 * weight (kg) + 6.25 * height (cm) - 5 * age (y) + 5
 * Female: BMR = 10 * weight (kg) + 6.25 * height (cm) - 5 * age (y) - 161
 */
export function calculateMifflinStJeorBMR(
  age: number,
  gender: "male" | "female",
  weight: number,
  height: number
): number {
  const bmrBase = 10 * weight + 6.25 * height - 5 * age;
  if (gender === "male") {
    return Math.round(bmrBase + 5);
  } else {
    return Math.round(bmrBase - 161);
  }
}

export interface MetabolicOutputs {
  baseBmr: number;
  tdee: number; // Total Daily Energy Expenditure (BMR * Activity Multiplier)
  targetCalories: number; // TDEE + CaloriesBurnedToday
  targetProteinGrams: number; // 2.0g per kg of bodyweight
  targetCarbsGrams: number; // Remaining balance carbs
  targetFatGrams: number; // Remaining balance fats
}

/**
 * Computes ultimate daily energy expenditure and macronutrient distributions.
 * Target Protein: 2.0g per kg of bodyweight (yielding 4 kcal/g).
 * Target Fat: 25% of total calorie intake (yielding 9 kcal/g).
 * Target Carbohydrates: The remaining calorie budget (yielding 4 kcal/g).
 */
export function calculateMetabolicTargets(profile: UserProfile): MetabolicOutputs {
  const baseBmr = calculateMifflinStJeorBMR(
    profile.age,
    profile.gender,
    profile.weight,
    profile.height
  );

  // If the profile BMR is custom overridden, use it; otherwise, use computed Mifflin-St Jeor BMR
  const activeBmr = profile.bmr > 0 ? profile.bmr : baseBmr;

  // Base TDEE = BMR * Activity Slider Multiplier
  const tdee = Math.round(activeBmr * profile.activityLevel);

  // Ultimate Target Calories = TDEE + Calories Burned Today
  const targetCalories = Math.max(1200, tdee + profile.caloriesBurnedToday);

  // 1. Protein Target: 2.0g per kg of bodyweight
  // (e.g. 78 kg * 2.0 = 156g of protein = 624 kcal)
  const targetProteinGrams = Math.round(profile.weight * 2.0);
  const proteinKcal = targetProteinGrams * 4;

  // 2. Fat Target: 25% of ultimate calories
  // (e.g. 2000 kcal * 0.25 = 500 kcal = 55.5g of fat)
  const fatKcal = targetCalories * 0.25;
  const targetFatGrams = Math.round(fatKcal / 9);

  // 3. Carbohydrate Target: Remaining Calorie Budget
  // Carbs = (Total Calories - Protein Calories - Fat Calories) / 4
  const remainingKcal = Math.max(0, targetCalories - proteinKcal - fatKcal);
  const targetCarbsGrams = Math.round(remainingKcal / 4);

  return {
    baseBmr,
    tdee,
    targetCalories,
    targetProteinGrams,
    targetCarbsGrams,
    targetFatGrams,
  };
}

/**
 * Continuous Activity Multiplier mapper that gives a descriptive label for slider positions.
 */
export function getActivityLevelDescription(multiplier: number): {
  title: string;
  desc: string;
} {
  if (multiplier < 1.3) {
    return { title: "Sedentary", desc: "Desk job, little to no active exercise (1.2x)" };
  } else if (multiplier < 1.5) {
    return { title: "Lightly Active", desc: "Light exercise or sports 1-3 days/week (1.375x)" };
  } else if (multiplier < 1.7) {
    return { title: "Moderately Active", desc: "Moderate exercise or sports 3-5 days/week (1.55x)" };
  } else if (multiplier < 1.85) {
    return { title: "Very Active", desc: "Hard exercise or sports 6-7 days/week (1.725x)" };
  } else {
    return { title: "Extremely Active", desc: "Hard daily physical labor, professional athletics (1.9x)" };
  }
}
