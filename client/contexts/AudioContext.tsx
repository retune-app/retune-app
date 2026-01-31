import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { Affirmation } from '@shared/schema';
import { getApiUrl } from '@/lib/query-client';
import { useBackgroundMusic } from './BackgroundMusicContext';

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
  
  const { startBackgroundMusic, stopBackgroundMusic, selectedMusic } = useBackgroundMusic();

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
              if (status.didJustFinish && !autoReplay) {
                setIsPlaying(false);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
      
      // Start background music if selected
      if (selectedMusic !== 'none') {
        await startBackgroundMusic();
      }
    } catch (error) {
      console.error('Error loading audio:', error);
    } finally {
      setIsLoading(false);
      isOperationInProgress.current = false;
    }
  }, [currentAffirmation?.id, autoReplay, playbackSpeed, unloadCurrentSound, selectedMusic, startBackgroundMusic]);

  const togglePlayPause = useCallback(async () => {
    console.log('togglePlayPause called, soundRef exists:', !!soundRef.current);
    if (!soundRef.current) {
      console.log('No sound ref, returning early');
      return;
    }

    // Prevent overlapping operations from rapid button presses
    if (isOperationInProgress.current) {
      console.log('Operation in progress, skipping');
      return;
    }

    isOperationInProgress.current = true;
    try {
      const status = await soundRef.current.getStatusAsync();
      console.log('Sound status:', status.isLoaded ? 'loaded' : 'not loaded', status.isLoaded && 'isPlaying' in status ? (status.isPlaying ? 'playing' : 'paused') : '');
      if (status.isLoaded) {
        if (status.isPlaying) {
          await soundRef.current.pauseAsync();
          setIsPlaying(false);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          // Pause background music too
          await stopBackgroundMusic();
          console.log('Paused');
        } else {
          // Check if audio has finished (position at or near end)
          const isAtEnd = status.durationMillis && 
            status.positionMillis >= status.durationMillis - 100;
          
          if (isAtEnd) {
            // Seek to beginning before playing
            await soundRef.current.setPositionAsync(0);
            setPosition(0);
            console.log('Restarting from beginning');
          }
          
          await soundRef.current.playAsync();
          setIsPlaying(true);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          // Resume background music if selected
          if (selectedMusic !== 'none') {
            await startBackgroundMusic();
          }
          console.log('Resumed');
        }
      }
    } catch (error) {
      console.error('Error toggling playback:', error);
    } finally {
      isOperationInProgress.current = false;
    }
  }, [selectedMusic, startBackgroundMusic, stopBackgroundMusic]);

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
