const USBMapping = (() => {
  const STORAGE_KEY = 'usb-orchestra-mappings-v6';

  // Ações que um comando pode controlar.
  const ACTIONS = {
    'playStop': { label: 'Play / Stop', type: 'trigger' },
    'note': { label: 'Nota (grau da escala)', type: 'note', paramLabel: 'grau' },
    'sustain': { label: 'Sustain (notas continuam enquanto premido)', type: 'sustain' },
    'pitchBend': { label: 'Pitch bend (eixo)', type: 'bend' },
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
          // Sticks = expressão
          { type: 'axis', index: 0, action: 'pitchBend' },
          { type: 'axis', index: 1, action: 'cutoff' },
          { type: 'axis', index: 2, action: 'resonance' },
          { type: 'axis', index: 3, action: 'delayMix' },
        ],
      },
    },
  };

  // Perfis predefinidos por tipo de controlador.
  const PROFILES = {
    generic: {
      label: 'Genérico (com sticks)',
      match: () => true,
      role: 'lead',
      bindings: [
        { type: 'button', index: 0, action: 'note', param: 0 },
        { type: 'button', index: 1, action: 'note', param: 2 },
        { type: 'button', index: 2, action: 'note', param: 4 },
        { type: 'button', index: 3, action: 'note', param: 6 },
        { type: 'button', index: 12, action: 'note', param: 7 },
        { type: 'button', index: 13, action: 'note', param: 1 },
        { type: 'button', index: 14, action: 'note', param: 3 },
        { type: 'button', index: 15, action: 'note', param: 5 },
        { type: 'button', index: 4, action: 'octaveDown' },
        { type: 'button', index: 5, action: 'octaveUp' },
        { type: 'button', index: 6, action: 'sustain' },
        { type: 'button', index: 7, action: 'note', param: 9 },
        { type: 'button', index: 8, action: 'panic' },
        { type: 'axis', index: 0, action: 'pitchBend' },
        { type: 'axis', index: 1, action: 'cutoff' },
        { type: 'axis', index: 2, action: 'resonance' },
        { type: 'axis', index: 3, action: 'delayMix' },
      ],
    },
    snes: {
      label: 'SNES / Super Nintendo',
      // IDs comuns de adaptadores SNES USB costumam conter "snes", "retro", "8bitdo", etc.
      match: (id) => /snes|retro|8bitdo|nes|sfc|usb,2-axis 8-button|playstation.*classic|qanba/i.test(id),
      role: 'lead',
      // Gamepad API para SNES USB (mapping standard):
      // botões 0-3 = X A B Y (face), 4-7 = ombros, 8 = select, 9 = start,
      // 12-15 = d-pad (quando reportado como botões). Alguns adaptadores
      // reportam o d-pad como eixos 0-1.
      // TODOS os botões tocam notas: graus consecutivos da escala.
      bindings: [
        // Face: A B X Y = graus 0-3
        { type: 'button', index: 0, action: 'note', param: 0 },
        { type: 'button', index: 1, action: 'note', param: 1 },
        { type: 'button', index: 2, action: 'note', param: 2 },
        { type: 'button', index: 3, action: 'note', param: 3 },
        // Ombros = graus 4-7
        { type: 'button', index: 4, action: 'note', param: 4 },
        { type: 'button', index: 5, action: 'note', param: 5 },
        { type: 'button', index: 6, action: 'note', param: 6 },
        { type: 'button', index: 7, action: 'note', param: 7 },
        // Select/Start = graus 8-9
        { type: 'button', index: 8, action: 'note', param: 8 },
        { type: 'button', index: 9, action: 'note', param: 9 },
        // D-pad como botões (12-15) = graus 10-13 (duas oitavas acima da fundamental)
        { type: 'button', index: 12, action: 'note', param: 14 },
        { type: 'button', index: 13, action: 'note', param: 15 },
        { type: 'button', index: 14, action: 'note', param: 16 },
        { type: 'button', index: 15, action: 'note', param: 17 },
        // Eixos (se o adaptador reportar d-pad como eixos): X = pitch bend, Y = cutoff
        { type: 'axis', index: 0, action: 'pitchBend' },
        { type: 'axis', index: 1, action: 'cutoff' },
      ],
    },
  };

  function detectProfile(padId, buttonCount, axisCount) {
    const id = (padId || '').toLowerCase();
    // Comandos modernos óbvios → genérico
    if (/dualshock|dualsense|xbox|playstation 4|playstation 5|steam|nintendo switch pro|switch pro/i.test(id)) return 'generic';
    for (const key of Object.keys(PROFILES)) {
      if (key === 'generic') continue;
      const p = PROFILES[key];
      if (p.match(id, buttonCount, axisCount)) return key;
    }
    // Heurística retro: poucos botões e poucos eixos (adaptadores variam:
    // alguns reportam eixos extra ou botões L/R como eixos)
    if (buttonCount <= 13 && axisCount <= 4) return 'snes';
    return 'generic';
  }

  // Ordem de performance SNES: uma oitava da escala no cursor + face.
// Cursor (como eixos): esq, cima, dir, baixo = graus 0-3.
// Botões: 3 = 5ª, 0 = 6ª, 1 = 7ª, 2 = oitava. Botões 4/5 reservados para
// oitava abaixo/acima. Restantes botões continuam nos graus 8+.
  const SNES_NOTE_ORDER = [14, 12, 15, 13, 3, 0, 1, 2];
  const SNES_UTILITY_BUTTONS = [
    { index: 4, action: 'octaveDown' },
    { index: 5, action: 'octaveUp' },
  ];

  function bindingsForProfile(key, buttonCount, axisCount) {
    if (key !== 'snes') return JSON.parse(JSON.stringify(PROFILES[key].bindings));
    const bindings = [];
    const n = Math.min(buttonCount || 16, 16);
    const dpadAsAxes = (axisCount || 0) >= 2;
    if (dpadAsAxes) {
      bindings.push({ type: 'axis', index: 0, action: 'note', param: 0, dir: -1 });
      bindings.push({ type: 'axis', index: 1, action: 'note', param: 1, dir: -1 });
      bindings.push({ type: 'axis', index: 0, action: 'note', param: 2, dir: 1 });
      bindings.push({ type: 'axis', index: 1, action: 'note', param: 3, dir: 1 });
    }
    // Botões utilitários: 4 = oitava abaixo, 5 = oitava acima
    SNES_UTILITY_BUTTONS.forEach(u => {
      if (u.index < n) bindings.push({ type: 'button', index: u.index, action: u.action });
    });
    const utilityIdx = SNES_UTILITY_BUTTONS.map(u => u.index);
    const order = SNES_NOTE_ORDER.slice();
    for (let b = 0; b < n; b++) {
      if (!order.includes(b) && !utilityIdx.includes(b)) order.push(b);
    }
    let degree = dpadAsAxes ? 4 : 0;
    for (const b of order) {
      if (b < n && !utilityIdx.includes(b)) {
        bindings.push({ type: 'button', index: b, action: 'note', param: degree++ });
      }
    }
    return bindings;
  }

  function setProfile(padIndex, key, padId, buttonCount, axisCount) {
    if (!PROFILES[key]) key = 'generic';
    state.pads[padIndex] = {
      role: (state.pads[padIndex] && state.pads[padIndex].role) || PROFILES[key].role,
      profile: key,
      bindings: bindingsForProfile(key, buttonCount, axisCount),
    };
    save();
    return state.pads[padIndex];
  }

  function profileFor(padIndex, padId, buttonCount, axisCount) {
    const cfg = state.pads[padIndex];
    if (cfg && cfg.profile && cfg.bindings && cfg.bindings.length) return cfg;
    const key = detectProfile(padId, buttonCount, axisCount);
    const profile = PROFILES[key];
    const bindings = bindingsForProfile(key, buttonCount, axisCount);
    state.pads[padIndex] = { role: profile.role, profile: key, bindings };
    save();
    return state.pads[padIndex];
  }

  const listeners = { learn: [] };

  let state = load() || JSON.parse(JSON.stringify(DEFAULT));

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

  // Remove versões antigas da configuração guardada (perfis mudaram).
  try {
    Object.keys(localStorage)
      .filter(k => k.startsWith('usb-orchestra-mappings-') && k !== STORAGE_KEY)
      .forEach(k => localStorage.removeItem(k));
  } catch (e) {}

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
    ACTIONS, DEFAULT, PROFILES, detectProfile, profileFor, setProfile, bindingsForProfile, getPadConfig, setBinding, clearBindings, resetToDefault,
    save, load, onLearn, startLearn, stopLearn, isLearning, feedLearn,
    getState, setState, nextFreeDegree,
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = USBMapping;
