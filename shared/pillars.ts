export type PillarName = "Mind" | "Body" | "Spirit" | "Connection" | "Achievement" | "Home";

export interface Pillar {
  name: PillarName;
  color: string;
  lightColor: string;
  icon: string;
  description: string;
  subcategories: string[];
}

export const PILLARS: Record<PillarName, Pillar> = {
  Mind: {
    name: "Mind",
    color: "#3B82F6",
    lightColor: "#DBEAFE",
    icon: "zap",
    description: "Mental clarity, focus, and emotional balance",
    subcategories: ["Confidence", "Focus", "Resilience", "Calm", "Letting Go", "Clarity"],
  },
  Body: {
    name: "Body",
    color: "#10B981",
    lightColor: "#D1FAE5",
    icon: "heart",
    description: "Physical health, rest, vitality, and self-acceptance",
    subcategories: ["Health", "Sleep", "Energy", "Body Love", "Healing"],
  },
  Spirit: {
    name: "Spirit",
    color: "#8B5CF6",
    lightColor: "#EDE9FE",
    icon: "sun",
    description: "Inner peace, gratitude, joy, and life purpose",
    subcategories: ["Gratitude", "Joy", "Inner Peace", "Purpose", "Presence"],
  },
  Connection: {
    name: "Connection",
    color: "#F97316",
    lightColor: "#FFEDD5",
    icon: "users",
    description: "Relationships, self-compassion, and belonging",
    subcategories: ["Love", "Self-Compassion", "Forgiveness", "Belonging"],
  },
  Achievement: {
    name: "Achievement",
    color: "#CD7F32",
    lightColor: "#FEF3C7",
    icon: "target",
    description: "Career success, abundance, and personal growth",
    subcategories: ["Career", "Abundance", "Growth", "Discipline", "Drive"],
  },
  Home: {
    name: "Home",
    color: "#E07A5F",
    lightColor: "#FDE8E4",
    icon: "home",
    description: "Family harmony, safety, and domestic peace",
    subcategories: ["Family", "Harmony", "Safety", "Comfort"],
  },
};

export const PILLAR_LIST: PillarName[] = ["Mind", "Body", "Spirit", "Connection", "Achievement", "Home"];

export const ALL_SUBCATEGORIES = Object.values(PILLARS).flatMap((p) => p.subcategories);

export function getPillarForSubcategory(subcategory: string): PillarName | null {
  for (const [pillarName, pillar] of Object.entries(PILLARS)) {
    if (pillar.subcategories.includes(subcategory)) {
      return pillarName as PillarName;
    }
  }
  return null;
}

export function getPillarColor(pillarName: string | null | undefined): string {
  if (!pillarName || !(pillarName in PILLARS)) {
    return "#C9A227";
  }
  return PILLARS[pillarName as PillarName].color;
}

export function getSubcategoriesForPillar(pillarName: PillarName): string[] {
  return PILLARS[pillarName]?.subcategories || [];
}

export const TAG_MIGRATION_MAP: Record<string, string> = {
  "Emotion": "Calm",
  "Body Image": "Body Love",
  "Happiness": "Joy",
  "Vision": "Purpose",
  "Relationships": "Love",
  "Wealth": "Abundance",
  "Skills": "Growth",
  "Habits": "Discipline",
  "Motivation": "Drive",
  "Organization": "Harmony",
  "Environment": "Comfort",
};

export type MoodType = "calm" | "stressed" | "tired" | "energized" | "anxious" | "grateful";
export type TimeOfDay = "morning" | "afternoon" | "evening" | "night";

export const MOOD_TAG_PREFERENCES: Record<MoodType, Record<TimeOfDay, { preferredTags: string[]; preferredPillars: string[] }>> = {
  calm: {
    morning: { preferredTags: ["Presence", "Gratitude", "Inner Peace", "Purpose"], preferredPillars: ["Spirit", "Mind"] },
    afternoon: { preferredTags: ["Focus", "Clarity", "Inner Peace", "Presence"], preferredPillars: ["Mind", "Spirit"] },
    evening: { preferredTags: ["Gratitude", "Joy", "Inner Peace", "Love"], preferredPillars: ["Spirit", "Connection"] },
    night: { preferredTags: ["Sleep", "Inner Peace", "Calm", "Comfort"], preferredPillars: ["Body", "Spirit"] },
  },
  stressed: {
    morning: { preferredTags: ["Calm", "Clarity", "Focus", "Resilience"], preferredPillars: ["Mind", "Body"] },
    afternoon: { preferredTags: ["Letting Go", "Calm", "Clarity", "Focus"], preferredPillars: ["Mind", "Body"] },
    evening: { preferredTags: ["Letting Go", "Calm", "Inner Peace", "Comfort"], preferredPillars: ["Mind", "Home"] },
    night: { preferredTags: ["Sleep", "Letting Go", "Calm", "Comfort"], preferredPillars: ["Body", "Mind"] },
  },
  tired: {
    morning: { preferredTags: ["Energy", "Drive", "Confidence", "Health"], preferredPillars: ["Body", "Achievement"] },
    afternoon: { preferredTags: ["Energy", "Focus", "Drive", "Clarity"], preferredPillars: ["Body", "Achievement"] },
    evening: { preferredTags: ["Sleep", "Calm", "Healing", "Comfort"], preferredPillars: ["Body", "Home"] },
    night: { preferredTags: ["Sleep", "Healing", "Calm", "Comfort"], preferredPillars: ["Body", "Home"] },
  },
  energized: {
    morning: { preferredTags: ["Drive", "Confidence", "Growth", "Purpose"], preferredPillars: ["Achievement", "Mind"] },
    afternoon: { preferredTags: ["Focus", "Career", "Growth", "Abundance"], preferredPillars: ["Achievement", "Mind"] },
    evening: { preferredTags: ["Gratitude", "Joy", "Love", "Presence"], preferredPillars: ["Spirit", "Connection"] },
    night: { preferredTags: ["Gratitude", "Inner Peace", "Calm", "Presence"], preferredPillars: ["Spirit", "Mind"] },
  },
  anxious: {
    morning: { preferredTags: ["Calm", "Resilience", "Confidence", "Safety"], preferredPillars: ["Mind", "Home"] },
    afternoon: { preferredTags: ["Calm", "Letting Go", "Focus", "Resilience"], preferredPillars: ["Mind", "Spirit"] },
    evening: { preferredTags: ["Inner Peace", "Letting Go", "Calm", "Safety"], preferredPillars: ["Spirit", "Mind"] },
    night: { preferredTags: ["Sleep", "Calm", "Safety", "Inner Peace"], preferredPillars: ["Body", "Mind"] },
  },
  grateful: {
    morning: { preferredTags: ["Gratitude", "Joy", "Purpose", "Abundance"], preferredPillars: ["Spirit", "Achievement"] },
    afternoon: { preferredTags: ["Gratitude", "Love", "Joy", "Belonging"], preferredPillars: ["Connection", "Spirit"] },
    evening: { preferredTags: ["Gratitude", "Love", "Joy", "Family"], preferredPillars: ["Connection", "Spirit"] },
    night: { preferredTags: ["Gratitude", "Inner Peace", "Calm", "Comfort"], preferredPillars: ["Spirit", "Home"] },
  },
};

export function migrateTag(tag: string): string {
  return TAG_MIGRATION_MAP[tag] || tag;
}

export function migrateCategoryName(categoryName: string): string {
  return categoryName
    .split(",")
    .map((t) => migrateTag(t.trim()))
    .join(",");
}
