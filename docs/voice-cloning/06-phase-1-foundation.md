# Phase 1: Foundation — Save Recording + Server-Side Re-Clone Support

> Build first. No user-facing changes. Zero risk to existing functionality.

---

## Goal

Lay the groundwork for voice restoration by:
1. Saving the raw voice recording to the user's device after every successful clone
2. Preparing the server to accept system-initiated re-clones without burning lifetime clone credits
3. Adding the `voiceRotatedAt` schema field for analytics and future client use
4. Updating the Privacy Policy to cover on-device voice storage

After Phase 1, recordings are silently being saved on every clone. The server is ready to accept re-clones. But nothing visible changes for users — no new UI, no new buttons, no behavior differences.

---

## Part 1A: Save Recording to Device

### Where to modify: `client/screens/VoiceSetupScreen.tsx`

After the voice clone succeeds (the `POST /api/voice-samples` response returns a `voiceId`), **before clearing the recording state**, copy the temp audio file to permanent device storage.

The recording URI is stored in the `recordingUri` state variable, which points to a temp/cache location from `recording.getURI()`. This file will be cleaned up by the OS — we need to copy it before that happens.

### Implementation Steps

```
1. Import LegacyFS (already available in the project as `expo-file-system/legacy`)

2. Define the permanent storage path:
   const VOICE_DIR = `${LegacyFS.documentDirectory}voice/`
   const VOICE_FILE = `${VOICE_DIR}my-voice-recording.m4a`

3. After a successful clone response, add:
   a. Ensure the directory exists: LegacyFS.makeDirectoryAsync(VOICE_DIR, { intermediates: true })
   b. Copy the file: LegacyFS.copyAsync({ from: recordingUri, to: VOICE_FILE })
   c. Store a flag: AsyncStorage.setItem('hasLocalVoiceRecording', 'true')
   d. Store the date: AsyncStorage.setItem('voiceRecordingDate', new Date().toISOString())

4. Wrap steps (a)-(d) in a try/catch. If ANY step fails:
   - Log a warning (console.warn)
   - Do NOT block the user or show an error — the clone succeeded, this is a background convenience feature
   - Set AsyncStorage 'hasLocalVoiceRecording' to 'false'
```

### Platform Guard

This must happen on the **native path only** (iOS/Android). On web, `documentDirectory` behavior is unreliable, and web users can re-record easily.

```typescript
if (Platform.OS !== 'web') {
  // ... file save logic
}
```

### Re-Recording Behavior

The file path is intentionally a single fixed name (`my-voice-recording.m4a`). If the user re-records and creates a new clone, the save logic runs again and overwrites the old file. This is correct — the stored file should always represent the most recent successful clone's recording, not a historical archive.

Add a code comment making this explicit:
```
// The stored file always represents the most recent successful clone.
// Re-recording intentionally overwrites the previous file.
```

### Backup Exclusion (Known Limitation)

Add this comment near the file save logic:

```
// KNOWN LIMITATION: expo-file-system does not support NSURLIsExcludedFromBackupKey (iOS)
// or Android backup exclusion rules within Expo Go. When migrating to a development build,
// implement backup exclusion via a config plugin or native module.
// For now, the file lives in documentDirectory which is app-private but may be included
// in device backups.
```

---

## Part 1B: Server-Side Re-Clone Support

### 1B-i: Support System Re-Clone Source (with abuse prevention)

**Where to modify:** `POST /api/voice-samples` handler in `server/routes.ts`

Check for the `X-Clone-Source: system-reclone` header. If present, **validate server-side** that the user's voice was actually rotated before granting re-clone privileges.

```
Add at the top of the handler:

let isSystemReClone = req.headers['x-clone-source'] === 'system-reclone';

// SECURITY: Validate system re-clone — only allow if user's voice was actually rotated
if (isSystemReClone) {
  const [currentUser] = await db
    .select({ voiceId: users.voiceId })
    .from(users)
    .where(eq(users.id, req.userId!));
  
  if (currentUser?.voiceId) {
    // User already has an active voice — treat as regular clone
    console.warn(`[Voice] User ${req.userId} attempted system re-clone with active voice. Treating as regular clone.`);
    isSystemReClone = false;
  }
}

Then in the success branch, change:
  voiceClonesUsed: (clonesUsed + 1)
to:
  voiceClonesUsed: isSystemReClone ? clonesUsed : (clonesUsed + 1)

And in the MAX_VOICE_CLONES check:
  if (!isSystemReClone && clonesUsed >= MAX_VOICE_CLONES) { ... }

Log system re-clones for analytics:
  if (isSystemReClone) {
    console.log(`[Voice] System re-clone for user ${req.userId}`);
  }
```

**Why the validation matters:** Without it, anyone with an auth token could send `X-Clone-Source: system-reclone` and bypass the 5-clone lifetime limit. By checking that `voiceId` is null, we ensure the header only works when the voice was genuinely rotated.

### 1B-ii: Add `voiceRotatedAt` Field to Schema

**Where to modify:** `shared/schema.ts` — `users` table definition

```
voiceRotatedAt: timestamp("voice_rotated_at")   // nullable, set when voice is rotated
```

Run migration: `npm run db:push` (or `npm run db:push --force` if needed)

This field should be:
- Set to `new Date()` when `rotateUserVoice()` runs
- Set to `null` when a new voice clone succeeds (both user-initiated and system re-clone)

### 1B-iii: Update Voice Rotation

**Where to modify:** `rotateUserVoice()` in `server/voice-rotation.ts`

Add `voiceRotatedAt: new Date()` to the update statement alongside the existing `hasVoiceSample: false` and `preferredVoiceType: "ai"` fields.

### 1B-iv: Clear `voiceRotatedAt` on Successful Clone

**Where to modify:** The success branch of `POST /api/voice-samples` in `server/routes.ts`

Add `voiceRotatedAt: null` to the user update that sets the new `voiceId`.

### 1B-v: Include `voiceRotatedAt` in User API Response

**Where to modify:** The user profile endpoint (likely `GET /api/user` or similar)

Ensure `voiceRotatedAt` is included in the response object so the client can access it.

---

## Part 1C: Privacy Policy Update

**Where to modify:** The Privacy Policy document (legal page or in-app text)

Add a statement covering on-device voice recording storage. Suggested wording:

> "When you create an Inner Voice clone, your voice recording may be stored locally on your device to enable automatic voice restoration if your clone expires due to inactivity. This recording is never uploaded to or stored on RETUNED servers — it remains exclusively on your device. You can delete this recording at any time from your Voice Settings."

This must be done before Phase 1 ships to maintain App Store compliance and user trust.

---

## What This Phase Does NOT Include

- No UI changes to Voice Settings or any other screen
- No re-clone utility function (Phase 2)
- No "Restore Voice" button (Phase 2)
- No migration prompt for existing users (Phase 2)
- No automatic background re-cloning (Phase 3)
- No changes to the ElevenLabs cloning API call
- No changes to TTS playback or audio caching

---

## Acceptance Criteria — Phase 1

- [ ] After a successful voice clone on iOS/Android, the raw m4a recording is copied to `${documentDirectory}voice/my-voice-recording.m4a`
- [ ] Re-recording overwrites the existing file (code comment explains this is intentional)
- [ ] `hasLocalVoiceRecording` and `voiceRecordingDate` are stored in AsyncStorage
- [ ] If the file copy fails, the clone still succeeds and no error is shown to the user
- [ ] On web, no device storage logic runs (Platform.OS guard)
- [ ] Backup exclusion limitation is documented with TODO comment in code
- [ ] Server accepts `X-Clone-Source: system-reclone` header
- [ ] Server validates `voiceId` is null before granting re-clone privileges
- [ ] System re-clones skip `voiceClonesUsed` increment and `MAX_VOICE_CLONES` check
- [ ] System re-clones are logged for analytics
- [ ] `voiceRotatedAt` field added to users table schema
- [ ] `voiceRotatedAt` is set during voice rotation
- [ ] `voiceRotatedAt` is cleared on successful clone
- [ ] `voiceRotatedAt` is included in user profile API response
- [ ] Privacy Policy updated to cover on-device voice recording storage
- [ ] No user-facing behavior changes
