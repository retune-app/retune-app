import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type BackgroundMusicType = 
  | 'none'
  | '432hz'
  | '528hz'
  | 'theta'
  | 'alpha'
  | 'delta'
  | 'beta'
  | 'rain'
  | 'ocean'
  | 'forest'
  | 'wind';

export interface BackgroundMusicOption {
  id: BackgroundMusicType;
  name: string;
  description: string;
  category: 'nature' | 'binaural' | 'solfeggio';
  icon: string;
}

export const BACKGROUND_MUSIC_OPTIONS: BackgroundMusicOption[] = [
  { id: 'none', name: 'None', description: 'No background music', category: 'nature', icon: 'volume-x' },
  { id: 'rain', name: 'Rain', description: 'Gentle rainfall', category: 'nature', icon: 'cloud-rain' },
  { id: 'ocean', name: 'Ocean', description: 'Calming ocean waves', category: 'nature', icon: 'droplet' },
  { id: 'forest', name: 'Forest', description: 'Nature sounds & birds', category: 'nature', icon: 'feather' },
  { id: 'wind', name: 'Wind', description: 'Soft wind ambience', category: 'nature', icon: 'wind' },
  { id: '432hz', name: '432Hz Healing', description: 'Universal healing frequency', category: 'solfeggio', icon: 'heart' },
  { id: '528hz', name: '528Hz Love', description: 'Solfeggio love frequency', category: 'solfeggio', icon: 'sun' },
  { id: 'theta', name: 'Theta Waves', description: 'Deep meditation (6Hz)', category: 'binaural', icon: 'moon' },
  { id: 'alpha', name: 'Alpha Waves', description: 'Relaxation (10Hz)', category: 'binaural', icon: 'sunrise' },
  { id: 'delta', name: 'Delta Waves', description: 'Deep sleep (2Hz)', category: 'binaural', icon: 'cloud' },
  { id: 'beta', name: 'Beta Waves', description: 'Focus & concentration (18Hz)', category: 'binaural', icon: 'zap' },
];

export const getSoundsByCategory = () => {
  const nature = BACKGROUND_MUSIC_OPTIONS.filter(o => o.category === 'nature' && o.id !== 'none');
  const binaural = BACKGROUND_MUSIC_OPTIONS.filter(o => o.category === 'binaural');
  const solfeggio = BACKGROUND_MUSIC_OPTIONS.filter(o => o.category === 'solfeggio');
  return { nature, binaural, solfeggio };
};

const AUDIO_FILES: Record<Exclude<BackgroundMusicType, 'none'>, any> = {
  '432hz': require('../../assets/audio/432hz-healing.wav'),
  '528hz': require('../../assets/audio/528hz-love.wav'),
  'theta': require('../../assets/audio/theta-waves.wav'),
  'alpha': require('../../assets/audio/alpha-waves.wav'),
  'delta': require('../../assets/audio/delta-waves.wav'),
  'beta': require('../../assets/audio/beta-waves.wav'),
  'rain': require('../../assets/audio/rain-ambient.wav'),
  'ocean': require('../../assets/audio/ocean-waves.wav'),
  'forest': require('../../assets/audio/forest-birds.wav'),
  'wind': require('../../assets/audio/wind-gentle.wav'),
};

const STORAGE_KEY = '@rewired_background_music';
const VOLUME_STORAGE_KEY = '@rewired_background_music_volume';

interface BackgroundMusicContextType {
  selectedMusic: BackgroundMusicType;
  setSelectedMusic: (type: BackgroundMusicType) => Promise<void>;
  volume: number;
  setVolume: (volume: number) => Promise<void>;
  isPlaying: boolean;
  startBackgroundMusic: () => Promise<void>;
  stopBackgroundMusic: () => Promise<void>;
}

const BackgroundMusicContext = createContext<BackgroundMusicContextType | undefined>(undefined);

export function BackgroundMusicProvider({ children }: { children: React.ReactNode }) {
  const [selectedMusic, setSelectedMusicState] = useState<BackgroundMusicType>('none');
  const [volume, setVolumeState] = useState(0.7);
  const [isPlaying, setIsPlaying] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    loadSavedPreferences();
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, []);

  const loadSavedPreferences = async () => {
    try {
      const [savedMusic, savedVolume] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEY),
        AsyncStorage.getItem(VOLUME_STORAGE_KEY),
      ]);
      if (savedMusic) {
        setSelectedMusicState(savedMusic as BackgroundMusicType);
      }
      if (savedVolume) {
        setVolumeState(parseFloat(savedVolume));
      }
    } catch (error) {
      console.error('Error loading background music preferences:', error);
    }
  };

  const setSelectedMusic = async (type: BackgroundMusicType) => {
    setSelectedMusicState(type);
    await AsyncStorage.setItem(STORAGE_KEY, type);
    
    if (isPlaying) {
      await stopBackgroundMusic();
      if (type !== 'none') {
        await startBackgroundMusic();
      }
    }
  };

  const setVolume = async (newVolume: number) => {
    setVolumeState(newVolume);
    await AsyncStorage.setItem(VOLUME_STORAGE_KEY, newVolume.toString());
    
    if (soundRef.current) {
      await soundRef.current.setVolumeAsync(newVolume);
    }
  };

  const startBackgroundMusic = useCallback(async () => {
    console.log('startBackgroundMusic called, selectedMusic:', selectedMusic);
    if (selectedMusic === 'none') {
      console.log('Background music is set to none, skipping');
      return;
    }

    try {
      if (soundRef.current) {
        console.log('Unloading previous background music');
        await soundRef.current.unloadAsync();
      }

      console.log('Loading background music:', selectedMusic);
      const { sound } = await Audio.Sound.createAsync(
        AUDIO_FILES[selectedMusic],
        {
          isLooping: true,
          volume: volume,
          shouldPlay: true,
        }
      );
      
      soundRef.current = sound;
      setIsPlaying(true);
      console.log('Background music started successfully');
    } catch (error) {
      console.error('Error starting background music:', error);
    }
  }, [selectedMusic, volume]);

  const stopBackgroundMusic = useCallback(async () => {
    try {
      if (soundRef.current) {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
      setIsPlaying(false);
    } catch (error) {
      console.error('Error stopping background music:', error);
    }
  }, []);

  return (
    <BackgroundMusicContext.Provider
      value={{
        selectedMusic,
        setSelectedMusic,
        volume,
        setVolume,
        isPlaying,
        startBackgroundMusic,
        stopBackgroundMusic,
      }}
    >
      {children}
    </BackgroundMusicContext.Provider>
  );
}

export function useBackgroundMusic() {
  const context = useContext(BackgroundMusicContext);
  if (!context) {
    throw new Error('useBackgroundMusic must be used within BackgroundMusicProvider');
  }
  return context;
}
