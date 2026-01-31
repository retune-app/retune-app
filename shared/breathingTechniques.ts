export type BreathPhase = "inhale" | "holdIn" | "exhale" | "holdOut";

export interface BreathingTechnique {
  id: string;
  name: string;
  description: string;
  pattern: string;
  icon: string;
  phases: {
    phase: BreathPhase;
    duration: number;
  }[];
  benefits: string;
  color: string;
}

export const BREATHING_TECHNIQUES: BreathingTechnique[] = [
  {
    id: "box",
    name: "Box Breathing",
    description: "Equal 4-count pattern for focus and calm",
    pattern: "4-4-4-4 seconds",
    icon: "square",
    phases: [
      { phase: "inhale", duration: 4 },
      { phase: "holdIn", duration: 4 },
      { phase: "exhale", duration: 4 },
      { phase: "holdOut", duration: 4 },
    ],
    benefits: "Focus & grounding",
    color: "#50C9B0",
  },
  {
    id: "478",
    name: "4-7-8 Relaxation",
    description: "Deep relaxation for anxiety and sleep",
    pattern: "4-7-8 seconds",
    icon: "moon",
    phases: [
      { phase: "inhale", duration: 4 },
      { phase: "holdIn", duration: 7 },
      { phase: "exhale", duration: 8 },
    ],
    benefits: "Sleep & relaxation",
    color: "#7B68EE",
  },
  {
    id: "coherent",
    name: "Coherent Breathing",
    description: "Balanced 5-5 rhythm for heart coherence",
    pattern: "5-5 seconds",
    icon: "heart",
    phases: [
      { phase: "inhale", duration: 5 },
      { phase: "exhale", duration: 5 },
    ],
    benefits: "Heart coherence",
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
