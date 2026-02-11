
const SENTENCE_PAUSE_SECONDS = 1.5;

export interface WordTiming {
  word: string;
  startMs: number;
  endMs: number;
}

export const HUME_VOICE_OPTIONS = {
  female: [
    { id: "SERAPHINA", name: "Seraphina", humeName: "Serene Assistant", description: "Tranquil, radiant calm" },
    { id: "LOTUS", name: "Lotus", humeName: "Female Meditation Guide", description: "Peaceful, guiding presence" },
    { id: "AMBER", name: "Amber", humeName: "Warm American Female", description: "Warm, grounding energy" },
    { id: "NOVA", name: "Nova", humeName: "Warm Female Assistant Voice", description: "Gentle, luminous clarity" },
    { id: "WILLOW", name: "Willow", humeName: "Demure Conversationalist", description: "Soft, graceful wisdom" },
  ],
  male: [
    { id: "ORION", name: "Orion", humeName: "Inspiring Man", description: "Bold, uplifting strength" },
    { id: "ATLAS", name: "Atlas", humeName: "Deep Male Conversational Voice", description: "Deep, grounded resonance" },
    { id: "SAGE", name: "Sage", humeName: "Soft Male Conversationalist", description: "Calm, centering stillness" },
    { id: "SUMMIT", name: "Summit", humeName: "Nature Documentary Narrator", description: "Steady, expansive clarity" },
    { id: "BODHI", name: "Bodhi", humeName: "Wise Wizard", description: "Ancient, soulful wisdom" },
  ],
};

function sanitizeWordTimings(wordTimings: WordTiming[]): WordTiming[] {
  if (wordTimings.length === 0) return wordTimings;

  const sanitized: WordTiming[] = [];
  let lastEndMs = 0;

  for (let i = 0; i < wordTimings.length; i++) {
    let { word, startMs, endMs } = wordTimings[i];

    if (startMs < lastEndMs) {
      startMs = lastEndMs;
    }

    if (endMs <= startMs) {
      const nextStart = i + 1 < wordTimings.length ? wordTimings[i + 1].startMs : startMs + 200;
      endMs = Math.max(startMs + 50, Math.min(startMs + 200, nextStart));
    }

    sanitized.push({ word, startMs, endMs });
    lastEndMs = endMs;
  }

  return sanitized;
}

function splitIntoSentences(text: string): string[] {
  const parts = text.match(/[^.!?]+[.!?]["']?\s*/g);
  if (!parts || parts.length === 0) return [text];
  return parts.map(s => s.trim()).filter(s => s.length > 0);
}

function fixPerUtteranceTimestamps(
  rawTimings: WordTiming[],
  trailingSilenceMs: number
): WordTiming[] {
  if (rawTimings.length <= 1) return rawTimings;

  const result: WordTiming[] = [];
  let cumulativeOffset = 0;

  for (let i = 0; i < rawTimings.length; i++) {
    if (i > 0 && rawTimings[i].startMs < rawTimings[i - 1].endMs - 100) {
      const prevAdjustedEnd = rawTimings[i - 1].endMs + cumulativeOffset;
      cumulativeOffset = prevAdjustedEnd + trailingSilenceMs;
    }

    result.push({
      word: rawTimings[i].word,
      startMs: rawTimings[i].startMs + cumulativeOffset,
      endMs: rawTimings[i].endMs + cumulativeOffset,
    });
  }

  return result;
}

export async function humeTextToSpeech(
  text: string,
  voiceName: string = "Kora",
  speed?: number,
  pauseSeconds?: number
): Promise<{ audio: ArrayBuffer; duration: number; wordTimings: WordTiming[] }> {
  const apiKey = process.env.HUME_API_KEY;
  if (!apiKey) {
    throw new Error("HUME_API_KEY environment variable is not set");
  }

  const effectivePause = pauseSeconds ?? SENTENCE_PAUSE_SECONDS;
  const sentences = splitIntoSentences(text);
  const utterances = sentences.map((sentence, i) => ({
    text: sentence,
    voice: { name: voiceName, provider: "HUME_AI" },
    trailing_silence: i < sentences.length - 1 ? effectivePause : 0.35,
    ...(speed !== undefined && { speed }),
  }));

  console.log(`Hume TTS: Sending ${utterances.length} utterances with ${effectivePause}s trailing silence${speed !== undefined ? `, speed: ${speed}` : ''}`);

  const response = await fetch("https://api.hume.ai/v0/tts", {
    method: "POST",
    headers: {
      "X-Hume-Api-Key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      version: "2",
      utterances,
      include_timestamp_types: ["word"],
      split_utterances: false,
      strip_headers: true,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Hume TTS error:", response.status, errorText);
    throw new Error(`Hume TTS failed (${response.status}): ${errorText}`);
  }

  const result = await response.json();

  const generation = result.generations?.[0];
  if (!generation || !generation.audio) {
    throw new Error("Hume TTS returned no audio data");
  }

  const audioBuffer = Buffer.from(generation.audio, "base64");

  let wordTimings: WordTiming[] = [];
  const snippets = generation.snippets;
  if (snippets && Array.isArray(snippets)) {
    for (const snippetGroup of snippets) {
      const snippetList = Array.isArray(snippetGroup) ? snippetGroup : [snippetGroup];
      for (const snippet of snippetList) {
        if (snippet.timestamps && Array.isArray(snippet.timestamps)) {
          for (const ts of snippet.timestamps) {
            if (ts.type === "word" && ts.text && ts.time) {
              wordTimings.push({
                word: ts.text,
                startMs: Math.round(ts.time.begin),
                endMs: Math.round(ts.time.end),
              });
            }
          }
        }
      }
    }
  }

  wordTimings = fixPerUtteranceTimestamps(wordTimings, effectivePause * 1000);
  wordTimings = sanitizeWordTimings(wordTimings);

  console.log(`Hume TTS: Got ${wordTimings.length} word timings from ${utterances.length} utterances, last timing endMs: ${wordTimings.length > 0 ? wordTimings[wordTimings.length - 1].endMs : 0}ms`);

  let estimatedDuration: number;
  if (
    wordTimings.length > 0 &&
    typeof wordTimings[wordTimings.length - 1].endMs === "number" &&
    !isNaN(wordTimings[wordTimings.length - 1].endMs)
  ) {
    estimatedDuration = Math.ceil(wordTimings[wordTimings.length - 1].endMs / 1000);
  } else {
    const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;
    estimatedDuration = Math.max(1, Math.ceil((wordCount / 150) * 60));
  }

  if (isNaN(estimatedDuration) || estimatedDuration <= 0) {
    const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;
    estimatedDuration = Math.max(1, Math.ceil((wordCount / 150) * 60));
  }

  const audioArrayBuffer = new Uint8Array(audioBuffer).buffer as ArrayBuffer;

  return {
    audio: audioArrayBuffer,
    duration: estimatedDuration,
    wordTimings,
  };
}

export async function humeSimpleTTS(
  text: string,
  voiceName: string = "Kora"
): Promise<ArrayBuffer> {
  const apiKey = process.env.HUME_API_KEY;
  if (!apiKey) {
    throw new Error("HUME_API_KEY environment variable is not set");
  }

  const response = await fetch("https://api.hume.ai/v0/tts", {
    method: "POST",
    headers: {
      "X-Hume-Api-Key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      version: "2",
      utterances: [
        {
          text,
          voice: { name: voiceName, provider: "HUME_AI" },
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Hume simple TTS error:", response.status, errorText);
    throw new Error(`Hume TTS failed (${response.status}): ${errorText}`);
  }

  const result = await response.json();

  const generation = result.generations?.[0];
  if (!generation || !generation.audio) {
    throw new Error("Hume TTS returned no audio data");
  }

  const audioBuffer = Buffer.from(generation.audio, "base64");
  return new Uint8Array(audioBuffer).buffer as ArrayBuffer;
}

export function listHumeVoices() {
  return HUME_VOICE_OPTIONS;
}
