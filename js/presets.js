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

  // Presets musicais por voz — parâmetros afinados (osciladores combinados,
  // suboscilador, envelope de filtro, portamento, vibrato, chorus, drive).
  const SOUNDS = {
    lead: {
      'Supersaw (JP-8000)':  { wave: 'sawtooth', wave2: 'sawtooth', sub: 0, spread: 22, filterType: 'lowpass', cutoff: 2800, resonance: 3,   filterEnv: 0.25, attack: 0.01,  decay: 0.35, sustain: 0.75, release: 0.45, detune: 8,  drive: 0.08, delayMix: 0.18, delayTime: 0.31, delayFeedback: 0.32, reverbMix: 0.28, chorusMix: 0.5, vibratoRate: 5.5, vibratoDepth: 0, portamento: 0,    volume: 0.6 },
      'Lead Minimoog':       { wave: 'sawtooth', wave2: 'square',   sub: 0.3, spread: 10, filterType: 'lowpass', cutoff: 1900, resonance: 7,   filterEnv: 0.5,  attack: 0.004, decay: 0.28, sustain: 0.6,  release: 0.25, detune: 4,  drive: 0.3,  delayMix: 0.15, delayTime: 0.36, delayFeedback: 0.38, reverbMix: 0.2,  chorusMix: 0,   vibratoRate: 5,   vibratoDepth: 6, portamento: 0.04,  volume: 0.65 },
      'Acid 303':            { wave: 'sawtooth', wave2: null,       sub: 0,   spread: 0,  filterType: 'lowpass', cutoff: 520,  resonance: 16,  filterEnv: 0.95, attack: 0.001, decay: 0.15, sustain: 0.2,  release: 0.08, detune: 0,  drive: 0.5,  delayMix: 0.12, delayTime: 0.25, delayFeedback: 0.4,  reverbMix: 0.06, chorusMix: 0,   vibratoRate: 0,   vibratoDepth: 0, portamento: 0.06,  volume: 0.7 },
      'Porta-lead (SH-101)': { wave: 'sawtooth', wave2: 'sawtooth', sub: 0.2, spread: 14, filterType: 'lowpass', cutoff: 1700, resonance: 5,   filterEnv: 0.4,  attack: 0.005, decay: 0.22, sustain: 0.7,  release: 0.18, detune: 3,  drive: 0.15, delayMix: 0.22, delayTime: 0.3,  delayFeedback: 0.35, reverbMix: 0.16, chorusMix: 0.3, vibratoRate: 6,   vibratoDepth: 5, portamento: 0.09,  volume: 0.65 },
      'Sino FM (DX7)':       { wave: 'sine',     wave2: 'sine',     sub: 0,   spread: 1200,filterType: 'lowpass', cutoff: 4200, resonance: 2,   filterEnv: 0.1,  attack: 0.001, decay: 1.5,  sustain: 0.0,  release: 1.6,  detune: 0,  drive: 0,    delayMix: 0.2,  delayTime: 0.45, delayFeedback: 0.3,  reverbMix: 0.35, chorusMix: 0,   vibratoRate: 0,   vibratoDepth: 0, portamento: 0,     volume: 0.6 },
      'Pluck trance':        { wave: 'sawtooth', wave2: 'square',   sub: 0,   spread: 9,  filterType: 'lowpass', cutoff: 2400, resonance: 7,   filterEnv: 0.85, attack: 0.001, decay: 0.24, sustain: 0.05, release: 0.3,  detune: 6,  drive: 0.05, delayMix: 0.3,  delayTime: 0.4,  delayFeedback: 0.42, reverbMix: 0.28, chorusMix: 0.4, vibratoRate: 0,   vibratoDepth: 0, portamento: 0,     volume: 0.65 },
      'Whistle 8-bit':       { wave: 'square',   wave2: null,       sub: 0,   spread: 0,  filterType: 'lowpass', cutoff: 5500, resonance: 0.5, filterEnv: 0,    attack: 0.001, decay: 0.06, sustain: 0.6,  release: 0.04, detune: 0,  drive: 0,    delayMix: 0.05, delayTime: 0.12, delayFeedback: 0.15, reverbMix: 0.06, chorusMix: 0,   vibratoRate: 6.5, vibratoDepth: 3, portamento: 0,     volume: 0.5 },
    },
    bass: {
      'Baixo Moog':         { wave: 'sawtooth', wave2: 'square',   sub: 0.5, spread: 6,  filterType: 'lowpass', cutoff: 340,  resonance: 7,   filterEnv: 0.55, attack: 0.004, decay: 0.28, sustain: 0.55, release: 0.14, detune: 3,  drive: 0.3,  delayMix: 0.03, delayTime: 0.15, delayFeedback: 0.15, reverbMix: 0.05, chorusMix: 0,   portamento: 0.02, volume: 0.8 },
      'Sub baixo':          { wave: 'sine',     wave2: null,       sub: 0.7, spread: 0,  filterType: 'lowpass', cutoff: 220,  resonance: 1,   filterEnv: 0.2,  attack: 0.006, decay: 0.3,  sustain: 0.85, release: 0.16, detune: 0,  drive: 0.05, delayMix: 0.04, delayTime: 0.2,  delayFeedback: 0.2,  reverbMix: 0.04, chorusMix: 0,   portamento: 0.03, volume: 0.85 },
      'Acid 303 (grave)':   { wave: 'sawtooth', wave2: null,       sub: 0.2, spread: 0,  filterType: 'lowpass', cutoff: 400,  resonance: 15,  filterEnv: 0.9,  attack: 0.001, decay: 0.17, sustain: 0.15, release: 0.09, detune: 0,  drive: 0.5,  delayMix: 0.1,  delayTime: 0.25, delayFeedback: 0.35, reverbMix: 0.05, chorusMix: 0,   portamento: 0.05, volume: 0.75 },
      'Baixo 808':          { wave: 'sine',     wave2: 'triangle', sub: 0.6, spread: 4,  filterType: 'lowpass', cutoff: 180,  resonance: 2,   filterEnv: 0.3,  attack: 0.002, decay: 0.9,  sustain: 0.5,  release: 0.5,  detune: 0,  drive: 0.12, delayMix: 0.02, delayTime: 0.3,  delayFeedback: 0.2,  reverbMix: 0.03, chorusMix: 0,   portamento: 0.04, volume: 0.9 },
      'Reese (DnB)':        { wave: 'sawtooth', wave2: 'sawtooth', sub: 0.4, spread: 28, filterType: 'lowpass', cutoff: 320,  resonance: 5,   filterEnv: 0.35, attack: 0.008, decay: 0.4,  sustain: 0.75, release: 0.2,  detune: 0,  drive: 0.25, delayMix: 0.04, delayTime: 0.2,  delayFeedback: 0.2,  reverbMix: 0.06, chorusMix: 0.2,  portamento: 0.02, volume: 0.75 },
      'FM slap':            { wave: 'triangle', wave2: 'sine',    sub: 0.3, spread: 700, filterType: 'lowpass', cutoff: 750,  resonance: 4,   filterEnv: 0.7,  attack: 0.001, decay: 0.2,  sustain: 0.2,  release: 0.12, detune: 0,  drive: 0.3,  delayMix: 0.05, delayTime: 0.2,  delayFeedback: 0.2,  reverbMix: 0.06, chorusMix: 0,   portamento: 0,     volume: 0.75 },
    },
    chords: {
      'Pad etéreo (Juno)':  { wave: 'sawtooth', wave2: 'sawtooth', sub: 0, spread: 16, filterType: 'lowpass', cutoff: 950,  resonance: 1.5, filterEnv: 0.2,  attack: 0.7,  decay: 1.4,  sustain: 0.8,  release: 2.0, detune: 6,  drive: 0,    delayMix: 0.28, delayTime: 0.5,  delayFeedback: 0.45, reverbMix: 0.55, chorusMix: 0.6, portamento: 0, volume: 0.45 },
      'Strings JP-8':       { wave: 'sawtooth', wave2: 'sawtooth', sub: 0, spread: 12, filterType: 'lowpass', cutoff: 1750, resonance: 1,   filterEnv: 0.15, attack: 0.28, decay: 0.7,  sustain: 0.85, release: 1.2, detune: 5,  drive: 0,    delayMix: 0.14, delayTime: 0.4,  delayFeedback: 0.3,  reverbMix: 0.5,  chorusMix: 0.5, portamento: 0, volume: 0.45 },
      'E-piano DX7':        { wave: 'sine',     wave2: 'sine',     sub: 0, spread: 900, filterType: 'lowpass', cutoff: 3000, resonance: 1,   filterEnv: 0.35, attack: 0.002,decay: 0.85, sustain: 0.3,  release: 0.9, detune: 3,  drive: 0,    delayMix: 0.12, delayTime: 0.3,  delayFeedback: 0.25, reverbMix: 0.3,  chorusMix: 0.2, portamento: 0, volume: 0.65 },
      'Órgão (Hammond)':    { wave: 'square',   wave2: 'square',   sub: 0, spread: 7,  filterType: 'lowpass', cutoff: 2000, resonance: 0.8, filterEnv: 0,    attack: 0.005,decay: 0.01, sustain: 1.0, release: 0.07, detune: 0,  drive: 0.06, delayMix: 0.07, delayTime: 0.25, delayFeedback: 0.2,  reverbMix: 0.18, chorusMix: 0.3, portamento: 0, volume: 0.5 },
      'Brass Prophet-5':    { wave: 'sawtooth', wave2: 'sawtooth', sub: 0, spread: 10, filterType: 'lowpass', cutoff: 1250, resonance: 3,   filterEnv: 0.5,  attack: 0.06, decay: 0.4,  sustain: 0.75, release: 0.5, detune: 4,  drive: 0.1,  delayMix: 0.1,  delayTime: 0.35, delayFeedback: 0.3,  reverbMix: 0.32, chorusMix: 0.35,portamento: 0, volume: 0.5 },
      'Pad D-50':           { wave: 'triangle', wave2: 'sawtooth', sub: 0.2, spread: 8, filterType: 'lowpass', cutoff: 1150, resonance: 2,  filterEnv: 0.3,  attack: 1.1,  decay: 1.8,  sustain: 0.75, release: 2.5, detune: 6,  drive: 0,    delayMix: 0.35, delayTime: 0.6,  delayFeedback: 0.5,  reverbMix: 0.6,  chorusMix: 0.55,portamento: 0, volume: 0.45 },
      'Flauta':             { wave: 'triangle', wave2: 'sine',    sub: 0, spread: 300, filterType: 'lowpass', cutoff: 1400, resonance: 1,   filterEnv: 0.25, attack: 0.06, decay: 0.2,  sustain: 0.8,  release: 0.25, detune: 2,  drive: 0,    delayMix: 0.16, delayTime: 0.35, delayFeedback: 0.3,  reverbMix: 0.32, chorusMix: 0.25,portamento: 0.05, volume: 0.65 },
    },
    drums: {
      'Kit 808':       { wave: 'square', filterType: 'highpass', cutoff: 8000, resonance: 0.5, filterEnv: 0, attack: 0.001, decay: 0.05, sustain: 0.4, release: 0.05, detune: 0, drive: 0,   delayMix: 0,   delayTime: 0.2, delayFeedback: 0.1, reverbMix: 0.06, volume: 0.9, kit: '808' },
      'Kit 909':       { wave: 'square', filterType: 'highpass', cutoff: 7500, resonance: 1,   filterEnv: 0, attack: 0.001, decay: 0.04, sustain: 0.5, release: 0.04, detune: 0, drive: 0.1, delayMix: 0,   delayTime: 0.2, delayFeedback: 0.1, reverbMix: 0.08, volume: 0.9, kit: '909' },
      'Kit acústico': { wave: 'square', filterType: 'highpass', cutoff: 6000, resonance: 0.5, filterEnv: 0, attack: 0.001, decay: 0.05, sustain: 0.4, release: 0.05, detune: 0, drive: 0,   delayMix: 0,   delayTime: 0.2, delayFeedback: 0.1, reverbMix: 0.14, volume: 0.85, kit: '808' },
      'Kit lo-fi':    { wave: 'square', filterType: 'bandpass', cutoff: 3200, resonance: 2,   filterEnv: 0, attack: 0.001, decay: 0.06, sustain: 0.3, release: 0.06, detune: 0, drive: 0.3, delayMix: 0.05,delayTime: 0.3, delayFeedback: 0.2, reverbMix: 0.1,  volume: 0.8, kit: '808' },
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
