# Phase 2: User-Facing Restore — Re-Clone Utility + Voice Settings UI + Migration Prompt

> Surfaces the on-device recording to users. Adds manual voice restoration and recording management.

---

## Goal

Build the user-facing layer on top of Phase 1's foundation:
1. Create a re-clone utility function that uploads the local recording to the existing clone endpoint
2. Update Voice Settings to show clone status, local recording status, and management actions
3. Add a transitional migration prompt for existing users who cloned before Phase 1 shipped
4. Make the VOICE_EXPIRED alert smarter — offer "Restore Voice" when a local recording exists

After Phase 2, users can see their voice status, manually restore an expired voice from their saved recording, delete their local recording, and existing users are nudged to re-record once for future protection.

---

## Prerequisites

Phase 1 must be complete:
- Recordings are being saved to device after successful clones
- Server accepts and validates `X-Clone-Source: system-reclone` header
- `voiceRotatedAt` field exists in the schema

---

## Part 2A: Re-Clone Utility Function

### Where to create: `client/utils/voiceReClone.ts`

Create a utility function that uploads the locally stored recording to the existing clone endpoint.

```typescript
// TODO: Wire up to automatic re-clone trigger (Phase 3).
// This function should be called when:
// 1. The user taps "Restore Voice" in Voice Settings
// 2. A TTS call returns VOICE_EXPIRED and a local recording exists
// 3. (Phase 3) The app detects voiceId is null but hasLocalVoiceRecording is true

async function reCloneFromLocalRecording(
  authToken: string
): Promise<{ success: boolean; reason?: string }>
```

### Flow

```
1. Check if file exists: LegacyFS.getInfoAsync(VOICE_FILE)
   - If not found → return { success: false, reason: 'no_local_recording' }

2. Build FormData exactly as VoiceSetupScreen does for native:
   formData.append("audio", { uri: VOICE_FILE, type: "audio/m4a", name: "voice-sample.m4a" })

3. Add the system re-clone header:
   X-Clone-Source: "system-reclone"

4. POST to /api/voice-samples with the same auth token and 180-second timeout

5. On success → return { success: true }
6. On failure → return { success: false, reason: 'clone_failed' }
```

### Error Handling

- If the file doesn't exist, reconcile AsyncStorage (`hasLocalVoiceRecording` → `false`) before returning
- If the clone API returns an error, return the reason but don't crash
- If the clone API returns `VOICE_EXPIRED` or another voice-specific error, surface the reason string

---

## Part 2B: Voice Settings Screen Updates

### Where to modify: `client/screens/VoiceSettingsScreen.tsx`

### 2B-i: File Existence Verification on Mount

Before rendering status, verify the local recording actually exists. The AsyncStorage flag could be stale.

```typescript
useEffect(() => {
  if (Platform.OS !== 'web') {
    LegacyFS.getInfoAsync(VOICE_FILE).then(info => {
      if (!info.exists) {
        AsyncStorage.setItem('hasLocalVoiceRecording', 'false');
        AsyncStorage.removeItem('voiceRecordingDate');
        setHasLocalRecording(false);
      }
    }).catch(() => {});
  }
}, []);
```

### 2B-ii: Voice Clone Status Indicator

Add a new section above the existing voice toggle. Use existing components (ThemedText, ThemedView, Card, etc.).

**States to display:**

| voiceId | hasLocalRecording | Status | Message | Actions |
|---------|-------------------|--------|---------|---------|
| exists | true | Active | "Inner Voice: Active" / "Voice recording stored on this device" | [Delete Recording] |
| exists | false | Active (unprotected) | "Inner Voice: Active" / "No local backup — if your voice expires, you'll need to re-record" | — |
| null | true | Expired (recoverable) | "Inner Voice: Expired" / "Voice recording available on this device" | [Restore Voice] [Delete Recording] |
| null | false | Not set up | "Inner Voice: Not Set Up" | [Record Inner Voice] (existing) |

### 2B-iii: Delete Recording Action

When the user taps "Delete Recording":

1. Show confirmation: "This will permanently delete your voice recording from this device. If your voice clone expires, you'll need to re-record. Delete?"
2. On confirm:
   - `LegacyFS.deleteAsync(VOICE_FILE, { idempotent: true })`
   - `AsyncStorage.setItem('hasLocalVoiceRecording', 'false')`
   - `AsyncStorage.removeItem('voiceRecordingDate')`
   - Update UI state

### 2B-iv: Restore Voice Action

When the user taps "Restore Voice":

1. Show a loading indicator (restoring takes 30-60 seconds)
2. Call `reCloneFromLocalRecording()` with the user's auth token
3. On success:
   - Invalidate the user profile query to refresh voice status
   - Show a brief success message
4. On failure:
   - If `reason === 'no_local_recording'`: Show "Recording not found — you'll need to re-record"
   - If `reason === 'clone_failed'`: Show "Couldn't restore your voice right now. Try again later or re-record."

### 2B-v: Update the VOICE_EXPIRED Handler

The existing `handlePersonalVoicePreview` function catches `VOICE_EXPIRED` errors. Update the alert:

```
If hasLocalVoiceRecording is true:
  Title: "Voice Clone Expired"
  Message: "Your voice clone has expired. You can restore it automatically from your saved recording."
  Buttons:
    [Restore Voice] → calls reCloneFromLocalRecording()
    [Re-record] → navigates to VoiceSetup as before
    [Cancel]

If hasLocalVoiceRecording is false:
  Title: "Voice Clone Expired"
  Message: "Your voice clone has expired. You'll need to re-record your voice."
  Buttons:
    [Re-record] → navigates to VoiceSetup as before
    [Cancel]
  (This is the existing behavior, no change needed)
```

---

## Part 2C: Transitional Migration Prompt for Existing Users

### The Problem

Users who cloned their voice before Phase 1 shipped have no local recording — the raw audio was deleted immediately after cloning, as it always has been. ElevenLabs does not provide an API to retrieve the original source recording from a cloned voice. So there is nothing to migrate.

These users are currently unprotected: if their voice rotates, they must re-record from scratch.

### The Solution

Add a **contextual, non-intrusive prompt** in the Voice Settings screen for users who meet these criteria:
- `voiceId` exists (they have an active clone)
- `hasLocalVoiceRecording` is `false` (no local backup)
- `voiceClonesUsed > 0` (they've cloned before — not a new user)
- `Platform.OS !== 'web'`

### What to Show

Display a card/banner within the Voice Settings screen (not a popup or system alert):

```
Title: "Protect Your Inner Voice"
Message: "We've added a new feature that automatically restores your voice if it expires. 
          Re-record once to enable this protection."
Action: [Re-record to Protect] → navigates to VoiceSetupScreen
Dismiss: [Not Now] → dismisses for this session
```

### Dismissal Behavior

- "Not Now" dismisses the prompt for the current session only (no AsyncStorage flag needed)
- The prompt reappears on the next visit to Voice Settings
- The prompt disappears permanently once either:
  - The user re-records (which triggers Phase 1's save logic, setting `hasLocalVoiceRecording` to `true`)
  - The user's voice expires and they fall into the "Expired" state instead

### Why Not a Push Notification or Modal?

- **Push notification**: Too aggressive for a feature the user didn't ask for. And we'd need to track who received it server-side.
- **Modal/popup**: Disruptive. Users opening Voice Settings have a specific intent — don't block them.
- **In-screen banner**: Visible but not blocking. The user sees it when they're already in the context of managing their voice. They can act on it or ignore it naturally.

---

## What This Phase Does NOT Include

- No automatic background re-cloning (Phase 3)
- No re-clone on app startup or VOICE_EXPIRED detection without user action (Phase 3)
- No changes to the ElevenLabs cloning API call
- No changes to TTS playback or audio caching
- No changes to voice rotation schedule or notification timing

---

## Acceptance Criteria — Phase 2

- [ ] `reCloneFromLocalRecording()` utility function exists in `client/utils/voiceReClone.ts`
- [ ] Function checks file existence before attempting re-clone
- [ ] Function reconciles AsyncStorage if file is missing
- [ ] Function sends `X-Clone-Source: system-reclone` header
- [ ] Function returns structured result (`success`, `reason`)
- [ ] Voice Settings shows correct status for all 4 voice states
- [ ] Voice Settings verifies file existence on mount and reconciles stale flags
- [ ] "Delete Recording" prompts for confirmation before deleting
- [ ] "Delete Recording" removes file and clears AsyncStorage
- [ ] "Restore Voice" button calls `reCloneFromLocalRecording()` with loading state
- [ ] "Restore Voice" handles success and failure gracefully
- [ ] VOICE_EXPIRED alert offers "Restore Voice" when local recording exists
- [ ] VOICE_EXPIRED alert falls back to existing "Re-record" behavior when no recording exists
- [ ] Migration banner appears for existing users with active clone but no local recording
- [ ] Migration banner navigates to VoiceSetupScreen on tap
- [ ] Migration banner dismisses for the session on "Not Now"
- [ ] Migration banner disappears permanently after re-recording
- [ ] Migration banner only appears on native (Platform.OS guard)
