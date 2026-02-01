#!/usr/bin/env python3
"""
Generate binaural beats audio files for Rewired app.
Creates loopable ambient background tracks with healing frequencies.
"""

import numpy as np
from scipy.io import wavfile
import os

# Audio parameters
SAMPLE_RATE = 44100
DURATION = 30  # 30 seconds - will loop seamlessly (smaller file size for mobile)
AMPLITUDE = 0.3  # Volume level (0-1)

# Output directory
OUTPUT_DIR = "assets/audio"

def generate_binaural_beat(base_freq, beat_freq, duration, sample_rate=SAMPLE_RATE, amplitude=AMPLITUDE):
    """
    Generate a binaural beat audio.
    
    Args:
        base_freq: Base carrier frequency (e.g., 432Hz)
        beat_freq: Desired binaural beat frequency (e.g., 6Hz for theta)
        duration: Duration in seconds
        sample_rate: Audio sample rate
        amplitude: Volume level (0-1)
    
    Returns:
        Stereo numpy array (left, right channels)
    """
    t = np.linspace(0, duration, int(sample_rate * duration), dtype=np.float32)
    
    # Left ear: base frequency
    left = amplitude * np.sin(2 * np.pi * base_freq * t)
    
    # Right ear: base frequency + beat frequency
    right = amplitude * np.sin(2 * np.pi * (base_freq + beat_freq) * t)
    
    # Apply fade in/out to make looping smoother
    fade_samples = int(sample_rate * 0.5)  # 0.5 second fade
    fade_in = np.linspace(0, 1, fade_samples)
    fade_out = np.linspace(1, 0, fade_samples)
    
    left[:fade_samples] *= fade_in
    left[-fade_samples:] *= fade_out
    right[:fade_samples] *= fade_in
    right[-fade_samples:] *= fade_out
    
    # Stack as stereo (2 channels)
    stereo = np.column_stack((left, right))
    
    return stereo

def generate_pure_tone(freq, duration, sample_rate=SAMPLE_RATE, amplitude=AMPLITUDE):
    """
    Generate a pure tone (monaural) at a specific frequency.
    Good for 432Hz and 528Hz pure tones.
    """
    t = np.linspace(0, duration, int(sample_rate * duration), dtype=np.float32)
    
    # Generate the tone with slight harmonic overtones for richer sound
    tone = amplitude * 0.7 * np.sin(2 * np.pi * freq * t)
    tone += amplitude * 0.2 * np.sin(2 * np.pi * freq * 2 * t)  # 2nd harmonic
    tone += amplitude * 0.1 * np.sin(2 * np.pi * freq * 3 * t)  # 3rd harmonic
    
    # Apply fade
    fade_samples = int(sample_rate * 0.5)
    fade_in = np.linspace(0, 1, fade_samples)
    fade_out = np.linspace(1, 0, fade_samples)
    
    tone[:fade_samples] *= fade_in
    tone[-fade_samples:] *= fade_out
    
    # Stereo (same on both channels)
    stereo = np.column_stack((tone, tone))
    
    return stereo

def save_wav(filename, audio, sample_rate=SAMPLE_RATE):
    """Save audio array to WAV file."""
    # Normalize to 16-bit range
    audio_normalized = np.int16(audio * 32767)
    filepath = os.path.join(OUTPUT_DIR, filename)
    wavfile.write(filepath, sample_rate, audio_normalized)
    print(f"Created: {filepath}")

def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    print("Generating binaural beats audio files...")
    print(f"Duration: {DURATION} seconds each")
    print(f"Sample rate: {SAMPLE_RATE}Hz")
    print()
    
    # 1. 432Hz Pure Tone - "Universal healing frequency"
    print("1. Generating 432Hz Pure Tone...")
    audio_432 = generate_pure_tone(432, DURATION)
    save_wav("432hz-healing.wav", audio_432)
    
    # 2. 528Hz Pure Tone - "Love frequency" (Solfeggio)
    print("2. Generating 528Hz Pure Tone...")
    audio_528 = generate_pure_tone(528, DURATION)
    save_wav("528hz-love.wav", audio_528)
    
    # 3. Theta Waves (6Hz) with 200Hz carrier - Deep meditation
    print("3. Generating Theta Waves (6Hz)...")
    audio_theta = generate_binaural_beat(200, 6, DURATION)
    save_wav("theta-waves.wav", audio_theta)
    
    # 4. Alpha Waves (10Hz) with 200Hz carrier - Relaxation
    print("4. Generating Alpha Waves (10Hz)...")
    audio_alpha = generate_binaural_beat(200, 10, DURATION)
    save_wav("alpha-waves.wav", audio_alpha)
    
    # 5. Delta Waves (2Hz) with 150Hz carrier - Deep sleep
    print("5. Generating Delta Waves (2Hz)...")
    audio_delta = generate_binaural_beat(150, 2, DURATION)
    save_wav("delta-waves.wav", audio_delta)
    
    # 6. Beta Waves (18Hz) with 250Hz carrier - Focus/concentration
    print("6. Generating Beta Waves (18Hz)...")
    audio_beta = generate_binaural_beat(250, 18, DURATION)
    save_wav("beta-waves.wav", audio_beta)
    
    print()
    print("All audio files generated successfully!")
    print(f"Files saved to: {OUTPUT_DIR}/")

if __name__ == "__main__":
    main()
