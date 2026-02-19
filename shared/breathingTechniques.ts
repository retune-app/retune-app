export type BreathPhase = "inhale" | "holdIn" | "exhale" | "holdOut";

export type BreathingCategory = "sleep" | "focus" | "energy" | "balance";
export type BreathingDifficulty = "beginner" | "intermediate" | "advanced";

export const BREATHING_CATEGORY_LABELS: Record<BreathingCategory, string> = {
  sleep: "Sleep",
  focus: "Focus",
  energy: "Energy",
  balance: "Balance",
};

export const BREATHING_CATEGORY_ICONS: Record<BreathingCategory, string> = {
  sleep: "moon",
  focus: "target",
  energy: "zap",
  balance: "heart",
};

export const BREATHING_CATEGORY_ORDER: BreathingCategory[] = ["balance", "focus", "sleep", "energy"];

export interface BreathingTechnique {
  id: string;
  name: string;
  description: string;
  pattern: string;
  icon: string;
  category: BreathingCategory;
  difficulty: BreathingDifficulty;
  phases: {
    phase: BreathPhase;
    duration: number;
    instruction?: string;
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
    category: "focus",
    difficulty: "beginner",
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
    category: "sleep",
    difficulty: "intermediate",
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
    category: "balance",
    difficulty: "beginner",
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
    category: "energy",
    difficulty: "beginner",
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
  {
    id: "alternate",
    name: "Alternate Nostril",
    description: "Nadi Shodhana — alternating sides for balance",
    pattern: "4-4-4-4 seconds",
    icon: "repeat",
    category: "balance",
    difficulty: "intermediate",
    phases: [
      { phase: "inhale", duration: 4, instruction: "Close right nostril \u2014 inhale left" },
      { phase: "exhale", duration: 4, instruction: "Close left nostril \u2014 exhale right" },
      { phase: "inhale", duration: 4, instruction: "Keep left closed \u2014 inhale right" },
      { phase: "exhale", duration: 4, instruction: "Close right nostril \u2014 exhale left" },
    ],
    benefits: "Balance & mental clarity",
    color: "#5B9BD5",
    scienceTip: "Alternating airflow activates both brain hemispheres, balancing your autonomic nervous system",
    detailedBenefits: [
      { icon: "git-merge", text: "Balances left and right brain hemispheres" },
      { icon: "wind", text: "Calms the nervous system deeply" },
      { icon: "sun", text: "Sharpens focus and mental clarity" },
      { icon: "heart", text: "Improves emotional stability" },
    ],
  },
  {
    id: "triangle",
    name: "Triangle Breathing",
    description: "Simple 3-step pattern for beginners",
    pattern: "4-4-4 seconds",
    icon: "triangle",
    category: "balance",
    difficulty: "beginner",
    phases: [
      { phase: "inhale", duration: 4 },
      { phase: "holdIn", duration: 4 },
      { phase: "exhale", duration: 4 },
    ],
    benefits: "Calm & simplicity",
    color: "#6ECFB8",
    scienceTip: "A gentle three-step rhythm eases your body into relaxation without the complexity of longer patterns",
    detailedBenefits: [
      { icon: "feather", text: "Easy to learn for beginners" },
      { icon: "shield", text: "Reduces mild stress and tension" },
      { icon: "anchor", text: "Anchors attention to the breath" },
      { icon: "smile", text: "Creates a sense of inner calm" },
    ],
  },
  {
    id: "physio-sigh",
    name: "Physiological Sigh",
    description: "Double inhale + long exhale for rapid calm",
    pattern: "4-1-6 seconds",
    icon: "wind",
    category: "balance",
    difficulty: "intermediate",
    phases: [
      { phase: "inhale", duration: 4, instruction: "Deep breath in through the nose" },
      { phase: "inhale", duration: 1, instruction: "Quick sip of air in" },
      { phase: "exhale", duration: 6, instruction: "Slow exhale through the mouth" },
    ],
    benefits: "Rapid stress relief",
    color: "#4EADC5",
    scienceTip: "The double inhale reinflates collapsed lung sacs, maximizing CO2 offload on the long exhale for fast calm",
    detailedBenefits: [
      { icon: "zap", text: "Fastest known way to calm down in real-time" },
      { icon: "heart", text: "Reduces heart rate within one cycle" },
      { icon: "shield", text: "Offloads excess CO2 efficiently" },
      { icon: "trending-down", text: "Lowers stress response immediately" },
    ],
  },
  {
    id: "calming-2to1",
    name: "2:1 Calming Breath",
    description: "Exhale twice as long as you inhale",
    pattern: "4-8 seconds",
    icon: "sunset",
    category: "sleep",
    difficulty: "beginner",
    phases: [
      { phase: "inhale", duration: 4 },
      { phase: "exhale", duration: 8 },
    ],
    benefits: "Deep calm & sleep prep",
    color: "#9B7FD4",
    scienceTip: "A 2:1 exhale-to-inhale ratio strongly activates your vagus nerve, lowering blood pressure naturally",
    detailedBenefits: [
      { icon: "moon", text: "Prepares the body for restful sleep" },
      { icon: "heart", text: "Lowers blood pressure and heart rate" },
      { icon: "wind", text: "Engages the vagus nerve for deep calm" },
      { icon: "feather", text: "Simple enough for total beginners" },
    ],
  },
  {
    id: "deep-relax-7211",
    name: "7-2-11 Deep Relaxation",
    description: "Extended exhale for sleep induction",
    pattern: "7-2-11 seconds",
    icon: "cloud",
    category: "sleep",
    difficulty: "advanced",
    phases: [
      { phase: "inhale", duration: 7 },
      { phase: "holdIn", duration: 2 },
      { phase: "exhale", duration: 11 },
    ],
    benefits: "Sleep induction",
    color: "#6A5ACD",
    scienceTip: "The 11-second exhale creates a powerful parasympathetic wave, priming your body for deep sleep",
    detailedBenefits: [
      { icon: "moon", text: "Induces a sleepy, drowsy state" },
      { icon: "heart", text: "Dramatically slows heart rate" },
      { icon: "wind", text: "Maximizes parasympathetic activation" },
      { icon: "shield", text: "Releases deep-held muscle tension" },
    ],
  },
  {
    id: "vishama-vritti",
    name: "Vishama Vritti",
    description: "Unequal ratio breath for mental clarity",
    pattern: "4-8-6 seconds",
    icon: "eye",
    category: "focus",
    difficulty: "intermediate",
    phases: [
      { phase: "inhale", duration: 4 },
      { phase: "holdIn", duration: 8 },
      { phase: "exhale", duration: 6 },
    ],
    benefits: "Mental clarity & concentration",
    color: "#3E8E9C",
    scienceTip: "The extended hold floods your brain with oxygenated blood while the unequal ratio sharpens concentration",
    detailedBenefits: [
      { icon: "eye", text: "Heightens mental clarity and awareness" },
      { icon: "cpu", text: "Improves concentration and memory" },
      { icon: "target", text: "Sharpens decision-making ability" },
      { icon: "activity", text: "Balances the nervous system" },
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

export function getTechniquesByCategory(category: BreathingCategory): BreathingTechnique[] {
  return BREATHING_TECHNIQUES.filter(t => t.category === category);
}
