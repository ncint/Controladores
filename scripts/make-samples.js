// Gera amostras de bateria por síntese (estilo 808/909) como WAV 16-bit.
// Amostras criadas pelo próprio projeto — sem restrições de redistribuição.
const fs = require('fs');
const path = require('path');

const SR = 44100;
const OUT = path.join(__dirname, '..', 'samples');

function writeWav(name, data) {
  const n = data.length;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const v = Math.max(-1, Math.min(1, data[i]));
    buf.writeInt16LE(Math.round(v * 32767), 44 + i * 2);
  }
  fs.writeFileSync(path.join(OUT, name), buf);
  console.log(name, (buf.length / 1024).toFixed(1) + 'KB');
}

const seconds = (s) => Math.floor(s * SR);
const env = (t, decay) => Math.exp(-t / decay);

function kick(startFreq, endFreq, pitchDecay, ampDecay, click) {
  const n = seconds(0.6);
  const out = new Float32Array(n);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const f = endFreq + (startFreq - endFreq) * Math.exp(-t / pitchDecay);
    phase += (2 * Math.PI * f) / SR;
    let v = Math.sin(phase) * Math.exp(-t / ampDecay);
    if (click > 0 && t < 0.004) v += (Math.random() * 2 - 1) * click * (1 - t / 0.004);
    out[i] = v;
  }
  return out;
}

function snare(toneFreq, toneDur, noiseHp, noiseLevel, toneLevel, decay) {
  const n = seconds(0.35);
  const out = new Float32Array(n);
  let phase = 0;
  let prev = 0, prev2 = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    phase += (2 * Math.PI * toneFreq) / SR;
    const tone = Math.sin(phase) * Math.exp(-t / toneDur) * toneLevel;
    const raw = Math.random() * 2 - 1;
    const hp = raw - prev; prev = raw;
    const hp2 = hp - prev2; prev2 = hp;
    const noise = hp2 * Math.exp(-t / decay) * noiseLevel * 1.4;
    out[i] = tone + noise;
  }
  return out;
}

function hat(dur, base, hpLevel) {
  const n = seconds(dur + 0.05);
  const ratios = [2, 3, 4.16, 5.43, 6.79, 8.21];
  const freqs = ratios.map((r) => base * r);
  const phases = new Array(6).fill(0);
  const bpState = [0, 0];
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let v = 0;
    for (let k = 0; k < 6; k++) {
      phases[k] += (2 * Math.PI * freqs[k]) / SR;
      v += Math.sign(Math.sin(phases[k]));
    }
    v /= 6;
    // bandpass around 10k
    const a = 0.4;
    bpState[0] = (1 - a) * bpState[0] + a * v;
    bpState[1] = (1 - a) * bpState[1] + a * bpState[0];
    let hp = v - 2 * bpState[1] + bpState[0];
    out[i] = hp * hpLevel * Math.exp(-t / (dur * 0.4));
  }
  return out;
}

function clap(decay, spread) {
  const n = seconds(0.4);
  const out = new Float32Array(n);
  const bursts = [0, spread, spread * 2];
  let bp1 = 0, bp2 = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let envv = 0;
    for (const b of bursts) {
      if (t >= b && t < b + 0.012) envv = Math.max(envv, 1);
    }
    if (t >= bursts[2] + 0.012) envv = Math.exp(-(t - bursts[2]) / decay);
    const raw = Math.random() * 2 - 1;
    const a = 0.15;
    bp1 = (1 - a) * bp1 + a * raw;
    bp2 = (1 - a) * bp2 + a * bp1;
    const bp = raw - bp2;
    out[i] = bp * envv * 1.6;
  }
  return out;
}

function tom(startFreq, endFreq, decay) {
  const n = seconds(0.6);
  const out = new Float32Array(n);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const f = endFreq + (startFreq - endFreq) * Math.exp(-t / 0.08);
    phase += (2 * Math.PI * f) / SR;
    out[i] = Math.sin(phase) * Math.exp(-t / decay);
  }
  return out;
}

function normalize(data, peak = 0.9) {
  let max = 0;
  for (const v of data) max = Math.max(max, Math.abs(v));
  if (max > 0) {
    const g = peak / max;
    for (let i = 0; i < data.length; i++) data[i] *= g;
  }
  return data;
}

fs.mkdirSync(OUT, { recursive: true });

// 808
writeWav('kick808.wav', normalize(kick(120, 44, 0.06, 0.35, 0.15)));
writeWav('snare808.wav', normalize(snare(180, 0.06, 1800, 0.55, 0.25, 0.09)));
writeWav('hatClosed808.wav', normalize(hat(0.06, 263, 0.8)));
writeWav('hatOpen808.wav', normalize(hat(0.4, 263, 0.7)));
writeWav('clap808.wav', normalize(clap(0.12, 0.012)));
writeWav('tomLow808.wav', normalize(tom(110, 75, 0.35)));
writeWav('tomMid808.wav', normalize(tom(165, 110, 0.3)));
writeWav('tomHigh808.wav', normalize(tom(220, 165, 0.25)));

// 909 (mais punch e brilho)
writeWav('kick909.wav', normalize(kick(210, 48, 0.03, 0.22, 0.5)));
writeWav('snare909.wav', normalize(snare(200, 0.04, 2200, 0.7, 0.2, 0.07)));
writeWav('hatClosed909.wav', normalize(hat(0.045, 300, 1.0)));
writeWav('hatOpen909.wav', normalize(hat(0.35, 300, 0.8)));
writeWav('clap909.wav', normalize(clap(0.09, 0.01)));
writeWav('tomLow909.wav', normalize(tom(130, 85, 0.28)));
writeWav('tomMid909.wav', normalize(tom(195, 130, 0.24)));
writeWav('tomHigh909.wav', normalize(tom(260, 195, 0.2)));

console.log('Amostras geradas em', OUT);
