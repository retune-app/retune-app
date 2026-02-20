export type TimeOfDay = "morning" | "afternoon" | "evening" | "night";

export type SoundId =
  | "rain-soft" | "rain-calming" | "rain-gentle"
  | "ocean-waves-short" | "ocean-waves-beach" | "ocean-birdsong"
  | "forest-birds-morning" | "forest-rain-birds" | "forest-night"
  | "meditation-forest-melody" | "meditation-morning-mist" | "meditation-singing-bowls"
  | "meditation-gentle-chimes" | "meditation-deep-drone"
  | "solfeggio-432hz" | "solfeggio-528hz" | "solfeggio-396hz" | "solfeggio-741hz"
  | "binaural-theta" | "binaural-alpha" | "binaural-delta" | "binaural-beta"
  | "noise-white" | "noise-pink" | "noise-brown";

const TIME_OF_DAY_POOLS: Record<TimeOfDay, SoundId[]> = {
  morning: [
    "forest-birds-morning", "ocean-birdsong", "meditation-morning-mist",
    "meditation-forest-melody", "binaural-alpha", "solfeggio-528hz",
  ],
  afternoon: [
    "binaural-alpha", "noise-pink", "meditation-singing-bowls",
    "ocean-waves-beach", "forest-rain-birds", "solfeggio-741hz",
  ],
  evening: [
    "rain-soft", "meditation-gentle-chimes", "ocean-waves-beach",
    "meditation-singing-bowls", "solfeggio-432hz", "forest-night",
  ],
  night: [
    "noise-brown", "binaural-delta", "meditation-deep-drone",
    "rain-gentle", "binaural-theta", "solfeggio-396hz",
  ],
};

const TECHNIQUE_SOUND_PAIRINGS: Record<string, SoundId[]> = {
  box: ["noise-pink", "binaural-alpha", "meditation-singing-bowls"],
  "478": ["rain-soft", "binaural-delta", "meditation-deep-drone"],
  coherent: ["ocean-waves-beach", "solfeggio-432hz", "meditation-gentle-chimes"],
  energizing: ["binaural-beta", "forest-birds-morning", "binaural-alpha"],
  alternate: ["meditation-singing-bowls", "solfeggio-528hz", "binaural-theta"],
  triangle: ["ocean-waves-beach", "noise-pink", "meditation-morning-mist"],
  "physio-sigh": ["rain-soft", "forest-rain-birds", "ocean-waves-short"],
  "calming-2to1": ["rain-gentle", "binaural-delta", "meditation-deep-drone"],
  "deep-relax-7211": ["noise-brown", "binaural-delta", "rain-soft"],
  "vishama-vritti": ["binaural-alpha", "noise-pink", "meditation-singing-bowls"],
};

export function getTimeOfDay(): TimeOfDay {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 21) return "evening";
  return "night";
}

export function getTimeOfDayLabel(tod: TimeOfDay): string {
  switch (tod) {
    case "morning": return "Morning";
    case "afternoon": return "Afternoon";
    case "evening": return "Evening";
    case "night": return "Night";
  }
}

export interface SmartSoundResult {
  soundId: SoundId;
  reason: "vibe_time_match" | "vibe_preferred" | "technique_time_match" | "technique_paired" | "time_matched";
  label: string;
}

export function getSmartSoundForBreathing(
  techniqueId: string,
  vibePreferredSounds?: string[],
): SmartSoundResult {
  const tod = getTimeOfDay();
  const timePool = TIME_OF_DAY_POOLS[tod];
  const techniqueSounds = TECHNIQUE_SOUND_PAIRINGS[techniqueId] || [];

  if (vibePreferredSounds && vibePreferredSounds.length > 0) {
    const vibeTimeMatch = vibePreferredSounds.find(s => timePool.includes(s as SoundId));
    if (vibeTimeMatch) {
      return { soundId: vibeTimeMatch as SoundId, reason: "vibe_time_match", label: "Matched to your mood & time of day" };
    }
    const validVibe = vibePreferredSounds.find(s => isValidSoundId(s));
    if (validVibe) {
      return { soundId: validVibe as SoundId, reason: "vibe_preferred", label: "Matched to your mood" };
    }
  }

  const techniqueTimeMatch = techniqueSounds.find(s => timePool.includes(s));
  if (techniqueTimeMatch) {
    return { soundId: techniqueTimeMatch, reason: "technique_time_match", label: `Paired with ${getTimeOfDayLabel(tod).toLowerCase()} ${getTechniqueName(techniqueId)}` };
  }

  if (techniqueSounds.length > 0) {
    return { soundId: techniqueSounds[0], reason: "technique_paired", label: `Paired with ${getTechniqueName(techniqueId)}` };
  }

  return { soundId: timePool[0], reason: "time_matched", label: `${getTimeOfDayLabel(tod)} pick` };
}

export function getSmartSoundForAffirmation(
  vibePreferredSounds?: string[],
): SmartSoundResult {
  const tod = getTimeOfDay();
  const timePool = TIME_OF_DAY_POOLS[tod];

  if (vibePreferredSounds && vibePreferredSounds.length > 0) {
    const vibeTimeMatch = vibePreferredSounds.find(s => timePool.includes(s as SoundId));
    if (vibeTimeMatch) {
      return { soundId: vibeTimeMatch as SoundId, reason: "vibe_time_match", label: "Matched to your mood & time of day" };
    }
    const validVibe = vibePreferredSounds.find(s => isValidSoundId(s));
    if (validVibe) {
      return { soundId: validVibe as SoundId, reason: "vibe_preferred", label: "Matched to your mood" };
    }
  }

  return { soundId: timePool[0], reason: "time_matched", label: `${getTimeOfDayLabel(tod)} pick` };
}

export function getSmartSoundForMeditation(
  vibePreferredSounds?: string[],
): SmartSoundResult {
  const tod = getTimeOfDay();
  const timePool = TIME_OF_DAY_POOLS[tod];

  if (vibePreferredSounds && vibePreferredSounds.length > 0) {
    const vibeTimeMatch = vibePreferredSounds.find(s => timePool.includes(s as SoundId));
    if (vibeTimeMatch) {
      return { soundId: vibeTimeMatch as SoundId, reason: "vibe_time_match", label: "Matched to your mood & time of day" };
    }
    const validVibe = vibePreferredSounds.find(s => isValidSoundId(s));
    if (validVibe) {
      return { soundId: validVibe as SoundId, reason: "vibe_preferred", label: "Matched to your mood" };
    }
  }

  return { soundId: timePool[0], reason: "time_matched", label: `${getTimeOfDayLabel(tod)} pick` };
}

export function getSmartSoundForMoodJourney(
  vibePreferredSounds: string[],
): SmartSoundResult {
  const tod = getTimeOfDay();
  const timePool = TIME_OF_DAY_POOLS[tod];

  const vibeTimeMatch = vibePreferredSounds.find(s => timePool.includes(s as SoundId));
  if (vibeTimeMatch) {
    return { soundId: vibeTimeMatch as SoundId, reason: "vibe_time_match", label: "Matched to your mood & time of day" };
  }

  const validVibe = vibePreferredSounds.find(s => isValidSoundId(s));
  if (validVibe) {
    return { soundId: validVibe as SoundId, reason: "vibe_preferred", label: "Matched to your mood" };
  }

  return { soundId: timePool[0], reason: "time_matched", label: `${getTimeOfDayLabel(tod)} pick` };
}

const ALL_SOUND_IDS: Set<string> = new Set([
  "rain-soft", "rain-calming", "rain-gentle",
  "ocean-waves-short", "ocean-waves-beach", "ocean-birdsong",
  "forest-birds-morning", "forest-rain-birds", "forest-night",
  "meditation-forest-melody", "meditation-morning-mist", "meditation-singing-bowls",
  "meditation-gentle-chimes", "meditation-deep-drone",
  "solfeggio-432hz", "solfeggio-528hz", "solfeggio-396hz", "solfeggio-741hz",
  "binaural-theta", "binaural-alpha", "binaural-delta", "binaural-beta",
  "noise-white", "noise-pink", "noise-brown",
]);

function isValidSoundId(s: string): s is SoundId {
  return ALL_SOUND_IDS.has(s);
}

function getTechniqueName(id: string): string {
  const names: Record<string, string> = {
    box: "Box Breathing",
    "478": "4-7-8",
    coherent: "Coherent Breathing",
    energizing: "Energizing Breath",
    alternate: "Nadi Shodhana",
    triangle: "Triangle Breathing",
    "physio-sigh": "Physiological Sigh",
    "calming-2to1": "2:1 Calming",
    "deep-relax-7211": "7-2-11",
    "vishama-vritti": "Vishama Vritti",
  };
  return names[id] || "breathing";
}
