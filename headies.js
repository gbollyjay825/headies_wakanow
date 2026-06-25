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

  /* ---------- travel lead capture ---------- */
  function setupVisaPanel(form){
    var visaToggle=form.querySelector('input[name="services"][value="Visa Support"]');
    var panel=form.querySelector('[data-visa-panel]');
    if(!visaToggle||!panel)return {active:function(){return false;},collect:function(){return null;}};
    var applicantType=panel.querySelector('[name="visaApplicantType"]');
    var employedBlock=panel.querySelector('[data-visa-conditional="employed"]');
    var businessBlock=panel.querySelector('[data-visa-conditional="business-owner"]');
    function setEnabled(control,enabled){
      control.disabled=!enabled;
      control.required=enabled && control.getAttribute('data-visa-required')==='true';
      if(!enabled)control.required=false;
    }
    function setBlock(block,enabled){
      if(!block)return;
      block.hidden=!enabled;
      if(enabled&&typeof block.open==='boolean')block.open=true;
      block.querySelectorAll('[data-visa-field]').forEach(function(control){setEnabled(control,enabled);});
    }
    function sync(){
      var active=visaToggle.checked;
      panel.hidden=!active;
      panel.querySelectorAll('[data-visa-field]').forEach(function(control){
        if(control.closest('[data-visa-conditional]'))return;
        setEnabled(control,active);
      });
      var type=applicantType ? applicantType.value : '';
      setBlock(employedBlock,active&&(type==='employed'||type==='employed-business-owner'));
      setBlock(businessBlock,active&&(type==='business-owner'||type==='employed-business-owner'));
    }
    function checkedValues(name){
      return Array.prototype.slice.call(form.querySelectorAll('input[name="'+name+'"]:checked')).map(function(input){return input.value;});
    }
    function activate(){
      visaToggle.checked=true;
      sync();
    }
    function collect(){
      if(!visaToggle.checked)return null;
      function value(name){
        var field=form.elements[name];
        return field&&!field.disabled ? field.value.trim() : '';
      }
      function checked(name){
        var field=form.elements[name];
        return !!(field&&!field.disabled&&field.checked);
      }
      return {
        service:'Canada Business Visa',
        fee:'NGN745,000 per applicant',
        portalStatus:'Document upload page available at visa.html',
        applicants:value('visaApplicants'),
        applicantCategory:value('visaApplicantType'),
        passportExpiry:value('visaPassportExpiry'),
        travelHistory:value('visaTravelHistory'),
        notes:value('visaNotes'),
        role:value('visaRole'),
        salary:value('visaSalary'),
        employmentLength:value('visaEmploymentLength'),
        leaveApproved:checked('visaLeaveApproved'),
        returnToJob:checked('visaReturnToJob'),
        feeAccepted:checked('visaFeeAccepted'),
        portalPendingAccepted:checked('visaPortalPending'),
        documentReadiness:{
          general:checkedValues('visaReadyGeneral'),
          employed:checkedValues('visaReadyEmployed'),
          business:checkedValues('visaReadyBusiness')
        }
      };
    }
    visaToggle.addEventListener('change',sync);
    if(applicantType)applicantType.addEventListener('change',sync);
    sync();
    return {active:function(){return visaToggle.checked;},activate:activate,collect:collect,sync:sync};
  }

  function initWhiteGlove(){
    document.querySelectorAll('[data-white-glove-form]').forEach(function(form){
      var status=form.querySelector('[role="status"]');
      var visaPanel=setupVisaPanel(form);
      function activateVisaFromCta(){
        if(visaPanel.activate)visaPanel.activate();
      }
      document.querySelectorAll('a[href="#visa-request"]').forEach(function(link){
        link.addEventListener('click',activateVisaFromCta);
      });
      if(window.location.hash==='#visa-request')activateVisaFromCta();
      window.addEventListener('hashchange',function(){
        if(window.location.hash==='#visa-request')activateVisaFromCta();
      });
      form.addEventListener('submit',function(e){
        e.preventDefault();
        if(visaPanel.sync)visaPanel.sync();
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
          visa:visaPanel.collect ? visaPanel.collect() : null,
          source:location.pathname,
          createdAt:new Date().toISOString()
        };
        try{
          var requests=JSON.parse(localStorage.getItem('headiesWhiteGloveRequests')||'[]');
          requests.push(request);
          localStorage.setItem('headiesWhiteGloveRequests',JSON.stringify(requests.slice(-50)));
        }catch(err){}
        if(status)status.textContent=services.indexOf('Visa Support')>-1
          ? 'Visa support request received. Use the visa upload page to submit applicant documents.'
          : 'Exclusive luxury service request received. A travel concierge will follow up with next steps.';
        form.reset();
        if(visaPanel.sync)visaPanel.sync();
      });
    });
  }

  function initTravelFlow(){
    document.querySelectorAll('[data-travel-flow-form]').forEach(function(form){
      var carToggle=form.querySelector('[data-car-rental-toggle]');
      var carFields=form.querySelector('[data-car-rental-fields]');
      var summary=form.querySelector('[data-trip-summary]');
      var status=form.querySelector('[role="status"]');
      var flightType=form.elements.flightType;
      var flightClass=form.elements.flightClass;

      function value(name){
        var field=form.elements[name];
        if(!field)return '';
        if(field.type==='checkbox')return field.checked;
        return field.value;
      }
      function setCarRentalState(){
        var enabled=!!(carToggle&&carToggle.checked);
        if(carFields)carFields.hidden=!enabled;
        if(carFields){
          carFields.querySelectorAll('input,select').forEach(function(field){
            field.disabled=!enabled;
            field.required=enabled&&(field.name==='carType'||field.name==='carRentalDays');
            if(!enabled){field.required=false;field.value='';}
          });
        }
      }
      function setFlightState(){
        if(!flightType||!flightClass)return;
        if(flightType.value==='Private Jet'){
          flightClass.value='Private Jet';
        }
        if(flightType.value==='No Flight Needed'){
          flightClass.required=false;
          flightClass.value='';
        }else{
          flightClass.required=true;
        }
      }
      function updateSummary(){
        if(!summary)return;
        var parts=[];
        if(value('flightType'))parts.push(value('flightType')+(value('flightClass')?' · '+value('flightClass'):''));
        if(value('accommodation'))parts.push(value('accommodation')+(value('hotelClass')?' · '+value('hotelClass'):''));
        if(value('airportTransfer'))parts.push(value('airportTransfer'));
        if(value('carRentalNeeded'))parts.push('Car rental · '+(value('carType')||'Vehicle pending')+(value('carRentalDays')?' · '+value('carRentalDays')+' days':''));
        if(value('needsVisa'))parts.push('Visa support');
        summary.innerHTML='<strong>Trip summary:</strong> '+(parts.length?parts.join(' / '):'Select your travel options to build a request.');
      }
      function sync(){
        setCarRentalState();
        setFlightState();
        updateSummary();
      }
      form.addEventListener('input',sync);
      form.addEventListener('change',sync);
      form.addEventListener('submit',function(e){
        e.preventDefault();
        sync();
        if(!form.checkValidity()){
          form.reportValidity();
          return;
        }
        var plan={
          name:value('name').trim(),
          email:value('email').trim(),
          phone:value('phone').trim(),
          flight:{
            type:value('flightType'),
            class:value('flightClass'),
            departureDate:value('flightDepartureDate'),
            returnDate:value('flightReturnDate')
          },
          accommodation:{
            type:value('accommodation'),
            hotelClass:value('hotelClass'),
            checkIn:value('hotelCheckIn'),
            checkOut:value('hotelCheckOut')
          },
          airportTransfer:{
            type:value('airportTransfer'),
            passengers:value('transferPassengers'),
            arrivalDate:value('arrivalTransferDate'),
            departureDate:value('departureTransferDate')
          },
          carRental:{
            needed:!!value('carRentalNeeded'),
            type:value('carType'),
            days:value('carRentalDays'),
            pickupDate:value('carPickupDate'),
            returnDate:value('carReturnDate')
          },
          needsVisa:!!value('needsVisa'),
          notes:value('notes').trim(),
          source:location.pathname,
          createdAt:new Date().toISOString()
        };
        try{
          var plans=JSON.parse(localStorage.getItem('headiesTravelPlans')||'[]');
          plans.push(plan);
          localStorage.setItem('headiesTravelPlans',JSON.stringify(plans.slice(-50)));
        }catch(err){}
        if(status)status.textContent='Travel request received. Wakanow will follow up with options for the selected segments.';
        form.reset();
        sync();
      });
      sync();
    });
  }

  function initVisaUploadPortal(){
    document.querySelectorAll('[data-visa-upload-form]').forEach(function(form){
      var applicantType=form.querySelector('[data-visa-applicant-type]');
      var progress=form.querySelector('[data-upload-progress]');
      var progressBar=form.querySelector('[data-upload-progress-bar]');
      var progressCount=form.querySelector('[data-upload-progress-count]');
      var status=form.querySelector('[role="status"]');

      function formatBytes(bytes){
        if(!bytes)return '0 KB';
        if(bytes<1048576)return Math.max(1,Math.round(bytes/1024))+' KB';
        return (bytes/1048576).toFixed(bytes<10485760?1:0)+' MB';
      }

      function sectionEnabled(section){
        if(!section)return true;
        var target=section.getAttribute('data-applicant-section');
        var value=applicantType ? applicantType.value : '';
        if(target==='employed')return value==='employed'||value==='employed-business-owner';
        if(target==='business-owner')return value==='business-owner'||value==='employed-business-owner';
        return true;
      }

      function setRequiredState(control,enabled){
        control.disabled=!enabled;
        control.required=enabled && control.getAttribute('data-required')==='true';
        if(!enabled)control.required=false;
      }

      function syncConditional(){
        form.querySelectorAll('[data-applicant-section]').forEach(function(section){
          var enabled=sectionEnabled(section);
          section.hidden=!enabled;
          section.querySelectorAll('input,select,textarea').forEach(function(control){setRequiredState(control,enabled);});
        });
        form.querySelectorAll('[data-upload-input]').forEach(function(input){
          if(input.closest('[data-applicant-section]'))return;
          setRequiredState(input,true);
        });
        updateProgress();
      }

      function renderFileList(input){
        var card=input.closest('[data-upload-card]');
        if(!card)return;
        var list=card.querySelector('[data-upload-list]');
        var files=Array.prototype.slice.call(input.files||[]);
        card.classList.toggle('is-complete',files.length>0);
        if(!list)return;
        list.innerHTML='';
        if(!files.length)return;
        files.forEach(function(file){
          var item=document.createElement('li');
          var name=document.createElement('span');
          var size=document.createElement('span');
          name.textContent=file.name;
          size.textContent=formatBytes(file.size);
          item.appendChild(name);
          item.appendChild(size);
          list.appendChild(item);
        });
      }

      function visibleRequiredUploads(){
        return Array.prototype.slice.call(form.querySelectorAll('[data-upload-input]')).filter(function(input){
          return !input.disabled && input.required;
        });
      }

      function updateProgress(){
        form.querySelectorAll('[data-upload-input]').forEach(renderFileList);
        var required=visibleRequiredUploads();
        var complete=required.filter(function(input){return input.files&&input.files.length>0;}).length;
        var pct=required.length ? Math.round((complete/required.length)*100) : 100;
        if(progress)progress.setAttribute('aria-valuenow',String(pct));
        if(progressBar)progressBar.style.width=pct+'%';
        if(progressCount)progressCount.textContent=complete+' of '+required.length+' required uploads ready';
      }

      function selectedFiles(input){
        return Array.prototype.slice.call(input.files||[]).map(function(file){
          return {name:file.name,size:file.size,type:file.type||'unknown'};
        });
      }

      function collectUploads(){
        return Array.prototype.slice.call(form.querySelectorAll('[data-upload-input]')).filter(function(input){
          return !input.disabled;
        }).map(function(input){
          return {
            field:input.name,
            document:input.getAttribute('data-upload-name')||input.name,
            required:input.required,
            files:selectedFiles(input)
          };
        });
      }

      form.querySelectorAll('[data-upload-input]').forEach(function(input){
        input.addEventListener('change',updateProgress);
      });
      if(applicantType)applicantType.addEventListener('change',syncConditional);

      form.addEventListener('submit',function(e){
        e.preventDefault();
        syncConditional();
        if(!form.checkValidity()){
          form.reportValidity();
          updateProgress();
          return;
        }
        var application={
          name:form.elements.name ? form.elements.name.value.trim() : '',
          email:form.elements.email ? form.elements.email.value.trim() : '',
          phone:form.elements.phone ? form.elements.phone.value.trim() : '',
          applicants:form.elements.applicants ? form.elements.applicants.value : '',
          applicantCategory:applicantType ? applicantType.value : '',
          passportExpiry:form.elements.passportExpiry ? form.elements.passportExpiry.value : '',
          travelDate:form.elements.travelDate ? form.elements.travelDate.value : '',
          travelHistory:form.elements.travelHistory ? form.elements.travelHistory.value.trim() : '',
          role:form.elements.role ? form.elements.role.value.trim() : '',
          salary:form.elements.salary ? form.elements.salary.value.trim() : '',
          employmentLength:form.elements.employmentLength ? form.elements.employmentLength.value.trim() : '',
          notes:form.elements.notes ? form.elements.notes.value.trim() : '',
          uploads:collectUploads(),
          fee:'NGN745,000 per applicant',
          destinationEmail:'visa@wakanow.com',
          source:location.pathname,
          createdAt:new Date().toISOString()
        };
        try{
          var applications=JSON.parse(localStorage.getItem('headiesVisaApplications')||'[]');
          applications.push(application);
          localStorage.setItem('headiesVisaApplications',JSON.stringify(applications.slice(-25)));
        }catch(err){}
        if(status)status.textContent='Visa application details and selected document names have been captured. Wakanow will follow up with payment and processing steps.';
        form.reset();
        syncConditional();
        updateProgress();
      });

      syncConditional();
      updateProgress();
    });
  }

  function initIcons(){
    if(window.lucide && typeof window.lucide.createIcons==='function'){
      window.lucide.createIcons();
    }
  }

  window.addEventListener('headies:lucide-ready',initIcons);

  function boot(){ initNav();initReveal();initCountUp();initCountdown();initLightbox();initCarousel();initTimelineDrag();initWhiteGlove();initTravelFlow();initVisaUploadPortal();initIcons(); }
  if(document.readyState!=='loading')boot(); else document.addEventListener('DOMContentLoaded',boot);
})();
