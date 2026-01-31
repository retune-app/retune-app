export type BreathPhase = "inhale" | "holdIn" | "exhale" | "holdOut";

export interface BreathingTechnique {
  id: string;
  name: string;
  description: string;
  icon: string;
  phases: {
    phase: BreathPhase;
    duration: number;
  }[];
  benefits: string[];
  color: string;
}

export const BREATHING_TECHNIQUES: BreathingTechnique[] = [
  {
    id: "box",
    name: "Box Breathing",
    description: "Equal 4-count pattern for focus and calm",
    icon: "square",
    phases: [
      { phase: "inhale", duration: 4 },
      { phase: "holdIn", duration: 4 },
      { phase: "exhale", duration: 4 },
      { phase: "holdOut", duration: 4 },
    ],
    benefits: ["Reduces stress", "Improves focus", "Calms nervous system"],
    color: "#50C9B0",
  },
  {
    id: "478",
    name: "4-7-8 Relaxation",
    description: "Deep relaxation for anxiety and sleep",
    icon: "moon",
    phases: [
      { phase: "inhale", duration: 4 },
      { phase: "holdIn", duration: 7 },
      { phase: "exhale", duration: 8 },
    ],
    benefits: ["Promotes sleep", "Reduces anxiety", "Lowers heart rate"],
    color: "#7B68EE",
  },
  {
    id: "coherent",
    name: "Coherent Breathing",
    description: "Balanced 5-5 rhythm for heart coherence",
    icon: "heart",
    phases: [
      { phase: "inhale", duration: 5 },
      { phase: "exhale", duration: 5 },
    ],
    benefits: ["Heart-brain harmony", "Emotional balance", "Stress relief"],
    color: "#C9A227",
  },
];

export const PHASE_LABELS: Record<BreathPhase, string> = {
  inhale: "Breathe In",
  holdIn: "Hold",
  exhale: "Breathe Out",
  holdOut: "Hold",
};

export const DURATION_OPTIONS = [
  { label: "1 min", value: 60 },
  { label: "3 min", value: 180 },
  { label: "5 min", value: 300 },
  { label: "10 min", value: 600 },
];

export function getTotalCycleDuration(technique: BreathingTechnique): number {
  return technique.phases.reduce((sum, p) => sum + p.duration, 0);
}

export function getCyclesForDuration(technique: BreathingTechnique, totalSeconds: number): number {
  const cycleDuration = getTotalCycleDuration(technique);
  return Math.floor(totalSeconds / cycleDuration);
}
