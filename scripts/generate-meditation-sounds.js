#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SAMPLE_RATE = 44100;
const DURATION = 180;
const OUTPUT_DIR = path.join(__dirname, '..', 'assets', 'audio');
const MASTER_VOLUME = 0.3;

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

function generateSineWave(frequency, sampleIndex, sampleRate) {
  return Math.sin(2 * Math.PI * frequency * sampleIndex / sampleRate);
}

function applyEnvelope(samples, fadeSeconds = 2.0) {
  const fadeSamples = Math.floor(fadeSeconds * SAMPLE_RATE);
  for (let i = 0; i < fadeSamples && i < samples.length; i++) {
    samples[i] *= i / fadeSamples;
  }
  for (let i = 0; i < fadeSamples && i < samples.length; i++) {
    const idx = samples.length - 1 - i;
    samples[idx] *= i / fadeSamples;
  }
  return samples;
}

function applyCrossfade(samples, crossfadeSeconds = 3.0) {
  const crossfadeSamples = Math.floor(crossfadeSeconds * SAMPLE_RATE);
  for (let i = 0; i < crossfadeSamples; i++) {
    const t = i / crossfadeSamples;
    const endIdx = samples.length - crossfadeSamples + i;
    const blended = samples[i] * t + samples[endIdx] * (1 - t);
    samples[i] = blended;
    samples[endIdx] = blended;
  }
  return samples;
}

function floatTo16BitPCM(samples) {
  const buffer = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    const val = s < 0 ? s * 0x8000 : s * 0x7FFF;
    buffer.writeInt16LE(Math.floor(val), i * 2);
  }
  return buffer;
}

function createWavHeader(dataLength, numChannels = 1) {
  const header = Buffer.alloc(44);
  const byteRate = SAMPLE_RATE * numChannels * 2;
  const blockAlign = numChannels * 2;
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataLength, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataLength, 40);
  return header;
}

function writeMonoWav(filename, samples) {
  const pcmData = floatTo16BitPCM(samples);
  const header = createWavHeader(pcmData.length, 1);
  const filePath = path.join(OUTPUT_DIR, filename);
  fs.writeFileSync(filePath, Buffer.concat([header, pcmData]));
  console.log(`  Generated WAV: ${filename} (${(fs.statSync(filePath).size / 1024 / 1024).toFixed(2)} MB)`);
  return filePath;
}

function convertToMp3(wavPath, mp3Filename) {
  const mp3Path = path.join(OUTPUT_DIR, mp3Filename);
  try {
    execSync(`ffmpeg -y -i "${wavPath}" -b:a 128k "${mp3Path}"`, { stdio: 'pipe' });
    fs.unlinkSync(wavPath);
    const size = fs.statSync(mp3Path).size / 1024 / 1024;
    console.log(`  Converted to MP3: ${mp3Filename} (${size.toFixed(2)} MB)`);
  } catch (err) {
    console.error(`  Error converting ${mp3Filename}:`, err.message);
  }
}

function seededRandom(seed) {
  let s = seed;
  return function () {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

function generateSingingBowls() {
  console.log('\n1. Generating Singing Bowls...');
  const totalSamples = SAMPLE_RATE * DURATION;
  const samples = new Float32Array(totalSamples);

  const bowls = [
    { freq: 260, amp: 0.35, lfoRate: 0.05, lfoDepth: 0.3 },
    { freq: 396, amp: 0.30, lfoRate: 0.04, lfoDepth: 0.25 },
    { freq: 528, amp: 0.25, lfoRate: 0.06, lfoDepth: 0.2 },
  ];

  for (let i = 0; i < totalSamples; i++) {
    let sample = 0;
    for (const bowl of bowls) {
      const lfo = 1 + generateSineWave(bowl.lfoRate, i, SAMPLE_RATE) * bowl.lfoDepth;

      let tone = generateSineWave(bowl.freq, i, SAMPLE_RATE) * 0.6;
      tone += generateSineWave(bowl.freq * 1.003, i, SAMPLE_RATE) * 0.15;
      tone += generateSineWave(bowl.freq * 0.997, i, SAMPLE_RATE) * 0.15;
      tone += generateSineWave(bowl.freq * 2, i, SAMPLE_RATE) * 0.12;
      tone += generateSineWave(bowl.freq * 3, i, SAMPLE_RATE) * 0.06;
      tone += generateSineWave(bowl.freq * 4, i, SAMPLE_RATE) * 0.03;

      sample += tone * bowl.amp * lfo;
    }
    samples[i] = sample * MASTER_VOLUME;
  }

  applyCrossfade(samples, 3.0);
  applyEnvelope(samples, 2.0);

  const wavPath = writeMonoWav('meditation-singing-bowls.wav', samples);
  convertToMp3(wavPath, 'meditation-singing-bowls.mp3');
}

function generateGentleChimes() {
  console.log('\n2. Generating Gentle Chimes...');
  const totalSamples = SAMPLE_RATE * DURATION;
  const samples = new Float32Array(totalSamples);
  const rand = seededRandom(42);

  for (let i = 0; i < totalSamples; i++) {
    let pad = generateSineWave(200, i, SAMPLE_RATE) * 0.3;
    pad += generateSineWave(400, i, SAMPLE_RATE) * 0.1;
    pad += generateSineWave(300, i, SAMPLE_RATE) * 0.08;
    const padLfo = 1 + generateSineWave(0.08, i, SAMPLE_RATE) * 0.15;
    samples[i] = pad * padLfo * MASTER_VOLUME;
  }

  const chimeCount = 120;
  for (let c = 0; c < chimeCount; c++) {
    const startTime = rand() * (DURATION - 4);
    const freq = 800 + rand() * 1200;
    const startSample = Math.floor(startTime * SAMPLE_RATE);
    const attackSamples = Math.floor(0.01 * SAMPLE_RATE);
    const decaySamples = Math.floor((1.5 + rand() * 2.5) * SAMPLE_RATE);
    const totalChimeSamples = attackSamples + decaySamples;
    const chimeAmp = 0.1 + rand() * 0.15;

    for (let i = 0; i < totalChimeSamples; i++) {
      const idx = startSample + i;
      if (idx >= totalSamples) break;

      let env;
      if (i < attackSamples) {
        env = i / attackSamples;
      } else {
        const decayPos = (i - attackSamples) / decaySamples;
        env = Math.exp(-4 * decayPos);
      }

      let tone = generateSineWave(freq, i, SAMPLE_RATE) * 0.7;
      tone += generateSineWave(freq * 2.0, i, SAMPLE_RATE) * 0.2;
      tone += generateSineWave(freq * 3.0, i, SAMPLE_RATE) * 0.1;

      samples[idx] += tone * env * chimeAmp * MASTER_VOLUME;
    }
  }

  applyCrossfade(samples, 3.0);
  applyEnvelope(samples, 2.0);

  const wavPath = writeMonoWav('meditation-gentle-chimes.wav', samples);
  convertToMp3(wavPath, 'meditation-gentle-chimes.mp3');
}

function generateDeepDrone() {
  console.log('\n3. Generating Deep Drone...');
  const totalSamples = SAMPLE_RATE * DURATION;
  const samples = new Float32Array(totalSamples);

  for (let i = 0; i < totalSamples; i++) {
    const lfo1 = 1 + generateSineWave(0.03, i, SAMPLE_RATE) * 0.2;
    const lfo2 = 1 + generateSineWave(0.05, i, SAMPLE_RATE) * 0.15;
    const lfo3 = 1 + generateSineWave(0.07, i, SAMPLE_RATE) * 0.1;

    let drone = 0;
    drone += generateSineWave(60, i, SAMPLE_RATE) * 0.35 * lfo1;
    drone += generateSineWave(90, i, SAMPLE_RATE) * 0.25 * lfo2;
    drone += generateSineWave(120, i, SAMPLE_RATE) * 0.20 * lfo3;

    drone += generateSineWave(180, i, SAMPLE_RATE) * 0.08;
    drone += generateSineWave(240, i, SAMPLE_RATE) * 0.05;
    drone += generateSineWave(360, i, SAMPLE_RATE) * 0.03;

    const tremolo = 1 + generateSineWave(0.2, i, SAMPLE_RATE) * 0.4;
    const shimmer = generateSineWave(800, i, SAMPLE_RATE) * 0.04 * tremolo;
    const shimmer2 = generateSineWave(1200, i, SAMPLE_RATE) * 0.02 * tremolo;

    samples[i] = (drone + shimmer + shimmer2) * MASTER_VOLUME;
  }

  applyCrossfade(samples, 3.0);
  applyEnvelope(samples, 2.0);

  const wavPath = writeMonoWav('meditation-deep-drone.wav', samples);
  convertToMp3(wavPath, 'meditation-deep-drone.mp3');
}

console.log('Generating meditation audio tracks...');
console.log(`Duration: ${DURATION}s | Sample rate: ${SAMPLE_RATE}Hz | Volume: ${MASTER_VOLUME}`);

generateSingingBowls();
generateGentleChimes();
generateDeepDrone();

console.log('\nDone! All meditation tracks generated.');
