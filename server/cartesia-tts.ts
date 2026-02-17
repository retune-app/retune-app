import { CartesiaClient } from "@cartesia/cartesia-js";
import fs from "fs";
import path from "path";
import { Readable } from "stream";
import type { WordTiming } from "./replit_integrations/elevenlabs/client";

const CARTESIA_MODEL = "sonic-3-2026-01-12";

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
        enhance: true,
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

export async function cartesiaTTS(
  text: string,
  voiceId: string,
  voiceSettingsOverride?: { stability?: number; style?: number; pauseSeconds?: number }
): Promise<{ audio: ArrayBuffer; duration: number; wordTimings: WordTiming[] }> {
  const client = getClient();
  const startTime = Date.now();

  const response = await client.tts.bytes({
    modelId: CARTESIA_MODEL,
    transcript: text,
    voice: {
      mode: "id",
      id: voiceId,
      experimentalControls: {
        speed: "normal",
        emotion: ["positivity:highest", "curiosity:high"],
      },
    },
    language: "en",
    outputFormat: {
      container: "wav",
      encoding: "pcm_s16le",
      sampleRate: 24000,
    },
  });

  const audioBuffer = await streamToBuffer(response);

  const sampleRate = 24000;
  const bytesPerSample = 2;
  const channels = 1;
  const headerSize = 44;
  const dataSize = Math.max(0, audioBuffer.length - headerSize);
  const durationSeconds = dataSize / (sampleRate * bytesPerSample * channels);
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
  voiceId: string
): Promise<ArrayBuffer> {
  const client = getClient();
  const startTime = Date.now();

  const response = await client.tts.bytes({
    modelId: CARTESIA_MODEL,
    transcript: text,
    voice: {
      mode: "id",
      id: voiceId,
      experimentalControls: {
        speed: "normal",
        emotion: ["positivity:highest", "curiosity:high"],
      },
    },
    language: "en",
    outputFormat: {
      container: "wav",
      encoding: "pcm_s16le",
      sampleRate: 24000,
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
