// ElevenLabs integration for voice cloning and TTS
// Uses Replit's ElevenLabs connector

import { ElevenLabsClient } from "elevenlabs";
import WebSocket from "ws";
import FormData from "form-data";
import fs from "fs";

let connectionSettings: any;

async function getCredentials() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
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

  const formData = new FormData();
  formData.append("name", name);
  formData.append("files", fs.createReadStream(audioFilePath));
  formData.append(
    "description",
    "User voice for personalized affirmations"
  );

  const response = await fetch("https://api.elevenlabs.io/v1/voices/add", {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      ...formData.getHeaders(),
    },
    body: formData as any,
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("Voice cloning error:", error);
    throw new Error(`Voice cloning failed: ${response.statusText}`);
  }

  const result = await response.json();
  return result.voice_id;
}

/**
 * Generate speech from text using ElevenLabs TTS.
 * @param text - The text to convert to speech
 * @param voiceId - ElevenLabs voice ID (optional, defaults to a preset voice)
 * @returns Audio buffer in mp3 format
 */
export async function textToSpeech(
  text: string,
  voiceId: string = "21m00Tcm4TlvDq8ikWAM" // Default Rachel voice
): Promise<{ audio: ArrayBuffer; duration: number }> {
  const apiKey = await getCredentials();

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
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

  const audioBuffer = await response.arrayBuffer();

  // Estimate duration (rough calculation based on text length)
  // Approximate speaking rate: 150 words per minute
  const wordCount = text.split(/\s+/).length;
  const estimatedDuration = Math.ceil((wordCount / 150) * 60);

  return {
    audio: audioBuffer,
    duration: estimatedDuration,
  };
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
