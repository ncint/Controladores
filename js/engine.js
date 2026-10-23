const USBEngine = (() => {
  const BUS_ROLES = ['lead', 'bass', 'chords', 'drums'];
  const WAVES = ['sine', 'triangle', 'square', 'sawtooth'];
  const NOTE_ROLES = {
    lead: { root: 60, scale: [0, 2, 3, 5, 7, 8, 10], octaves: 2 },
    bass: { root: 36, scale: [0, 3, 5, 7, 10], octaves: 1 },
    chords: { root: 55, scale: [0, 2, 4, 5, 7, 9, 11], octaves: 2 },
  };

  let started = false;
  const heldNotes = {};
  const arpHoldNotes = {};
  const noteZones = {};
  const activeRange = {};
  let currentPresetIndex = 0;
  const onActivity = [];

  function init() {
    if (started) return;
    started = true;
    USBSynth.ensure();
    USBSynth.makeBus('lead', { wave: 'sawtooth', cutoff: 1500, volume: 0.7, delayMix: 0.3, reverbMix: 0.25 });
    USBSynth.makeBus('bass', { wave: 'square', cutoff: 400, volume: 0.8, delayMix: 0.05, reverbMix: 0.05 });
    USBSynth.makeBus('chords', { wave: 'triangle', cutoff: 900, volume: 0.5, delayMix: 0.4, reverbMix: 0.5, attack: 0.2, release: 0.8 });
    USBSynth.makeBus('drums', { wave: 'square', cutoff: 8000, filterType: 'highpass', volume: 0.9, delayMix: 0, reverbMix: 0.1, drive: 0 });
    USBArpeggiator.setBus('lead');
  }

  function activity(cb) { onActivity.push(cb); }
  function emitActivity(padIndex, action, value) {
    onActivity.forEach(cb => { try { cb(padIndex, action, value); } catch (e) {} });
  }

  function quantizeAxis(value, role, invert) {
    const cfg = NOTE_ROLES[role] || NOTE_ROLES.lead;
    const scale = cfg.scale;
    const span = cfg.octaves * 12;
    let v = (value + 1) / 2;
    if (invert) v = 1 - v;
    const idx = Math.round(v * (scale.length * cfg.octaves - 1));
    const oct = Math.floor(idx / scale.length);
    const deg = idx % scale.length;
    return cfg.root + oct * 12 + scale[deg];
  }

  function noteFromZone(padIndex, role, value, invert) {
    const cfg = NOTE_ROLES[role] || NOTE_ROLES.lead;
    const zoneId = padIndex + ':' + role;
    const scale = cfg.scale;
    const stepsN = scale.length * cfg.octaves;
    let v = (value + 1) / 2;
    if (invert) v = 1 - v;
    const idx = Math.min(stepsN - 1, Math.floor(v * stepsN));
    const oct = Math.floor(idx / scale.length);
    const deg = idx % scale.length;
    noteZones[zoneId] = idx;
    return cfg.root + oct * 12 + scale[deg];
  }

  function playNote(padIndex, role, midi, velocity) {
    const bus = USBSynth.getBus(role);
    if (!bus) return;
    const key = padIndex + ':' + role;
    const existing = heldNotes[key];
    if (existing && existing.freq === USBSynth.noteToFreq(midi)) return;
    if (existing) existing.stop();
    const voice = USBSynth.triggerVoice(bus, USBSynth.noteToFreq(midi), undefined, undefined, velocity || 0.9);
    if (voice) heldNotes[key] = voice;
    emitActivity(padIndex, 'note', midi);
  }

  function releaseNote(padIndex, role) {
    const key = padIndex + ':' + role;
    if (heldNotes[key]) {
      heldNotes[key].stop();
      delete heldNotes[key];
    }
  }

  function arpAddNote(padIndex, midi) {
    const key = padIndex + ':arp';
    arpHoldNotes[key] = midi;
    const notes = Object.values(arpHoldNotes);
    USBArpeggiator.holdNotes(notes);
  }

  function arpRemoveNote(padIndex) {
    const key = padIndex + ':arp';
    delete arpHoldNotes[key];
    const notes = Object.values(arpHoldNotes);
    USBArpeggiator.holdNotes(notes);
  }

  function applyRangeAction(role, action, value) {
    const bus = USBSynth.getBus(role);
    if (!bus) return;
    const cfg = USBMapping.ACTIONS[action];
    if (!cfg || cfg.type !== 'range') return;
    const v = value >= 0 ? value : -value;
    const scaled = cfg.min + v * (cfg.max - cfg.min);
    USBSynth.applyParams(bus, { [action]: scaled });
  }

  function nextPreset(seq, arp) {
    const names = USBPresets.names();
    currentPresetIndex = (currentPresetIndex + 1) % names.length;
    USBPresets.applyPreset(names[currentPresetIndex], seq, arp);
    return names[currentPresetIndex];
  }

  function randomizeAll(seq, arp) {
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

  function handle(change, seq, arp) {
    if (!started) init();
    if (USBMapping.isLearning()) {
      if (USBMapping.feedLearn(change)) return true;
    }
    const padCfg = USBMapping.getPadConfig(change.padIndex);
    if (!padCfg) return false;
    const role = padCfg.role;
    let binding = padCfg.bindings.find(b => b.type === change.type && b.index === change.index);
    if (!binding) return false;
    const action = binding.action;
    const meta = USBMapping.ACTIONS[action];
    if (!meta) return false;

    if (meta.type === 'note') {
      if (meta.arp) {
        if (change.type === 'axis') {
          if (Math.abs(change.value) > 0.15) {
            const midi = quantizeAxis(change.value, role, false);
            arpAddNote(change.padIndex, midi);
            if (!arp.isEnabled()) arp.toggle();
          } else {
            arpRemoveNote(change.padIndex);
          }
        } else {
          if (change.value > 0.5) {
            arpAddNote(change.padIndex, noteFromZone(change.padIndex, role, change.index, false));
            if (!arp.isEnabled()) arp.toggle();
          } else {
            arpRemoveNote(change.padIndex);
          }
        }
      } else {
        if (change.type === 'axis') {
          if (Math.abs(change.value) > 0.15) {
            playNote(change.padIndex, role, quantizeAxis(change.value, role, false));
          } else {
            releaseNote(change.padIndex, role);
          }
        } else {
          if (change.value > 0.5) {
            playNote(change.padIndex, role, noteFromZone(change.padIndex, role, change.index, false));
          } else {
            releaseNote(change.padIndex, role);
          }
        }
      }
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
      case 'playStop': seq.toggle(); break;
      case 'arpToggle': arp.toggle(); break;
      case 'arpPatternNext': {
        const pats = USBArpeggiator.PATTERNS;
        const cur = pats.indexOf(arp.getPattern());
        arp.setPattern(pats[(cur + 1) % pats.length]);
        break;
      }
      case 'bpmUp': seq.setBpm(seq.getBpm() + 5); break;
      case 'bpmDown': seq.setBpm(seq.getBpm() - 5); break;
      case 'seqStepToggle': {
        const step = seq.currentStep() >= 0 ? seq.currentStep() : 0;
        const st = seq.getState();
        const tid = Object.keys(st.tracks).find(t => st.tracks[t].kind !== 'drum') || Object.keys(st.tracks)[0];
        if (tid) {
          const t = st.tracks[tid];
          seq.setStep(tid, step, !t.steps[step]);
        }
        break;
      }
      case 'seqRandomTrack': {
        const st = seq.getState();
        const tid = Object.keys(st.tracks).find(t => st.tracks[t].kind !== 'drum') || Object.keys(st.tracks)[0];
        if (tid) {
          const scaleKeys = Object.keys(USBPresets.SCALES);
          const scale = USBPresets.SCALES[scaleKeys[Math.floor(Math.random() * scaleKeys.length)]];
          seq.randomizeTrack(tid, 0.35, scale, 2);
        }
        break;
      }
      case 'seqClearTrack': {
        const st = seq.getState();
        const tid = Object.keys(st.tracks)[0];
        if (tid) seq.clearTrack(tid);
        break;
      }
      case 'seqMuteTrack': {
        const st = seq.getState();
        const tid = Object.keys(st.tracks)[0];
        if (tid) seq.toggleMute(tid);
        break;
      }
      case 'nextPreset': nextPreset(seq, arp); break;
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
        const cfg = NOTE_ROLES[role];
        if (cfg) {
          NOTE_ROLES[role].root = Math.min(96, Math.max(24, cfg.root + dir));
        }
        break;
      }
    }
    emitActivity(change.padIndex, action, change.value);
    return true;
  }

  return { init, handle, activity, BUS_ROLES, WAVES, NOTE_ROLES, quantizeAxis, randomizeAll, nextPreset };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = USBEngine;
