const USBSynth = (() => {
  let ctx = null;
  let master = null;
  const buses = {};

  function ensure() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createDynamicsCompressor();
      master.threshold.value = -12;
      master.knee.value = 20;
      master.ratio.value = 8;
      const out = ctx.createGain();
      out.gain.value = 0.9;
      master.connect(out);
      out.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  const DISTORTION_CURVES = {};
  function distortionCurve(amount) {
    const key = String(amount);
    if (!DISTORTION_CURVES[key]) {
      const n = 1024, curve = new Float32Array(n);
      const k = amount * 100;
      for (let i = 0; i < n; i++) {
        const x = (i * 2) / n - 1;
        curve[i] = ((3 + k) * x * 20 * Math.PI) / (Math.PI + k * Math.abs(x));
      }
      DISTORTION_CURVES[key] = curve;
    }
    return DISTORTION_CURVES[key];
  }

  function makeBus(name, cfg) {
    const bus = {
      name,
      input: ctx.createGain(),
      cfg: Object.assign({
        wave: 'sawtooth',
        filterType: 'lowpass',
        cutoff: 1200,
        resonance: 5,
        attack: 0.01,
        decay: 0.15,
        sustain: 0.6,
        release: 0.2,
        detune: 0,
        filterEnv: 0.3,
        drive: 0,
        delayTime: 0.25,
        delayFeedback: 0.35,
        delayMix: 0.25,
        reverbMix: 0.2,
        volume: 0.8,
      }, cfg || {}),
      lastParams: null,
      voices: [],
    };

    bus.input.gain.value = bus.cfg.volume;

    const filter = ctx.createBiquadFilter();
    filter.type = bus.cfg.filterType;
    filter.frequency.value = bus.cfg.cutoff;
    filter.Q.value = bus.cfg.resonance;
    bus.filter = filter;

    const driveNode = ctx.createWaveShaper();
    driveNode.oversample = '4x';
    driveNode.curve = distortionCurve(bus.cfg.drive);
    bus.drive = driveNode;

    const dry = ctx.createGain();
    bus.dry = dry;

    const delay = ctx.createDelay(2);
    delay.delayTime.value = bus.cfg.delayTime;
    const fb = ctx.createGain();
    fb.gain.value = bus.cfg.delayFeedback;
    const delaySend = ctx.createGain();
    delaySend.gain.value = bus.cfg.delayMix;
    bus.delay = delay;
    bus.delayFeedback = fb;
    bus.delaySend = delaySend;

    const reverbSend = ctx.createGain();
    reverbSend.gain.value = bus.cfg.reverbMix;
    const reverb = ctx.createConvolver();
    reverb.buffer = impulseResponse(2, 2.5);
    bus.reverb = reverb;
    bus.reverbSend = reverbSend;

    filter.connect(driveNode);
    driveNode.connect(dry);
    dry.connect(master);
    driveNode.connect(delaySend);
    delaySend.connect(delay);
    delay.connect(fb);
    fb.connect(delay);
    delay.connect(master);
    driveNode.connect(reverbSend);
    reverbSend.connect(reverb);
    reverb.connect(master);

    buses[name] = bus;
    return bus;
  }

  let IR_CACHE = null;
  function impulseResponse(seconds, decay) {
    if (IR_CACHE) return IR_CACHE;
    const rate = ctx.sampleRate;
    const len = Math.floor(rate * seconds);
    const buf = ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
    }
    IR_CACHE = buf;
    return buf;
  }

  function makeNoiseBuffer() {
    const len = ctx.sampleRate * 1;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }
  let NOISE_CACHE = null;

  function noteToFreq(note) {
    return 440 * Math.pow(2, (note - 69) / 12);
  }

  function voicesOf(bus) {
    const now = bus.voices.filter(v => !v.done);
    bus.voices = now;
    return now;
  }

  function panic() {
    Object.values(buses).forEach(b => {
      b.voices.forEach(v => {
        try { v.stop && v.stop(); } catch (e) {}
        try { v.gain.gain.cancelScheduledValues(ctx.currentTime); } catch (e) {}
      });
      b.voices = [];
    });
  }

  function triggerVoice(bus, freq, time, dur, velocity = 1, dest = null) {
    if (!ctx) return null;
    const cfg = bus.cfg;
    velocity = Math.min(1, Math.max(0, velocity));
    const t = time !== undefined ? time : ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = cfg.wave;
    osc.frequency.value = freq;
    osc.detune.value = cfg.detune;

    const osc2 = ctx.createOscillator();
    osc2.type = cfg.wave;
    osc2.frequency.value = freq;
    osc2.detune.value = cfg.detune + 8;

    const g = ctx.createGain();
    const peak = velocity * 0.5;
    const a = Math.max(0.001, cfg.attack);
    const d = Math.max(0.001, cfg.decay);
    const s = cfg.sustain;
    const r = Math.max(0.001, cfg.release);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.linearRampToValueAtTime(peak * s, t + a + d);
    let endT;
    if (dur !== undefined) {
      endT = t + Math.max(dur, a + 0.01);
      g.gain.setValueAtTime(peak * s, endT);
      g.gain.linearRampToValueAtTime(0.0001, endT + r);
    }

    osc.connect(g);
    osc2.connect(g);
    g.connect(dest || bus.filter);

    if (cfg.filterEnv > 0) {
      const base = cfg.cutoff;
      const top = Math.min(ctx.sampleRate / 2 - 2000, base * (1 + cfg.filterEnv * 8));
      bus.filter.frequency.cancelScheduledValues(t);
      bus.filter.frequency.setValueAtTime(base, t);
      bus.filter.frequency.linearRampToValueAtTime(top, t + a + 0.02);
      bus.filter.frequency.exponentialRampToValueAtTime(Math.max(40, base), t + a + d + 0.1);
    }

    osc.start(t);
    osc2.start(t);
    if (dur !== undefined) {
      osc.stop(endT + r + 0.05);
      osc2.stop(endT + r + 0.05);
      osc.onended = () => { g.disconnect(); };
      osc2.onended = () => { g.disconnect(); };
    }
    const voice = {
      osc, osc2, gain: g, freq,
      stop() {
        const now = ctx.currentTime;
        try { g.gain.cancelScheduledValues(now); g.gain.setTargetAtTime(0.0001, now, r / 3); } catch (e) {}
        try { osc.stop(now + r + 0.05); } catch (e) {}
        try { osc2.stop(now + r + 0.05); } catch (e) {}
        this.done = true;
      },
    };
    bus.voices.push(voice);
    if (bus.voices.length > 24) voicesOf(bus);
    return voice;
  }

  function applyParams(bus, params) {
    const cfg = bus.cfg;
    let reverbDirty = false;
    for (const k in params) {
      const v = params[k];
      switch (k) {
        case 'wave':
          cfg.wave = v;
          voicesOf(bus).forEach(voice => {
            try { voice.osc.type = v; voice.osc2.type = v; } catch (e) {}
          });
          break;
        case 'cutoff':
          cfg.cutoff = v;
          if (cfg.filterEnv === 0) bus.filter.frequency.setTargetAtTime(v, ctx.currentTime, 0.02);
          break;
        case 'resonance':
          cfg.resonance = v;
          bus.filter.Q.value = v;
          break;
        case 'filterType':
          cfg.filterType = v;
          bus.filter.type = v;
          break;
        case 'drive':
          cfg.drive = v;
          bus.drive.curve = distortionCurve(v);
          break;
        case 'delayTime':
          cfg.delayTime = v;
          bus.delay.delayTime.setTargetAtTime(v, ctx.currentTime, 0.1);
          break;
        case 'delayFeedback':
          cfg.delayFeedback = v;
          bus.delayFeedback.gain.value = v;
          break;
        case 'delayMix':
          cfg.delayMix = v;
          bus.delaySend.gain.value = v;
          break;
        case 'reverbMix':
          cfg.reverbMix = v;
          bus.reverbSend.gain.value = v;
          break;
        case 'detune':
          cfg.detune = v;
          voicesOf(bus).forEach(voice => {
            try { voice.osc.detune.value = v; voice.osc2.detune.value = v + 8; } catch (e) {}
          });
          break;
        case 'volume':
          cfg.volume = v;
          bus.input.gain.setTargetAtTime(v, ctx.currentTime, 0.02);
          break;
        case 'attack': cfg.attack = v; break;
        case 'decay': cfg.decay = v; break;
        case 'sustain': cfg.sustain = v; break;
        case 'release': cfg.release = v; break;
        case 'filterEnv': cfg.filterEnv = v; break;
      }
    }
    bus.lastParams = params;
  }

  function getBus(name) { return buses[name]; }
  function allBuses() { return buses; }
  function context() { return ctx; }
  function masterNode() { return master; }

  const DRUM_KITS = {
    '808':      { kickStart: 150, kickEnd: 42, kickDur: 0.28, kickDrive: 0.0, snareFreq: 1800, snareNoise: 0.55, snareTone: 0.1, hatFreq: 8000, hatDur: 0.05, clapSpread: 0.02 },
    '909':      { kickStart: 220, kickEnd: 48, kickDur: 0.2,  kickDrive: 0.3, snareFreq: 2200, snareNoise: 0.65, snareTone: 0.14, hatFreq: 9500, hatDur: 0.04, clapSpread: 0.015 },
    'acoustic': { kickStart: 120, kickEnd: 55, kickDur: 0.18, kickDrive: 0.0, snareFreq: 1500, snareNoise: 0.45, snareTone: 0.2,  hatFreq: 6500, hatDur: 0.07, clapSpread: 0.03 },
    'lofi':     { kickStart: 100, kickEnd: 50, kickDur: 0.3,  kickDrive: 0.15, snareFreq: 1200, snareNoise: 0.4,  snareTone: 0.3,  hatFreq: 5500, hatDur: 0.09, clapSpread: 0.04 },
  };
  let currentKit = { drums: '808' };

  function setDrumKit(busName, kit) {
    if (DRUM_KITS[kit]) currentKit[busName] = kit;
  }

  function getDrumKit(busName) { return currentKit[busName] || '808'; }

  function triggerPercussion(bus, kind, time, velocity = 1) {
    if (!ctx) return;
    const t = time !== undefined ? time : ctx.currentTime;
    velocity = Math.min(1, Math.max(0, velocity));
    const kit = DRUM_KITS[getDrumKit(bus.name)] || DRUM_KITS['808'];
    if (kind === 'kick') {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(kit.kickStart, t);
      osc.frequency.exponentialRampToValueAtTime(kit.kickEnd, t + kit.kickDur * 0.5);
      const g = ctx.createGain();
      g.gain.setValueAtTime(velocity * (0.9 + kit.kickDrive), t);
      g.gain.exponentialRampToValueAtTime(0.001, t + kit.kickDur);
      const shaper = ctx.createWaveShaper();
      shaper.curve = distortionCurve(kit.kickDrive * 30);
      osc.connect(g);
      g.connect(shaper);
      shaper.connect(bus.filter);
      osc.start(t);
      osc.stop(t + kit.kickDur + 0.05);
      osc.onended = () => { g.disconnect(); shaper.disconnect(); };
    } else if (kind === 'snare') {
      if (!NOISE_CACHE) NOISE_CACHE = makeNoiseBuffer();
      const src = ctx.createBufferSource();
      src.buffer = NOISE_CACHE;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = kit.snareFreq;
      bp.Q.value = 0.8;
      const g = ctx.createGain();
      g.gain.setValueAtTime(velocity * kit.snareNoise, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + kit.snareTone + 0.12);
      const tone = ctx.createOscillator();
      tone.type = 'triangle';
      tone.frequency.value = 190;
      const tg = ctx.createGain();
      tg.gain.setValueAtTime(velocity * kit.snareTone, t);
      tg.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
      src.connect(bp);
      bp.connect(g);
      g.connect(bus.filter);
      tone.connect(tg);
      tg.connect(bus.filter);
      src.start(t);
      src.stop(t + 0.25);
      tone.start(t);
      tone.stop(t + 0.1);
      src.onended = () => { g.disconnect(); tg.disconnect(); };
    } else if (kind === 'hat') {
      if (!NOISE_CACHE) NOISE_CACHE = makeNoiseBuffer();
      const src = ctx.createBufferSource();
      src.buffer = NOISE_CACHE;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = kit.hatFreq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(velocity * 0.3, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + kit.hatDur);
      src.connect(hp);
      hp.connect(g);
      g.connect(bus.filter);
      src.start(t);
      src.stop(t + kit.hatDur + 0.02);
      src.onended = () => g.disconnect();
    } else if (kind === 'clap') {
      if (!NOISE_CACHE) NOISE_CACHE = makeNoiseBuffer();
      const n = kit.clapSpread > 0.03 ? 3 : 3;
      for (let i = 0; i < n; i++) {
        const src = ctx.createBufferSource();
        src.buffer = NOISE_CACHE;
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 1200;
        bp.Q.value = 1.5;
        const g = ctx.createGain();
        const tt = t + i * kit.clapSpread;
        g.gain.setValueAtTime(velocity * 0.4, tt);
        g.gain.exponentialRampToValueAtTime(0.001, tt + 0.1 + i * kit.clapSpread);
        src.connect(bp);
        bp.connect(g);
        g.connect(bus.filter);
        src.start(tt);
        src.stop(tt + 0.2);
      }
    }
  }

  return {
    ensure, makeBus, getBus, allBuses, triggerVoice, triggerPercussion,
    applyParams, noteToFreq, panic, context, masterNode, setDrumKit, getDrumKit,
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = USBSynth;
