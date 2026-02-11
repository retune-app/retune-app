export const AI_VOICES = {
  female: [
    { id: "hume_lotus", name: "Lotus", description: "Peaceful, guiding presence" },
    { id: "hume_seraphina", name: "Seraphina", description: "Tranquil, radiant calm" },
    { id: "hume_amber", name: "Amber", description: "Warm, grounding energy" },
    { id: "hume_nova", name: "Nova", description: "Gentle, luminous clarity" },
    { id: "hume_willow", name: "Willow", description: "Soft, graceful wisdom" },
  ],
  male: [
    { id: "hume_orion", name: "Orion", description: "Bold, uplifting strength" },
    { id: "hume_atlas", name: "Atlas", description: "Deep, grounded resonance" },
    { id: "hume_sage", name: "Sage", description: "Calm, centering stillness" },
    { id: "hume_summit", name: "Summit", description: "Steady, expansive clarity" },
    { id: "hume_bodhi", name: "Bodhi", description: "Ancient, soulful wisdom" },
  ],
} as const;

export const VOICE_ID_TO_NAME: Record<string, string> = {
  "hume_seraphina": "Seraphina",
  "hume_lotus": "Lotus",
  "hume_amber": "Amber",
  "hume_nova": "Nova",
  "hume_willow": "Willow",
  "hume_orion": "Orion",
  "hume_atlas": "Atlas",
  "hume_sage": "Sage",
  "hume_summit": "Summit",
  "hume_bodhi": "Bodhi",
};

export function getVoiceDisplayName(
  voiceType: string | null | undefined,
  voiceGender: string | null | undefined,
  aiVoiceId: string | null | undefined
): string {
  if (voiceType === "personal") {
    return "My Voice";
  }
  
  if (aiVoiceId && VOICE_ID_TO_NAME[aiVoiceId]) {
    return VOICE_ID_TO_NAME[aiVoiceId];
  }
  
  if (voiceGender === "male") {
    return "Orion";
  }
  
  return "Lotus";
}
