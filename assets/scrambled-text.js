/* ScrambledText — vanilla port of the React Bits component (GSAP SplitText + ScrambleTextPlugin).
   Characters within `radius` px of the pointer scramble, then resolve back to the original glyph. */
export function initScrambledText(el, { radius = 100, duration = 1.2, speed = 0.5, scrambleChars = '.:', listenOn } = {}) {
  const gsap = window.gsap;
  if (!gsap || !window.SplitText || !window.ScrambleTextPlugin || !el) return () => {};
  gsap.registerPlugin(window.SplitText, window.ScrambleTextPlugin);

  const split = window.SplitText.create(el, { type: 'words,chars', charsClass: 'char' });
  const chars = split.chars;
  chars.forEach(c => gsap.set(c, { display: 'inline-block', attr: { 'data-content': c.innerHTML } }));

  const onMove = e => {
    chars.forEach(c => {
      const { left, top, width, height } = c.getBoundingClientRect();
      const dist = Math.hypot(e.clientX - (left + width / 2), e.clientY - (top + height / 2));
      if (dist < radius) {
        gsap.to(c, {
          overwrite: true,
          duration: duration * (1 - dist / radius),
          scrambleText: { text: c.dataset.content || '', chars: scrambleChars, speed },
          ease: 'none'
        });
      }
    });
  };
  const target = listenOn || el;
  target.addEventListener('pointermove', onMove);
  return () => { target.removeEventListener('pointermove', onMove); split.revert(); };
}
