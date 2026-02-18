# RETUNED — Expo SDK 55 Upgrade Plan

**Created:** February 11, 2026
**Current SDK:** 54 (expo ^54.0.23, React Native 0.81, React 19.1)
**Target SDK:** 55 (React Native 0.83.1, React 19.2)
**Status:** Planned — awaiting beta stabilization

---

## 1. Why Upgrade

| Benefit | Impact |
|---------|--------|
| **Control Center / Lock Screen controls** | Top beta-tester request — users can play/pause meditations and affirmations from iOS Control Center and lock screen |
| **expo-audio (new library)** | Simpler API, better performance, built-in Now Playing metadata |
| **Smaller OTA updates** | Hermes bytecode diffing = faster JS bundle delivery to users |
| **Ongoing security patches** | SDK 54 will stop receiving updates |
| **New Architecture mandatory** | Already enabled in our app — no extra work |

---

## 2. What Breaks (Breaking Changes)

### 2.1 — expo-av removed from Expo Go (CRITICAL)

`expo-av` is deprecated and completely removed from Expo Go in SDK 55. This is our **largest migration task** because audio is core to the entire app.

**Every file that imports `expo-av` must be migrated to `expo-audio`:**

| File | What It Does | expo-av Usage |
|------|-------------|---------------|
| `client/contexts/AudioContext.tsx` | Global affirmation playback (main player) | `Audio.setAudioModeAsync`, `Audio.Sound.createAsync`, playback status callbacks |
| `client/contexts/BackgroundMusicContext.tsx` | Ambient sound loops during breathing/meditation | `Audio.Sound.createAsync`, `setVolumeAsync`, `setIsLoopingAsync`, play/pause/stop |
| `client/screens/BreathingScreen.tsx` | Binaural beats during breathing exercises | `Audio.Sound.createAsync`, playback with status updates |
| `client/screens/GuidedMomentScreen.tsx` | Micro-meditation audio playback | `Audio.setAudioModeAsync`, `Audio.Sound.createAsync`, position tracking for RSVP sync |
| `client/components/GuidedMomentPlayer.tsx` | Meditation player controls | `Audio.Sound.createAsync`, play/pause/stop, status callbacks |
| `client/screens/VoiceSetupScreen.tsx` | Voice sample recording + preview playback | `Audio.Recording.createAsync` (recording), `Audio.Sound.createAsync` (preview) |
| `client/screens/VoiceSettingsScreen.tsx` | Voice preview playback | `Audio.Sound.createAsync`, play/pause |
| `client/screens/SoundLibraryScreen.tsx` | Sound library preview playback | `Audio.Sound.createAsync` |

### 2.2 — API Pattern Changes (expo-av → expo-audio)

| expo-av Pattern | expo-audio Replacement |
|----------------|----------------------|
| `import { Audio } from 'expo-av'` | `import { useAudioPlayer, AudioPlayer, setAudioModeAsync } from 'expo-audio'` |
| `Audio.setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: true })` | `setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true, interruptionMode: 'doNotMix' })` |
| `Audio.Sound.createAsync(source, initialStatus)` | `new AudioPlayer(source)` or `useAudioPlayer(source)` hook |
| `sound.playAsync()` | `player.play()` |
| `sound.pauseAsync()` | `player.pause()` |
| `sound.stopAsync()` | `player.seekTo(0); player.pause()` |
| `sound.unloadAsync()` | `player.release()` |
| `sound.setVolumeAsync(vol)` | `player.volume = vol` |
| `sound.setIsLoopingAsync(true)` | `player.loop = true` |
| `sound.setOnPlaybackStatusUpdate(cb)` | `player.addListener('playbackStatusUpdate', cb)` |
| `sound.getStatusAsync()` | `player.currentStatus` (synchronous property) |
| `status.isLoaded` | `player.currentStatus !== 'idle'` |
| `status.isPlaying` | `player.playing` |
| `status.positionMillis` | `player.currentTime * 1000` |
| `status.durationMillis` | `player.duration * 1000` |
| `status.didJustFinish` | Listen for `'playToEnd'` event |
| `Audio.Recording.createAsync()` | `import { AudioRecorder } from 'expo-audio'` — `new AudioRecorder(options)` |
| `recording.stopAndUnloadAsync()` | `recorder.stop()` |
| `recording.getURI()` | `recorder.uri` |

### 2.3 — Recording Migration (VoiceSetupScreen)

The voice recording flow in `VoiceSetupScreen.tsx` uses `Audio.Recording`. In expo-audio, recording uses a different class:

```
// expo-av (current)
const { recording } = await Audio.Recording.createAsync(
  Audio.RecordingOptionsPresets.HIGH_QUALITY
);
await recording.stopAndUnloadAsync();
const uri = recording.getURI();

// expo-audio (new)
const recorder = new AudioRecorder({
  sampleRate: 44100,
  numberOfChannels: 1,
  bitRate: 128000,
});
await recorder.prepareToRecordAsync();
await recorder.record();
// ... later
await recorder.stop();
const uri = recorder.uri;
```

### 2.4 — Lock Screen / Now Playing (NEW CAPABILITY)

After migrating to expo-audio, add Now Playing metadata for Control Center:

```
// After playback starts
await player.setActiveForLockScreen({
  showPlayPauseButton: true,
  showSkipForwardButton: false,
  showSkipBackwardButton: false,
});

await player.updateLockScreenMetadata({
  title: 'Morning Affirmations',
  artist: 'RETUNED',
  artwork: artworkUrl,
});
```

**Where to add this:**
- `AudioContext.tsx` — affirmation playback (title = affirmation name)
- `GuidedMomentPlayer.tsx` — meditation playback (title = "Guided Moment")
- `BackgroundMusicContext.tsx` — ambient sounds (title = sound name)

**Important:** Only one player can control the lock screen at a time. Need a priority system:
1. Affirmation playback (highest priority)
2. Meditation playback
3. Background ambient sound (lowest priority)

### 2.5 — New Architecture (No Action Needed)

SDK 55 makes New Architecture mandatory. Our `app.json` already has `"newArchEnabled": true` — no changes required.

### 2.6 — React & React Native Version Bumps

- React: 19.1 → 19.2 (minor — unlikely to cause issues)
- React Native: 0.81 → 0.83.1 (two minor versions — check release notes for any deprecated APIs we use)

### 2.7 — expo-file-system

The `/legacy` import path is removed in SDK 55. Our client code does NOT currently import from `expo-file-system` (confirmed by codebase search), but the server-side file handling should be verified. No client-side changes needed.

### 2.8 — Package Version Alignment

All Expo packages move to unified versioning (matching SDK major version). Every `expo-*` dependency in `package.json` will need version bumps via `npx expo install --fix`.

---

## 3. Migration Plan (Ordered Steps)

### Phase 1: Preparation (before touching SDK)
- [ ] Create a Git branch for the upgrade
- [ ] Document current audio behavior for regression testing
- [ ] Verify all third-party libraries support New Architecture (check: `react-native-reanimated`, `react-native-gesture-handler`, `@tanstack/react-query`, `@shopify/flash-list`, `react-native-svg`)
- [ ] Review React 19.2 changelog for breaking changes

### Phase 2: SDK Upgrade
- [ ] Run `npx expo install expo@^55 --fix` to update all Expo packages
- [ ] Update `react` and `react-native` versions in package.json
- [ ] Remove `newArchEnabled` from `app.json` (now always-on)
- [ ] Run `npx expo install --fix` to align all package versions
- [ ] Fix any TypeScript compilation errors

### Phase 3: Audio Migration (largest task — do file-by-file)
Priority order (start with simplest, build confidence):

1. **SoundLibraryScreen.tsx** — Simple preview playback, minimal state
2. **VoiceSettingsScreen.tsx** — Simple preview playback
3. **BreathingScreen.tsx** — Playback with status updates
4. **BackgroundMusicContext.tsx** — Looping ambient sounds, volume control
5. **AudioContext.tsx** — Global player with RSVP sync (complex)
6. **GuidedMomentScreen.tsx** — Meditation with RSVP word timing (complex)
7. **GuidedMomentPlayer.tsx** — Player controls for meditation
8. **VoiceSetupScreen.tsx** — Recording flow (different API entirely)

### Phase 4: Lock Screen Integration
- [ ] Add `setActiveForLockScreen()` to AudioContext (affirmation player)
- [ ] Add `updateLockScreenMetadata()` with affirmation title + app artwork
- [ ] Add lock screen support to GuidedMomentPlayer (meditation)
- [ ] Add lock screen support to BackgroundMusicContext (ambient sounds)
- [ ] Implement priority system so active content takes Control Center

### Phase 5: Testing
- [ ] Test all 4 breathing techniques with binaural beats
- [ ] Test ambient sound library (all 25 tracks, looping, volume)
- [ ] Test affirmation playback (AI voices + cloned voice)
- [ ] Test RSVP word sync during affirmation playback
- [ ] Test micro-meditation generation and playback
- [ ] Test voice recording and cloning flow
- [ ] Test voice preview in settings
- [ ] Test background audio (app backgrounded, screen locked)
- [ ] Test Control Center controls (play/pause from lock screen)
- [ ] Test simultaneous audio (ambient sound + affirmation)
- [ ] Test on physical iOS device via Expo Go

### Phase 6: Cleanup
- [ ] Remove any remaining `expo-av` imports
- [ ] Remove `expo-av` from package.json
- [ ] Update `replit.md` with new audio architecture
- [ ] Update `docs/voice-ai-architecture.md` if affected

---

## 4. Assumptions

1. **SDK 55 stable release is available** — Currently in beta. We should only upgrade once the stable version ships (expected ~2 weeks from beta).
2. **expo-audio API is stable** — The API documented above is based on the beta. Minor changes possible before stable release.
3. **Expo Go includes expo-audio** — Confirmed: expo-audio replaces expo-av in Expo Go for SDK 55.
4. **No new EAS build required for Expo Go testing** — Expo Go will include SDK 55 support automatically.
5. **Third-party libraries are New Architecture compatible** — `react-native-reanimated` and `react-native-gesture-handler` already support it. Others need verification.
6. **RSVP word-level timing still works** — Our RSVP sync relies on `positionMillis` from playback status. Need to confirm `expo-audio` provides equivalent precision via `currentTime`.
7. **Recording API supports same quality presets** — Voice cloning requires high-quality audio. Need to verify expo-audio recording quality matches expo-av's `HIGH_QUALITY` preset.
8. **Hume AI and ElevenLabs APIs are unaffected** — The SDK upgrade only affects client-side audio playback/recording. Server-side TTS generation is unchanged.

---

## 5. Dependencies

| Dependency | Why It Matters | Risk Level |
|-----------|---------------|------------|
| `expo-audio` package | Core replacement for expo-av | Low — official Expo package |
| SDK 55 stable release | Beta may have bugs | Medium — wait for stable |
| React Native 0.83.1 | Breaking changes possible | Low — minor version bump |
| React 19.2 | API changes possible | Low — patch-level update |
| `react-native-reanimated` | Must support New Architecture | Low — already confirmed |
| `react-native-gesture-handler` | Must support New Architecture | Low — already confirmed |
| `@shopify/flash-list` | Must support New Architecture | Low — widely used |
| EAS Build (for App Store) | Needed after migration for production build | Medium — requires Apple submission |
| Physical iOS device | Lock screen controls don't appear in simulator | Required for full testing |

---

## 6. Risks

### High Risk
| Risk | Impact | Mitigation |
|------|--------|------------|
| **RSVP sync breaks** | Word-by-word display goes out of sync with audio | Test immediately after AudioContext migration. Compare `currentTime` precision with old `positionMillis`. Build a timing test with known audio. |
| **Recording quality degrades** | Voice clones sound worse → bad user experience | Record same sample with both APIs and compare. Test with ElevenLabs cloning to ensure quality threshold is met. |
| **Simultaneous audio conflicts** | Ambient sounds + affirmations may interfere with `interruptionMode: 'doNotMix'` | Test multi-track playback. May need `duckOthers` for ambient while affirmation plays. Lock screen requires `doNotMix` — may need to switch modes dynamically. |

### Medium Risk
| Risk | Impact | Mitigation |
|------|--------|------------|
| **expo-audio API changes before stable** | Code written against beta API breaks | Wait for stable SDK 55 release before starting migration. |
| **Third-party library incompatibility** | App crashes on New Architecture | Check each library's GitHub issues for New Architecture support. Test in isolation. |
| **Performance regression** | Audio stutters or gaps during playback | Benchmark on physical device. Compare memory/CPU usage before and after. |
| **Migration takes longer than expected** | Delays other feature work | Budget 3-5 days for audio migration alone. Have rollback plan (Git branch). |

### Low Risk
| Risk | Impact | Mitigation |
|------|--------|------------|
| **React 19.2 deprecation warnings** | Console noise, eventual breakage | Fix warnings as they appear. |
| **Package version conflicts** | Build failures | Use `npx expo install --fix` to resolve. |

---

## 7. Estimated Effort

| Phase | Estimated Time |
|-------|---------------|
| Phase 1: Preparation | 1-2 hours |
| Phase 2: SDK Upgrade | 1-2 hours |
| Phase 3: Audio Migration | 3-5 days (8 files, complex state management) |
| Phase 4: Lock Screen Integration | 0.5-1 day |
| Phase 5: Testing | 1-2 days |
| Phase 6: Cleanup | 1-2 hours |
| **Total** | **~5-8 days** |

---

## 8. Recommended Timing

**Upgrade after the current beta testing round stabilizes.** Specifically:

1. Finish addressing current beta-tester feedback (nature sound descriptions, any remaining bugs)
2. Wait for SDK 55 stable release (currently in beta)
3. Create a dedicated upgrade branch
4. Migrate in one focused sprint (avoid mixing with feature work)
5. Do a full regression test on physical devices
6. Submit new build to App Store

**Do NOT upgrade if:**
- You're about to submit a time-sensitive App Store update
- SDK 55 stable hasn't shipped yet
- You're mid-way through implementing a new feature

---

## 9. Features We Can Leverage Post-Upgrade

Beyond Control Center controls, SDK 55 opens up:

| Feature | What It Enables for RETUNED |
|---------|---------------------------|
| **Lock screen metadata** | Show affirmation title, artwork, and progress on lock screen |
| **Remote audio events** | Respond to headphone button presses (play/pause/skip) |
| **Hermes bytecode diffing** | Faster OTA updates for users (smaller JS bundles) |
| **expo-audio hooks** | `useAudioPlayer()` hook simplifies component code significantly |
| **Better background audio** | More reliable background playback on both iOS and Android |

---

## 10. Rollback Plan

If the upgrade causes critical issues:

1. Git revert to the pre-upgrade branch
2. Rebuild with SDK 54
3. Resubmit to App Store
4. No database changes are involved — rollback is purely code-level

---

*This document should be reviewed and updated when SDK 55 stable is released, as API details may change from the current beta.*
