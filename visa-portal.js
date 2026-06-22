/* Wakanow x Headies visa portal: static front-end auth/admin prototype */
(function(){
  'use strict';

  var ELIGIBLE_KEY='headiesVisaEligibleApplicants';
  var ADMIN_SESSION_KEY='headiesVisaAdminSession';
  var APPLICANT_SESSION_KEY='headiesVisaApplicantSession';
  var ADMIN_PASSCODE='HEADIES2026';
  var DB_NAME='headiesVisaPortal';
  var DB_VERSION=1;
  var APP_STORE='applications';
  var eligibleCache=null;

  function readJSON(key,fallback){
    try{return JSON.parse(localStorage.getItem(key)||'')||fallback;}catch(err){return fallback;}
  }
  function readSessionJSON(key,fallback){
    try{return JSON.parse(sessionStorage.getItem(key)||'')||fallback;}catch(err){return fallback;}
  }
  function writeJSON(key,value){localStorage.setItem(key,JSON.stringify(value));}
  function normalizeEmail(email){return String(email||'').trim().toLowerCase();}
  function now(){return new Date().toISOString();}
  function makeId(prefix){return prefix+'-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8);}
  function makeAccessCode(){
    var chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    var code='';
    for(var i=0;i<8;i++)code+=chars[Math.floor(Math.random()*chars.length)];
    return code;
  }
  function formatDate(value){
    if(!value)return '';
    try{return new Date(value).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'});}catch(err){return value;}
  }
  function fileSize(bytes){
    if(!bytes)return '0 KB';
    if(bytes<1048576)return Math.max(1,Math.round(bytes/1024))+' KB';
    return (bytes/1048576).toFixed(bytes<10485760?1:0)+' MB';
  }
  function setStatus(node,message){if(node)node.textContent=message||'';}
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
  function create(tag,className,text){
    var node=document.createElement(tag);
    if(className)node.className=className;
    if(text!==undefined)node.textContent=text;
    return node;
  }
  function eligibleList(){
    if(!eligibleCache)eligibleCache=readJSON(ELIGIBLE_KEY,[]);
    return eligibleCache;
  }
  function saveEligible(list){
    eligibleCache=list;
    writeJSON(ELIGIBLE_KEY,list);
  }
  function csvEscape(value){
    var text=String(value==null?'':value);
    return /[",\n]/.test(text)?'"'+text.replace(/"/g,'""')+'"':text;
  }
  function parseCSV(text){
    var rows=[],row=[],field='',quoted=false;
    for(var i=0;i<text.length;i++){
      var ch=text[i],next=text[i+1];
      if(quoted&&ch==='"'&&next==='"'){field+='"';i++;continue;}
      if(ch==='"'){quoted=!quoted;continue;}
      if(!quoted&&ch===','){row.push(field);field='';continue;}
      if(!quoted&&(ch==='\n'||ch==='\r')){
        if(ch==='\r'&&next==='\n')i++;
        row.push(field);field='';
        if(row.some(function(cell){return cell.trim();}))rows.push(row);
        row=[];
        continue;
      }
      field+=ch;
    }
    row.push(field);
    if(row.some(function(cell){return cell.trim();}))rows.push(row);
    if(rows.length<2)return [];
    var headers=rows.shift().map(function(h){return h.trim();});
    return rows.map(function(cells){
      var item={};
      headers.forEach(function(header,index){item[header]=String(cells[index]||'').trim();});
      return item;
    });
  }
  function upsertEligible(records){
    var list=eligibleList();
    records.forEach(function(record){
      var email=normalizeEmail(record.email||record.Email);
      if(!email)return;
      var existing=list.find(function(item){return normalizeEmail(item.email)===email;});
      var next={
        id:existing?existing.id:makeId('elig'),
        name:(record.name||record.Name||existing&&existing.name||'').trim(),
        email:email,
        phone:(record.phone||record.Phone||existing&&existing.phone||'').trim(),
        accessCode:String(record.accessCode||record.AccessCode||record.code||record.Code||existing&&existing.accessCode||makeAccessCode()).trim(),
        category:String(record.category||record.Category||existing&&existing.category||'').trim(),
        status:String(record.status||record.Status||existing&&existing.status||'active').trim()||'active',
        notes:String(record.notes||record.Notes||existing&&existing.notes||'').trim(),
        createdAt:existing?existing.createdAt:now(),
        updatedAt:now()
      };
      if(existing)Object.assign(existing,next); else list.push(next);
    });
    saveEligible(list);
    return records.length;
  }
  function syncEligibleFromBackend(){
    return apiJSON('/api/eligible').then(function(result){
      saveEligible(result.applicants||[]);
      return eligibleList();
    }).catch(function(){
      return eligibleList();
    });
  }
  function addEligibleRemote(record){
    return apiJSON('/api/eligible',{method:'POST',body:record}).then(function(result){
      saveEligible(result.applicants||eligibleList());
      return result;
    }).catch(function(){
      upsertEligible([record]);
      return {applicants:eligibleList()};
    });
  }
  function importEligibleRemote(records){
    return apiJSON('/api/eligible/import',{method:'POST',body:{records:records}}).then(function(result){
      saveEligible(result.applicants||eligibleList());
      return result;
    }).catch(function(){
      upsertEligible(records);
      return {count:records.length,applicants:eligibleList()};
    });
  }
  function signupApplicantLocal(record){
    var list=eligibleList();
    var email=normalizeEmail(record.email);
    var existing=list.find(function(item){return normalizeEmail(item.email)===email;});
    var next={
      id:existing?existing.id:makeId('elig'),
      name:String(record.name||existing&&existing.name||'').trim(),
      email:email,
      phone:String(record.phone||existing&&existing.phone||'').trim(),
      accessCode:existing&&existing.accessCode?existing.accessCode:makeAccessCode(),
      category:String(record.category||existing&&existing.category||'').trim(),
      status:existing&&(existing.status==='active'||existing.status==='blocked')?existing.status:'pending',
      notes:String(record.notes||existing&&existing.notes||'').trim(),
      createdAt:existing?existing.createdAt:now(),
      updatedAt:now()
    };
    if(existing)Object.assign(existing,next);else list.push(next);
    saveEligible(list);
    return next;
  }
  function signupApplicantRemote(record){
    return apiJSON('/api/eligible/signup',{method:'POST',body:record}).then(function(result){
      return syncEligibleFromBackend().then(function(){return result.applicant;});
    }).catch(function(){
      return signupApplicantLocal(record);
    });
  }
  function patchEligibleRemote(id,fields){
    return apiJSON('/api/eligible/'+encodeURIComponent(id),{method:'PATCH',body:fields}).then(function(result){
      var list=eligibleList();
      var found=list.find(function(record){return record.id===id;});
      if(found&&result.applicant)Object.assign(found,result.applicant);
      saveEligible(list);
      return result.applicant||found;
    }).catch(function(){
      var list=eligibleList();
      var found=list.find(function(record){return record.id===id;});
      if(found){Object.assign(found,fields,{updatedAt:now()});saveEligible(list);}
      return found;
    });
  }
  function removeEligibleRemote(id){
    return apiJSON('/api/eligible/'+encodeURIComponent(id),{method:'DELETE'}).then(function(){
      saveEligible(eligibleList().filter(function(record){return record.id!==id;}));
    }).catch(function(){
      saveEligible(eligibleList().filter(function(record){return record.id!==id;}));
    });
  }
  function downloadText(filename,text){
    var blob=new Blob([text],{type:'text/plain;charset=utf-8'});
    var url=URL.createObjectURL(blob);
    var link=document.createElement('a');
    link.href=url;link.download=filename;document.body.appendChild(link);link.click();
    setTimeout(function(){URL.revokeObjectURL(url);link.remove();},0);
  }
  function exportEligibleCSV(){
    var rows=[['name','email','phone','accessCode','category','status','notes']];
    eligibleList().forEach(function(item){
      rows.push([item.name,item.email,item.phone,item.accessCode,item.category,item.status,item.notes]);
    });
    downloadText('headies-visa-eligible-applicants.csv',rows.map(function(row){return row.map(csvEscape).join(',');}).join('\n'));
  }
  function downloadTemplate(){
    downloadText('visa-eligible-template.csv','name,email,phone,accessCode,category,status,notes\nExample Applicant,applicant@example.com,+2340000000000,HEADIES123,employed,active,');
  }

  function openDB(){
    return new Promise(function(resolve,reject){
      var request=indexedDB.open(DB_NAME,DB_VERSION);
      request.onupgradeneeded=function(){
        var db=request.result;
        if(!db.objectStoreNames.contains(APP_STORE))db.createObjectStore(APP_STORE,{keyPath:'id'});
      };
      request.onsuccess=function(){resolve(request.result);};
      request.onerror=function(){reject(request.error);};
    });
  }
  function txStore(mode){
    return openDB().then(function(db){
      return {db:db,store:db.transaction(APP_STORE,mode).objectStore(APP_STORE)};
    });
  }
  function putApplicationLocal(app){
    return txStore('readwrite').then(function(ctx){
      return new Promise(function(resolve,reject){
        var req=ctx.store.put(app);
        req.onsuccess=function(){ctx.db.close();resolve(app);};
        req.onerror=function(){ctx.db.close();reject(req.error);};
      });
    });
  }
  function getApplicationLocal(id){
    return txStore('readonly').then(function(ctx){
      return new Promise(function(resolve,reject){
        var req=ctx.store.get(id);
        req.onsuccess=function(){ctx.db.close();resolve(req.result||null);};
        req.onerror=function(){ctx.db.close();reject(req.error);};
      });
    });
  }
  function getApplicationsLocal(){
    return txStore('readonly').then(function(ctx){
      return new Promise(function(resolve,reject){
        var req=ctx.store.getAll();
        req.onsuccess=function(){ctx.db.close();resolve(req.result||[]);};
        req.onerror=function(){ctx.db.close();reject(req.error);};
      });
    });
  }
  function putApplication(app){
    return apiJSON('/api/visa/applications',{method:'POST',body:app}).then(function(result){
      return result.application||app;
    }).catch(function(){
      return putApplicationLocal(app);
    });
  }
  function getApplication(id){
    return apiJSON('/api/visa/applications/'+encodeURIComponent(id)).then(function(result){
      return result.application||null;
    }).catch(function(){
      return getApplicationLocal(id);
    });
  }
  function getApplications(){
    return apiJSON('/api/visa/applications').then(function(result){
      return result.applications||[];
    }).catch(function(){
      return getApplicationsLocal();
    });
  }
  function fileToData(file){
    return new Promise(function(resolve,reject){
      var reader=new FileReader();
      reader.onload=function(){
        resolve({name:file.name,size:file.size,type:file.type||'application/octet-stream',lastModified:file.lastModified,dataUrl:reader.result});
      };
      reader.onerror=function(){reject(reader.error);};
      reader.readAsDataURL(file);
    });
  }
  function countFiles(app){
    return (app.uploads||[]).reduce(function(total,doc){return total+(doc.files?doc.files.length:0);},0);
  }

  function initConditionalUploadForm(form){
    var applicantType=form.querySelector('[data-visa-applicant-type]');
    var progress=form.querySelector('[data-upload-progress]');
    var progressBar=form.querySelector('[data-upload-progress-bar]');
    var progressCount=form.querySelector('[data-upload-progress-count]');
    function sectionEnabled(section){
      var target=section.getAttribute('data-applicant-section');
      var value=applicantType?applicantType.value:'';
      if(target==='employed')return value==='employed'||value==='employed-business-owner';
      if(target==='business-owner')return value==='business-owner'||value==='employed-business-owner';
      return true;
    }
    function setRequiredState(control,enabled){
      control.disabled=!enabled;
      control.required=enabled&&control.getAttribute('data-required')==='true';
      if(!enabled)control.required=false;
    }
    function renderFiles(input){
      var card=input.closest('[data-upload-card]');
      if(!card)return;
      var list=card.querySelector('[data-upload-list]');
      var files=Array.prototype.slice.call(input.files||[]);
      card.classList.toggle('is-complete',files.length>0);
      if(!list)return;
      list.innerHTML='';
      files.forEach(function(file){
        var item=create('li');
        item.appendChild(create('span','',file.name));
        item.appendChild(create('span','',fileSize(file.size)));
        list.appendChild(item);
      });
    }
    function requiredUploads(){
      return Array.prototype.slice.call(form.querySelectorAll('[data-upload-input]')).filter(function(input){
        return !input.disabled&&input.required;
      });
    }
    function sync(){
      form.querySelectorAll('[data-applicant-section]').forEach(function(section){
        var enabled=sectionEnabled(section);
        section.hidden=!enabled;
        section.querySelectorAll('input,select,textarea').forEach(function(control){setRequiredState(control,enabled);});
      });
      form.querySelectorAll('[data-upload-input]').forEach(function(input){
        if(input.closest('[data-applicant-section]'))return;
        setRequiredState(input,true);
      });
      form.querySelectorAll('[data-upload-input]').forEach(renderFiles);
      var reqs=requiredUploads();
      var complete=reqs.filter(function(input){return input.files&&input.files.length;}).length;
      var pct=reqs.length?Math.round((complete/reqs.length)*100):100;
      if(progress)progress.setAttribute('aria-valuenow',String(pct));
      if(progressBar)progressBar.style.width=pct+'%';
      if(progressCount)progressCount.textContent=complete+' of '+reqs.length+' required uploads ready';
    }
    form.querySelectorAll('[data-upload-input]').forEach(function(input){input.addEventListener('change',sync);});
    if(applicantType)applicantType.addEventListener('change',sync);
    sync();
    return {sync:sync};
  }

  function initApplicantPortal(){
    var root=document.querySelector('[data-visa-auth-root]');
    if(!root)return;
    var loginView=root.querySelector('[data-auth-view="login"]');
    var portalView=root.querySelector('[data-auth-view="portal"]');
    var loginForm=root.querySelector('[data-visa-login-form]');
    var signupForm=root.querySelector('[data-visa-signup-form]');
    var authButtons=Array.prototype.slice.call(root.querySelectorAll('[data-auth-mode-button]'));
    var authPanels=Array.prototype.slice.call(root.querySelectorAll('[data-auth-mode-panel]'));
    var applicationForm=root.querySelector('[data-visa-application-form]');
    var logout=root.querySelector('[data-visa-logout]');
    var uploadControls=applicationForm?initConditionalUploadForm(applicationForm):null;
    var currentApplicant=null;

    function findEligible(email,code){
      return eligibleList().find(function(item){
        return normalizeEmail(item.email)===normalizeEmail(email)&&String(item.accessCode||'').trim().toLowerCase()===String(code||'').trim().toLowerCase()&&(item.status||'active')==='active';
      });
    }
    function setAuthMode(mode){
      authButtons.forEach(function(button){
        button.classList.toggle('is-active',button.getAttribute('data-auth-mode-button')===mode);
      });
      authPanels.forEach(function(panel){
        panel.hidden=panel.getAttribute('data-auth-mode-panel')!==mode;
      });
    }
    function loginApplicant(email,code){
      return apiJSON('/api/eligible/login',{method:'POST',body:{email:email,accessCode:code}}).then(function(result){
        var applicant=result.applicant;
        if(applicant){
          var list=eligibleList();
          var existing=list.find(function(item){return item.id===applicant.id;});
          if(existing)Object.assign(existing,applicant);else list.push(applicant);
          saveEligible(list);
        }
        return applicant;
      }).catch(function(){
        return findEligible(email,code)||null;
      });
    }
    function setView(authenticated){
      loginView.hidden=authenticated;
      portalView.hidden=!authenticated;
    }
    function renderExisting(app){
      var status=root.querySelector('[data-existing-status]');
      if(!status)return;
      status.innerHTML='';
      if(!app){
        status.appendChild(create('span','pill pill--muted','No submission yet'));
        return;
      }
      status.appendChild(create('span','pill pill--warn',app.status||'Submitted'));
      status.appendChild(create('span','pill pill--muted',countFiles(app)+' files'));
      status.appendChild(create('span','pill pill--muted',formatDate(app.updatedAt||app.createdAt)));
    }
    function populateApplicant(applicant,existing){
      currentApplicant=applicant;
      root.querySelector('[data-applicant-display-name]').textContent=applicant.name||applicant.email;
      root.querySelector('[data-applicant-display-meta]').textContent=applicant.email+(applicant.category?' · '+applicant.category:'');
      applicationForm.elements.applicantId.value=applicant.id;
      applicationForm.elements.name.value=applicant.name||'';
      applicationForm.elements.email.value=applicant.email||'';
      applicationForm.elements.phone.value=existing&&existing.phone||applicant.phone||'';
      applicationForm.elements.applicants.value=existing&&existing.applicants||'1';
      applicationForm.elements.applicantCategory.value=existing&&existing.applicantCategory||applicant.category||'';
      applicationForm.elements.passportExpiry.value=existing&&existing.passportExpiry||'';
      applicationForm.elements.travelDate.value=existing&&existing.travelDate||'';
      applicationForm.elements.travelHistory.value=existing&&existing.travelHistory||'';
      applicationForm.elements.notes.value=existing&&existing.notes||'';
      if(applicationForm.elements.role)applicationForm.elements.role.value=existing&&existing.role||'';
      if(applicationForm.elements.salary)applicationForm.elements.salary.value=existing&&existing.salary||'';
      if(applicationForm.elements.employmentLength)applicationForm.elements.employmentLength.value=existing&&existing.employmentLength||'';
      if(uploadControls)uploadControls.sync();
      renderExisting(existing);
    }
    function openStoredSession(){
      var session=readSessionJSON(APPLICANT_SESSION_KEY,null)||readJSON(APPLICANT_SESSION_KEY,null);
      if(!session){setView(false);return;}
      var applicant=eligibleList().find(function(item){return item.id===session.id&&(item.status||'active')==='active';});
      if(!applicant){sessionStorage.removeItem(APPLICANT_SESSION_KEY);localStorage.removeItem(APPLICANT_SESSION_KEY);setView(false);return;}
      getApplication(applicant.id).then(function(existing){
        setView(true);
        populateApplicant(applicant,existing);
        if(location.hash!=='#visa-upload')location.hash='visa-upload';
      }).catch(function(){
        setView(true);
        populateApplicant(applicant,null);
        if(location.hash!=='#visa-upload')location.hash='visa-upload';
      });
    }
    function loadSession(){
      syncEligibleFromBackend().then(openStoredSession);
    }
    if(loginForm){
      loginForm.addEventListener('submit',function(e){
        e.preventDefault();
        var status=loginForm.querySelector('[role="status"]');
        setStatus(status,'Checking eligibility...');
        loginApplicant(loginForm.elements.email.value,loginForm.elements.accessCode.value).then(function(applicant){
          if(!applicant){setStatus(status,'No eligible applicant matched those details.');return;}
          sessionStorage.setItem(APPLICANT_SESSION_KEY,JSON.stringify({id:applicant.id,email:applicant.email}));
          localStorage.setItem(APPLICANT_SESSION_KEY,JSON.stringify({id:applicant.id,email:applicant.email}));
          setStatus(status,'');
          getApplication(applicant.id).then(function(existing){
            setView(true);
            populateApplicant(applicant,existing);
            location.hash='visa-upload';
          });
        });
      });
    }
    authButtons.forEach(function(button){
      button.addEventListener('click',function(){
        setAuthMode(button.getAttribute('data-auth-mode-button'));
      });
    });
    if(signupForm){
      signupForm.addEventListener('submit',function(e){
        e.preventDefault();
        var status=signupForm.querySelector('[role="status"]');
        if(!signupForm.checkValidity()){signupForm.reportValidity();return;}
        setStatus(status,'Submitting access request...');
        signupApplicantRemote({
          name:signupForm.elements.name.value,
          email:signupForm.elements.email.value,
          phone:signupForm.elements.phone.value,
          category:signupForm.elements.category.value,
          notes:signupForm.elements.notes.value
        }).then(function(applicant){
          if(applicant&&applicant.status==='active'){
            setStatus(status,'Your profile is already active. Use sign in with your access code.');
          }else if(applicant&&applicant.status==='blocked'){
            setStatus(status,'This profile cannot request access. Contact the visa admin team.');
          }else{
            setStatus(status,'Access request received. Admin approval is required before sign in.');
            signupForm.reset();
          }
        }).catch(function(){
          setStatus(status,'Could not submit access request.');
        });
      });
    }
    if(logout)logout.addEventListener('click',function(){
      sessionStorage.removeItem(APPLICANT_SESSION_KEY);
      localStorage.removeItem(APPLICANT_SESSION_KEY);
      applicationForm.reset();
      setView(false);
      location.hash='visa-login';
    });
    if(applicationForm){
      applicationForm.addEventListener('submit',function(e){
        e.preventDefault();
        if(uploadControls)uploadControls.sync();
        if(!applicationForm.checkValidity()){applicationForm.reportValidity();return;}
        if(!currentApplicant)return;
        var status=applicationForm.querySelector('[role="status"]');
        setStatus(status,'Saving application...');
        var uploadInputs=Array.prototype.slice.call(applicationForm.querySelectorAll('[data-upload-input]')).filter(function(input){return !input.disabled;});
        Promise.all(uploadInputs.map(function(input){
          return Promise.all(Array.prototype.slice.call(input.files||[]).map(fileToData)).then(function(files){
            return {field:input.name,document:input.getAttribute('data-upload-name')||input.name,required:input.required,files:files};
          });
        })).then(function(uploads){
          var app={
            id:currentApplicant.id,
            applicantId:currentApplicant.id,
            name:applicationForm.elements.name.value.trim(),
            email:applicationForm.elements.email.value.trim(),
            phone:applicationForm.elements.phone.value.trim(),
            applicants:applicationForm.elements.applicants.value,
            applicantCategory:applicationForm.elements.applicantCategory.value,
            passportExpiry:applicationForm.elements.passportExpiry.value,
            travelDate:applicationForm.elements.travelDate.value,
            travelHistory:applicationForm.elements.travelHistory.value.trim(),
            role:applicationForm.elements.role?applicationForm.elements.role.value.trim():'',
            salary:applicationForm.elements.salary?applicationForm.elements.salary.value.trim():'',
            employmentLength:applicationForm.elements.employmentLength?applicationForm.elements.employmentLength.value.trim():'',
            notes:applicationForm.elements.notes.value.trim(),
            fee:'NGN350,000 per applicant',
            status:'Submitted',
            uploads:uploads,
            createdAt:now(),
            updatedAt:now()
          };
          return putApplication(app).then(function(saved){
            setStatus(status,'Application submitted for admin review.');
            renderExisting(saved);
          });
        }).catch(function(){
          setStatus(status,'Could not save application in this browser.');
        });
      });
    }
    loadSession();
  }

  function initAdminPortal(){
    var root=document.querySelector('[data-visa-admin-root]');
    if(!root)return;
    var auth=root.querySelector('[data-admin-auth]');
    var dashboard=root.querySelector('[data-admin-dashboard]');
    var loginForm=root.querySelector('[data-admin-login-form]');
    var importForm=root.querySelector('[data-eligible-import-form]');
    var addForm=root.querySelector('[data-eligible-add-form]');
    var eligibleTable=root.querySelector('[data-eligible-table]');
    var eligibleWrap=root.querySelector('[data-eligible-table-wrap]');
    var eligibleEmpty=root.querySelector('[data-eligible-empty]');
    var appsTable=root.querySelector('[data-applications-table]');
    var appsWrap=root.querySelector('[data-applications-table-wrap]');
    var appsEmpty=root.querySelector('[data-applications-empty]');

    function isAdmin(){return sessionStorage.getItem(ADMIN_SESSION_KEY)==='true';}
    function setAdminView(open){auth.hidden=open;dashboard.hidden=!open;if(open)renderAdmin();}
    function renderEligible(){
      var list=eligibleList();
      eligibleTable.innerHTML='';
      eligibleEmpty.hidden=list.length>0;
      eligibleWrap.hidden=!list.length;
      list.forEach(function(item){
        var tr=create('tr');
        tr.innerHTML='<td><strong></strong><div></div></td><td></td><td></td><td></td><td></td><td></td>';
        tr.children[0].querySelector('strong').textContent=item.name||'Unnamed';
        tr.children[0].querySelector('div').textContent=item.phone||'';
        tr.children[1].textContent=item.email;
        tr.children[2].textContent=item.accessCode;
        tr.children[3].textContent=item.category||'Unassigned';
        var select=document.createElement('select');
        ['pending','active','blocked'].forEach(function(value){
          var option=document.createElement('option');option.value=value;option.textContent=value;
          if((item.status||'active')===value)option.selected=true;
          select.appendChild(option);
        });
        select.addEventListener('change',function(){
          patchEligibleRemote(item.id,{status:select.value}).then(renderAdmin);
        });
        tr.children[4].appendChild(select);
        var remove=document.createElement('button');
        remove.type='button';remove.className='btn btn-ghost';remove.textContent='Remove';
        remove.addEventListener('click',function(){
          removeEligibleRemote(item.id).then(renderAdmin);
        });
        tr.children[5].appendChild(remove);
        eligibleTable.appendChild(tr);
      });
    }
    function renderApplications(){
      getApplications().then(function(apps){
        apps.sort(function(a,b){return String(b.updatedAt||b.createdAt).localeCompare(String(a.updatedAt||a.createdAt));});
        appsTable.innerHTML='';
        appsEmpty.hidden=apps.length>0;
        appsWrap.hidden=!apps.length;
        apps.forEach(function(app){
          var tr=create('tr');
          tr.innerHTML='<td><strong></strong><div></div></td><td></td><td></td><td></td><td></td>';
          tr.children[0].querySelector('strong').textContent=app.name||app.email;
          tr.children[0].querySelector('div').textContent=app.email+' · '+(app.phone||'');
          var select=document.createElement('select');
          ['Submitted','In review','Missing documents','Approved','Declined'].forEach(function(value){
            var option=document.createElement('option');option.value=value;option.textContent=value;
            if((app.status||'Submitted')===value)option.selected=true;
            select.appendChild(option);
          });
          select.addEventListener('change',function(){
            app.status=select.value;app.updatedAt=now();
            putApplication(app).then(renderAdmin);
          });
          tr.children[1].appendChild(select);
          tr.children[2].textContent=app.applicantCategory||'';
          tr.children[3].textContent=formatDate(app.updatedAt||app.createdAt);
          var list=create('ul','document-list');
          (app.uploads||[]).forEach(function(doc){
            (doc.files||[]).forEach(function(file){
              var item=create('li');
              var label=create('span','',doc.document+' · '+file.name+' · '+fileSize(file.size));
              var link=create('a','doc-link','Download');
              link.href=file.dataUrl;link.download=file.name;
              item.appendChild(label);item.appendChild(link);list.appendChild(item);
            });
          });
          tr.children[4].appendChild(list.children.length?list:create('span','pill pill--muted','No files'));
          appsTable.appendChild(tr);
        });
        root.querySelector('[data-stat-applications]').textContent=String(apps.length);
        root.querySelector('[data-stat-documents]').textContent=String(apps.reduce(function(total,app){return total+countFiles(app);},0));
      });
    }
    function renderAdmin(){
      syncEligibleFromBackend().then(function(){
        renderEligible();
        renderApplications();
        root.querySelector('[data-stat-eligible]').textContent=String(eligibleList().length);
      });
    }
    if(loginForm){
      loginForm.addEventListener('submit',function(e){
        e.preventDefault();
        var status=loginForm.querySelector('[role="status"]');
        if(loginForm.elements.passcode.value===ADMIN_PASSCODE){
          sessionStorage.setItem(ADMIN_SESSION_KEY,'true');
          setStatus(status,'');
          setAdminView(true);
        }else{
          setStatus(status,'Invalid admin passcode.');
        }
      });
    }
    var logout=root.querySelector('[data-admin-logout]');
    if(logout)logout.addEventListener('click',function(){sessionStorage.removeItem(ADMIN_SESSION_KEY);setAdminView(false);});
    if(importForm){
      importForm.addEventListener('submit',function(e){
        e.preventDefault();
        var status=importForm.querySelector('[role="status"]');
        var file=importForm.elements.eligibleCsv.files[0];
        if(!file)return;
        file.text().then(function(text){
          var rows=parseCSV(text);
          setStatus(status,'Importing applicants...');
          importEligibleRemote(rows).then(function(){
            setStatus(status,rows.length+' applicants imported.');
            importForm.reset();
            renderAdmin();
          });
        });
      });
    }
    if(addForm){
      addForm.addEventListener('submit',function(e){
        e.preventDefault();
        var status=addForm.querySelector('[role="status"]');
        setStatus(status,'Adding applicant...');
        addEligibleRemote({
          name:addForm.elements.name.value,
          email:addForm.elements.email.value,
          phone:addForm.elements.phone.value,
          accessCode:addForm.elements.accessCode.value||makeAccessCode(),
          category:addForm.elements.category.value,
          notes:addForm.elements.notes.value
        }).then(function(){
          setStatus(status,'Applicant added.');
          addForm.reset();
          renderAdmin();
        });
      });
    }
    var template=root.querySelector('[data-download-template]');
    if(template)template.addEventListener('click',downloadTemplate);
    var exportBtn=root.querySelector('[data-export-eligible]');
    if(exportBtn)exportBtn.addEventListener('click',exportEligibleCSV);
    var refresh=root.querySelector('[data-refresh-admin]');
    if(refresh)refresh.addEventListener('click',renderAdmin);
    setAdminView(isAdmin());
  }

  function boot(){initApplicantPortal();initAdminPortal();}
  if(document.readyState!=='loading')boot();else document.addEventListener('DOMContentLoaded',boot);
})();
