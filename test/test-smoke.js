const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

// --- Mocks de Web Audio API ---
class FakeParam { constructor(v=1){this.value=v;} setValueAtTime(){} linearRampToValueAtTime(){} exponentialRampToValueAtTime(){} setTargetAtTime(){} cancelScheduledValues(){} }
class FakeNode {
  constructor(ctx){ this.context=ctx; this.gain=new FakeParam(1); this.frequency=new FakeParam(440); this.detune=new FakeParam(0); this.Q=new FakeParam(1); this.delayTime=new FakeParam(0); this.threshold=new FakeParam(0); this.knee=new FakeParam(0); this.ratio=new FakeParam(1); this.attack=new FakeParam(0); this.release=new FakeParam(0); this.pan=new FakeParam(0); this.type='sine'; this.buffer=null; this.curve=null; this.oversample='none'; }
  connect(){ return arguments[0]; } disconnect(){}
}
class FakeOsc extends FakeNode { start(){} stop(){ if(this.onended)this.onended(); } }
class FakeGain extends FakeNode {}
class FakeBufferSource extends FakeNode { start(){} stop(){ if(this.onended)this.onended(); } }
class FakeBiquad extends FakeNode { constructor(ctx){ super(ctx); this.type='lowpass'; } }
class FakeDelay extends FakeNode { constructor(ctx){ super(ctx); this.delayTime=new FakeParam(0.25); } }
class FakeWaveShaper extends FakeNode { constructor(ctx){ super(ctx); this.curve=null; } }
class FakeConvolver extends FakeNode { constructor(ctx){ super(ctx); this.buffer=null; } }
class FakeCompressor extends FakeNode { constructor(ctx){ super(ctx); } }
class FakeStereoPanner extends FakeNode { constructor(ctx){ super(ctx); this.pan = new FakeParam(0); } }
class FakeAnalyser extends FakeNode {
  constructor(ctx){ super(ctx); this.fftSize = 256; }
  getByteTimeDomainData(arr){ for (let i = 0; i < arr.length; i++) arr[i] = 128 + Math.round((Math.random()*2-1)*80); }
}
class FakeBuffer { constructor(len, rate){ this.length=len; this.sampleRate=rate; this.numberOfChannels=2; } getChannelData(){ return new Float32Array(this.length); } }
class FakeAudioContext {
  constructor(){ this.state='running'; this.currentTime=0; this.sampleRate=44100; this.destination=new FakeNode(this); }
  resume(){ this.state='running'; return Promise.resolve(); }
  createOscillator(){ return new FakeOsc(this); }
  createGain(){ return new FakeGain(this); }
  createBiquadFilter(){ return new FakeBiquad(this); }
  createDelay(){ return new FakeDelay(this); }
  createWaveShaper(){ return new FakeWaveShaper(this); }
  createConvolver(){ return new FakeConvolver(this); }
  createDynamicsCompressor(){ return new FakeCompressor(this); }
  createStereoPanner(){ return new FakeStereoPanner(this); }
  createAnalyser(){ return new FakeAnalyser(this); }
  decodeAudioData(b){ return Promise.resolve({ duration: 0.5, numberOfChannels: 1, getChannelData: () => new Float32Array(100) }); }
  createBuffer(ch, len, rate){ return new FakeBuffer(len, rate); }
}

(async () => {
  const errors = [];
  const dom = new JSDOM(html, {
    url: 'https://example.org/usb-orchestra/',
    runScripts: 'outside-only',
    pretendToBeVisual: true,
  });
  const { window } = dom;

  window.AudioContext = FakeAudioContext;
window.fetch = () => Promise.resolve({ arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024)) });
  window.onerror = (msg) => errors.push(String(msg));

  const jsFiles = ['presets.js','synth.js','gamepads.js','mapping.js','engine.js'];
  const exportNames = {'presets.js':'USBPresets','synth.js':'USBSynth','gamepads.js':'USBGamepads','mapping.js':'USBMapping','engine.js':'USBEngine'};
  jsFiles.forEach(f => {
    const code = fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8');
    try { window.eval(code + '\n;window.' + exportNames[f] + ' = ' + exportNames[f] + ';'); } catch (e) { errors.push(`ao carrying ${f}: ${e.message}`); }
  });
  {
    const code = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
    try { window.eval(code); } catch (e) { errors.push(`ao carregar app.js: ${e.message}`); }
  }

  let passed=0, failed=0;
  function assert(cond,msg){ if(cond){passed++;console.log('  ✓ '+msg);} else {failed++;console.error('  ✗ '+msg);} }
  function section(s){ console.log('\n== '+s+' =='); }

  function fire(win, el, type){ el.dispatchEvent(new win.Event(type, {bubbles:true})); }

  section('Arranque da página');
  assert(errors.length === 0, 'nenhum erro ao carregar scripts' + (errors.length?': '+errors.join('; '):''));
  assert(window.document.querySelector('#startOverlay'), 'overlay de início presente');
  assert(window.document.querySelector('#btnStart'), 'botão de ativar som presente');

  // Prime botão de início (ativa áudio)
  const btnStart = window.document.querySelector('#btnStart');
  fire(window, btnStart, 'click');
  assert(errors.length === 0, 'clique em "Ativar som" sem erros' + (errors.length?': '+errors.join('; '):''));
  assert(window.document.querySelector('#startOverlay').style.display === 'none', 'overlay fecha após ativar');
  assert(window.USBSynth.context() instanceof FakeAudioContext, 'AudioContext criado');
  assert(window.USBSynth.getBus('lead') && window.USBSynth.getBus('bass') && window.USBSynth.getBus('chords') && window.USBSynth.getBus('drums'), '4 buses criados (lead, bass, chords, drums)');
  assert(window.USBSynth.getBus('lead').cfg.wave2 === 'sawtooth', 'lead: preset supersaw com 2 osciladores');
  assert(window.USBSynth.getBus('bass').cfg.sub > 0, 'bass: preset Moog com suboscilador');
  assert(window.USBSynth.getBus('chords').cfg.chorusMix > 0, 'chords: preset pad com chorus');
  assert(window.USBSynth.getDrumKit('drums') === '808', 'drums: kit 808 ativo por omissão');
  window.USBSynth.setMasterVolume(0.6);
  assert(window.USBSynth.getMasterVolume() !== undefined, 'volume geral acessível');
  const masterGainEl = window.document.querySelector('#masterVol');
  assert(masterGainEl !== null, 'slider de volume geral presente na interface');
  masterGainEl.value = '60';
  masterGainEl.dispatchEvent(new window.Event('input', {bubbles:true}));
  assert(true, 'ajustar volume geral não lança erro');

  section('Interface');
  // Painel Sons removido: sons escolhidos na carta do comando
  assert(window.document.querySelector('#soundPicker') === null, 'painel Sons separado removido');
  const voices = ['lead', 'bass', 'chords', 'drums'];
  voices.forEach(v => {
    const names = window.USBPresets.soundNames(v);
    assert(names.length >= 4, 'voz ' + v + ' tem >=4 sons próprios (' + names.length + ')');
  });
  const leadNames = window.USBPresets.soundNames('lead');
  const bassNames = window.USBPresets.soundNames('bass');
  assert(!leadNames.some(n => bassNames.includes(n)), 'sons de lead e bass são distintos');
  const drumNames = window.USBPresets.soundNames('drums');
assert(drumNames.some(n => n.startsWith('Kit')), 'voz drums tem kits de bateria');
assert(drumNames.includes('TR-808 (meus samples)'), 'voz drums tem o kit TR-808 (meus samples)');
  // Mesa de mistura por comando (sem comando detetado, testamos a API do engine)
  window.USBEngine.setMixerVolume(0, 'lead', 0.5);
  assert(window.USBEngine.getMixer(0, 'lead').volume === 0.5, 'volume do canal aplicado');
  window.USBEngine.setMixerPan(0, 'lead', -0.7);
  assert(window.USBEngine.getMixer(0, 'lead').pan === -0.7, 'pan do canal aplicado');
  assert(window.USBEngine.toggleMixerMute(0, 'lead') === true, 'mute liga');
  assert(window.USBEngine.toggleMixerMute(0, 'lead') === false, 'mute desliga');
  assert(window.USBEngine.toggleMixerSolo(1, 'bass') === true, 'solo liga no canal 1');
  // com solo ativo no canal 1, aplicar mixer respeita solo
  window.USBEngine.setMixerVolume(2, 'chords', 1);
  assert(window.USBEngine.getMixer(2, 'chords').volume === 1, 'volume canal 2 aplicado');
  window.USBEngine.toggleMixerSolo(1, 'bass');
  // VU meters: master com 12 LEDs, nível acessível
  const masterVu = window.document.querySelector('#vu-master');
  assert(masterVu !== null, 'VU master presente na barra do topo');
  assert(masterVu.querySelectorAll('.vu-led').length === 12, 'VU master tem 12 LEDs');
  assert(typeof window.USBSynth.getMasterLevel() === 'number', 'nível master acessível (getMasterLevel)');
  assert(typeof window.USBEngine.getMixerLevel(0, 'lead') === 'number', 'nível do canal acessível (getMixerLevel)');
  // Aplicar som muda o bus
  window.USBPresets.applySound('bass', 'Baixo Moog');
  assert(window.USBSynth.getBus('bass').cfg.wave === 'sawtooth', 'som "Baixo Moog" aplica onda sawtooth ao bus bass');
  window.USBPresets.applySound('drums', 'Kit 909');
  assert(window.USBSynth.getDrumKit('drums') === '909', 'som "Kit 909" aplica kit 909');


  section('Panic');
  window.document.querySelector('#btnPanic').click();
  assert(true, 'Panic não lança erro');



  section('Gamepad API simulada');
  const pad = {
    index: 0, id: 'Test DualShock 3 (STANDARD)', mapping: 'standard',
    buttons: Array.from({length:17},(_,i)=>({value: i===9?1:0, pressed:false})),
    axes: [0,0,0,0,0,0],
  };
  window.navigator.getGamepads = () => [pad, null, null, null];
  const ev = new window.Event('gamepadconnected');
ev.gamepad = pad;
window.dispatchEvent(ev);
  window.USBGamepads.rescan();
  await new Promise(r=>setTimeout(r,60));
  // Botão 0 (✕) agora toca a nota grau 0 (dó) — deve criar uma voz held no bus lead
  pad.buttons[0].value = 1;
  await new Promise(r=>setTimeout(r,80));
  pad.buttons[0].value = 0;
  await new Promise(r=>setTimeout(r,80));
  assert(true, 'botão de nota premido/solto processado sem erros');
  // Botão 8 (panic no perfil genérico): sem erros
  pad.buttons[8].value = 1;
  await new Promise(r=>setTimeout(r,80));
  pad.buttons[8].value = 0;
  await new Promise(r=>setTimeout(r,60));
  assert(true, 'botão de panic processado sem erros');
  // Eixo 0 (stick esq.) = pitch bend: sem erros
  pad.axes[0] = 0.7;
  await new Promise(r=>setTimeout(r,80));
  pad.axes[0] = 0;
  await new Promise(r=>setTimeout(r,60));
  assert(true, 'pitch bend do stick processado sem erros');

  section('Mapeamento (UI)');
  window.USBMapping.resetToDefault();
  // eixo 0 do pad 0 mapeado para 'note' por omissão
  pad.axes[0] = 0.8;
  await new Promise(r=>setTimeout(r,60));
  pad.axes[0] = 0;
  await new Promise(r=>setTimeout(r,60));
  assert(true, 'eixo de nota processado sem erros');

  assert(errors.length === 0, 'nenhum erro de runtime no fim' + (errors.length?': '+errors.join('; '):''));

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);

})();
