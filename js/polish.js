/* POLISH LAYER — back-to-top ring, about word reveal, local time, console note */
(function(){
  var reduced=window.matchMedia('(prefers-reduced-motion:reduce)').matches;
  function clamp(v){ return v<0?0:v>1?1:v; }

  /* back to top: appears once past the first screen; the ring tracks page progress */
  var top=document.getElementById('to-top');

  /* about: split paragraph text into words (keeping <strong> etc.) so they can light up in order */
  var paras=reduced?[]:[].slice.call(document.querySelectorAll('.about-text p')).filter(function(p){ return !p.querySelector('a'); });
  var groups=paras.map(function(p){
    var walker=document.createTreeWalker(p,NodeFilter.SHOW_TEXT,null), nodes=[], n;
    while((n=walker.nextNode())) nodes.push(n);
    nodes.forEach(function(t){
      var frag=document.createDocumentFragment();
      t.nodeValue.split(/(\s+)/).forEach(function(part){
        if(!part) return;
        if(/^\s+$/.test(part)){ frag.appendChild(document.createTextNode(part)); return; }
        var s=document.createElement('span'); s.className='rw'; s.textContent=part; frag.appendChild(s);
      });
      t.parentNode.replaceChild(frag,t);
    });
    return {p:p,words:[].slice.call(p.querySelectorAll('.rw'))};
  });

  var ticking=false;
  function upd(){
    ticking=false;
    var vh=innerHeight, max=document.documentElement.scrollHeight-vh;
    if(top){
      top.classList.toggle('show',scrollY>vh*1.1);
      top.style.setProperty('--tt',(max>0?clamp(scrollY/max):0).toFixed(4));
    }
    groups.forEach(function(g){
      var r=g.p.getBoundingClientRect(), p=clamp((vh*.88-r.top)/(vh*.42+r.height*.6)), N=g.words.length;
      g.words.forEach(function(w,k){ w.style.setProperty('--o',(.18+.82*clamp(p*(N+4)-k)).toFixed(3)); });
    });
  }
  function req(){ if(!ticking){ ticking=true; requestAnimationFrame(upd); } }
  window.addEventListener('scroll',req,{passive:true});
  window.addEventListener('resize',req);
  upd();

  /* contact: live local time in Hyderabad */
  var clock=document.getElementById('local-time');
  if(clock){
    var fmt;
    try{ fmt=new Intl.DateTimeFormat('en-GB',{hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'Asia/Kolkata'}); }catch(e){}
    var tickClock=function(){ if(fmt) clock.textContent=fmt.format(new Date()); };
    tickClock(); setInterval(tickClock,15000);
  }

  /* a note for anyone who opens the console */
  try{
    console.log('%cMirza Aqib Baig — AI/ML Engineer','font:700 16px Georgia,serif;color:#9c7a3f;');
    console.log('%cThanks for looking under the hood. Hiring for ML / LLM work? aqibmirza059@gmail.com','font:13px system-ui,sans-serif;color:#57535f;');
  }catch(e){}
})();
