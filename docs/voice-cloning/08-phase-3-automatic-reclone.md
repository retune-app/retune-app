# Phase 3: Automatic Background Re-Cloning

> Makes voice restoration seamless. The user never needs to think about voice expiry again.

---

## Goal

Automate the re-clone process so that when a user's voice is rotated, the app detects it and restores the voice in the background — no user action required. The user opens the app, and their personal voice "just works" again after a brief processing period.

After Phase 3, the full vision is realized: **record once, your voice persists forever** (as long as the app and recording remain on the device).

---

## Prerequisites

Phase 1 and Phase 2 must be complete:
- Recordings are being saved to device after successful clones
- Server accepts and validates `X-Clone-Source: system-reclone` header
- `reCloneFromLocalRecording()` utility function exists and is tested
- Voice Settings UI shows correct status states
- `voiceRotatedAt` field exists in the schema

---

## Part 3A: Detection — When to Trigger Re-Clone

### Trigger Points

The app should attempt automatic re-cloning when **all** of these conditions are met:
1. `Platform.OS !== 'web'` (native only)
2. User is authenticated
3. User's `voiceId` is `null` (voice was rotated or not set up)
4. `hasLocalVoiceRecording` is `true` in AsyncStorage
5. Local file actually exists (verified via `getInfoAsync`)
6. `voiceClonesUsed > 0` (user has cloned before — this distinguishes "rotated" from "never cloned")
7. No re-clone is already in progress
8. Device has network connectivity

### When to Check

Check these conditions at two points:

**1. App foreground / user profile fetch:**
When the user profile data is fetched (or refreshed via TanStack Query), inspect the `voiceId` field. If it's `null` and the local recording conditions are met, trigger the re-clone.

```
// In the user profile query's onSuccess or a useEffect watching user data:
if (!user.voiceId && user.voiceClonesUsed > 0) {
  attemptAutoReClone();
}
```

**2. VOICE_EXPIRED error from TTS:**
When a TTS call returns a `VOICE_EXPIRED` error, check for a local recording and trigger re-clone immediately rather than showing the alert. Only show the alert if re-clone fails or no recording exists.

### Debounce and Rate Limiting

- **Single attempt per app session**: If the auto re-clone fails once, don't retry until the next app session (app goes to background and returns to foreground). Store a session-level flag (not AsyncStorage — just a module-level variable).
- **Cooldown**: Don't attempt re-clone more than once per 5 minutes, even across navigations. Use a timestamp comparison.
- **No retry on specific failures**: If the server returns a 4xx error (not a network issue), don't retry. The failure is likely due to slot capacity or an unexpected state.

---

## Part 3B: Execution — The Re-Clone Flow

### State Machine

```
IDLE → CHECKING → CLONING → SUCCESS / FAILED

IDLE:      No re-clone activity. Default state.
CHECKING:  Verifying conditions (file exists, network available, no active voice).
CLONING:   Upload in progress. Takes 30-60 seconds.
SUCCESS:   Voice restored. Refresh user profile. Return to IDLE.
FAILED:    Clone failed. Log reason. Set session flag to prevent retry. Return to IDLE.
```

### Implementation

Create a new module: `client/utils/autoReClone.ts`

This module exports a single function:

```typescript
async function attemptAutoReClone(): Promise<void>
```

It manages its own internal state (module-level variables, not React state) so it can be called from multiple places without coordination:

```
Module-level state:
  let isInProgress = false;
  let lastAttemptTime = 0;
  let hasFailedThisSession = false;

Function flow:
  1. Guard: if isInProgress → return
  2. Guard: if hasFailedThisSession → return
  3. Guard: if (Date.now() - lastAttemptTime) < 300000 → return (5-minute cooldown)
  4. Guard: if Platform.OS === 'web' → return

  5. Set isInProgress = true, lastAttemptTime = Date.now()

  6. Check AsyncStorage 'hasLocalVoiceRecording'
     - If not 'true' → return (set isInProgress = false)

  7. Verify file exists via getInfoAsync
     - If not found → reconcile AsyncStorage, return

  8. Get auth token from auth context/storage

  9. Call reCloneFromLocalRecording(authToken)
     - On success:
       - Invalidate user profile query
       - Log: "[Voice] Auto re-clone succeeded"
       - isInProgress = false
     - On failure:
       - hasFailedThisSession = true
       - Log: "[Voice] Auto re-clone failed: ${reason}"
       - isInProgress = false
```

### Session Reset

When the app returns from background to foreground, reset `hasFailedThisSession = false` so the next session gets a fresh attempt. Use React Native's `AppState` listener:

```typescript
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    hasFailedThisSession = false;
  }
});
```

---

## Part 3C: User Experience During Auto Re-Clone

### Non-Intrusive Progress Indicator

While the re-clone is in progress (30-60 seconds), show a **subtle, non-blocking indicator**. Options:

**Option A — Toast/snackbar (recommended):**
A small bar at the top or bottom of the screen:
- During clone: "Restoring your Inner Voice..."
- On success: "Your Inner Voice is back!" (auto-dismiss after 3 seconds)
- On failure: silent (no notification — user can check Voice Settings)

**Option B — Voice Settings badge:**
If the user happens to be in Voice Settings during the re-clone, show a progress state:
- Spinner replacing the "Restore Voice" button
- Status text: "Restoring..."
- Disable the button until complete

Both options should be implemented. The toast is the primary indicator for users on any screen. The Voice Settings state is for users actively looking at their voice configuration.

### What Happens During the Wait

While the re-clone is processing:
- TTS playback uses AI stock voices (this is already the behavior when `voiceId` is null)
- The user can use the app normally — nothing is blocked
- If they play an affirmation, they hear a stock voice, not silence

### After Success

- The user profile query is invalidated, so the next fetch picks up the new `voiceId`
- Next time they play an affirmation, it uses their personal voice again
- Voice Settings automatically updates to show "Inner Voice: Active"
- No need to restart the app or navigate anywhere

### After Failure

- No error shown to the user (unless they're on the Voice Settings screen, where status updates)
- AI stock voices continue working
- Next app session, the auto re-clone tries again
- If it fails repeatedly, the user can manually tap "Restore Voice" in Voice Settings (Phase 2)

---

## Part 3D: Edge Cases

### 1. User clones a new voice while auto re-clone is in progress
- The auto re-clone should check for `isInProgress` before starting
- If a manual clone succeeds while auto re-clone is running, the auto re-clone's success/failure is irrelevant — the manual clone's voiceId wins
- On auto re-clone completion, re-check if `voiceId` is still null before celebrating

### 2. Multiple devices (future consideration)
- On-device storage is per-device. If a user has the app on two phones, only the phone where they recorded has the backup
- Auto re-clone on device B would fail silently (no file), which is correct behavior
- This is a known limitation, not a bug

### 3. ElevenLabs slot capacity
- If all 30 voice slots are full, the re-clone will fail with a server error
- The auto re-clone treats this as a regular failure (retry next session)
- Voice rotation should have freed up a slot, but there could be temporary contention
- Server logs the failure for monitoring

### 4. Network unavailable
- Check network status before attempting
- If offline, skip and wait for next trigger point
- Don't set `hasFailedThisSession` for network failures (it's not a permanent failure)

### 5. Recording file corrupted
- ElevenLabs will reject the file and return an error
- Treat as clone failure
- Don't delete the file — it might work on retry (ElevenLabs could have been having issues)
- If it fails 3+ times across sessions, consider adding a flag to stop retrying with that specific file

---

## What This Phase Does NOT Include

- No background task execution (app must be in foreground)
- No changes to the ElevenLabs cloning API call
- No changes to TTS playback or audio caching
- No changes to voice rotation schedule or notification timing
- No server-side changes (Phase 1 and 2 covered all server work)
- No cross-device sync of recordings

---

## Future Considerations (Beyond Phase 3)

These are explicitly out of scope but worth noting for future planning:

1. **Background re-clone via expo-background-fetch**: Attempt re-clone when the app is in the background. Requires careful battery and data usage consideration.
2. **Proactive re-clone before expiry**: If the voice is approaching 60 days of inactivity, proactively "use" the voice (via keep-active endpoint) or pre-emptively re-clone. This could make rotation even rarer.
3. **Recording quality check**: Before saving, verify the file meets ElevenLabs' minimum quality standards (duration, format, not silent). This could prevent saving recordings that would fail on re-clone.
4. **Cross-device recording sync**: Optional encrypted backup to user's own cloud storage. Major privacy and engineering effort — only if users demand it.

---

## Acceptance Criteria — Phase 3

- [ ] App automatically detects when voice is expired and local recording exists
- [ ] Auto re-clone triggers on user profile fetch when conditions are met
- [ ] Auto re-clone triggers on VOICE_EXPIRED TTS error when conditions are met
- [ ] Single attempt per app session (no infinite retry loops)
- [ ] 5-minute cooldown between attempts
- [ ] No retry on 4xx server errors within the same session
- [ ] Session failure flag resets when app returns to foreground
- [ ] Non-intrusive progress indicator (toast/snackbar) during re-clone
- [ ] Success notification auto-dismisses after 3 seconds
- [ ] Failure is silent to the user (logged for debugging)
- [ ] User profile query invalidated on success to refresh voice status
- [ ] TTS continues with stock voices during re-clone (existing behavior)
- [ ] Network availability checked before attempting
- [ ] Network failures don't set the session failure flag
- [ ] Concurrent clone attempts prevented (isInProgress guard)
- [ ] No UI blocking — app remains fully usable during re-clone
- [ ] Voice Settings reflects real-time status during auto re-clone
