const USBMapping = (() => {
  const STORAGE_KEY = 'usb-orchestra-mappings-v1';

  // Ações que um comando pode controlar.
  const ACTIONS = {
    'playStop': { label: 'Play / Stop', type: 'trigger' },
    'note': { label: 'Nota (grau da escala)', type: 'note', paramLabel: 'grau' },
    'sustain': { label: 'Sustain (notas continuam enquanto premido)', type: 'sustain' },
    'pitchBend': { label: 'Pitch bend (eixo)', type: 'bend' },
    'arpHold': { label: 'Arpejo: manter notas', type: 'note', arp: true },
    'arpToggle': { label: 'Arpejo: ligar/desligar', type: 'trigger' },
    'arpPatternNext': { label: 'Arpejo: próximo padrão', type: 'trigger' },
    'bpmUp': { label: 'BPM +', type: 'trigger' },
    'bpmDown': { label: 'BPM −', type: 'trigger' },
    'seqStepToggle': { label: 'Sequenciador: alternar passo atual', type: 'trigger' },
    'seqRandomTrack': { label: 'Sequenciador: padrão aleatório', type: 'trigger' },
    'seqClearTrack': { label: 'Sequenciador: limpar pista', type: 'trigger' },
    'seqMuteTrack': { label: 'Sequenciador: mute pista', type: 'trigger' },
    'nextPreset': { label: 'Próximo preset', type: 'trigger' },
    'randomizeAll': { label: 'Variar tudo (aleatório)', type: 'trigger' },
    'panic': { label: 'Panic (silenciar tudo)', type: 'trigger' },
    'cutoff': { label: 'Filtro: frequência', type: 'range', min: 100, max: 6000 },
    'resonance': { label: 'Filtro: ressonância', type: 'range', min: 0, max: 20 },
    'delayMix': { label: 'Delay: quantidade', type: 'range', min: 0, max: 1 },
    'reverbMix': { label: 'Reverb: quantidade', type: 'range', min: 0, max: 1 },
    'drive': { label: 'Distorção', type: 'range', min: 0, max: 1 },
    'volume': { label: 'Volume', type: 'range', min: 0, max: 1 },
    'waveNext': { label: 'Onda: próxima', type: 'trigger' },
    'octaveUp': { label: 'Oitava +', type: 'trigger' },
    'octaveDown': { label: 'Oitava −', type: 'trigger' },
  };

  // Mapeamento predefinido de performance: botões = notas, sticks = expressão.
  // Índices "standard" da Gamepad API: 0-3 face, 4-5 ombros, 6-7 gatilhos,
  // 8-9 share/options, 10-11 stick clicks, 12-15 d-pad. Eixos 0-1 stick esq., 2-3 dir.
  const DEFAULT = {
    bindAllPads: true,
    pads: {
      0: {
        role: 'lead',
        bindings: [
          // ✕ ○ □ △ = acorde/scale degrees
          { type: 'button', index: 0, action: 'note', param: 0 },
          { type: 'button', index: 1, action: 'note', param: 2 },
          { type: 'button', index: 2, action: 'note', param: 4 },
          { type: 'button', index: 3, action: 'note', param: 6 },
          // D-pad = notas mais altas
          { type: 'button', index: 12, action: 'note', param: 7 },
          { type: 'button', index: 13, action: 'note', param: 1 },
          { type: 'button', index: 14, action: 'note', param: 3 },
          { type: 'button', index: 15, action: 'note', param: 5 },
          // Ombros = mudar oitava, gatilhos = sustain e nota aguda
          { type: 'button', index: 4, action: 'octaveDown' },
          { type: 'button', index: 5, action: 'octaveUp' },
          { type: 'button', index: 6, action: 'sustain' },
          { type: 'button', index: 7, action: 'note', param: 9 },
          // Share/Options
          { type: 'button', index: 8, action: 'panic' },
          { type: 'button', index: 9, action: 'arpToggle' },
          // Sticks = expressão
          { type: 'axis', index: 0, action: 'pitchBend' },
          { type: 'axis', index: 1, action: 'cutoff' },
          { type: 'axis', index: 2, action: 'resonance' },
          { type: 'axis', index: 3, action: 'delayMix' },
        ],
      },
    },
  };

  let state = load() || JSON.parse(JSON.stringify(DEFAULT));
  const listeners = { learn: [] };

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || !parsed.pads) return null;
      return parsed;
    } catch (e) {
      console.warn('Mapeamentos guardados inválidos, a usar predefinição.', e);
      return null;
    }
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch (e) {
      console.warn('Não foi possível guardar mapeamentos.', e);
      return false;
    }
  }

  function getPadConfig(padIndex) {
    if (state.bindAllPads && !state.pads[padIndex]) {
      return state.pads[0] || null;
    }
    return state.pads[padIndex] || null;
  }

  function setBinding(padIndex, type, controlIndex, action, role, param) {
    if (!state.pads[padIndex]) {
      state.pads[padIndex] = { role: role || 'lead', bindings: [] };
    }
    if (role) state.pads[padIndex].role = role;
    const pad = state.pads[padIndex];
    pad.bindings = pad.bindings.filter(b => !(b.type === type && b.index === controlIndex));
    if (action !== null) {
      const b = { type, index: controlIndex, action };
      if (param !== undefined && param !== null) b.param = param;
      pad.bindings.push(b);
    }
    save();
  }

  function nextFreeDegree(padIndex) {
    const pad = state.pads[padIndex];
    if (!pad) return 0;
    const used = pad.bindings.filter(b => b.action === 'note').map(b => b.param || 0);
    let d = 0;
    while (used.includes(d) && d < 24) d++;
    return d;
  }

  function clearBindings(padIndex) {
    if (state.pads[padIndex]) {
      state.pads[padIndex].bindings = [];
      save();
    }
  }

  function resetToDefault() {
    state = JSON.parse(JSON.stringify(DEFAULT));
    save();
  }

  function onLearn(cb) { listeners.learn.push(cb); }

  let learning = null;
  function startLearn(padIndex, action) {
    learning = { padIndex, action };
  }

  function stopLearn() { learning = null; }

  function isLearning() { return !!learning; }

  function feedLearn(change) {
    if (!learning) return false;
    const { padIndex, action } = learning;
    const significant =
      (change.type === 'button' && change.value > 0.5) ||
      (change.type === 'axis' && Math.abs(change.value) > 0.5);
    if (!significant) return false;
    let param;
    if (action === 'note') param = nextFreeDegree(padIndex);
    setBinding(padIndex, change.type, change.index, action, null, param);
    const info = { padIndex, action, type: change.type, index: change.index, param };
    learning = null;
    listeners.learn.forEach(cb => { try { cb(info); } catch (e) {} });
    return true;
  }

  function getState() { return JSON.parse(JSON.stringify(state)); }
  function setState(s) {
    state = s && s.pads ? s : JSON.parse(JSON.stringify(DEFAULT));
    save();
  }

  return {
    ACTIONS, DEFAULT, getPadConfig, setBinding, clearBindings, resetToDefault,
    save, load, onLearn, startLearn, stopLearn, isLearning, feedLearn,
    getState, setState, nextFreeDegree,
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = USBMapping;
