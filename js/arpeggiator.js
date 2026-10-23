const USBArpeggiator = (() => {
  const PATTERNS = {
    up: (n) => n,
    down: (n) => n.slice().reverse(),
    updown: (n) => n.concat(n.slice(1, -1).reverse()),
    downup: (n) => n.slice().reverse().concat(n.slice(1, -1)),
    random: (n) => [n[Math.floor(Math.random() * n.length)]],
    randomWalk: null,
    order: (n) => n,
  };

  let state = {
    enabled: false,
    pattern: 'updown',
    rate: 0.125,
    octaves: 2,
    hold: false,
    notes: [],
    index: 0,
    walkLast: 0,
    walkDir: 1,
    gate: 0.8,
  };

  let timer = null;
  let nextTime = 0;
  let busName = 'lead';
  let onNote = null;

  function setBus(name) { busName = name; }

  function setPattern(p) { if (Object.prototype.hasOwnProperty.call(PATTERNS, p)) { state.pattern = p; state.index = 0; } }

  function setRate(sec) { state.rate = Math.min(1, Math.max(0.04, sec)); }

  function setOctaves(o) { state.octaves = Math.min(4, Math.max(1, o)); }

  function setGate(g) { state.gate = Math.min(1, Math.max(0.05, g)); }

  function isEnabled() { return state.enabled; }
  function getPattern() { return state.pattern; }

  function holdNotes(notes) {
    state.notes = (notes || []).slice().sort((a, b) => a - b);
    state.index = 0;
    if (state.hold && !timer) startInternal();
  }

  function setHold(h) {
    state.hold = h;
    if (!h && state.notes.length === 0) stopInternal();
  }

  function toggle() {
    state.enabled = !state.enabled;
    if (state.enabled) startInternal(); else stopInternal();
    return state.enabled;
  }

  function startInternal() {
    stopInternal();
    if (!USBSynth.context()) return;
    nextTime = USBSynth.context().currentTime + 0.05;
    timer = setInterval(schedule, 25);
  }

  function stopInternal() {
    if (timer) { clearInterval(timer); timer = null; }
  }

  function expandedNotes() {
    const notes = state.notes;
    if (!notes.length) return [];
    const out = [];
    for (let o = 0; o < state.octaves; o++) {
      for (const n of notes) out.push(n + o * 12);
    }
    return out;
  }

  function schedule() {
    const ctx = USBSynth.context();
    if (!ctx) return;
    while (nextTime < ctx.currentTime + 0.1) {
      const notes = expandedNotes();
      if (!notes.length) { nextTime = ctx.currentTime + state.rate; continue; }
      let seq;
      if (state.pattern === 'randomWalk') {
        let i = state.walkLast + state.walkDir;
        if (i >= notes.length) { i = notes.length - 2; state.walkDir = -1; }
        if (i < 0) { i = 1; state.walkDir = 1; }
        if (notes.length === 1) i = 0;
        state.walkLast = i;
        seq = [notes[i]];
      } else {
        seq = PATTERNS[state.pattern](notes);
        if (!seq || !seq.length) { nextTime += state.rate; continue; }
      }
      const idx = state.index % seq.length;
      const note = seq[idx];
      const bus = USBSynth.getBus(busName);
      if (bus) {
        const freq = USBSynth.noteToFreq(note);
        const dur = state.rate * state.gate;
        USBSynth.triggerVoice(bus, freq, nextTime, dur, 0.9);
        if (onNote) {
          const delay = Math.max(0, (nextTime - ctx.currentTime) * 1000);
          const nn = note;
          setTimeout(() => onNote(nn), delay);
        }
      }
      state.index++;
      nextTime += state.rate;
    }
  }

  function setOnNote(cb) { onNote = cb; }

  function heldNotes() { return state.notes.slice(); }

  function clearNotes() {
    state.notes = [];
    state.index = 0;
  }

  function getState() {
    return { enabled: state.enabled, pattern: state.pattern, rate: state.rate, octaves: state.octaves, hold: state.hold, gate: state.gate };
  }

  function setState(s) {
    if (!s) return;
    if (s.pattern) setPattern(s.pattern);
    if (s.rate) setRate(s.rate);
    if (s.octaves) setOctaves(s.octaves);
    if (typeof s.hold === 'boolean') state.hold = s.hold;
    if (s.gate) setGate(s.gate);
    state.enabled = !!s.enabled;
  }

  return { toggle, isEnabled, getPattern, setPattern, setRate, setOctaves, setGate, holdNotes, heldNotes, clearNotes, setHold, setBus, setOnNote, getState, setState, PATTERNS: Object.keys(PATTERNS) };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = USBArpeggiator;
