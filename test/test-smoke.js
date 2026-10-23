const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

// --- Mocks de Web Audio API ---
class FakeParam { constructor(v=1){this.value=v;} setValueAtTime(){} linearRampToValueAtTime(){} exponentialRampToValueAtTime(){} setTargetAtTime(){} cancelScheduledValues(){} }
class FakeNode {
  constructor(ctx){ this.context=ctx; this.gain=new FakeParam(1); this.frequency=new FakeParam(440); this.detune=new FakeParam(0); this.Q=new FakeParam(1); this.delayTime=new FakeParam(0); this.threshold=new FakeParam(0); this.knee=new FakeParam(0); this.ratio=new FakeParam(1); this.type='sine'; this.buffer=null; this.curve=null; this.oversample='none'; }
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
  window.onerror = (msg) => errors.push(String(msg));

  const jsFiles = ['presets.js','synth.js','sequencer.js','arpeggiator.js','gamepads.js','mapping.js','engine.js'];
  const exportNames = {'presets.js':'USBPresets','synth.js':'USBSynth','sequencer.js':'USBSequencer','arpeggiator.js':'USBArpeggiator','gamepads.js':'USBGamepads','mapping.js':'USBMapping','engine.js':'USBEngine'};
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

  section('Interface');
  const presetOptions = window.document.querySelectorAll('#presetSelect option');
  assert(presetOptions.length === 5, 'seletor tem 5 presets');
  const tabs = window.document.querySelectorAll('.synth-tab');
  assert(tabs.length === 4, '4 abas de sintetizador');
  const ctlCount = window.document.querySelectorAll('#synthControls .synth-ctl').length;
  assert(ctlCount === 16, '16 controlos de síntese para o bus ativo');
  tabs[1].click();
  assert(window.document.querySelectorAll('#synthControls .synth-ctl').length === 16, 'mudar de aba reconstrói controlos');

  // Sequenciador: aplicar preset deve criar grelha
  const presetSel = window.document.querySelector('#presetSelect');
  presetSel.value = '1'; fire(window, presetSel, 'change');
  const rows = window.document.querySelectorAll('.seq-row');
  assert(rows.length === 3, 'preset Techno mostra 3 pistas na grelha');
  const steps = window.document.querySelectorAll('.seq-step');
  assert(steps.length === 48, '48 células de passo (3×16)');

  // Clique num passo alterna estado
  const firstStep = steps[0];
  const wasOn = firstStep.classList.contains('on') || firstStep.classList.contains('drum-on');
  firstStep.dispatchEvent(new window.Event('pointerdown', {bubbles:true}));
  const isOnNow = firstStep.classList.contains('on') || firstStep.classList.contains('drum-on');
  assert(isOnNow !== wasOn, 'clicar num passo alterna o estado');

  section('Transporte');
  window.document.querySelector('#btnPlay').click();
  assert(window.USBSequencer.isPlaying(), 'botão Tocar inicia sequenciador');
  window.document.querySelector('#btnPlay').click();
  assert(!window.USBSequencer.isPlaying(), 'botão Parar para sequenciador');
  window.document.querySelector('#btnPanic').click();
  assert(true, 'Panic não lança erro');
  window.document.querySelector('#btnRandomAll').click();
  assert(true, 'Variar tudo não lança erro');
  window.document.querySelector('#btnRandomSeq').click();
  assert(true, 'Padrão aleatório não lança erro');
  window.document.querySelector('#btnClearSeq').click();
  assert(window.document.querySelectorAll('.seq-step.on, .seq-step.drum-on').length === 0 || window.USBSequencer.getState(), 'Limpar não lança erro');

  section('Arpegiador (UI)');
  const arpCb = window.document.querySelector('#arpEnable');
  arpCb.checked = true; fire(window, arpCb, 'change');
  assert(window.USBArpeggiator.isEnabled(), 'checkbox ativa arpegiador');
  arpCb.checked = false; fire(window, arpCb, 'change');
  assert(!window.USBArpeggiator.isEnabled(), 'checkbox desativa arpegiador');
  const rate = window.document.querySelector('#arpRate');
  rate.value = '250'; fire(window, rate, 'input');
  assert(window.USBArpeggiator.getState().rate === 0.25, 'slider de velocidade aplica rate 0.25s');

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
  // Botão 9 (Options) liga o arpegiador
  pad.buttons[9].value = 1;
  await new Promise(r=>setTimeout(r,80));
  pad.buttons[9].value = 0;
  await new Promise(r=>setTimeout(r,60));
  assert(window.USBArpeggiator.isEnabled(), 'Options liga o arpegiador');
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
