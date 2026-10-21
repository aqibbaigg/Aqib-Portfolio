/* CursorGrid — vanilla-JS port of the React Bits CursorGrid component.
   Cells of a lattice light up around the pointer, hold, then fade; clicks emit a ring. */
const FALLOFF = { linear: t => t, smooth: t => t * t * (3 - 2 * t), sharp: t => t * t * t };
const hexToRgb = hex => {
  const h = hex.replace('#', '');
  const v = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const n = parseInt(v.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

export function createCursorGrid(container, opts = {}) {
  const p = Object.assign({
    cellSize: 70, color: '#D946EF', radius: 140, falloff: 'smooth', holdTime: 400, fadeDuration: 800,
    lineWidth: 1.2, maxOpacity: 1, fillOpacity: 0, gridOpacity: 0, cellRadius: 0, clickPulse: true, pulseSpeed: 600
  }, opts);
  const canvas = document.createElement('canvas');
  canvas.className = 'cursor-grid__canvas';
  canvas.setAttribute('aria-hidden', 'true');
  container.insertBefore(canvas, container.firstChild);
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const [cr, cg, cb] = hexToRgb(p.color);
  let cols = 0, rows = 0, offX = 0, offY = 0, w = 0, h = 0, raf = 0, running = false, lastFrame = 0;
  let alphas = new Float32Array(0), touched = new Float64Array(0);
  const pulses = [];

  const rebuild = () => {
    w = container.offsetWidth; h = container.offsetHeight;
    canvas.width = Math.max(1, Math.round(w * dpr)); canvas.height = Math.max(1, Math.round(h * dpr));
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cols = Math.ceil(w / p.cellSize) + 1; rows = Math.ceil(h / p.cellSize) + 1;
    offX = (w - cols * p.cellSize) / 2; offY = (h - rows * p.cellSize) / 2;
    alphas = new Float32Array(cols * rows); touched = new Float64Array(cols * rows);
  };
  const center = i => [offX + (i % cols) * p.cellSize + p.cellSize / 2, offY + Math.floor(i / cols) * p.cellSize + p.cellSize / 2];

  const energize = (x, y) => {
    const r = Math.max(p.radius, 1), ease = FALLOFF[p.falloff] || FALLOFF.linear, now = performance.now();
    const c0 = Math.max(0, Math.floor((x - r - offX) / p.cellSize)), c1 = Math.min(cols - 1, Math.floor((x + r - offX) / p.cellSize));
    const r0 = Math.max(0, Math.floor((y - r - offY) / p.cellSize)), r1 = Math.min(rows - 1, Math.floor((y + r - offY) / p.cellSize));
    for (let rr = r0; rr <= r1; rr++) for (let cc = c0; cc <= c1; cc++) {
      const i = rr * cols + cc, [cx, cy] = center(i), d = Math.hypot(cx - x, cy - y);
      if (d > r) continue;
      const lvl = ease(1 - d / r) * p.maxOpacity;
      if (lvl > alphas[i]) { alphas[i] = lvl; touched[i] = now; } else if (lvl > 0) touched[i] = now;
    }
  };

  const draw = now => {
    const dt = Math.min(now - lastFrame, 50); lastFrame = now;
    ctx.clearRect(0, 0, w, h);
    if (p.gridOpacity > 0) {
      ctx.strokeStyle = `rgba(${cr},${cg},${cb},${p.gridOpacity})`; ctx.lineWidth = 1; ctx.beginPath();
      for (let c = 0; c <= cols; c++) { const x = Math.round(offX + c * p.cellSize) + .5; ctx.moveTo(x, 0); ctx.lineTo(x, h); }
      for (let r = 0; r <= rows; r++) { const y = Math.round(offY + r * p.cellSize) + .5; ctx.moveTo(0, y); ctx.lineTo(w, y); }
      ctx.stroke();
    }
    for (let pi = pulses.length - 1; pi >= 0; pi--) {
      const pu = pulses[pi], ringR = (now - pu.t0) / 1000 * p.pulseSpeed;
      if (ringR > Math.hypot(w, h)) { pulses.splice(pi, 1); continue; }
      const band = p.cellSize;
      const c0 = Math.max(0, Math.floor((pu.x - ringR - band - offX) / p.cellSize)), c1 = Math.min(cols - 1, Math.floor((pu.x + ringR + band - offX) / p.cellSize));
      const r0 = Math.max(0, Math.floor((pu.y - ringR - band - offY) / p.cellSize)), r1 = Math.min(rows - 1, Math.floor((pu.y + ringR + band - offY) / p.cellSize));
      for (let rr = r0; rr <= r1; rr++) for (let cc = c0; cc <= c1; cc++) {
        const i = rr * cols + cc, [cx, cy] = center(i);
        if (Math.abs(Math.hypot(cx - pu.x, cy - pu.y) - ringR) < band / 2 && p.maxOpacity > alphas[i]) { alphas[i] = p.maxOpacity; touched[i] = now; }
      }
    }
    let any = pulses.length > 0;
    const step = dt / Math.max(p.fadeDuration, 16), half = p.cellSize / 2;
    for (let i = 0; i < alphas.length; i++) {
      let a = alphas[i]; if (a <= 0) continue;
      if (now - touched[i] > p.holdTime) { a = Math.max(0, a - step); alphas[i] = a; if (a <= 0) continue; }
      any = true;
      const [cx, cy] = center(i);
      const g = ctx.createRadialGradient(cx, cy, half * .1, cx, cy, p.cellSize);
      g.addColorStop(0, `rgba(${cr},${cg},${cb},${a})`); g.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
      const x = cx - half + .5, y = cy - half + .5, s = p.cellSize - 1;
      ctx.beginPath();
      if (p.cellRadius > 0 && ctx.roundRect) ctx.roundRect(x, y, s, s, p.cellRadius); else ctx.rect(x, y, s, s);
      if (p.fillOpacity > 0) { ctx.fillStyle = `rgba(${cr},${cg},${cb},${a * p.fillOpacity})`; ctx.fill(); }
      ctx.strokeStyle = g; ctx.lineWidth = p.lineWidth; ctx.stroke();
    }
    if (any) raf = requestAnimationFrame(draw); else { running = false; if (p.gridOpacity <= 0) ctx.clearRect(0, 0, w, h); }
  };
  const wake = () => { if (running) return; running = true; lastFrame = performance.now(); raf = requestAnimationFrame(draw); };
  const local = e => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const onMove = e => { const [x, y] = local(e); energize(x, y); wake(); };
  const onDown = e => { if (!p.clickPulse) return; const [x, y] = local(e); pulses.push({ x, y, t0: performance.now() }); wake(); };
  const ro = new ResizeObserver(() => { rebuild(); wake(); });
  ro.observe(container); rebuild(); wake();
  container.addEventListener('pointermove', onMove);
  container.addEventListener('pointerdown', onDown);
  return () => { cancelAnimationFrame(raf); ro.disconnect(); container.removeEventListener('pointermove', onMove); container.removeEventListener('pointerdown', onDown); canvas.remove(); };
}
