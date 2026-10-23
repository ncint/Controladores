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

  return { SCALES, NOTE_NAMES, noteName, PRESETS, names, applyPreset, randomPattern, randomDrumPattern };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = USBPresets;
