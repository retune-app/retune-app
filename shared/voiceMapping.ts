export const AI_VOICES = {
  female: [
    { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah", description: "Mature, reassuring, confident" },
    { id: "FGY2WhTYpPnrIDTdsKH5", name: "Laura", description: "Enthusiastic, quirky" },
    { id: "Xb7hH8MSUJpSbSDYk0k2", name: "Alice", description: "Clear, engaging, British" },
    { id: "XrExE9yKIg1WjnnlVkGX", name: "Matilda", description: "Knowledgeable, professional" },
    { id: "cgSgspJ2msm6clMCkdW9", name: "Jessica", description: "Playful, bright, warm" },
    { id: "hpp4J3VqNfWAUOO0d1Us", name: "Bella", description: "Professional, warm" },
    { id: "pFZP5JQG7iQjIQuC4Bku", name: "Lily", description: "Velvety, British actress" },
    { id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel", description: "Soft, warm tone (legacy)" },
    { id: "XB0fDUnXU5powFXDhCwa", name: "Charlotte", description: "Warm, British (legacy)" },
  ],
  male: [
    { id: "CwhRBWXzGAHq8TQ4Fs17", name: "Roger", description: "Laid-back, casual, resonant" },
    { id: "IKne3meq5aSn9XLyUdCD", name: "Charlie", description: "Deep, confident, Australian" },
    { id: "JBFqnCBsd6RMkjVDRZzb", name: "George", description: "Warm, captivating storyteller, British" },
    { id: "TX3LPaxmHKxFdv7VOQHJ", name: "Liam", description: "Energetic, social media creator" },
    { id: "bIHbv24MWmeRgasZH58o", name: "Will", description: "Relaxed, optimistic" },
    { id: "cjVigY5qzO86Huf0OWal", name: "Eric", description: "Smooth, trustworthy" },
    { id: "iP95p4xoKVk53GoZ742B", name: "Chris", description: "Charming, down-to-earth" },
    { id: "nPczCjzI2devNBz1zQrb", name: "Brian", description: "Deep, resonant, comforting" },
    { id: "onwK4e9ZLuTAKqWW03F9", name: "Daniel", description: "Steady, professional, British" },
    { id: "pNInz6obpgDQGcFmaJgB", name: "Adam", description: "Dominant, firm" },
    { id: "pqHfZKP75CvOlQylNhV4", name: "Bill", description: "Wise, mature, balanced" },
    { id: "ErXwobaYiN019PkySvjV", name: "Antoni", description: "Warm, friendly (legacy)" },
  ],
} as const;

export const VOICE_ID_TO_NAME: Record<string, string> = {
  "EXAVITQu4vr4xnSDxMaL": "Sarah",
  "FGY2WhTYpPnrIDTdsKH5": "Laura",
  "Xb7hH8MSUJpSbSDYk0k2": "Alice",
  "XrExE9yKIg1WjnnlVkGX": "Matilda",
  "cgSgspJ2msm6clMCkdW9": "Jessica",
  "hpp4J3VqNfWAUOO0d1Us": "Bella",
  "pFZP5JQG7iQjIQuC4Bku": "Lily",
  "21m00Tcm4TlvDq8ikWAM": "Rachel",
  "XB0fDUnXU5powFXDhCwa": "Charlotte",
  "CwhRBWXzGAHq8TQ4Fs17": "Roger",
  "IKne3meq5aSn9XLyUdCD": "Charlie",
  "JBFqnCBsd6RMkjVDRZzb": "George",
  "TX3LPaxmHKxFdv7VOQHJ": "Liam",
  "bIHbv24MWmeRgasZH58o": "Will",
  "cjVigY5qzO86Huf0OWal": "Eric",
  "iP95p4xoKVk53GoZ742B": "Chris",
  "nPczCjzI2devNBz1zQrb": "Brian",
  "onwK4e9ZLuTAKqWW03F9": "Daniel",
  "pNInz6obpgDQGcFmaJgB": "Adam",
  "pqHfZKP75CvOlQylNhV4": "Bill",
  "ErXwobaYiN019PkySvjV": "Antoni",
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
    return "Roger";
  }
  
  return "Sarah";
}
