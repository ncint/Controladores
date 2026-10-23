const USBSequencer = (() => {
  const TICKS_PER_BEAT = 4;
  const STEPS = 16;

  let state = {
    bpm: 120,
    swing: 0,
    playing: false,
    currentStep: 0,
    tracks: {},
    mutes: {},
  };

  let timer = null;
  let nextNoteTime = 0;
  let lookahead = 0.1;
  let scheduleInterval = 25;
  let onStep = null;
  let onNote = null;

  function emptyTrack(kind, count) {
    return { kind, steps: new Array(STEPS).fill(0), notes: new Array(STEPS).fill(60), velocities: new Array(STEPS).fill(1) };
  }

  function ensureTrack(id, kind, count) {
    if (!state.tracks[id]) state.tracks[id] = emptyTrack(kind, count);
    return state.tracks[id];
  }

  function ensureMutes(id) {
    if (!state.mutes[id]) state.mutes[id] = false;
  }

  function steps() { return STEPS; }
  function getBpm() { return state.bpm; }
  function setBpm(bpm) { state.bpm = Math.min(300, Math.max(30, bpm)); }
  function getSwing() { return state.swing; }
  function setSwing(s) { state.swing = Math.min(1, Math.max(0, s)); };

  function isPlaying() { return state.playing; }
  function currentStep() { return state.currentStep; }

  function secondsPerStep() {
    const beatsPerStep = 1 / TICKS_PER_BEAT;
    const sec = (60 / state.bpm) * beatsPerStep;
    return sec;
  }

  function play() {
    if (state.playing) return;
    try { USBSynth.ensure(); } catch (e) { return; }
    if (!USBSynth.context()) return;
    state.playing = true;
    nextNoteTime = USBSynth.context().currentTime + 0.05;
    state.currentStep = 0;
    timer = setInterval(scheduler, scheduleInterval);
  }

  function stop() {
    state.playing = false;
    if (timer) { clearInterval(timer); timer = null; }
    state.currentStep = 0;
    if (onStep) onStep(-1);
  }

  function toggle() { state.playing ? stop() : play(); }

  function scheduler() {
    const ctx = USBSynth.context();
    if (!ctx) { stop(); return; }
    while (nextNoteTime < ctx.currentTime + lookahead) {
      const step = state.currentStep;
      const swingOffset = (step % 2 === 1) ? secondsPerStep() * state.swing * 0.5 : 0;
      const time = nextNoteTime + swingOffset;
      scheduleStep(step, time);
      if (onStep) {
        const delay = Math.max(0, (time - ctx.currentTime) * 1000);
        setTimeout(() => { if (state.playing) onStep(step); }, delay);
      }
      state.currentStep = (state.currentStep + 1) % STEPS;
      nextNoteTime += secondsPerStep();
    }
  }

  function scheduleStep(step, time) {
    for (const id in state.tracks) {
      if (state.mutes[id]) continue;
      const track = state.tracks[id];
      const vel = track.velocities[step];
      if (track.steps[step] > 0) {
        if (track.kind === 'drum') {
          const kind = track.notes[step];
          USBSynth.triggerPercussion(USBSynth.getBus(id) || USBSynth.getBus('drums'), kind, time, vel);
          if (onNote) onNote(id, step, time, vel);
        } else {
          const bus = USBSynth.getBus(id);
          if (bus) {
            const freq = USBSynth.noteToFreq(track.notes[step]);
            const dur = secondsPerStep() * track.steps[step] * 0.9;
            USBSynth.triggerVoice(bus, freq, time, dur, vel);
            if (onNote) onNote(id, step, time, vel);
          }
        }
      }
    }
  }

  function setStep(id, step, value, note, velocity) {
    const track = ensureTrack(id, 'melodic');
    if (step < 0 || step >= STEPS) return;
    track.steps[step] = value ? (value === true ? 1 : value) : 0;
    if (note !== undefined) track.notes[step] = note;
    if (velocity !== undefined) track.velocities[step] = velocity;
  }

  function setDrumStep(id, step, drumKind, on, velocity) {
    const track = ensureTrack(id, 'drum');
    if (step < 0 || step >= STEPS) return;
    track.steps[step] = on ? 1 : 0;
    if (drumKind) track.notes[step] = drumKind;
    if (velocity !== undefined) track.velocities[step] = velocity;
  }

  function toggleMute(id) {
    ensureMutes(id);
    state.mutes[id] = !state.mutes[id];
    return state.mutes[id];
  }

  function isMuted(id) { return !!state.mutes[id]; }

  function clearTrack(id) {
    if (state.tracks[id]) {
      state.tracks[id].steps.fill(0);
      state.tracks[id].velocities.fill(1);
    }
  }

  function clearAll() {
    for (const id in state.tracks) clearTrack(id);
  }

  function randomizeTrack(id, density, scale, octaves) {
    const track = ensureTrack(id, 'melodic');
    density = density || 0.4;
    scale = scale || [0, 2, 3, 5, 7, 8, 10];
    octaves = octaves || 1;
    for (let s = 0; s < STEPS; s++) {
      if (Math.random() < density) {
        track.steps[s] = 1;
        const deg = Math.floor(Math.random() * scale.length);
        const oct = Math.floor(Math.random() * octaves) * 12;
        track.notes[s] = 48 + scale[deg] + oct;
        track.velocities[s] = 0.6 + Math.random() * 0.4;
      } else {
        track.steps[s] = 0;
      }
    }
  }

  function randomizeDrumTrack(id, density) {
    const track = ensureTrack(id, 'drum');
    density = density || 0.3;
    for (let s = 0; s < STEPS; s++) {
      const on = Math.random() < density;
      track.steps[s] = on ? 1 : 0;
      if (on) track.velocities[s] = 0.6 + Math.random() * 0.4;
    }
  }

  function getState() {
    return JSON.parse(JSON.stringify(state));
  }

  function setState(s) {
    state = s;
    if (!state.tracks) state.tracks = {};
    if (!state.mutes) state.mutes = {};
    state.bpm = Math.min(300, Math.max(30, state.bpm || 120));
    state.playing = false;
  }

  function setCallbacks(stepCb, noteCb) { onStep = stepCb; onNote = noteCb; }

  return {
    play, stop, toggle, isPlaying, currentStep, steps, setStep, setDrumStep,
    getBpm, setBpm, getSwing, setSwing, toggleMute, isMuted, clearTrack, clearAll,
    randomizeTrack, randomizeDrumTrack, getState, setState, setCallbacks,
    ensureTrack, ensureMutes, STEPS,
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = USBSequencer;
