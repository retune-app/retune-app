# Retuned — Voice & AI Architecture

*Last updated: February 17, 2026 | v1.7.2 Build 2*

---

## Overview

Retuned uses three AI services to power its audio pipeline. Each service has a specific role:

| Service | Role | Used For |
|---------|------|----------|
| **Hume AI** (Octave 2) | Primary TTS | Stock AI voices with word-level timestamps |
| **ElevenLabs** (Pro) | Voice cloning + TTS | Personal cloned voices |
| **OpenAI** | Fallback TTS + script generation | Backup voices + AI affirmation writing |

---

## 1. Hume AI — Stock AI Voices

**Role**: Primary text-to-speech engine for all stock (non-cloned) AI voices.

### Available Voices

| Gender | Voice | Description |
|--------|-------|-------------|
| Female | Seraphina | Tranquil, radiant calm |
| Female | Lotus | Peaceful, guiding presence |
| Female | Amber | Warm, grounding energy |
| Female | Nova | Gentle, luminous clarity |
| Female | Willow | Soft, graceful wisdom |
| Male | Orion | Bold, uplifting strength |
| Male | Atlas | Deep, grounded resonance |
| Male | Sage | Calm, thoughtful clarity |
| Male | Summit | Steady, commanding presence |
| Male | Bodhi | Warm, centered awareness |

### Key Details
- **10 voices total** (5 female, 5 male)
- Provides **word-level timestamps**, which power RSVP mode (synchronized text display during playback)
- No per-user limits — usage is based on our Hume API plan
- If Hume is unavailable, the system automatically falls back to OpenAI

---

## 2. ElevenLabs — Personal Voice Cloning

**Role**: Clones a user's voice from a recording, then generates TTS in that cloned voice.

**Model**: `eleven_multilingual_v2`

### Limits & Rules

| Rule | Detail |
|------|--------|
| Voice clones per user | **5 lifetime** (admins exempt) |
| Cloning rate limit | **6 attempts per hour** per user |
| ElevenLabs plan cap | **30 total cloned voice slots** across all users |
| Warning threshold | System alerts at **83% capacity** (25+ active voices) |
| Auto-cleanup | Voices unused for **60+ days** are automatically deleted |
| Cleanup schedule | Runs **once every 24 hours** |
| Consent required | User must explicitly accept voice cloning terms before recording |
| Privacy | Recording files are **immediately deleted** after cloning (even on failure) |

### Voice Rotation (Auto-Cleanup)

The system automatically manages ElevenLabs voice slots to stay within plan limits:

1. Every 24 hours, the system checks for cloned voices that haven't been used in 60+ days
2. Inactive voices are deleted from ElevenLabs and the user's record is updated
3. Affected users are prompted to re-record if they want to use a personal voice again
4. At 83% capacity (25/30 slots), warning logs are generated

### What Happens When a User's Voice Expires
- Their preference is switched back to an AI stock voice
- Voice sample status is marked as "rotated"
- If they try to use a personal voice, they see a prompt to re-record
- Re-recording counts against their 5 lifetime clones

---

## 3. OpenAI — Fallback TTS & Script Generation

### Fallback TTS (tts-1 model)

**Role**: Backup text-to-speech when Hume AI is unavailable.

Each Hume voice maps to a similar-sounding OpenAI voice:

| Hume Voice | OpenAI Fallback |
|------------|----------------|
| Seraphina | nova |
| Lotus | shimmer |
| Amber | alloy |
| Nova | nova |
| Willow | shimmer |
| Orion | onyx |
| Atlas | echo |
| Sage | fable |
| Summit | onyx |
| Bodhi | echo |

**Important**: OpenAI only provides **estimated** word timings (not precise like Hume), so RSVP mode is approximate when running on fallback.

### AI Affirmation Script Generation (GPT-4o)

| Rule | Detail |
|------|--------|
| Monthly limit | **20 AI-generated affirmations per user** (auto-resets) |
| Rate limit | **5 requests per minute** |
| Manual affirmations | Unlimited (no AI cost) |
| Admin accounts | Exempt from all limits |

Scripts use Subconscious Language Patterns: present tense, positive language, sensory imagery, identity-level statements, progressive believability, embedded commands, rhythmic flow, and emotional anchoring.

### AI Daily Greetings (GPT-4o-mini)

- Personalized greeting on the home screen
- Uses real user stats (streak, total sessions, favorite technique)
- Max 10 words, no exclamation marks
- Cached once per user per day
- Minimal cost (pennies per day for hundreds of users)

---

## TTS Routing Logic

```
User plays an affirmation
    |
    +-- Personal (cloned) voice?
    |       |
    |       +-- ElevenLabs TTS
    |       |       |
    |       |       +-- Success --> Play audio
    |       |       |
    |       |       +-- Quota exceeded? --> "Wait for credits to reset or switch to AI voice"
    |       |       |
    |       |       +-- Voice not found? --> "Voice expired, please re-record"
    |       |
    |       +-- (No fallback to AI voice for personal voice failures)
    |
    +-- Stock AI voice?
            |
            +-- Hume AI TTS (with word timestamps for RSVP)
            |       |
            |       +-- Success --> Play audio with synced text
            |       |
            |       +-- Failed? --> Try OpenAI fallback
            |
            +-- OpenAI TTS (estimated timestamps)
                    |
                    +-- Success --> Play audio with approximate text sync
                    |
                    +-- Failed? --> "All TTS services unavailable"
```

---

## Cost Drivers

| Service | What Costs Money | Notes |
|---------|-----------------|-------|
| **ElevenLabs** | Per character of TTS + voice clone slots | Pro plan = 30 voice slots |
| **Hume AI** | Per TTS request | Primary stock voice engine |
| **OpenAI (TTS)** | Per character of fallback TTS | Rarely used (only when Hume is down) |
| **OpenAI (GPT-4o)** | Per token for script generation | 20 scripts/user/month cap limits exposure |
| **OpenAI (GPT-4o-mini)** | Per token for daily greetings | ~15 tokens out, cached daily, very cheap |

---

## Environment Variables

| Variable | Service |
|----------|---------|
| `HUME_API_KEY` | Hume AI TTS |
| `ELEVENLABS_API_KEY` | ElevenLabs voice cloning + TTS |
| `OPENAI_API_KEY` | OpenAI fallback TTS |
| `AI_INTEGRATIONS_OPENAI_API_KEY` | OpenAI script generation + daily greetings |

---

## Cartesia (Disabled)

> **Status**: Code preserved, not active. See `docs/voice-cloning/09-ab-test-cartesia-vs-elevenlabs.md` for details.

Cartesia Sonic-3 was implemented as an alternative voice cloning and TTS provider for A/B testing. The integration is fully built in `server/cartesia-tts.ts` (cloning, TTS with emotional tone mapping, voice deletion) but all API calls are bypassed in `server/routes.ts`. No Cartesia API calls occur during normal operation.

Preserved assets:
- `server/cartesia-tts.ts` — Full service module
- `CARTESIA_API_KEY` — Secret configured
- `@cartesia/cartesia-js` — npm package installed
- `ttsProvider` / `cartesiaVoiceId` — Database fields in users table

---

## Security & Privacy

- Voice consent is required before any recording or cloning
- Voice recording files are deleted immediately after processing
- Voice data stays on ElevenLabs servers (subject to their data policy)
- Users can delete all their data via the "Delete My Data" feature (GDPR-compliant)
- All AI endpoints are rate-limited to prevent abuse
- Admin accounts are identified by user ID, not role flag
