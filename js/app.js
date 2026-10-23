(() => {
  let started = false;
    let arpRateMs = 125;
  let flashTimeouts = {};

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));


  function start() {
    if (started) return;
    started = true;
    USBEngine.init();
    $('#startOverlay').style.display = 'none';
    buildPresetSelect();
    buildSeqGrid();
    buildMappingUI();
    refreshPads();
    USBGamepads.on('connect', () => { refreshPads(); buildMappingUI(); });
    USBGamepads.on('disconnect', () => { refreshPads(); });
    USBGamepads.on('change', (change) => {
      USBEngine.handle(change, USBSequencer, USBArpeggiator);
      markPadActive(change.padIndex);
      showPadInput(change);
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
      const profileLabel = (p.profile && USBMapping.PROFILES[p.profile]) ? USBMapping.PROFILES[p.profile].label : null;
      const role = cfg ? cfg.role : 'lead';
      const currentSound = currentSounds[role];
      const soundNames = USBPresets.soundNames(role);
      div.innerHTML = `
        <div class="pad-title"><span class="pad-dot" id="pad-dot-${p.index}"></span>Comando ${p.index + 1}</div>
        <div class="pad-id">${p.id}</div>
        <div class="pad-role">
          <label class="pad-role-select-label">Voz:
            <select id="pad-role-${p.index}" class="pad-role-select">
              ${USBEngine.BUS_ROLES.map(r => `<option value="${r}" ${role === r ? 'selected' : ''}>${r}</option>`).join('')}
            </select>
          </label>
          <label class="pad-role-select-label">Perfil:
            <select id="pad-profile-${p.index}" class="pad-role-select">
              ${Object.keys(USBMapping.PROFILES).map(k => `<option value="${k}" ${p.profile === k ? 'selected' : ''}>${USBMapping.PROFILES[k].label}</option>`).join('')}
            </select>
          </label>
        </div>
        <div class="pad-meta">${p.buttonCount} botões · ${p.axisCount} eixos${p.mapping ? ' · ' + p.mapping : ''}${profileLabel ? ' · ' + profileLabel : ''}</div>
        <div class="pad-mixer" id="pad-mixer-${p.index}">
          <label class="mixer-ctl">Vol <input id="mix-vol-${p.index}" type="range" min="0" max="150" value="${Math.round(USBEngine.getMixer(p.index, role).volume * 100)}"></label>
          <label class="mixer-ctl">Pan <input id="mix-pan-${p.index}" type="range" min="-100" max="100" value="${Math.round(USBEngine.getMixer(p.index, role).pan * 100)}"></label>
          <button class="mixer-btn${USBEngine.getMixer(p.index, role).muted ? ' on-danger' : ''}" id="mix-mute-${p.index}">M</button>
          <button class="mixer-btn${USBEngine.getMixer(p.index, role).solo ? ' on-accent' : ''}" id="mix-solo-${p.index}">S</button>
        </div>
        <div class="pad-sounds" id="pad-sounds-${p.index}">
          ${soundNames.map(name => `<button class="sound-btn${name === currentSound ? ' active' : ''}" data-sound="${name}">${name}</button>`).join('')}
        </div>
        <div class="pad-last" id="pad-last-${p.index}">—</div>`;
      div.querySelector(`#pad-role-${p.index}`).onchange = (e) => {
        USBMapping.setBinding(p.index, null, null, null, e.target.value);
        refreshPads();
      };
      div.querySelector(`#pad-profile-${p.index}`).onchange = (e) => {
        USBMapping.setProfile(p.index, e.target.value, p.id, p.buttonCount, p.axisCount);
        refreshPads();
        flash('Perfil aplicado: ' + USBMapping.PROFILES[e.target.value].label);
      };
      const volEl = div.querySelector(`#mix-vol-${p.index}`);
      const panEl = div.querySelector(`#mix-pan-${p.index}`);
      const muteBtn = div.querySelector(`#mix-mute-${p.index}`);
      const soloBtn = div.querySelector(`#mix-solo-${p.index}`);
      volEl.oninput = () => USBEngine.setMixerVolume(p.index, role, parseInt(volEl.value, 10) / 100);
      panEl.oninput = () => USBEngine.setMixerPan(p.index, role, parseInt(panEl.value, 10) / 100);
      muteBtn.onclick = () => {
        const muted = USBEngine.toggleMixerMute(p.index, role);
        muteBtn.classList.toggle('on-danger', muted);
        refreshAllMixerButtons();
      };
      soloBtn.onclick = () => {
        const solo = USBEngine.toggleMixerSolo(p.index, role);
        soloBtn.classList.toggle('on-accent', solo);
        refreshAllMixerButtons();
      };
      div.querySelectorAll('.sound-btn').forEach(btn => {
        btn.onclick = () => {
          currentSounds[role] = btn.dataset.sound;
          USBPresets.applySound(role, btn.dataset.sound);
          refreshPads();
          flash('Voz ' + role + ': ' + btn.dataset.sound);
        };
      });
      list.appendChild(div);
    });
  }

  let padActiveTimeouts = {};
  function markPadActive(idx) {
    const dot = $('#pad-dot-' + idx);
    if (dot) {
      dot.classList.add('on');
      clearTimeout(padActiveTimeouts[idx]);
      padActiveTimeouts[idx] = setTimeout(() => dot.classList.remove('on'), 300);
    }
  }

  function showPadInput(change) {
    const el = $('#pad-last-' + change.padIndex);
    if (!el) return;
    const val = Math.round(change.value * 100) / 100;
    el.textContent = (change.type === 'button' ? 'Botão ' : 'Eixo ') + change.index + ' = ' + val;
    el.classList.add('lit');
    clearTimeout(padActiveTimeouts['last' + change.padIndex]);
    padActiveTimeouts['last' + change.padIndex] = setTimeout(() => {
      el.classList.remove('lit');
      el.textContent = '—';
    }, 2500);
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

  const currentSounds = {};

  function buildMappingUI() {
    const box = $('#mappingUI');
    box.innerHTML = '';
    const pads = USBGamepads.all();
    const state = USBMapping.getState();
    const padIndexes = pads.length ? pads.map(p => p.index) : [0];
    padIndexes.forEach(idx => {
      const padInfo = pads.find(p => p.index === idx);
      const padCfg = state.pads[idx] || (state.bindAllPads && state.pads[0]) || { role: 'lead', bindings: [] };
      const div = document.createElement('div');
      div.className = 'mapping-pad';
      const h = document.createElement('h3');
      const profileKey = padCfg.profile || (padInfo && padInfo.profile);
      const profileLabel = profileKey && USBMapping.PROFILES[profileKey] ? ' — ' + USBMapping.PROFILES[profileKey].label : '';
      h.textContent = 'Comando ' + (idx + 1) + profileLabel;
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
    $('#arpClear').onclick = () => {
      USBArpeggiator.clearNotes();
      updateArpNotes();
      flash('Notas do arpejo limpas');
    };
  }

  function refreshAllMixerButtons() {
    USBGamepads.all().forEach(p => {
      const cfg = USBMapping.getPadConfig(p.index);
      const role = cfg ? cfg.role : 'lead';
      const m = USBEngine.getMixer(p.index, role);
      const muteBtn = document.querySelector(`#mix-mute-${p.index}`);
      const soloBtn = document.querySelector(`#mix-solo-${p.index}`);
      if (muteBtn) muteBtn.classList.toggle('on-danger', m.muted);
      if (soloBtn) soloBtn.classList.toggle('on-accent', m.solo);
    });
  }

  function updateArpNotes() {
    const el = $('#arpNotesList');
    if (!el) return;
    const notes = USBArpeggiator.heldNotes();
    el.textContent = notes.length ? notes.map(n => USBPresets.noteName(n)).join('  ') : '—';
    const cb = $('#arpEnable');
    if (cb) cb.checked = USBArpeggiator.isEnabled();
  }

  function periodicRefresh() {
    setInterval(() => {
      if (USBGamepads.count() && $('#padsList').querySelector('.empty')) refreshPads();
      updateArpNotes();
    }, 500);
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
