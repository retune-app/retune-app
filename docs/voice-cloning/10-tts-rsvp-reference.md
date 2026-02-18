# TTS & RSVP Configuration Reference

> **Last updated**: February 17, 2026 (v1.7.2)
> **Status**: These are the "default" baseline settings. Restore to these if any experimental changes need to be rolled back.

---

## Table of Contents

1. [Overview](#overview)
2. [Inner Voice (ElevenLabs) — Affirmations](#inner-voice-elevenlabs--affirmations)
3. [AI Voice (Hume) — Affirmations](#ai-voice-hume--affirmations)
4. [AI Voice (Hume) — Meditations](#ai-voice-hume--meditations)
5. [OpenAI Fallback — Affirmations](#openai-fallback--affirmations)
6. [Pillar Voice Config (AI Voice only)](#pillar-voice-config-ai-voice-only)
7. [Meditation Mood Config (Meditations only)](#meditation-mood-config-meditations-only)
8. [Affirmation Script Generation — Pillar Themes & Category Tones](#affirmation-script-generation--pillar-themes--category-tones)
9. [RSVP Display Configuration (Client)](#rsvp-display-configuration-client)
10. [Word Timing Pipeline — ElevenLabs](#word-timing-pipeline--elevenlabs)
11. [Word Timing Pipeline — Hume](#word-timing-pipeline--hume)
12. [Hume Voice Catalog](#hume-voice-catalog)
13. [Hume-to-OpenAI Fallback Map](#hume-to-openai-fallback-map)
14. [Key File Locations](#key-file-locations)

---

## Overview

Retuned uses a multi-provider TTS system:

| Context | Provider | Voice source | Word timings | Silence insertion |
|---|---|---|---|---|
| **Inner Voice** (affirmations) | ElevenLabs | User's cloned voice | `/with-timestamps` endpoint (character-level alignment) | ffmpeg post-processing (re-encoded segments) |
| **AI Voice** (affirmations) | Hume AI (primary), OpenAI (fallback) | Stock voices | Hume `include_timestamp_types: ["word"]` | Hume `trailing_silence` (native) |
| **Meditations** | Hume AI (primary), OpenAI (fallback) | Stock voices | Hume `include_timestamp_types: ["word"]` | Hume `trailing_silence` (native) |

---

## Inner Voice (ElevenLabs) — Affirmations

**File**: `server/replit_integrations/elevenlabs/client.ts` — `textToSpeech()`
**Called from**: `server/routes.ts` — `generateAudio()` when `isPersonalVoice === true`

### Fixed TTS Parameters (all pillars, all categories)

These settings are hardcoded for ALL Inner Voice affirmations, overriding any pillar-specific config:

```typescript
// server/routes.ts — generateAudio() — Inner Voice branch
const result = await elevenLabsTTS(script, voiceId, {
  stability: 0.6,
  style: 0.25,
  pauseSeconds: 1.8,
});
```

| Parameter | Value | Effect |
|---|---|---|
| `stability` | **0.6** | Gentle, consistent delivery — less variation between takes |
| `similarity_boost` | **0.75** | High fidelity to the cloned voice (hardcoded in `textToSpeech()`) |
| `style` | **0.25** | Subtle, natural expressiveness — not dramatic |
| `use_speaker_boost` | **true** | Enhanced voice clarity (hardcoded in `textToSpeech()`) |
| `pauseSeconds` | **1.8** | Spacious 1.8s silence inserted between sentences via ffmpeg |
| `model_id` | `eleven_multilingual_v2` | ElevenLabs multilingual model |

**Tone description**: Soft, contemplative, and spacious. Gentle and unhurried.

### ElevenLabs API Endpoint

```
POST https://api.elevenlabs.io/v1/text-to-speech/{voiceId}/with-timestamps
```

Request body:
```json
{
  "text": "<full affirmation script>",
  "model_id": "eleven_multilingual_v2",
  "voice_settings": {
    "stability": 0.6,
    "similarity_boost": 0.75,
    "style": 0.25,
    "use_speaker_boost": true
  }
}
```

### Default Sentence Pause

```typescript
// server/replit_integrations/elevenlabs/client.ts — line 15
const SENTENCE_PAUSE_SECONDS = 1.5; // Base default (overridden to 1.8 for Inner Voice)
```

The `SENTENCE_PAUSE_SECONDS` constant is the fallback if no `pauseSeconds` override is provided. For Inner Voice, we always pass `1.8` explicitly.

---

## AI Voice (Hume) — Affirmations

**File**: `server/hume-client.ts` — `humeTextToSpeech()`
**Called from**: `server/routes.ts` — `generateAudio()` when `isPersonalVoice === false`

### TTS Parameters

When generating affirmations with an AI Voice, the pillar's voice config is passed as `moodConfig`:

```typescript
// server/routes.ts — generateAudio() — AI Voice branch
const result = await humeTextToSpeech(
  script,
  humeName,                    // e.g. "Serene Assistant"
  moodConfig?.humeSpeed,       // from PILLAR_VOICE_CONFIG
  moodConfig?.pauseSeconds     // from PILLAR_VOICE_CONFIG
);
```

If no pillar config is found, Hume uses its defaults:
- Speed: (Hume default — not specified)
- Pause: `SENTENCE_PAUSE_SECONDS` = **1.5s**

### Hume API Call

```typescript
// server/hume-client.ts
POST https://api.hume.ai/v0/tts
{
  "version": "2",
  "utterances": [
    // One utterance per sentence, with trailing_silence between them
    {
      "text": "Sentence one.",
      "voice": { "name": "Serene Assistant", "provider": "HUME_AI" },
      "trailing_silence": 1.3,  // from pillar config pauseSeconds
      "speed": 0.92             // from pillar config humeSpeed
    },
    // ... more sentences ...
    {
      "text": "Last sentence.",
      "voice": { "name": "Serene Assistant", "provider": "HUME_AI" },
      "trailing_silence": 0.35, // last sentence always gets 0.35s
      "speed": 0.92
    }
  ],
  "include_timestamp_types": ["word"],
  "split_utterances": false,
  "strip_headers": true
}
```

Key differences from ElevenLabs:
- Hume handles silence insertion **natively** via `trailing_silence` (no ffmpeg needed)
- Word timings come back already aligned to the final audio
- Sentences are split client-side with `splitIntoSentences()` before sending to Hume

---

## AI Voice (Hume) — Meditations

**File**: `server/routes.ts` — meditation generation endpoints
**Config**: Uses `MEDITATION_MOOD_CONFIG` (mood-based, not pillar-based)

Meditations use the same Hume TTS pipeline as AI Voice affirmations, but the voice settings come from the **mood** (calm, stressed, anxious, etc.) rather than the pillar.

```typescript
// server/routes.ts — meditation audio generation
const result = await humeTextToSpeech(
  script,
  humeName,
  moodConfig?.humeSpeed,
  moodConfig?.pauseSeconds
);
```

See [Meditation Mood Config](#meditation-mood-config-meditations-only) for all mood mappings.

---

## OpenAI Fallback — Affirmations

**File**: `server/routes.ts` — `generateAudioOpenAI()`

Used when both ElevenLabs and Hume fail. OpenAI does NOT provide real word timings.

```typescript
// OpenAI TTS call
const response = await directOpenAI.audio.speech.create({
  model: "tts-1",
  voice: openaiVoice,  // mapped from Hume voice ID
  input: script,
});

// Word timings are ESTIMATED (evenly distributed)
const avgWordDurationMs = (estimatedDuration * 1000) / wordCount;
// 150 words per minute assumed
```

OpenAI fallback voice mapping: see [Hume-to-OpenAI Fallback Map](#hume-to-openai-fallback-map).

---

## Pillar Voice Config (AI Voice only)

**File**: `server/routes.ts` — `PILLAR_VOICE_CONFIG`

These settings apply to **AI Voice affirmations only**. Inner Voice ignores these and uses fixed settings (see above).

```typescript
const PILLAR_VOICE_CONFIG: Record<string, {
  scriptTone: string;
  humeSpeed: number;
  pauseSeconds: number;
  elevenLabsStability: number;
  elevenLabsStyle: number;
}> = {
  mind: {
    scriptTone: "Clear, steady, and measured. Quiet certainty. Deliver each statement like a calm, focused thought landing with precision.",
    humeSpeed: 0.92,
    pauseSeconds: 1.3,
    elevenLabsStability: 0.55,
    elevenLabsStyle: 0.3,
  },
  body: {
    scriptTone: "Warm, grounded, and physical. Connected to sensation. Speak as if you can feel each word in your body — rooted and present.",
    humeSpeed: 0.95,
    pauseSeconds: 1.1,
    elevenLabsStability: 0.5,
    elevenLabsStyle: 0.4,
  },
  spirit: {
    scriptTone: "Soft, contemplative, and spacious. Gentle and unhurried. Let each phrase breathe, as if the silence between words matters as much as the words themselves.",
    humeSpeed: 0.85,
    pauseSeconds: 1.8,
    elevenLabsStability: 0.6,
    elevenLabsStyle: 0.25,
  },
  connection: {
    scriptTone: "Warm, open, and heartfelt. Inviting and sincere. Speak as if addressing someone you deeply care about — natural, genuine, emotionally present.",
    humeSpeed: 0.93,
    pauseSeconds: 1.3,
    elevenLabsStability: 0.45,
    elevenLabsStyle: 0.45,
  },
  achievement: {
    scriptTone: "Confident, grounded, and forward-moving. Strong without being aggressive. Deliver like a coach who believes in you — direct, clear, empowering.",
    humeSpeed: 1.0,
    pauseSeconds: 0.9,
    elevenLabsStability: 0.4,
    elevenLabsStyle: 0.5,
  },
};
```

### Pillar Voice Config Summary Table

| Pillar | Hume Speed | Pause (s) | EL Stability | EL Style | Tone |
|---|---|---|---|---|---|
| **Mind** | 0.92 | 1.3 | 0.55 | 0.3 | Clear, steady, measured |
| **Body** | 0.95 | 1.1 | 0.5 | 0.4 | Warm, grounded, physical |
| **Spirit** | 0.85 | 1.8 | 0.6 | 0.25 | Soft, contemplative, spacious |
| **Connection** | 0.93 | 1.3 | 0.45 | 0.45 | Warm, open, heartfelt |
| **Achievement** | 1.0 | 0.9 | 0.4 | 0.5 | Confident, forward-moving |

> **Note**: The `elevenLabsStability` and `elevenLabsStyle` values in `PILLAR_VOICE_CONFIG` are currently unused for AI Voice (Hume handles it). They would only apply if ElevenLabs were used for stock voices. They are preserved for potential future use.

---

## Meditation Mood Config (Meditations only)

**File**: `server/routes.ts` — `MEDITATION_MOOD_CONFIG`

These settings control TTS delivery for **micro-meditations** based on the user's current mood.

```typescript
const MEDITATION_MOOD_CONFIG: Record<string, {
  scriptTone: string;
  humeSpeed: number;
  pauseSeconds: number;
  elevenLabsStability: number;
  elevenLabsStyle: number;
}> = {
  calm: {
    scriptTone: "serene, spacious, and deeply unhurried — like floating on still water...",
    humeSpeed: 0.85,
    pauseSeconds: 1.8,
    elevenLabsStability: 0.6,
    elevenLabsStyle: 0.25,
  },
  stressed: {
    scriptTone: "soothing, reassuring, and safe — like a warm blanket wrapping around tension...",
    humeSpeed: 0.9,
    pauseSeconds: 1.7,
    elevenLabsStability: 0.55,
    elevenLabsStyle: 0.3,
  },
  tired: {
    scriptTone: "gentle, nurturing, and restoring — like soft morning light...",
    humeSpeed: 0.85,
    pauseSeconds: 1.8,
    elevenLabsStability: 0.55,
    elevenLabsStyle: 0.25,
  },
  anxious: {
    scriptTone: "grounding, steady, and anchoring — like roots growing deep into earth...",
    humeSpeed: 0.9,
    pauseSeconds: 1.7,
    elevenLabsStability: 0.6,
    elevenLabsStyle: 0.2,
  },
  sad: {
    scriptTone: "warm, tender, and compassionate — like being gently held...",
    humeSpeed: 0.88,
    pauseSeconds: 1.8,
    elevenLabsStability: 0.55,
    elevenLabsStyle: 0.3,
  },
  overwhelmed: {
    scriptTone: "steady, simplifying, and reassuring — like a calm hand on your shoulder...",
    humeSpeed: 0.88,
    pauseSeconds: 1.7,
    elevenLabsStability: 0.6,
    elevenLabsStyle: 0.2,
  },
  energized: {
    scriptTone: "bright, uplifting, and invigorating — like fresh mountain air...",
    humeSpeed: 1.0,
    pauseSeconds: 1.3,
    elevenLabsStability: 0.45,
    elevenLabsStyle: 0.4,
  },
  grateful: {
    scriptTone: "warm, reverent, and heart-centered — like sunlight on your chest...",
    humeSpeed: 0.9,
    pauseSeconds: 1.6,
    elevenLabsStability: 0.55,
    elevenLabsStyle: 0.35,
  },
  confident: {
    scriptTone: "strong, grounded, and empowering — like standing tall with wind at your back...",
    humeSpeed: 0.95,
    pauseSeconds: 1.4,
    elevenLabsStability: 0.5,
    elevenLabsStyle: 0.4,
  },
  focused: {
    scriptTone: "clear, precise, and centering — like a laser beam of gentle attention...",
    humeSpeed: 0.92,
    pauseSeconds: 1.5,
    elevenLabsStability: 0.55,
    elevenLabsStyle: 0.3,
  },
  joyful: {
    scriptTone: "light, playful, and radiant — like bubbles of laughter...",
    humeSpeed: 0.95,
    pauseSeconds: 1.4,
    elevenLabsStability: 0.45,
    elevenLabsStyle: 0.45,
  },
};
```

### Meditation Mood Config Summary Table

| Mood | Hume Speed | Pause (s) | EL Stability | EL Style |
|---|---|---|---|---|
| **Calm** | 0.85 | 1.8 | 0.6 | 0.25 |
| **Stressed** | 0.9 | 1.7 | 0.55 | 0.3 |
| **Tired** | 0.85 | 1.8 | 0.55 | 0.25 |
| **Anxious** | 0.9 | 1.7 | 0.6 | 0.2 |
| **Sad** | 0.88 | 1.8 | 0.55 | 0.3 |
| **Overwhelmed** | 0.88 | 1.7 | 0.6 | 0.2 |
| **Energized** | 1.0 | 1.3 | 0.45 | 0.4 |
| **Grateful** | 0.9 | 1.6 | 0.55 | 0.35 |
| **Confident** | 0.95 | 1.4 | 0.5 | 0.4 |
| **Focused** | 0.92 | 1.5 | 0.55 | 0.3 |
| **Joyful** | 0.95 | 1.4 | 0.45 | 0.45 |

---

## Affirmation Script Generation — Pillar Themes & Category Tones

**File**: `server/routes.ts` — `generateScript()`

These control the **text content** of affirmations (not the voice delivery). They are passed to GPT-4o as tone/style instructions.

### Pillar Themes (what the script focuses on)

| Pillar | Theme |
|---|---|
| **Mind** | Mental clarity, cognitive strength, emotional intelligence, psychological resilience |
| **Body** | Physical vitality, wellness, self-care, bodily acceptance |
| **Spirit** | Inner peace, gratitude, joy, future vision, spiritual connection |
| **Connection** | Meaningful relationships, self-compassion, love, empathy |
| **Achievement** | Success, ambition, wealth, personal growth, accomplishment |

### Category Tones (subcategory nuances added to the script prompt)

| Category | Tone Direction |
|---|---|
| **Confidence** | Bold, assertive, powerful, self-assured |
| **Career** | Professional, ambitious, driven, leadership-focused |
| **Health** | Nurturing, calming, wellness-focused, vitality |
| **Wealth** | Abundant, prosperous, magnetic, financial freedom |
| **Relationships** | Warm, soft, loving, gentle, connection |
| **Sleep** | Peaceful, soothing, dreamy, tranquil |
| **Vision** | Inspiring, aspirational, visionary, future possibilities |
| **Emotion** | Emotionally intelligent, balanced, self-aware |
| **Happiness** | Joyful, optimistic, uplifting, inner peace |
| **Skills** | Confident, growth-oriented, capable, mastery |
| **Habits** | Disciplined, consistent, empowering, positive routines |
| **Motivation** | Energizing, driven, action-oriented, persistence |
| **Gratitude** | Appreciative, thankful, abundant, blessings |

### Script Length Config

| Length | Sentences | Max Tokens |
|---|---|---|
| **Short** | 2 | 150 |
| **Medium** | 5 | 350 |
| **Long** | 10 | 600 |

---

## RSVP Display Configuration (Client)

**File**: `client/screens/PlayerScreen.tsx` and `client/components/RSVPDisplay.tsx`

### PlayerScreen RSVP Constants

```typescript
// client/screens/PlayerScreen.tsx — lines 36-38
const RSVP_ENABLED = true;
const RSVP_FONT_SIZE: RSVPFontSize = "XL";
const RSVP_HIGHLIGHT = true;
```

### RSVP Position Offset (sync compensation)

```typescript
// client/screens/PlayerScreen.tsx — line 594
const rsvpPositionOffset = 200 * playbackSpeed;
const rsvpPosition = displayDuration > 0
  ? Math.min(displayPosition + rsvpPositionOffset, displayDuration - 1)
  : displayPosition + rsvpPositionOffset;
```

- **200ms forward offset** scaled by playback speed
- Compensates for audio decoding/reporting latency
- Clamped to `displayDuration - 1` to prevent overshoot

### Audio Progress Update Interval

```typescript
// client/contexts/AudioContext.tsx — line 273
progressUpdateIntervalMillis: 50  // 50ms updates for smooth RSVP tracking
```

### RSVPDisplay Font Sizes

```typescript
// client/components/RSVPDisplay.tsx
const FONT_SIZES: Record<RSVPFontSize, number> = {
  S: 24,
  M: 32,
  L: 40,
  XL: 52,        // Default for portrait mode
  LANDSCAPE: 72, // Used in fullscreen landscape mode
};
```

### ORP (Optimal Recognition Point) Algorithm

The RSVP display highlights a single character in each word at the "optimal recognition point" — the position where the eye naturally fixates for fastest word recognition:

```typescript
// client/components/RSVPDisplay.tsx — getORPIndex()
function getORPIndex(word: string): number {
  const len = word.length;
  if (len <= 1) return 0;
  if (len <= 5) return Math.floor(len / 2) - 1;
  if (len <= 9) return 2;
  if (len <= 13) return 3;
  return 4;
}
```

| Word Length | ORP Position | Example |
|---|---|---|
| 1 | 0 | **I** |
| 2-5 | floor(len/2)-1 | c**a**lm, pe**a**ce |
| 6-9 | 2 | be**a**utiful |
| 10-13 | 3 | tra**n**quility |
| 14+ | 4 | subs**c**onscious |

### Word Display Logic

```typescript
// RSVPDisplay — currentWord selection (reverse search for efficiency)
for (let i = wordTimings.length - 1; i >= 0; i--) {
  if (currentPositionMs >= wordTimings[i].startMs) {
    // Skip standalone punctuation — show the previous real word instead
    if (!isStandalonePunctuation(wordTimings[i].word)) {
      return wordTimings[i];
    }
    // Search backwards for a real word
    for (let j = i - 1; j >= 0; j--) {
      if (!isStandalonePunctuation(wordTimings[j].word)) {
        return wordTimings[j];
      }
    }
  }
}
```

- Punctuation is stripped from display: `stripPunctuation()` removes leading/trailing `,.!?;:'-"—–…`
- Standalone punctuation tokens are skipped entirely (shows previous word instead)

### Word Transition Animation

```typescript
// Non-ambient mode (affirmations)
opacity: withTiming(isPlaying ? 1 : 0.7, { duration: 150 });
scale: withTiming(isPlaying ? 1 : 0.95, { duration: 150 });

// Ambient mode (used in GuidedMomentPlayer)
wordOpacity: withTiming(0.55, { duration: 400, easing: Easing.out(Easing.ease) });
// Fade out: withTiming(0, { duration: 500, easing: Easing.in(Easing.ease) });
```

---

## Word Timing Pipeline — ElevenLabs

**File**: `server/replit_integrations/elevenlabs/client.ts`

### Pipeline Steps

1. **API call** → `POST /v1/text-to-speech/{voiceId}/with-timestamps`
2. **Parse alignment** → `parseCharacterTimingsToWords(result.alignment)`
   - Converts character-level timings (seconds) to word-level timings (milliseconds)
   - Supports 3 alignment formats from ElevenLabs API
   - Filters out corrupted/undefined entries
3. **Find sentence endings** → `findSentenceEndIndices(wordTimings)`
   - Detects words ending with `.`, `!`, `?` (optionally followed by `"` or `'`)
4. **Insert silence** → `insertSilenceIntoAudio(rawAudio, wordTimings, sentenceEndIndices, pauseSeconds)`
   - Splits MP3 at sentence boundaries using ffmpeg
   - **Re-encodes** segments with `libmp3lame -q:a 2 -ar 44100` for sample-accurate cuts
   - Generates silence file with `anullsrc` at 44100 Hz
   - Concatenates: segment1 + silence + segment2 + silence + ... + finalSegment
   - Re-encodes the concatenated output for consistency
5. **Adjust timings** → `adjustWordTimingsForPauses(wordTimings, sentenceEndIndices, pauseMs)`
   - Adds cumulative pause offset to all words after each sentence boundary
6. **Calculate duration** → Last word's `endMs / 1000` (ceiling)

### ffmpeg Commands Used

```bash
# Generate silence
ffmpeg -f lavfi -i "anullsrc=r=44100:cl=mono" -t 1.8 -q:a 9 -acodec libmp3lame -y silence.mp3

# Extract segment (re-encoded for precision)
ffmpeg -i input.mp3 -ss 0.0 -to 3.456 -c:a libmp3lame -q:a 2 -ar 44100 -y segment-0.mp3

# Extract final segment
ffmpeg -i input.mp3 -ss 3.456 -c:a libmp3lame -q:a 2 -ar 44100 -y segment-final.mp3

# Concatenate with silence
ffmpeg -f concat -safe 0 -i concat-list.txt -c:a libmp3lame -q:a 2 -ar 44100 -y output.mp3
```

> **Important**: Segments are re-encoded (not stream-copied) to ensure sample-accurate splitting. Stream copy (`-c copy`) only cuts at MP3 frame boundaries (~26ms), causing cumulative timing drift across sentences.

### adjustWordTimingsForPauses Logic

```typescript
function adjustWordTimingsForPauses(
  wordTimings: WordTiming[],
  sentenceEndIndices: number[],
  pauseMs: number           // e.g. 1800 for 1.8s
): WordTiming[] {
  let cumulativePause = 0;
  let nextPauseIndex = 0;
  
  for (let i = 0; i < wordTimings.length; i++) {
    // Current word gets shifted by accumulated pauses so far
    adjusted.push({
      word: word.word,
      startMs: word.startMs + cumulativePause,
      endMs: word.endMs + cumulativePause,
    });
    
    // After a sentence-ending word (but not the last word), add pause
    if (i === sentenceEndIndices[nextPauseIndex] && i < wordTimings.length - 1) {
      cumulativePause += pauseMs;
      nextPauseIndex++;
    }
  }
}
```

---

## Word Timing Pipeline — Hume

**File**: `server/hume-client.ts`

### Pipeline Steps

1. **Split text into sentences** → `splitIntoSentences(text)` using regex `/[^.!?]+[.!?]["']?\s*/g`
2. **API call** → `POST https://api.hume.ai/v0/tts` with one utterance per sentence
   - Each utterance has its own `trailing_silence` and optional `speed`
   - Last utterance gets 0.35s trailing silence (others get the configured pause)
3. **Extract word timings** from `generation.snippets[].timestamps[]`
   - Filters for `type === "word"`, maps `time.begin`/`time.end` to `startMs`/`endMs`
4. **Fix per-utterance timestamps** → `fixPerUtteranceTimestamps(rawTimings, trailingSilenceMs)`
   - Detects timestamp resets between utterances (when `startMs` drops below previous `endMs`)
   - Adds cumulative offset including trailing silence duration
5. **Sanitize** → `sanitizeWordTimings()` — ensures monotonic ordering, fixes overlapping/zero-duration words
6. **Calculate duration** → Last word's `endMs / 1000` (ceiling)

### fixPerUtteranceTimestamps Logic

```typescript
function fixPerUtteranceTimestamps(
  rawTimings: WordTiming[],
  trailingSilenceMs: number
): WordTiming[] {
  let cumulativeOffset = 0;

  for (let i = 0; i < rawTimings.length; i++) {
    // Detect utterance boundary: timestamp resets (new utterance starts near 0)
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
}
```

---

## Hume Voice Catalog

**File**: `server/hume-client.ts` — `HUME_VOICE_OPTIONS` and `server/routes.ts` — `HUME_VOICE_ID_MAP`

### Female Voices

| App ID | Display Name | Hume API Name | Description |
|---|---|---|---|
| `hume_seraphina` | Seraphina | Serene Assistant | Tranquil, radiant calm |
| `hume_lotus` | Lotus | Female Meditation Guide | Peaceful, guiding presence |
| `hume_amber` | Amber | Warm American Female | Warm, grounding energy |
| `hume_nova` | Nova | Warm Female Assistant Voice | Gentle, luminous clarity |
| `hume_willow` | Willow | Demure Conversationalist | Soft, graceful wisdom |

### Male Voices

| App ID | Display Name | Hume API Name | Description |
|---|---|---|---|
| `hume_orion` | Orion | Inspiring Man | Bold, uplifting strength |
| `hume_atlas` | Atlas | Deep Male Conversational Voice | Deep, grounded resonance |
| `hume_sage` | Sage | Soft Male Conversationalist | Calm, centering stillness |
| `hume_summit` | Summit | Nature Documentary Narrator | Steady, expansive clarity |
| `hume_bodhi` | Bodhi | Wise Wizard | Ancient, soulful wisdom |

---

## Hume-to-OpenAI Fallback Map

**File**: `server/routes.ts` — `HUME_TO_OPENAI_VOICE_MAP`

When Hume fails, these OpenAI voices are used as fallback:

| Hume Voice | OpenAI Fallback |
|---|---|
| hume_seraphina | nova |
| hume_lotus | shimmer |
| hume_amber | alloy |
| hume_nova | nova |
| hume_willow | shimmer |
| hume_orion | onyx |
| hume_atlas | echo |
| hume_sage | fable |
| hume_summit | onyx |
| hume_bodhi | echo |

Default fallback (no mapping found): **nova**

> **Note**: OpenAI fallback does NOT provide real word timings — timings are evenly estimated based on word count at 150 WPM.

---

## GuidedMomentPlayer RSVP (Meditations)

**File**: `client/components/GuidedMomentPlayer.tsx`

Meditations use a **word-by-word reveal** (not single-word RSVP), with these settings:

```typescript
progressUpdateIntervalMillis: 200  // 200ms updates (less frequent than affirmation player)
// No sync offset — words reveal based on raw currentPosition
// Word is visible when: currentPosition >= wordTiming.startMs
```

---

## Key File Locations

| File | Purpose |
|---|---|
| `server/replit_integrations/elevenlabs/client.ts` | ElevenLabs TTS, word timing parsing, ffmpeg silence insertion |
| `server/hume-client.ts` | Hume TTS, voice catalog, word timing extraction |
| `server/routes.ts` | `PILLAR_VOICE_CONFIG`, `MEDITATION_MOOD_CONFIG`, `generateAudio()`, `generateScript()` |
| `client/screens/PlayerScreen.tsx` | RSVP constants, position offset, playback speed, word timing parsing |
| `client/components/RSVPDisplay.tsx` | RSVP rendering, ORP algorithm, font sizes, animations |
| `client/components/GuidedMomentPlayer.tsx` | Meditation word-by-word reveal player |
| `client/contexts/AudioContext.tsx` | Audio playback, `progressUpdateIntervalMillis: 50` |

---

## Quick Restore Commands

If you need to restore to these "default" settings, here are the key values:

**"Restore default Inner Voice settings"**:
→ In `server/routes.ts` `generateAudio()`, Inner Voice branch:
`stability: 0.6, style: 0.25, pauseSeconds: 1.8`

**"Restore default AI Voice pillar settings"**:
→ See [Pillar Voice Config](#pillar-voice-config-ai-voice-only) table above

**"What is the mapping for Joy/Joyful for AI Voice meditation?"**:
→ `MEDITATION_MOOD_CONFIG.joyful`: humeSpeed 0.95, pause 1.4s, EL stability 0.45, style 0.45

**"What is the RSVP offset?"**:
→ `200 * playbackSpeed` ms forward offset (PlayerScreen line 594)

**"What is the audio update frequency?"**:
→ Affirmations: 50ms (`AudioContext.tsx`), Meditations: 200ms (`GuidedMomentPlayer.tsx`)
