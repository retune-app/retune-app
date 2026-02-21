# Chatterbox A/B Testing

> **Last updated**: February 21, 2026 (v1.7.3 Build 1)
> **Status**: PAUSED — built for evaluation, not yet integrated into production voice pipeline

---

## Overview

Side-by-side blind comparison of ElevenLabs vs Chatterbox (ResembleAI) for voice cloning quality. The user records a voice sample, enters affirmation text, and the system generates TTS from both providers in parallel. Results are presented as "Voice A" and "Voice B" (randomized order) so the listener can evaluate quality without bias before revealing which provider produced each sample.

---

## Architecture

```
Client (DevABTestScreen.tsx)
  → POST /api/dev/ab-test (dev-routes.ts)
    → Both providers run in parallel:
       ├─ ElevenLabs: clone → TTS → delete clone
       └─ Chatterbox: @gradio/client → HuggingFace Space
  ← JSON response with base64 audio from both providers
```

The endpoint uses `Promise.all` to run both providers simultaneously. Each provider call is wrapped in a `timedCall` helper that catches errors per-provider (so one failing doesn't block the other) and records generation time.

---

## Chatterbox Integration

Uses `@gradio/client` to connect to the [ResembleAI/Chatterbox](https://huggingface.co/spaces/ResembleAI/Chatterbox) HuggingFace Space.

### API Parameters

| # | Parameter | Value | Description |
|---|-----------|-------|-------------|
| 1 | text | (user input) | Affirmation text to synthesize |
| 2 | audio | (voice sample) | User's recorded voice clip |
| 3 | exaggeration | 0.5 | Voice expressiveness |
| 4 | temperature | 0.8 | Sampling temperature |
| 5 | seed | 0 | Random seed (0 = random) |
| 6 | cfg_weight | 0.5 | Classifier-free guidance weight |
| 7 | min_p | 0.05 | Minimum probability threshold |
| 8 | top_p | 1.0 | Nucleus sampling threshold |
| 9 | repetition_penalty | 1.2 | Repetition penalty |

- **fn_index**: 1
- **Cold start**: HuggingFace Space can take 2-5 minutes to wake up if idle
- **Timeout**: 5 minutes (300 seconds) on both client (`AbortController`) and server (`req.setTimeout` / `res.setTimeout`)

### Response Handling

Chatterbox returns audio in various formats depending on the Space's state. The server handles:
- URL string (fetched via `fetch`)
- Blob object
- Buffer object
- Object with `.url` property

---

## ElevenLabs Integration

Uses the existing clone + TTS pipeline from `server/replit_integrations/elevenlabs/client.ts`:

1. Write voice buffer to temp file
2. `cloneVoice(tempPath, name)` — creates a temporary voice clone
3. `textToSpeech(text, voiceId)` — generates TTS audio
4. Return base64-encoded audio
5. **Cleanup** (in `finally` block):
   - Delete temp file from disk
   - `deleteVoice(voiceId)` — removes the temporary clone from ElevenLabs

---

## Privacy

- Voice recordings stay on the user's device until they initiate the test
- Recordings are uploaded only for the duration of the A/B test
- ElevenLabs temporary voice clones are deleted immediately after TTS generation (in the `finally` block)
- Chatterbox processes audio through HuggingFace Space (no persistent storage)
- No test results or recordings are saved to the database

---

## Access

The A/B test screen is accessible only from the **ProfileScreen** dev tools section. It is not visible to regular users and is intended for internal evaluation only.

---

## Future Considerations

If Chatterbox voice cloning quality proves sufficient, it could potentially replace ElevenLabs for the cloning pipeline:

- **Eliminates slot limits**: ElevenLabs has a fixed number of voice clone slots; Chatterbox has no such restriction
- **Reduces API costs**: Chatterbox runs on HuggingFace (or could be self-hosted) vs ElevenLabs paid API
- **Evaluation criteria**:
  - Latency (ElevenLabs is currently much faster)
  - Voice similarity to original recording
  - Naturalness of generated speech
  - Word timing support (critical for RSVP display — Chatterbox does not currently provide word-level timestamps)

---

## Key Files

| File | Purpose |
|------|---------|
| `server/routes/dev-routes.ts` | Server endpoint `/api/dev/ab-test`, provider logic |
| `client/screens/DevABTestScreen.tsx` | Client UI: recorder, text input, blind playback, reveal |
| `client/screens/ProfileScreen.tsx` | Entry point (dev tools section) |
