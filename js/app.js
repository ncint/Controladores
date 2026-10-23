(() => {
  let started = false;
  let flashTimeouts = {};

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));


  function start() {
    if (started) return;
    started = true;
    USBEngine.init();
    $('#startOverlay').style.display = 'none';
    buildMappingUI();
    refreshPads();
    USBGamepads.on('connect', () => { refreshPads(); buildMappingUI(); });
    USBGamepads.on('disconnect', () => { refreshPads(); });
    USBGamepads.on('change', (change) => {
      USBEngine.handle(change, null, null);
      markPadActive(change.padIndex);
      showPadInput(change);
    });
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
          <div class="mixer-strip">
            <div class="vu" id="vu-${p.index}">
              ${Array.from({length: 8}, (_, i) => `<div class="vu-led" data-i="${i}"></div>`).join('')}
            </div>
            <div class="fader-wrap">
              <input id="mix-vol-${p.index}" class="fader" type="range" min="0" max="150" value="${Math.round(USBEngine.getMixer(p.index, role).volume * 100)}" orient="vertical">
            </div>
            <div class="mixer-btns">
              <button class="mixer-btn${USBEngine.getMixer(p.index, role).muted ? ' on-danger' : ''}" id="mix-mute-${p.index}" title="Mute">M</button>
              <button class="mixer-btn${USBEngine.getMixer(p.index, role).solo ? ' on-accent' : ''}" id="mix-solo-${p.index}" title="Solo">S</button>
            </div>
          </div>
          <div class="pan-wrap">
            <span class="pan-label">L</span>
            <input id="mix-pan-${p.index}" class="pan" type="range" min="-100" max="100" value="${Math.round(USBEngine.getMixer(p.index, role).pan * 100)}">
            <span class="pan-center${Math.round(USBEngine.getMixer(p.index, role).pan * 100) === 0 ? ' lit' : ''}" id="pan-center-${p.index}">◆</span>
            <span class="pan-label">R</span>
          </div>
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
      panEl.oninput = () => {
        USBEngine.setMixerPan(p.index, role, parseInt(panEl.value, 10) / 100);
        const center = document.querySelector(`#pan-center-${p.index}`);
        if (center) center.classList.toggle('lit', parseInt(panEl.value, 10) === 0);
      };
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
    $('#btnPanic').onclick = () => { USBSynth.panic(); flash('Silenciado'); };
    $('#btnRescan').onclick = () => { USBGamepads.rescan(); refreshPads(); };
    $('#btnResetMapping').onclick = () => {
      USBMapping.resetToDefault();
      buildMappingUI(); refreshPads();
      flash('Mapeamento reposto');
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

  function updateVUs() {
    // VU master
    const masterEl = $('#vu-master');
    if (masterEl) {
      const lvl = USBSynth.context() ? USBSynth.getMasterLevel() : 0;
      const lit = Math.min(12, Math.round(lvl * 14));
      masterEl.querySelectorAll('.vu-led').forEach((led, i) => led.classList.toggle('on', i < lit));
    }
    // VU por canal
    USBGamepads.all().forEach(p => {
      const el = $('#vu-' + p.index);
      if (!el) return;
      const cfg = USBMapping.getPadConfig(p.index);
      const role = cfg ? cfg.role : 'lead';
      const m = USBEngine.getMixer(p.index, role);
      const anySolo = false;
      let lvl = USBEngine.getMixerLevel(p.index, role);
      if (m.muted) lvl = 0;
      const lit = Math.min(8, Math.round(lvl * 10));
      el.querySelectorAll('.vu-led').forEach((led, i) => led.classList.toggle('on', i < lit));
    });
  }

  function periodicRefresh() {
    setInterval(() => {
      if (USBGamepads.count() && $('#padsList').querySelector('.empty')) refreshPads();
    }, 500);
    setInterval(updateVUs, 60);
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

  const masterVu = $('#vu-master');
  for (let i = 0; i < 12; i++) {
    const led = document.createElement('div');
    led.className = 'vu-led' + (i >= 10 ? ' hot' : '');
    masterVu.appendChild(led);
  }
  $('#masterVol').addEventListener('input', (e) => {
    if (USBSynth.context()) USBSynth.setMasterVolume(parseInt(e.target.value, 10) / 100);
  });
  $('#btnStart').addEventListener('click', () => { start(); flash('Som ativado! Prime botões no comando 🎮'); });
  bindTransport();
  USBGamepads.start();
  periodicRefresh();
})();
