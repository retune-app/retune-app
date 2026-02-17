# A/B Test: Cartesia Sonic vs ElevenLabs for Voice Cloning & TTS

> Date: February 2026
> Status: Planning

---

## Purpose

Compare Cartesia Sonic-3 against ElevenLabs as an alternative voice cloning and TTS provider for RETUNED. The goal is to evaluate voice quality, cloning speed, cost, and architectural implications before committing to a provider migration or dual-provider strategy.

---

## Why Consider Cartesia?

| Factor | ElevenLabs (current) | Cartesia Sonic-3 |
|--------|---------------------|------------------|
| **Instant voice cloning** | ~30 seconds of audio needed | Just 3 seconds of audio |
| **Clone processing time** | 30-60 seconds | To be measured |
| **TTS latency** | ~500ms-1s typical | 40-90ms claimed |
| **Voice slot management** | 30 slots, 60-day rotation required | Embedding-based — no slot limit |
| **Pricing** | Pro plan ~$99/mo, per-character | Pro $4/mo, Startup $39/mo, credit-based |
| **Node.js SDK** | `elevenlabs` (installed) | `@cartesia/cartesia-js` |
| **Word-level timestamps** | Yes (via `/with-timestamps` endpoint) | Not confirmed — needs testing |
| **Pro voice cloning** | Not offered | Available on Startup+ plan |
| **Model** | `eleven_multilingual_v2` | `sonic-3` (latest) |
| **Output format** | MP3 | WAV (pcm_s16le or pcm_f32le) |

### Potential Game-Changers

1. **3-second cloning** — Users could clone their voice almost instantly vs recording 1-3 minutes. Fundamentally reduces onboarding friction.
2. **No voice slot rotation** — Cartesia uses voice embeddings, not fixed slots. Could eliminate the entire rotation system, on-device storage, expiry notifications, and keep-active endpoint.
3. **~10x cheaper** — Startup plan ($39/mo) vs ElevenLabs Pro. Credits need to be validated against actual usage.
4. **Lower TTS latency** — 40-90ms vs ~500ms+ means faster audio generation.

### Potential Deal-Breakers to Test

1. **Clone quality with 3 seconds** — Is it good enough for daily affirmation listening? Users hear this voice repeatedly — quality must be high.
2. **Word-level timestamps** — RSVP mode depends on precise word timing. If Cartesia doesn't provide this, we'd need to keep Hume AI for stock voices or find a workaround.
3. **Emotional expressiveness** — Affirmations need warmth and conviction. Does Cartesia's voice sound natural for this use case, or is it optimized for conversational AI agents?
4. **Output format** — Cartesia outputs WAV. ElevenLabs outputs MP3. The client uses `expo-av` which handles both, but WAV files are larger (~10x). May need server-side transcoding.
5. **Multilingual support** — ElevenLabs `eleven_multilingual_v2` supports many languages. Cartesia claims 40+ languages — need to verify overlap.

---

## Current Architecture (What We're Comparing Against)

### Voice Cloning Flow
```
User records 1-3 min audio (m4a)
  → POST /api/voice-samples (multer saves temp file)
    → cloneVoice(filePath) in server/replit_integrations/elevenlabs/client.ts
      → POST to ElevenLabs /v1/voices/add
      → Returns voiceId (stored in users table)
    → Temp file deleted immediately
```

### TTS Flow
```
Personal voice request:
  → ElevenLabs textToSpeech(text, voiceId)
    → POST to /v1/text-to-speech/{voiceId}/with-timestamps
    → Returns { audio (mp3), duration, wordTimings }

Stock AI voice request:
  → Hume AI humeTTS(text, voiceName) [primary]
    → Returns { audio, duration, wordTimings }
  → OpenAI generateAudioOpenAI(text, voice) [fallback]
    → Returns { audio, duration, wordTimings (estimated) }
```

### Key Files
- `server/replit_integrations/elevenlabs/client.ts` — ElevenLabs clone + TTS functions
- `server/hume-client.ts` — Hume AI TTS + stock voice definitions
- `server/routes.ts` — `generateAudio()` and `generateAudioSimple()` routing logic
- `server/voice-rotation.ts` — Voice slot rotation system
- `client/screens/VoiceSetupScreen.tsx` — Recording + cloning UI

---

## A/B Test Architecture

### Approach: Server-Side Provider Routing

Add a `ttsProvider` field to the users table that determines which provider handles their voice cloning and personal voice TTS. This is an admin-controlled field — users don't choose their provider.

```
ttsProvider: varchar("tts_provider").default("elevenlabs")
  Values: "elevenlabs" | "cartesia"
```

### What Changes Per Provider

| Component | ElevenLabs (control) | Cartesia (test) |
|-----------|---------------------|-----------------|
| Voice cloning | `cloneVoice()` → ElevenLabs API | `cartesiaCloneVoice()` → Cartesia API |
| Personal voice TTS | `textToSpeech()` → ElevenLabs API | `cartesiaTTS()` → Cartesia API |
| Stock voice TTS | Hume AI (unchanged) | Hume AI (unchanged) |
| Voice rotation | Active (60-day cycle) | Not needed (no slot limits) |
| voiceId storage | ElevenLabs voice ID | Cartesia voice ID |

### What Does NOT Change

- Stock AI voice handling (Hume AI + OpenAI fallback) — stays the same for both groups
- RSVP mode — both providers need to supply word timings
- Audio playback — `expo-av` handles both MP3 and WAV
- Voice Setup UI — same recording flow, different backend processing
- User profile, preferences, and settings

---

## Implementation Plan

### Step 1: Cartesia Service Module

Create `server/cartesia-tts.ts` with two core functions:

#### `cartesiaCloneVoice(audioFilePath: string): Promise<string>`

```
Flow:
1. Read audio file as buffer
2. Call Cartesia clone API:
   client.voices.clone({
     clip: audioBuffer,
     name: "Inner Voice",
     language: "en",
     mode: "similarity"
   })
3. Return voice ID
4. Log: "[Cartesia] Voice cloned: ${voiceId}"
```

#### `cartesiaTTS(text: string, voiceId: string): Promise<{ audio: ArrayBuffer; duration: number; wordTimings: WordTiming[] }>`

```
Flow:
1. Call Cartesia TTS API:
   client.tts.bytes({
     model_id: "sonic-3",
     transcript: text,
     voice: { mode: "id", id: voiceId },
     output_format: { container: "wav", encoding: "pcm_s16le", sample_rate: 44100 }
   })
2. Collect all chunks into a single buffer
3. Calculate duration from WAV header or buffer size
4. Extract word timings (if available from Cartesia — needs API investigation)
5. If no word timings available, generate estimated timings from text (similar to OpenAI fallback approach)
6. Return { audio, duration, wordTimings }
```

**Word timing investigation needed**: Check if Cartesia's API provides word-level timestamps. If not, RSVP mode will use estimated timings (same quality as OpenAI fallback) for Cartesia users. This is a known trade-off for the A/B test.

### Step 2: Schema Change

Add `ttsProvider` to the users table:

```typescript
ttsProvider: varchar("tts_provider", { length: 20 }).default("elevenlabs")
```

Run migration. Default is `"elevenlabs"` so all existing users remain on the current provider.

### Step 3: Route Modification

#### Cloning Route (`POST /api/voice-samples`)

```
// At the top of the handler:
const [userWithProvider] = await db
  .select({ ttsProvider: users.ttsProvider, ... })
  .from(users)
  .where(eq(users.id, req.userId!));

const provider = userWithProvider.ttsProvider || 'elevenlabs';

// In the cloning logic:
if (provider === 'cartesia') {
  voiceId = await cartesiaCloneVoice(file.path);
} else {
  voiceId = await cloneVoice(file.path, "My Affirmation Voice");
}
```

#### TTS Routes (`generateAudio` and `generateAudioSimple`)

```
// When isPersonalVoice is true:
if (provider === 'cartesia') {
  return await cartesiaTTS(script, voiceId);
} else {
  return await elevenLabsTTS(script, voiceId, settings);
}
```

The user's `ttsProvider` needs to be passed down to these functions. Add it as an optional parameter.

### Step 4: Admin Controls

Add an admin endpoint or use the database directly to assign users to test groups:

```
PATCH /api/admin/users/:id/tts-provider
Body: { provider: "cartesia" | "elevenlabs" }
```

For the A/B test, manually assign test users (including yourself) to the Cartesia group.

### Step 5: Metrics & Comparison

Track these metrics per provider in server logs:

```
[TTS] provider=cartesia user=${userId} duration=${ms}ms characters=${length} 
[TTS] provider=elevenlabs user=${userId} duration=${ms}ms characters=${length}
[Clone] provider=cartesia user=${userId} duration=${ms}ms
[Clone] provider=elevenlabs user=${userId} duration=${ms}ms
```

Compare:
- Clone success rate
- Clone processing time
- TTS generation latency
- Audio file size (WAV vs MP3)
- Subjective quality (you'll need to listen to both)

---

## Audio Format Consideration

Cartesia outputs WAV. ElevenLabs outputs MP3. WAV files are ~10x larger:
- A 60-second affirmation as MP3: ~500 KB
- A 60-second affirmation as WAV (44.1kHz, 16-bit): ~5 MB

**Options:**
1. **Serve WAV as-is** — Simple, works with expo-av, but uses more bandwidth and client storage. Fine for testing.
2. **Server-side transcode to MP3** — Use ffmpeg (already available) to convert WAV → MP3 before responding. Adds ~1-2 seconds of processing but normalizes file sizes.
3. **Request lower sample rate** — Use 22050 Hz instead of 44100. Halves file size, still fine for speech.

**Recommendation for A/B test**: Start with option 3 (22050 Hz WAV). If file sizes are still a concern, add transcoding later. Don't optimize prematurely during testing.

---

## Voice Rotation Implications

If Cartesia works well, the entire voice rotation system becomes unnecessary for Cartesia users:
- No 60-day expiry
- No `voiceLastUsedAt` tracking
- No push notification warnings at 53 and 58 days
- No `keep-active` endpoint calls
- No on-device recording storage for re-cloning
- No slot management or queue-based recovery

The voice rotation system (`server/voice-rotation.ts`) should be bypassed for users with `ttsProvider === 'cartesia'`. During the A/B test, simply skip rotation checks for Cartesia users.

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Cartesia clone quality insufficient | Medium | High | Test with multiple voice samples before expanding |
| No word-level timestamps | Medium | Medium | Fall back to estimated timings (existing pattern) |
| WAV file sizes too large | Low | Medium | Server-side transcoding or lower sample rate |
| Cartesia API instability | Low | High | Keep ElevenLabs as default, easy rollback |
| Credit usage higher than expected | Low | Medium | Monitor during test, adjust plan if needed |

---

## Success Criteria for Cartesia Adoption

Before expanding beyond the test group, Cartesia must demonstrate:

- [ ] Clone quality is subjectively comparable to ElevenLabs (your ears, not metrics)
- [ ] Clone succeeds with 3-10 seconds of audio (vs 30+ seconds for ElevenLabs)
- [ ] TTS latency is measurably lower than ElevenLabs
- [ ] Cost per user is lower at projected scale
- [ ] RSVP mode works acceptably (word timings available or estimated timings are good enough)
- [ ] No reliability issues over 2+ weeks of testing
- [ ] Audio quality is consistent across multiple generations

---

## What This Does NOT Test

- Stock AI voices — Hume AI remains the stock voice provider regardless of outcome
- Micro-meditation TTS — Currently uses Hume AI, not in scope for this comparison
- Sound effects — ElevenLabs sound generation is a separate feature, not affected

---

## Rollback Plan

If Cartesia doesn't work out:
1. Set all test users back to `ttsProvider: "elevenlabs"`
2. Users would need to re-clone with ElevenLabs (their Cartesia voiceId won't work)
3. Remove Cartesia module and package
4. No schema rollback needed (the `ttsProvider` field can stay for future experiments)

---

## Prerequisite: Cartesia API Key

A Cartesia account is required. Recommended starting plan:
- **Pro ($4/mo)** — Includes instant voice cloning, 100K credits, commercial use
- **Startup ($39/mo)** — Adds Pro Voice Cloning (higher quality), 1.25M credits, organizations

For an A/B test with a small number of users, Pro is sufficient. Upgrade to Startup if Pro Voice Cloning quality is needed.

Sign up at: https://play.cartesia.ai/sign-up
