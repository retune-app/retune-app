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
    description: "Mental clarity, focus, and emotional resilience",
    subcategories: ["Confidence", "Focus", "Resilience", "Emotion"],
  },
  Body: {
    name: "Body",
    color: "#10B981",
    lightColor: "#D1FAE5",
    icon: "heart",
    description: "Physical health, rest, and self-acceptance",
    subcategories: ["Health", "Sleep", "Body Image"],
  },
  Spirit: {
    name: "Spirit",
    color: "#8B5CF6",
    lightColor: "#EDE9FE",
    icon: "sun",
    description: "Inner peace, gratitude, and vision for the future",
    subcategories: ["Gratitude", "Happiness", "Vision"],
  },
  Connection: {
    name: "Connection",
    color: "#F97316",
    lightColor: "#FFEDD5",
    icon: "users",
    description: "Relationships and self-compassion",
    subcategories: ["Relationships", "Self-Compassion"],
  },
  Achievement: {
    name: "Achievement",
    color: "#CD7F32",
    lightColor: "#FEF3C7",
    icon: "target",
    description: "Career success, wealth, and personal growth",
    subcategories: ["Career", "Wealth", "Skills", "Habits", "Motivation"],
  },
  Home: {
    name: "Home",
    color: "#E07A5F",
    lightColor: "#FDE8E4",
    icon: "home",
    description: "Family harmony, living space, and domestic peace",
    subcategories: ["Family", "Organization", "Environment"],
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
