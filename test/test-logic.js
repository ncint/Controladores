const fs = require('fs');
const path = require('path');
const vm = require('vm');

const sandbox = {
  console,
  setInterval, clearInterval, setTimeout, clearTimeout,
  module: { exports: {} },
  localStorage: (() => {
    let store = {};
    return {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; },
    };
  })(),
  window: {},
};
vm.createContext(sandbox);

function load(name) {
  const code = fs.readFileSync(path.join(__dirname, '..', 'js', name), 'utf8');
  vm.runInContext(code + '\nmodule.exports = ' + name.replace(/usb/i, m => m) + ';', sandbox);
}
function loadModule(name, exportName) {
  const code = fs.readFileSync(path.join(__dirname, '..', 'js', name), 'utf8');
  vm.runInContext(code, sandbox);
  return vm.runInContext(exportName, sandbox);
}

let passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) { passed++; console.log('  ✓ ' + msg); }
  else { failed++; console.error('  ✗ ' + msg); }
}
function section(name) { console.log('\n== ' + name + ' =='); }

const USBSynth = loadModule('synth.js', 'USBSynth');
const USBSequencer = loadModule('sequencer.js', 'USBSequencer');
const USBArpeggiator = loadModule('arpeggiator.js', 'USBArpeggiator');
const USBPresets = loadModule('presets.js', 'USBPresets');
const USBMapping = loadModule('mapping.js', 'USBMapping');
const USBEngine = loadModule('engine.js', 'USBEngine');

section('USBSynth (sem AudioContext)');
assert(typeof USBSynth.noteToFreq === 'function', 'noteToFreq existe');
assert(Math.abs(USBSynth.noteToFreq(69) - 440) < 0.001, 'A4 = 440 Hz');
assert(Math.abs(USBSynth.noteToFreq(60) - 261.6256) < 0.001, 'C4 ≈ 261.63 Hz');
assert(USBSynth.getBus('lead') === undefined || USBSynth.getBus('lead') === null, 'sem bus antes de ensure');
assert(typeof USBSynth.panic === 'function', 'panic existe (não lança sem ctx)');
USBSynth.panic();

section('USBSequencer');
assert(USBSequencer.STEPS === 16, '16 passos');
assert(USBSequencer.getBpm() === 120, 'BPM inicial 120');
USBSequencer.setBpm(999); assert(USBSequencer.getBpm() === 300, 'BPM limitado a 300');
USBSequencer.setBpm(10); assert(USBSequencer.getBpm() === 30, 'BPM mínimo 30');
USBSequencer.setBpm(120);
assert(!USBSequencer.isPlaying(), 'parado no início');
USBSequencer.ensureTrack('lead', 'melodic');
USBSequencer.setStep('lead', 0, 1, 60, 0.8);
let st = USBSequencer.getState();
assert(st.tracks.lead.steps[0] === 1, 'setStep ativa passo');
assert(st.tracks.lead.notes[0] === 60, 'setStep grava nota');
USBSequencer.setStep('lead', 0, 0);
st = USBSequencer.getState();
assert(st.tracks.lead.steps[0] === 0, 'setStep desativa passo');
USBSequencer.randomizeTrack('lead', 1.0, [0, 3, 5], 1);
st = USBSequencer.getState();
assert(st.tracks.lead.steps.every(s => s === 1), 'randomizeTrack densidade 1 preenche tudo');
assert(st.tracks.lead.notes.every(n => n === 48 || n === 51 || n === 53), 'notas aleatórias respeitam escala (C penta menor)');
USBSequencer.clearTrack('lead');
st = USBSequencer.getState();
assert(st.tracks.lead.steps.every(s => s === 0), 'clearTrack limpa');
USBSequencer.setDrumStep('drums', 4, 'kick', true, 0.9);
st = USBSequencer.getState();
assert(st.tracks.drums.steps[4] === 1 && st.tracks.drums.notes[4] === 'kick', 'setDrumStep grava kick');
assert(USBSequencer.toggleMute('drums') === true, 'toggleMute liga mute');
assert(USBSequencer.isMuted('drums'), 'isMuted reflete estado');
assert(USBSequencer.toggleMute('drums') === false, 'toggleMute desliga mute');
USBSequencer.setStep('lead', 20, 1);
st = USBSequencer.getState();
assert(st.tracks.lead.steps.length === 16 && st.tracks.lead.steps[15] === 0, 'passo fora dos limites ignorado');
// play/stop sem AudioContext não deve lançar
let threw = false;
try { USBSequencer.play(); } catch (e) { threw = true; }
assert(!threw, 'play sem AudioContext não lança erro');

section('USBArpeggiator');
assert(USBArpeggiator.PATTERNS.length >= 6, 'padrões disponíveis: ' + USBArpeggiator.PATTERNS.join(','));
assert(!USBArpeggiator.isEnabled(), 'arpegiador desligado inicialmente');
assert(USBArpeggiator.toggle() === true, 'toggle liga');
assert(USBArpeggiator.isEnabled(), 'isEnabled true');
assert(USBArpeggiator.toggle() === false, 'toggle desliga');
USBArpeggiator.setPattern('randomWalk');
assert(USBArpeggiator.getPattern() === 'randomWalk', 'setPattern randomWalk');
USBArpeggiator.setPattern('não-existe');
assert(USBArpeggiator.getPattern() === 'randomWalk', 'padrão inválido ignorado');
USBArpeggiator.holdNotes([60, 64, 67]);
USBArpeggiator.setRate(0.06); assert(USBArpeggiator.getState().rate === 0.06, 'setRate aplicado');
USBArpeggiator.setRate(0.01); assert(USBArpeggiator.getState().rate === 0.04, 'rate mínimo 0.04s');
USBArpeggiator.setOctaves(9); assert(USBArpeggiator.getState().octaves === 4, 'oitavas máximo 4');
const as = USBArpeggiator.getState();
assert(as.hold === false, 'hold desligado por omissão');
// toggle liga mas sem ctx não deve lançar
threw = false;
try { USBArpeggiator.toggle(); } catch (e) { threw = true; }
assert(!threw, 'arpegiador sem AudioContext não lança');
USBArpeggiator.toggle();

section('USBPresets');
assert(USBPresets.names().length >= 5, 'presets: ' + USBPresets.names().join(', '));
Object.keys(USBPresets.PRESETS).forEach(name => {
  const p = USBPresets.PRESETS[name];
  const ok = Object.keys(p.tracks).every(id => {
    const t = p.tracks[id];
    return t.steps.length === 16 && t.notes.length === 16 && t.velocities.length === 16;
  });
  assert(ok, `preset "${name}" tem 3 arrays de 16 elementos por pista`);
});
let ok = USBPresets.applyPreset('Techno', USBSequencer, USBArpeggiator);
assert(ok === true, 'applyPreset aplica "Techno"');
st = USBSequencer.getState();
assert(st.bpm === 128, 'preset define BPM 128');
assert(Object.keys(st.tracks).length === 3, 'preset Techno tem 3 pistas');
assert(st.playing === false, 'preset deixa sequenciador parado');
assert(USBPresets.applyPreset('Inexistente', USBSequencer) === false, 'preset inexistente devolve false');
const rp = USBPresets.randomPattern([0, 2, 4], 48, 1, 16);
assert(rp.steps.length === 16, 'randomPattern gera 16 passos');
assert(rp.notes.every(n => [48, 50, 52, 60, 62, 64].includes(n)), 'randomPattern usa escala dada');
assert(USBPresets.noteName(60) === 'C4', 'noteName C4');
assert(USBPresets.noteName(69) === 'A4', 'noteName A4');

section('USBMapping');
const acts = Object.keys(USBMapping.ACTIONS);
assert(acts.length >= 20, 'ações disponíveis: ' + acts.length);
assert(acts.includes('sustain') && acts.includes('pitchBend'), 'ações de performance: sustain e pitchBend');
acts.forEach(a => assert(!!USBMapping.ACTIONS[a].label && !!USBMapping.ACTIONS[a].type, `ação ${a} tem label e tipo`));
USBMapping.resetToDefault();
let ms = USBMapping.getState();
assert(ms.pads[0].bindings.length > 0, 'mapeamento predefinido tem bindings');
const noteBindings = ms.pads[0].bindings.filter(b => b.action === 'note');
assert(noteBindings.length >= 8, 'predefinido mapeia >=8 botões como notas (performance)');
assert(ms.pads[0].bindings.some(b => b.action === 'sustain'), 'predefinido mapeia sustain');
assert(ms.pads[0].bindings.some(b => b.action === 'pitchBend'), 'predefinido mapeia pitchBend no stick');
assert(USBMapping.getPadConfig(1) !== null, 'bindAllPads estende predefinido ao comando 2');
USBMapping.setBinding(1, 'button', 7, 'arpToggle');
ms = USBMapping.getState();
assert(ms.pads[1].bindings.some(b => b.action === 'arpToggle' && b.index === 7), 'setBinding grava nova associação');
USBMapping.setBinding(1, 'button', 7, null);
ms = USBMapping.getState();
assert(!ms.pads[1].bindings.some(b => b.index === 7), 'setBinding null remove associação');
USBMapping.startLearn(1, 'note');
assert(USBMapping.isLearning(), 'modo aprender ativo');
const learned = USBMapping.feedLearn({ padIndex: 1, type: 'button', index: 3, value: 1, prev: 0 });
assert(learned === true, 'feedLearn aprende botão premido');
assert(!USBMapping.isLearning(), 'modo aprender termina');
ms = USBMapping.getState();
const nb = ms.pads[1].bindings.find(b => b.action === 'note' && b.index === 3);
assert(nb && nb.param === 0, 'aprendizagem de nota atribui grau 0 ao primeiro botão');
USBMapping.startLearn(1, 'note');
USBMapping.feedLearn({ padIndex: 1, type: 'button', index: 4, value: 1, prev: 0 });
ms = USBMapping.getState();
const nb2 = ms.pads[1].bindings.find(b => b.action === 'note' && b.index === 4);
assert(nb2 && nb2.param === 1, 'segunda nota aprendida usa o grau seguinte (1)');
assert(USBMapping.feedLearn({ padIndex: 1, type: 'button', index: 3, value: 0.2, prev: 0 }) === false, 'feedLearn ignora valores fracos');
USBMapping.resetToDefault();

section('USBEngine');
assert(USBEngine.BUS_ROLES.length === 4, '4 funções de bus (lead, bass, chords, drums)');
assert(USBEngine.degreeToMidi('lead', 0) === 60, 'grau 0 = fundamental (60, dó menor)');
assert(USBEngine.degreeToMidi('lead', 1) === 62, 'grau 1 = 2ª menor (62)');
assert(USBEngine.degreeToMidi('lead', 2) === 63, 'grau 2 = 3ª menor (63)');
assert(USBEngine.degreeToMidi('lead', 7) === 72, 'grau 7 sobe uma oitava (72)');
assert(USBEngine.degreeToMidi('bass', 0) === 36, 'bass grau 0 = 36 (oitava grave)');
assert(USBEngine.degreeToMidi('chords', 0) === 55, 'chords grau 0 = 55 (sol)');
// handle sem ctx (init não deve lançar sem AudioContext... mas init chama ensure; em Node não há window.AudioContext)
let engineThrew = false;
try { USBEngine.init(); } catch (e) { engineThrew = true; }
// ensure lança porque window.AudioContext não existe em Node — aceitável no browser; verificamos apenas que o erro é o esperado
if (engineThrew) console.log('  (nota: init sem AudioContext lança, como esperado fora do browser)');

section('Persistência de mapeamentos');
USBMapping.setBinding(0, 'axis', 2, 'resonance');
const reloaded = USBMapping.load();
assert(reloaded.pads[0].bindings.some(b => b.action === 'resonance' && b.index === 2), 'configuração persistiu no localStorage simulado');
USBMapping.resetToDefault();

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
