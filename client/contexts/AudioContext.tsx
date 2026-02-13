import React, { createContext, useContext, useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Platform } from 'react-native';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import * as LegacyFS from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Affirmation } from '@shared/schema';
import { getApiUrl, apiRequest } from '@/lib/query-client';
import { useBackgroundMusic } from './BackgroundMusicContext';
import { queryClient } from '@/lib/query-client';

const BREATHING_AFFIRMATION_KEY = '@breathing/selectedAffirmation';
const AUDIO_CACHE_DIR = `${LegacyFS.cacheDirectory}audio/`;

const audioCacheReady = Platform.OS !== 'web'
  ? LegacyFS.makeDirectoryAsync(AUDIO_CACHE_DIR, { intermediates: true }).catch(() => {})
  : Promise.resolve();

export async function preloadAudioToCache(audioUrl: string, affirmationId: number): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const remoteUri = `${getApiUrl()}${audioUrl}`;
    await getCachedAudioUri(remoteUri, affirmationId);
  } catch {}
}

export async function clearCachedAudio(affirmationId: number): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await audioCacheReady;
    const dirContents = await LegacyFS.readDirectoryAsync(AUDIO_CACHE_DIR);
    const pattern = `affirmation-${affirmationId}-`;
    const legacyPattern = `affirmation_${affirmationId}.`;
    for (const file of dirContents) {
      if (file.startsWith(pattern) || file.startsWith(legacyPattern)) {
        await LegacyFS.deleteAsync(`${AUDIO_CACHE_DIR}${file}`, { idempotent: true });
      }
    }
  } catch {}
}

async function getCachedAudioUri(remoteUri: string, affirmationId: number): Promise<string> {
  if (Platform.OS === 'web') return remoteUri;
  try {
    await audioCacheReady;
    const urlFilename = remoteUri.split('/').pop() || '';
    const ext = remoteUri.includes('.mp3') ? '.mp3' : '.wav';
    const cacheKey = urlFilename.replace(/\.[^.]+$/, '') || `affirmation_${affirmationId}`;
    const localPath = `${AUDIO_CACHE_DIR}${cacheKey}${ext}`;
    const info = await LegacyFS.getInfoAsync(localPath);
    if (info.exists && (info.size ?? 0) > 0) {
      return localPath;
    }
    const oldPattern = `${AUDIO_CACHE_DIR}affirmation_${affirmationId}${ext}`;
    const oldLegacy = `${AUDIO_CACHE_DIR}affirmation-${affirmationId}-`;
    try {
      const oldInfo = await LegacyFS.getInfoAsync(oldPattern);
      if (oldInfo.exists) await LegacyFS.deleteAsync(oldPattern, { idempotent: true });
    } catch {}
    const result = await LegacyFS.downloadAsync(remoteUri, localPath);
    if (result.status === 200) {
      return localPath;
    }
    return remoteUri;
  } catch {
    return remoteUri;
  }
}

interface AudioState {
  currentAffirmation: Affirmation | null;
  isPlaying: boolean;
  position: number;
  duration: number;
  isLoading: boolean;
  autoReplay: boolean;
  playbackSpeed: number;
  breathingAffirmation: Affirmation | null;
  highlightAffirmationId: number | null;
}

interface AudioContextType extends AudioState {
  playAffirmation: (affirmation: Affirmation) => Promise<void>;
  togglePlayPause: () => Promise<void>;
  stop: () => Promise<void>;
  seek: (position: number) => Promise<void>;
  setAutoReplay: (enabled: boolean) => void;
  setPlaybackSpeed: (speed: number) => void;
  setBreathingAffirmation: (affirmation: Affirmation | null) => void;
  requestHighlightAffirmation: (id: number) => void;
  clearHighlightAffirmation: () => void;
}

const AudioContext = createContext<AudioContextType | null>(null);

export function useAudio() {
  const context = useContext(AudioContext);
  if (!context) {
    throw new Error('useAudio must be used within an AudioProvider');
  }
  return context;
}

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const [currentAffirmation, setCurrentAffirmation] = useState<Affirmation | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [autoReplay, setAutoReplayState] = useState(true);
  const [playbackSpeed, setPlaybackSpeedState] = useState(1);
  const [breathingAffirmation, setBreathingAffirmationState] = useState<Affirmation | null>(null);
  const [highlightAffirmationId, setHighlightAffirmationId] = useState<number | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const isOperationInProgress = useRef(false);
  const hasRecordedListenRef = useRef(false);
  
  const { startBackgroundMusic, stopBackgroundMusic, selectedMusic } = useBackgroundMusic();

  const requestHighlightAffirmation = useCallback((id: number) => {
    setHighlightAffirmationId(id);
  }, []);

  const clearHighlightAffirmation = useCallback(() => {
    setHighlightAffirmationId(null);
  }, []);

  // Load saved breathing affirmation on mount
  useEffect(() => {
    const loadBreathingAffirmation = async () => {
      try {
        const saved = await AsyncStorage.getItem(BREATHING_AFFIRMATION_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          setBreathingAffirmationState(parsed);
        }
      } catch (error) {
        console.error('Error loading breathing affirmation:', error);
      }
    };
    loadBreathingAffirmation();
  }, []);

  const setBreathingAffirmation = useCallback(async (affirmation: Affirmation | null) => {
    setBreathingAffirmationState(affirmation);
    try {
      if (affirmation) {
        await AsyncStorage.setItem(BREATHING_AFFIRMATION_KEY, JSON.stringify(affirmation));
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        await AsyncStorage.removeItem(BREATHING_AFFIRMATION_KEY);
      }
    } catch (error) {
      console.error('Error saving breathing affirmation:', error);
    }
  }, []);

  // Record a listen when audio finishes
  const recordListen = useCallback(async (affirmationId: number) => {
    if (hasRecordedListenRef.current) return; // Already recorded for this session
    hasRecordedListenRef.current = true;
    
    try {
      await apiRequest("POST", `/api/affirmations/${affirmationId}/play`);
      // Invalidate stats cache to refresh analytics
      queryClient.invalidateQueries({ queryKey: ["/api/user/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/affirmations"] });
    } catch (error) {
      console.error("Error recording listen:", error);
      hasRecordedListenRef.current = false; // Allow retry on error
    }
  }, []);

  useEffect(() => {
    const initAudio = async () => {
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: true,
          shouldDuckAndroid: true,
        });
      } catch (error) {
        console.error('Error initializing audio mode:', error);
      }
    };
    initAudio();

    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, []);

  const unloadCurrentSound = useCallback(async (resetState = true) => {
    if (soundRef.current) {
      const oldSound = soundRef.current;
      soundRef.current = null;
      try {
        await oldSound.stopAsync();
        await oldSound.unloadAsync();
      } catch (error) {
        console.error('Error unloading sound:', error);
      }
    }
    if (resetState) {
      setIsPlaying(false);
      setPosition(0);
      setDuration(0);
    }
  }, []);

  const playRequestId = useRef(0);
  const activeSoundIdRef = useRef(0);

  const playAffirmation = useCallback(async (affirmation: Affirmation) => {
    if (!affirmation.audioUrl) {
      console.error('No audio URL for affirmation');
      return;
    }

    if (currentAffirmation?.id === affirmation.id && soundRef.current) {
      try {
        const status = await soundRef.current.getStatusAsync();
        if (status.isLoaded) {
          await soundRef.current.playAsync();
          setIsPlaying(true);
          return;
        }
      } catch (e) {
        // Fall through to full reload
      }
    }

    const thisRequestId = ++playRequestId.current;

    setIsLoading(true);
    setCurrentAffirmation(affirmation);
    setPosition(0);
    setDuration(0);
    setIsPlaying(false);
    hasRecordedListenRef.current = false;
    await unloadCurrentSound(false);

    if (thisRequestId !== playRequestId.current) return;

    try {
      const remoteUri = `${getApiUrl()}${affirmation.audioUrl}`;
      const audioUri = await getCachedAudioUri(remoteUri, affirmation.id);

      if (thisRequestId !== playRequestId.current) return;

      const soundId = thisRequestId;
      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUri },
        { 
          shouldPlay: true, 
          isLooping: autoReplay,
          rate: playbackSpeed,
          shouldCorrectPitch: true,
          progressUpdateIntervalMillis: 50,
        },
        (status) => {
          try {
            if (activeSoundIdRef.current !== soundId) return;
            if (status.isLoaded) {
              setPosition(status.positionMillis || 0);
              setDuration(status.durationMillis || 0);
              setIsPlaying(status.isPlaying);
              if (status.didJustFinish) {
                recordListen(affirmation.id);
                if (!autoReplay) {
                  setIsPlaying(false);
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                }
              }
            } else if ('error' in status) {
              console.error('Audio playback error:', status.error);
            }
          } catch (e) {
            console.error('Error in audio status callback:', e);
          }
        }
      );

      if (thisRequestId !== playRequestId.current) {
        try { await sound.stopAsync(); await sound.unloadAsync(); } catch (e) {}
        return;
      }

      soundRef.current = sound;
      activeSoundIdRef.current = soundId;
      setIsPlaying(true);
      
      if (selectedMusic !== 'none') {
        startBackgroundMusic();
      }
    } catch (error) {
      if (thisRequestId === playRequestId.current) {
        console.error('Error loading audio:', error);
      }
    } finally {
      if (thisRequestId === playRequestId.current) {
        setIsLoading(false);
      }
    }
  }, [currentAffirmation?.id, autoReplay, playbackSpeed, unloadCurrentSound, recordListen, selectedMusic, startBackgroundMusic]);

  const togglePlayPause = useCallback(async () => {
    if (!soundRef.current) {
      return;
    }

    // Prevent overlapping operations from rapid button presses
    if (isOperationInProgress.current) {
      return;
    }

    isOperationInProgress.current = true;
    try {
      const status = await soundRef.current.getStatusAsync();
      if (status.isLoaded) {
        if (status.isPlaying) {
          await soundRef.current.pauseAsync();
          setIsPlaying(false);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          // Pause background music too
          await stopBackgroundMusic();
        } else {
          // Check if audio has finished (position at or near end)
          const isAtEnd = status.durationMillis && 
            status.positionMillis >= status.durationMillis - 100;
          
          if (isAtEnd) {
            // Seek to beginning before playing
            await soundRef.current.setPositionAsync(0);
            setPosition(0);
          }
          
          await soundRef.current.playAsync();
          setIsPlaying(true);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          if (selectedMusic !== 'none') {
            startBackgroundMusic();
          }
        }
      }
    } catch (error) {
      console.error('Error toggling playback:', error);
    } finally {
      isOperationInProgress.current = false;
    }
  }, [stopBackgroundMusic, selectedMusic, startBackgroundMusic]);

  const stop = useCallback(async () => {
    await unloadCurrentSound();
    await stopBackgroundMusic();
    setCurrentAffirmation(null);
  }, [unloadCurrentSound, stopBackgroundMusic]);

  const seek = useCallback(async (positionMs: number) => {
    if (!soundRef.current) return;

    try {
      await soundRef.current.setPositionAsync(positionMs);
      setPosition(positionMs);
    } catch (error) {
      console.error('Error seeking:', error);
    }
  }, []);

  const setAutoReplay = useCallback((enabled: boolean) => {
    setAutoReplayState(enabled);
    if (soundRef.current) {
      soundRef.current.setIsLoopingAsync(enabled);
    }
  }, []);

  const setPlaybackSpeed = useCallback((speed: number) => {
    setPlaybackSpeedState(speed);
    if (soundRef.current) {
      soundRef.current.setRateAsync(speed, true);
    }
  }, []);

  const contextValue = useMemo<AudioContextType>(() => ({
    currentAffirmation,
    isPlaying,
    position,
    duration,
    isLoading,
    autoReplay,
    playbackSpeed,
    breathingAffirmation,
    highlightAffirmationId,
    playAffirmation,
    togglePlayPause,
    stop,
    seek,
    setAutoReplay,
    setPlaybackSpeed,
    setBreathingAffirmation,
    requestHighlightAffirmation,
    clearHighlightAffirmation,
  }), [
    currentAffirmation,
    isPlaying,
    position,
    duration,
    isLoading,
    autoReplay,
    playbackSpeed,
    breathingAffirmation,
    highlightAffirmationId,
    playAffirmation,
    togglePlayPause,
    stop,
    seek,
    setAutoReplay,
    setPlaybackSpeed,
    setBreathingAffirmation,
    requestHighlightAffirmation,
    clearHighlightAffirmation,
  ]);

  return (
    <AudioContext.Provider value={contextValue}>
      {children}
    </AudioContext.Provider>
  );
}
