import { spawn } from "child_process";
import { writeFile, unlink, readFile } from "fs/promises";
import { randomUUID } from "crypto";
import { tmpdir } from "os";
import { join } from "path";

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

function findSentenceEndIndices(words: WordTiming[]): number[] {
  const indices: number[] = [];
  for (let i = 0; i < words.length; i++) {
    const word = words[i].word;
    if (/[.!?]["']?$/.test(word)) {
      indices.push(i);
    }
  }
  return indices;
}

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

    adjusted.push({
      word: word.word,
      startMs: word.startMs + cumulativePause,
      endMs: word.endMs + cumulativePause,
    });

    if (
      nextPauseIndex < sentenceEndIndices.length &&
      i === sentenceEndIndices[nextPauseIndex] &&
      i < wordTimings.length - 1
    ) {
      cumulativePause += pauseMs;
      nextPauseIndex++;
    }
  }

  return adjusted;
}

async function insertSilenceIntoAudio(
  audioBuffer: Buffer,
  wordTimings: WordTiming[],
  sentenceEndIndices: number[],
  pauseSeconds: number
): Promise<Buffer> {
  if (sentenceEndIndices.length === 0 || sentenceEndIndices.every(i => i >= wordTimings.length - 1)) {
    return audioBuffer;
  }

  const inputPath = join(tmpdir(), `input-${randomUUID()}.mp3`);
  const outputPath = join(tmpdir(), `output-${randomUUID()}.mp3`);
  const silencePath = join(tmpdir(), `silence-${randomUUID()}.mp3`);
  const concatListPath = join(tmpdir(), `concat-${randomUUID()}.txt`);

  try {
    await writeFile(inputPath, audioBuffer);

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

    const splitPositions: number[] = [];
    for (const idx of sentenceEndIndices) {
      if (idx < wordTimings.length - 1) {
        splitPositions.push(wordTimings[idx].endMs / 1000);
      }
    }

    if (splitPositions.length === 0) {
      return audioBuffer;
    }

    const segments: string[] = [];
    let lastPos = 0;

    for (let i = 0; i < splitPositions.length; i++) {
      const segmentPath = join(tmpdir(), `segment-${randomUUID()}-${i}.mp3`);
      const startTime = lastPos;
      const endTime = splitPositions[i];

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

    let concatContent = "";
    for (let i = 0; i < segments.length; i++) {
      concatContent += `file '${segments[i]}'\n`;
      if (i < segments.length - 1) {
        concatContent += `file '${silencePath}'\n`;
      }
    }
    await writeFile(concatListPath, concatContent);

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

    const result = await readFile(outputPath);

    const filesToClean = [inputPath, outputPath, silencePath, concatListPath, ...segments];
    await Promise.all(filesToClean.map(f => unlink(f).catch(() => {})));

    return result;
  } catch (error) {
    console.error("Error inserting silence into audio:", error);
    await Promise.all([
      unlink(inputPath).catch(() => {}),
      unlink(outputPath).catch(() => {}),
      unlink(silencePath).catch(() => {}),
      unlink(concatListPath).catch(() => {}),
    ]);
    return audioBuffer;
  }
}

export async function humeTextToSpeech(
  text: string,
  voiceName: string = "Kora"
): Promise<{ audio: ArrayBuffer; duration: number; wordTimings: WordTiming[] }> {
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
      include_timestamp_types: ["word"],
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

  const rawAudioBuffer = Buffer.from(generation.audio, "base64");

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

  const sentenceEndIndices = findSentenceEndIndices(wordTimings);
  console.log(`Hume TTS: Found ${sentenceEndIndices.length} sentence endings in ${wordTimings.length} words`);

  let finalAudioBuffer: Buffer = rawAudioBuffer;
  if (sentenceEndIndices.length > 0 && SENTENCE_PAUSE_SECONDS > 0) {
    finalAudioBuffer = await insertSilenceIntoAudio(
      rawAudioBuffer,
      wordTimings,
      sentenceEndIndices,
      SENTENCE_PAUSE_SECONDS
    );

    wordTimings = adjustWordTimingsForPauses(
      wordTimings,
      sentenceEndIndices,
      SENTENCE_PAUSE_SECONDS * 1000
    );

    console.log(`Hume TTS: Inserted ${sentenceEndIndices.length} pauses of ${SENTENCE_PAUSE_SECONDS}s each`);
  }

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

  const audioArrayBuffer = new Uint8Array(finalAudioBuffer).buffer as ArrayBuffer;

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
