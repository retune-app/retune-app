# Critical Review: On-Device Voice Storage Plan

> Reviewed: February 2026

## What's Solid

- **Privacy-first approach** is exactly right — raw voice stays on-device only, server temp file cleanup unchanged.
- **Non-blocking save** — wrapping the file copy in try/catch so a failed save doesn't ruin a successful clone is the correct call.
- **`X-Clone-Source` header for system re-clones** — clean separation. Skipping the lifetime counter and max check for re-clones is essential, otherwise users would burn through their 5 clones just from rotations.
- **Not wiring up automatic re-clone yet** — smart. Building the utility function and "Restore Voice" button first lets you validate the flow manually before adding background automation.
- **Platform guard** — web exclusion is correct. `documentDirectory` on web is unreliable and web users can re-record trivially.

---

## Issues & Recommendations

### 1. CRITICAL: `X-Clone-Source` header is trivially spoofable

Anyone with an auth token can send `X-Clone-Source: system-reclone` and bypass the lifetime clone limit entirely. A user could clone unlimited voices by replaying the request with that header.

**Recommendation**: Don't trust the header blindly. Add server-side validation: when `X-Clone-Source: system-reclone` is received, verify that the user's `voiceId` is currently `null` (meaning their voice was actually rotated). If they already have an active voice, reject the re-clone or treat it as a regular user-initiated clone. This way even if someone spoofs the header, they can only re-clone after an actual rotation — which is the intended behavior anyway.

### 2. Single file name (`my-voice-recording.m4a`) — intentional but document it

If the user re-records (makes a new clone), the old file gets silently overwritten. This is actually the correct behavior — the stored file should always represent the **most recent successful clone's recording**, not a historical archive. Add a comment in the code making this explicit so future devs don't wonder.

### 3. `voiceRotatedAt` field — useful but not strictly required for client UI

The plan says the client needs `voiceRotatedAt` to distinguish "voice was rotated" from "user never cloned." But the client can already determine this from local state:

- `voiceId === null && hasLocalVoiceRecording === true` → was rotated (recording exists from a prior clone)
- `voiceId === null && hasLocalVoiceRecording === false && voiceClonesUsed > 0` → was rotated but recording deleted
- `voiceId === null && voiceClonesUsed === 0` → never cloned

Adding `voiceRotatedAt` is still valuable for **server-side analytics and push notification logic**, so keep it — but the client-side status display doesn't hard-depend on it. This is worth noting so we don't treat it as a blocker.

### 4. Don't over-engineer clone source tracking

The plan notes there's no `source` field to distinguish user vs system clones. Rather than adding a whole new column, a simple server log line (`console.log("[Voice] System re-clone for user ${userId}")`) is sufficient for now. Don't add schema complexity until analytics actually demand it.

### 5. Backup exclusion — be upfront about the Expo Go limitation

`expo-file-system` does **not** expose `NSURLIsExcludedFromBackupKey` on iOS or Android backup exclusion rules. Since we're running in Expo Go (no custom native modules), backup exclusion **cannot be implemented right now**. The plan hedges with "add a TODO if native module needed" — instead, make this an explicit known limitation in the code comments. It gets solved when/if we move to a development build.

### 6. Verify file existence on Voice Settings mount

There's a potential sync issue: the AsyncStorage flag says `'true'` but the file was deleted by the OS (storage pressure, user cleared app data, etc.). The `reCloneFromLocalRecording()` function correctly checks `getInfoAsync()` first — good. But the **Voice Settings screen** should also verify the file exists on mount rather than relying solely on the AsyncStorage flag. Otherwise it could show "Voice recording stored on this device" when the file is gone.

**Recommendation**: On Voice Settings screen mount, do a quick `getInfoAsync()` check and reconcile the AsyncStorage flag if the file is missing.

### 7. Re-recording flow is implicitly handled — add a note

When a user taps "Re-record Inner Voice" and makes a new clone, the save logic runs again after the successful clone, overwriting the old file. The `voiceRecordingDate` also gets updated. This is correct behavior but should be documented in a code comment for clarity.

---

## Proposed Amendments to the Plan

Based on the review, here are the specific changes to incorporate:

### Amendment to Part 4a (Server-Side Re-Clone Validation)

Replace the simple header check with a validated check:

```
const isSystemReClone = req.headers['x-clone-source'] === 'system-reclone';

// Validate system re-clone: only allow if user's voice was actually rotated
if (isSystemReClone) {
  const [currentUser] = await db
    .select({ voiceId: users.voiceId })
    .from(users)
    .where(eq(users.id, req.userId!));
  
  if (currentUser?.voiceId) {
    // User already has an active voice — treat as regular clone
    console.warn(`[Voice] User ${req.userId} attempted system re-clone with active voice. Treating as regular clone.`);
    isSystemReClone = false; // Downgrade to regular clone
  }
}
```

This prevents abuse while preserving the intended flow.

### Amendment to Part 3a (Voice Settings File Verification)

Add an `onMount` check:

```
useEffect(() => {
  if (Platform.OS !== 'web') {
    LegacyFS.getInfoAsync(VOICE_FILE).then(info => {
      if (!info.exists) {
        // File was deleted by OS or user — reconcile AsyncStorage
        AsyncStorage.setItem('hasLocalVoiceRecording', 'false');
        AsyncStorage.removeItem('voiceRecordingDate');
        setHasLocalRecording(false);
      }
    }).catch(() => {});
  }
}, []);
```

### Amendment to Backup Exclusion

Replace the conditional TODO with a definitive statement:

```
// KNOWN LIMITATION: expo-file-system does not support NSURLIsExcludedFromBackupKey (iOS)
// or Android backup exclusion rules within Expo Go. When migrating to a development build,
// implement backup exclusion via a config plugin or native module.
// For now, the file lives in documentDirectory which is app-private but may be included
// in device backups.
```

---

## Verdict

The plan is well-thought-out and ready to build with the amendments above. The most critical change is #1 (server-side validation for re-clone requests to prevent abuse). The rest are robustness improvements that make the implementation production-ready.
