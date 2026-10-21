/* Cursor grid: cells light up around the pointer in the hero and contact sections (fine pointers, motion allowed). */
import { createCursorGrid } from '../assets/cursor-grid.js';
var fine = window.matchMedia && window.matchMedia('(pointer: fine)').matches;
var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (fine && !reduced) {
  ['hero', 'contact'].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) createCursorGrid(el, { cellSize: 64, color: '#9c7a3f', radius: 170, falloff: 'smooth', holdTime: 350, fadeDuration: 900, lineWidth: 1.1, maxOpacity: 0.85, fillOpacity: 0.06, gridOpacity: 0.05, cellRadius: 6, clickPulse: true, pulseSpeed: 650 });
  });
}
