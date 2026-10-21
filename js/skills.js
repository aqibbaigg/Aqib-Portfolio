/* ============================================================
   SKILLS — one script drives the section's motion:
   · scroll mode (motion allowed, wider than a phone, deck fits the
     screen): the deck rides in a sticky frame inside #sk-pin and page
     scroll moves through the categories. Each one rises from below and
     tilts into place while earlier ones recede into the stack behind it;
     the deck eases into focus on the way in and tips back on the way out.
     Tabs, prev/next, keys and swipes scroll the page to a category.
   · click mode (phones, short screens, reduced motion): the same deck
     cycles on tabs, prev/next, keys, swipes and clicks on peeking cards.
   Shared scroll-linked details: the section warms as it enters and the
   diagram draws left to right.
   ============================================================ */
(function(){
  'use strict';
  /* the same $, $$ and reduced helpers as js/main.js */
  var $=function(s,c){return (c||document).querySelector(s);};
  var $$=function(s,c){return Array.prototype.slice.call((c||document).querySelectorAll(s));};
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var section=$('#skills'), deck=$('#sk-deck'), stage=$('#sk-stage'), pin=$('#sk-pin'), sticky=$('#sk-sticky');
  if(!section||!deck||!stage||!pin||!sticky) return;
  var cards=$$('.sk-card',stage), tabs=$$('.sk-tab',deck), n=cards.length; if(!n||tabs.length!==n) return;
  var tablist=$('.sk-tabs',deck), ind=$('.sk-tab-ind',deck), roll=$('.sk-count-roll',deck), segs=$$('.sk-prog i',deck), live=$('#sk-live');
  var glow=$('.sk-glow',sticky), tone=$('.sk-tone',section), arts=cards.map(function(c){ return $('.sk-art',c); }), shades=cards.map(function(c){ return $('.sk-shade',c); });
  var prev=$('#sk-prev'), next=$('#sk-next'), graphic=$('.sk-graphic',section), gclip=$('#sk-g-clip-r'), gscan=$('#sk-g-scan');
  var fine=window.matchMedia && window.matchMedia('(pointer:fine)').matches;
  var anim=!reduced && typeof cards[0].animate==='function';
  var cur=0, narrow=false, scrollMode=false, busy=[], revealed=!anim || !('IntersectionObserver' in window);
  var aim=null, aimT=0, focusOnArrive=null;   /* scroll mode: category a click/key asked for while the page is still scrolling there */
  /* stack geometry per depth behind the front card: [y offset px, scale, rotation deg] */
  var WIDE=[[0,1,0],[-48,.955,-1],[-92,.912,.8],[-132,.87,-.5]], NARROW=[[0,1,0],[-34,.95,-.9],[-64,.9,.7]];
  var SHADE=[0,.16,.32,.48], OFF='translate3d(-24%,44px,0) rotate(-8deg) scale(1.03)';
  var TOP=96, STEP=420, EXIT=260, RISE=420, TILT=12, DEPTH=40, cardH=0;
  function clamp(v,a,b){ a=a===undefined?0:a; b=b===undefined?1:b; return v<a?a:v>b?b:v; }
  /* style writes go through put(), which skips values that haven't changed since the last frame */
  function put(el,k,v){
    if(!el) return;
    var c=el._skc||(el._skc={}); if(c[k]===v) return; c[k]=v;
    if(k.charCodeAt(0)===45) el.style.setProperty(k,v); else el.style[k]=v;
  }
  function geo(){ return narrow?NARROW:WIDE; }
  function depth(i){ return (i-cur+n)%n; }
  deck.classList.add('sk-on');
  $$('.sk-chips',stage).forEach(function(list){ $$('.sk-chip',list).forEach(function(c,i){ c.style.setProperty('--i',i); }); });
  /* headline: words rise line by line through their clip masks */
  $$('.sk-title .sk-line').forEach(function(line,li){
    $$('.word-in',line).forEach(function(w,wi){ w.style.transitionDelay=(li*120+wi*60)+'ms'; });
  });

  /* ---------- state shared by both modes ---------- */
  function placeInd(){
    var t=tabs[cur]; if(!ind||!t) return;
    ind.style.setProperty('--x',t.offsetLeft+'px'); ind.style.setProperty('--y',t.offsetTop+'px');
    ind.style.setProperty('--w',t.offsetWidth+'px'); ind.style.setProperty('--h',t.offsetHeight+'px');
    if(narrow && tablist.scrollWidth>tablist.clientWidth){
      var left=Math.max(0,t.offsetLeft-(tablist.clientWidth-t.offsetWidth)/2);
      tablist.scrollTo({left:left,behavior:anim&&deck.classList.contains('sk-ready')?'smooth':'auto'});
    }
  }
  function updateState(){
    cards.forEach(function(c,i){
      var front=i===cur;
      c.classList.toggle('is-front',front);
      c.classList.toggle('is-coming',scrollMode&&i>cur);
      if(!front) c.classList.remove('is-hover');
      c.setAttribute('aria-hidden',front?'false':'true');
      c.tabIndex=front?0:-1;
      $$('a,button',c).forEach(function(b){ b.tabIndex=front?0:-1; });
    });
    if(hov && hov!==cards[cur]) unhover();
    tabs.forEach(function(t,i){ t.setAttribute('aria-selected',i===cur?'true':'false'); t.tabIndex=i===cur?0:-1; });
    if(roll) roll.style.setProperty('--k',cur);
    if(prev) prev.setAttribute('aria-disabled',scrollMode&&cur===0?'true':'false');
    if(next) next.setAttribute('aria-disabled',scrollMode&&cur===n-1?'true':'false');
    placeInd();
  }
  function announce(){ if(live) live.textContent=$('.sk-tab-t',tabs[cur]).textContent+', category '+(cur+1)+' of '+n; }

  /* ---------- click mode: cycle the deck in place ---------- */
  function pose(d){
    var g=geo(), p=g[Math.min(d,g.length-1)];
    if(!revealed) return 'translate3d(0,48px,0) rotate(0deg) scale(.96)';
    if(d>=g.length) return 'translate3d(0,'+(p[0]-8)+'px,0) rotate(0deg) scale('+(p[1]-.04).toFixed(3)+')';
    return 'translate3d(0,'+p[0]+'px,0) rotate('+p[2]+'deg) scale('+p[1]+')';
  }
  function render(delay){
    var g=geo();
    cards.forEach(function(c,i){
      var d=depth(i), out=busy.indexOf(c)>-1;
      put(c,'transitionDelay',delay?delay(d)+'ms':'');
      put(c,'transform',pose(d));
      put(c,'opacity',revealed&&d<g.length&&!out?'1':'0');
      put(c,'zIndex',String(out?60:50-d));
      put(c,'visibility','');
      put(shades[i],'opacity',String(SHADE[Math.min(d,3)]));
      put(arts[i],'translate','');
    });
    segs.forEach(function(sg,i){ put(sg,'--f',i<=cur?'1':'0'); });
    put(glow,'translate',(cur/(n-1)*18).toFixed(2)+'% '+(cur/(n-1)*-10).toFixed(2)+'%');
    updateState();
  }
  function settle(){
    cards.forEach(function(c){ if(c._a){ c._a.onfinish=null; c._a.cancel(); c._a=null; } c.style.transition=''; });
    busy=[];
  }
  function cycle(to){
    to=((to%n)+n)%n; if(to===cur) return;
    settle();
    var k=(to-cur+n)%n, moving=[], j;
    if(anim && revealed){
      if(k<=n/2){ for(j=0;j<k;j++) moving.push({c:cards[(cur+j)%n],j:j,out:true}); }        /* forward: front card(s) leave */
      else { for(j=0;j<n-k;j++) moving.push({c:cards[(to+j)%n],j:j,out:false}); }         /* back: cards are dealt back in */
    }
    moving.forEach(function(m){ m.from=m.c.style.transform; m.c.style.transition='none'; if(m.out) busy.push(m.c); });
    cur=to;
    render(function(d){ return d*45; });
    moving.forEach(function(m){
      var c=m.c, a;
      if(m.out) a=c.animate([{transform:m.from,opacity:1},{opacity:0,offset:.42},{transform:OFF,opacity:0}],{duration:520,delay:m.j*70,easing:'cubic-bezier(.4,0,.2,1)',fill:'both'});
      else a=c.animate([{transform:OFF,opacity:0},{opacity:1,offset:.45},{transform:pose(depth(cards.indexOf(c))),opacity:1}],{duration:760,delay:(moving.length-1-m.j)*85,easing:'cubic-bezier(.3,1.22,.42,1)',fill:'backwards'});
      c._a=a;
      a.onfinish=function(){
        c._a=null; a.cancel(); c.style.transition='';
        var at=busy.indexOf(c); if(at>-1){ busy.splice(at,1); render(); }
      };
    });
  }
  function reveal(){
    if(revealed||scrollMode) return; revealed=true;
    render(function(d){ return 120+d*110; });
    setTimeout(function(){ cards.forEach(function(c){ c.style.transitionDelay=''; }); },1300);
  }

  /* ---------- scroll mode: page scroll drives the deck ---------- */
  function scrollToIdx(i){
    var y=window.pageYOffset+pin.getBoundingClientRect().top-TOP+i*STEP;
    window.scrollTo({top:Math.round(y),behavior:reduced?'auto':'smooth'});
  }
  function paintDeck(v){
    var p=v.p, a=Math.round(p);
    if(a!==cur){
      cur=a; updateState();
      if(focusOnArrive===cur){ cards[cur].focus({preventScroll:true}); focusOnArrive=null; }   /* a card can't take focus until it has risen into view */
    }
    var g=geo(), last=g.length-1;
    cards.forEach(function(c,i){
      var rel=i-p, y, s, r=0, rx=0, z=0, o=1, sh=0, zi;
      if(rel>0){                                     /* next category rising from below, tilted, settling into place */
        var e=clamp(1-rel), k=1-e;
        y=k*k*RISE*1.15+k*RISE*-.15; s=.97+.03*e; rx=k*TILT; o=clamp(e/.22); zi=75;
      } else {                                       /* active card and earlier ones receding into the stack */
        var d=-rel, j=Math.min(Math.floor(d),last), f=d-j, A=g[j], B=g[Math.min(j+1,last)];
        if(d>=last){ A=B=g[last]; f=0; o=clamp(1-(d-last)/.7); }
        y=A[0]+(B[0]-A[0])*f; s=A[1]+(B[1]-A[1])*f; r=A[2]+(B[2]-A[2])*f;
        z=-Math.min(d,last+1)*DEPTH; rx=Math.min(d,last)*1.4; sh=Math.min(.48,d*.16); zi=70-Math.round(d*4);
      }
      put(c,'transform','perspective(1600px) translate3d(0,'+y.toFixed(1)+'px,'+z.toFixed(1)+'px) rotateX('+rx.toFixed(2)+'deg) rotate('+r.toFixed(2)+'deg) scale('+s.toFixed(4)+')');
      put(c,'opacity',o.toFixed(3));
      put(c,'visibility',o<.002?'hidden':'');
      put(c,'zIndex',String(zi));
      put(shades[i],'opacity',sh.toFixed(2));
      put(arts[i],'translate',Math.abs(rel)<1.5?'0 '+(clamp(rel,-1,1)*-16).toFixed(1)+'px':'');   /* diagram drifts with scroll */
    });
    segs.forEach(function(sg,i){ put(sg,'--f',clamp(p+1-i).toFixed(3)); });
    put(glow,'translate',(p/(n-1)*18).toFixed(2)+'% '+(p/(n-1)*-10).toFixed(2)+'%');
    /* entry: out of soft focus and up to full size; exit: the stack lifts away and tips back */
    var q=v.q, x=v.x, ent=q<.999, ex=x>.001;
    put(stage,'transform',ent||ex?'perspective(1600px) translate3d(0,'+((1-q)*56).toFixed(1)+'px,0) rotateX('+(x*(narrow?4:7)).toFixed(2)+'deg) scale('+(.9+.1*q-.05*x).toFixed(4)+')':'');
    put(stage,'opacity',ent?(.25+.75*q).toFixed(3):'');
    put(stage,'filter',q<.97?'blur('+((1-q)*7).toFixed(2)+'px)':'');
    put(deck,'transform',ex?'translate3d(0,'+(-EXIT/2*x*x).toFixed(1)+'px,0)':'');   /* ends at scroll speed, so the release is seamless */
  }
  function clearScrollStyles(){
    put(stage,'transform',''); put(stage,'opacity',''); put(stage,'filter',''); put(deck,'transform','');
    put(sticky,'transform',''); put(sticky,'transformOrigin',''); pin.style.marginBottom='';
    arts.forEach(function(a){ put(a,'translate',''); });
    cards.forEach(function(c){ c.classList.remove('is-coming'); });
  }

  /* ---------- one scroll reader for the whole section (rAF-throttled, eased toward the targets) ---------- */
  var T={p:0,q:1,x:0,g:1,w:1}, V=null, sraf=0;
  function measure(){
    var vh=window.innerHeight, sr=section.getBoundingClientRect();
    if(sr.bottom<-vh*.25 || sr.top>vh*1.25) return false;
    T.w=clamp((vh-sr.top)/(vh*.9));
    if(graphic){ var gr=graphic.getBoundingClientRect(); T.g=clamp((vh*.94-gr.top)/(vh*.5)); }
    if(scrollMode){
      var y=TOP-pin.getBoundingClientRect().top, t=clamp(y/STEP,0,n-1), k=Math.floor(t), f=clamp((t-k-.18)/.64);
      T.q=y>=0?1:clamp(1+y/(vh*.6));
      T.p=Math.min(n-1,k+f*f*(3-2*f));               /* each category holds, then eases into the next */
      T.x=clamp((y-(n-1)*STEP)/EXIT);
    }
    return true;
  }
  function paint(v){
    put(tone,'opacity',(v.w*.3).toFixed(3));
    if(gclip){
      var gw2=(460*(1-Math.pow(1-v.g,3))).toFixed(1);
      if(gclip._w!==gw2){
        gclip._w=gw2; gclip.setAttribute('width',gw2);
        if(gscan){ gscan.setAttribute('x1',gw2); gscan.setAttribute('x2',gw2); }
      }
      put(gscan,'opacity',v.g>.02&&v.g<.98?'.9':'0');
    }
    if(scrollMode) paintDeck(v);
  }
  function step(){
    sraf=0;
    if(!measure()) return;
    if(!V){ V={p:T.p,q:T.q,x:T.x,g:T.g,w:T.w}; paint(V); return; }
    var moving=false;
    function ease(a,b){ var d=b-a; if(Math.abs(d)<.0008) return b; moving=true; return a+d*.14; }
    V.p=ease(V.p,T.p); V.q=ease(V.q,T.q); V.x=ease(V.x,T.x); V.g=ease(V.g,T.g); V.w=ease(V.w,T.w);
    paint(V);
    if(moving) sraf=requestAnimationFrame(step);
  }
  function kick(){ if(anim && !sraf) sraf=requestAnimationFrame(step); }

  /* ---------- layout + mode ---------- */
  function layout(){
    narrow=window.innerWidth<=900;
    var g=geo(), peek=6-g[g.length-1][0], h=0;
    cards.forEach(function(c){ c.style.height='auto'; });
    cards.forEach(function(c){ h=Math.max(h,c.offsetHeight); });
    cards.forEach(function(c){ c.style.height=''; });
    cardH=h;
    stage.style.setProperty('--card-h',h+'px');
    stage.style.setProperty('--peek',peek+'px');
    stage.style.setProperty('--stage-h',(h+peek)+'px');
    sizeGlitter();
  }
  function sizePin(){
    var vh=window.innerHeight, sh=sticky.offsetHeight;
    var fit=Math.min(1,(vh-110)/sh);             /* short screens: the pinned deck shrinks to fit (down to 80%) instead of dropping to click mode */
    var want=anim && window.innerWidth>640 && fit>=.8;
    if(want!==scrollMode){
      settle(); scrollMode=want; pin.classList.toggle('sk-pinned',want);
      if(want){ revealed=true; cards.forEach(function(c){ c.style.transitionDelay=''; }); }
      else { clearScrollStyles(); pin.style.height=''; }
      updateState();
    }
    if(!scrollMode){ render(); return; }
    var vis=Math.round(sh*fit);
    TOP=Math.max(88,Math.round((vh-vis)/2));
    STEP=Math.round(clamp(vh*.48,300,520));
    EXIT=Math.round(vh*.3);
    RISE=Math.round(cardH*(narrow?.7:.9)+40);
    TILT=narrow?7:12; DEPTH=narrow?18:40;
    sticky.style.setProperty('--sk-top',TOP+'px');
    put(sticky,'transform',fit<1?'scale('+fit.toFixed(4)+')':'');
    put(sticky,'transformOrigin',fit<1?'50% 0':'');
    pin.style.height=(sh+(n-1)*STEP+EXIT)+'px';
    pin.style.marginBottom=fit<1?(vis-sh)+'px':'';   /* no extra gap under the shrunken deck once it is released */
  }
  /* where relative moves start from: the category already asked for while its scroll is under way */
  function base(){ return scrollMode && aim!==null && performance.now()-aimT<1200 ? aim : cur; }
  function go(to,say){
    if(scrollMode){
      to=Math.max(0,Math.min(n-1,to)); if(to===cur && Math.abs(V?V.p-to:0)<.01) return;
      aim=to; aimT=performance.now();
      scrollToIdx(to);
    } else cycle(to);
    if(say){ var c=cur; if(scrollMode) cur=to; announce(); cur=c; }
  }

  /* ---------- pointer tilt + gold glare on the front card, with a light glitter trail ---------- */
  var hov=null, gc=$('.sk-glitter',stage), gx=null, parts=[], graf=0, lastSpark=0, lastT=0, gw=0, gh=0;
  var dpr=Math.min(window.devicePixelRatio||1,2);
  function sizeGlitter(){
    if(!gx) return;
    var r=gc.getBoundingClientRect(); gw=gc.width=Math.round(r.width*dpr); gh=gc.height=Math.round(r.height*dpr);
  }
  function unhover(){
    if(!hov) return;
    var inn=hov.firstElementChild; hov.classList.remove('is-hover');
    inn.style.removeProperty('--rx'); inn.style.removeProperty('--ry'); hov=null;
  }
  function star(x,y,r){
    gx.beginPath(); gx.moveTo(x,y-r);
    gx.quadraticCurveTo(x,y,x+r,y); gx.quadraticCurveTo(x,y,x,y+r); gx.quadraticCurveTo(x,y,x-r,y); gx.quadraticCurveTo(x,y,x,y-r);
    gx.fill();
  }
  function drawSparks(ts){
    var dt=lastT?Math.min(50,ts-lastT):16; lastT=ts;
    gx.clearRect(0,0,gw,gh);
    for(var i=parts.length-1;i>=0;i--){
      var p=parts[i]; p.t+=dt;
      if(p.t>=p.life){ parts.splice(i,1); continue; }
      var k=p.t/p.life, a=Math.sin(Math.PI*k)*(.7+.3*Math.sin(p.t*.03)), s=p.s*(1-k*.4);
      p.x+=p.vx*dt/16; p.y+=p.vy*dt/16; p.vx*=.985;
      gx.fillStyle='rgba('+p.c+','+a.toFixed(3)+')';
      if(p.star) star(p.x,p.y,s*2.6); else { gx.beginPath(); gx.arc(p.x,p.y,s,0,6.2832); gx.fill(); }
    }
    if(parts.length) graf=requestAnimationFrame(drawSparks);
    else { graf=0; lastT=0; gx.clearRect(0,0,gw,gh); }
  }
  function spark(x,y){
    var now=performance.now(); if(now-lastSpark<34) return; lastSpark=now;
    parts.push({x:x*dpr,y:y*dpr,vx:(Math.random()-.5)*.5*dpr,vy:(Math.random()*.35+.1)*dpr,t:0,life:650+Math.random()*550,
      s:(Math.random()*1.4+.7)*dpr,star:Math.random()<.3,c:Math.random()<.5?'214,180,106':'156,122,63'});
    if(parts.length>40) parts.shift();
    if(!graf) graf=requestAnimationFrame(drawSparks);
  }
  if(fine && !reduced){
    gx=gc && gc.getContext ? gc.getContext('2d') : null;
    stage.addEventListener('pointermove',function(e){
      if(e.pointerType==='touch') return;
      var c=e.target.closest && e.target.closest('.sk-card');
      if(!c || !c.classList.contains('is-front') || busy.length){ unhover(); return; }
      var r=c.getBoundingClientRect(), sr=stage.getBoundingClientRect();
      var px=(e.clientX-r.left)/r.width, py=(e.clientY-r.top)/r.height, inn=c.firstElementChild;
      if(hov!==c){ unhover(); hov=c; c.classList.add('is-hover'); }
      inn.style.setProperty('--rx',((.5-py)*7).toFixed(2)+'deg');
      inn.style.setProperty('--ry',((px-.5)*9).toFixed(2)+'deg');
      inn.style.setProperty('--mx',(px*100).toFixed(1)+'%');
      inn.style.setProperty('--my',(py*100).toFixed(1)+'%');
      if(gx) spark(e.clientX-sr.left+60,e.clientY-sr.top+60);   /* canvas overhangs the stage by 60px */
    });
    stage.addEventListener('pointerleave',unhover);
  } else if(gc) gc.style.display='none';

  /* ---------- input ---------- */
  var sw=null;
  stage.addEventListener('pointerdown',function(e){ if(e.pointerType!=='mouse') sw={x:e.clientX,y:e.clientY}; });
  stage.addEventListener('pointerup',function(e){
    if(!sw) return;
    var dx=e.clientX-sw.x, dy=e.clientY-sw.y; sw=null;
    if(Math.abs(dx)>44 && Math.abs(dx)>Math.abs(dy)*1.4) go(cur+(dx<0?1:-1),true);
  });
  stage.addEventListener('pointercancel',function(){ sw=null; });
  cards.forEach(function(c,i){
    c.addEventListener('click',function(){ if(i!==cur) go(i,true); });
    c.addEventListener('keydown',function(e){
      if(e.target!==c || (e.key!=='ArrowRight'&&e.key!=='ArrowLeft')) return;
      e.preventDefault();
      var to=base()+(e.key==='ArrowRight'?1:-1);
      if(scrollMode){ to=Math.max(0,Math.min(n-1,to)); go(to,true); if(to!==cur) focusOnArrive=to; }
      else { go(to,true); cards[cur].focus({preventScroll:true}); }
    });
  });
  tabs.forEach(function(t,i){ t.addEventListener('click',function(){ go(i); }); });
  tablist.addEventListener('keydown',function(e){
    var k=e.key, to=null, from=tabs.indexOf(document.activeElement);
    if(from<0) from=base();
    if(k==='ArrowDown'||k==='ArrowRight') to=from+1;
    else if(k==='ArrowUp'||k==='ArrowLeft') to=from-1;
    else if(k==='Home') to=0;
    else if(k==='End') to=n-1;
    if(to===null) return;
    e.preventDefault();
    if(scrollMode) to=Math.max(0,Math.min(n-1,to)); else to=((to%n)+n)%n;
    go(to); tabs[to].focus({preventScroll:true});
  });
  if(prev) prev.addEventListener('click',function(){ go(base()-1,true); });
  if(next) next.addEventListener('click',function(){ go(base()+1,true); });

  /* ---------- boot ---------- */
  if('IntersectionObserver' in window){
    new IntersectionObserver(function(es){ es.forEach(function(en){ section.classList.toggle('sk-live',en.isIntersecting); }); }).observe(section);
    if(!revealed){
      var ro=new IntersectionObserver(function(es){ if(es[0].isIntersecting){ reveal(); ro.disconnect(); } },{threshold:.3});
      ro.observe(stage);
    }
  } else section.classList.add('sk-live');
  if(!anim) put(tone,'opacity','.3');
  function relayout(){ layout(); sizePin(); V=null; kick(); }
  window.addEventListener('scroll',kick,{passive:true});
  var rt=0;
  window.addEventListener('resize',function(){ clearTimeout(rt); rt=setTimeout(relayout,120); });
  window.addEventListener('load',relayout);
  if(document.fonts && document.fonts.ready) document.fonts.ready.then(relayout);
  layout(); sizePin(); updateState(); kick();
  requestAnimationFrame(function(){ requestAnimationFrame(function(){ deck.classList.add('sk-ready'); }); });
})();
