import { User } from "../shared/schema";

export type SubscriptionTier = "free" | "premium";

export const PREMIUM_FEATURES = {
  GUIDED_MOMENTS: "guided_moments",
  PERSONAL_VOICE: "personal_voice",
  UNLIMITED_AFFIRMATIONS: "unlimited_affirmations",
  ADVANCED_ANALYTICS: "advanced_analytics",
} as const;

export const FREE_FEATURES = [
  "Breathing exercises (4 techniques)",
  "Focus Reading Mode",
  "Up to 20 AI affirmations per month",
  "2 AI voices (Lotus & Sage)",
  "Ambient sound library",
  "Daily reminders (up to 5)",
  "Basic listening analytics",
];

export const PREMIUM_FEATURES_LIST = [
  "Affirmations — AI personalized voice",
  "Micro-Meditations — AI personalized voice",
  "Mood Journey — personalized wellness paths",
  "Inner Voice - personal voice cloning",
  "25+ ambient soundscapes",
  "Unlimited AI affirmations",
  "Advanced analytics & insights",
  "Priority support",
  "Early access to new features",
];

const BETA_MODE = true;

export function isPremiumUser(user: User): boolean {
  if (BETA_MODE) return true;
  return user.subscriptionTier === "premium";
}

export function checkPremiumAccess(user: User, feature: string): { allowed: boolean; reason?: string } {
  if (BETA_MODE) return { allowed: true };
  if (user.subscriptionTier === "premium") return { allowed: true };
  return { 
    allowed: false, 
    reason: `${feature} is a premium feature. Upgrade to unlock.` 
  };
}

export { BETA_MODE };
