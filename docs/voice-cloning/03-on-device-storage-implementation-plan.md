# Task: On-Device Voice Recording Storage for Re-Cloning

## Context

RETUNED uses ElevenLabs Instant Voice Cloning to create personal "Inner Voice" clones. The user records 1-3 minutes of speech in `VoiceSetupScreen.tsx` using `expo-av`, which produces an **m4a file (~1-3 MB)**. This file is uploaded via FormData to `POST /api/voice-samples`, where multer writes it to disk temporarily, forwards it to ElevenLabs, then **deletes the file immediately**. The raw recording is never persisted anywhere.

We need to **save the raw voice recording to the user's device** before it gets uploaded and discarded, so the app can re-clone automatically if the voice is rotated — without the user needing to re-record and without storing voice data on our servers.

**Privacy principle: The user's raw voice recording is NEVER stored on RETUNED servers. It lives exclusively on the user's device.**

-----

## Prerequisites

The following are already implemented and working:

- Voice clone expiry notifications (push tokens, 53-day and 58-day warnings)
- `POST /api/voice/keep-active` endpoint (resets `voiceLastUsedAt`, clears `voiceExpiryWarningAt`)
- Voice rotation via `rotateUserVoice()` in `server/voice-rotation.ts`
- `VOICE_EXPIRED` error detection in `VoiceSettingsScreen.tsx` and routes.ts

-----

## Part 1: Save Recording to Device After Successful Clone

### Where to modify: `client/screens/VoiceSetupScreen.tsx`

After the voice clone succeeds (the `POST /api/voice-samples` response returns a `voiceId`), **before clearing the recording state**, copy the temp audio file to permanent device storage.

The recording URI is stored in the `recordingUri` state variable, which points to a temp/cache location from `recording.getURI()`. This file will be cleaned up by the OS — we need to copy it before that happens.

```
Implementation steps:

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

**Important:** This must happen on the **native path only** (iOS/Android). On web, `documentDirectory` behavior is unreliable, and web users can re-record easily. Guard with a `Platform.OS !== 'web'` check.

### Backup exclusion

After saving the file, prevent it from being backed up to iCloud or Google Drive. Users expect "your voice stays on this device" to mean exactly that.

```
For iOS: Use LegacyFS's options or the native module to set the NSURLIsExcludedFromBackupKey flag.
         If expo-file-system does not support this directly, add a TODO comment noting this needs
         a native module or config plugin to implement properly.

For Android: Files in documentDirectory are app-private and not backed up by default unless the
             app has opted into Auto Backup. Check if android:allowBackup is set in app.json/AndroidManifest.
             If it is "true", add a backup exclusion rule for the voice/ directory.
```

-----

## Part 2: Re-Clone Utility Function (Client-Side)

### Where to create: New file `client/utils/voiceReClone.ts`

Create a utility function that uploads the locally stored recording to the existing clone endpoint:

```
async function reCloneFromLocalRecording(authToken: string): Promise<{ success: boolean; reason?: string }>

Flow:
1. Check if file exists: LegacyFS.getInfoAsync(VOICE_FILE)
   - If not found → return { success: false, reason: 'no_local_recording' }

2. Build FormData exactly as VoiceSetupScreen does for native:
   formData.append("audio", { uri: VOICE_FILE, type: "audio/m4a", name: "voice-sample.m4a" })

3. Add a custom header or query param to indicate this is a system re-clone:
   X-Clone-Source: "system-reclone"
   (This tells the server not to increment voiceClonesUsed — see Part 4)

4. POST to /api/voice-samples with the same auth token and 180-second timeout

5. On success → return { success: true }
6. On failure → return { success: false, reason: 'clone_failed' }
```

**Do NOT wire this function to any UI or automatic trigger yet.** Add this comment at the top of the file:

```
// TODO: Wire up to automatic re-clone trigger.
// This function should be called when:
// 1. The app detects voiceId is null but hasLocalVoiceRecording is true
// 2. A TTS call returns VOICE_EXPIRED and a local recording exists
// 3. The user taps "Restore Voice" in Voice Settings
```

-----

## Part 3: Voice Settings Screen Updates

### Where to modify: `client/screens/VoiceSettingsScreen.tsx`

Add a voice status section and local recording management using the existing custom component library (ThemedText, ThemedView, Card, Button, etc.).

### 3a. Voice Clone Status Indicator

Add a new section above the existing voice toggle that shows the current state:

```
States to display:

- voiceId exists + hasLocalVoiceRecording true:
  "Inner Voice: Active"
  "Voice recording stored on this device"
  [Delete Recording] button

- voiceId exists + hasLocalVoiceRecording false:
  "Inner Voice: Active"
  "No local backup — if your voice expires, you'll need to re-record"

- voiceId is null + hasLocalVoiceRecording true:
  "Inner Voice: Expired"
  "Voice recording available on this device"
  [Restore Voice] button  ← calls reCloneFromLocalRecording() (wire up later)
  [Delete Recording] button

- voiceId is null + hasLocalVoiceRecording false:
  "Inner Voice: Not Set Up"
  [Record Inner Voice] button (already exists)
```

### 3b. Delete Recording Action

When the user taps "Delete Recording":

1. Show a confirmation alert: "This will permanently delete your voice recording from this device. If your voice clone expires, you'll need to re-record. Delete?"
1. On confirm:
- Delete the file: `LegacyFS.deleteAsync(VOICE_FILE, { idempotent: true })`
- Set `AsyncStorage 'hasLocalVoiceRecording'` to `'false'`
- Remove `AsyncStorage 'voiceRecordingDate'`
- Update the UI state

### 3c. Update the VOICE_EXPIRED Handler

The existing `handlePersonalVoicePreview` function catches `VOICE_EXPIRED` errors and shows an alert offering "Re-record". Update this alert to be smarter:

```
If hasLocalVoiceRecording is true:
  Alert: "Your voice clone has expired. You can restore it automatically from your saved recording."
  Buttons: [Restore Voice] [Re-record] [Cancel]
  - "Restore Voice" calls reCloneFromLocalRecording() — wire up only when Part 2 is connected
  - "Re-record" navigates to VoiceSetup as before

If hasLocalVoiceRecording is false:
  Alert: "Your voice clone has expired. You'll need to re-record your voice."
  Buttons: [Re-record] [Cancel]
  (This is the existing behavior, no change needed)
```

-----

## Part 4: Server-Side Changes

### 4a. Support System Re-Clone Source

**Where to modify:** `POST /api/voice-samples` handler in `server/routes.ts` (line 1457)

Check for the `X-Clone-Source: system-reclone` header. If present:

- **Do NOT increment `voiceClonesUsed`** — this is a system-initiated restoration, not a new user clone
- **Do NOT check against `MAX_VOICE_CLONES`** — a re-clone should always be allowed regardless of lifetime count
- Log the event as a system re-clone for analytics

```
Add at the top of the handler:

const isSystemReClone = req.headers['x-clone-source'] === 'system-reclone';

Then in the success branch, change:
  voiceClonesUsed: (clonesUsed + 1)
to:
  voiceClonesUsed: isSystemReClone ? clonesUsed : (clonesUsed + 1)

And in the MAX_VOICE_CLONES check at the top:
  if (!isSystemReClone && clonesUsed >= MAX_VOICE_CLONES) { ... }
```

### 4b. Update Voice Rotation to Preserve Recovery Path

**Where to modify:** `rotateUserVoice()` in `server/voice-rotation.ts`

Currently, rotation sets `hasVoiceSample` to `false`. Change this:

```
Before (current):
  hasVoiceSample: false
  preferredVoiceType: "ai"

After (new):
  hasVoiceSample: false
  preferredVoiceType: "ai"
  voiceRotatedAt: new Date()    ← ADD this new field (see 4c)
```

The `preferredVoiceType` fallback to "ai" is correct — the user should hear AI voices until re-clone succeeds. But we need `voiceRotatedAt` so the client knows a rotation happened (vs. the user never having cloned).

### 4c. Add `voiceRotatedAt` Field to Schema

**Where to modify:** `shared/schema.ts` — `users` table definition

Add:

```
voiceRotatedAt: timestamp("voice_rotated_at")   // nullable, set when voice is rotated
```

Run the appropriate migration (drizzle-kit push or generate + migrate, depending on the project's migration workflow).

This field should be:

- Set to `new Date()` when `rotateUserVoice()` runs
- Set to `null` when a new voice clone succeeds (both user-initiated and system re-clone)

### 4d. Include `voiceRotatedAt` in User API Responses

Whatever endpoint the client uses to fetch the current user profile (likely `GET /api/user` or similar), ensure `voiceRotatedAt` is included in the response. The client needs this to show the correct status in Voice Settings.

-----

## What NOT to Change

- Do not modify the ElevenLabs cloning API call — same `cloneVoice()` function, same parameters
- Do not change TTS playback or audio caching logic (`generateAudio` function)
- Do not change the voice rotation schedule, thresholds, or notification timing
- Do not change the `voiceSamples` table schema beyond what's specified
- Do not store any voice audio on the server or in object storage — the temp file written by multer must still be deleted after the ElevenLabs call as it is today
- Do not build automatic re-clone triggering — only build the utility function and "Restore Voice" UI button. Automatic background re-cloning is a separate future task
- Do not transcode or compress the m4a file — store it as-is

-----

## Acceptance Criteria

- [ ] After a successful voice clone on iOS/Android, the raw m4a recording is copied to `${documentDirectory}voice/my-voice-recording.m4a`
- [ ] `hasLocalVoiceRecording` and `voiceRecordingDate` are stored in AsyncStorage
- [ ] If the file copy fails, the clone still succeeds and no error is shown to the user
- [ ] A `reCloneFromLocalRecording()` utility function exists in `client/utils/voiceReClone.ts`
- [ ] System re-clones send `X-Clone-Source: system-reclone` header
- [ ] Server skips `voiceClonesUsed` increment and `MAX_VOICE_CLONES` check for system re-clones
- [ ] Voice Settings screen shows clone status and local recording status
- [ ] "Delete Recording" removes the file and clears AsyncStorage flags with user confirmation
- [ ] `VOICE_EXPIRED` alert offers "Restore Voice" option when a local recording exists
- [ ] `voiceRotatedAt` field is added to the users table and set during rotation
- [ ] `voiceRotatedAt` is cleared when a new clone succeeds
- [ ] `voiceRotatedAt` is included in the user profile API response
- [ ] No voice audio is persisted on the server — multer temp file cleanup remains unchanged
- [ ] On web, no device storage logic runs (Platform.OS guard)
- [ ] Voice recording file is excluded from iCloud/Google backup (or TODO added if native module needed)
