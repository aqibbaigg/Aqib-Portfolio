/* Nav auto-hide: the floating nav slides away while scrolling down and returns on scroll up. */
(function(){
  var nav=document.getElementById('nav'); if(!nav) return;
  var last=window.scrollY, ticking=false;
  function update(){
    var y=window.scrollY, open=nav.classList.contains('open');
    if(y<80||open||y<last-4) nav.classList.remove('nav-hidden');
    else if(y>last+4) nav.classList.add('nav-hidden');
    last=y; ticking=false;
  }
  window.addEventListener('scroll',function(){ if(!ticking){ ticking=true; requestAnimationFrame(update); } },{passive:true});
  nav.addEventListener('focusin',function(){ nav.classList.remove('nav-hidden'); });
})();
