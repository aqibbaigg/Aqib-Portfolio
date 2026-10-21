/* Splash cursor: a soft gold fluid trail behind the pointer (fine pointers, motion allowed). */
import { initSplashCursor } from '../assets/splash-cursor.js';
var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
var fine = window.matchMedia && window.matchMedia('(pointer: fine)').matches;
if (fine && !reduced) {
  try {
    initSplashCursor({
      RAINBOW_MODE: false,
      COLOR: '#9c7a3f',
      SPLAT_RADIUS: 0.15,
      SPLAT_FORCE: 3200,
      DENSITY_DISSIPATION: 5.5,
      VELOCITY_DISSIPATION: 2.5,
      CURL: 2,
      SHADING: true
    });
  } catch (e) {
    console.warn('SplashCursor unavailable:', e);
  }
}
