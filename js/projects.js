/* ============================================================
   SELECTED WORK — cinematic showcase (#projects).
   · chapters mode (motion allowed, landscape, at least 900px wide,
     and every chapter fits the screen): the track rides in a sticky
     frame inside #pw-pin and page scroll moves it sideways, one
     project per chapter. Each cover opens from a narrow crop as its
     chapter arrives, its image settles from a slight zoom and drifts
     slower than the frame, and the text follows once it is open.
     Counter, gold progress line, chapter stops and prev / next track
     the real scroll position and scroll the page when used.
   · vertical flow (phones, portrait tablets, short screens, reduced
     motion): the projects stack and reveal as they enter (or are
     simply shown).
   ============================================================ */
(function(){
  'use strict';
  /* the same $, $$ and reduced helpers as js/main.js */
  var $=function(s,c){return (c||document).querySelector(s);};
  var $$=function(s,c){return Array.prototype.slice.call((c||document).querySelectorAll(s));};
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var section=$('#projects'), pin=$('#pw-pin'), sticky=$('#pw-sticky'), viewport=$('#pw-viewport'), track=$('#pw-track');
  if(!section||!pin||!sticky||!viewport||!track) return;
  var panels=$$('.pw-panel',track), n=panels.length; if(!n) return;
  var frames=panels.map(function(p){ return $('.pw-frame',p); });
  var imgs=panels.map(function(p){ return $('.pw-media img',p); });
  var heads=panels.map(function(p){ return $('.pw-head',p); });
  var ticks=$$('.pw-tick',section), prevBtn=$('#pw-prev'), nextBtn=$('#pw-next');
  var countEl=$('#pw-count'), nowEl=$('#pw-now'), fill=$('#pw-fill'), live=$('#pw-live');
  var anim=!reduced && 'IntersectionObserver' in window;
  var wide=window.matchMedia('(min-width:900px)');
  var horiz=false, vw=0, maxX=0, span=1, centers=[], stops=[];
  var x=0, tx=0, approach=1, raf=0, active=-1, seen=[];
  function clamp(v){ return v<0?0:v>1?1:v; }
  function ease(t){ return t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2; }
  function two(i){ return (i<9?'0':'')+(i+1); }
  function put(el,k,v){
    if(!el) return;
    var c=el._pwc||(el._pwc={}); if(c[k]===v) return; c[k]=v;
    el.style[k]=v;
  }
  function forget(el,k){ if(el){ if(el._pwc) delete el._pwc[k]; el.style[k]=''; } }
  function setSeen(i){ if(!seen[i]){ seen[i]=true; panels[i].classList.add('is-seen'); } }
  if(anim) section.classList.add('pw-anim');

  /* ---------- active chapter: counter, title, stops, prev / next ---------- */
  function setActive(i){
    if(i===active) return;
    var first=active<0; active=i;
    if(countEl){
      countEl.textContent=two(i);
      if(!first && anim && countEl.animate) countEl.animate([{opacity:0,transform:'translateY(45%)'},{opacity:1,transform:'none'}],{duration:520,easing:'cubic-bezier(.16,.8,.24,1)'});
    }
    if(nowEl) nowEl.textContent=panels[i].getAttribute('data-name');
    ticks.forEach(function(t,k){
      t.classList.toggle('is-past',k<i);
      if(k===i) t.setAttribute('aria-current','true'); else t.removeAttribute('aria-current');
    });
    if(prevBtn) prevBtn.setAttribute('aria-disabled',i===0?'true':'false');
    if(nextBtn) nextBtn.setAttribute('aria-disabled',i===n-1?'true':'false');
  }

  /* ---------- chapters mode: one frame of the scroll-linked scene ---------- */
  function render(){
    put(track,'transform','translate3d('+(-Math.round(x))+'px,0,0)');   /* whole pixels keep the cover edges crisp */
    put(fill,'transform','scaleX('+(maxX?clamp(x/maxX):0).toFixed(4)+')');
    var k=innerWidth<1200?.6:1;                     /* tablets: gentler zoom and drift */
    var best=0, bestD=1e9;
    for(var i=0;i<n;i++){
      var d=(centers[i]-x-vw/2)/span;               /* 0 = centred, 1 = one chapter to the right */
      var ad=Math.abs(d); if(ad<bestD){ bestD=ad; best=i; }
      var r=d>0?1-clamp((d-.12)/.8):1;              /* the cover opens as its chapter arrives */
      if(i===0) r=Math.min(r,clamp(approach));      /* the first one opens as the section arrives */
      var e=ease(r);
      put(frames[i],'clipPath',e>.999?'':'inset('+((1-e)*14).toFixed(2)+'% '+((1-e)*40).toFixed(2)+'% round 6px)');
      var drift=-Math.max(-1,Math.min(1,d))*3.4*k;  /* % of the image width; it is 108% wide so the frame stays covered */
      put(imgs[i],'transform','translate3d('+drift.toFixed(2)+'%,0,0) scale('+(1+(1-e)*.16*k).toFixed(4)+')');
      if(r>.97||d<0||(d<.62&&!panels[i].classList.contains('pw-l-bleed'))) setSeen(i);   /* an overlaid title waits for its cover */
    }
    setActive(best);
  }
  function target(){
    var rc=pin.getBoundingClientRect(), dist=pin.offsetHeight-sticky.offsetHeight;
    approach=(innerHeight-rc.top)/(innerHeight*.9);
    return dist>0?clamp(-rc.top/dist)*maxX:0;
  }
  function frame(){
    raf=0;
    if(!horiz) return;
    var d=tx-x; x=Math.abs(d)<.4?tx:x+d*.14;          /* glide toward the scroll position */
    render();
    if(x!==tx) raf=requestAnimationFrame(frame);
  }
  function kick(){
    if(!horiz) return;
    tx=target();
    if(!raf) raf=requestAnimationFrame(frame);
  }

  /* ---------- layout + mode ---------- */
  function measure(){
    vw=sticky.clientWidth;
    panels.forEach(function(p){ p.style.width=''; });
    panels.forEach(function(p){ p.style.width=Math.round(p.getBoundingClientRect().width)+'px'; });
    track.style.paddingLeft=Math.round((vw-panels[0].offsetWidth)/2)+'px';
    track.style.paddingRight=Math.round((vw-panels[n-1].offsetWidth)/2)+'px';
    centers=panels.map(function(p){ return p.offsetLeft+p.offsetWidth/2; });
    maxX=Math.max(0,track.offsetWidth-vw);
    span=n>1?(centers[n-1]-centers[0])/(n-1):1;
    stops=centers.map(function(c){ return maxX?clamp((c-vw/2)/maxX):0; });
  }
  /* every chapter has to fit: no overflowing text, a cover of useful size, an overlaid title inside its cover */
  function fits(){
    section.classList.add('pw-measure');                 /* text still waiting to rise must not count as overflow */
    var ok=panels.every(function(p,i){
      var f=frames[i], h=heads[i];
      if(p.scrollHeight>p.clientHeight+3) return false;
      if(f.clientHeight<Math.min(260,p.clientHeight*.42)) return false;
      if(p.classList.contains('pw-l-bleed') && h.offsetHeight>f.clientHeight-32) return false;
      return true;
    });
    section.classList.remove('pw-measure');
    return ok;
  }
  function reset(){
    pin.style.height='';
    forget(track,'transform'); track.style.paddingLeft=''; track.style.paddingRight='';
    panels.forEach(function(p){ p.style.width=''; });
    frames.forEach(function(f){ forget(f,'clipPath'); });
    imgs.forEach(function(im){ forget(im,'transform'); });
  }
  function layout(){
    var want=anim && wide.matches && innerHeight>=520 && innerWidth>=innerHeight*1.1;
    section.classList.remove('pw-compact');
    if(want){
      section.classList.add('pw-h');
      measure();
      if(!fits()){ section.classList.add('pw-compact'); measure(); if(!fits()) want=false; }
    }
    if(!want){
      horiz=false;
      section.classList.remove('pw-h','pw-compact');
      reset(); revealVisible();
      return;
    }
    horiz=true;
    pin.style.height=(sticky.offsetHeight+maxX)+'px';    /* vertical scroll maps 1:1 to the sideways travel */
    ticks.forEach(function(t,i){ t.style.left=(stops[i]*100).toFixed(3)+'%'; });
    tx=target(); x=tx; render();
  }

  /* ---------- navigation: prev / next, chapter stops, keyboard focus ---------- */
  function jump(y){
    var h=document.documentElement, prev=h.style.scrollBehavior;
    h.style.scrollBehavior='auto'; window.scrollTo(0,y); h.style.scrollBehavior=prev;
  }
  function goTo(i,instant){
    if(!horiz) return;
    i=Math.max(0,Math.min(n-1,i));
    var y=Math.round(pin.getBoundingClientRect().top+scrollY+stops[i]*(pin.offsetHeight-sticky.offsetHeight));
    if(instant){ jump(y); tx=target(); x=tx; render(); }
    else window.scrollTo({top:y,behavior:'smooth'});
    if(live) live.textContent='Project '+(i+1)+' of '+n+': '+panels[i].getAttribute('data-name');
  }
  if(prevBtn) prevBtn.addEventListener('click',function(){ if(active>0) goTo(active-1); });
  if(nextBtn) nextBtn.addEventListener('click',function(){ if(active<n-1) goTo(active+1); });
  ticks.forEach(function(t,i){
    t.addEventListener('click',function(){ goTo(i); });
    t.addEventListener('keydown',function(e){
      var j=e.key==='ArrowRight'?i+1:e.key==='ArrowLeft'?i-1:e.key==='Home'?0:e.key==='End'?n-1:-1;
      if(j<0||j>=n||j===i) return;
      e.preventDefault(); ticks[j].focus(); goTo(j);
    });
  });
  /* tabbing into a chapter that is off to the side brings it into view first */
  track.addEventListener('focusin',function(e){
    var p=e.target.closest && e.target.closest('.pw-panel'); if(!p) return;
    var i=panels.indexOf(p); setSeen(i);
    if(horiz && Math.abs((centers[i]-tx-vw/2)/span)>.2) goTo(i,true);
  });
  /* the band only ever moves by transform — undo any scroll the browser applies to show a focused element */
  viewport.addEventListener('scroll',function(){ viewport.scrollLeft=0; viewport.scrollTop=0; });

  /* ---------- pointer light on the covers ---------- */
  if(!reduced && window.matchMedia('(pointer:fine)').matches){
    frames.forEach(function(f){
      f.addEventListener('pointermove',function(e){
        var rc=f.getBoundingClientRect();
        f.style.setProperty('--lx',(e.clientX-rc.left).toFixed(0)+'px');
        f.style.setProperty('--ly',(e.clientY-rc.top).toFixed(0)+'px');
      },{passive:true});
    });
  }

  /* ---------- entrance + vertical-flow reveals ---------- */
  function inView(el,m){ var rc=el.getBoundingClientRect(); return rc.top<innerHeight*(1-m) && rc.bottom>innerHeight*m; }
  function revealVisible(){ panels.forEach(function(p,i){ if(inView(p,.12)) setSeen(i); }); }
  if(anim){
    var intro=$('.pw-intro',section);
    var io=new IntersectionObserver(function(es){
      if(es[0].isIntersecting){ section.classList.add('pw-in'); io.disconnect(); }
    },{threshold:.2});
    if(intro) io.observe(intro);
    var po=new IntersectionObserver(function(es){
      if(horiz) return;
      es.forEach(function(en){ if(en.isIntersecting) setSeen(panels.indexOf(en.target)); });
    },{threshold:.18});
    panels.forEach(function(p){ po.observe(p); });
    /* covers off to the side of the band would otherwise wait for native lazy-loading */
    var lo=new IntersectionObserver(function(es){
      if(!es[0].isIntersecting) return;
      imgs.forEach(function(im){ im.loading='eager'; }); lo.disconnect();
    },{rootMargin:'120% 0px'});
    lo.observe(section);
  } else {
    section.classList.add('pw-in');
    panels.forEach(function(p,i){ setSeen(i); });
  }

  /* ---------- boot ---------- */
  window.addEventListener('scroll',kick,{passive:true});
  var rt=0;
  function relayout(){ layout(); kick(); }
  window.addEventListener('resize',function(){ clearTimeout(rt); rt=setTimeout(relayout,150); });
  window.addEventListener('load',relayout);
  if(document.fonts && document.fonts.ready) document.fonts.ready.then(relayout);
  if(wide.addEventListener) wide.addEventListener('change',relayout);
  setActive(0);
  layout();
})();
