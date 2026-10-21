/* Site-wide behaviour: sound, cursor, particles, word reveals, landing screen, nav,
   scroll reveals, case-study modal, contact, motion layer. Skills and Selected Work
   live in js/skills.js and js/projects.js. */
(function(){
  'use strict';
  var $=function(s,c){return (c||document).querySelector(s);};
  var $$=function(s,c){return Array.prototype.slice.call((c||document).querySelectorAll(s));};
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ============================================================
     SOUND — sleek, soft UI tones synthesised live (no audio files)
     ============================================================ */
  var Sound=(function(){
    var AC=window.AudioContext||window.webkitAudioContext;
    var ctx=null, master=null, enabled=true, lastPlay=0;
    var ambient=null;
    try{ var saved=localStorage.getItem('aqib-sound'); if(saved==='off') enabled=false; }catch(e){}

    function ensure(){
      if(ctx) return;
      if(!AC) return;
      ctx=new AC();
      master=ctx.createGain();
      master.gain.value=enabled?1:0;
      master.connect(ctx.destination);
    }

    /* soft ambient pad — two detuned sines a fifth apart, slow filter sweep */
    function startAmbient(){
      return; /* ambient pad disabled — effects only */
      if(!ctx || ctx.state!=='running' || ambient) return;
      var now=ctx.currentTime;
      var g=ctx.createGain(); g.gain.value=0;
      var filter=ctx.createBiquadFilter(); filter.type='lowpass'; filter.frequency.value=800; filter.Q.value=.5;
      var o1=ctx.createOscillator(); o1.type='sine'; o1.frequency.value=82.41;
      var o2=ctx.createOscillator(); o2.type='sine'; o2.frequency.value=123.47;
      var o3=ctx.createOscillator(); o3.type='triangle'; o3.frequency.value=164.81;
      var g3=ctx.createGain(); g3.gain.value=.35;
      var lfo=ctx.createOscillator(); lfo.type='sine'; lfo.frequency.value=.045;
      var lfoGain=ctx.createGain(); lfoGain.gain.value=260;
      lfo.connect(lfoGain); lfoGain.connect(filter.frequency);
      o1.connect(filter); o2.connect(filter); o3.connect(g3); g3.connect(filter);
      filter.connect(g); g.connect(master);
      o1.start(now); o2.start(now); o3.start(now); lfo.start(now);
      g.gain.linearRampToValueAtTime(.028,now+2.6);
      ambient={g:g,osc:[o1,o2,o3,lfo]};
    }
    function stopAmbient(){
      if(!ambient || !ctx) return;
      var now=ctx.currentTime;
      var a=ambient; ambient=null;
      a.g.gain.setTargetAtTime(0,now,.4);
      setTimeout(function(){ a.osc.forEach(function(o){ try{o.stop();}catch(e){} }); },1600);
    }

    function unlock(){
      ensure();
      if(!ctx) return;
      if(ctx.state==='suspended'){ ctx.resume().then(function(){ if(enabled) startAmbient(); }); }
      else if(enabled){ startAmbient(); }
    }
    function tone(opts){
      if(!enabled || !ctx || ctx.state!=='running') return;
      var now=ctx.currentTime;
      var o=ctx.createOscillator();
      var g=ctx.createGain();
      var f=ctx.createBiquadFilter();
      f.type='lowpass'; f.frequency.value=opts.cutoff||3200; f.Q.value=.6;
      o.type=opts.wave||'sine';
      o.frequency.setValueAtTime(opts.freq,now);
      if(opts.freqTo) o.frequency.exponentialRampToValueAtTime(opts.freqTo,now+opts.dur);
      g.gain.setValueAtTime(0,now);
      g.gain.linearRampToValueAtTime(opts.peak,now+(opts.attack||.004));
      g.gain.exponentialRampToValueAtTime(.0001,now+opts.dur);
      var pan=null;
      if(ctx.createStereoPanner){ pan=ctx.createStereoPanner(); pan.pan.value=opts.pan||0; }
      o.connect(f); f.connect(g);
      if(pan){ g.connect(pan); pan.connect(master); } else { g.connect(master); }
      o.start(now); o.stop(now+opts.dur+.05);
    }
    function panFromX(x){
      if(typeof x!=='number') return 0;
      var p=(x/window.innerWidth)*2-1;
      return Math.max(-1,Math.min(1,p));
    }
    function hover(x){
      var t=Date.now(); if(t-lastPlay<55) return; lastPlay=t;
      tone({freq:1180,freqTo:900,dur:.07,peak:.025,cutoff:3400,wave:'sine',pan:panFromX(x),attack:.002});
    }
    function click(x){
      tone({freq:660,freqTo:520,dur:.11,peak:.042,cutoff:2600,wave:'sine',pan:panFromX(x),attack:.002});
      tone({freq:990,freqTo:780,dur:.08,peak:.011,cutoff:3000,wave:'sine',pan:panFromX(x),attack:.002});
    }
    function chime(){
      if(!enabled || !ctx || ctx.state!=='running') return;
      var now=ctx.currentTime;
      [523.25,659.25].forEach(function(freq,i){
        var o=ctx.createOscillator(), g=ctx.createGain(), f=ctx.createBiquadFilter();
        f.type='lowpass'; f.frequency.value=3200;
        o.type='sine'; o.frequency.value=freq;
        var start=now+i*.11;
        g.gain.setValueAtTime(0,start);
        g.gain.linearRampToValueAtTime(.028,start+.01);
        g.gain.exponentialRampToValueAtTime(.0001,start+.55);
        o.connect(f); f.connect(g); g.connect(master);
        o.start(start); o.stop(start+.6);
      });
    }
    function setEnabled(v){
      enabled=v;
      ensure();
      if(master && ctx) master.gain.setTargetAtTime(enabled?1:0,ctx.currentTime,.05);
      if(enabled) startAmbient(); else stopAmbient();
      try{ localStorage.setItem('aqib-sound',enabled?'on':'off'); }catch(e){}
    }
    return {unlock:unlock,hover:hover,click:click,chime:chime,setEnabled:setEnabled,isEnabled:function(){return enabled;}};
  })();

  ['pointerdown','keydown'].forEach(function(ev){
    window.addEventListener(ev,function(){ Sound.unlock(); },{once:true,passive:true});
  });

  var SOUND_SEL='.btn, .btn-mini, .nav-links a, .text-link, .copy-btn, .sound-toggle, .sk-tab, .sk-nav-btn, .sk-chip, .sk-outro-link, .pw-frame, .pw-cta, .pw-nav-btn, .pw-tick, .case-close';
  var hoverGuard=new WeakSet();
  document.addEventListener('pointerover',function(e){
    var el=e.target.closest && e.target.closest(SOUND_SEL);
    if(!el) return;
    var r=el.getBoundingClientRect();
    Sound.hover(r.left+r.width/2);
  },{passive:true});
  document.addEventListener('click',function(e){
    var el=e.target.closest && e.target.closest(SOUND_SEL);
    if(!el) return;
    var r=el.getBoundingClientRect();
    Sound.click(r.left+r.width/2);
  },{passive:true});

  var soundBtns=$$('[data-sound-toggle]');
  function paintSound(){
    var on=Sound.isEnabled();
    soundBtns.forEach(function(b){
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed',on?'true':'false');
      b.title=on?'Mute sound effects':'Turn sound effects on';
    });
  }
  soundBtns.forEach(function(b){
    b.addEventListener('click',function(){
      Sound.setEnabled(!Sound.isEnabled());
      paintSound();
      if(Sound.isEnabled()) Sound.chime();
    });
  });
  paintSound();

  /* ============================================================
     SOUND HINT — shown once, points at the toggle
     ============================================================ */
  (function(){
    var hint=$('#sound-hint');
    if(!hint) return;
    var seen=false;
    try{ seen=localStorage.getItem('aqib-sound-hint-seen')==='1'; }catch(e){}
    if(seen) return;
    setTimeout(function(){
      hint.classList.add('show');
      var hide=function(){
        hint.classList.remove('show');
        try{ localStorage.setItem('aqib-sound-hint-seen','1'); }catch(e){}
      };
      var timer=setTimeout(hide,4200);
      window.addEventListener('pointerdown',function once(){
        clearTimeout(timer); hide();
        window.removeEventListener('pointerdown',once);
      });
    },1400);
  })();

  /* ============================================================
     CUSTOM CURSOR — ring trails, dot tracks exactly
     ============================================================ */
  (function(){
    if(reduced || !window.matchMedia || !window.matchMedia('(pointer:fine)').matches) return;
    var ring=document.createElement('div'); ring.id='cursor-ring';
    var dot=document.createElement('div'); dot.id='cursor-dot';
    document.body.appendChild(ring); document.body.appendChild(dot);
    document.documentElement.classList.add('has-cursor');
    var mx=innerWidth/2,my=innerHeight/2,rx=mx,ry=my,active=false;
    window.addEventListener('pointermove',function(e){
      mx=e.clientX; my=e.clientY;
      if(!active){ active=true; document.documentElement.classList.add('cursor-on'); }
      dot.style.transform='translate3d('+mx+'px,'+my+'px,0)';
    },{passive:true});
    function loop(){
      rx+=(mx-rx)*.16; ry+=(my-ry)*.16;
      ring.style.transform='translate3d('+rx+'px,'+ry+'px,0)';
      requestAnimationFrame(loop);
    }
    loop();
    var CURSOR_SEL='a, button, .pw-frame, .sk-chip, .focus-item';
    document.addEventListener('pointerover',function(e){
      var el=e.target.closest && e.target.closest(CURSOR_SEL);
      ring.classList.toggle('is-active',!!el);
    },{passive:true});
  })();

  /* ============================================================
     AMBIENT PARTICLE CANVAS — soft drifting dots
     ============================================================ */
  (function(){
    var canvas=$('#ambient-canvas');
    if(!canvas || reduced) return;
    var ctx=canvas.getContext('2d');
    var dpr=Math.min(window.devicePixelRatio||1,1.6);
    var W,H,pts=[],raf,resizeTimer;
    var COUNT=70, mxp=-9999, myp=-9999, LINK=130;
    window.addEventListener('pointermove',function(e){ mxp=e.clientX*dpr; myp=e.clientY*dpr; },{passive:true});
    function resize(){
      W=canvas.width=Math.floor(innerWidth*dpr);
      H=canvas.height=Math.floor(innerHeight*dpr);
      canvas.style.width=innerWidth+'px';
      canvas.style.height=innerHeight+'px';
    }
    function init(){
      pts=[];
      for(var i=0;i<COUNT;i++){
        pts.push({
          x:Math.random()*W,y:Math.random()*H,
          r:(Math.random()*1.1+.5)*dpr,
          vx:(Math.random()-.5)*.08*dpr,
          vy:(Math.random()-.5)*.08*dpr,
          a:Math.random()*.35+.12
        });
      }
    }
    function tick(){
      ctx.clearRect(0,0,W,H);
      for(var i=0;i<pts.length;i++){
        var p=pts[i];
        p.x+=p.vx; p.y+=p.vy;
        if(p.x<0) p.x=W; else if(p.x>W) p.x=0;
        if(p.y<0) p.y=H; else if(p.y>H) p.y=0;
        ctx.beginPath();
        ctx.fillStyle='rgba(156,122,63,'+p.a+')';
        ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
        ctx.fill();
      }
      var L=LINK*dpr;
      ctx.lineWidth=dpr*.6;
      for(var a=0;a<pts.length;a++){
        var pa=pts[a];
        for(var b=a+1;b<pts.length;b++){
          var dx=pa.x-pts[b].x, dy=pa.y-pts[b].y, d2=dx*dx+dy*dy;
          if(d2<L*L){ ctx.strokeStyle='rgba(156,122,63,'+((1-Math.sqrt(d2)/L)*.22).toFixed(3)+')'; ctx.beginPath(); ctx.moveTo(pa.x,pa.y); ctx.lineTo(pts[b].x,pts[b].y); ctx.stroke(); }
        }
        var cx=pa.x-mxp, cy=pa.y-myp, cd=Math.sqrt(cx*cx+cy*cy);
        if(cd<L*1.8 && cd>1){
          ctx.strokeStyle='rgba(156,122,63,'+((1-cd/(L*1.8))*.5).toFixed(3)+')';
          ctx.beginPath(); ctx.moveTo(pa.x,pa.y); ctx.lineTo(mxp,myp); ctx.stroke();
          pa.x-=cx/cd*.25*dpr; pa.y-=cy/cd*.25*dpr;
        }
      }
      raf=requestAnimationFrame(tick);
    }
    window.addEventListener('resize',function(){
      clearTimeout(resizeTimer);
      resizeTimer=setTimeout(function(){ resize(); init(); },150);
    });
    document.addEventListener('visibilitychange',function(){
      if(document.hidden){ cancelAnimationFrame(raf); } else { raf=requestAnimationFrame(tick); }
    });
    resize(); init(); tick();
  })();

  /* ============================================================
     WORD-SPLIT REVEAL — wraps each word for a stagger-rise effect
     while preserving nested markup (e.g. <span class="ital">)
     ============================================================ */
  function wrapWord(word,i){
    var outer=document.createElement('span'); outer.className='word';
    var inner=document.createElement('span'); inner.className='word-in';
    inner.style.transitionDelay=(i*45)+'ms';
    inner.textContent=word;
    outer.appendChild(inner);
    return outer;
  }
  function splitWords(el){
    var counter={n:0};
    function walk(node){
      if(node.nodeType===3){
        var frag=document.createDocumentFragment();
        node.textContent.split(/(\s+)/).forEach(function(part){
          if(part==='') return;
          if(/^\s+$/.test(part)){ frag.appendChild(document.createTextNode(part)); }
          else { frag.appendChild(wrapWord(part,counter.n++)); }
        });
        node.parentNode.replaceChild(frag,node);
      } else if(node.nodeType===1){
        Array.prototype.slice.call(node.childNodes).forEach(walk);
      }
    }
    Array.prototype.slice.call(el.childNodes).forEach(walk);
  }
  $$('[data-split]').forEach(function(el){ splitWords(el); });
  /* hero is always the first thing on screen — reveal it directly rather than via
     the scroll IntersectionObserver, whose rootMargin can exclude elements sitting
     right at the initial viewport's bottom edge (e.g. the hero CTAs) */
  function revealHero(){
    var bigname=$('#hero-bigname'); if(bigname) bigname.classList.add('in');
    $$('[data-hero-reveal]').forEach(function(el){ el.classList.add('in'); });
    $$('[data-hero-reveal] [data-split]').forEach(function(el){ el.classList.add('in'); });
  }
  if($('#landing')){
    window.addEventListener('landing:dismissed',revealHero,{once:true});
  } else {
    requestAnimationFrame(function(){ setTimeout(revealHero,250); });
  }

  /* ============================================================
     LANDING — entrance screen. Enter (or any interaction, or the
     5.5s timeout) plays the loading animation: the copy lifts out,
     a counter follows the hero frames loading, then the landing
     rises like a curtain and the hero is revealed underneath.
     Reduced motion keeps the plain fade.
     ============================================================ */
  (function(){
    var landing=$('#landing');
    if(!landing) return;
    document.documentElement.classList.add('landing-lock');
    var entered=false, released=false;
    function release(){
      if(released) return; released=true;
      document.documentElement.classList.remove('landing-lock');
      window.dispatchEvent(new CustomEvent('landing:dismissed'));
    }
    function fade(){
      landing.classList.add('hide'); release();
      setTimeout(function(){ if(landing.parentNode) landing.parentNode.removeChild(landing); },750);
    }
    function enter(){
      if(entered) return; entered=true; clearTimeout(autoTimer);
      if(reduced||!landing.animate){ fade(); return; }
      var EASE='cubic-bezier(.16,.8,.24,1)', CURTAIN='cubic-bezier(.76,0,.24,1)';
      var shownState={opacity:1,transform:'none',filter:'blur(0px)'};
      $$('.landing-inner > *',landing).forEach(function(el,i){
        el.animate([shownState,{opacity:0,transform:'translateY(-22px)',filter:'blur(8px)'}],{duration:520,delay:i*45,easing:EASE,fill:'forwards'});
      });
      var load=$('.landing-load',landing), line=$('#landing-line'), num=$('#landing-num'), status=$('#landing-status');
      load.animate([{opacity:0,transform:'translateY(26px)',filter:'blur(10px)'},shownState],{duration:650,delay:280,easing:EASE,fill:'forwards'});
      line.parentNode.animate([{opacity:0},{opacity:1}],{duration:400,delay:280,fill:'forwards'});
      /* real progress = hero frames loaded (desktop); otherwise a short timed count */
      var hf=window.heroFrames, useFrames=!!(hf&&hf.active);
      if(useFrames) hf.start();
      var t0=performance.now(), MIN=1800, MAX=9000, shown=0;
      function step(now){
        var el=now-t0, p=Math.min(1,el/MIN);
        if(useFrames) p=Math.min(p,hf.loaded/hf.total);
        if(el>MAX) p=1;                       /* slow network: stop waiting, frames keep streaming in */
        shown+=(p-shown)*.14; if(p>=1&&shown>.996) shown=1;
        num.textContent=('00'+Math.round(shown*100)).slice(-3);
        line.style.transform='scaleX('+shown.toFixed(4)+')';
        status.textContent=useFrames?'Loading frames · '+hf.loaded+' / '+hf.total:'Loading portfolio';
        if(shown<1) requestAnimationFrame(step); else setTimeout(lift,200);
      }
      requestAnimationFrame(step);
      /* curtain: the landing rises with a curved bottom edge, an ink band follows */
      function lift(){
        var veil=document.createElement('div'); veil.className='landing-veil'; document.body.appendChild(veil);
        load.animate([shownState,{opacity:0,transform:'translateY(-40px)',filter:'blur(10px)'}],{duration:450,easing:EASE,fill:'forwards'});
        var curve=[{transform:'translateY(0)',borderRadius:'0 0 0 0 / 0 0 0 0'},{transform:'translateY(-100%)',borderRadius:'0 0 50% 50% / 0 0 16vh 16vh'}];
        landing.animate(curve,{duration:1050,delay:120,easing:CURTAIN,fill:'forwards'});
        veil.animate(curve,{duration:1050,delay:250,easing:CURTAIN,fill:'forwards'});
        setTimeout(release,420);
        setTimeout(function(){
          if(landing.parentNode) landing.parentNode.removeChild(landing);
          if(veil.parentNode) veil.parentNode.removeChild(veil);
        },1450);
      }
    }
    var btn=$('#landing-enter'); if(btn) btn.addEventListener('click',enter);
    var autoTimer=setTimeout(enter, reduced?250:5500);
    ['pointerdown','keydown','wheel','touchstart'].forEach(function(ev){
      window.addEventListener(ev,enter,{once:true,passive:true});
    });
  })();

  /* ============================================================
     MOUSE TILT — perspective tilt toward the cursor, used by
     project rows and skill cards
     ============================================================ */
  function attachTilt(els,deg,lift){
    if(reduced || !window.matchMedia || !window.matchMedia('(pointer:fine)').matches) return;
    els.forEach(function(el){
      el.addEventListener('mousemove',function(e){
        var r=el.getBoundingClientRect();
        var px=(e.clientX-r.left)/r.width-.5, py=(e.clientY-r.top)/r.height-.5;
        el.style.transform='perspective(1000px) rotateX('+(-py*deg).toFixed(2)+'deg) rotateY('+(px*deg).toFixed(2)+'deg)'+(lift?' translateY('+lift+'px)':'');
      });
      el.addEventListener('mouseleave',function(){ el.style.transform=''; });
    });
  }
  attachTilt($$('[data-tilt-card]'),5,-4);

  /* ============================================================
     NAV
     ============================================================ */
  var nav=$('#nav'), navToggle=$('#nav-toggle');
  function onScroll(){ nav.classList.toggle('scrolled', window.scrollY>10); }
  window.addEventListener('scroll',onScroll,{passive:true}); onScroll();

  navToggle.addEventListener('click',function(){
    var open=nav.classList.toggle('open');
    navToggle.setAttribute('aria-expanded',open?'true':'false');
  });
  $$('[data-nav-link], [data-nav]').forEach(function(a){
    a.addEventListener('click',function(){
      nav.classList.remove('open');
      navToggle.setAttribute('aria-expanded','false');
    });
  });

  var navLinks=$$('[data-nav]');
  var sections=navLinks.map(function(a){ return document.querySelector(a.getAttribute('href')); }).filter(Boolean);
  if('IntersectionObserver' in window && sections.length){
    var navObs=new IntersectionObserver(function(entries){
      entries.forEach(function(en){
        if(!en.isIntersecting) return;
        var id='#'+en.target.id;
        navLinks.forEach(function(a){ a.classList.toggle('active', a.getAttribute('href')===id); });
      });
    },{rootMargin:'-45% 0px -50% 0px'});
    sections.forEach(function(s){ navObs.observe(s); });
  }

  /* ============================================================
     REVEAL ON SCROLL
     ============================================================ */
  function animateCounts(scope){
    $$('.stat-num[data-count]',scope).forEach(function(el){
      var target=parseFloat(el.getAttribute('data-count'));
      var suffix=el.getAttribute('data-suffix')||'';
      var dec=parseInt(el.getAttribute('data-decimals')||'0',10);
      if(reduced){ el.textContent=target.toFixed(dec)+suffix; return; }
      var dur=1100,start=null;
      function step(ts){
        if(!start) start=ts;
        var p=Math.min(1,(ts-start)/dur);
        var eased=1-Math.pow(1-p,3);
        el.textContent=(dec?(target*eased).toFixed(dec):Math.round(target*eased))+suffix;
        if(p<1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    });
  }
  var revealEls=$$('[data-reveal], [data-reveal-group], [data-split]').filter(function(el){
    return !el.closest('[data-hero-reveal]');
  });
  if('IntersectionObserver' in window && !reduced){
    var revObs=new IntersectionObserver(function(entries){
      entries.forEach(function(en){
        if(!en.isIntersecting) return;
        en.target.classList.add('in');
        if(en.target.hasAttribute('data-reveal-group')) animateCounts(en.target);
        revObs.unobserve(en.target);
      });
    },{threshold:.15,rootMargin:'0px 0px -8% 0px'});
    revealEls.forEach(function(el){ revObs.observe(el); });
  } else {
    revealEls.forEach(function(el){ el.classList.add('in'); });
    animateCounts(document);
  }

  /* ============================================================
     CASE STUDY MODAL
     ============================================================ */
  var CASES={
    talentiq:{
      num:'02', cat:'NLP · Retrieval · Full-stack', title:'TalentIQ — AI-Powered Recruiter Intelligence Platform',
      lede:'Semantic resume-to-job matching, built end to end and deployed as a live public service.',
      rows:[
        ['Matching','Candidates and roles are embedded with Sentence-Transformers and indexed in a FAISS vector store, then ranked through a weighted scoring algorithm across skills, experience and role fit.'],
        ['RAG pipeline','A RAG pipeline on Llama 3.2 via Ollama generates written candidate-job fit analyses, with deterministic fallback logic keeping the endpoint responsive when the LLM is unavailable.'],
        ['Backend & deployment','Full backend on FastAPI and PostgreSQL with automated resume parsing, skill extraction and unit tests, deployed to Railway as a live public service.']
      ],
      tech:['Python','FastAPI','PostgreSQL','FAISS','Sentence-Transformers','RAG','Docker','Railway'],
      links:[['Live demo ↗','https://ai-talent-intelligence-platform-production.up.railway.app'],['View on GitHub ↗','https://github.com/aqibbaigg']]
    },
    carclassifier:{
      num:'03', cat:'Computer Vision · MLOps', title:'Car Classifier — Self-Improving Vehicle Recognition Pipeline',
      lede:'A vehicle classifier that notices what it does not know, asks for help, and retrains itself.',
      rows:[
        ['Incremental fine-tuning','Extended a PyTorch EfficientNet-B3 classifier from 196 to 207 vehicle classes through incremental fine-tuning on real-world images, while preserving performance on the original classes.'],
        ['Fallback chain','A confidence-thresholded chain routes low-confidence predictions to Gemini, OpenAI and Groq APIs, backed by a MySQL review queue and human-in-the-loop validation before any label enters training.'],
        ['Automated retraining','auto_pipeline.py triggers fine-tuning once 40+ human-approved samples accumulate — an end-to-end FastAPI MLOps loop that runs without manual intervention.']
      ],
      tech:['Python','PyTorch','EfficientNet-B3','FastAPI','MySQL','LLM APIs'],
      links:[['View on GitHub ↗','https://github.com/aqibbaigg/car_classifier']]
    },
    bi:{
      num:'01', cat:'Business Intelligence · Forecasting', title:'Business Intelligence & Profit Optimisation Platform',
      lede:'Built at Digilitics for a building-materials distribution client.',
      rows:[
        ['Data layer','PostgreSQL ingestion of sales, inventory and customer data, with Python and Pandas handling cleaning, transformation and feature generation. Developed against public retail transaction datasets as a proxy while client data access was pending.'],
        ['Three ML modules','Demand forecasting for inventory planning, customer scoring for account prioritisation, and margin-level profit optimisation surfacing loss-making product and customer segments.'],
        ['Reporting','A Power BI layer modelled over the same schema, delivering profit, customer and inventory intelligence through a single owner-facing dashboard.']
      ],
      tech:['Python','Pandas','PostgreSQL','Machine Learning','Power BI'],
      links:[]
    },
    medread:{
      num:'04', cat:'Generative AI · Healthcare · Flask', title:'MedRead AI — Automated Analysis of Medical Reports',
      lede:'Turning dense lab reports into clear, explainable insights for patients and clinicians.',
      rows:[
        ['Report intake','A Flask app accepts PDF lab reports (up to 12 MB, PDF only, sanitised filenames), extracts the text page by page with pdfplumber and deletes the upload once it has been processed.'],
        ['Structured analysis','A structured prompt asks GPT-4o-mini (temperature 0.3) for five sections: a summary, health insights, clinician recommendations, patient-friendly lifestyle changes and follow-up steps, keeping the tone supportive and non-diagnostic and flagging missing information.'],
        ['Results view','The result page shows the generated insights next to an excerpt of the extracted report text for reference, with clear error handling for scanned PDFs, oversized files and API failures.']
      ],
      tech:['Python','Flask','pdfplumber','OpenAI API','GPT-4o-mini','Prompt Engineering'],
      links:[['View on GitHub ↗','https://github.com/aqibbaigg/Automated-Analysis-of-Medical-Reports-for-Personalized-Health-Insight-Generation']]
    }
  };

  var caseEl=$('#case'), casePanel=$('#case-panel'), lastTrigger=null, caseOpen=false;
  function esc(s){ return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); }
  function openCase(key,trigger){
    var d=CASES[key]; if(!d) return;
    lastTrigger=trigger||document.activeElement;
    var html='';
    html+='<button class="case-close" id="case-close" aria-label="Close case study">&#10005;</button>';
    html+='<div class="case-top"><span class="case-num">'+d.num+'</span><span class="case-cat">'+esc(d.cat)+'</span></div>';
    html+='<h3 id="case-title">'+esc(d.title)+'</h3>';
    html+='<p class="case-lede">'+esc(d.lede)+'</p><dl class="case-rows">';
    d.rows.forEach(function(r){ html+='<div class="case-row"><dt>'+esc(r[0])+'</dt><dd>'+esc(r[1])+'</dd></div>'; });
    html+='</dl><div class="project-tech">'+d.tech.map(function(t){return '<span>'+esc(t)+'</span>';}).join('')+'</div>';
    html+='<div class="project-links">'+d.links.map(function(l){return '<a class="text-link gold" href="'+l[1]+'" target="_blank" rel="noopener">'+esc(l[0])+'</a>';}).join('')+'</div>';
    casePanel.innerHTML=html;
    document.documentElement.classList.add('modal-lock');
    caseEl.classList.add('open');
    caseOpen=true;
    Sound.chime();
    var closeBtn=$('#case-close');
    if(closeBtn) closeBtn.addEventListener('click',closeCase);
    setTimeout(function(){ if(closeBtn) closeBtn.focus(); },50);
  }
  function closeCase(){
    caseEl.classList.remove('open');
    document.documentElement.classList.remove('modal-lock');
    caseOpen=false;
    if(lastTrigger && lastTrigger.focus) lastTrigger.focus();
  }
  $$('[data-case]').forEach(function(row){
    function trigger(e){
      if(e.target.closest('a')) return;
      /* focus returns to the button that opened it (or the project's case-study button) */
      openCase(row.getAttribute('data-case'),e.target.closest('button')||row.querySelector('[data-open-case]')||row);
    }
    row.addEventListener('click',trigger);
    /* keys only when the row itself has focus: links and buttons inside handle their own Enter / Space */
    row.addEventListener('keydown',function(e){ if(e.target!==row) return; if(e.key==='Enter'||e.key===' '){ e.preventDefault(); trigger(e); } });
  });
  /* areas-of-focus sphere — one disc per focus area; ↗ opens the case study where it's applied */
  var sphereEl=$('#focus-sphere');
  if(sphereEl && window.InfiniteMenu){
    var PROJ={talentiq:'TalentIQ',carclassifier:'Car Classifier',bi:'BI Platform'};
    var sphereItems=[
      {image:'assets/focus/rag-systems.jpg',title:'RAG Systems',description:'Sentence-Transformer embeddings in FAISS, with Llama 3.2 fit analyses and deterministic fallbacks.',key:'talentiq'},
      {image:'assets/focus/mlops-loops.jpg',title:'MLOps Loops',description:'Confidence-thresholded fallback chains and automated retraining with humans in the loop.',key:'carclassifier'},
      {image:'assets/focus/computer-vision.jpg',title:'Computer Vision',description:'EfficientNet-B3 fine-tuned incrementally from 196 to 207 classes without forgetting.',key:'carclassifier'},
      {image:'assets/focus/predictive-analytics.jpg',title:'Predictive Analytics',description:'Demand forecasting, customer scoring and margin-level profit optimisation.',key:'bi'},
      {image:'assets/focus/backend-apis.jpg',title:'Backend & APIs',description:'FastAPI services over PostgreSQL and MySQL, tested and shipped in Docker.',key:'talentiq'},
      {image:'assets/focus/bi-delivery.jpg',title:'BI Delivery',description:'Power BI reporting layers that put profit, customer and inventory intelligence on one dashboard.',key:'bi'}
    ].map(function(it,i){ it.num='0'+(i+1)+' · Applied in '+PROJ[it.key]; return it; });
    var hint=sphereEl.querySelector('.sphere-hint');
    InfiniteMenu.mount(sphereEl,{items:sphereItems,unique:true,ring:true,cap:37,tilt:4,discScale:.31,zoom:innerWidth<700?2.65:2.5,fade:0,onOpen:function(it){ openCase(it.key,sphereEl.querySelector('.im-action')); }});
    if(hint) sphereEl.appendChild(hint);
  }
  caseEl.addEventListener('click',function(e){ if(e.target===caseEl) closeCase(); });
  window.addEventListener('keydown',function(e){ if(e.key==='Escape' && caseOpen) closeCase(); });

  /* ============================================================
     CONTACT — copy email
     ============================================================ */
  var emailText='aqibmirza059@gmail.com';
  function goEmail(){ window.location.href='mailto:'+emailText; }
  var emailCta=$('#email-cta'); if(emailCta) emailCta.addEventListener('click',goEmail);
  var copyBtn=$('#copy-email');
  if(copyBtn){
    copyBtn.addEventListener('click',function(){
      var done=function(){
        copyBtn.textContent='Copied'; copyBtn.classList.add('done');
        setTimeout(function(){ copyBtn.textContent='Copy'; copyBtn.classList.remove('done'); },1800);
      };
      if(navigator.clipboard && navigator.clipboard.writeText){
        navigator.clipboard.writeText(emailText).then(done).catch(function(){ goEmail(); });
      } else { goEmail(); }
    });
  }

  /* ============================================================
     MOTION LAYER — timeline draw, magnetic buttons,
     spotlight cards, typed roles, parallax
     ============================================================ */
  (function(){
    var tl=$('.timeline'), ticking=false;
    function upd(){
      ticking=false;
      if(tl){
        var r=tl.getBoundingClientRect();
        var p=(innerHeight*.7-r.top)/r.height;
        tl.style.setProperty('--tl',Math.max(0,Math.min(1,p)).toFixed(3));
      }
    }
    window.addEventListener('scroll',function(){ if(!ticking){ ticking=true; requestAnimationFrame(upd); } },{passive:true});
    window.addEventListener('resize',upd); upd();

    var t=$('#typed');
    if(t){
      var words=['RAG pipelines','vector search','self-improving models','LLM guardrails','MLOps automation','profit optimisation'];
      if(reduced){ t.textContent=words[0]; }
      else {
        var wi=0,ci=0,del=false;
        (function type(){
          var w=words[wi];
          ci+=del?-1:1; t.textContent=w.slice(0,ci);
          var d=del?35:75;
          if(!del && ci===w.length){ del=true; d=1500; }
          else if(del && ci===0){ del=false; wi=(wi+1)%words.length; d=350; }
          setTimeout(type,d);
        })();
      }
    }

    var fine=window.matchMedia && window.matchMedia('(pointer:fine)').matches;
    if(!fine || reduced) return;
    document.addEventListener('pointermove',function(e){
      var el=e.target.closest && e.target.closest('[data-spot]');
      if(!el) return;
      var r=el.getBoundingClientRect();
      el.style.setProperty('--mx',(e.clientX-r.left)+'px');
      el.style.setProperty('--my',(e.clientY-r.top)+'px');
    },{passive:true});
    $$('.btn,.btn-mini,.sound-toggle').forEach(function(b){
      b.addEventListener('pointermove',function(e){
        var r=b.getBoundingClientRect();
        var x=(e.clientX-r.left-r.width/2)*.28, y=(e.clientY-r.top-r.height/2)*.4;
        b.style.transform='translate('+x.toFixed(1)+'px,'+y.toFixed(1)+'px)';
      });
      b.addEventListener('pointerleave',function(){ b.style.transform=''; });
    });
  })();

  var yearEl=$('#year'); if(yearEl) yearEl.textContent=new Date().getFullYear();
})();
