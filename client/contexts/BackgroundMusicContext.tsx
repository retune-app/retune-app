import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type BackgroundMusicType = 
  | 'none'
  | 'rain-soft'
  | 'rain-calming'
  | 'rain-gentle'
  | 'ocean-waves-short'
  | 'ocean-waves-beach'
  | 'ocean-birdsong'
  | 'forest-birds-morning'
  | 'forest-rain-birds'
  | 'forest-night'
  | 'meditation-forest-melody'
  | 'meditation-morning-mist'
  | 'meditation-singing-bowls'
  | 'meditation-gentle-chimes'
  | 'meditation-deep-drone'
  | 'solfeggio-432hz'
  | 'solfeggio-528hz'
  | 'solfeggio-396hz'
  | 'solfeggio-741hz'
  | 'binaural-theta'
  | 'binaural-alpha'
  | 'binaural-delta'
  | 'binaural-beta'
  | 'noise-white'
  | 'noise-pink'
  | 'noise-brown';

export interface BackgroundMusicOption {
  id: BackgroundMusicType;
  name: string;
  description: string;
  category: 'rain' | 'ocean' | 'forest' | 'meditation' | 'solfeggio' | 'binaural' | 'noise';
  icon: string;
}

export const BACKGROUND_MUSIC_OPTIONS: BackgroundMusicOption[] = [
  { id: 'rain-soft', name: 'Soft Rain', description: 'Gentle rain for deep relaxation', category: 'rain', icon: 'cloud-rain' },
  { id: 'rain-calming', name: 'Calming Rain', description: 'Tropical rain ambience', category: 'rain', icon: 'cloud-drizzle' },
  { id: 'rain-gentle', name: 'Gentle Rain', description: 'Light, peaceful rainfall', category: 'rain', icon: 'cloud' },
  { id: 'ocean-waves-short', name: 'Ocean Waves', description: 'Powerful sea & storm waves', category: 'ocean', icon: 'droplet' },
  { id: 'ocean-waves-beach', name: 'Beach Waves', description: 'Waves rolling on the shore', category: 'ocean', icon: 'anchor' },
  { id: 'ocean-birdsong', name: 'Ocean & Birds', description: 'Coastal waves with seabirds', category: 'ocean', icon: 'sunrise' },
  { id: 'forest-birds-morning', name: 'Morning Birds', description: 'Dawn chorus birdsong', category: 'forest', icon: 'feather' },
  { id: 'forest-rain-birds', name: 'Forest Rain', description: 'Rain & birds in the forest', category: 'forest', icon: 'cloud-rain' },
  { id: 'forest-night', name: 'Rainforest', description: 'Deep rainforest ambience', category: 'forest', icon: 'moon' },
  { id: 'meditation-forest-melody', name: 'Forest Melody', description: 'Ambient meditation music', category: 'meditation', icon: 'heart' },
  { id: 'meditation-morning-mist', name: 'Morning Mist', description: 'Ethereal meditation pad', category: 'meditation', icon: 'sun' },
  { id: 'meditation-singing-bowls', name: 'Singing Bowls', description: 'Tibetan bowl resonance', category: 'meditation', icon: 'target' },
  { id: 'meditation-gentle-chimes', name: 'Gentle Chimes', description: 'Wind chimes with ambient pad', category: 'meditation', icon: 'bell' },
  { id: 'meditation-deep-drone', name: 'Deep Drone', description: 'Warm ambient drone', category: 'meditation', icon: 'disc' },
  { id: 'solfeggio-432hz', name: '432Hz Healing', description: 'Universal harmony frequency', category: 'solfeggio', icon: 'heart' },
  { id: 'solfeggio-528hz', name: '528Hz Love', description: 'DNA repair frequency', category: 'solfeggio', icon: 'sun' },
  { id: 'solfeggio-396hz', name: '396Hz Liberation', description: 'Freedom from fear & guilt', category: 'solfeggio', icon: 'shield' },
  { id: 'solfeggio-741hz', name: '741Hz Intuition', description: 'Awakening inner vision', category: 'solfeggio', icon: 'eye' },
  { id: 'binaural-theta', name: 'Theta Waves', description: 'Deep meditation (6Hz)', category: 'binaural', icon: 'moon' },
  { id: 'binaural-alpha', name: 'Alpha Waves', description: 'Calm focus (10Hz)', category: 'binaural', icon: 'sunrise' },
  { id: 'binaural-delta', name: 'Delta Waves', description: 'Deep sleep (2Hz)', category: 'binaural', icon: 'cloud' },
  { id: 'binaural-beta', name: 'Beta Waves', description: 'Active focus (18Hz)', category: 'binaural', icon: 'zap' },
  { id: 'noise-white', name: 'White Noise', description: 'Full-spectrum background noise', category: 'noise', icon: 'radio' },
  { id: 'noise-pink', name: 'Pink Noise', description: 'Balanced, natural sound', category: 'noise', icon: 'speaker' },
  { id: 'noise-brown', name: 'Brown Noise', description: 'Deep, warm low-frequency', category: 'noise', icon: 'volume-2' },
];

export const getSoundsByCategory = () => {
  const rain = BACKGROUND_MUSIC_OPTIONS.filter(o => o.category === 'rain');
  const ocean = BACKGROUND_MUSIC_OPTIONS.filter(o => o.category === 'ocean');
  const forest = BACKGROUND_MUSIC_OPTIONS.filter(o => o.category === 'forest');
  const meditation = BACKGROUND_MUSIC_OPTIONS.filter(o => o.category === 'meditation');
  const binaural = BACKGROUND_MUSIC_OPTIONS.filter(o => o.category === 'binaural');
  const solfeggio = BACKGROUND_MUSIC_OPTIONS.filter(o => o.category === 'solfeggio');
  const noise = BACKGROUND_MUSIC_OPTIONS.filter(o => o.category === 'noise');
  return { rain, ocean, forest, meditation, binaural, solfeggio, noise };
};

const AUDIO_FILES: Record<Exclude<BackgroundMusicType, 'none'>, any> = {
  'rain-soft': require('../../assets/audio/rain-soft.mp3'),
  'rain-calming': require('../../assets/audio/rain-calming.mp3'),
  'rain-gentle': require('../../assets/audio/rain-gentle.mp3'),
  'ocean-waves-short': require('../../assets/audio/ocean-waves-short.mp3'),
  'ocean-waves-beach': require('../../assets/audio/ocean-waves-beach.mp3'),
  'ocean-birdsong': require('../../assets/audio/ocean-birdsong.mp3'),
  'forest-birds-morning': require('../../assets/audio/forest-birds-morning.mp3'),
  'forest-rain-birds': require('../../assets/audio/forest-rain-birds.mp3'),
  'forest-night': require('../../assets/audio/forest-night.mp3'),
  'meditation-forest-melody': require('../../assets/audio/meditation-forest-melody.mp3'),
  'meditation-morning-mist': require('../../assets/audio/meditation-morning-mist.mp3'),
  'meditation-singing-bowls': require('../../assets/audio/meditation-singing-bowls.mp3'),
  'meditation-gentle-chimes': require('../../assets/audio/meditation-gentle-chimes.mp3'),
  'meditation-deep-drone': require('../../assets/audio/meditation-deep-drone.mp3'),
  'solfeggio-432hz': require('../../assets/audio/solfeggio-432hz.mp3'),
  'solfeggio-528hz': require('../../assets/audio/solfeggio-528hz.mp3'),
  'solfeggio-396hz': require('../../assets/audio/solfeggio-396hz.mp3'),
  'solfeggio-741hz': require('../../assets/audio/solfeggio-741hz.mp3'),
  'binaural-theta': require('../../assets/audio/binaural-theta.mp3'),
  'binaural-alpha': require('../../assets/audio/binaural-alpha.mp3'),
  'binaural-delta': require('../../assets/audio/binaural-delta.mp3'),
  'binaural-beta': require('../../assets/audio/binaural-beta.mp3'),
  'noise-white': require('../../assets/audio/noise-white.mp3'),
  'noise-pink': require('../../assets/audio/noise-pink.mp3'),
  'noise-brown': require('../../assets/audio/noise-brown.mp3'),
};

export const getAudioFile = (type: Exclude<BackgroundMusicType, 'none'>) => AUDIO_FILES[type];

const STORAGE_KEY = '@rewired_background_music';
const VOLUME_STORAGE_KEY = '@rewired_background_music_volume';

function applyVolumeCurve(linearVolume: number): number {
  return Math.pow(linearVolume, 3);
}

const DUCK_FACTOR = 0.4;

interface BackgroundMusicContextType {
  selectedMusic: BackgroundMusicType;
  setSelectedMusic: (type: BackgroundMusicType) => Promise<void>;
  volume: number;
  setVolume: (volume: number) => Promise<void>;
  isPlaying: boolean;
  isDucked: boolean;
  setDucked: (ducked: boolean) => Promise<void>;
  startBackgroundMusic: () => Promise<void>;
  stopBackgroundMusic: () => Promise<void>;
}

const BackgroundMusicContext = createContext<BackgroundMusicContextType | undefined>(undefined);

export function BackgroundMusicProvider({ children }: { children: React.ReactNode }) {
  const [selectedMusic, setSelectedMusicState] = useState<BackgroundMusicType>('forest-night');
  const [volume, setVolumeState] = useState(0.25);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isDucked, setIsDucked] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);
  const isDuckedRef = useRef(false);

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
      } else {
        await AsyncStorage.setItem(STORAGE_KEY, 'forest-night');
        setSelectedMusicState('forest-night');
      }
      
      if (savedVolume) {
        setVolumeState(parseFloat(savedVolume));
      } else {
        await AsyncStorage.setItem(VOLUME_STORAGE_KEY, '0.25');
        setVolumeState(0.25);
      }
    } catch (error) {
      console.error('Error loading background music preferences:', error);
    }
  };

  const setSelectedMusic = async (type: BackgroundMusicType) => {
    const wasPlaying = isPlaying;
    setSelectedMusicState(type);
    await AsyncStorage.setItem(STORAGE_KEY, type);
    
    if (soundRef.current) {
      await soundRef.current.stopAsync();
      await soundRef.current.unloadAsync();
      soundRef.current = null;
      setIsPlaying(false);
    }

    if (wasPlaying && type !== 'none') {
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: true,
          shouldDuckAndroid: true,
        });

        const { sound } = await Audio.Sound.createAsync(
          AUDIO_FILES[type],
          {
            isLooping: true,
            volume: applyVolumeCurve(volume),
            shouldPlay: true,
          }
        );
        soundRef.current = sound;
        setIsPlaying(true);
      } catch (error) {
        console.error('Error switching background music:', error);
      }
    }
  };

  const setVolume = async (newVolume: number) => {
    setVolumeState(newVolume);
    await AsyncStorage.setItem(VOLUME_STORAGE_KEY, newVolume.toString());
    
    if (soundRef.current) {
      const effectiveVolume = isDuckedRef.current ? newVolume * DUCK_FACTOR : newVolume;
      await soundRef.current.setVolumeAsync(applyVolumeCurve(effectiveVolume));
    }
  };

  const setDucked = useCallback(async (ducked: boolean) => {
    isDuckedRef.current = ducked;
    setIsDucked(ducked);
    if (soundRef.current) {
      const effectiveVolume = ducked ? volume * DUCK_FACTOR : volume;
      await soundRef.current.setVolumeAsync(applyVolumeCurve(effectiveVolume));
    }
  }, [volume]);

  const startBackgroundMusic = useCallback(async () => {
    if (selectedMusic === 'none') {
      return;
    }

    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: true,
      });

      if (soundRef.current) {
        await soundRef.current.unloadAsync();
      }

      const effectiveVolume = isDuckedRef.current ? volume * DUCK_FACTOR : volume;
      const { sound } = await Audio.Sound.createAsync(
        AUDIO_FILES[selectedMusic],
        {
          isLooping: true,
          volume: applyVolumeCurve(effectiveVolume),
          shouldPlay: true,
        }
      );
      
      soundRef.current = sound;
      setIsPlaying(true);
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
        isDucked,
        setDucked,
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
