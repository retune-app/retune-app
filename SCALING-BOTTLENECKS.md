# Retuned — Scaling Bottlenecks & Architecture Analysis for 10,000 Users

## Current Voice Architecture

### Two voice types available to users:

1. **Personal Voice ("Inner Voice")** — User records 1-3 min of speech, which is sent to **ElevenLabs Instant Voice Cloning API** to create a clone. The clone's `voiceId` is stored in our database. All subsequent TTS for that user uses ElevenLabs' `/v1/text-to-speech` endpoint with their cloned voice ID and the `eleven_multilingual_v2` model. Word-level timestamps are captured via the `/with-timestamps` endpoint for RSVP text sync.

2. **AI Stock Voices** — 10 curated voices (5 female, 5 male) powered by **Hume AI TTS API** (`/v0/tts`). Each has a friendly app name mapped to a Hume voice name (e.g., "Seraphina" maps to "Serene Assistant"). Hume provides word-level timestamps natively, used for RSVP mode.

3. **OpenAI TTS Fallback** — If both the primary service and Hume fail, OpenAI's `audio.speech.create` is used as a last resort. No word timestamps are available from OpenAI (estimated from word count instead).

### Voice routing logic (`generateAudio` function):
- If user preference = "personal" and they have a valid `voiceId` → ElevenLabs
- If personal voice fails (quota, expired, not found) → automatic fallback to their preferred AI stock voice via Hume
- If Hume fails → OpenAI fallback
- If all fail → error returned to user

### Audio caching (already implemented):
- When an affirmation is created, the TTS audio is generated once, saved to disk (`/uploads/audio/`), and the `audioUrl` is stored in the DB. Every subsequent play serves the cached file — no re-generation.
- Micro-meditations are **NOT cached** — they are ephemeral by design, generated fresh each session, and returned as base64 audio directly (never saved to disk).

---

## Current Rate Limits & Usage Caps

| Control | Value | Scope |
|---|---|---|
| AI affirmation generation | 5 req/min + 20/month per user | Per user |
| TTS audio generation | 10 req/min | Per IP |
| Voice cloning attempts | 6/hour | Per IP |
| Lifetime voice clones | 5 per user | Per user |
| Micro-meditations | 20/day | Per user |
| Daily greetings | 10/min | Per user |
| ElevenLabs voice slots | 160 (Pro plan) | Account-wide |

---

## Bottleneck #1: ElevenLabs Voice Slots (CRITICAL)

**Problem:** 160 Instant Voice Clone slots shared across all users. At 10K users, if even 5% clone their voice (500 users), slots overflow by 3x.

**Current mitigations:**
- Voice rotation removes voices inactive for 60+ days (`findInactiveVoices`)
- Queue-based slot recovery: when slots are full, the least-recently-used voice is auto-rotated to make room (`freeVoiceSlotForNewClone`)
- Warning system triggers at 83% capacity (133 slots)

**Remaining risks:**
- If 200+ users are all active within the same 60-day window, rotation won't help — they're all "active"
- Rotated users return to find their voice gone; must re-record (friction, uses one of their 5 lifetime clones)
- The queue-based recovery happens reactively (after ElevenLabs rejects a clone), not proactively
- No notification to users whose voice was rotated — they discover it when they try to play

**Long-term solutions to explore:**
- On-demand voice architecture: store user recordings in object storage, clone only when needed, delete from ElevenLabs after N days of inactivity, re-clone from stored recording on return
- Upgrade to Scale ($330/mo, more slots) or negotiate enterprise pricing
- User notification when voice is about to be rotated, with a "keep active" prompt

---

## Bottleneck #2: ElevenLabs Monthly Credits (HIGH)

**Problem:** 500K credits/month ≈ 500 min Multilingual v2 or 1,000 min Flash. Only affects personal (cloned) voice users since stock voices use Hume.

**What consumes credits:**
- First-time affirmation creation with personal voice (cached after — no repeat cost)
- Voice regeneration (switching voice type on existing affirmation)
- Micro-meditations using personal voice (ephemeral, never cached)
- Voice preview in settings

**At 10K users:**
- If 500 personal-voice users each create 3 affirmations/month (~1 min each) = 1,500 min → 3x over quota
- Overage: ~$0.24/min Multilingual = ~$360/mo in overages for affirmations alone
- Micro-meditations with personal voice could add significantly more

**Long-term solutions to explore:**
- Switch personal voice TTS from `eleven_multilingual_v2` to Flash model (half the credit cost, ~$0.12/min overage)
- Cache micro-meditation audio for repeat moods/durations
- Set a monthly personal-voice TTS budget per user
- Consider whether micro-meditations need personal voice at all (could default to stock)

---

## Bottleneck #3: Hume AI Concurrency & Costs (MEDIUM)

**Problem:** Hume handles ALL stock voice TTS (the majority of users). Rate limits and pricing are less transparent than ElevenLabs.

**What consumes Hume:**
- Every new affirmation creation for stock-voice users
- Every micro-meditation for stock-voice users
- Voice previews in settings
- Mood journey audio steps

**At 10K users:**
- If 9,500 users (those without cloned voices) use stock voices, and each creates 2 affirmations/month + 3 micro-meditations/month = ~47,500 TTS requests/month
- Concurrent peak could see 50-100+ simultaneous Hume API calls during popular usage hours
- Hume API returns 429 errors under heavy load → user sees "try again"

**Current mitigation:** OpenAI fallback catches Hume failures, but OpenAI TTS has no word timestamps, so RSVP mode degrades.

**Long-term solutions to explore:**
- Request queue with concurrency control (e.g., max 10 parallel Hume calls, rest queued)
- Understand Hume's actual rate limits and pricing tiers
- Pre-generate popular micro-meditation scripts and cache their audio
- Negotiate enterprise Hume pricing if volume justifies

---

## Bottleneck #4: OpenAI API Costs (LOW)

**Problem:** Every AI-generated affirmation script, micro-meditation script, daily greeting, and mood check-in goes through OpenAI GPT.

**At 10K users:**
- ~20 affirmation scripts/user/month = 200K calls/month
- Plus micro-meditations, greetings, mood analysis
- At ~$0.01-0.03/call → $2K-6K/month

**Mitigation already in place:** 20 AI affirmations/month per user cap, 20 micro-meditations/day cap.

**Long-term solutions to explore:**
- Template-based affirmation library (pre-generated scripts users can browse, only TTS needed)
- Cache daily greetings (same greeting for same time-of-day context)
- Batch script generation during off-peak

---

## Bottleneck #5: File Storage (LOW-MEDIUM)

**Problem:** Every affirmation audio file is saved to disk. At scale, this grows unbounded.

**At 10K users:**
- ~200K affirmations/month × ~200KB each = ~40GB/month of audio files
- Old audio files for deleted/inactive users are never cleaned up

**Long-term solutions to explore:**
- Move audio storage to object storage (S3/R2) with lifecycle policies
- Auto-delete audio for users inactive >90 days
- Compress audio files (lower bitrate for storage, higher for playback)

---

## Priority Ranking

1. **Voice slot management** — the hard cap that will hit first and most visibly
2. **ElevenLabs credit management** — the cost that scales fastest
3. **Hume concurrency** — the reliability risk at peak usage
4. **File storage** — slow burn but needs a plan
5. **OpenAI costs** — manageable with existing caps
