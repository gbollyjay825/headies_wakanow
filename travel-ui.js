(function(){
  'use strict';

  function readJSON(key,fallback){
    try{return JSON.parse(localStorage.getItem(key)||'')||fallback;}catch(err){return fallback;}
  }
  function writeJSON(key,value){try{localStorage.setItem(key,JSON.stringify(value));}catch(err){}}
  function makeId(prefix){return prefix+'-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8);}
  function apiJSON(path,options){
    options=options||{};
    return fetch(path,{
      method:options.method||'GET',
      headers:Object.assign({'content-type':'application/json'},options.headers||{}),
      body:options.body?JSON.stringify(options.body):undefined
    }).then(function(response){
      return response.json().catch(function(){return {};}).then(function(data){
        if(!response.ok){
          var message=data&&data.error?data.error:'Request failed';
          throw new Error(message);
        }
        return data;
      });
    });
  }
  function value(form,name){
    var field=form.elements[name];
    if(!field)return '';
    if(field instanceof RadioNodeList)return field.value;
    if(field.type==='checkbox')return field.checked;
    return String(field.value||'');
  }
  function checkedServices(form){
    return Array.prototype.slice.call(form.querySelectorAll('input[name="services"]:checked')).map(function(input){return input.value;});
  }
  function dateRange(a,b){
    if(a&&b)return a+' -> '+b;
    if(a)return 'From '+a;
    return 'Dates to confirm';
  }
  function cacheRequest(record){
    var requests=readJSON('wkn_requests',[]);
    requests.push(record);
    writeJSON('wkn_requests',requests.slice(-80));
  }
  function saveRequest(record){
    var entry=Object.assign({id:makeId('r'),createdAt:new Date().toISOString(),status:'New'},record);
    return apiJSON('/api/requests',{method:'POST',body:entry}).then(function(result){
      var saved=result.request||entry;
      cacheRequest(saved);
      return saved;
    }).catch(function(){
      cacheRequest(entry);
      return entry;
    });
  }
  function initMobileNav(){
    var button=document.querySelector('[data-mobile-menu]');
    var links=document.querySelector('.nav-links');
    if(!button||!links)return;
    button.addEventListener('click',function(){
      var open=links.classList.toggle('is-open');
      links.style.display=open?'flex':'';
      links.style.position=open?'absolute':'';
      links.style.left=open?'24px':'';
      links.style.right=open?'24px':'';
      links.style.top=open?'72px':'';
      links.style.padding=open?'12px':'';
      links.style.flexDirection=open?'column':'';
      links.style.background=open?'#101722':'';
      links.style.border=open?'1px solid rgba(180,200,230,.14)':'';
      links.style.borderRadius=open?'8px':'';
    });
  }

  function initCountdowns(){
    document.querySelectorAll('[data-countdown-deadline]').forEach(function(root){
      var target=new Date(root.getAttribute('data-countdown-deadline')).getTime();
      function pad(n){return String(n).padStart(2,'0');}
      function tick(){
        var diff=Math.max(0,target-Date.now());
        var days=Math.floor(diff/86400000);
        var hours=Math.floor(diff/3600000)%24;
        var mins=Math.floor(diff/60000)%60;
        var secs=Math.floor(diff/1000)%60;
        var map={days:String(days),hours:pad(hours),mins:pad(mins),secs:pad(secs)};
        Object.keys(map).forEach(function(key){
          var node=root.querySelector('[data-cd="'+key+'"]');
          if(node)node.textContent=map[key];
        });
      }
      tick();
      setInterval(tick,1000);
    });
  }

  function initTripWizard(){
    var form=document.querySelector('[data-trip-wizard]');
    if(!form)return;
    var step=1;
    var total=5;
    var panels=Array.prototype.slice.call(form.querySelectorAll('[data-step-panel]'));
    var stepButtons=Array.prototype.slice.call(form.querySelectorAll('[data-step-button]'));
    var progress=form.querySelector('[data-wizard-progress]');
    var summary=document.querySelector('[data-trip-summary]');
    var segmentBadge=document.querySelector('[data-segment-count]');
    var status=form.querySelector('[role="status"]');
    var carFields=form.querySelector('[data-car-fields]');
    var classWrap=form.querySelector('[data-flight-class-wrap]');
    var next=form.querySelector('[data-next-step]');
    var back=form.querySelector('[data-prev-step]');
    var submit=form.querySelector('[data-submit-trip]');

    function setStep(nextStep){
      step=Math.min(total,Math.max(1,nextStep));
      panels.forEach(function(panel){
        panel.hidden=Number(panel.getAttribute('data-step-panel'))!==step;
      });
      stepButtons.forEach(function(button){
        var n=Number(button.getAttribute('data-step-button'));
        button.classList.toggle('is-active',n===step);
        button.classList.toggle('is-done',n<step);
      });
      if(progress)progress.style.width=(((step-1)/(total-1))*100)+'%';
      if(back)back.hidden=step===1;
      if(next)next.hidden=step===total;
      if(submit)submit.hidden=step!==total;
    }
    function currentPanel(){
      return panels.find(function(panel){return Number(panel.getAttribute('data-step-panel'))===step;});
    }
    function validateCurrent(){
      var panel=currentPanel();
      if(!panel)return true;
      var required=Array.prototype.slice.call(panel.querySelectorAll('[required]'));
      for(var i=0;i<required.length;i++){
        if(required[i].disabled)continue;
        if(!required[i].checkValidity()){
          required[i].reportValidity();
          return false;
        }
      }
      return true;
    }
    function syncConditional(){
      var needsCar=!!value(form,'carRentalNeeded');
      if(carFields){
        carFields.hidden=!needsCar;
        carFields.querySelectorAll('input,select').forEach(function(field){
          field.disabled=!needsCar;
          field.required=needsCar&&(field.name==='carType'||field.name==='carRentalDays');
          if(!needsCar)field.required=false;
        });
      }
      var flightType=value(form,'flightType');
      if(flightType==='Private Jet'){
        var privateRadio=form.querySelector('input[name="flightClass"][value="Private Jet"]');
        if(privateRadio)privateRadio.checked=true;
      }
      if(classWrap)classWrap.hidden=flightType==='No Flight Needed';
      updateSummary();
    }
    function summaryRows(){
      var rows=[];
      var flightType=value(form,'flightType');
      var flightClass=value(form,'flightClass');
      if(flightType==='No Flight Needed'){
        rows.push({k:'Flight',v:'Not needed',sub:''});
      }else{
        rows.push({k:'Flight',v:(flightClass||'Class pending')+' / '+(flightType||'Flight pending'),sub:dateRange(value(form,'flightDepartureDate'),value(form,'flightReturnDate'))});
      }
      var stay=value(form,'accommodation');
      if(stay==='No Accommodation Needed'){
        rows.push({k:'Stay',v:'Not needed',sub:''});
      }else{
        rows.push({k:'Stay',v:(stay==='Villa'?'Private villa':(value(form,'hotelClass')||'Hotel class pending')+' hotel'),sub:dateRange(value(form,'hotelCheckIn'),value(form,'hotelCheckOut'))});
      }
      var transfer=value(form,'airportTransfer');
      if(transfer==='No Airport Transfer Needed'){
        rows.push({k:'Airport transfer',v:'Not needed',sub:''});
      }else{
        rows.push({k:'Airport transfer',v:transfer||'Transfer pending',sub:(value(form,'transferPassengers')||'1')+' passenger(s)'});
      }
      if(value(form,'carRentalNeeded')){
        rows.push({k:'Car rental',v:(value(form,'carType')||'Vehicle pending'),sub:(value(form,'carRentalDays')||'0')+' day(s)'});
      }else{
        rows.push({k:'Car rental',v:'Not added',sub:''});
      }
      if(value(form,'needsVisa'))rows.push({k:'Visa support',v:'Requested',sub:'Applicant portal required'});
      return rows;
    }
    function updateSummary(){
      var rows=summaryRows();
      if(segmentBadge){
        var count=rows.filter(function(row){return row.v!=='Not needed'&&row.v!=='Not added';}).length;
        segmentBadge.textContent=count+' segments';
      }
      if(!summary)return;
      summary.innerHTML='';
      rows.forEach(function(row){
        var item=document.createElement('div');
        item.className='summary-row';
        item.innerHTML='<span class="summary-dot" aria-hidden="true"></span><div><span class="summary-row__label"></span><strong></strong><small></small></div>';
        item.querySelector('.summary-row__label').textContent=row.k;
        item.querySelector('strong').textContent=row.v;
        item.querySelector('small').textContent=row.sub||'';
        summary.appendChild(item);
      });
    }
    function collectPlan(){
      var rows=summaryRows();
      return {
        type:'Travel',
        name:value(form,'name').trim(),
        email:value(form,'email').trim(),
        phone:value(form,'phone').trim(),
        summary:rows.slice(0,2).map(function(row){return row.v;}).join(' / '),
        details:[
          ['Flight',rows[0].v],
          ['Travel dates',rows[0].sub||'Flexible'],
          ['Stay',rows[1].v],
          ['Stay dates',rows[1].sub||'Flexible'],
          ['Airport transfer',rows[2].v+' '+(rows[2].sub||'')],
          ['Car rental',rows[3].v+' '+(rows[3].sub||'')],
          ['Visa support',value(form,'needsVisa')?'Requested':'No'],
          ['Notes',value(form,'notes').trim()||'-']
        ]
      };
    }
    if(next)next.addEventListener('click',function(){if(validateCurrent())setStep(step+1);});
    if(back)back.addEventListener('click',function(){setStep(step-1);});
    stepButtons.forEach(function(button){button.addEventListener('click',function(){setStep(Number(button.getAttribute('data-step-button')));});});
    form.addEventListener('input',syncConditional);
    form.addEventListener('change',syncConditional);
    form.addEventListener('submit',function(event){
      event.preventDefault();
      syncConditional();
      if(!form.checkValidity()){
        form.reportValidity();
        return;
      }
      var plan=collectPlan();
      if(status)status.textContent='Submitting travel request...';
      saveRequest(plan).then(function(saved){
        var legacy=readJSON('headiesTravelPlans',[]);
        legacy.push(saved);
        writeJSON('headiesTravelPlans',legacy.slice(-80));
        if(status)status.textContent='Travel request received. Wakanow will follow up with options.';
        form.reset();
        setStep(1);
        syncConditional();
      });
    });
    syncConditional();
    setStep(1);
  }

  function initLuxuryForm(){
    var form=document.querySelector('[data-luxury-form]');
    if(!form)return;
    var status=form.querySelector('[role="status"]');
    form.addEventListener('submit',function(event){
      event.preventDefault();
      var services=checkedServices(form);
      if(!services.length){
        if(status)status.textContent='Select at least one concierge service.';
        return;
      }
      if(!form.checkValidity()){
        form.reportValidity();
        return;
      }
      var record={
        type:'Luxury',
        name:value(form,'luxName').trim(),
        email:value(form,'luxEmail').trim(),
        phone:value(form,'luxPhone').trim(),
        summary:services.join(', '),
        details:[['Services',services.join(', ')]]
      };
      if(status)status.textContent='Submitting concierge request...';
      saveRequest(record).then(function(){
        if(status)status.textContent='Concierge request received. A dedicated travel specialist will follow up.';
        form.reset();
      });
    });
  }

  function boot(){
    initMobileNav();
    initCountdowns();
    initTripWizard();
    initLuxuryForm();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);
  else boot();
})();
