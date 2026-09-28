/* RunPrep V3 UI. No remote scripts, analytics, account or API. */
'use strict';
const E=window.RunPrepEngine,C=window.RunPrepCalendar,$=id=>document.getElementById(id);
const STORAGE_KEY='runprep_multisport_v3',OLD_KEY='runprep_multisport_v2';
const DAY_NAMES={1:'Lundi',2:'Mardi',3:'Mercredi',4:'Jeudi',5:'Vendredi',6:'Samedi',0:'Dimanche'};
const DAY_ORDER=[1,2,3,4,5,6,0];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmtDate=s=>new Intl.DateTimeFormat('fr-FR',{day:'numeric',month:'short',year:'numeric'}).format(new Date(s+'T12:00:00'));
const fullDate=s=>new Intl.DateTimeFormat('fr-FR',{day:'numeric',month:'long',year:'numeric'}).format(new Date(s+'T12:00:00'));
const hourText=min=>`${Math.floor(min/60)} h ${String(Math.round(min%60)).padStart(2,'0')}`;
let state=null,baseResult=null,currentResult=null,legacy=null,deferredInstallPrompt=null,toastTimer;
function toast(msg){clearTimeout(toastTimer);$('toast').textContent=msg;$('toast').classList.remove('hidden');toastTimer=setTimeout(()=>$('toast').classList.add('hidden'),5500);}
function screen(name){document.querySelectorAll('.screen').forEach(s=>s.classList.toggle('active',s.id==='screen'+name[0].toUpperCase()+name.slice(1)));window.scrollTo({top:0,behavior:'smooth'});}
function persist(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state));return true;}catch{toast('Stockage local indisponible ou plein. Exporte une sauvegarde avant de fermer.');return false;}}
function download(content,name,type){const url=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);}
function buildPickers(){
  for(const [container,prefix,checked] of [['dayPicker','day',[1,3,0]],['poolDayPicker','pool',DAY_ORDER]]){
    $(container).innerHTML=DAY_ORDER.map(d=>`<label><input type="checkbox" id="${prefix}${d}" value="${d}" ${checked.includes(d)?'checked':''}>${DAY_NAMES[d].slice(0,3)}</label>`).join('');
  }
  $('longDay').innerHTML=DAY_ORDER.map(d=>`<option value="${d}" ${d===0?'selected':''}>${DAY_NAMES[d]}</option>`).join('');
  $('dayCaps').innerHTML=DAY_ORDER.map(d=>`<label>${DAY_NAMES[d]} : limite particuliere (min)<input id="cap${d}" type="number" min="15" max="300" placeholder="Reglage ordinaire / long"></label>`).join('');
  $('equipmentPicker').innerHTML=Object.entries({skierg:'SkiErg',sled:'Sled',rower:'Rameur',kettlebells:'Kettlebells',sandbag:'Sandbag',wallball:'Wall ball'}).map(([k,label])=>`<label><input type="checkbox" class="equipment" value="${k}" checked>${label}</label>`).join('');
}
buildPickers();
const textFields=['startDate','raceDate','goalType','goalTime','easyPace','time5k','time10k','swimPace','triDistance','hyroxDivision','reminderTime'];
const numberFields=['raceDistance','experience','runWeeklyMin','recentLongRunMin','swimWeeklyM','bikeWeeklyHours','recentLongBikeMin','strengthSessions','recentStrengthMin','sessionsPerWeek','maxSessionMin','longSessionMin','longDay','weeklyHoursCap','maxRunMin','maxBikeMin','maxSwimMin','maxStrengthMin','sleepHours','stress'];
function sport(){return document.querySelector('input[name="sport"]:checked').value;}
function sportUI(){
  for(const name of ['running','triathlon','hyrox'])document.querySelectorAll('.for-'+name).forEach(el=>{const show=name===sport();el.classList.toggle('hidden',!show);if(el.matches('label'))el.querySelectorAll('input,select').forEach(i=>i.disabled=!show);else el.querySelectorAll('input,select').forEach(i=>i.disabled=!show);});
  $('goalTimeWrap').classList.toggle('hidden',$('goalType').value!=='time');
}
function suggestDays(s){
  const days=s==='running'?[1,3,0]:s==='triathlon'?[1,2,4,6,0]:[1,3,5,0];
  $('sessionsPerWeek').value=days.length;$('longDay').value='0';
  document.querySelectorAll('#dayPicker input').forEach(x=>x.checked=days.includes(Number(x.value)));
}
$('startDate').value=E.localToday();$('startDate').min=E.localToday();$('raceDate').value=E.dateAdd(E.localToday(),112);
$('raceDate').min=E.dateAdd(E.localToday(),14);
function readProfile(){
  const p={sport:sport(),hasRedFlag:[...document.querySelectorAll('.redflag')].some(x=>x.checked),adultConfirmed:$('adultConfirmed').checked,poolAccess:$('poolAccess').checked,bikeAccess:$('bikeAccess').checked};
  for(const k of textFields)p[k]=$(k).value.trim();for(const k of numberFields)p[k]=Number($(k).value);
  p.days=[...document.querySelectorAll('#dayPicker input:checked')].map(x=>Number(x.value));
  p.poolDays=[...document.querySelectorAll('#poolDayPicker input:checked')].map(x=>Number(x.value));
  if(p.sport==='triathlon'&&p.poolDays.length===0)throw new Error('Selectionne au moins un jour possible pour nager.');
  p.hyroxEquipment=[...document.querySelectorAll('.equipment:checked')].map(x=>x.value);
  p.dayMinutes={};for(const d of DAY_ORDER)if($('cap'+d).value!=='')p.dayMinutes[d]=Number($('cap'+d).value);
  p.triTime5k=p.time5k;p.hyroxTime5k=p.time5k;
  if(p.goalType!=='time')p.goalTime='';
  return p;
}
function populate(p){
  if(!p)return;
  const radio=document.querySelector(`input[name="sport"][value="${['running','triathlon','hyrox'].includes(p.sport)?p.sport:'running'}"]`);radio.checked=true;sportUI();
  for(const k of [...textFields,...numberFields])if(p[k]!=null)$(k).value=p[k];
  $('startDate').value=E.localToday();
  const oldPace=p.sport==='triathlon'?p.triTime5k:p.sport==='hyrox'?p.hyroxTime5k:p.time5k;$('time5k').value=oldPace||'';
  // Old pace interpretation was ambiguous: force confirmation of real MINUTES.
  if(!('runWeeklyMin' in p)){ $('runWeeklyMin').value='';$('recentLongRunMin').value=''; }
  if(!('recentLongBikeMin' in p)&&p.sport==='triathlon')$('recentLongBikeMin').value='';
  document.querySelectorAll('#dayPicker input').forEach(x=>x.checked=(p.days||[]).includes(Number(x.value)));
  if(p.longDay==null)$('longDay').value=(p.days||[]).includes(0)?0:(p.days||[1]).at(-1);
  for(const d of DAY_ORDER)$('cap'+d).value=p.dayMinutes?.[d]??'';
  document.querySelectorAll('#poolDayPicker input').forEach(x=>x.checked=(p.poolDays||DAY_ORDER).includes(Number(x.value)));
  document.querySelectorAll('.equipment').forEach(x=>x.checked=(p.hyroxEquipment||[]).includes(x.value));
  $('poolAccess').checked=p.poolAccess!==false;$('bikeAccess').checked=p.bikeAccess!==false;
  document.querySelectorAll('.redflag').forEach(x=>x.checked=false);
  $('adultConfirmed').checked=false;$('acceptSafety').checked=false;
  sportUI();
}
function openForm(){if(state)populate(state.profile);screen('questionnaire');}
$('startBtn').onclick=()=>{if(state)populate(state.profile);sportUI();screen('questionnaire');};
$('editProfileBtn').onclick=openForm;
document.querySelectorAll('[data-start-sport]').forEach(btn=>btn.onclick=()=>{document.querySelector(`input[name="sport"][value="${btn.dataset.startSport}"]`).checked=true;suggestDays(btn.dataset.startSport);sportUI();screen('questionnaire');});
document.querySelectorAll('input[name="sport"]').forEach(r=>r.onchange=()=>{suggestDays(sport());sportUI();});
$('goalType').onchange=sportUI;
document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>screen(b.dataset.go));
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>$(b.dataset.close).close());
function rebuild(){
  if(!state)return;
  baseResult=E.generatePlan(state.profile);
  currentResult=E.adaptPlan(baseResult.plan,state.feedback,state.profile,E.localToday(),state.hold);
  if(currentResult.hold&&!state.hold){state.hold=true;persist();}
}
$('questionnaire').onsubmit=async e=>{
  e.preventDefault();$('formError').classList.add('hidden');
  try{
    const input=readProfile();
    if(input.hasRedFlag){if(state){state.hold=true;persist();}screen('safety');return;}
    if(input.startDate<E.localToday())throw new Error('La nouvelle preparation doit commencer aujourd\u2019hui ou plus tard.');
    if(state&&!confirm('Le nouveau profil remplacera ce plan et ses bilans. Exporte une sauvegarde JSON avant si tu souhaites conserver cet historique. Continuer ?'))return;
    $('generateBtn').disabled=true;$('generateBtn').textContent='Construction et verification...';
    await new Promise(resolve=>setTimeout(resolve,30));
    const result=E.generatePlan(input);
    const next={schemaVersion:3,id:window.crypto?.randomUUID?.()||'local-'+Date.now(),profile:result.profile,feedback:{},hold:false,revision:1,createdAt:new Date().toISOString()};
    state=next;baseResult=result;currentResult=E.adaptPlan(result.plan,{},result.profile);
    persist();$('resumeBtn').classList.remove('hidden');renderDashboard();screen('dashboard');
  }catch(error){$('formError').textContent=error.message;$('formError').classList.remove('hidden');$('formError').scrollIntoView({behavior:'smooth',block:'center'});}
  finally{$('generateBtn').disabled=false;$('generateBtn').textContent='Generer et verifier le plan';}
};
function renderDashboard(){
  if(!state)return;
  if(!baseResult||!currentResult)rebuild();
  const p=state.profile,weeks=currentResult.weeks;
  $('dashboardSport').textContent='Plan V3 - '+(state.hold?'SUSPENDU':'ebauche a reevaluer');
  $('dashboardTitle').textContent=E.eventConfig(p).name;
  $('dashboardSubtitle').textContent=`${fullDate(p.raceDate)} - ${p.sessionsPerWeek} creneaux demandes / semaine - J-${Math.max(0,E.daysBetween(E.localToday(),p.raceDate))}`;
  const currentWeek=weeks.find(w=>E.localToday()>=w.start&&E.localToday()<=E.dateAdd(w.start,6))||weeks[0];
  const completed=Object.values(state.feedback).filter(f=>f.status==='done').length;
  $('metrics').innerHTML=[[hourText(currentWeek?.minutes||0),'volume de la semaine'],[String(currentWeek?.count||0),'seances cette semaine'],[String(completed),'bilans : seances faites'],[String(baseResult.weeks.length),'semaines, projections incluses']].map(([v,label])=>`<div class="metric card"><strong>${esc(v)}</strong><span>${esc(label)}</span></div>`).join('');
  $('warningsList').innerHTML=baseResult.warnings.map(w=>`<div class="warning-item ${w.severity==='info'?'info':''}">${esc(w.message)}</div>`).join('');
  const selected=$('weekFilter').value;
  $('weekFilter').innerHTML=weeks.map(w=>`<option value="${w.index}">S${w.index} - ${esc(fmtDate(w.start))}</option>`).join('');
  $('weekFilter').value=weeks.some(w=>String(w.index)===selected)?selected:currentWeek?.index||1;
  $('adaptationState').innerHTML=`<p>${esc(currentResult.message)}</p>${state.hold?'<p class="error">Un calendrier deja exporte ne se met pas a jour : supprime ses anciennes seances pour ne plus recevoir leurs consignes.</p>':''}<p>Les seances non renseignees sont marquees "sans bilan", pas automatiquement "ratees". Une note libre n\u2019est pas interpretee.</p><p>Charge indicative = somme (minutes du bloc x effort estime). Ce n\u2019est ni un score de risque ni une mesure physiologique.</p>`;
  renderTimeline();renderNext();renderPlan();updateNotifications();
}
function renderTimeline(){
  const weeks=currentResult.weeks,max=Math.max(1,...weeks.map(w=>w.minutes));
  $('phaseLegend').innerHTML='<span>Vert : entrainement</span><span>Gris : allegee</span><span>Bleu : affutage</span>';
  $('timeline').innerHTML=weeks.map(w=>`<button data-week="${w.index}" data-phase="${esc(w.phase)}" style="height:${Math.max(4,Math.round(w.minutes/max*100))}%" title="S${w.index} - ${esc(E.PHASES[w.phase])} - ${hourText(w.minutes)}" aria-label="Semaine ${w.index}, ${w.minutes} minutes" aria-current="${Number($('weekFilter').value)===w.index}"></button>`).join('');
  $('timeline').querySelectorAll('button').forEach(b=>b.onclick=()=>{$('weekFilter').value=b.dataset.week;renderPlan();renderTimeline();});
}
function summaryHTML(s){return `<span class="session-tag">${esc(E.PHASES[s.phase])}${s.provisional?' - projection':''}</span><h3>${esc(s.title)}</h3><div class="session-meta"><span>${esc(fmtDate(s.date))}</span><span>${s.kind==='race'?'Horaire a confirmer':s.kind==='paused'?'Suspendu':esc(E.timeText(s.durationSec))}</span>${s.swimMeters?`<span>${s.swimMeters} m</span>`:''}</div>`;}
function buttonsHTML(s){const eligible=s.kind==='training'&&s.date<=E.localToday();return `<button class="btn secondary" data-session="${esc(s.id)}">Voir les blocs</button>${eligible?`<button class="btn primary" data-feedback="${esc(s.id)}">Faire le bilan</button>`:''}`;}
function bindSessionButtons(el){el.querySelectorAll('[data-session]').forEach(b=>b.onclick=()=>openSession(b.dataset.session));el.querySelectorAll('[data-feedback]').forEach(b=>b.onclick=()=>openFeedback(b.dataset.feedback));}
function renderNext(){
  const s=currentResult.plan.find(s=>s.date>=E.localToday()&&!['done','missed'].includes(s.status));
  if(!s){$('nextSession').innerHTML='<p>Aucune seance future. Cree une nouvelle preparation apres un bilan.</p>';return;}
  const preview=s.kind==='paused'?s.detail:s.kind==='race'?s.detail:`${s.blocks.length} blocs calcules. Duree et recuperations incluses${s.adapted?' ; contenu recalcule':''}.`;
  $('nextSession').innerHTML=summaryHTML(s)+`<p class="session-preview">${esc(preview)}</p><div class="session-actions">${buttonsHTML(s)}</div>`;bindSessionButtons($('nextSession'));
}
function renderPlan(){
  const wi=Number($('weekFilter').value),week=currentResult.weeks.find(w=>w.index===wi);if(!week)return;
  $('weekSummary').textContent=`${E.PHASES[week.phase]} - ${hourText(week.minutes)} | Course ${week.runMinutes} min | Velo ${week.bikeMinutes} min | Nage ${week.swimMeters} m | Force/mobilite ${week.strengthMinutes} min. Efforts >= 6/10 : ${week.hardMinutes} min. Indice de charge estime : ${week.load}.`;
  const rows=[];
  for(let i=0;i<7;i++){
    const date=E.dateAdd(week.start,i);if(date<state.profile.startDate||date>state.profile.raceDate)continue;
    const s=currentResult.plan.find(s=>s.date===date);
    if(!s){rows.push(`<div class="session-row rest-row"><div class="session-date"><strong>${DAY_NAMES[E.weekday(date)].slice(0,3)}</strong><span>${esc(fmtDate(date))}</span></div><div class="session-info"><strong>Repos / aucune seance programmee</strong><span>Pas de rattrapage automatique.</span></div></div>`);continue;}
    const status={done:'faite',missed:'ratee',unlogged:'sans bilan',paused:'suspendue',planned:s.provisional?'projection':'prevue'}[s.status]||'prevue';
    rows.push(`<div class="session-row ${esc(s.status)}"><div class="session-date"><strong>${DAY_NAMES[E.weekday(date)].slice(0,3)}</strong><span>${esc(fmtDate(date))}</span></div><div class="session-info"><strong>${esc(s.title)}</strong><span>${s.kind==='race'?'Jour J - horaire non defini':esc(E.timeText(s.durationSec))}${s.swimMeters?' - '+s.swimMeters+' m':''}${s.adapted?' - adaptee':''}</span><span class="status-pill ${esc(s.status)}">${esc(status)}</span></div><div class="row-actions">${buttonsHTML(s)}</div></div>`);
  }
  $('planList').innerHTML=rows.join('');bindSessionButtons($('planList'));
}
$('weekFilter').onchange=()=>{renderPlan();renderTimeline();};
function openSession(id){
  const s=currentResult.plan.find(s=>s.id===id);if(!s)return;$('sessionTitle').textContent=s.title;
  $('sessionContent').innerHTML=`<p>${esc(fmtDate(s.date))} - ${s.kind==='race'?'Journee de competition':esc(E.timeText(s.durationSec))}${s.swimMeters?' - '+s.swimMeters+' m':''}</p>`+
    (s.blocks.length?`<div class="block-list">${s.blocks.map(b=>`<div class="workout-block"><strong>${esc(E.timeText(b.seconds))}</strong><span>${esc(b.label)}<small>Effort ${b.rpe}/10${b.distanceM?' - '+b.distanceM+' m':''}</small></span></div>`).join('')}</div>`:'')+
    `<details ${s.blocks.length?'':'open'}><summary>Consignes completes / contenu exporte</summary><div class="session-notes">${esc(s.detail)}</div></details><p class="helper">RPE = effort ressenti de 1 (tres facile) a 10 (maximal). Pas d\u2019effort maximal prescrit.</p>`;
  $('sessionDialog').showModal();
}
function openFeedback(id){
  const s=currentResult.plan.find(s=>s.id===id);if(!s||s.date>E.localToday()||s.kind!=='training')return;
  const f=state.feedback[id];$('feedbackSessionId').value=id;$('feedbackTitle').textContent=s.title;
  $('feedbackStatus').value=f?.status||'done';$('actualMinutes').value=f?.actualMinutes??Math.round(s.minutes);
  $('feedbackDifficulty').value=f?.difficulty||3;$('feedbackFatigue').value=f?.fatigue||3;$('feedbackPain').checked=!!f?.pain;$('feedbackIllness').checked=!!f?.illness;$('feedbackNote').value=f?.note||'';$('feedbackDialog').showModal();
}
$('feedbackStatus').onchange=()=>{if($('feedbackStatus').value==='missed')$('actualMinutes').value=0;};
$('feedbackForm').onsubmit=e=>{
  e.preventDefault();const id=$('feedbackSessionId').value,source=baseResult.plan.find(s=>s.id===id);if(!source||source.date>E.localToday())return;
  const status=$('feedbackStatus').value,actual=status==='missed'?0:Number($('actualMinutes').value);
  if(status==='done'&&actual<=0){toast('Renseigne le temps effectif ou choisis "ratee".');return;}
  state.feedback[id]={status,actualMinutes:actual,difficulty:Number($('feedbackDifficulty').value),fatigue:Number($('feedbackFatigue').value),pain:$('feedbackPain').checked,illness:$('feedbackIllness').checked,note:$('feedbackNote').value.trim().slice(0,1000),at:new Date().toISOString()};
  if(state.feedback[id].pain||state.feedback[id].illness)state.hold=true;
  state.revision++;persist();rebuild();$('feedbackDialog').close();renderDashboard();toast(state.hold?'Plan suspendu. Aucune reprise automatique.':'Bilan enregistre. Les blocs ont ete reevalues.');
};
$('pauseBtn').onclick=()=>{if(!state)return;if(confirm('Suspendre les prochaines seances et le jour J ? La reprise necessitera de revoir ton profil, pas une date automatique.')){state.hold=true;state.revision++;persist();rebuild();renderDashboard();}};
$('backupBtn').onclick=()=>{if(state)download(JSON.stringify({...state,exportedAt:new Date().toISOString()},null,2),'runprep-v3-sauvegarde-privee.json','application/json;charset=utf-8');};
$('calendarExportBtn').onclick=()=>{
  if(!state)return;
  if(!confirm('Le calendrier importe ne se synchronise pas ensuite. Importe dans un calendrier RunPrep separe ; apres une adaptation, supprime l\u2019ancien calendrier avant de reimporter pour eviter les doublons. Les rappels dependent des reglages de ton agenda. Continuer ?'))return;
  const content=C.exportICS(currentResult.plan,state.profile,{namespace:state.id,revision:state.revision});download(content,'runprep-v3-calendrier.ics','text/calendar;charset=utf-8');toast('Calendrier exporte. Les seances suspendues ne sont pas incluses.');
};
$('resetBtn').onclick=()=>{if(!confirm('Effacer profil et bilans RunPrep de ce navigateur, y compris les anciennes versions ? Cette action ne supprime pas les evenements deja importes dans ton agenda.'))return;
  try{for(const k of [STORAGE_KEY,OLD_KEY,'runprep_v1'])localStorage.removeItem(k);}catch{}
  state=null;baseResult=null;currentResult=null;legacy=null;$('resumeBtn').classList.add('hidden');$('migrationBanner').classList.add('hidden');screen('welcome');};
function validateSaved(data){
  if(data?.schemaVersion!==3||!data.profile)throw new Error('Fichier non reconnu : une sauvegarde JSON V3 est necessaire.');
  const profile=E.normalizeProfile(data.profile),result=E.generatePlan(profile),ids=new Set(result.plan.map(s=>s.id)),feedback={};
  for(const [id,f] of Object.entries(data.feedback||{})){
    if(!ids.has(id))continue;
    if(!['done','missed'].includes(f.status)||![1,2,3,4,5].includes(f.difficulty)||![1,2,3,4,5].includes(f.fatigue))throw new Error('Bilan invalide dans la sauvegarde.');
    if(!Number.isFinite(f.actualMinutes)||f.actualMinutes<0||f.actualMinutes>600)throw new Error('Duree effective invalide dans la sauvegarde.');
    feedback[id]={status:f.status,actualMinutes:f.actualMinutes,difficulty:f.difficulty,fatigue:f.fatigue,pain:!!f.pain,illness:!!f.illness,note:String(f.note||'').slice(0,1000),at:typeof f.at==='string'?f.at:''};
  }
  return {schemaVersion:3,id:String(data.id||'local-'+Date.now()).replace(/[^a-zA-Z0-9-]/g,'').slice(0,80),profile,feedback,hold:!!data.hold,revision:Number.isInteger(data.revision)?Math.max(0,data.revision):0,createdAt:data.createdAt||new Date().toISOString()};
}
$('importBtn').onclick=()=>$('importFile').click();
$('importFile').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>2000000)throw new Error('Sauvegarde trop volumineuse (limite 2 Mo).');const validated=validateSaved(JSON.parse(await file.text()));if(state&&!confirm('Remplacer les donnees locales par cette sauvegarde ?'))return;state=validated;persist();rebuild();$('resumeBtn').classList.remove('hidden');renderDashboard();screen('dashboard');}catch(error){toast('Import refuse : '+error.message);}finally{e.target.value='';}};
$('migrateBtn').onclick=()=>{populate(legacy.profile);toast('V2 : renseigne les volumes en minutes et reconfirme le format des chronos.');screen('questionnaire');};
$('resumeBtn').onclick=()=>{rebuild();renderDashboard();screen('dashboard');};
async function requestNotifications(){
  if(!window.isSecureContext||!('Notification' in window)){toast('Notifications indisponibles ici. Sur iPhone compatible : installer sur l\u2019ecran d\u2019accueil, puis ouvrir l\u2019app. Sinon utiliser le calendrier.');return;}
  if(Notification.permission==='denied'){toast('Autorisation bloquee : modifier les reglages de ce site dans le navigateur.');return;}
  try{await Notification.requestPermission();updateNotifications();toast(Notification.permission==='granted'?'Autorisation accordee. Rappels dans l\u2019app active uniquement.':'Autorisation non accordee.');}catch{toast('La demande n\u2019a pas abouti. Utilise le calendrier.');}
}
function updateNotifications(){
  const granted='Notification' in window&&Notification.permission==='granted';
  $('notifBtn').textContent=granted?'Notifications autorisees':'Activer les notifications';
  $('notificationTitle').textContent=granted?'Notifications autorisees - app active uniquement':'Pense a activer les notifications';
  $('bannerNotifBtn').classList.toggle('hidden',granted);
}
$('notifBtn').onclick=requestNotifications;$('bannerNotifBtn').onclick=requestNotifications;
async function maybeNotify(){
  if(!state||state.hold||!currentResult||!('Notification' in window)||Notification.permission!=='granted')return;
  const today=E.localToday(),s=currentResult.plan.find(s=>s.date===today&&s.kind==='training'&&s.status==='planned');if(!s)return;
  const due=new Date(today+'T'+state.profile.reminderTime+':00'),delta=(due-Date.now())/60000;
  if(delta<0||delta>30)return;
  const key='runprep_v3_notified_'+s.id;try{if(localStorage.getItem(key))return;}catch{}
  try{const reg=await navigator.serviceWorker?.getRegistration();const options={body:s.title+' - '+E.timeText(s.durationSec),icon:'icons/icon-192.png',tag:s.id};if(reg)await reg.showNotification('Seance RunPrep dans moins de 30 minutes',options);else new Notification('Seance RunPrep',options);try{localStorage.setItem(key,'1');}catch{}}
  catch{/* Browser may disallow notifications; do not pretend delivery succeeded. */}
}
setInterval(maybeNotify,60000);
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstallPrompt=e;$('installBtn').classList.remove('hidden');});
$('installBtn').onclick=async()=>{if(deferredInstallPrompt){await deferredInstallPrompt.prompt();deferredInstallPrompt=null;$('installBtn').classList.add('hidden');}};
if('serviceWorker' in navigator&&window.isSecureContext){window.addEventListener('load',async()=>{try{const reg=await navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'});reg.update();}catch{toast('Mode hors ligne indisponible. Le site reste utilisable en ligne.');}});}
try{const saved=localStorage.getItem(STORAGE_KEY);if(saved){state=validateSaved(JSON.parse(saved));$('resumeBtn').classList.remove('hidden');}else{legacy=JSON.parse(localStorage.getItem(OLD_KEY)||'null');if(legacy?.profile)$('migrationBanner').classList.remove('hidden');}}
catch(error){toast('Donnees locales non chargees : '+error.message+'. Elles n\u2019ont pas ete effacees.');}
sportUI();updateNotifications();
