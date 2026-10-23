const USBSynth = (() => {
  // Núcleo de áudio: 4 instrumentos independentes com cadeias de efeitos próprias,
  // master com proteção contra clipping e agendamento preciso via contexto partilhado.
  let ctx = null;
  let master = null;
  let masterOut = null;
  const buses = {};
  const SAMPLE_PATH = 'samples/';
  const sampleCache = {};
  const loadedKits = {};

  function ensure() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      // Master: limiter suave (compressor de segurança) + volume geral.
      master = ctx.createGain();
      master.gain.value = 0.85;
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -6;
      limiter.knee.value = 6;
      limiter.ratio.value = 12;
      limiter.attack.value = 0.003;
      limiter.release.value = 0.15;
      masterOut = ctx.createGain();
      masterOut.gain.value = 0.9;
      master.connect(limiter);
      limiter.connect(masterOut);
      masterOut.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function noteToFreq(note) {
    return 440 * Math.pow(2, (note - 69) / 12);
  }

  // ---------- Reverb por convolução (impulso sintetizado) ----------
  let IR_CACHE = null;
  function impulseResponse(seconds, decay) {
    if (IR_CACHE) return IR_CACHE;
    const rate = ctx.sampleRate;
    const len = Math.floor(rate * seconds);
    const buf = ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let last = 0;
      for (let i = 0; i < len; i++) {
        // ruído com filtragem passe-baixo simples para cauda mais natural
        const white = Math.random() * 2 - 1;
        last = (last + 0.05 * white) / 1.05;
        d[i] = last * Math.pow(1 - i / len, decay) * 3;
      }
    }
    IR_CACHE = buf;
    return buf;
  }

  function makeNoiseBuffer() {
    const len = ctx.sampleRate;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }
  let NOISE_CACHE = null;

  // ---------- Chorus (2 vozes detunadas com LFO) ----------
  function makeChorus(mix, depth, rate) {
    const input = ctx.createGain();
    const output = ctx.createGain();
    const dry = ctx.createGain();
    dry.gain.value = 1 - (mix || 0) * 0.5;
    input.connect(dry);
    dry.connect(output);
    for (let v = 0; v < 2; v++) {
      const delay = ctx.createDelay(0.05);
      delay.delayTime.value = 0.012 + v * 0.006;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = (rate || 0.6) + v * 0.11;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = (depth || 0.004);
      lfo.connect(lfoGain);
      lfoGain.connect(delay.delayTime);
      const pan = ctx.createStereoPanner();
      pan.pan.value = v === 0 ? -0.6 : 0.6;
      const wet = ctx.createGain();
      wet.gain.value = (mix || 0) * 0.5;
      input.connect(delay);
      delay.connect(pan);
      pan.connect(wet);
      wet.connect(output);
      lfo.start();
    }
    return { input, output };
  }

  // ---------- Distorção musical (soft clip tanh-like) ----------
  const DRIVE_CURVES = {};
  function driveCurve(amount) {
    const key = String(amount);
    if (!DRIVE_CURVES[key]) {
      const n = 2048;
      const curve = new Float32Array(n);
      const k = 1 + amount * 40;
      for (let i = 0; i < n; i++) {
        const x = (i / (n - 1)) * 2 - 1;
        curve[i] = Math.tanh(k * x) / Math.tanh(k);
      }
      DRIVE_CURVES[key] = curve;
    }
    return DRIVE_CURVES[key];
  }

  // ---------- Cadeia de um instrumento ----------
  function makeBus(name, cfg) {
    ensure();
    const bus = {
      name,
      cfg: Object.assign({
        wave: 'sawtooth',
        wave2: null,          // segundo oscilador (mistura)
        sub: 0,               // suboscilador (-1 oitava, quadrada)
        filterType: 'lowpass',
        cutoff: 1200,
        resonance: 5,
        attack: 0.01,
        decay: 0.15,
        sustain: 0.6,
        release: 0.2,
        detune: 0,
        spread: 0,           // desvio do 2º osc
        filterEnv: 0.3,
        drive: 0,
        delayTime: 0.25,
        delayFeedback: 0.35,
        delayMix: 0.25,
        reverbMix: 0.2,
        chorusMix: 0,
        volume: 0.8,
        portamento: 0,
        vibratoRate: 0,
        vibratoDepth: 0,
      }, cfg || {}),
      voices: [],
      lastFreq: null,
      input: null, // ganho de entrada (compat)
    };

    // Cadeia: voz -> [drive] -> filtro -> chorus -> volume -> (dry + delay + reverb) -> master
    const input = ctx.createGain();
    input.gain.value = 1;
    bus.input = input;
    bus.input.gain.value = bus.cfg.volume;

    const shaper = ctx.createWaveShaper();
    shaper.oversample = '4x';
    shaper.curve = driveCurve(bus.cfg.drive);
    bus.shaper = shaper;

    const filter = ctx.createBiquadFilter();
    filter.type = bus.cfg.filterType;
    filter.frequency.value = bus.cfg.cutoff;
    filter.Q.value = bus.cfg.resonance;
    bus.filter = filter;

    const chorus = makeChorus(bus.cfg.chorusMix, 0.004, 0.6);
    bus.chorus = chorus;

    const vol = ctx.createGain();
    vol.gain.value = 1;
    bus.vol = vol;

    const dry = ctx.createGain();
    bus.dry = dry;

    const delaySend = ctx.createGain();
    delaySend.gain.value = bus.cfg.delayMix;
    const delay = ctx.createDelay(2);
    delay.delayTime.value = bus.cfg.delayTime;
    const fb = ctx.createGain();
    fb.gain.value = bus.cfg.delayFeedback;
    const dampen = ctx.createBiquadFilter();
    dampen.type = 'lowpass';
    dampen.frequency.value = 3500;
    bus.delaySend = delaySend;
    bus.delay = delay;
    bus.delayFeedback = fb;

    const reverbSend = ctx.createGain();
    reverbSend.gain.value = bus.cfg.reverbMix;
    const reverb = ctx.createConvolver();
    reverb.buffer = impulseResponse(2.4, 2.5);
    bus.reverbSend = reverbSend;
    bus.reverb = reverb;

    input.connect(shaper);
    shaper.connect(filter);
    filter.connect(chorus.input);
    chorus.output.connect(vol);
    vol.connect(dry);
    dry.connect(master);
    vol.connect(delaySend);
    delaySend.connect(delay);
    delay.connect(dampen);
    dampen.connect(fb);
    fb.connect(delay);
    delay.connect(master);
    vol.connect(reverbSend);
    reverbSend.connect(reverb);
    reverb.connect(master);

    // Vibrato global (LFO -> detune das vozes ativas)
    const vibLfo = ctx.createOscillator();
    vibLfo.frequency.value = bus.cfg.vibratoRate || 5;
    const vibGain = ctx.createGain();
    vibGain.gain.value = bus.cfg.vibratoDepth || 0;
    vibLfo.connect(vibGain);
    vibLfo.start();
    bus.vibLfo = vibLfo;
    bus.vibGain = vibGain;

    buses[name] = bus;
    return bus;
  }

  // ---------- Amostras de bateria ----------
  const KIT_MAP = {
    '808':      { kick: 'kick808.wav', snare: 'snare808.wav', hat: 'hatClosed808.wav', hatOpen: 'hatOpen808.wav', clap: 'clap808.wav', tomLow: 'tomLow808.wav', tomMid: 'tomMid808.wav', tomHigh: 'tomHigh808.wav' },
    '909':      { kick: 'kick909.wav', snare: 'snare909.wav', hat: 'hatClosed909.wav', hatOpen: 'hatOpen909.wav', clap: 'clap909.wav', tomLow: 'tomLow909.wav', tomMid: 'tomMid909.wav', tomHigh: 'tomHigh909.wav' },
    'acoustic': { kick: 'kick808.wav', snare: 'snare808.wav', hat: 'hatClosed808.wav', hatOpen: 'hatOpen808.wav', clap: 'clap808.wav', tomLow: 'tomLow808.wav', tomMid: 'tomMid808.wav', tomHigh: 'tomHigh808.wav' },
    'lofi':     { kick: 'kick808.wav', snare: 'snare808.wav', hat: 'hatClosed808.wav', hatOpen: 'hatOpen808.wav', clap: 'clap808.wav', tomLow: 'tomLow808.wav', tomMid: 'tomMid808.wav', tomHigh: 'tomHigh808.wav' },
  };

  let currentKit = { drums: '808' };

  function setDrumKit(busName, kit) {
    if (KIT_MAP[kit]) currentKit[busName] = kit;
    preloadKit(kit);
  }

  function getDrumKit(busName) { return currentKit[busName] || '808'; }

  function preloadKit(kit) {
    const map = KIT_MAP[kit];
    if (!map || loadedKits[kit]) return;
    loadedKits[kit] = {};
    Object.entries(map).forEach(([piece, file]) => {
      fetch(SAMPLE_PATH + file)
        .then(r => r.arrayBuffer())
        .then(b => ctx.decodeAudioData(b))
        .then(buf => { sampleCache[file] = buf; loadedKits[kit][piece] = file; })
        .catch(() => {});
    });
  }

  function getSample(piece) {
    const kit = KIT_MAP[getDrumKit('drums')] || KIT_MAP['808'];
    const file = kit[piece];
    return sampleCache[file] || null;
  }

  // Peças do sequenciador -> amostras
  function pieceFor(kind) {
    switch (kind) {
      case 'kick': return 'kick';
      case 'snare': return 'snare';
      case 'hat': return 'hat';
      case 'hatOpen': return 'hatOpen';
      case 'clap': return 'clap';
      case 'tomLow': case 'tomMid': case 'tomHigh': return kind;
      default: return kind;
    }
  }

  function triggerPercussion(bus, kind, time, velocity = 1, dest = null) {
    if (!ctx) return;
    const t = time !== undefined ? time : ctx.currentTime;
    velocity = Math.min(1, Math.max(0, velocity));
    const piece = pieceFor(kind);
    const buf = getSample(piece);
    if (buf) {
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const g = ctx.createGain();
      g.gain.value = velocity * (bus.cfg.drumGain ? { kick: 1, snare: 0.9, hat: 0.7, hatOpen: 0.7, clap: 0.85 }[piece] || 1 : 1) * ({ kick: 1, snare: 0.9, hat: 0.7, hatOpen: 0.7, clap: 0.85, tomLow: 0.9, tomMid: 0.9, tomHigh: 0.9 }[piece] || 1);
      src.connect(g);
      g.connect(dest || bus.input);
      src.start(t);
      src.onended = () => { g.disconnect(); };
      return;
    }
    // Fallback sintetizado se a amostra ainda não carregou
    fallbackPercussion(bus, kind, t, velocity, dest);
  }

  function fallbackPercussion(bus, kind, t, velocity, dest) {
    const out = dest || bus.input;
    if (kind === 'kick') {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(140, t);
      osc.frequency.exponentialRampToValueAtTime(45, t + 0.1);
      const g = ctx.createGain();
      g.gain.setValueAtTime(velocity * 0.9, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      osc.connect(g);
      g.connect(out);
      osc.start(t);
      osc.stop(t + 0.3);
      osc.onended = () => g.disconnect();
    } else if (kind === 'snare' || kind === 'hat' || kind === 'clap' || kind === 'hatOpen') {
      if (!NOISE_CACHE) NOISE_CACHE = makeNoiseBuffer();
      const src = ctx.createBufferSource();
      src.buffer = NOISE_CACHE;
      const f = ctx.createBiquadFilter();
      if (kind === 'hat' || kind === 'hatOpen') {
        f.type = 'highpass';
        f.frequency.value = 7000;
      } else {
        f.type = 'bandpass';
        f.frequency.value = kind === 'clap' ? 1200 : 1800;
      }
      const g = ctx.createGain();
      const dur = kind === 'hat' ? 0.06 : kind === 'hatOpen' ? 0.3 : 0.18;
      g.gain.setValueAtTime(velocity * 0.4, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      src.connect(f);
      f.connect(g);
      g.connect(out);
      src.start(t);
      src.stop(t + dur + 0.05);
      src.onended = () => g.disconnect();
    }
  }

  // ---------- Vozes ----------
  function liveVoices(bus) {
    const alive = bus.voices.filter(v => !v.done);
    bus.voices = alive;
    return alive;
  }

  function triggerVoice(bus, freq, time, dur, velocity = 1, dest = null) {
    if (!ctx) return null;
    const cfg = bus.cfg;
    velocity = Math.min(1, Math.max(0, velocity));
    const t = time !== undefined ? time : ctx.currentTime;
    const out = dest || bus.input;

    // Portamento: desliza da última frequência
    let startFreq = freq;
    if (cfg.portamento > 0 && bus.lastFreq) {
      startFreq = bus.lastFreq;
    }

    const a = Math.max(0.001, cfg.attack);
    const d = Math.max(0.001, cfg.decay);
    const s = cfg.sustain;
    const r = Math.max(0.001, cfg.release);

    const g = ctx.createGain();
    const peak = velocity * 0.5;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.linearRampToValueAtTime(Math.max(0.0001, peak * s), t + a + d);
    let endT;
    if (dur !== undefined) {
      endT = t + Math.max(dur, a + 0.01);
      g.gain.setValueAtTime(Math.max(0.0001, peak * s), endT);
      g.gain.linearRampToValueAtTime(0.0001, endT + r);
    }

    // Osciladores principais: 2 (mistura de ondas + spread)
    const oscs = [];
    const mkOsc = (wave, detuneCents, gainVal) => {
      const o = ctx.createOscillator();
      o.type = wave;
      const og = ctx.createGain();
      og.gain.value = gainVal;
      // portamento
      o.frequency.setValueAtTime(startFreq, t);
      if (cfg.portamento > 0) {
        o.frequency.exponentialRampToValueAtTime(freq, t + cfg.portamento);
      } else {
        o.frequency.setValueAtTime(freq, t);
      }
      o.detune.value = detuneCents;
      if (cfg.vibratoDepth > 0) bus.vibGain.connect(o.detune);
      o.connect(og);
      og.connect(g);
      return o;
    };

    const wave1 = cfg.wave;
    oscs.push(mkOsc(wave1, cfg.detune, cfg.wave2 ? 0.5 : 0.7));
    if (cfg.wave2) oscs.push(mkOsc(cfg.wave2, cfg.detune + (cfg.spread || 8), 0.5));
    if (cfg.sub > 0) {
      // suboscilador: quadrada uma oitava abaixo
      const o = ctx.createOscillator();
      o.type = 'square';
      const half = startFreq / 2;
      o.frequency.setValueAtTime(half, t);
      if (cfg.portamento > 0) o.frequency.exponentialRampToValueAtTime(freq / 2, t + cfg.portamento);
      const og = ctx.createGain();
      og.gain.value = cfg.sub * 0.35;
      o.connect(og);
      og.connect(g);
      oscs.push(o);
    }

    // Envelope do filtro
    if (cfg.filterEnv > 0) {
      const base = cfg.cutoff;
      const top = Math.min(ctx.sampleRate / 2 - 2000, base * (1 + cfg.filterEnv * 8));
      const f = bus.filter;
      f.frequency.cancelScheduledValues(t);
      f.frequency.setValueAtTime(base, t);
      f.frequency.linearRampToValueAtTime(top, t + a + 0.02);
      f.frequency.exponentialRampToValueAtTime(Math.max(40, base), t + a + d + 0.15);
    }

    g.connect(out);
    oscs.forEach(o => {
      o.start(t);
      if (dur !== undefined) {
        o.stop(endT + r + 0.05);
        o.onended = () => { g.disconnect(); };
      }
    });

    bus.lastFreq = freq;
    const voice = {
      oscs, gain: g, freq, midi: null,
      stop() {
        const now = ctx.currentTime;
        try { g.gain.cancelScheduledValues(now); g.gain.setTargetAtTime(0.0001, now, r / 3); } catch (e) {}
        oscs.forEach(o => {
          try { o.stop(now + r + 0.05); } catch (e) {}
          try { bus.vibGain.disconnect(o.detune); } catch (e) {}
        });
        this.done = true;
      },
    };
    if (dur === undefined) voice.oscs.forEach(o => { /* contínuo até stop */ });
    bus.voices.push(voice);
    if (bus.voices.length > 24) liveVoices(bus);
    return voice;
  }

  function panic() {
    Object.values(buses).forEach(b => {
      b.voices.forEach(v => {
        try { v.stop && v.stop(); } catch (e) {}
      });
      b.voices = [];
      b.lastFreq = null;
    });
  }

  // ---------- Parâmetros em tempo real ----------
  function applyParams(bus, params) {
    const cfg = bus.cfg;
    for (const k in params) {
      const v = params[k];
      switch (k) {
        case 'wave':
          cfg.wave = v;
          liveVoices(bus).forEach(voice => voice.oscs.forEach((o, i) => {
            try { if (i === 0) o.type = v; } catch (e) {}
          }));
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
          bus.shaper.curve = driveCurve(v);
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
        case 'chorusMix': {
          cfg.chorusMix = v;
          // chorus é estático na cadeia; ajustar via wet/dry é complexo — mantém
          break;
        }
        case 'volume':
          cfg.volume = v;
          bus.input.gain.setTargetAtTime(v, ctx.currentTime, 0.02);
          break;
        case 'detune':
          cfg.detune = v;
          liveVoices(bus).forEach(voice => {
            try { voice.oscs[0].detune.value = v; } catch (e) {}
          });
          break;
        case 'attack': cfg.attack = v; break;
        case 'decay': cfg.decay = v; break;
        case 'sustain': cfg.sustain = v; break;
        case 'release': cfg.release = v; break;
        case 'filterEnv': cfg.filterEnv = v; break;
        case 'portamento': cfg.portamento = v; break;
        case 'vibratoRate':
          cfg.vibratoRate = v;
          bus.vibLfo.frequency.setTargetAtTime(v, ctx.currentTime, 0.05);
          break;
        case 'vibratoDepth':
          cfg.vibratoDepth = v;
          bus.vibGain.gain.setTargetAtTime(v, ctx.currentTime, 0.05);
          break;
        case 'sub': cfg.sub = v; break;
        case 'wave2': cfg.wave2 = v; break;
        case 'spread': cfg.spread = v; break;
      }
    }
  }

  function getBus(name) { return buses[name]; }
  function allBuses() { return buses; }
  function context() { return ctx; }
  function masterNode() { return master; }

  function setMasterVolume(v) {
    if (master) master.gain.setTargetAtTime(Math.min(1.2, Math.max(0, v)), ctx.currentTime, 0.02);
  }
  function getMasterVolume() { return master ? master.gain.value : 0.85; }

  return {
    ensure, makeBus, getBus, allBuses, triggerVoice, triggerPercussion,
    applyParams, noteToFreq, panic, context, masterNode,
    setDrumKit, getDrumKit, setMasterVolume, getMasterVolume,
    preloadKit,
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = USBSynth;
