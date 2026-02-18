# Pre-Implementation Questions: On-Device Voice Storage

The voice clone expiry notification system is now live — push tokens, daily expiry checks, keep-active endpoint, and tap-to-navigate are all working. The next step is storing the user's raw voice recording on-device so the app can re-clone automatically when a voice is rotated, without the user needing to re-record.

Before building this, I need you to investigate the codebase and answer the following questions. Do NOT start building anything until all questions are answered and confirmed.

-----

## 1. Recording Format & Flow

- What audio format does the current voice recording flow capture? (webm, m4a, wav, ogg, etc.)
- What library handles the microphone recording? (expo-av, expo-audio, react-native-audio-recorder-player, etc.)
- After the user finishes recording, where does the audio file sit on the device before upload? (temp directory, cache directory, in-memory blob, base64 string?)
- How is the recording sent to the server — multipart file upload, base64 encoded in a JSON body, or FormData?
- What is the approximate file size of a typical 1-3 minute voice recording in the current format?

## 2. Voice Cloning Endpoint & Server Handling

- What is the exact route and function that handles the voice clone request on the server?
- When the server receives the audio, does it write it to disk temporarily (e.g., `/uploads/` or `/tmp/`) before sending to ElevenLabs, or does it stream/pipe it directly?
- If it writes to disk, is the temp file cleaned up after the ElevenLabs call completes?
- After ElevenLabs returns a `voiceId`, show me the exact database fields that get updated on the user/voice record. Include the model/schema definition.

## 3. Voice Rotation & the New Notification System

- Now that the expiry notification system is in place, show me how `voiceRotatedAt` or equivalent is tracked when a voice is actually rotated (not warned, but deleted from ElevenLabs).
- When rotation happens, is the `voiceId` set to null, or is there a separate `voiceCloneActive` flag?
- Does the keep-active endpoint (`POST /api/voice/keep-active`) update a `lastActiveAt` timestamp? What field name is used?
- Is there currently any client-side check that detects a rotated voice (e.g., an API call that returns voice status, or does the app only find out when TTS playback fails)?

## 4. Lifetime Clone Counter

- Where is the lifetime clone count tracked? (field name, which table/model)
- What is the current max allowed?
- Does the counter increment on the client side, server side, or both?
- Is there already a `source` or `type` field on clone attempts that distinguishes user-initiated vs system-initiated clones?

## 5. Client-Side File System & Storage

- Is `expo-file-system` already installed and used in the project? If a different file system library is used, which one?
- Is `FileSystem.documentDirectory` used for anything else currently?
- What local key-value storage does the app use? (AsyncStorage, expo-secure-store, MMKV, zustand persisted store, etc.)
- Is there any existing logic for excluding files from iCloud or Google cloud backup? If not, does the app use `expo-file-system`'s `StorageAccessFramework` or any backup exclusion APIs?

## 6. Voice Settings Screen

- What is the file path to the voice/settings screen where the "keep active" notification navigates to?
- Is there an existing section in that screen that shows voice clone status (active, expiring, expired)?
- What UI component library is used? (custom components, React Native Paper, NativeBase, etc.)
- Is there already a "delete my voice" or "manage voice" option visible to the user?

-----

Once all questions are answered, share your findings before writing any code. We will confirm the approach together.
