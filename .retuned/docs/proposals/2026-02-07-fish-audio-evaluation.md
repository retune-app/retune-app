# Voice Provider Evaluation: Fish.audio as ElevenLabs Complement

**Date:** February 7, 2026  
**Status:** Pending Team Review  
**Author:** Replit Agent

---

## Problem Statement

Retuned currently relies entirely on **ElevenLabs** for two critical features:

1. **Voice Cloning** — Users record their voice, we clone it via ElevenLabs Instant Voice Cloning
2. **Text-to-Speech (TTS)** — We generate affirmation audio using that cloned voice

### Current Pain Points

- **Credits exhaust quickly** — Each affirmation costs ~588 ElevenLabs credits. Once monthly credits run out, personal voice TTS stops working for ALL users with no fallback.
- **Voice slot limits** — ElevenLabs limits stored voice clones (currently 8 of 30 used). Scaling to hundreds/thousands of users requires Pro plan ($99/mo) or higher.
- **Single point of failure** — When ElevenLabs is down or credits are exhausted, users with personal voices get errors.
- **Cost trajectory** — As user base grows, ElevenLabs costs scale steeply ($22/mo Creator → $99/mo Pro → $330/mo Scale).

---

## Proposed Solution: Hybrid Voice Provider Architecture

Add **Fish.audio** as a complement to ElevenLabs, creating a dual-provider system with intelligent routing.

### Routing Strategy

| Task | Provider | Rationale |
|---|---|---|
| Voice Cloning | **Fish.audio** (primary) | Cheaper, unlimited slots, needs only 15 sec of audio |
| TTS — Standard Playback | **Fish.audio** (primary) | Much cheaper per-minute cost |
| TTS — RSVP Mode (synced text) | **ElevenLabs** (exclusive) | Only provider with word-level timestamps |
| TTS — Stock AI Voices | **OpenAI** (no change) | Already working, cheapest for stock voices |
| Fallback on credit exhaustion | **Auto-switch** to alternate provider | Redundancy |

---

## Pricing Comparison

| | Fish.audio Plus | ElevenLabs Creator | ElevenLabs Pro |
|---|---|---|---|
| Monthly cost | **$5.50/mo** (yearly) or $20/mo | $22/mo | $99/mo |
| TTS output | ~200 min/mo (S1 model) | ~200 min/mo | ~16 hrs/mo |
| Voice cloning | Unlimited, 10 private slots | 30 slots | 160 slots |
| API pricing | $15 per 1M UTF-8 bytes (~12 hrs) | Credit-based, higher cost | Credit-based |
| Min audio for clone | 15 seconds | 1-5 minutes | 1-5 minutes |

---

## Pros

1. **Significant cost savings** — Fish.audio Plus at $5.50/mo (yearly) vs ElevenLabs Creator at $22/mo for similar output
2. **No more credit exhaustion blocking users** — If ElevenLabs runs out, Fish.audio handles personal voice TTS automatically
3. **Unlimited voice slots** — Fish.audio paid plans have no cap on private voice models
4. **Faster cloning** — Only 15 seconds of audio needed (vs 1-5 minutes)
5. **Redundancy** — Two providers means no single point of failure
6. **Lower barrier for users** — Shorter voice recording = better completion rate for voice setup

## Cons

1. **No word-level timestamps** — Fish.audio TTS returns audio only, no timing metadata. RSVP mode (word-by-word synced text) can ONLY work with ElevenLabs. Workaround exists (run audio through Fish.audio ASR for segment timestamps) but adds cost (~$0.36/audio hour) and is less precise.
2. **Voice quality difference** — ElevenLabs is generally rated higher for emotional range and naturalness. Users may notice quality difference.
3. **Two cloned voices per user** — Managing voice clones on both services adds complexity to onboarding and voice management.
4. **Integration effort** — Building a second voice provider requires new backend modules, updated routing logic, and dual error handling.
5. **Fewer languages** — Fish.audio supports 8+ languages vs ElevenLabs' 73. Not an issue now but could limit international expansion.
6. **Newer company** — Fish.audio is less established, carrying some long-term reliability risk.

---

## Impact on RSVP Feature

**Critical finding:** Fish.audio does NOT support word-level timestamps in their TTS API response. Their API returns raw audio data only (MP3/WAV/PCM/Opus) with no timing metadata.

**Workaround option:** Generate TTS audio with Fish.audio, then run it through Fish.audio's ASR (speech recognition) to extract segment-level timestamps. This adds:
- An extra API call per generation
- ~$0.36/audio hour in ASR costs
- Phrase-level rather than word-level precision (less accurate sync)

**Recommendation:** Keep ElevenLabs exclusively for RSVP mode where precise word timing is essential.

---

## Recommendation

**Use both providers in a hybrid architecture.** Fish.audio handles the bulk of voice cloning and standard TTS (saving money and adding redundancy), while ElevenLabs remains available for RSVP mode where word timestamps are required.

This gives us the best of both worlds: cost efficiency, scaling headroom, and feature preservation.

---

## Next Steps (Pending Approval)

1. Obtain Fish.audio API key and configure as environment secret
2. Build server/fish-audio.ts service module (clone voice + TTS generation)
3. Update smart TTS routing to prefer Fish.audio for non-RSVP playback
4. Add Fish.audio as voice cloning option in VoiceSettingsScreen
5. Implement automatic fallback chain when either provider's credits are exhausted
6. Test full flow end-to-end

---

*This document was auto-generated and committed to GitHub by the Replit agent for team review.*
