// ElevenLabs integration for voice cloning and TTS
// Uses Replit's ElevenLabs connector

import { ElevenLabsClient } from "elevenlabs";
import WebSocket from "ws";
import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { writeFile, unlink, readFile } from "fs/promises";
import { randomUUID } from "crypto";
import { tmpdir } from "os";
import { join } from "path";

// Pause duration between sentences in seconds
const SENTENCE_PAUSE_SECONDS = 1.5;

/**
 * Find indices of words that end sentences (ending with . ! ?)
 */
function findSentenceEndIndices(words: WordTiming[]): number[] {
  const indices: number[] = [];
  for (let i = 0; i < words.length; i++) {
    const word = words[i].word;
    // Check if word ends with sentence-ending punctuation
    if (/[.!?]["']?$/.test(word)) {
      indices.push(i);
    }
  }
  return indices;
}

/**
 * Adjust word timings to account for inserted pauses after sentences.
 * Each word after a sentence ending gets shifted by the cumulative pause duration.
 */
function adjustWordTimingsForPauses(
  wordTimings: WordTiming[],
  sentenceEndIndices: number[],
  pauseMs: number
): WordTiming[] {
  if (sentenceEndIndices.length === 0) return wordTimings;
  
  const adjusted: WordTiming[] = [];
  let cumulativePause = 0;
  let nextPauseIndex = 0;
  
  for (let i = 0; i < wordTimings.length; i++) {
    const word = wordTimings[i];
    
    // Add cumulative pause offset to timing
    adjusted.push({
      word: word.word,
      startMs: word.startMs + cumulativePause,
      endMs: word.endMs + cumulativePause,
    });
    
    // If this word is a sentence ending (but not the last word), add pause for subsequent words
    if (nextPauseIndex < sentenceEndIndices.length && 
        i === sentenceEndIndices[nextPauseIndex] && 
        i < wordTimings.length - 1) {
      cumulativePause += pauseMs;
      nextPauseIndex++;
    }
  }
  
  return adjusted;
}

/**
 * Insert silence into audio at specified positions using ffmpeg.
 * Creates a new audio file with silence inserted after each sentence.
 */
async function insertSilenceIntoAudio(
  audioBuffer: Buffer,
  wordTimings: WordTiming[],
  sentenceEndIndices: number[],
  pauseSeconds: number
): Promise<Buffer> {
  if (sentenceEndIndices.length === 0 || sentenceEndIndices.every(i => i >= wordTimings.length - 1)) {
    return audioBuffer; // No pauses needed
  }

  const inputPath = join(tmpdir(), `input-${randomUUID()}.mp3`);
  const outputPath = join(tmpdir(), `output-${randomUUID()}.mp3`);
  const silencePath = join(tmpdir(), `silence-${randomUUID()}.mp3`);
  const concatListPath = join(tmpdir(), `concat-${randomUUID()}.txt`);

  try {
    // Write input audio to temp file
    await writeFile(inputPath, audioBuffer);
    
    // Generate a silence file
    await new Promise<void>((resolve, reject) => {
      const ffmpeg = spawn("ffmpeg", [
        "-f", "lavfi",
        "-i", `anullsrc=r=44100:cl=mono`,
        "-t", pauseSeconds.toString(),
        "-q:a", "9",
        "-acodec", "libmp3lame",
        "-y",
        silencePath,
      ]);
      ffmpeg.stderr.on("data", () => {});
      ffmpeg.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`ffmpeg silence generation exited with code ${code}`));
      });
      ffmpeg.on("error", reject);
    });

    // Get positions where we need to split (in seconds) - at the end of each sentence word
    // Only include sentence endings that aren't the last word
    const splitPositions: number[] = [];
    for (const idx of sentenceEndIndices) {
      if (idx < wordTimings.length - 1) {
        splitPositions.push(wordTimings[idx].endMs / 1000);
      }
    }
    
    if (splitPositions.length === 0) {
      return audioBuffer; // No splits needed
    }

    // Create segments and interleave with silence
    const segments: string[] = [];
    let lastPos = 0;
    
    for (let i = 0; i < splitPositions.length; i++) {
      const segmentPath = join(tmpdir(), `segment-${randomUUID()}-${i}.mp3`);
      const startTime = lastPos;
      const endTime = splitPositions[i];
      
      // Extract segment
      await new Promise<void>((resolve, reject) => {
        const ffmpeg = spawn("ffmpeg", [
          "-i", inputPath,
          "-ss", startTime.toString(),
          "-to", endTime.toString(),
          "-c", "copy",
          "-y",
          segmentPath,
        ]);
        ffmpeg.stderr.on("data", () => {});
        ffmpeg.on("close", (code) => {
          if (code === 0) resolve();
          else reject(new Error(`ffmpeg segment extraction exited with code ${code}`));
        });
        ffmpeg.on("error", reject);
      });
      
      segments.push(segmentPath);
      lastPos = endTime;
    }
    
    // Extract final segment (from last split to end)
    const finalSegmentPath = join(tmpdir(), `segment-${randomUUID()}-final.mp3`);
    await new Promise<void>((resolve, reject) => {
      const ffmpeg = spawn("ffmpeg", [
        "-i", inputPath,
        "-ss", lastPos.toString(),
        "-c", "copy",
        "-y",
        finalSegmentPath,
      ]);
      ffmpeg.stderr.on("data", () => {});
      ffmpeg.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`ffmpeg final segment extraction exited with code ${code}`));
      });
      ffmpeg.on("error", reject);
    });
    segments.push(finalSegmentPath);

    // Create concat list file - interleave segments with silence
    let concatContent = "";
    for (let i = 0; i < segments.length; i++) {
      concatContent += `file '${segments[i]}'\n`;
      // Add silence after each segment except the last
      if (i < segments.length - 1) {
        concatContent += `file '${silencePath}'\n`;
      }
    }
    await writeFile(concatListPath, concatContent);

    // Concatenate all segments with silence
    await new Promise<void>((resolve, reject) => {
      const ffmpeg = spawn("ffmpeg", [
        "-f", "concat",
        "-safe", "0",
        "-i", concatListPath,
        "-c", "copy",
        "-y",
        outputPath,
      ]);
      ffmpeg.stderr.on("data", () => {});
      ffmpeg.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`ffmpeg concat exited with code ${code}`));
      });
      ffmpeg.on("error", reject);
    });

    // Read the output
    const result = await readFile(outputPath);
    
    // Clean up temp files
    const filesToClean = [inputPath, outputPath, silencePath, concatListPath, ...segments];
    await Promise.all(filesToClean.map(f => unlink(f).catch(() => {})));
    
    return result;
  } catch (error) {
    console.error("Error inserting silence into audio:", error);
    // Clean up on error
    await Promise.all([
      unlink(inputPath).catch(() => {}),
      unlink(outputPath).catch(() => {}),
      unlink(silencePath).catch(() => {}),
      unlink(concatListPath).catch(() => {}),
    ]);
    // Return original audio if processing fails
    return audioBuffer;
  }
}

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
  const rawAudioBuffer = Buffer.from(audioBase64, 'base64');
  
  // Parse character-level timing into word-level timing
  let wordTimings = parseCharacterTimingsToWords(result.alignment);
  
  // Find sentence endings and insert pauses into both audio and timing data
  const sentenceEndIndices = findSentenceEndIndices(wordTimings);
  console.log(`Found ${sentenceEndIndices.length} sentence endings in ${wordTimings.length} words`);
  
  // Post-process: insert silence between sentences and adjust timings
  let finalAudioBuffer: Buffer = rawAudioBuffer;
  if (sentenceEndIndices.length > 0 && SENTENCE_PAUSE_SECONDS > 0) {
    // Insert silence into audio
    finalAudioBuffer = await insertSilenceIntoAudio(
      rawAudioBuffer,
      wordTimings,
      sentenceEndIndices,
      SENTENCE_PAUSE_SECONDS
    );
    
    // Adjust word timings to account for inserted pauses
    wordTimings = adjustWordTimingsForPauses(
      wordTimings,
      sentenceEndIndices,
      SENTENCE_PAUSE_SECONDS * 1000 // Convert to ms
    );
    
    console.log(`Inserted ${sentenceEndIndices.length} pauses of ${SENTENCE_PAUSE_SECONDS}s each`);
  }
  
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

  // Convert Buffer to ArrayBuffer properly
  const audioArrayBuffer = new Uint8Array(finalAudioBuffer).buffer as ArrayBuffer;

  return {
    audio: audioArrayBuffer,
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

/**
 * Generate sound effects using ElevenLabs Sound Effects API.
 * Creates high-quality ambient sounds from text descriptions.
 * @param text - Description of the sound to generate (e.g., "soft rain falling on leaves")
 * @param durationSeconds - Duration of the sound (0.5 to 22 seconds)
 * @param promptInfluence - How strictly to follow the prompt (0.0 to 1.0, default 0.3)
 * @returns Audio buffer in MP3 format
 */
export async function generateSoundEffect(
  text: string,
  durationSeconds: number = 22,
  promptInfluence: number = 0.3
): Promise<ArrayBuffer> {
  const apiKey = await getCredentials();

  console.log(`Generating sound effect: "${text}" (${durationSeconds}s)`);

  const response = await fetch("https://api.elevenlabs.io/v1/sound-generation", {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text,
      duration_seconds: durationSeconds,
      prompt_influence: promptInfluence,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("Sound generation error:", error);
    throw new Error(`Sound generation failed: ${response.statusText}`);
  }

  const audioBuffer = await response.arrayBuffer();
  console.log(`Sound effect generated: ${audioBuffer.byteLength} bytes`);
  return audioBuffer;
}
