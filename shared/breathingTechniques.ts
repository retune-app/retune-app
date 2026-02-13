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
  scienceTip: string;
  detailedBenefits: {
    icon: string;
    text: string;
  }[];
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
    scienceTip: "Equal rhythm activates your parasympathetic system — your body's built-in calm response",
    detailedBenefits: [
      { icon: "target", text: "Sharpens focus and mental clarity" },
      { icon: "anchor", text: "Grounds you in the present moment" },
      { icon: "shield", text: "Reduces stress and anxiety" },
      { icon: "battery-charging", text: "Resets your nervous system" },
    ],
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
    scienceTip: "The extended exhale signals safety to your nervous system, slowing your heart rate naturally",
    detailedBenefits: [
      { icon: "moon", text: "Promotes deep, restful sleep" },
      { icon: "heart", text: "Lowers heart rate and blood pressure" },
      { icon: "wind", text: "Releases physical tension" },
      { icon: "smile", text: "Eases anxiety and racing thoughts" },
    ],
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
    scienceTip: "5-5 rhythm synchronizes your heart and brain waves for optimal balance",
    detailedBenefits: [
      { icon: "heart", text: "Synchronizes heart and brain rhythms" },
      { icon: "activity", text: "Improves heart rate variability" },
      { icon: "sunrise", text: "Creates emotional balance" },
      { icon: "zap", text: "Boosts overall resilience" },
    ],
  },
  {
    id: "energizing",
    name: "Energizing Breath",
    description: "Quick 2-1 rhythm to boost energy and alertness",
    pattern: "2-1 seconds",
    icon: "zap",
    phases: [
      { phase: "inhale", duration: 2 },
      { phase: "exhale", duration: 1 },
    ],
    benefits: "Energy & alertness",
    color: "#E85D5D",
    scienceTip: "Quick breathing floods your system with oxygen for a natural energy boost",
    detailedBenefits: [
      { icon: "zap", text: "Provides a natural energy boost" },
      { icon: "eye", text: "Heightens alertness and awareness" },
      { icon: "cpu", text: "Increases oxygen to the brain" },
      { icon: "trending-up", text: "Elevates mood and motivation" },
    ],
  },
];

export const PHASE_LABELS: Record<BreathPhase, string> = {
  inhale: "Inhale",
  holdIn: "Hold",
  exhale: "Exhale",
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
