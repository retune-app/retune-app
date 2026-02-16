# Codebase Investigation: On-Device Voice Storage

> Investigated: February 2026

## 1. Recording Format & Flow

- **Audio format**: On native (iOS/Android), `expo-av` records using `Audio.RecordingOptionsPresets.HIGH_QUALITY`, which produces **m4a** (AAC). On web, the browser captures **webm**.
- **Recording library**: `expo-av` (`Audio.Recording`), imported from `expo-av` in `client/screens/VoiceSetupScreen.tsx`.
- **Where the file sits after recording**: The `recording.getURI()` call returns a **temp file URI** on the device's temp/cache directory (the default location expo-av uses). It is stored in `recordingUri` state. No manual file copy is made — the URI points to wherever the OS placed it.
- **How it's sent to the server**: **FormData** (multipart upload).
  - **Native**: `formData.append("audio", { uri, type: "audio/m4a", name: "voice-sample.m4a" })` — React Native's FormData convention.
  - **Web**: `fetch(uri)` to get a blob, then `formData.append("audio", blob, "voice-sample.webm")`.
  - Sent via `POST /api/voice-samples` with a 180-second timeout.
- **Approximate file size**: `HIGH_QUALITY` preset records at ~128kbps AAC. A **1-minute recording is ~1 MB**, a **3-minute recording is ~3 MB**. The server's multer config allows up to **50 MB**.

## 2. Voice Cloning Endpoint & Server Handling

- **Route**: `POST /api/voice-samples` in `server/routes.ts` (line 1457). Requires auth + rate limiter (`voiceCloneLimiter`).
- **Server disk handling**: Yes, **multer writes to disk** in the `uploads/` directory (`const uploadDir = path.join(process.cwd(), "uploads")`). Filenames follow the pattern `voice-<timestamp>-<random>.m4a`.
- **Cleanup**: Yes — `fs.unlink(file.path, ...)` is called in **both** the success and failure branches. The file is deleted immediately after the ElevenLabs `cloneVoice()` call completes (or fails).
- **Database fields updated on success** (from `shared/schema.ts`):

  **`voiceSamples` table:**
  | Field | Value |
  |-------|-------|
  | `voiceId` | ElevenLabs voice ID |
  | `status` | `"ready"` |
  | `audioUrl` | `null` (cleared for privacy) |

  **`users` table:**
  | Field | Value |
  |-------|-------|
  | `voiceId` | ElevenLabs voice ID |
  | `hasVoiceSample` | `true` |
  | `preferredVoiceType` | `"personal"` |
  | `voiceClonesUsed` | Incremented by 1 |

## 3. Voice Rotation & the Notification System

- **When rotation happens** (in `rotateUserVoice()` in `server/voice-rotation.ts`):
  1. Calls `deleteVoice(voiceId)` on ElevenLabs.
  2. Updates the `users` table:
     - `voiceId` → **`null`**
     - `hasVoiceSample` → **`false`**
     - `preferredVoiceType` → **`"ai"`** (falls back to AI voice)
     - `voiceLastUsedAt` → **`null`**
  3. Updates `voiceSamples` table: `status` → **`"rotated"`**

- **No separate `voiceCloneActive` flag** — the presence/absence of `voiceId` (null vs. a value) is the sole indicator.

- **`POST /api/voice/keep-active`** updates:
  - `voiceLastUsedAt` → **`new Date()`** (current timestamp)
  - `voiceExpiryWarningAt` → **`null`** (clears the warning flag)

- **Client-side voice expiry detection**: There is **one explicit check** — in `VoiceSettingsScreen.tsx`, when previewing the personal voice (`handlePersonalVoicePreview`), the response is checked for `error === "VOICE_EXPIRED"` or status `422`. If detected, an alert offers "Re-record" which navigates to `VoiceSetup`. Beyond that, the app discovers a rotated voice reactively when TTS playback fails (the server returns `VOICE_EXPIRED` errors at lines 763 and 823 in routes.ts).

## 4. Lifetime Clone Counter

- **Field**: `voiceClonesUsed` (integer) on the `users` table (`shared/schema.ts` line 24).
- **Current max**: **5** (`MAX_VOICE_CLONES = 5` at line 1455 of routes.ts). The schema comment says "Max 2" but the actual code enforces 5.
- **Where it increments**: **Server-side only**, inside the `POST /api/voice-samples` handler: `voiceClonesUsed: (clonesUsed + 1)`.
- **No `source` or `type` field** on clone attempts. There is no distinction between user-initiated and system-initiated clones. The `voiceSamples.status` field tracks states (`pending`, `processing`, `ready`, `failed`, `rotated`) but not the clone source/trigger.

## 5. Client-Side File System & Storage

- **`expo-file-system`**: Yes, already installed and used. Imported as `import * as LegacyFS from 'expo-file-system/legacy'` in `client/contexts/AudioContext.tsx`.
- **`cacheDirectory` usage**: Used for **audio caching** — affirmation audio files are downloaded to `${LegacyFS.cacheDirectory}audio/` for offline playback. `documentDirectory` is **not currently used** anywhere in the client.
- **Key-value storage**:
  - `AsyncStorage` (`@react-native-async-storage/async-storage`) — used across many screens for preferences, onboarding state, breathing settings, etc.
  - `SecureStore` (`expo-secure-store`) — used in `AuthContext.tsx` for storing auth tokens on native (iOS/Android), with `AsyncStorage` as the web fallback.
- **Backup exclusion**: No existing logic for excluding files from iCloud/Google backup. No use of `StorageAccessFramework` or any backup exclusion APIs.

## 6. Voice Settings Screen

- **File path**: `client/screens/VoiceSettingsScreen.tsx`
- **Voice clone status display**: There is **no explicit status section** showing "active / expiring / expired." The screen shows:
  - A "Record Inner Voice" / "Re-record Inner Voice" button (contextual based on `hasPersonalVoice`)
  - A personal/AI voice toggle
  - A personal voice preview button (which can surface `VOICE_EXPIRED` alerts reactively)
  - No proactive status indicator or expiry countdown
- **UI component library**: **Custom components** throughout — `ThemedText`, `ThemedView`, `Card`, `Button`, `GoldShimmer`, plus standard React Native primitives (`Pressable`, `View`, `ScrollView`). No third-party UI library (no Paper, NativeBase, etc.).
- **Delete/manage voice option**: There is no "delete my voice" button visible on this screen. Voice deletion is handled elsewhere (account deletion flow at `POST /api/user/delete-data`, lines 4480-4499 of routes.ts).

---

## Key Implications for On-Device Voice Storage

1. **Storage location**: `documentDirectory` is available and unused — ideal for persistent voice recording storage (survives app updates, unlike `cacheDirectory`).
2. **File format**: m4a on native, webm on web. On-device storage only matters for native (iOS/Android), so we only need to handle m4a.
3. **File size**: ~1-3 MB for typical recordings — negligible storage impact.
4. **Clone counter**: Need to decide whether auto-re-clones should count against the lifetime limit (currently no `source` field to distinguish).
5. **Backup exclusion**: Should be implemented to prevent voice recordings from syncing to iCloud/Google Drive.
6. **No existing expiry UI**: The voice settings screen would benefit from a status indicator before implementing auto-re-clone.
