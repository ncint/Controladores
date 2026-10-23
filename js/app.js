(() => {
  let started = false;
  let activeSynthTab = 'lead';
  let arpRateMs = 125;
  let flashTimeouts = {};

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  const SYNTH_CTLS = [
    { key: 'wave', label: 'Forma de onda', type: 'select', options: ['sine', 'triangle', 'square', 'sawtooth'] },
    { key: 'filterType', label: 'Tipo de filtro', type: 'select', options: ['lowpass', 'highpass', 'bandpass', 'notch'] },
    { key: 'cutoff', label: 'Filtro: frequência', type: 'range', min: 100, max: 6000, step: 10 },
    { key: 'resonance', label: 'Filtro: ressonância', type: 'range', min: 0, max: 20, step: 0.1 },
    { key: 'filterEnv', label: 'Envelope do filtro', type: 'range', min: 0, max: 1, step: 0.01 },
    { key: 'attack', label: 'Ataque', type: 'range', min: 0.001, max: 1, step: 0.001 },
    { key: 'decay', label: 'Decaimento', type: 'range', min: 0.01, max: 2, step: 0.01 },
    { key: 'sustain', label: 'Sustain', type: 'range', min: 0, max: 1, step: 0.01 },
    { key: 'release', label: 'Release', type: 'range', min: 0.01, max: 3, step: 0.01 },
    { key: 'detune', label: 'Detune', type: 'range', min: -50, max: 50, step: 1 },
    { key: 'drive', label: 'Distorção', type: 'range', min: 0, max: 1, step: 0.01 },
    { key: 'delayTime', label: 'Delay: tempo', type: 'range', min: 0.02, max: 1.5, step: 0.01 },
    { key: 'delayFeedback', label: 'Delay: feedback', type: 'range', min: 0, max: 0.85, step: 0.01 },
    { key: 'delayMix', label: 'Delay: quantidade', type: 'range', min: 0, max: 1, step: 0.01 },
    { key: 'reverbMix', label: 'Reverb', type: 'range', min: 0, max: 1, step: 0.01 },
    { key: 'volume', label: 'Volume', type: 'range', min: 0, max: 1, step: 0.01 },
  ];

  function start() {
    if (started) return;
    started = true;
    USBEngine.init();
    $('#startOverlay').style.display = 'none';
    buildPresetSelect();
    buildSynthControls();
    buildSeqGrid();
    buildMappingUI();
    refreshPads();
    USBGamepads.on('connect', () => { refreshPads(); buildMappingUI(); });
    USBGamepads.on('disconnect', () => { refreshPads(); });
    USBGamepads.on('change', (change) => {
      USBEngine.handle(change, USBSequencer, USBArpeggiator);
      markPadActive(change.padIndex);
    });
    USBSequencer.setCallbacks(renderStep, null);
    USBArpeggiator.setOnNote(() => {});
  }

  function buildPresetSelect() {
    const sel = $('#presetSelect');
    sel.innerHTML = '';
    USBPresets.names().forEach((n, i) => {
      const o = document.createElement('option');
      o.value = i; o.textContent = '🎚 ' + n;
      sel.appendChild(o);
    });
    sel.onchange = () => {
      const name = USBPresets.names()[sel.value];
      USBPresets.applyPreset(name, USBSequencer, USBArpeggiator);
      syncTransportUI();
      buildSeqGrid();
      flash('Preset: ' + name);
    };
  }

  function syncTransportUI() {
    $('#bpmInput').value = USBSequencer.getBpm();
    $('#swingInput').value = Math.round(USBSequencer.getSwing() * 100);
    $('#btnPlay').textContent = USBSequencer.isPlaying() ? '⏸ Parar' : '▶ Tocar';
  }

  function flash(msg) {
    let el = $('#flash');
    if (!el) {
      el = document.createElement('div');
      el.id = 'flash';
      el.className = 'flash';
      el.style.cssText = 'position:fixed;bottom:70px;left:50%;transform:translateX(-50%);background:#1e2130;border:1px solid #2c314a;color:#e8eaf2;padding:10px 18px;border-radius:12px;z-index:60;font-size:14px;';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.display = 'block';
    clearTimeout(flashTimeouts.msg);
    flashTimeouts.msg = setTimeout(() => { el.style.display = 'none'; }, 1600);
  }

  function refreshPads() {
    const list = $('#padsList');
    const pads = USBGamepads.all();
    if (!pads.length) {
      list.innerHTML = '<p class="empty">Nenhum comando detetado. Prime um botão num comando ligado por USB.</p>';
      return;
    }
    list.innerHTML = '';
    pads.slice(0, USBGamepads.MAX_PADS).forEach(p => {
      const cfg = USBMapping.getPadConfig(p.index);
      const div = document.createElement('div');
      div.className = 'pad-card';
      div.id = 'pad-card-' + p.index;
      div.innerHTML = `
        <div class="pad-title"><span class="pad-dot" id="pad-dot-${p.index}"></span>Comando ${p.index + 1}</div>
        <div class="pad-id">${p.id}</div>
        <div class="pad-role">Função: ${cfg ? cfg.role : '—'}</div>
        <div class="pad-meta">${p.buttonCount} botões · ${p.axisCount} eixos${p.mapping ? ' · ' + p.mapping : ''}</div>`;
      list.appendChild(div);
    });
  }

  let padActiveTimeouts = {};
  function markPadActive(idx) {
    const dot = $('#pad-dot-' + idx);
    if (!dot) return;
    dot.classList.add('on');
    clearTimeout(padActiveTimeouts[idx]);
    padActiveTimeouts[idx] = setTimeout(() => dot.classList.remove('on'), 300);
  }

  function buildSeqGrid() {
    const grid = $('#seqGrid');
    grid.innerHTML = '';
    const state = USBSequencer.getState();
    const trackIds = Object.keys(state.tracks);
    if (!trackIds.length) {
      grid.innerHTML = '<p class="empty">Sem pistas. Escolhe um preset ou prime "🎲 Padrão".</p>';
      return;
    }
    trackIds.forEach(id => {
      const track = state.tracks[id];
      const row = document.createElement('div');
      row.className = 'seq-row';
      const label = document.createElement('div');
      label.className = 'seq-label';
      label.textContent = id;
      const stepsEl = document.createElement('div');
      stepsEl.className = 'seq-steps';
      for (let s = 0; s < USBSequencer.STEPS; s++) {
        const cell = document.createElement('div');
        cell.className = 'seq-step' + (track.steps[s] ? (track.kind === 'drum' ? ' drum-on' : ' on') : '');
        cell.dataset.track = id;
        cell.dataset.step = s;
        cell.onpointerdown = () => {
          const st = USBSequencer.getState();
          const t = st.tracks[id];
          USBSequencer.setStep(id, s, !t.steps[s]);
          cell.classList.toggle('on', !t.steps[s]);
          cell.classList.toggle('drum-on', track.kind === 'drum' && !t.steps[s]);
        };
        stepsEl.appendChild(cell);
      }
      const mute = document.createElement('button');
      mute.className = 'mute-btn' + (USBSequencer.isMuted(id) ? ' muted' : '');
      mute.textContent = USBSequencer.isMuted(id) ? '🔇' : '🔊';
      mute.onclick = () => {
        USBSequencer.toggleMute(id);
        mute.textContent = USBSequencer.isMuted(id) ? '🔇' : '🔊';
        mute.classList.toggle('muted', USBSequencer.isMuted(id));
      };
      row.appendChild(label);
      row.appendChild(stepsEl);
      row.appendChild(mute);
      grid.appendChild(row);
    });
  }

  let currentStepShown = -1;
  function renderStep(step) {
    if (step === currentStepShown) return;
    currentStepShown = step;
    $$('.seq-step').forEach(c => c.classList.remove('current'));
    if (step < 0) return;
    $$(`.seq-step[data-step="${step}"]`).forEach(c => c.classList.add('current'));
  }

  function buildSynthControls() {
    const tabs = $('#synthTabs');
    tabs.innerHTML = '';
    USBEngine.BUS_ROLES.forEach(role => {
      const t = document.createElement('button');
      t.className = 'synth-tab' + (role === activeSynthTab ? ' active' : '');
      t.textContent = role;
      t.onclick = () => { activeSynthTab = role; buildSynthControls(); };
      tabs.appendChild(t);
    });
    const box = $('#synthControls');
    box.innerHTML = '';
    const bus = USBSynth.getBus(activeSynthTab);
    if (!bus) return;
    SYNTH_CTLS.forEach(ctl => {
      const div = document.createElement('div');
      div.className = 'synth-ctl';
      const label = document.createElement('label');
      label.textContent = ctl.label;
      div.appendChild(label);
      let input;
      if (ctl.type === 'select') {
        input = document.createElement('select');
        ctl.options.forEach(o => {
          const opt = document.createElement('option');
          opt.value = o; opt.textContent = o;
          input.appendChild(opt);
        });
        input.value = bus.cfg[ctl.key];
      } else {
        input = document.createElement('input');
        input.type = 'range';
        input.min = ctl.min; input.max = ctl.max; input.step = ctl.step;
        input.value = bus.cfg[ctl.key];
      }
      input.oninput = () => {
        let v = input.value;
        if (ctl.type === 'range') v = parseFloat(v);
        USBSynth.applyParams(bus, { [ctl.key]: v });
      };
      div.appendChild(input);
      box.appendChild(div);
    });
  }

  function buildMappingUI() {
    const box = $('#mappingUI');
    box.innerHTML = '';
    const pads = USBGamepads.all();
    const state = USBMapping.getState();
    const padIndexes = pads.length ? pads.map(p => p.index) : [0];
    padIndexes.forEach(idx => {
      const padCfg = state.pads[idx] || (state.bindAllPads && state.pads[0]) || { role: 'lead', bindings: [] };
      const div = document.createElement('div');
      div.className = 'mapping-pad';
      const h = document.createElement('h3');
      h.textContent = 'Comando ' + (idx + 1);
      const roleSel = document.createElement('select');
      roleSel.className = 'pad-role-select';
      USBEngine.BUS_ROLES.forEach(r => {
        const o = document.createElement('option');
        o.value = r; o.textContent = r;
        if (padCfg.role === r) o.selected = true;
        roleSel.appendChild(o);
      });
      roleSel.onchange = () => {
        USBMapping.setBinding(idx, null, null, null, roleSel.value);
        buildMappingUI();
      };
      h.appendChild(roleSel);
      div.appendChild(h);

      const learnRow = document.createElement('div');
      learnRow.className = 'binding-row';
      const learnSel = document.createElement('select');
      Object.keys(USBMapping.ACTIONS).forEach(a => {
        const o = document.createElement('option');
        o.value = a;
        o.textContent = USBMapping.ACTIONS[a].label;
        learnSel.appendChild(o);
      });
      const learnBtn = document.createElement('button');
      learnBtn.className = 'btn small accent';
      learnBtn.textContent = '🎯 Aprender';
      learnBtn.onclick = () => {
        USBMapping.startLearn(idx, learnSel.value);
        learnBtn.classList.add('learn-active');
        learnBtn.textContent = 'À espera... prime/mexe o controlo';
        flash('Modo aprender: prime ou mexe o controlo no comando ' + (idx + 1));
      };
      USBMapping.onLearn(() => { buildMappingUI(); });
      learnRow.appendChild(learnSel);
      learnRow.appendChild(learnBtn);
      div.appendChild(learnRow);

      const bindings = document.createElement('div');
      bindings.className = 'bindings';
      (padCfg.bindings || []).forEach(b => {
        const meta = USBMapping.ACTIONS[b.action];
        const row = document.createElement('div');
        row.className = 'binding-row';
        const code = document.createElement('span');
        code.className = 'code';
        code.textContent = (b.type === 'button' ? 'B' : 'Eixo') + b.index;
        row.appendChild(code);
        const lbl = document.createElement('span');
        const midi = b.action === 'note' ? USBEngine.degreeToMidi(padCfg.role, b.param || 0) : null;
        lbl.textContent = (meta ? meta.label : b.action) + (midi !== null ? ` (${USBPresets.noteName(midi)})` : '');
        row.appendChild(lbl);
        const rm = document.createElement('button');
        rm.className = 'btn small danger';
        rm.textContent = '✕';
        rm.onclick = () => {
          USBMapping.setBinding(idx, b.type, b.index, null);
          buildMappingUI();
        };
        row.appendChild(rm);
        bindings.appendChild(row);
      });
      div.appendChild(bindings);
      box.appendChild(div);
    });
  }

  function bindTransport() {
    $('#btnPlay').onclick = () => {
      USBSequencer.toggle();
      $('#btnPlay').textContent = USBSequencer.isPlaying() ? '⏸ Parar' : '▶ Tocar';
    };
    $('#bpmInput').oninput = (e) => USBSequencer.setBpm(parseInt(e.target.value, 10));
    $('#swingInput').oninput = (e) => USBSequencer.setSwing(parseInt(e.target.value, 10) / 100);
    $('#btnRandomSeq').onclick = () => {
      const scaleKeys = Object.keys(USBPresets.SCALES);
      const scale = USBPresets.SCALES[scaleKeys[Math.floor(Math.random() * scaleKeys.length)]];
      const st = USBSequencer.getState();
      const ids = Object.keys(st.tracks);
      if (!ids.length) {
        USBSequencer.ensureTrack('lead', 'melodic');
        USBSequencer.ensureTrack('drums', 'drum');
      }
      const st2 = USBSequencer.getState();
      Object.keys(st2.tracks).forEach(id => {
        if (st2.tracks[id].kind === 'drum') USBSequencer.randomizeDrumTrack(id, 0.3);
        else USBSequencer.randomizeTrack(id, 0.35, scale, 2);
      });
      buildSeqGrid();
      flash('Padrão aleatório gerado');
    };
    $('#btnClearSeq').onclick = () => { USBSequencer.clearAll(); buildSeqGrid(); };
    $('#btnRandomAll').onclick = () => {
      USBEngine.randomizeAll(USBSequencer, USBArpeggiator);
      buildSeqGrid(); syncTransportUI();
      flash('Variação aleatória');
    };
    $('#btnPanic').onclick = () => { USBSynth.panic(); flash('Silenciado'); };
    $('#btnRescan').onclick = () => { USBGamepads.rescan(); refreshPads(); };
    $('#btnResetMapping').onclick = () => {
      USBMapping.resetToDefault();
      buildMappingUI(); refreshPads();
      flash('Mapeamento reposto');
    };

    $('#arpEnable').onchange = (e) => {
      if (e.target.checked !== USBArpeggiator.isEnabled()) USBArpeggiator.toggle();
    };
    $('#arpPattern').onchange = (e) => USBArpeggiator.setPattern(e.target.value);
    $('#arpRate').oninput = (e) => {
      arpRateMs = parseInt(e.target.value, 10);
      USBArpeggiator.setRate(arpRateMs / 1000);
    };
    $('#arpOct').oninput = (e) => USBArpeggiator.setOctaves(parseInt(e.target.value, 10));
  }

  function periodicRefresh() {
    setInterval(() => {
      if (USBGamepads.count() && $('#padsList').querySelector('.empty')) refreshPads();
    }, 2000);
  }

  const KB_KEYS = ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'w', 'e', 't', 'y', 'u'];
  const kbDown = {};
  window.addEventListener('keydown', (e) => {
    if (e.repeat || !started) return;
    const i = KB_KEYS.indexOf(e.key.toLowerCase());
    if (i < 0 || kbDown[i]) return;
    e.preventDefault();
    kbDown[i] = true;
    const midi = USBEngine.degreeToMidi('lead', i);
    const bus = USBSynth.getBus('lead');
    if (bus) USBSynth.triggerVoice(bus, USBSynth.noteToFreq(midi), undefined, undefined, 0.9);
    flash('🎹 ' + USBPresets.noteName(midi));
  });
  window.addEventListener('keyup', (e) => {
    const i = KB_KEYS.indexOf(e.key.toLowerCase());
    if (i >= 0) kbDown[i] = false;
  });

  window.addEventListener('error', (e) => {
    console.error('Erro:', e.message);
    flash('⚠ Erro: ' + e.message);
  });

  $('#btnStart').addEventListener('click', () => { start(); flash('Som ativado! Prime botões no comando 🎮'); });
  bindTransport();
  USBGamepads.start();
  periodicRefresh();
})();
