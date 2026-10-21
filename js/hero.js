/* Hero: pointer parallax variable, then the scroll-scrubbed character sequence (see the comment below). */
(function(){
  var hero=document.getElementById('hero');
  if(!hero||!window.matchMedia('(pointer:fine)').matches||window.matchMedia('(prefers-reduced-motion:reduce)').matches) return;
  hero.addEventListener('pointermove',function(e){
    var r=hero.getBoundingClientRect();
    hero.style.setProperty('--px',(((e.clientX-r.left)/r.width)*2-1).toFixed(3));
  },{passive:true});
  hero.addEventListener('pointerleave',function(){hero.style.setProperty('--px',0);});
})();
/* HERO SCROLL SEQUENCE — while the hero is pinned, scroll scrubs all 240 frames of
   suitvideo.mp4, converted to cutouts (assets/suit/frame_001–240.webp), on a canvas,
   crossfading neighbouring frames so the motion stays smooth; the hero copy blurs out, three information scenes
   (.hero-scenes) blur in and out around the character, and during the slide-over the
   character dims under the next panel */
(function(){
  var pin=document.getElementById('hero-pin'), hero=document.getElementById('hero');
  var box=document.getElementById('hero-portrait'), cv=document.getElementById('hero-seq');
  if(!pin||!box||!cv||!cv.getContext) return;
  var mq=window.matchMedia('(min-width:901px) and (prefers-reduced-motion:no-preference)');
  var fades=[].slice.call(hero.querySelectorAll('.hero-corner,.hero-bigname'));
  var N=240, frames=[], ctx=cv.getContext('2d'), CW=cv.width, CH=cv.height;
  var cur=0, target=0, raf=0, shown='', started=false, ticking=false;
  /* shared with the landing loader, whose counter follows the frames as they arrive */
  var stats=window.heroFrames={total:N,loaded:0,active:mq.matches,start:function(){ load(); }};
  function clamp(v){ return v<0?0:v>1?1:v; }
  /* coarse-to-fine load order (every 32nd frame first) so scrubbing works before all frames arrive */
  function load(){
    if(started) return; started=true;
    var order=[], seen=[], step, i, next=0, busy=0;
    for(step=32;step>=1;step/=2) for(i=0;i<N;i+=step) if(!seen[i]){ seen[i]=1; order.push(i); }
    function pump(){
      while(busy<6&&next<order.length) (function(k){
        var im=new Image(); busy++;
        im.onload=function(){ frames[k]=im; stats.loaded++; busy--; pump(); shown=''; kick(); };
        im.onerror=function(){ stats.loaded++; busy--; pump(); };
        im.src='assets/suit/frame_'+('00'+(k+1)).slice(-3)+'.webp';
      })(order[next++]);
    }
    pump();
  }
  function nearest(i){ for(var d=0;d<N;d++){ if(frames[i-d]) return i-d; if(frames[i+d]) return i+d; } return -1; }
  function draw(){
    var i=Math.min(N-1,Math.floor(cur)), t=cur-i, j=Math.min(N-1,i+1);
    var blend=t>.02&&t<.98&&j!==i&&!!frames[i]&&!!frames[j];
    var a=blend?i:nearest(Math.round(cur)); if(a<0) return;
    var key=blend?i+'+'+t.toFixed(2):''+a; if(key===shown) return; shown=key;
    ctx.clearRect(0,0,CW,CH);
    if(blend){  /* additive mix of premultiplied frames = a true crossfade of transparent images */
      ctx.globalCompositeOperation='lighter';
      ctx.globalAlpha=1-t; ctx.drawImage(frames[i],0,0,CW,CH);
      ctx.globalAlpha=t; ctx.drawImage(frames[j],0,0,CW,CH);
      ctx.globalCompositeOperation='source-over'; ctx.globalAlpha=1;
    } else ctx.drawImage(frames[a],0,0,CW,CH);
    box.classList.add('seq-on');
  }
  /* ease the shown frame toward the scroll position so wheel steps glide instead of jump */
  function tick(){
    raf=0;
    var d=target-cur; cur=Math.abs(d)<.02?target:cur+d*.2;
    draw();
    if(cur!==target) raf=requestAnimationFrame(tick);
  }
  function kick(){ if(!raf&&mq.matches) raf=requestAnimationFrame(tick); }
  /* information scenes: each .hs-item blurs in over its scene's data-in/out window (staggered in
     document order), holds, and blurs out at the end; data-drift floats a card upward meanwhile */
  var scenes=[].slice.call(hero.querySelectorAll('.hs-scene')).map(function(el){
    return {el:el,a:+el.getAttribute('data-in'),b:+el.getAttribute('data-out'),items:[].slice.call(el.querySelectorAll('.hs-item'))};
  });
  var meter=hero.querySelector('.hs-progress');
  function smooth(t){ return t*t*(3-2*t); }
  function play(p){
    scenes.forEach(function(s){
      var on=false;
      s.items.forEach(function(it,k){
        var a=s.a+Math.min(k,6)*.012, e=.045;
        var v=p<=a||p>=s.b?0:smooth(Math.min(1,(p-a)/e,(s.b-p)/e));
        var drift=+(it.getAttribute('data-drift')||0)*(1-2*clamp((p-s.a)/(s.b-s.a)));
        it.style.opacity=v?v.toFixed(3):'';
        it.style.filter=v>0&&v<1?'blur('+((1-v)*12).toFixed(1)+'px)':'';
        it.style.transform=v?'translate3d(0,'+((1-v)*26+drift).toFixed(1)+'px,0)':'';
        if(v) on=true;
      });
      s.el.style.visibility=on?'visible':'';
    });
    if(meter) meter.style.setProperty('--hs-p',p.toFixed(4));
  }
  function reset(){
    box.style.filter='';
    fades.forEach(function(el){ el.style.opacity=''; el.style.filter=''; });
    hero.classList.remove('is-scrolling');
  }
  function upd(){
    ticking=false;
    if(!mq.matches){ reset(); box.classList.remove('seq-on'); if(raf){ cancelAnimationFrame(raf); raf=0; } return; }
    var vh=innerHeight, scrub=(parseFloat(getComputedStyle(pin).getPropertyValue('--hero-scrub'))||300)*vh/100;
    var y=-pin.getBoundingClientRect().top, p=clamp(y/scrub), over=clamp((y-scrub)/vh);
    if(y>0||document.readyState==='complete') load();
    target=p*(N-1); kick();
    play(p);
    if(y<=0){ reset(); return; }
    hero.classList.add('is-scrolling');
    box.style.filter=over>0?'brightness('+(1-.35*over).toFixed(3)+')':'';
    var f=Math.min(1,p/.1);
    fades.forEach(function(el){ el.style.opacity=(1-f).toFixed(3); el.style.filter=f>0?'blur('+(f*14).toFixed(1)+'px)':''; });
  }
  function req(){ if(!ticking){ ticking=true; requestAnimationFrame(upd); } }
  window.addEventListener('scroll',req,{passive:true});
  window.addEventListener('resize',req);
  window.addEventListener('load',req);
  if(mq.addEventListener) mq.addEventListener('change',req);
  upd();
})();
