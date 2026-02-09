import { User } from "../shared/schema";

export type SubscriptionTier = "free" | "premium";

export const PREMIUM_FEATURES = {
  GUIDED_MOMENTS: "guided_moments",
  PERSONAL_VOICE: "personal_voice",
  UNLIMITED_AFFIRMATIONS: "unlimited_affirmations",
  ADVANCED_ANALYTICS: "advanced_analytics",
} as const;

export const FREE_FEATURES = [
  "Basic breathing exercises (4 techniques)",
  "AI Mindful Moment",
  "Up to 10 AI affirmations per month",
  "Stock AI voices (Lotus & Sage)",
  "Ambient sound library (25 tracks)",
  "Daily reminders (up to 5)",
  "Basic listening analytics",
];

export const PREMIUM_FEATURES_LIST = [
  "Micro-Meditations - AI meditation audio",
  "Inner Voice - personal voice cloning",
  "Unlimited AI affirmations",
  "Advanced analytics & insights",
  "Priority support",
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
