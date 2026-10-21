/* ShinyText — vanilla port of the React Bits component (no motion dependency).
   A gradient highlight sweeps across the text via background-position, driven by rAF. */
export function initShinyText(el, {
  speed = 2, delay = 0, color = '#b5b5b5', shineColor = '#ffffff', spread = 120,
  yoyo = false, pauseOnHover = false, direction = 'left', disabled = false
} = {}) {
  if (!el) return () => {};
  el.classList.add('shiny-text');
  Object.assign(el.style, {
    backgroundImage: `linear-gradient(${spread}deg, ${color} 0%, ${color} 35%, ${shineColor} 50%, ${color} 65%, ${color} 100%)`,
    backgroundSize: '200% auto',
    webkitBackgroundClip: 'text',
    backgroundClip: 'text',
    webkitTextFillColor: 'transparent',
    backgroundPosition: '150% center'
  });
  if (disabled) return () => {};

  const dir = direction === 'left' ? 1 : -1;
  const anim = speed * 1000, wait = delay * 1000;
  let paused = false, elapsed = 0, last = null, raf = 0;

  const frame = time => {
    raf = requestAnimationFrame(frame);
    if (paused) { last = null; return; }
    if (last === null) { last = time; return; }
    elapsed += time - last; last = time;
    const cycle = anim + wait;
    let p;
    if (yoyo) {
      const t = elapsed % (cycle * 2);
      if (t < anim) p = (t / anim) * 100;
      else if (t < cycle) p = 100;
      else if (t < cycle + anim) p = 100 - ((t - cycle) / anim) * 100;
      else p = 0;
    } else {
      const t = elapsed % cycle;
      p = t < anim ? (t / anim) * 100 : 100;
    }
    if (dir !== 1) p = 100 - p;
    el.style.backgroundPosition = `${150 - p * 2}% center`;
  };
  raf = requestAnimationFrame(frame);

  const enter = () => { if (pauseOnHover) paused = true; };
  const leave = () => { if (pauseOnHover) paused = false; };
  el.addEventListener('mouseenter', enter);
  el.addEventListener('mouseleave', leave);
  return () => { cancelAnimationFrame(raf); el.removeEventListener('mouseenter', enter); el.removeEventListener('mouseleave', leave); };
}
