import { CartesiaClient } from "@cartesia/cartesia-js";
import fs from "fs";
import path from "path";
import { Readable } from "stream";
import type { WordTiming } from "./replit_integrations/elevenlabs/client";

export interface CartesiaEmotionConfig {
  emotion: string;
  speed: number;
}

const CARTESIA_MODEL = "sonic-3-latest";

let cartesiaClient: CartesiaClient | null = null;
let cachedApiKey: string | null = null;

function getClient(): CartesiaClient {
  const apiKey = process.env.CARTESIA_API_KEY;
  if (!apiKey) {
    throw new Error("CARTESIA_API_KEY environment variable is not set");
  }
  if (!cartesiaClient || cachedApiKey !== apiKey) {
    cartesiaClient = new CartesiaClient({ apiKey });
    cachedApiKey = apiKey;
  }
  return cartesiaClient;
}

async function streamToBuffer(stream: any): Promise<Buffer> {
  if (Buffer.isBuffer(stream)) return stream;
  if (stream instanceof ArrayBuffer) return Buffer.from(stream);
  if (stream instanceof Uint8Array) return Buffer.from(stream);

  if (stream && typeof stream[Symbol.asyncIterator] === "function") {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  if (stream && typeof stream.pipe === "function") {
    return new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      stream.on("data", (chunk: any) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      stream.on("end", () => resolve(Buffer.concat(chunks)));
      stream.on("error", reject);
    });
  }

  return Buffer.from(stream as any);
}

export async function cartesiaCloneVoice(
  audioFilePath: string,
  name: string = "Inner Voice"
): Promise<string> {
  const client = getClient();
  const startTime = Date.now();

  const fileBuffer = fs.readFileSync(audioFilePath);
  const ext = path.extname(audioFilePath).toLowerCase();
  const mimeType = ext === '.m4a' ? 'audio/mp4' : ext === '.wav' ? 'audio/wav' : ext === '.mp3' ? 'audio/mpeg' : 'audio/mp4';

  console.log(`[Cartesia] Cloning voice from ${ext} file (${fileBuffer.length} bytes, mime: ${mimeType})`);

  const blob = new Blob([fileBuffer], { type: mimeType }) as any;

  try {
    const clonedVoice = await client.voices.clone(
      blob,
      {
        name,
        language: "en",
        mode: "similarity",
        enhance: false,
        description: "User voice for personalized affirmations",
      }
    );

    const duration = Date.now() - startTime;
    console.log(`[Cartesia] Voice cloned in ${duration}ms: ${clonedVoice.id}`);

    return clonedVoice.id;
  } catch (error: any) {
    const statusCode = error?.statusCode || 500;
    const rawBody = error?.body?.error?.rawBody || error?.message || "Unknown error";
    console.error(`[Cartesia] Clone failed (${statusCode}): ${rawBody}`);
    const err: any = new Error(rawBody);
    err.statusCode = statusCode;
    err.cartesiaDetail = rawBody;
    throw err;
  }
}

export function getCartesiaEmotionConfig(moodConfig?: { elevenLabsStability?: number; elevenLabsStyle?: number; humeSpeed?: number }): CartesiaEmotionConfig {
  if (!moodConfig) {
    return { emotion: "positivity:high", speed: 1.0 };
  }
  
  const stability = moodConfig.elevenLabsStability ?? 0.5;
  const style = moodConfig.elevenLabsStyle ?? 0.3;
  
  const expressiveness = style + (1 - stability) * 0.5;
  
  const emotions: string[] = [];
  
  if (expressiveness >= 0.7) {
    emotions.push("positivity:highest");
    if (style >= 0.4) emotions.push("curiosity:high");
  } else if (expressiveness >= 0.5) {
    emotions.push("positivity:high");
    if (style >= 0.3) emotions.push("curiosity:medium");
  } else if (expressiveness >= 0.35) {
    emotions.push("positivity:medium");
    emotions.push("curiosity:low");
  } else {
    emotions.push("positivity:low");
  }
  
  const emotion = emotions.join(" ");
  
  const humeSpeed = moodConfig.humeSpeed ?? 0.92;
  const speed = humeSpeed;
  
  return { emotion, speed: Math.round(speed * 100) / 100 };
}

export async function cartesiaTTS(
  text: string,
  voiceId: string,
  emotionConfig?: CartesiaEmotionConfig
): Promise<{ audio: ArrayBuffer; duration: number; wordTimings: WordTiming[] }> {
  const client = getClient();
  const startTime = Date.now();

  const response = await client.tts.bytes({
    modelId: CARTESIA_MODEL,
    transcript: text,
    voice: {
      mode: "id",
      id: voiceId,
    },
    language: "en",
    outputFormat: {
      container: "mp3",
      sampleRate: 44100,
      bitRate: 192000,
    },
    generationConfig: {
      speed: emotionConfig?.speed ?? 1.0,
      emotion: emotionConfig?.emotion ?? "positivity:high",
    },
  });

  const audioBuffer = await streamToBuffer(response);

  const bitRate = 192000;
  const durationSeconds = (audioBuffer.length * 8) / bitRate;
  const estimatedDuration = Math.max(1, Math.ceil(durationSeconds));

  const wordTimings = estimateWordTimings(text, durationSeconds * 1000);

  const elapsed = Date.now() - startTime;
  console.log(`[Cartesia] TTS generated in ${elapsed}ms: ${text.length} chars, ${estimatedDuration}s audio`);

  const audioArrayBuffer = new Uint8Array(audioBuffer).buffer as ArrayBuffer;

  return {
    audio: audioArrayBuffer,
    duration: estimatedDuration,
    wordTimings,
  };
}

export async function cartesiaSimpleTTS(
  text: string,
  voiceId: string,
  emotionConfig?: CartesiaEmotionConfig
): Promise<ArrayBuffer> {
  const client = getClient();
  const startTime = Date.now();

  const response = await client.tts.bytes({
    modelId: CARTESIA_MODEL,
    transcript: text,
    voice: {
      mode: "id",
      id: voiceId,
    },
    language: "en",
    outputFormat: {
      container: "mp3",
      sampleRate: 44100,
      bitRate: 192000,
    },
    generationConfig: {
      speed: emotionConfig?.speed ?? 1.0,
      emotion: emotionConfig?.emotion ?? "positivity:high",
    },
  });

  const audioBuffer = await streamToBuffer(response);
  const elapsed = Date.now() - startTime;
  console.log(`[Cartesia] Simple TTS generated in ${elapsed}ms`);

  return new Uint8Array(audioBuffer).buffer as ArrayBuffer;
}

function estimateWordTimings(text: string, totalDurationMs: number): WordTiming[] {
  const words = text.split(/\s+/).filter(w => w.length > 0);
  if (words.length === 0) return [];

  const totalChars = words.reduce((sum, w) => sum + w.length, 0);
  if (totalChars === 0) return [];

  const timings: WordTiming[] = [];
  let currentMs = 0;

  for (const word of words) {
    const wordDuration = (word.length / totalChars) * totalDurationMs;
    timings.push({
      word,
      startMs: Math.round(currentMs),
      endMs: Math.round(currentMs + wordDuration),
    });
    currentMs += wordDuration;
  }

  return timings;
}

export async function cartesiaDeleteVoice(voiceId: string): Promise<void> {
  const client = getClient();
  await client.voices.delete(voiceId);
  console.log(`[Cartesia] Voice deleted: ${voiceId}`);
}

export async function cartesiaListVoices(): Promise<any[]> {
  const client = getClient();
  const result = await client.voices.list() as any;
  if (Array.isArray(result)) return result;
  const voices: any[] = [];
  if (result && typeof result[Symbol.asyncIterator] === "function") {
    for await (const voice of result) {
      voices.push(voice);
    }
  }
  return voices;
}

export function isCartesiaConfigured(): boolean {
  return !!process.env.CARTESIA_API_KEY;
}
