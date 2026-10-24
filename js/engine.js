const USBEngine = (() => {
  const BUS_ROLES = ['lead', 'bass', 'chords', 'drums'];
  const WAVES = ['sine', 'triangle', 'square', 'sawtooth'];
  const SCALE = [0, 2, 3, 5, 7, 8, 10];
  const ROLE_ROOTS = { lead: 60, bass: 36, chords: 55 };
  const roleOctaves = { lead: 0, bass: 0, chords: 0 };
  let lastPadPress = {};

  let started = false;
  const heldVoices = {};
  const arpHoldNotes = {};
  let sustainOn = {};
  let pitchBend = 0;
  const onActivity = [];

  // Mesa de mistura por comando: volume, pan, mute, solo.
  const mixer = {};
  // Som por comando: cada carta escolhe o seu próprio instrumento.
  const channelSounds = {};

  function ensureChannel(padIndex, role) {
    const key = padIndex + ':' + role;
    if (!mixer[key]) {
      const ctx = USBSynth.context();
      const input = ctx.createGain();
      const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      const bus = getChannelInstrument(padIndex, role);
      const dest = bus ? bus.input : ctx.destination;
      if (panner) {
        input.connect(panner);
        panner.connect(dest);
      } else {
        input.connect(dest);
      }
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      input.connect(analyser);
      mixer[key] = {
        padIndex, role,
        input, panner, analyser,
        volume: 1, pan: 0, muted: false, solo: false,
      };
    }
    return mixer[key];
  }

  function getChannelInstrument(padIndex, role) {
    const cfg = channelSounds[padIndex] || USBPresets.SOUNDS[role] && USBPresets.SOUNDS[role][Object.keys(USBPresets.SOUNDS[role])[0]];
    if (!cfg) return USBSynth.getBus(role);
    return USBSynth.applyChannelSound(padIndex, cfg);
  }

  function setChannelSound(padIndex, role, soundName) {
    const voiceSounds = USBPresets.SOUNDS[role] || USBPresets.SOUNDS.lead;
    const cfg = voiceSounds[soundName] || Object.values(voiceSounds)[0];
    if (!cfg) return null;
    channelSounds[padIndex] = cfg;
    return USBSynth.applyChannelSound(padIndex, cfg);
  }

  function getChannelSoundName(padIndex, role) {
    const cfg = channelSounds[padIndex];
    if (!cfg) {
      const names = USBPresets.soundNames(role);
      return names[0] || null;
    }
    const names = USBPresets.soundNames(role);
    for (const n of names) {
      if (USBPresets.SOUNDS[role][n] === cfg) return n;
    }
    return null;
  }

  function applyMixerToChannel(ch) {
    const ctx = USBSynth.context();
    const anySolo = Object.values(mixer).some(m => m.solo);
    const soloedOut = anySolo && !ch.solo;
    const target = (ch.muted || soloedOut) ? 0 : ch.volume;
    ch.input.gain.setTargetAtTime(target, ctx.currentTime, 0.02);
    if (ch.panner) ch.panner.pan.setTargetAtTime(ch.pan, ctx.currentTime, 0.02);
  }

  function refreshAllMixer() {
    Object.values(mixer).forEach(applyMixerToChannel);
  }

  function setMixerVolume(padIndex, role, v) {
    const ch = ensureChannel(padIndex, role);
    ch.volume = Math.min(1.5, Math.max(0, v));
    applyMixerToChannel(ch);
  }

  function setMixerPan(padIndex, role, v) {
    const ch = ensureChannel(padIndex, role);
    ch.pan = Math.min(1, Math.max(-1, v));
    applyMixerToChannel(ch);
  }

  function toggleMixerMute(padIndex, role) {
    const ch = ensureChannel(padIndex, role);
    ch.muted = !ch.muted;
    applyMixerToChannel(ch);
    return ch.muted;
  }

  function toggleMixerSolo(padIndex, role) {
    const ch = ensureChannel(padIndex, role);
    ch.solo = !ch.solo;
    refreshAllMixer();
    return ch.solo;
  }

  function getMixer(padIndex, role) {
    const key = padIndex + ':' + role;
    return mixer[key] || { volume: 1, pan: 0, muted: false, solo: false };
  }

  // Nível de áudio (RMS 0..1) do canal do comando — para o VU meter.
  const levelBuf = new Uint8Array(128);
  function getMixerLevel(padIndex, role) {
    const key = padIndex + ':' + role;
    const ch = mixer[key];
    if (!ch || !ch.analyser) return 0;
    ch.analyser.getByteTimeDomainData(levelBuf);
    let sum = 0;
    for (let i = 0; i < levelBuf.length; i++) {
      const v = (levelBuf[i] - 128) / 128;
      sum += v * v;
    }
    return Math.sqrt(sum / levelBuf.length);
  }

  function channelDestination(padIndex, role) {
    const ctx = USBSynth.context();
    if (!ctx) return null;
    const ch = ensureChannel(padIndex, role);
    return ch.input;
  }

  function init() {
    if (started) return;
    started = true;
    USBSynth.ensure();
    // Quatro instrumentos independentes com presets iniciais convincentes.
    USBSynth.makeBus('lead',   USBPresets.SOUNDS.lead['Supersaw (JP-8000)']);
    USBSynth.makeBus('bass',   USBPresets.SOUNDS.bass['Baixo Moog']);
    USBSynth.makeBus('chords', USBPresets.SOUNDS.chords['Pad etéreo (Juno)']);
    USBSynth.makeBus('drums',  USBPresets.SOUNDS.drums['TR-808 (meus samples)']);
    USBSynth.setDrumKit('drums', 'custom');
    USBSynth.preloadKit('custom');
  }

  function activity(cb) { onActivity.push(cb); }
  function emitActivity(padIndex, action, value) {
    onActivity.forEach(cb => { try { cb(padIndex, action, value); } catch (e) {} });
  }

  function rootFor(role) {
    return (ROLE_ROOTS[role] || 60);
  }

  // Na voz drums, cada grau do comando toca uma peça do kit.
  const DRUM_PIECES = ['kick','snare','hat','hatOpen','clap','tomLow','tomMid','tomHigh','rim','maraca','clapSnare','kickDriven'];

  function isDrumRole(role) { return role === 'drums'; }

  function triggerDrumPiece(padIndex, role, piece, velocity, controlIndex) {
    const bus = USBSynth.getBus('drums');
    if (!bus || !USBSynth.context()) return;
    const dest = channelDestination(padIndex, 'drums') || bus.input;
    USBSynth.triggerPercussion(bus, piece, undefined, velocity, dest);
  }

  function degreeToMidi(role, degree) {
    const root = rootFor(role);
    const d = Math.max(0, degree | 0);
    const oct = Math.floor(d / SCALE.length);
    const deg = SCALE[d % SCALE.length];
    return root + oct * 12 + deg + (roleOctaves[role] || 0);
  }

  function voiceKey(padIndex, role, controlIndex) {
    return padIndex + ':' + role + ':' + controlIndex;
  }

  function startVoice(padIndex, role, controlIndex, midi, velocity) {
    const bus = getChannelInstrument(padIndex, role);
    if (!bus) return null;
    const key = voiceKey(padIndex, role, controlIndex);
    const existing = heldVoices[key];
    if (existing) { existing.stop(); delete heldVoices[key]; }
    const freq = USBSynth.noteToFreq(midi) * Math.pow(2, pitchBend / 12);
    const dest = channelDestination(padIndex, role) || bus.filter;
    const voice = USBSynth.triggerVoice(bus, freq, undefined, undefined, velocity || 0.9, dest);
    if (voice) {
      heldVoices[key] = voice;
      voice.midi = midi;
    }
    return voice;
  }

  function stopVoice(padIndex, role, controlIndex) {
    const key = voiceKey(padIndex, role, controlIndex);
    if (heldVoices[key]) {
      heldVoices[key].stop();
      delete heldVoices[key];
    }
  }

  function startVoiceByKey(key, role, midi, velocity) {
    const padIdx = key.split(':')[0];
    const bus = getChannelInstrument(padIdx, role);
    if (!bus) return null;
    const existing = heldVoices[key];
    if (existing) { existing.stop(); delete heldVoices[key]; }
    const freq = USBSynth.noteToFreq(midi) * Math.pow(2, pitchBend / 12);
    const dest = channelDestination(key.split(':')[0], role) || bus.filter;
    const voice = USBSynth.triggerVoice(bus, freq, undefined, undefined, velocity || 0.9, dest);
    if (voice) {
      heldVoices[key] = voice;
      voice.midi = midi;
    }
    return voice;
  }

  function applyPitchBendToHeld() {
    if (!USBSynth.context()) return;
    Object.values(heldVoices).forEach(v => {
      try {
        const f = USBSynth.noteToFreq(v.midi) * Math.pow(2, pitchBend / 12);
        v.osc.frequency.setTargetAtTime(f, USBSynth.context().currentTime, 0.01);
        v.osc2.frequency.setTargetAtTime(f, USBSynth.context().currentTime, 0.01);
      } catch (e) {}
    });
  }

  function arpAddNote(padIndex, midi) {
    if (typeof USBArpeggiator === 'undefined' || !USBArpeggiator) return;
    arpHoldNotes[padIndex + ':arp'] = midi;
    USBArpeggiator.holdNotes(Object.values(arpHoldNotes));
  }

  function arpRemoveNote(padIndex) {
    if (typeof USBArpeggiator === 'undefined' || !USBArpeggiator) return;
    delete arpHoldNotes[padIndex + ':arp'];
    USBArpeggiator.holdNotes(Object.values(arpHoldNotes));
  }

  function applyRangeAction(role, action, value) {
    const bus = USBSynth.getBus(role);
    if (!bus) return;
    const cfg = USBMapping.ACTIONS[action];
    if (!cfg || cfg.type !== 'range') return;
    const v = Math.abs(value);
    const scaled = cfg.min + v * (cfg.max - cfg.min);
    USBSynth.applyParams(bus, { [action]: scaled });
  }


  function randomizeAll(seq, arp) {
    if (!seq) return;
    const scaleKeys = Object.keys(USBPresets.SCALES);
    const scale = USBPresets.SCALES[scaleKeys[Math.floor(Math.random() * scaleKeys.length)]];
    seq.setBpm(70 + Math.floor(Math.random() * 120));
    seq.clearAll();
    const trackIds = Object.keys(seq.getState().tracks);
    const ids = trackIds.length ? trackIds : ['lead', 'drums', 'drums2'];
    ids.forEach(id => {
      const t = seq.getState().tracks[id];
      if (!t) return;
      if (t.kind === 'drum') seq.randomizeDrumTrack(id, 0.25 + Math.random() * 0.3);
      else seq.randomizeTrack(id, 0.2 + Math.random() * 0.4, scale, 2);
    });
  }

  // Voz drums: TODOS os botões e eixos do comando são pads de percussão.
  // Ignora os bindings melódicos — cada botão/eixo tem a sua peça, por ordem.
  function handleDrums(change, padIndex) {
    if (change.type === 'button') {
      const pressed = change.value > 0.5 && change.prev <= 0.5;
      if (pressed) {
        const piece = DRUM_PIECES[change.index % DRUM_PIECES.length];
        triggerDrumPiece(padIndex, 'drums', piece, change.value, change.index);
      }
      return true;
    }
    if (change.type === 'axis') {
      // Cada eixo tem 2 peças: negativa (−1) e positiva (+1).
      // Stick esq.: X−/X+ e Y−/Y+ (cursor da SNES), stick dir. se existir.
      const TH = 0.6;
      const pairIdx = Math.floor(change.index / 2);            // 0 = stick esq., 1 = stick dir.
      const dir = change.value > TH ? 1 : (change.value < -TH ? -1 : 0);
      const key = 'drumpad:' + padIndex + ':' + change.index;
      const slot = pairIdx * 4 + (change.index % 2) * 2;      // peça base deste eixo
      if (dir !== 0 && lastPadPress[key] !== dir) {
        lastPadPress[key] = dir;
        const piece = DRUM_PIECES[(slot + (dir > 0 ? 1 : 0)) % DRUM_PIECES.length];
        triggerDrumPiece(padIndex, 'drums', piece, 0.9, change.index);
      } else if (dir === 0) {
        lastPadPress[key] = 0;
      }
      return true;
    }
    return false;
  }

  function handle(change, seq, arp) {
    seq = seq || null; arp = arp || null;
    if (!started) init();
    if (USBMapping.isLearning()) {
      if (USBMapping.feedLearn(change)) return true;
    }
    const padCfg = USBMapping.getPadConfig(change.padIndex);
    if (!padCfg) return false;
    const role = padCfg.role;
    if (isDrumRole(role)) {
      return handleDrums(change, change.padIndex);
    }
    const binding = padCfg.bindings.find(b => b.type === change.type && b.index === change.index);
    if (!binding) return false;
    const action = binding.action;
    const meta = USBMapping.ACTIONS[action];
    if (!meta) return false;

    if (change.type === 'axis' && (meta.type === 'range' || meta.type === 'bend')) {
      const debounceKey = change.padIndex + ':' + action;
      const now = Date.now();
      if (lastPadPress[debounceKey] && now - lastPadPress[debounceKey] < 20) return false;
      lastPadPress[debounceKey] = now;
    }

    // Notas por direção de eixo (ex.: cursor SNES como eixos):
    // cada eixo tem até dois bindings com dir -1/+1; a nota soa enquanto inclinado.
    if (change.type === 'axis' && meta.type === 'note' && !meta.arp) {
      const dirBindings = padCfg.bindings.filter(b => b.type === 'axis' && b.index === change.index && USBMapping.ACTIONS[b.action] && USBMapping.ACTIONS[b.action].type === 'note');
      const hasDir = dirBindings.some(b => b.dir === -1 || b.dir === 1);
      if (hasDir) {
        const TH = 0.5;
        dirBindings.forEach(b => {
          const want = b.dir === -1 ? change.value <= -TH : change.value >= TH;
          const key = voiceKey(change.padIndex, role, 'ax' + change.index + (b.dir === -1 ? 'n' : 'p'));
          if (isDrumRole(role)) {
            if (want && !heldVoices[key]) {
              const piece = DRUM_PIECES[(b.param || 0) % DRUM_PIECES.length];
              triggerDrumPiece(change.padIndex, role, piece, 0.9);
              heldVoices[key] = { stop() { this.done = true; } };
            } else if (!want && heldVoices[key] && heldVoices[key].done !== undefined) {
              delete heldVoices[key];
            }
          } else if (want && !heldVoices[key]) {
            const midi = degreeToMidi(role, b.param || 0);
            startVoiceByKey(key, role, midi, 0.9);
          } else if (!want && heldVoices[key]) {
            if (!sustainOn[change.padIndex]) {
              heldVoices[key].stop();
              delete heldVoices[key];
            }
          }
        });
        emitActivity(change.padIndex, action, change.value);
        return true;
      }
    }

    if (meta.type === 'note') {
      const degree = binding.param || 0;
      const midi = degreeToMidi(role, degree);
      if (meta.arp) {
        if (!arp) return false;
        if (change.type === 'axis') {
          if (Math.abs(change.value) > 0.15) {
            arpAddNote(change.padIndex, midi);
            if (!arp.isEnabled()) arp.toggle();
          } else {
            arpRemoveNote(change.padIndex);
          }
        } else {
          if (change.value > 0.5) {
            arpAddNote(change.padIndex, midi);
            if (!arp.isEnabled()) arp.toggle();
          } else {
            arpRemoveNote(change.padIndex);
          }
        }
      } else if (isDrumRole(role)) {
        if (change.type === 'axis') {
          if (Math.abs(change.value) > 0.15) {
            const piece = DRUM_PIECES[degree % DRUM_PIECES.length];
            triggerDrumPiece(change.padIndex, role, piece, Math.abs(change.value), change.index);
          }
        } else {
          if (change.value > 0.5 && change.prev <= 0.5) {
            const piece = DRUM_PIECES[degree % DRUM_PIECES.length];
            triggerDrumPiece(change.padIndex, role, piece, change.value, change.index);
          }
        }
      } else {
        if (change.type === 'axis') {
          if (Math.abs(change.value) > 0.15) {
            startVoice(change.padIndex, role, change.index, midi, Math.abs(change.value));
          } else {
            stopVoice(change.padIndex, role, change.index);
          }
        } else {
          if (change.value > 0.5) {
            startVoice(change.padIndex, role, change.index, midi, change.value);
          } else if (!sustainOn[change.padIndex]) {
            stopVoice(change.padIndex, role, change.index);
          }
        }
      }
      emitActivity(change.padIndex, action, change.value);
      return true;
    }

    if (meta.type === 'sustain') {
      const pressed = change.value > 0.5;
      sustainOn[change.padIndex] = pressed;
      if (!pressed) {
        const gp = navigator.getGamepads ? navigator.getGamepads() : [];
        const raw = gp[change.padIndex];
        if (raw) {
          padCfg.bindings.forEach(b => {
            if (b.action === 'note' && b.type === 'button') {
              const btn = raw.buttons[b.index];
              if (!btn || btn.value <= 0.5) stopVoice(change.padIndex, role, b.index);
            }
          });
        } else {
          Object.keys(heldVoices)
            .filter(k => k.startsWith(change.padIndex + ':'))
            .forEach(k => { heldVoices[k].stop(); delete heldVoices[k]; });
        }
      }
      emitActivity(change.padIndex, action, change.value);
      return true;
    }

    if (meta.type === 'bend') {
      pitchBend = change.value * 2;
      applyPitchBendToHeld();
      emitActivity(change.padIndex, action, change.value);
      return true;
    }

    if (meta.type === 'range') {
      applyRangeAction(role, action, change.value);
      emitActivity(change.padIndex, action, change.value);
      return true;
    }

    const pressed = change.value > 0.5 && change.prev <= 0.5;
    if (!pressed) return false;

    switch (action) {
      case 'playStop': if (seq) seq.toggle(); break;
      case 'arpToggle': if (arp) arp.toggle(); break;
      case 'arpPatternNext': if (arp && typeof USBArpeggiator !== 'undefined') { const pats = USBArpeggiator.PATTERNS; const cur = pats.indexOf(arp.getPattern()); arp.setPattern(pats[(cur + 1) % pats.length]); } break;
      case 'bpmUp': if (seq) seq.setBpm(seq.getBpm() + 5); break;
      case 'bpmDown': if (seq) seq.setBpm(seq.getBpm() - 5); break;
      case 'randomizeAll': randomizeAll(seq, arp); break;
      case 'panic': USBSynth.panic(); break;
      case 'waveNext': {
        const bus = USBSynth.getBus(role);
        if (bus) {
          const cur = WAVES.indexOf(bus.cfg.wave);
          USBSynth.applyParams(bus, { wave: WAVES[(cur + 1) % WAVES.length] });
        }
        break;
      }
      case 'octaveUp':
      case 'octaveDown': {
        const dir = action === 'octaveUp' ? 12 : -12;
        if (roleOctaves[role] === undefined) roleOctaves[role] = 0;
        roleOctaves[role] = Math.min(36, Math.max(-24, roleOctaves[role] + dir));
        break;
      }
    }
    emitActivity(change.padIndex, action, change.value);
    return true;
  }

  return {
    init, handle, activity, BUS_ROLES, WAVES,
    degreeToMidi, randomizeAll,
    roleOctaves, setMixerVolume, setMixerPan, toggleMixerMute, toggleMixerSolo, getMixer, getMixerLevel,
    setChannelSound, getChannelSoundName,
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = USBEngine;
