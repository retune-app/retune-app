import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Affirmation } from '@shared/schema';
import { getApiUrl, apiRequest } from '@/lib/query-client';
import { useBackgroundMusic } from './BackgroundMusicContext';
import { queryClient } from '@/lib/query-client';

const BREATHING_AFFIRMATION_KEY = '@breathing/selectedAffirmation';

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

  const unloadCurrentSound = useCallback(async () => {
    if (soundRef.current) {
      try {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
      } catch (error) {
        console.error('Error unloading sound:', error);
      }
      soundRef.current = null;
    }
    setIsPlaying(false);
    setPosition(0);
    setDuration(0);
  }, []);

  const playAffirmation = useCallback(async (affirmation: Affirmation) => {
    if (!affirmation.audioUrl) {
      console.error('No audio URL for affirmation');
      return;
    }

    // Prevent overlapping operations from rapid button presses
    if (isOperationInProgress.current) {
      return;
    }

    // If same affirmation is already loaded, just resume playback
    if (currentAffirmation?.id === affirmation.id && soundRef.current) {
      try {
        isOperationInProgress.current = true;
        const status = await soundRef.current.getStatusAsync();
        if (status.isLoaded) {
          await soundRef.current.playAsync();
          setIsPlaying(true);
          return;
        }
      } finally {
        isOperationInProgress.current = false;
      }
    }

    isOperationInProgress.current = true;
    setIsLoading(true);
    hasRecordedListenRef.current = false; // Reset listen tracking for new affirmation
    await unloadCurrentSound();

    try {
      const audioUri = `${getApiUrl()}${affirmation.audioUrl}`;

      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUri },
        { 
          shouldPlay: true, 
          isLooping: autoReplay,
          rate: playbackSpeed,
          shouldCorrectPitch: true,
          progressUpdateIntervalMillis: 50, // Update every 50ms for smoother RSVP sync
        },
        (status) => {
          try {
            if (status.isLoaded) {
              setPosition(status.positionMillis || 0);
              setDuration(status.durationMillis || 0);
              setIsPlaying(status.isPlaying);
              if (status.didJustFinish) {
                // Record the listen (only once per playback session)
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

      soundRef.current = sound;
      setCurrentAffirmation(affirmation);
      setIsPlaying(true);
      
      // Background music is NOT auto-started - user must manually enable it from player controls
    } catch (error) {
      console.error('Error loading audio:', error);
    } finally {
      setIsLoading(false);
      isOperationInProgress.current = false;
    }
  }, [currentAffirmation?.id, autoReplay, playbackSpeed, unloadCurrentSound, recordListen]);

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
          // Background music is NOT auto-resumed - user controls it manually
        }
      }
    } catch (error) {
      console.error('Error toggling playback:', error);
    } finally {
      isOperationInProgress.current = false;
    }
  }, [stopBackgroundMusic]);

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

  return (
    <AudioContext.Provider
      value={{
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
      }}
    >
      {children}
    </AudioContext.Provider>
  );
}
