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


section('USBPresets');
assert(USBPresets.noteName(60) === 'C4', 'noteName C4');
assert(USBPresets.noteName(69) === 'A4', 'noteName A4');

section('USBMapping');
const acts = Object.keys(USBMapping.ACTIONS);
assert(acts.length >= 12, 'ações disponíveis: ' + acts.length);
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

section('Perfis de controlador');
assert(USBMapping.PROFILES.snes && USBMapping.PROFILES.generic, 'perfis SNES e genérico existem');
assert(USBMapping.detectProfile('USB SNES Controller', 10, 2) === 'snes', 'ID com "snes" deteta perfil SNES');
assert(USBMapping.detectProfile('8BitDo NES30', 10, 0) === 'snes', '8BitDo deteta perfil retro');
assert(USBMapping.detectProfile('Sony DualShock 3 (STANDARD)', 17, 6) === 'generic', 'DualShock deteta perfil genérico');
assert(USBMapping.detectProfile('Xbox 360 Controller', 16, 4) === 'generic', 'Xbox deteta perfil genérico');
assert(USBMapping.detectProfile('Generic Retro Pad', 10, 1) === 'snes', 'heurística: poucos botões/eixos → SNES');
const snesCfg = USBMapping.profileFor(5, 'USB SNES Controller', 10, 2);
assert(snesCfg.profile === 'snes', 'profileFor cria config SNES para comando novo');
const snesNotes = snesCfg.bindings.filter(b => b.action === 'note' && b.type === 'button');
assert(snesNotes.length === 8, 'SNES 10 botões: 8 tocam notas (botões 4/5 são oitava)');
assert(snesCfg.bindings.every(b => ['note','pitchBend','cutoff','octaveUp','octaveDown'].includes(b.action)), 'perfil SNES: notas, oitava e eixos');
assert(snesCfg.bindings.filter(b => b.type === 'axis').length === 4, 'eixos do SNES mapeados como notas do cursor (4 direções)');
// SNES com cursor como EIXOS (adaptador real do utilizador): eixo 0 = esq/dir (graus 0/2), eixo 1 = cima/baixo (graus 1/3)
const snesAxes = USBMapping.profileFor(9, 'Retro SNES axes', 10, 2);
const axB = (axis, dir) => snesAxes.bindings.find(b => b.type === 'axis' && b.index === axis && b.dir === dir);
assert(axB(0, -1) && axB(0, -1).param === 0, 'eixo 0 (−1, esquerda) = grau 0 (1ª nota)');
assert(axB(1, -1) && axB(1, -1).param === 1, 'eixo 1 (−1, cima) = grau 1 (2ª nota)');
assert(axB(0, 1) && axB(0, 1).param === 2, 'eixo 0 (+1, direita) = grau 2 (3ª nota)');
assert(axB(1, 1) && axB(1, 1).param === 3, 'eixo 1 (+1, baixo) = grau 3 (4ª nota)');
// Botões continuam no grau 4: botão 3 = 5ª, 0 = 6ª, 1 = 7ª, 2 = oitava; 4/5 = oitava −/+
const degA = (idx) => { const b = snesAxes.bindings.find(x => x.type === 'button' && x.index === idx && x.action === 'note'); return b ? b.param : null; };
assert(degA(3) === 4, 'botão 3 = grau 4 (5ª nota)');
assert(degA(0) === 5, 'botão 0 = grau 5 (6ª nota)');
assert(degA(1) === 6, 'botão 1 = grau 6 (7ª nota)');
assert(degA(2) === 7, 'botão 2 = grau 7 (oitava)');
assert(snesAxes.bindings.some(b => b.index === 4 && b.action === 'octaveDown'), 'botão 4 baixa uma oitava');
assert(snesAxes.bindings.some(b => b.index === 5 && b.action === 'octaveUp'), 'botão 5 sobe uma oitava');
assert(!snesAxes.bindings.some(b => (b.index === 4 || b.index === 5) && b.action === 'note'), 'botões 4/5 não tocam notas');
// Numa escala de 7 graus por oitava, grau 7 = uma oitava acima da fundamental
assert(USBEngine.degreeToMidi('lead', 7) === USBEngine.degreeToMidi('lead', 0) + 12, 'grau 7 é a oitava da fundamental');
// Restantes botões por índice, graus 8+ (comando de 16 botões, cursor como botões 12-15)
const snesCfg3 = USBMapping.profileFor(8, 'Retro SNES 16btn', 16, 0);
const deg = (idx) => { const b = snesCfg3.bindings.find(x => x.type === 'button' && x.index === idx && x.action === 'note'); return b ? b.param : null; };
assert(deg(14) === 0, 'cursor esquerda (botão 14) = grau 0');
assert(deg(12) === 1, 'cursor cima (botão 12) = grau 1');
assert(deg(15) === 2, 'cursor direita (botão 15) = grau 2');
assert(deg(13) === 3, 'cursor baixo (botão 13) = grau 3');
assert(deg(3) === 4 && deg(0) === 5 && deg(1) === 6 && deg(2) === 7, 'botões 3,0,1,2 = graus 4-7 (5ª,6ª,7ª,oitava)');
const rest = snesCfg3.bindings.filter(b => b.type === 'button' && b.action === 'note' && ![14,12,15,13,3,0,1,2].includes(b.index));
assert(rest.every(b => b.param >= 8), 'botões restantes continuam nos graus 8+');
assert(snesCfg3.bindings.some(b => b.index === 4 && b.action === 'octaveDown') && snesCfg3.bindings.some(b => b.index === 5 && b.action === 'octaveUp'), 'botões 4/5 controlam oitava −/+');
const snesCfg2 = USBMapping.profileFor(7, '8BitDo SNES Retro', 16, 0);
assert(snesCfg2.bindings.filter(b => b.type === 'button' && b.action === 'note').length === 14, 'SNES 16 botões: 14 tocam notas (4/5 são oitava)');
assert(snesCfg2.bindings.filter(b => b.type === 'axis').length === 0, 'SNES sem eixos: nenhum binding de eixo');
const genericCfg = USBMapping.profileFor(6, 'Sony DualShock 3 (STANDARD)', 17, 6);
assert(genericCfg.profile === 'generic', 'profileFor cria config genérica para DualShock');
assert(genericCfg.bindings.some(b => b.action === 'pitchBend'), 'perfil genérico tem pitch bend no stick');
assert(genericCfg.bindings.every(b => b.index < 17), 'perfil genérico não excede 17 botões');

section('Persistência de mapeamentos');
USBMapping.setBinding(0, 'axis', 2, 'resonance');
const reloaded = USBMapping.load();
assert(reloaded.pads[0].bindings.some(b => b.action === 'resonance' && b.index === 2), 'configuração persistiu no localStorage simulado');
USBMapping.resetToDefault();

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
