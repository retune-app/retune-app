import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { Audio } from 'expo-av';
import { Affirmation } from '@shared/schema';
import { getApiUrl } from '@/lib/query-client';

interface AudioState {
  currentAffirmation: Affirmation | null;
  isPlaying: boolean;
  position: number;
  duration: number;
  isLoading: boolean;
  autoReplay: boolean;
  playbackSpeed: number;
}

interface AudioContextType extends AudioState {
  playAffirmation: (affirmation: Affirmation) => Promise<void>;
  togglePlayPause: () => Promise<void>;
  stop: () => Promise<void>;
  seek: (position: number) => Promise<void>;
  setAutoReplay: (enabled: boolean) => void;
  setPlaybackSpeed: (speed: number) => void;
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
  const soundRef = useRef<Audio.Sound | null>(null);
  const isOperationInProgress = useRef(false);

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
    await unloadCurrentSound();

    try {
      const audioUri = `${getApiUrl()}${affirmation.audioUrl}`;
      console.log('Loading audio from:', audioUri);

      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUri },
        { shouldPlay: true, isLooping: autoReplay },
        (status) => {
          try {
            if (status.isLoaded) {
              setPosition(status.positionMillis || 0);
              setDuration(status.durationMillis || 0);
              setIsPlaying(status.isPlaying);
              if (status.didJustFinish && !autoReplay) {
                setIsPlaying(false);
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
    } catch (error) {
      console.error('Error loading audio:', error);
    } finally {
      setIsLoading(false);
      isOperationInProgress.current = false;
    }
  }, [currentAffirmation?.id, autoReplay, unloadCurrentSound]);

  const togglePlayPause = useCallback(async () => {
    if (!soundRef.current) return;

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
        } else {
          await soundRef.current.playAsync();
          setIsPlaying(true);
        }
      }
    } catch (error) {
      console.error('Error toggling playback:', error);
    } finally {
      isOperationInProgress.current = false;
    }
  }, []);

  const stop = useCallback(async () => {
    await unloadCurrentSound();
    setCurrentAffirmation(null);
  }, [unloadCurrentSound]);

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
        playAffirmation,
        togglePlayPause,
        stop,
        seek,
        setAutoReplay,
        setPlaybackSpeed,
      }}
    >
      {children}
    </AudioContext.Provider>
  );
}
