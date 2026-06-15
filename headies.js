/* THE HEADIES - shared interactions: nav, reveal, countdown, lightbox, carousel */
(function(){
  'use strict';

  /* ---------- sticky nav ---------- */
  function initNav(){
    var nav=document.querySelector('.nav');
    if(nav){
      var onScroll=function(){ nav.classList.toggle('scrolled', window.scrollY>40); };
      onScroll(); window.addEventListener('scroll',onScroll,{passive:true});
    }
    var burger=document.querySelector('.nav__burger');
    var drawer=document.querySelector('.drawer');
    var close=document.querySelector('.drawer__close');
    if(burger&&drawer){
      burger.addEventListener('click',function(){drawer.classList.add('open');});
      if(close)close.addEventListener('click',function(){drawer.classList.remove('open');});
      drawer.querySelectorAll('a').forEach(function(a){a.addEventListener('click',function(){drawer.classList.remove('open');});});
    }
  }

  /* ---------- reveal on scroll ---------- */
  function initReveal(){
    var els=document.querySelectorAll('.reveal');
    if(!els.length)return;
    document.documentElement.classList.add('js-reveal');
    if(!('IntersectionObserver' in window)){els.forEach(function(e){e.classList.add('in');});return;}
    var io=new IntersectionObserver(function(entries){
      entries.forEach(function(en){ if(en.isIntersecting){en.target.classList.add('in');io.unobserve(en.target);} });
    },{threshold:.12,rootMargin:'0px 0px -6% 0px'});
    els.forEach(function(e){io.observe(e);});
    // Failsafe: reveal anything within (or above) the viewport, at several moments
    function revealInView(){
      var vh=window.innerHeight||document.documentElement.clientHeight;
      els.forEach(function(e){
        if(e.classList.contains('in'))return;
        var r=e.getBoundingClientRect();
        if(r.top<vh*0.98 && r.bottom>-40){e.classList.add('in');io.unobserve(e);}
      });
    }
    requestAnimationFrame(revealInView);
    setTimeout(revealInView,120);
    setTimeout(revealInView,500);
    window.addEventListener('load',revealInView);
  }

  /* ---------- count-up stats ---------- */
  function initCountUp(){
    var nums=document.querySelectorAll('[data-count]');
    if(!nums.length)return;
    var io=new IntersectionObserver(function(entries){
      entries.forEach(function(en){
        if(!en.isIntersecting)return;
        var el=en.target, target=parseFloat(el.dataset.count), suffix=el.dataset.suffix||'', dur=1400, t0=null;
        function step(ts){ if(!t0)t0=ts; var p=Math.min((ts-t0)/dur,1);
          var eased=1-Math.pow(1-p,3);
          var val=Math.floor(eased*target);
          el.textContent=val.toLocaleString()+suffix;
          if(p<1)requestAnimationFrame(step); else el.textContent=target.toLocaleString()+suffix;
        }
        requestAnimationFrame(step); io.unobserve(el);
      });
    },{threshold:.5});
    nums.forEach(function(n){io.observe(n);});
  }

  /* ---------- countdown ---------- */
  function initCountdown(){
    var root=document.querySelector('[data-countdown]');
    if(!root)return;
    function get(){ return window.__HEADIES_DATE || root.getAttribute('data-countdown'); }
    var fields={days:root.querySelector('[data-cd="days"]'),hours:root.querySelector('[data-cd="hours"]'),
      minutes:root.querySelector('[data-cd="minutes"]'),seconds:root.querySelector('[data-cd="seconds"]')};
    function pad(n){return String(n).padStart(2,'0');}
    function tick(){
      var target=new Date(get()).getTime();
      var diff=Math.max(0,target-Date.now());
      var d=Math.floor(diff/86400000),h=Math.floor(diff%86400000/3600000),
          m=Math.floor(diff%3600000/60000),s=Math.floor(diff%60000/1000);
      if(fields.days)fields.days.textContent=pad(d);
      if(fields.hours)fields.hours.textContent=pad(h);
      if(fields.minutes)fields.minutes.textContent=pad(m);
      if(fields.seconds)fields.seconds.textContent=pad(s);
    }
    tick(); setInterval(tick,1000);
    window.__headiesTick=tick;
  }

  /* ---------- lightbox (gallery) ---------- */
  function initLightbox(){
    var box=document.querySelector('.lightbox');
    if(!box)return;
    var frame=box.querySelector('.lightbox__frame');
    var cap=box.querySelector('.lightbox__cap');
    var idx=0;
    function getTriggers(){return Array.prototype.slice.call(document.querySelectorAll('[data-lb]'));}
    function trigger(t){
      var triggers=getTriggers();
      var i=triggers.indexOf(t);
      if(i>-1)open(i);
    }
    function render(){
      var triggers=getTriggers();
      var t=triggers[idx];
      if(!t)return;
      var label=t.getAttribute('data-lb')||'';
      function caption(watch){
        cap.textContent=label;
        if(watch){
          cap.appendChild(document.createTextNode(' · '));
          var link=document.createElement('a');
          link.className='lightbox__watch';
          link.href=watch;
          link.target='_blank';
          link.rel='noopener';
          link.textContent='Watch on YouTube';
          cap.appendChild(link);
        }
      }
      frame.innerHTML='<div class="ph"><span class="ph__cap">'+label+'</span></div>';
      var video=t.getAttribute('data-video-url');
      var watch=t.getAttribute('data-video-watch');
      var full=t.getAttribute('data-full-src')||t.getAttribute('data-src');
      var node=t.querySelector('image-slot');
      var img=t.querySelector('img');
      if(video){
        frame.innerHTML='<iframe class="lightbox__video" src="'+video+'" title="'+label+'" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>';
        caption(watch);
        return;
      }else if(node){
        var clone=node.cloneNode(true); clone.style.width='100%';clone.style.height='100%'; frame.innerHTML=''; frame.appendChild(clone);
      }else if(full || img){
        var image=document.createElement('img');
        image.className='lightbox__img';
        image.alt=label;
        image.src=full || img.src;
        frame.innerHTML='';
        frame.appendChild(image);
      }
      caption();
    }
    function open(i){idx=i;render();box.classList.add('open');document.body.style.overflow='hidden';}
    function closeBox(){box.classList.remove('open');document.body.style.overflow='';}
    function move(dir){var triggers=getTriggers(); if(!triggers.length)return; idx=(idx+dir+triggers.length)%triggers.length;render();}
    function bindTriggers(root){
      (root||document).querySelectorAll('[data-lb]').forEach(function(t){
        if(t.dataset.lbBound)return;
        t.dataset.lbBound='true';
        if(!t.hasAttribute('tabindex'))t.setAttribute('tabindex','0');
        if(!t.hasAttribute('role'))t.setAttribute('role','button');
        t.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();trigger(t);});
        t.addEventListener('keydown',function(e){
          if(e.key==='Enter'||e.key===' '){e.preventDefault();trigger(t);}
        });
      });
    }
    bindTriggers(document);
    if('MutationObserver' in window){
      new MutationObserver(function(muts){
        muts.forEach(function(mut){
          mut.addedNodes.forEach(function(node){
            if(node.nodeType!==1)return;
            if(node.matches&&node.matches('[data-lb]'))bindTriggers(node.parentNode||document);
            else if(node.querySelectorAll)bindTriggers(node);
          });
        });
      }).observe(document.body,{childList:true,subtree:true});
    }
    window.HeadiesLightbox={refresh:function(){bindTriggers(document);}};
    document.addEventListener('click',function(e){
      var t=e.target.closest('[data-lb]');
      if(!t || !document.body.contains(t))return;
      trigger(t);
    });
    box.querySelector('.lightbox__close').addEventListener('click',closeBox);
    box.querySelector('.lightbox__nav.prev').addEventListener('click',function(){move(-1);});
    box.querySelector('.lightbox__nav.next').addEventListener('click',function(){move(1);});
    box.addEventListener('click',function(e){if(e.target===box)closeBox();});
    document.addEventListener('keydown',function(e){
      if(!box.classList.contains('open'))return;
      if(e.key==='Escape')closeBox(); if(e.key==='ArrowLeft')move(-1); if(e.key==='ArrowRight')move(1);
    });
  }

  /* ---------- carousel (nominees) ---------- */
  function initCarousel(){
    document.querySelectorAll('[data-carousel]').forEach(function(car){
      var track=car.querySelector('[data-track]');
      var prev=car.querySelector('[data-prev]');
      var next=car.querySelector('[data-next]');
      if(!track)return;
      function step(){ var card=track.querySelector('*'); return card?card.getBoundingClientRect().width+22:320; }
      if(prev)prev.addEventListener('click',function(){track.scrollBy({left:-step()*1.2,behavior:'smooth'});});
      if(next)next.addEventListener('click',function(){track.scrollBy({left:step()*1.2,behavior:'smooth'});});
    });
  }

  /* ---------- timeline drag-scroll ---------- */
  function initTimelineDrag(){
    document.querySelectorAll('.timeline').forEach(function(tl){
      var down=false,startX,scl;
      tl.addEventListener('pointerdown',function(e){down=true;startX=e.pageX;scl=tl.scrollLeft;tl.style.cursor='grabbing';});
      window.addEventListener('pointerup',function(){down=false;tl.style.cursor='';});
      tl.addEventListener('pointermove',function(e){if(!down)return;tl.scrollLeft=scl-(e.pageX-startX);});
    });
  }

  /* ---------- early-access capture ---------- */
  function initEarlyAccess(){
    document.querySelectorAll('[data-early-access-form]').forEach(function(form){
      var status=form.querySelector('[role="status"]');
      form.addEventListener('submit',function(e){
        e.preventDefault();
        if(!form.checkValidity()){
          form.reportValidity();
          return;
        }
        var lead={
          name:form.elements.name ? form.elements.name.value.trim() : '',
          email:form.elements.email ? form.elements.email.value.trim() : '',
          phone:form.elements.phone ? form.elements.phone.value.trim() : '',
          source:location.pathname,
          createdAt:new Date().toISOString()
        };
        try{
          var leads=JSON.parse(localStorage.getItem('headiesTravelLeads')||'[]');
          leads.push(lead);
          localStorage.setItem('headiesTravelLeads',JSON.stringify(leads.slice(-50)));
        }catch(err){}
        if(status)status.textContent="You're on the list. We will share package deals as soon as they open.";
        form.reset();
      });
    });
    document.querySelectorAll('[data-white-glove-form]').forEach(function(form){
      var status=form.querySelector('[role="status"]');
      form.addEventListener('submit',function(e){
        e.preventDefault();
        if(!form.checkValidity()){
          form.reportValidity();
          return;
        }
        var services=Array.prototype.slice.call(form.querySelectorAll('input[name="services"]:checked')).map(function(input){return input.value;});
        if(!services.length){
          if(status)status.textContent='Select at least one luxury service.';
          return;
        }
        var request={
          name:form.elements.name ? form.elements.name.value.trim() : '',
          email:form.elements.email ? form.elements.email.value.trim() : '',
          phone:form.elements.phone ? form.elements.phone.value.trim() : '',
          services:services,
          notes:form.elements.notes ? form.elements.notes.value.trim() : '',
          source:location.pathname,
          createdAt:new Date().toISOString()
        };
        try{
          var requests=JSON.parse(localStorage.getItem('headiesWhiteGloveRequests')||'[]');
          requests.push(request);
          localStorage.setItem('headiesWhiteGloveRequests',JSON.stringify(requests.slice(-50)));
        }catch(err){}
        if(status)status.textContent='Exclusive luxury service request received. A travel concierge will follow up with next steps.';
        form.reset();
      });
    });
  }

  function initIcons(){
    if(window.lucide && typeof window.lucide.createIcons==='function'){
      window.lucide.createIcons();
    }
  }

  window.addEventListener('headies:lucide-ready',initIcons);

  function boot(){ initNav();initReveal();initCountUp();initCountdown();initLightbox();initCarousel();initTimelineDrag();initEarlyAccess();initIcons(); }
  if(document.readyState!=='loading')boot(); else document.addEventListener('DOMContentLoaded',boot);
})();
