import type { Express, Request, Response } from "express";
import multer from "multer";
import { writeFile, unlink } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";
import { cloneVoice, textToSpeech as elevenLabsTTS, deleteVoice } from "../replit_integrations/elevenlabs/client";
import { logInfo, logError } from "../logger";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

interface ProviderResult {
  provider: string;
  audioBase64: string | null;
  durationMs: number;
  error: string | null;
}

async function generateWithElevenLabs(voiceBuffer: Buffer, text: string): Promise<ProviderResult> {
  const tempPath = join(tmpdir(), `ab-test-${randomUUID()}.mp3`);
  let voiceId: string | null = null;
  try {
    await writeFile(tempPath, voiceBuffer);
    voiceId = await cloneVoice(tempPath, `AB-Test-${randomUUID().slice(0, 8)}`);
    const result = await elevenLabsTTS(text, voiceId);
    const audioBuffer = Buffer.from(result.audio);
    return {
      provider: "elevenlabs",
      audioBase64: audioBuffer.toString("base64"),
      durationMs: result.duration * 1000,
      error: null,
    };
  } finally {
    await unlink(tempPath).catch(() => {});
    if (voiceId) {
      await deleteVoice(voiceId).catch(() => {});
    }
  }
}

async function generateWithChatterbox(voiceBuffer: Buffer, text: string): Promise<ProviderResult> {
  const { Client, handle_file } = await import("@gradio/client");
  const client = await Client.connect("ResembleAI/Chatterbox");
  const audioBlob = new Blob([new Uint8Array(voiceBuffer)], { type: "audio/wav" });

  const result = await client.predict(1, [
    text,
    handle_file(audioBlob),
    0.5,
    0.8,
    0,
    0.5,
    0.05,
    1.0,
    1.2,
  ]);

  const audioData = (result as any).data[0];
  let base64: string;

  if (typeof audioData === "string" && audioData.startsWith("http")) {
    const response = await fetch(audioData);
    const arrayBuffer = await response.arrayBuffer();
    base64 = Buffer.from(arrayBuffer).toString("base64");
  } else if (audioData instanceof Blob) {
    const arrayBuffer = await audioData.arrayBuffer();
    base64 = Buffer.from(arrayBuffer).toString("base64");
  } else if (Buffer.isBuffer(audioData)) {
    base64 = audioData.toString("base64");
  } else if (audioData?.url && typeof audioData.url === "string") {
    const response = await fetch(audioData.url);
    const arrayBuffer = await response.arrayBuffer();
    base64 = Buffer.from(arrayBuffer).toString("base64");
  } else {
    throw new Error("Unexpected audio data format from Chatterbox");
  }

  return {
    provider: "chatterbox",
    audioBase64: base64,
    durationMs: 0,
    error: null,
  };
}

export function registerDevRoutes(app: Express, requireAuth: any) {
  app.post("/api/dev/ab-test", requireAuth, upload.single("voiceClip"), async (req: any, res: Response) => {
    req.setTimeout(300000);
    res.setTimeout(300000);
    try {
      const text = req.body?.text;
      const voiceFile = req.file;

      logInfo("ab-test", "Request received", { textLength: text?.length || 0, fileSize: voiceFile?.size || 0 });

      if (!text || !voiceFile) {
        return res.status(400).json({ error: "Both 'text' and 'voiceClip' are required" });
      }

      const voiceBuffer = voiceFile.buffer as Buffer;

      const timedCall = async (
        fn: () => Promise<ProviderResult>,
        provider: string
      ): Promise<{ result: ProviderResult; timeMs: number }> => {
        const start = Date.now();
        try {
          const result = await fn();
          return { result, timeMs: Date.now() - start };
        } catch (err: any) {
          return {
            result: { provider, audioBase64: null, durationMs: 0, error: err.message || String(err) },
            timeMs: Date.now() - start,
          };
        }
      };

      logInfo("ab-test", "Starting both providers in parallel");

      const [elevenLabs, chatterbox] = await Promise.all([
        timedCall(() => generateWithElevenLabs(voiceBuffer, text), "elevenlabs"),
        timedCall(() => generateWithChatterbox(voiceBuffer, text), "chatterbox"),
      ]);

      logInfo("ab-test", "Complete", { elevenLabsMs: elevenLabs.timeMs, elevenLabsStatus: elevenLabs.result.error ? "FAILED" : "OK", chatterboxMs: chatterbox.timeMs, chatterboxStatus: chatterbox.result.error ? "FAILED" : "OK" });

      res.json({
        results: [elevenLabs.result, chatterbox.result],
        generationTimeMs: {
          elevenlabs: elevenLabs.timeMs,
          chatterbox: chatterbox.timeMs,
        },
      });
    } catch (error: any) {
      logError("ab-test", "AB test failed", { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ error: "AB test failed", details: error.message });
    }
  });
}
