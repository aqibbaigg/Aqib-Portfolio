/* Text effects: scrambled landing name / role and hero line, shiny giant footer name. */
import { initScrambledText } from '../assets/scrambled-text.js';
import { initShinyText } from '../assets/shiny-text.js';

var fine = window.matchMedia('(pointer: fine)').matches;
var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
var landingEl = document.getElementById('landing');
if (landingEl && fine && !reduced) {
  (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(function () {
    ['.landing-name', '.landing-role'].forEach(function (sel) {
      var t = landingEl.querySelector(sel);
      if (t) initScrambledText(t, { radius: 110, duration: 1.2, speed: 0.5, scrambleChars: '.:', listenOn: landingEl });
    });
  });
}
var giantName = document.querySelector('.giant-name');
if (giantName) {
  initShinyText(giantName, { speed: reduced ? 1e9 : 3.2, delay: 0.6, color: '#201e24', shineColor: '#d6b46a', spread: 120, direction: 'left', yoyo: false, pauseOnHover: false, disabled: reduced });
}
var sub = document.querySelector('.hero-sub');
if (sub && fine && !reduced) {
  var go = function () {
    initScrambledText(sub, { radius: 90, duration: 1.2, speed: 0.5, scrambleChars: '.:', listenOn: document.getElementById('hero') });
  };
  (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(go);
}
