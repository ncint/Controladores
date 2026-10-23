const USBGamepads = (() => {
  const listeners = { connect: [], disconnect: [], change: [] };
  const pads = {};
  let scanTimer = null;
  let prevSnapshot = {};

  const MAX_PADS = 4;

  function on(event, cb) {
    if (listeners[event]) listeners[event].push(cb);
  }

  function start() {
    window.addEventListener('gamepadconnected', (e) => {
      if (!e.gamepad) return;
      registerPad(e.gamepad);
      emit('connect', getPad(e.gamepad.index));
    });
    window.addEventListener('gamepaddisconnected', (e) => {
      if (!e.gamepad) return;
      const p = pads[e.gamepad.index];
      delete pads[e.gamepad.index];
      emit('disconnect', p || { index: e.gamepad.index });
    });
    scanTimer = setInterval(poll, 20);
    rescan();
  }

  function stop() {
    if (scanTimer) { clearInterval(scanTimer); scanTimer = null; }
  }

  function rescan() {
    const raw = navigator.getGamepads ? navigator.getGamepads() : [];
    for (let i = 0; i < raw.length; i++) {
      if (raw[i]) registerPad(raw[i]);
    }
  }

  function registerPad(gp) {
    const known = pads[gp.index];
    pads[gp.index] = {
      index: gp.index,
      id: gp.id,
      buttons: new Array(gp.buttons.length).fill(0),
      axes: new Array(gp.axes.length).fill(0),
      buttonCount: gp.buttons.length,
      axisCount: gp.axes.length,
      mapping: gp.mapping,
    };
    if (!known) emit('connect', pads[gp.index]);
  }

  function emit(event, data) {
    (listeners[event] || []).forEach(cb => {
      try { cb(data); } catch (e) { console.error(e); }
    });
  }

  function poll() {
    const raw = navigator.getGamepads ? navigator.getGamepads() : [];
    let activeCount = 0;
    for (let i = 0; i < raw.length; i++) {
      const gp = raw[i];
      if (!gp) continue;
      activeCount++;
      if (activeCount > MAX_PADS) break;
      if (!pads[gp.index]) registerPad(gp);
      const p = pads[gp.index];
      for (let b = 0; b < gp.buttons.length; b++) {
        const prev = p.buttons[b] || 0;
        const now = gp.buttons[b].value;
        p.buttons[b] = now;
        if (Math.abs(now - prev) > 0.001) emitChange(gp.index, 'button', b, now, prev);
      }
      for (let a = 0; a < gp.axes.length; a++) {
        const prev = p.axes[a] || 0;
        const now = gp.axes[a];
        p.axes[a] = now;
        if (Math.abs(now - prev) > 0.001) emitChange(gp.index, 'axis', a, now, prev);
      }
    }
  }

  function emitChange(padIndex, type, index, value, prev) {
    (listeners.change || []).forEach(cb => {
      try { cb({ padIndex, type, index, value, prev }); } catch (e) { console.error(e); }
    });
  }

  function getPad(i) { return pads[i] || null; }
  function all() { return Object.values(pads); }
  function count() { return all().length; }

  function snapshot() {
    const raw = navigator.getGamepads ? navigator.getGamepads() : [];
    const out = {};
    let n = 0;
    for (let i = 0; i < raw.length && n < MAX_PADS; i++) {
      const gp = raw[i];
      if (!gp) continue;
      out[gp.index] = {
        id: gp.id,
        buttons: Array.from(gp.buttons).map(b => b.value),
        axes: Array.from(gp.axes),
      };
      n++;
    }
    return out;
  }

  return { start, stop, on, getPad, all, count, rescan, snapshot, MAX_PADS };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = USBGamepads;
