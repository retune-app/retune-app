export type VibeId = "reset" | "chill" | "locked_in" | "glow_up" | "in_my_head" | "steady" | "fired_up" | "heavy";

export interface VibeTTSConfig {
  scriptTone: string;
  humeSpeed: number;
  pauseSeconds: number;
  elevenLabsStability: number;
  elevenLabsStyle: number;
}

export interface VibeBreathingConfig {
  primaryTechniqueId: string;
  primaryTechniqueName: string;
  fallbackTechniqueId: string;
  fallbackTechniqueName: string;
  suggestedDuration: number;
}

export interface VibeAmbientConfig {
  preferredCategories: string[];
  preferredSounds: string[];
}

export interface VibeLanguageConfig {
  tonePrompt: string;
  avoidWords: string[];
  sentenceStyle: string;
}

export interface VibeMeditationConfig {
  style: string;
  focusArea: string;
  ttsConfig: VibeTTSConfig;
}

export interface VibeMatchingConfig {
  boostTags: string[];
  boostPillars: string[];
  penaltyTags: string[];
}

export interface VibeUIConfig {
  accentColor: string;
  gradientColors: [string, string];
  icon: string;
}

export interface VibeConfig {
  id: VibeId;
  label: string;
  subtitle: string;
  description: string;
  moodMapping: {
    startingMoods: string[];
    targetMoods: string[];
  };
  tts: VibeTTSConfig;
  breathing: VibeBreathingConfig;
  ambient: VibeAmbientConfig;
  language: VibeLanguageConfig;
  meditation: VibeMeditationConfig;
  matching: VibeMatchingConfig;
  ui: VibeUIConfig;
}

export const VIBES: Record<VibeId, VibeConfig> = {
  reset: {
    id: "reset",
    label: "Reset",
    subtitle: "I need to start fresh",
    description: "Clearing out the old, making space for what's next",
    moodMapping: {
      startingMoods: ["overwhelmed", "stressed", "scattered"],
      targetMoods: ["calm", "focused", "grounded"],
    },
    tts: {
      scriptTone: "Clear, steady, and renewing. Like the first breath after a storm passes. Use language that acknowledges what was and opens space for what's coming.",
      humeSpeed: 0.9,
      pauseSeconds: 1.5,
      elevenLabsStability: 0.55,
      elevenLabsStyle: 0.3,
    },
    breathing: {
      primaryTechniqueId: "box",
      primaryTechniqueName: "Box Breathing",
      fallbackTechniqueId: "478",
      fallbackTechniqueName: "4-7-8 Relaxation",
      suggestedDuration: 180,
    },
    ambient: {
      preferredCategories: ["nature", "water"],
      preferredSounds: ["morning-rain", "gentle-stream", "morning-birds"],
    },
    language: {
      tonePrompt: "Fresh start energy. Acknowledge what they're leaving behind without dwelling. Forward-looking but not pushy. Clean, simple sentences.",
      avoidWords: ["just", "simply", "easy", "forget"],
      sentenceStyle: "short_declarative",
    },
    meditation: {
      style: "clearing",
      focusArea: "Releasing what's done, arriving in the present",
      ttsConfig: {
        scriptTone: "Steady, clearing, and spacious. Like sweeping a room clean. Each phrase creates more open space.",
        humeSpeed: 0.88,
        pauseSeconds: 1.7,
        elevenLabsStability: 0.55,
        elevenLabsStyle: 0.3,
      },
    },
    matching: {
      boostTags: ["Clarity", "Letting Go", "Calm", "Focus", "Resilience"],
      boostPillars: ["Mind", "Spirit"],
      penaltyTags: ["Drive", "Energy"],
    },
    ui: {
      accentColor: "#50C9B0",
      gradientColors: ["#50C9B0", "#3BA89A"],
      icon: "refresh-cw",
    },
  },

  chill: {
    id: "chill",
    label: "Chill",
    subtitle: "I need to calm down",
    description: "Slowing everything down, finding ease",
    moodMapping: {
      startingMoods: ["stressed", "anxious", "wired"],
      targetMoods: ["calm", "grounded"],
    },
    tts: {
      scriptTone: "Soft, unhurried, and soothing. Like sinking into a warm bath. Use languid, flowing language with natural pauses.",
      humeSpeed: 0.85,
      pauseSeconds: 1.8,
      elevenLabsStability: 0.6,
      elevenLabsStyle: 0.25,
    },
    breathing: {
      primaryTechniqueId: "478",
      primaryTechniqueName: "4-7-8 Relaxation",
      fallbackTechniqueId: "coherent",
      fallbackTechniqueName: "Coherent Breathing",
      suggestedDuration: 180,
    },
    ambient: {
      preferredCategories: ["water", "nature"],
      preferredSounds: ["ocean-waves", "gentle-rain", "forest-night"],
    },
    language: {
      tonePrompt: "Calm and easy. No urgency. Words that feel like exhaling. Invite them to let go without forcing it.",
      avoidWords: ["hustle", "push", "achieve", "power"],
      sentenceStyle: "flowing_gentle",
    },
    meditation: {
      style: "body_scan",
      focusArea: "Releasing tension, softening the body",
      ttsConfig: {
        scriptTone: "Serene, spacious, and deeply unhurried. Like floating on still water. Use languid, flowing language with long vowel sounds.",
        humeSpeed: 0.85,
        pauseSeconds: 1.8,
        elevenLabsStability: 0.6,
        elevenLabsStyle: 0.25,
      },
    },
    matching: {
      boostTags: ["Calm", "Inner Peace", "Letting Go", "Presence", "Healing"],
      boostPillars: ["Spirit", "Mind"],
      penaltyTags: ["Drive", "Energy", "Discipline"],
    },
    ui: {
      accentColor: "#7B68EE",
      gradientColors: ["#7B68EE", "#6252CC"],
      icon: "cloud",
    },
  },

  locked_in: {
    id: "locked_in",
    label: "Locked In",
    subtitle: "I need to focus",
    description: "Sharpening up, cutting through the noise",
    moodMapping: {
      startingMoods: ["tired", "good", "scattered"],
      targetMoods: ["focused", "locked_in", "energized"],
    },
    tts: {
      scriptTone: "Clear, precise, and direct. Like a laser cutting through fog. Each word lands with purpose. No filler, no fluff.",
      humeSpeed: 0.95,
      pauseSeconds: 1.2,
      elevenLabsStability: 0.5,
      elevenLabsStyle: 0.4,
    },
    breathing: {
      primaryTechniqueId: "box",
      primaryTechniqueName: "Box Breathing",
      fallbackTechniqueId: "alternate",
      fallbackTechniqueName: "Alternate Nostril",
      suggestedDuration: 120,
    },
    ambient: {
      preferredCategories: ["focus", "minimal"],
      preferredSounds: ["brown-noise", "deep-focus", "white-noise"],
    },
    language: {
      tonePrompt: "Sharp and clean. Coach energy without the rah-rah. Direct statements that cut through mental fog. Confident, not aggressive.",
      avoidWords: ["maybe", "try", "hope", "wish"],
      sentenceStyle: "short_punchy",
    },
    meditation: {
      style: "focused_attention",
      focusArea: "Sharpening awareness, quieting distraction",
      ttsConfig: {
        scriptTone: "Clear, precise, and centering. Like a laser beam of gentle attention cutting through noise. Clean, purposeful language.",
        humeSpeed: 0.92,
        pauseSeconds: 1.5,
        elevenLabsStability: 0.55,
        elevenLabsStyle: 0.3,
      },
    },
    matching: {
      boostTags: ["Focus", "Clarity", "Discipline", "Drive", "Purpose"],
      boostPillars: ["Mind", "Achievement"],
      penaltyTags: ["Sleep", "Comfort", "Letting Go"],
    },
    ui: {
      accentColor: "#42A5F5",
      gradientColors: ["#42A5F5", "#1E88E5"],
      icon: "crosshair",
    },
  },

  glow_up: {
    id: "glow_up",
    label: "Glow Up",
    subtitle: "I want to feel good about myself",
    description: "Building yourself up from the inside out",
    moodMapping: {
      startingMoods: ["sad", "good", "frustrated"],
      targetMoods: ["confident", "joyful", "lit_up"],
    },
    tts: {
      scriptTone: "Warm, affirming, and uplifting. Like sunlight on your face. Confident without being aggressive. Celebrating who you are.",
      humeSpeed: 0.93,
      pauseSeconds: 1.4,
      elevenLabsStability: 0.5,
      elevenLabsStyle: 0.4,
    },
    breathing: {
      primaryTechniqueId: "coherent",
      primaryTechniqueName: "Coherent Breathing",
      fallbackTechniqueId: "energizing",
      fallbackTechniqueName: "Energizing Breath",
      suggestedDuration: 180,
    },
    ambient: {
      preferredCategories: ["uplifting", "nature"],
      preferredSounds: ["morning-birds", "sunrise-ambient", "warm-breeze"],
    },
    language: {
      tonePrompt: "Warm confidence. Build them up without being cheesy. Words that make them stand taller. Genuine, not performative.",
      avoidWords: ["perfect", "flawless", "amazing", "incredible"],
      sentenceStyle: "affirming_natural",
    },
    meditation: {
      style: "self_compassion",
      focusArea: "Reconnecting with inner strength and worth",
      ttsConfig: {
        scriptTone: "Warm, reverent, and heart-centered. Like sunlight pouring through a window. Rich, appreciative language that savors each quality.",
        humeSpeed: 0.9,
        pauseSeconds: 1.6,
        elevenLabsStability: 0.55,
        elevenLabsStyle: 0.35,
      },
    },
    matching: {
      boostTags: ["Confidence", "Body Love", "Joy", "Gratitude", "Growth"],
      boostPillars: ["Mind", "Connection", "Spirit"],
      penaltyTags: ["Sleep", "Discipline"],
    },
    ui: {
      accentColor: "#F5A623",
      gradientColors: ["#F5A623", "#E5961F"],
      icon: "star",
    },
  },

  in_my_head: {
    id: "in_my_head",
    label: "In My Head",
    subtitle: "I can't stop overthinking",
    description: "Getting out of the loop, back into the body",
    moodMapping: {
      startingMoods: ["anxious", "overwhelmed", "scattered", "wired"],
      targetMoods: ["calm", "focused", "grounded"],
    },
    tts: {
      scriptTone: "Grounding, steady, and anchoring. Like roots growing deep into earth. Concrete, physical language. Repeat grounding cues. Prioritize predictability.",
      humeSpeed: 0.9,
      pauseSeconds: 1.7,
      elevenLabsStability: 0.6,
      elevenLabsStyle: 0.2,
    },
    breathing: {
      primaryTechniqueId: "alternate",
      primaryTechniqueName: "Alternate Nostril",
      fallbackTechniqueId: "478",
      fallbackTechniqueName: "4-7-8 Relaxation",
      suggestedDuration: 180,
    },
    ambient: {
      preferredCategories: ["nature", "grounding"],
      preferredSounds: ["rain-on-leaves", "forest-ambience", "creek-water"],
    },
    language: {
      tonePrompt: "Grounding and physical. Pull them out of their head and into their body. Name physical sensations. Short sentences that anchor.",
      avoidWords: ["think", "analyze", "figure out", "understand"],
      sentenceStyle: "grounding_physical",
    },
    meditation: {
      style: "body_scan",
      focusArea: "Leaving the mind, arriving in the body",
      ttsConfig: {
        scriptTone: "Grounding, steady, and anchoring. Use concrete, physical language — feet on ground, weight of body, solid surfaces. Repeat grounding cues.",
        humeSpeed: 0.9,
        pauseSeconds: 1.7,
        elevenLabsStability: 0.6,
        elevenLabsStyle: 0.2,
      },
    },
    matching: {
      boostTags: ["Calm", "Presence", "Letting Go", "Inner Peace", "Clarity"],
      boostPillars: ["Mind", "Spirit"],
      penaltyTags: ["Drive", "Achievement", "Discipline"],
    },
    ui: {
      accentColor: "#4FC3F7",
      gradientColors: ["#4FC3F7", "#29B6F6"],
      icon: "wind",
    },
  },

  steady: {
    id: "steady",
    label: "Steady",
    subtitle: "I'm good, keep it going",
    description: "Maintaining your balance, deepening what's working",
    moodMapping: {
      startingMoods: ["good", "calm"],
      targetMoods: ["grateful", "joyful", "grounded"],
    },
    tts: {
      scriptTone: "Warm, grounded, and present. Like sitting by a fire with someone you trust. Unhurried, appreciative, savoring.",
      humeSpeed: 0.9,
      pauseSeconds: 1.5,
      elevenLabsStability: 0.55,
      elevenLabsStyle: 0.35,
    },
    breathing: {
      primaryTechniqueId: "coherent",
      primaryTechniqueName: "Coherent Breathing",
      fallbackTechniqueId: "box",
      fallbackTechniqueName: "Box Breathing",
      suggestedDuration: 180,
    },
    ambient: {
      preferredCategories: ["nature", "peaceful"],
      preferredSounds: ["gentle-breeze", "birds-morning", "campfire"],
    },
    language: {
      tonePrompt: "Quiet strength. Acknowledge how good it feels to be here. Deepen what's already working. No urgency to change anything.",
      avoidWords: ["fix", "improve", "change", "need to"],
      sentenceStyle: "appreciative_steady",
    },
    meditation: {
      style: "open_awareness",
      focusArea: "Savoring the present, deepening gratitude",
      ttsConfig: {
        scriptTone: "Warm, reverent, and heart-centered. Appreciative language that savors each moment and connection. Unhurried and present.",
        humeSpeed: 0.9,
        pauseSeconds: 1.6,
        elevenLabsStability: 0.55,
        elevenLabsStyle: 0.35,
      },
    },
    matching: {
      boostTags: ["Gratitude", "Presence", "Inner Peace", "Joy", "Love"],
      boostPillars: ["Spirit", "Connection"],
      penaltyTags: ["Drive", "Discipline"],
    },
    ui: {
      accentColor: "#C9A227",
      gradientColors: ["#E5C95C", "#C9A227"],
      icon: "anchor",
    },
  },

  fired_up: {
    id: "fired_up",
    label: "Fired Up",
    subtitle: "I'm ready to go",
    description: "Channeling raw energy into unstoppable momentum",
    moodMapping: {
      startingMoods: ["good", "wired", "tired"],
      targetMoods: ["energized", "confident", "lit_up", "locked_in"],
    },
    tts: {
      scriptTone: "Bold, powerful, and activating. Like standing at the edge of something big. Confident, forward-moving, direct. Energy without aggression.",
      humeSpeed: 1.0,
      pauseSeconds: 0.9,
      elevenLabsStability: 0.4,
      elevenLabsStyle: 0.5,
    },
    breathing: {
      primaryTechniqueId: "energizing",
      primaryTechniqueName: "Energizing Breath",
      fallbackTechniqueId: "box",
      fallbackTechniqueName: "Box Breathing",
      suggestedDuration: 120,
    },
    ambient: {
      preferredCategories: ["energy", "focus"],
      preferredSounds: ["beta-waves", "power-drone", "heartbeat"],
    },
    language: {
      tonePrompt: "High energy but grounded. Coach before the big game. Direct, punchy, no fluff. Make them feel capable and ready.",
      avoidWords: ["relax", "slow down", "gentle", "soft"],
      sentenceStyle: "punchy_empowering",
    },
    meditation: {
      style: "visualization",
      focusArea: "Seeing success, feeling power in the body",
      ttsConfig: {
        scriptTone: "Strong, grounded, and empowering. Bold language that reinforces inner strength and self-trust. Forward-moving and direct.",
        humeSpeed: 0.95,
        pauseSeconds: 1.4,
        elevenLabsStability: 0.5,
        elevenLabsStyle: 0.4,
      },
    },
    matching: {
      boostTags: ["Energy", "Drive", "Confidence", "Purpose", "Growth"],
      boostPillars: ["Achievement", "Body"],
      penaltyTags: ["Sleep", "Calm", "Comfort", "Letting Go"],
    },
    ui: {
      accentColor: "#E85D5D",
      gradientColors: ["#E85D5D", "#D04545"],
      icon: "zap",
    },
  },

  heavy: {
    id: "heavy",
    label: "Heavy",
    subtitle: "I'm carrying a lot right now",
    description: "Making space for what hurts, without rushing through it",
    moodMapping: {
      startingMoods: ["sad", "overwhelmed", "frustrated"],
      targetMoods: ["calm", "grateful", "grounded"],
    },
    tts: {
      scriptTone: "Tender, compassionate, and unhurried. Like being held by someone who gets it. No silver linings, no fixing. Just presence and warmth.",
      humeSpeed: 0.85,
      pauseSeconds: 2.0,
      elevenLabsStability: 0.6,
      elevenLabsStyle: 0.2,
    },
    breathing: {
      primaryTechniqueId: "coherent",
      primaryTechniqueName: "Coherent Breathing",
      fallbackTechniqueId: "478",
      fallbackTechniqueName: "4-7-8 Relaxation",
      suggestedDuration: 180,
    },
    ambient: {
      preferredCategories: ["gentle", "comfort"],
      preferredSounds: ["soft-rain", "warm-fire", "gentle-piano"],
    },
    language: {
      tonePrompt: "Deeply compassionate. No toxic positivity. No 'it gets better.' Acknowledge the weight. Be present with them. Gentle and honest.",
      avoidWords: ["positive", "bright side", "get over", "move on", "strong", "warrior"],
      sentenceStyle: "compassionate_slow",
    },
    meditation: {
      style: "loving_kindness",
      focusArea: "Self-compassion, being gentle with yourself",
      ttsConfig: {
        scriptTone: "Warm, tender, and compassionate. Like being gently held by someone who truly understands. Soft, comforting language that acknowledges pain without rushing past it.",
        humeSpeed: 0.85,
        pauseSeconds: 2.0,
        elevenLabsStability: 0.6,
        elevenLabsStyle: 0.2,
      },
    },
    matching: {
      boostTags: ["Healing", "Self-Compassion", "Comfort", "Inner Peace", "Love"],
      boostPillars: ["Connection", "Spirit", "Home"],
      penaltyTags: ["Drive", "Energy", "Discipline", "Achievement"],
    },
    ui: {
      accentColor: "#7986CB",
      gradientColors: ["#7986CB", "#5C6BC0"],
      icon: "cloud-rain",
    },
  },
};

export const VIBE_LIST: VibeId[] = ["reset", "chill", "locked_in", "glow_up", "in_my_head", "steady", "fired_up", "heavy"];

export function getVibeConfig(vibeId: string): VibeConfig | undefined {
  return VIBES[vibeId as VibeId];
}

export function getVibeLabel(vibeId: string): string {
  return VIBES[vibeId as VibeId]?.label || vibeId;
}

export function getVibeForMood(startingMood: string): VibeId[] {
  return VIBE_LIST.filter(id => VIBES[id].moodMapping.startingMoods.includes(startingMood));
}

export function getVibeAccentColor(vibeId: string): string {
  return VIBES[vibeId as VibeId]?.ui.accentColor || "#C9A227";
}

export function getStartingMoodForVibe(vibeId: VibeId): string {
  return VIBES[vibeId].moodMapping.startingMoods[0];
}

export function getTargetMoodForVibe(vibeId: VibeId): string {
  return VIBES[vibeId].moodMapping.targetMoods[0];
}

export function resolveVibeFromMoodPair(startingMood: string, targetMood: string): VibeId {
  let bestVibe: VibeId = "reset";
  let bestScore = -1;

  for (const vibeId of VIBE_LIST) {
    const vibe = VIBES[vibeId];
    let score = 0;
    if (vibe.moodMapping.startingMoods.includes(startingMood)) {
      score += vibe.moodMapping.startingMoods.indexOf(startingMood) === 0 ? 3 : 2;
    }
    if (vibe.moodMapping.targetMoods.includes(targetMood)) {
      score += vibe.moodMapping.targetMoods.indexOf(targetMood) === 0 ? 3 : 2;
    }
    if (score > bestScore) {
      bestScore = score;
      bestVibe = vibeId;
    }
  }

  return bestVibe;
}
