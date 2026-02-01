#!/usr/bin/env node
/**
 * Generate precise frequency audio files for meditation
 * - Solfeggio frequencies (432Hz, 528Hz) as pure tones with harmonics
 * - Binaural beats with stereo separation for brainwave entrainment
 */

const fs = require('fs');
const path = require('path');

const SAMPLE_RATE = 44100;
const DURATION = 22; // seconds
const OUTPUT_DIR = path.join(__dirname, '..', 'assets', 'audio');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * Generate a sine wave sample at a given frequency
 */
function generateSineWave(frequency, sampleIndex, sampleRate) {
  return Math.sin(2 * Math.PI * frequency * sampleIndex / sampleRate);
}

/**
 * Apply fade in/out to avoid clicks
 */
function applyEnvelope(samples, fadeSeconds = 0.5) {
  const fadeSamples = Math.floor(fadeSeconds * SAMPLE_RATE);
  
  for (let i = 0; i < fadeSamples && i < samples.length; i++) {
    const fadeIn = i / fadeSamples;
    samples[i] *= fadeIn;
  }
  
  for (let i = 0; i < fadeSamples && i < samples.length; i++) {
    const idx = samples.length - 1 - i;
    const fadeOut = i / fadeSamples;
    samples[idx] *= fadeOut;
  }
  
  return samples;
}

/**
 * Generate a solfeggio frequency tone with subtle harmonics for richness
 */
function generateSolfeggioTone(frequency) {
  const totalSamples = SAMPLE_RATE * DURATION;
  const samples = new Float32Array(totalSamples);
  
  for (let i = 0; i < totalSamples; i++) {
    // Fundamental frequency (main tone)
    let sample = generateSineWave(frequency, i, SAMPLE_RATE) * 0.7;
    
    // Add subtle harmonics for warmth
    sample += generateSineWave(frequency * 2, i, SAMPLE_RATE) * 0.15; // 2nd harmonic
    sample += generateSineWave(frequency * 3, i, SAMPLE_RATE) * 0.08; // 3rd harmonic
    sample += generateSineWave(frequency * 4, i, SAMPLE_RATE) * 0.04; // 4th harmonic
    
    // Add very subtle low-frequency modulation for movement
    const lfoFreq = 0.1; // 0.1 Hz for slow pulse
    const lfo = 1 + generateSineWave(lfoFreq, i, SAMPLE_RATE) * 0.05;
    sample *= lfo;
    
    samples[i] = sample * 0.8; // Master volume
  }
  
  return applyEnvelope(samples, 1.0);
}

/**
 * Generate binaural beat with carrier frequency and beat frequency difference
 * Left and right channels have slightly different frequencies
 */
function generateBinauralBeat(carrierFreq, beatFreq) {
  const totalSamples = SAMPLE_RATE * DURATION;
  const leftChannel = new Float32Array(totalSamples);
  const rightChannel = new Float32Array(totalSamples);
  
  // Left ear gets carrier frequency
  // Right ear gets carrier + beat frequency
  const leftFreq = carrierFreq;
  const rightFreq = carrierFreq + beatFreq;
  
  for (let i = 0; i < totalSamples; i++) {
    // Pure sine waves for each ear
    leftChannel[i] = generateSineWave(leftFreq, i, SAMPLE_RATE) * 0.7;
    rightChannel[i] = generateSineWave(rightFreq, i, SAMPLE_RATE) * 0.7;
    
    // Add subtle ambient pad for pleasantness (same in both channels)
    const ambientFreq = carrierFreq / 4; // Sub-bass
    const ambient = generateSineWave(ambientFreq, i, SAMPLE_RATE) * 0.1;
    leftChannel[i] += ambient;
    rightChannel[i] += ambient;
  }
  
  return {
    left: applyEnvelope(leftChannel, 1.0),
    right: applyEnvelope(rightChannel, 1.0)
  };
}

/**
 * Convert float samples to 16-bit PCM
 */
function floatTo16BitPCM(samples) {
  const buffer = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    const val = s < 0 ? s * 0x8000 : s * 0x7FFF;
    buffer.writeInt16LE(Math.floor(val), i * 2);
  }
  return buffer;
}

/**
 * Create WAV file header
 */
function createWavHeader(dataLength, numChannels = 1) {
  const header = Buffer.alloc(44);
  const byteRate = SAMPLE_RATE * numChannels * 2; // 16-bit = 2 bytes
  const blockAlign = numChannels * 2;
  
  // RIFF header
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataLength, 4);
  header.write('WAVE', 8);
  
  // fmt chunk
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // chunk size
  header.writeUInt16LE(1, 20); // audio format (PCM)
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(16, 34); // bits per sample
  
  // data chunk
  header.write('data', 36);
  header.writeUInt32LE(dataLength, 40);
  
  return header;
}

/**
 * Write mono WAV file
 */
function writeMonoWav(filename, samples) {
  const pcmData = floatTo16BitPCM(samples);
  const header = createWavHeader(pcmData.length, 1);
  const filePath = path.join(OUTPUT_DIR, filename);
  
  fs.writeFileSync(filePath, Buffer.concat([header, pcmData]));
  console.log(`Generated: ${filename} (${(pcmData.length / 1024).toFixed(1)} KB)`);
}

/**
 * Write stereo WAV file
 */
function writeStereoWav(filename, leftChannel, rightChannel) {
  // Interleave left and right channels
  const interleaved = new Float32Array(leftChannel.length * 2);
  for (let i = 0; i < leftChannel.length; i++) {
    interleaved[i * 2] = leftChannel[i];
    interleaved[i * 2 + 1] = rightChannel[i];
  }
  
  const pcmData = floatTo16BitPCM(interleaved);
  const header = createWavHeader(pcmData.length, 2);
  const filePath = path.join(OUTPUT_DIR, filename);
  
  fs.writeFileSync(filePath, Buffer.concat([header, pcmData]));
  console.log(`Generated: ${filename} (${(pcmData.length / 1024).toFixed(1)} KB)`);
}

// Generate all frequency files
console.log('Generating precise frequency audio files...\n');

// Solfeggio frequencies
console.log('=== Solfeggio Frequencies ===');
const solfeggio432 = generateSolfeggioTone(432);
writeMonoWav('432hz-healing.wav', solfeggio432);

const solfeggio528 = generateSolfeggioTone(528);
writeMonoWav('528hz-love.wav', solfeggio528);

// Binaural beats (using 200Hz carrier for comfortable listening)
console.log('\n=== Binaural Beats ===');
const CARRIER_FREQ = 200; // Base frequency

// Theta waves (4-8 Hz) - Deep meditation, creativity
const theta = generateBinauralBeat(CARRIER_FREQ, 6);
writeStereoWav('theta-waves.wav', theta.left, theta.right);
console.log('  Theta: 200Hz left, 206Hz right = 6Hz beat (deep meditation)');

// Alpha waves (8-13 Hz) - Relaxed focus
const alpha = generateBinauralBeat(CARRIER_FREQ, 10);
writeStereoWav('alpha-waves.wav', alpha.left, alpha.right);
console.log('  Alpha: 200Hz left, 210Hz right = 10Hz beat (relaxed focus)');

// Delta waves (0.5-4 Hz) - Deep sleep
const delta = generateBinauralBeat(CARRIER_FREQ, 2);
writeStereoWav('delta-waves.wav', delta.left, delta.right);
console.log('  Delta: 200Hz left, 202Hz right = 2Hz beat (deep sleep)');

// Beta waves (13-30 Hz) - Alertness, concentration
const beta = generateBinauralBeat(CARRIER_FREQ, 18);
writeStereoWav('beta-waves.wav', beta.left, beta.right);
console.log('  Beta: 200Hz left, 218Hz right = 18Hz beat (focus/concentration)');

console.log('\nDone! All frequency files generated.');
