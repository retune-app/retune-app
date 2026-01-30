// ElevenLabs integration for voice cloning and TTS
// Uses Replit's ElevenLabs connector

import { ElevenLabsClient } from "elevenlabs";
import WebSocket from "ws";
import fs from "fs";
import path from "path";

let connectionSettings: any;

async function getCredentials() {
  let hostname = process.env.REPLIT_CONNECTORS_HOSTNAME || "";
  // Remove https:// prefix if already present to avoid double protocol
  if (hostname.startsWith("https://")) {
    hostname = hostname.replace("https://", "");
  }
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? "depl " + process.env.WEB_REPL_RENEWAL
      : null;

  if (!xReplitToken) {
    throw new Error("X_REPLIT_TOKEN not found for repl/depl");
  }

  connectionSettings = await fetch(
    "https://" + hostname + "/api/v2/connection?include_secrets=true&connector_names=elevenlabs",
    {
      headers: {
        Accept: "application/json",
        X_REPLIT_TOKEN: xReplitToken,
      },
    }
  ).then((res) => res.json()).then((data) => data.items?.[0]);

  if (!connectionSettings || !connectionSettings.settings.api_key) {
    throw new Error("ElevenLabs not connected");
  }
  return connectionSettings.settings.api_key;
}

export async function getElevenLabsClient() {
  const apiKey = await getCredentials();
  return new ElevenLabsClient({ apiKey });
}

export async function getElevenLabsApiKey() {
  return await getCredentials();
}

/**
 * Clone a voice using ElevenLabs Instant Voice Cloning API.
 * Requires a voice sample (30-60 seconds of audio).
 */
export async function cloneVoice(
  audioFilePath: string,
  name: string = "My Voice"
): Promise<string> {
  const apiKey = await getCredentials();

  // Read the file as a buffer
  const fileBuffer = fs.readFileSync(audioFilePath);
  const fileName = path.basename(audioFilePath);
  
  // Create FormData using native Node.js FormData
  const formData = new FormData();
  formData.append("name", name);
  formData.append("files", new Blob([fileBuffer]), fileName);
  formData.append("description", "User voice for personalized affirmations");

  const response = await fetch("https://api.elevenlabs.io/v1/voices/add", {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("Voice cloning error:", error);
    throw new Error(`Voice cloning failed: ${response.statusText}`);
  }

  const result = await response.json();
  return result.voice_id;
}

// Word timing data structure for RSVP display
export interface WordTiming {
  word: string;
  startMs: number;
  endMs: number;
}

/**
 * Generate speech from text using ElevenLabs TTS with word-level timestamps.
 * Uses the /with-timestamps endpoint for RSVP synchronization.
 * @param text - The text to convert to speech
 * @param voiceId - ElevenLabs voice ID (optional, defaults to a preset voice)
 * @returns Audio buffer in mp3 format with word timing data
 */
export async function textToSpeech(
  text: string,
  voiceId: string = "21m00Tcm4TlvDq8ikWAM" // Default Rachel voice
): Promise<{ audio: ArrayBuffer; duration: number; wordTimings: WordTiming[] }> {
  const apiKey = await getCredentials();

  // Use the with-timestamps endpoint for word timing data
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps`,
    {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.3,
          use_speaker_boost: true,
        },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    console.error("TTS error:", error);
    throw new Error(`TTS failed: ${response.statusText}`);
  }

  const result = await response.json();
  
  // Decode base64 audio
  const audioBase64 = result.audio_base64;
  const audioBuffer = Uint8Array.from(atob(audioBase64), c => c.charCodeAt(0)).buffer;
  
  // Parse character-level timing into word-level timing
  const wordTimings = parseCharacterTimingsToWords(result.alignment);
  
  // Calculate duration from the last word's end time, or estimate if no timing data
  let estimatedDuration: number;
  if (wordTimings.length > 0 && typeof wordTimings[wordTimings.length - 1].endMs === 'number' && !isNaN(wordTimings[wordTimings.length - 1].endMs)) {
    estimatedDuration = Math.ceil(wordTimings[wordTimings.length - 1].endMs / 1000);
  } else {
    // Fallback: estimate duration based on word count (150 words per minute average)
    const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;
    estimatedDuration = Math.max(1, Math.ceil((wordCount / 150) * 60));
  }
  
  // Ensure duration is never NaN or <= 0
  if (isNaN(estimatedDuration) || estimatedDuration <= 0) {
    const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;
    estimatedDuration = Math.max(1, Math.ceil((wordCount / 150) * 60));
  }

  return {
    audio: audioBuffer,
    duration: estimatedDuration,
    wordTimings,
  };
}

/**
 * Parse ElevenLabs character-level alignment data into word-level timing.
 * Supports multiple formats from ElevenLabs API:
 * - Format 1: { characters: string[], character_start_times_seconds: number[], character_end_times_seconds: number[] }
 * - Format 2: { chars: string[], charStartTimesMs: number[], charDurationsMs: number[] }
 * - Format 3: { characters: [{character, start_time_ms, end_time_ms}, ...] }
 */
function parseCharacterTimingsToWords(alignment: any): WordTiming[] {
  if (!alignment) {
    console.log("No alignment data provided");
    return [];
  }

  // Log the alignment structure to debug
  console.log("Alignment keys:", Object.keys(alignment));
  console.log("Alignment sample:", JSON.stringify(alignment).substring(0, 300));

  // Format 1: characters (string or array) with start/end times in seconds (most common ElevenLabs format)
  if (alignment.characters && 
      alignment.character_start_times_seconds && alignment.character_end_times_seconds) {
    console.log("Using Format 1: characters + character_start_times_seconds");
    
    // Handle characters as either string or array
    const chars: string[] = typeof alignment.characters === 'string' 
      ? alignment.characters.split('')
      : Array.isArray(alignment.characters) 
        ? alignment.characters
        : [];
    
    if (chars.length === 0) {
      console.log("No characters found in alignment");
      return [];
    }
    
    console.log(`Processing ${chars.length} characters`);
    
    const words: WordTiming[] = [];
    let currentWord = "";
    let wordStartMs: number | null = null;
    let wordEndMs: number = 0;

    for (let i = 0; i < chars.length; i++) {
      const char = chars[i];
      const startTime = alignment.character_start_times_seconds[i];
      const endTime = alignment.character_end_times_seconds[i];
      
      // Skip if timing data is undefined/null/NaN
      if (startTime === undefined || startTime === null || isNaN(startTime) ||
          endTime === undefined || endTime === null || isNaN(endTime)) {
        continue;
      }
      
      const startMs = Math.round(startTime * 1000);
      const endMs = Math.round(endTime * 1000);
      
      // Skip undefined/null characters
      if (char === undefined || char === null) continue;
      
      if (char === ' ' || char === '\n' || char === '\r' || char === '\t') {
        if (currentWord.length > 0 && wordStartMs !== null) {
          words.push({ word: currentWord, startMs: wordStartMs, endMs: wordEndMs });
        }
        currentWord = "";
        wordStartMs = null;
      } else {
        if (wordStartMs === null) {
          wordStartMs = startMs;
        }
        currentWord += char;
        wordEndMs = endMs;
      }
    }

    if (currentWord.length > 0 && wordStartMs !== null) {
      words.push({ word: currentWord, startMs: wordStartMs, endMs: wordEndMs });
    }

    // Validate words - filter out any containing "undefined"
    const validWords = words.filter(w => 
      w.word && 
      typeof w.word === 'string' && 
      !w.word.includes('undefined') &&
      !isNaN(w.startMs) && 
      !isNaN(w.endMs)
    );
    console.log(`Parsed ${validWords.length} valid words from Format 1 (${words.length} before filtering)`);
    return validWords;
  }

  // Format 2: chars/charStartTimesMs/charDurationsMs arrays
  if (alignment.chars && alignment.charStartTimesMs && alignment.charDurationsMs) {
    console.log("Using Format 2: chars + charStartTimesMs");
    const words: WordTiming[] = [];
    let currentWord = "";
    let wordStartMs: number | null = null;
    let wordEndMs: number = 0;

    for (let i = 0; i < alignment.chars.length; i++) {
      const char = alignment.chars[i];
      const startMs = alignment.charStartTimesMs[i];
      const durationMs = alignment.charDurationsMs[i];
      const endMs = startMs + durationMs;
      
      // Skip undefined/null characters
      if (char === undefined || char === null) continue;
      
      if (char === ' ' || char === '\n' || char === '\r' || char === '\t') {
        if (currentWord.length > 0 && wordStartMs !== null) {
          words.push({ word: currentWord, startMs: wordStartMs, endMs: wordEndMs });
        }
        currentWord = "";
        wordStartMs = null;
      } else {
        if (wordStartMs === null) {
          wordStartMs = startMs;
        }
        currentWord += char;
        wordEndMs = endMs;
      }
    }

    if (currentWord.length > 0 && wordStartMs !== null) {
      words.push({ word: currentWord, startMs: wordStartMs, endMs: wordEndMs });
    }

    console.log(`Parsed ${words.length} words from Format 2`);
    return words;
  }

  // Format 3: characters as array of objects with character, start_time_ms, end_time_ms
  if (alignment.characters && Array.isArray(alignment.characters) && 
      alignment.characters.length > 0 && typeof alignment.characters[0] === 'object') {
    console.log("Using Format 3: characters as objects");
    const words: WordTiming[] = [];
    let currentWord = "";
    let wordStartMs: number | null = null;
    let wordEndMs: number = 0;

    for (const charData of alignment.characters) {
      const char = charData.character;
      
      // Skip undefined/null characters
      if (char === undefined || char === null) continue;
      
      if (char === ' ' || char === '\n' || char === '\r' || char === '\t') {
        if (currentWord.length > 0 && wordStartMs !== null) {
          words.push({ word: currentWord, startMs: wordStartMs, endMs: wordEndMs });
        }
        currentWord = "";
        wordStartMs = null;
      } else {
        if (wordStartMs === null) {
          wordStartMs = charData.start_time_ms;
        }
        currentWord += char;
        wordEndMs = charData.end_time_ms;
      }
    }

    if (currentWord.length > 0 && wordStartMs !== null) {
      words.push({ word: currentWord, startMs: wordStartMs, endMs: wordEndMs });
    }

    console.log(`Parsed ${words.length} words from Format 3`);
    return words;
  }

  // No recognized format - log detailed info and return empty array
  console.log("Unrecognized alignment format. Full structure:", JSON.stringify(alignment).substring(0, 500));
  return [];
}

/**
 * List available voices
 */
export async function listVoices(): Promise<any[]> {
  const apiKey = await getCredentials();

  const response = await fetch("https://api.elevenlabs.io/v1/voices", {
    headers: {
      "xi-api-key": apiKey,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to list voices");
  }

  const result = await response.json();
  return result.voices;
}

/**
 * Delete a cloned voice
 */
export async function deleteVoice(voiceId: string): Promise<void> {
  const apiKey = await getCredentials();

  const response = await fetch(
    `https://api.elevenlabs.io/v1/voices/${voiceId}`,
    {
      method: "DELETE",
      headers: {
        "xi-api-key": apiKey,
      },
    }
  );

  if (!response.ok) {
    throw new Error("Failed to delete voice");
  }
}
