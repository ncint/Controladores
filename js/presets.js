const USBPresets = (() => {
  const SCALES = {
    'Pentatónica menor': [0, 3, 5, 7, 10],
    'Maior': [0, 2, 4, 5, 7, 9, 11],
    'Menor natural': [0, 2, 3, 5, 7, 8, 10],
    'Dórica': [0, 2, 3, 5, 7, 9, 10],
    'Frígia': [0, 1, 3, 5, 7, 8, 10],
    'Pentatónica maior': [0, 2, 4, 7, 9],
    'Japonesa (Hirajoshi)': [0, 2, 3, 7, 8],
  };

  const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

  function noteName(midi) {
    return NOTE_NAMES[midi % 12] + (Math.floor(midi / 12) - 1);
  }

  function randomPattern(scale, root, density, steps) {
    steps = steps || 16;
    const out = { steps: new Array(steps).fill(0), notes: new Array(steps).fill(root), velocities: new Array(steps).fill(1) };
    for (let s = 0; s < steps; s++) {
      if (Math.random() < density) {
        out.steps[s] = 1;
        const deg = Math.floor(Math.random() * scale.length);
        const oct = Math.random() < 0.25 ? 12 : 0;
        out.notes[s] = root + scale[deg] + oct;
        out.velocities[s] = 0.6 + Math.random() * 0.4;
      }
    }
    return out;
  }

  function randomDrumPattern(density, steps) {
    steps = steps || 16;
    const out = { steps: new Array(steps).fill(0), notes: new Array(steps).fill('kick'), velocities: new Array(steps).fill(1) };
    for (let s = 0; s < steps; s++) {
      const on = Math.random() < density;
      out.steps[s] = on ? 1 : 0;
      if (on) out.velocities[s] = 0.6 + Math.random() * 0.4;
    }
    return out;
  }

  function applyPreset(name, seq, arp) {
    const p = PRESETS[name];
    if (!p) return false;
    seq.stop();
    seq.setBpm(p.bpm || 120);
    seq.setSwing(p.swing || 0);
    const state = { bpm: p.bpm || 120, swing: p.swing || 0, playing: false, currentStep: 0, tracks: {}, mutes: {} };
    for (const id in p.tracks) {
      const t = p.tracks[id];
      state.tracks[id] = {
        kind: t.kind,
        steps: t.steps.slice(),
        notes: t.notes.slice(),
        velocities: t.velocities.slice(),
      };
      state.mutes[id] = false;
    }
    seq.setState(JSON.parse(JSON.stringify(state)));
    if (arp && p.arp) {
      arp.setPattern(p.arp.pattern || 'updown');
      arp.setRate(p.arp.rate || 0.125);
      arp.setOctaves(p.arp.octaves || 2);
    }
    return true;
  }

  const PRESETS = {
    'Básico': {
      bpm: 100,
      tracks: {
        lead: { kind: 'melodic', steps: [1,0,0,0, 0,0,1,0, 0,0,0,0, 1,0,0,0], notes: [60,60,60,60, 60,60,63,60, 60,60,60,60, 67,60,60,60], velocities: [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1] },
        drums: { kind: 'drum', steps: [1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0], notes: ['kick','kick','kick','kick','kick','kick','kick','kick','kick','kick','kick','kick','kick','kick','kick','kick'], velocities: [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1] },
      },
    },
    'Techno': {
      bpm: 128,
      tracks: {
        lead: { kind: 'melodic', steps: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0], notes: [45,45,45,45, 45,45,45,45, 48,48,48,48, 43,43,43,43], velocities: [0.9,0.6,0.8,0.6, 0.9,0.6,0.8,0.6, 0.9,0.6,0.8,0.6, 0.9,0.6,0.8,0.6] },
        drums: { kind: 'drum', steps: [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,1], notes: ['kick','kick','kick','kick','kick','kick','kick','kick','kick','kick','kick','kick','kick','kick','kick','kick'], velocities: [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1] },
        drums2: { kind: 'drum', steps: [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0], notes: ['hat','hat','hat','hat','hat','hat','hat','hat','hat','hat','hat','hat','hat','hat','hat','hat'], velocities: [0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5] },
      },
    },
    'Ambiente': {
      bpm: 70,
      swing: 0.2,
      arp: { pattern: 'updown', rate: 0.25, octaves: 2 },
      tracks: {
        lead: { kind: 'melodic', steps: [1,0,0,0, 0,0,0,0, 0,0,1,0, 0,0,0,0], notes: [52,52,52,52, 52,52,52,52, 59,59,59,59, 59,59,59,59], velocities: [0.7,0.7,0.7,0.7,0.7,0.7,0.7,0.7,0.7,0.7,0.7,0.7,0.7,0.7,0.7,0.7] },
      },
    },
    'Glitch': {
      bpm: 140,
      tracks: {
        lead: { kind: 'melodic', steps: [1,0,1,1, 0,1,0,1, 1,0,1,0, 0,1,1,0], notes: [48,48,55,48, 48,60,48,48, 53,48,50,48, 48,58,48,55], velocities: [0.8,0.8,0.5,0.8, 0.8,0.4,0.8,0.8, 0.5,0.8,0.8,0.8, 0.8,0.5,0.6,0.8] },
        drums: { kind: 'drum', steps: [1,0,0,1, 0,1,0,0, 1,1,0,0, 0,1,0,1], notes: ['kick','kick','kick','snare','kick','kick','kick','kick','kick','snare','kick','kick','kick','kick','kick','snare'], velocities: [0.9,0.9,0.9,0.5, 0.9,0.6,0.9,0.9, 0.7,0.5,0.9,0.9, 0.9,0.6,0.9,0.5] },
        drums2: { kind: 'drum', steps: [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,1], notes: ['hat','hat','hat','hat','hat','hat','hat','hat','hat','hat','hat','hat','hat','hat','hat','hat'], velocities: [0.4,0.4,0.4,0.4, 0.4,0.4,0.4,0.4, 0.4,0.4,0.4,0.4, 0.4,0.4,0.4,0.6] },
      },
    },
    'Trap': {
      bpm: 75,
      swing: 0.1,
      tracks: {
        drums: { kind: 'drum', steps: [1,0,0,0, 0,0,0,1, 0,0,1,0, 0,0,0,0], notes: ['kick','kick','kick','kick','kick','kick','kick','kick','kick','kick','kick','kick','kick','kick','kick','kick'], velocities: [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1] },
        drums2: { kind: 'drum', steps: [0,0,0,1, 0,0,1,0, 0,0,0,1, 0,0,1,0], notes: ['snare','snare','snare','snare','snare','snare','snare','snare','snare','snare','snare','snare','snare','snare','snare','snare'], velocities: [0.7,0.7,0.7,0.7,0.7,0.7,0.7,0.7,0.7,0.7,0.7,0.7,0.7,0.7,0.7,0.7] },
        drums3: { kind: 'drum', steps: [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1], notes: ['hat','hat','hat','hat','hat','hat','hat','hat','hat','hat','hat','hat','hat','hat','hat','hat'], velocities: [0.3,0.3,0.4,0.3, 0.3,0.3,0.4,0.3, 0.3,0.3,0.4,0.3, 0.3,0.3,0.4,0.3] },
      },
    },
  };

  function names() { return Object.keys(PRESETS); }

  // Sons clássicos por voz — listas distintas para lead, bass, chords e drums.
  const SOUNDS = {
    lead: {
      'Supersaw (JP-8000)':  { wave: 'sawtooth', filterType: 'lowpass', cutoff: 2600, resonance: 3,   filterEnv: 0.25, attack: 0.01,  decay: 0.3,  sustain: 0.8, release: 0.4,  detune: 18, drive: 0.1,  delayMix: 0.15, delayTime: 0.3, delayFeedback: 0.3, reverbMix: 0.3,  volume: 0.65 },
      'Lead Minimoog':      { wave: 'sawtooth', filterType: 'lowpass', cutoff: 2000, resonance: 7,   filterEnv: 0.45, attack: 0.005, decay: 0.25, sustain: 0.65,release: 0.25, detune: 5,  drive: 0.3,  delayMix: 0.2,  delayTime: 0.35,delayFeedback: 0.4, reverbMix: 0.2,  volume: 0.7 },
      'Acid 303':           { wave: 'square',   filterType: 'lowpass', cutoff: 500,  resonance: 15,  filterEnv: 0.9,  attack: 0.001, decay: 0.14, sustain: 0.25,release: 0.08, detune: 0,  drive: 0.45, delayMix: 0.12, delayTime: 0.25,delayFeedback: 0.35,reverbMix: 0.05, volume: 0.75 },
      'Porta-lead (SH-101)':{ wave: 'sawtooth', filterType: 'lowpass', cutoff: 1700, resonance: 5,   filterEnv: 0.4,  attack: 0.004, decay: 0.2,  sustain: 0.7, release: 0.15, detune: 3,  drive: 0.15, delayMix: 0.22, delayTime: 0.3, delayFeedback: 0.35,reverbMix: 0.18, volume: 0.7 },
      'Sino FM (DX7)':     { wave: 'sine',     filterType: 'lowpass', cutoff: 4200, resonance: 2,   filterEnv: 0.15, attack: 0.001, decay: 1.4,  sustain: 0.0, release: 1.6,  detune: 0,  drive: 0,    delayMix: 0.2,  delayTime: 0.45,delayFeedback: 0.3, reverbMix: 0.4,  volume: 0.65 },
      'Pluck trance':      { wave: 'sawtooth', filterType: 'lowpass', cutoff: 2400, resonance: 6,   filterEnv: 0.85, attack: 0.001, decay: 0.22, sustain: 0.1, release: 0.3,  detune: 8,  drive: 0.05, delayMix: 0.3,  delayTime: 0.4, delayFeedback: 0.4, reverbMix: 0.3,  volume: 0.7 },
      'Whistle 8-bit':     { wave: 'square',   filterType: 'lowpass', cutoff: 5500, resonance: 0.5, filterEnv: 0,    attack: 0.001, decay: 0.05, sustain: 0.6, release: 0.03, detune: 0,  drive: 0,    delayMix: 0.05, delayTime: 0.12,delayFeedback: 0.15,reverbMix: 0.05, volume: 0.55 },
    },
    bass: {
      'Baixo Moog':        { wave: 'sawtooth', filterType: 'lowpass', cutoff: 320,  resonance: 6,   filterEnv: 0.5,  attack: 0.005, decay: 0.25, sustain: 0.7, release: 0.12, detune: 4,  drive: 0.25, delayMix: 0.03, delayTime: 0.15,delayFeedback: 0.15,reverbMix: 0.06, volume: 0.85 },
      'Sub baixo':         { wave: 'sine',     filterType: 'lowpass', cutoff: 200,  resonance: 1,   filterEnv: 0.2,  attack: 0.005, decay: 0.3,  sustain: 0.9, release: 0.15, detune: 0,  drive: 0,    delayMix: 0.05, delayTime: 0.2, delayFeedback: 0.2, reverbMix: 0.05, volume: 0.9 },
      'Acid 303 (grave)':  { wave: 'sawtooth', filterType: 'lowpass', cutoff: 380,  resonance: 14,  filterEnv: 0.9,  attack: 0.001, decay: 0.16, sustain: 0.2, release: 0.08, detune: 0,  drive: 0.45, delayMix: 0.1,  delayTime: 0.25,delayFeedback: 0.35,reverbMix: 0.05, volume: 0.8 },
      'Baixo 808':         { wave: 'sine',     filterType: 'lowpass', cutoff: 160,  resonance: 2,   filterEnv: 0.3,  attack: 0.002, decay: 0.9,  sustain: 0.6, release: 0.5,  detune: 0,  drive: 0.1,  delayMix: 0.02, delayTime: 0.3, delayFeedback: 0.2, reverbMix: 0.04, volume: 0.95 },
      'Reese (DnB)':       { wave: 'sawtooth', filterType: 'lowpass', cutoff: 300,  resonance: 4,   filterEnv: 0.3,  attack: 0.008, decay: 0.4,  sustain: 0.8, release: 0.2,  detune: 25, drive: 0.2,  delayMix: 0.04, delayTime: 0.2, delayFeedback: 0.2, reverbMix: 0.06, volume: 0.8 },
      'FM slap':           { wave: 'triangle', filterType: 'lowpass', cutoff: 700,  resonance: 3,   filterEnv: 0.7,  attack: 0.001, decay: 0.18, sustain: 0.3, release: 0.1,  detune: 0,  drive: 0.3,  delayMix: 0.05, delayTime: 0.2, delayFeedback: 0.2, reverbMix: 0.06, volume: 0.8 },
    },
    chords: {
      'Pad etéreo (Juno)': { wave: 'sawtooth', filterType: 'lowpass', cutoff: 900,  resonance: 1.5, filterEnv: 0.2,  attack: 0.8,  decay: 1.5,  sustain: 0.85,release: 2.2, detune: 12, drive: 0,    delayMix: 0.3,  delayTime: 0.5, delayFeedback: 0.45,reverbMix: 0.55, volume: 0.5 },
      'Strings JP-8':      { wave: 'sawtooth', filterType: 'lowpass', cutoff: 1700, resonance: 1,   filterEnv: 0.15, attack: 0.3,  decay: 0.8,  sustain: 0.85,release: 1.3, detune: 10, drive: 0,    delayMix: 0.15, delayTime: 0.4, delayFeedback: 0.3, reverbMix: 0.5,  volume: 0.5 },
      'E-piano DX7':       { wave: 'sine',     filterType: 'lowpass', cutoff: 3000, resonance: 1,   filterEnv: 0.3,  attack: 0.002, decay: 0.8,  sustain: 0.35,release: 0.9,  detune: 3,  drive: 0,    delayMix: 0.12, delayTime: 0.3, delayFeedback: 0.25,reverbMix: 0.3,  volume: 0.7 },
      'Órgão (Hammond)':   { wave: 'square',   filterType: 'lowpass', cutoff: 2000, resonance: 0.8, filterEnv: 0,    attack: 0.005, decay: 0.01, sustain: 1.0, release: 0.06, detune: 0,  drive: 0.05, delayMix: 0.08, delayTime: 0.25,delayFeedback: 0.2, reverbMix: 0.18, volume: 0.55 },
      'Brass Prophet-5':   { wave: 'sawtooth', filterType: 'lowpass', cutoff: 1200, resonance: 3,   filterEnv: 0.45, attack: 0.06,  decay: 0.4,  sustain: 0.8, release: 0.5,  detune: 8,  drive: 0.1,  delayMix: 0.12, delayTime: 0.35,delayFeedback: 0.3, reverbMix: 0.35, volume: 0.55 },
      'Pad D-50':          { wave: 'triangle', filterType: 'lowpass', cutoff: 1100, resonance: 2,   filterEnv: 0.25, attack: 1.2,  decay: 2.0,  sustain: 0.8, release: 2.8,  detune: 6,  drive: 0,    delayMix: 0.35, delayTime: 0.6, delayFeedback: 0.5, reverbMix: 0.6,  volume: 0.5 },
      'Flauta':            { wave: 'triangle', filterType: 'lowpass', cutoff: 1400, resonance: 1,   filterEnv: 0.2,  attack: 0.06,  decay: 0.2,  sustain: 0.85,release: 0.25, detune: 2,  drive: 0,    delayMix: 0.18, delayTime: 0.35,delayFeedback: 0.3, reverbMix: 0.35, volume: 0.7 },
    },
    drums: {
      'Kit 808':           { wave: 'square', filterType: 'highpass', cutoff: 8000, resonance: 0.5, filterEnv: 0, attack: 0.001, decay: 0.05, sustain: 0.4, release: 0.05, detune: 0, drive: 0,   delayMix: 0,   delayTime: 0.2, delayFeedback: 0.1, reverbMix: 0.06, volume: 0.9, kit: '808' },
      'Kit 909':           { wave: 'square', filterType: 'highpass', cutoff: 7500, resonance: 1,   filterEnv: 0, attack: 0.001, decay: 0.04, sustain: 0.5, release: 0.04, detune: 0, drive: 0.1, delayMix: 0,   delayTime: 0.2, delayFeedback: 0.1, reverbMix: 0.08, volume: 0.9, kit: '909' },
      'Kit acústico':     { wave: 'square', filterType: 'highpass', cutoff: 6000, resonance: 0.5, filterEnv: 0, attack: 0.001, decay: 0.05, sustain: 0.4, release: 0.05, detune: 0, drive: 0,   delayMix: 0,   delayTime: 0.2, delayFeedback: 0.1, reverbMix: 0.15, volume: 0.85, kit: 'acoustic' },
      'Kit lo-fi':         { wave: 'square', filterType: 'bandpass', cutoff: 3000, resonance: 2,   filterEnv: 0, attack: 0.001, decay: 0.06, sustain: 0.3, release: 0.06, detune: 0, drive: 0.3, delayMix: 0.05, delayTime: 0.3, delayFeedback: 0.2, reverbMix: 0.1,  volume: 0.8, kit: 'lofi' },
    },
  };

  function soundNames(voice) { return Object.keys(SOUNDS[voice] || {}); }

  function applySound(busName, soundName) {
    const bus = USBSynth.getBus(busName);
    const voiceSnds = SOUNDS[busName] || {};
    const s = voiceSnds[soundName];
    if (!bus || !s) return false;
    USBSynth.applyParams(bus, s);
    if (s.kit) USBSynth.setDrumKit(busName, s.kit);
    return true;
  }

  return { SCALES, NOTE_NAMES, noteName, PRESETS, names, applyPreset, randomPattern, randomDrumPattern, SOUNDS, soundNames, applySound };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = USBPresets;
