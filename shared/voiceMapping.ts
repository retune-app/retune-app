export const AI_VOICES = {
  female: [
    { id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel", description: "Soft, warm tone" },
    { id: "XB0fDUnXU5powFXDhCwa", name: "Charlotte", description: "Warm, British accent" },
    { id: "EXAVITQu4vr4xnSDxMaL", name: "Bella", description: "Soft, gentle" },
  ],
  male: [
    { id: "ErXwobaYiN019PkySvjV", name: "Antoni", description: "Warm, friendly" },
    { id: "onwK4e9ZLuTAKqWW03F9", name: "Daniel", description: "Clear, professional" },
    { id: "pNInz6obpgDQGcFmaJgB", name: "Adam", description: "Deep, calm" },
  ],
} as const;

export const VOICE_ID_TO_NAME: Record<string, string> = {
  "21m00Tcm4TlvDq8ikWAM": "Rachel",
  "XB0fDUnXU5powFXDhCwa": "Charlotte",
  "EXAVITQu4vr4xnSDxMaL": "Bella",
  "ErXwobaYiN019PkySvjV": "Antoni",
  "onwK4e9ZLuTAKqWW03F9": "Daniel",
  "pNInz6obpgDQGcFmaJgB": "Adam",
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
    return "Antoni";
  }
  
  return "Rachel";
}
