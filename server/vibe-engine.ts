import { getVibeConfig, getStartingMoodForVibe, getTargetMoodForVibe, type VibeId, type VibeConfig, type VibeTTSConfig, type VibeMatchingConfig } from "@shared/vibes";

export interface VibeRoutingResult {
  vibeId: VibeId;
  vibe: VibeConfig;
  startingMood: string;
  targetMood: string;
  breathingTechniqueId: string;
  breathingTechniqueName: string;
  suggestedBreathingDuration: number;
  tts: VibeTTSConfig;
  meditationStyle: string;
  meditationFocus: string;
  meditationTTS: VibeTTSConfig;
  matching: VibeMatchingConfig;
  ambientSounds: string[];
  ambientCategories: string[];
  languageTone: string;
  languageAvoidWords: string[];
  accentColor: string;
  icon: string;
}

export function routeVibe(vibeId: string): VibeRoutingResult | null {
  const vibe = getVibeConfig(vibeId);
  if (!vibe) return null;

  return {
    vibeId: vibe.id,
    vibe,
    startingMood: getStartingMoodForVibe(vibe.id),
    targetMood: getTargetMoodForVibe(vibe.id),
    breathingTechniqueId: vibe.breathing.primaryTechniqueId,
    breathingTechniqueName: vibe.breathing.primaryTechniqueName,
    suggestedBreathingDuration: vibe.breathing.suggestedDuration,
    tts: vibe.tts,
    meditationStyle: vibe.meditation.style,
    meditationFocus: vibe.meditation.focusArea,
    meditationTTS: vibe.meditation.ttsConfig,
    matching: vibe.matching,
    ambientSounds: vibe.ambient.preferredSounds,
    ambientCategories: vibe.ambient.preferredCategories,
    languageTone: vibe.language.tonePrompt,
    languageAvoidWords: vibe.language.avoidWords,
    accentColor: vibe.ui.accentColor,
    icon: vibe.ui.icon,
  };
}

export function scoreAffirmationForVibe(
  affirmation: { categoryName?: string | null; pillar?: string | null; isFavorite?: boolean | null; voiceType?: string | null },
  matching: VibeMatchingConfig,
  userPreferredVoiceType: string
): number {
  let score = 0;
  const tags = (affirmation.categoryName || "").split(",").map(t => t.trim()).filter(Boolean);

  const tagMatches = tags.filter(t => matching.boostTags.includes(t)).length;
  score += tagMatches * 4;

  if (affirmation.pillar && matching.boostPillars.includes(affirmation.pillar)) {
    score += matching.boostPillars.indexOf(affirmation.pillar) === 0 ? 3 : 2;
  }

  const penaltyMatches = tags.filter(t => matching.penaltyTags.includes(t)).length;
  score -= penaltyMatches * 3;

  if (affirmation.isFavorite) score += 1;
  if (affirmation.voiceType === userPreferredVoiceType) score += 1;

  return score;
}

export function pickBestAffirmation<T extends { categoryName?: string | null; pillar?: string | null; isFavorite?: boolean | null; voiceType?: string | null; audioUrl?: string | null }>(
  affirmations: T[],
  matching: VibeMatchingConfig,
  userPreferredVoiceType: string
): { affirmation: T; matchReason: "tag" | "pillar" | "any" } | null {
  const withAudio = affirmations.filter(a => a.audioUrl);
  if (withAudio.length === 0) return null;

  const scored = withAudio.map(a => ({
    affirmation: a,
    score: scoreAffirmationForVibe(a, matching, userPreferredVoiceType),
  }));
  scored.sort((a, b) => b.score - a.score);

  const topScore = scored[0].score;
  if (topScore > 0) {
    const topPool = scored.filter(a => a.score === topScore);
    const picked = topPool[Math.floor(Math.random() * topPool.length)];
    return {
      affirmation: picked.affirmation,
      matchReason: topScore >= 4 ? "tag" : "pillar",
    };
  }

  return {
    affirmation: withAudio[Math.floor(Math.random() * withAudio.length)],
    matchReason: "any",
  };
}

export function getSuggestedCreationTheme(vibeId: VibeId, timeOfDay: string): string {
  const themes: Record<string, Record<string, string>> = {
    reset: { morning: "starting fresh with clear intentions", afternoon: "clearing mental clutter and resetting", evening: "releasing the day and making space", night: "letting go and preparing for renewal" },
    chill: { morning: "calm energy to start your day", afternoon: "finding ease in the middle of everything", evening: "unwinding and settling into peace", night: "deep relaxation and restful surrender" },
    locked_in: { morning: "sharp focus for what matters most today", afternoon: "cutting through distraction and delivering", evening: "clarity on tomorrow's priorities", night: "planting focused intentions while you rest" },
    determined: { morning: "building resolve for what matters most today", afternoon: "pushing through with unwavering purpose", evening: "strengthening your commitment to your path", night: "letting determination take root while you rest" },
    glow_up: { morning: "stepping into your best self today", afternoon: "owning your strengths right now", evening: "celebrating who you're becoming", night: "letting confidence build while you sleep" },
    in_my_head: { morning: "grounding yourself before the day begins", afternoon: "getting out of the loop and into the moment", evening: "releasing overthinking and finding stillness", night: "quieting the mind for peaceful sleep" },
    steady: { morning: "deepening your natural rhythm", afternoon: "sustaining your flow and presence", evening: "appreciating how far you've come", night: "resting in gratitude and contentment" },
    fired_up: { morning: "channeling your energy into action", afternoon: "maintaining your unstoppable momentum", evening: "carrying your fire into tomorrow", night: "letting your ambition recharge overnight" },
    heavy: { morning: "being gentle with yourself today", afternoon: "making space for what you're feeling", evening: "honoring your emotions without rushing", night: "resting your heart and trusting the process" },
  };

  return themes[vibeId]?.[timeOfDay] || "your current emotional state";
}

export function getVibeJourneyPromptContext(vibeId: VibeId): string {
  const vibe = getVibeConfig(vibeId);
  if (!vibe) return "";

  return `The user selected the "${vibe.label}" vibe ("${vibe.subtitle}"). This means: ${vibe.description}. 
Tone guidance: ${vibe.language.tonePrompt}
Words/phrases to avoid: ${vibe.language.avoidWords.join(", ")}`;
}
