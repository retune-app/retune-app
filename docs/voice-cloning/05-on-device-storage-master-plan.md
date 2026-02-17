# On-Device Voice Recording Storage — Master Plan

> Reference document consolidating the full implementation plan with all amendments from the critical review.
> 
> Date: February 2026

---

## Context

RETUNED uses ElevenLabs Instant Voice Cloning to create personal "Inner Voice" clones. The user records 1-3 minutes of speech in `VoiceSetupScreen.tsx` using `expo-av`, which produces an **m4a file (~1-3 MB)**. This file is uploaded via FormData to `POST /api/voice-samples`, where multer writes it to disk temporarily, forwards it to ElevenLabs, then **deletes the file immediately**. The raw recording is never persisted anywhere.

We need to **save the raw voice recording to the user's device** before it gets uploaded and discarded, so the app can re-clone automatically if the voice is rotated — without the user needing to re-record and without storing voice data on our servers.

**Privacy principle: The user's raw voice recording is NEVER stored on RETUNED servers. It lives exclusively on the user's device.**

---

## Prerequisites

The following are already implemented and working:

- Voice clone expiry notifications (push tokens, 53-day and 58-day warnings)
- `POST /api/voice/keep-active` endpoint (resets `voiceLastUsedAt`, clears `voiceExpiryWarningAt`)
- Voice rotation via `rotateUserVoice()` in `server/voice-rotation.ts`
- `VOICE_EXPIRED` error detection in `VoiceSettingsScreen.tsx` and routes.ts

---

## Phased Rollout Strategy

The implementation is split into three phases to reduce risk and allow validation at each step:

| Phase | What | Risk | User-Facing Changes |
|-------|------|------|---------------------|
| **Phase 1** | Save recording to device + server-side re-clone support | Low | None — invisible to users |
| **Phase 2** | Re-clone utility + Voice Settings UI + migration prompt for existing users | Medium | New status section in Voice Settings |
| **Phase 3** | Automatic background re-cloning | Medium | Voice restoration becomes fully seamless |

See individual phase documents for full implementation details:
- `06-phase-1-foundation.md`
- `07-phase-2-user-facing-restore.md`
- `08-phase-3-automatic-reclone.md`

---

## Key Technical Decisions

### On-Device Storage
- **Location**: `${documentDirectory}voice/my-voice-recording.m4a`
- **Single fixed filename**: Intentionally overwrites on re-record. The stored file always represents the most recent successful clone.
- **Platform guard**: `Platform.OS !== 'web'` — no device storage on web.
- **Backup exclusion**: Cannot be implemented in Expo Go. Known limitation documented with TODO for development build migration.

### Server-Side Re-Clone Validation
- `X-Clone-Source: system-reclone` header signals a re-clone request.
- **Security**: Server validates that the user's `voiceId` is `null` before granting re-clone privileges. Prevents header spoofing to bypass the 5-clone lifetime limit.
- System re-clones do NOT increment `voiceClonesUsed` and bypass `MAX_VOICE_CLONES` check.

### File Existence Verification
- Voice Settings screen verifies the file actually exists on mount using `getInfoAsync()`.
- If AsyncStorage says `hasLocalVoiceRecording: true` but the file is gone (OS reclaimed, app data cleared), the flag is reconciled to `false`.

### Migration for Existing Users
- No recordings exist for users who cloned before Phase 1 ships — the raw recording was always deleted immediately after cloning.
- ElevenLabs does not provide an API to retrieve original source recordings from cloned voices.
- Phase 2 includes a transitional prompt encouraging existing users to re-record once to enable the protection.

---

## Schema Changes

### `users` table — new field:
```
voiceRotatedAt: timestamp("voice_rotated_at")   // nullable
```
- Set to `new Date()` when `rotateUserVoice()` runs
- Set to `null` when a new voice clone succeeds (user-initiated or system re-clone)
- Included in user profile API response

---

## Privacy & App Store Compliance

### Apple App Store
- Storing a 1-3 MB user-generated file in the app's private sandbox requires no additional permissions.
- The microphone permission prompt already covers voice recording.
- Privacy Nutrition Label: "Audio Data" collection should already be declared.
- Privacy Policy must mention local device storage of voice recordings for restoration purposes.

### Privacy Policy Update Required
- Add a line covering on-device voice recording storage for voice restoration purposes.
- This should be done as part of Phase 1 before the feature ships.

### Backup Exclusion Gap
- Files in `documentDirectory` may be included in iCloud/Google backups.
- Cannot be fixed in Expo Go. Addressed when migrating to a development build.
- Not a blocker for App Store review.

---

## What NOT to Change (Across All Phases)

- Do not modify the ElevenLabs cloning API call — same `cloneVoice()` function, same parameters
- Do not change TTS playback or audio caching logic (`generateAudio` function)
- Do not change the voice rotation schedule, thresholds, or notification timing
- Do not change the `voiceSamples` table schema beyond what's specified
- Do not store any voice audio on the server or in object storage — the temp file written by multer must still be deleted after the ElevenLabs call as it is today
- Do not transcode or compress the m4a file — store it as-is

---

## Full Acceptance Criteria (All Phases)

- [ ] After a successful voice clone on iOS/Android, the raw m4a recording is copied to `${documentDirectory}voice/my-voice-recording.m4a`
- [ ] Re-recording overwrites the existing file (single fixed filename, code comment explains this)
- [ ] `hasLocalVoiceRecording` and `voiceRecordingDate` are stored in AsyncStorage
- [ ] If the file copy fails, the clone still succeeds and no error is shown to the user
- [ ] A `reCloneFromLocalRecording()` utility function exists in `client/utils/voiceReClone.ts`
- [ ] System re-clones send `X-Clone-Source: system-reclone` header
- [ ] Server validates `voiceId` is null before granting re-clone privileges (abuse prevention)
- [ ] Server skips `voiceClonesUsed` increment and `MAX_VOICE_CLONES` check for validated system re-clones
- [ ] Voice Settings screen shows clone status and local recording status
- [ ] Voice Settings verifies file existence on mount and reconciles stale AsyncStorage flags
- [ ] "Delete Recording" removes the file and clears AsyncStorage flags with user confirmation
- [ ] `VOICE_EXPIRED` alert offers "Restore Voice" option when a local recording exists
- [ ] Existing users with active clones but no local recording see a transitional prompt to re-record
- [ ] `voiceRotatedAt` field is added to the users table and set during rotation
- [ ] `voiceRotatedAt` is cleared when a new clone succeeds
- [ ] `voiceRotatedAt` is included in the user profile API response
- [ ] No voice audio is persisted on the server — multer temp file cleanup remains unchanged
- [ ] On web, no device storage logic runs (Platform.OS guard)
- [ ] Voice recording file backup exclusion has a documented TODO for development build migration
- [ ] Privacy Policy updated to cover on-device voice recording storage
- [ ] Background re-clone triggers automatically when app detects expired voice with local recording (Phase 3)
- [ ] Re-clone progress is shown non-intrusively and falls back gracefully on failure (Phase 3)
