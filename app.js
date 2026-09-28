'use strict';
const E=window.RunPrepEngine,C=window.RunPrepCalendar,$=id=>document.getElementById(id);
const STORAGE='triprep_personal_v1';
const DAYS={1:'Lun',2:'Mar',3:'Mer',4:'Jeu',5:'Ven',6:'Sam',0:'Dim'};
const ORDER=[1,2,3,4,5,6,0];
let state=null,result=null;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=s=>new Intl.DateTimeFormat('fr-FR',{weekday:'short',day:'numeric',month:'short'}).format(new Date(s+'T12:00:00'));
function show(id){document.querySelectorAll('.screen').forEach(x=>x.classList.toggle('active',x.id===id));scrollTo({top:0,behavior:'smooth'});}function toast(t){$('toast').textContent=t;$('toast').classList.remove('hidden');setTimeout(()=>$('toast').classList.add('hidden'),3500)}
function download(content,name,type){const u=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1500)}
function buildDays(){
  $('dayPicker').innerHTML=ORDER.map(d=>`<label><input type="checkbox" value="${d}" ${[2,3,5,6,0].includes(d)?'checked':''}>${DAYS[d]}</label>`).join('');
  $('longDay').innerHTML=ORDER.map(d=>`<option value="${d}" ${d===6?'selected':''}>${DAYS[d]}</option>`).join('');
}
buildDays();
$('raceDate').min=E.dateAdd(E.localToday(),14);$('raceDate').value=E.dateAdd(E.localToday(),168);
function profile(){
  const days=[...document.querySelectorAll('#dayPicker input:checked')].map(x=>Number(x.value));
  return {
    sport:'triathlon',startDate:E.localToday(),raceDate:$('raceDate').value,triDistance:$('triDistance').value,
    hasRedFlag:$('redFlag').checked,adultConfirmed:$('adultConfirmed').checked,poolAccess:true,bikeAccess:true,
    sessionsPerWeek:Number($('sessionsPerWeek').value),days,longDay:Number($('longDay').value),
    maxSessionMin:Number($('maxSessionMin').value),longSessionMin:Number($('longSessionMin').value),weeklyHoursCap:Number($('weeklyHoursCap').value),
    maxRunMin:Number($('maxRunMin').value),maxBikeMin:Number($('maxBikeMin').value),maxSwimMin:Number($('maxSwimMin').value),maxStrengthMin:45,
    runWeeklyMin:Number($('runWeeklyMin').value),recentLongRunMin:Number($('recentLongRunMin').value),bikeWeeklyHours:Number($('bikeWeeklyHours').value),recentLongBikeMin:Number($('recentLongBikeMin').value),swimWeeklyM:Number($('swimWeeklyM').value),
    triTime5k:$('time5k').value.trim(),easyPace:$('easyPace').value.trim(),swimPace:$('swimPace').value.trim(),
    poolDays:days.slice(),sleepHours:Number($('sleepHours').value),stress:Number($('stress').value),experience:1,reminderTime:$('reminderTime').value,
    goalType:'finish',goalTime:'',dayMinutes:{},strengthSessions:0,recentStrengthMin:0
  };
}
function populate(p){
  if(!p)return;
  for(const k of ['raceDate','triDistance','runWeeklyMin','recentLongRunMin','bikeWeeklyHours','recentLongBikeMin','swimWeeklyM','triTime5k','easyPace','swimPace','sessionsPerWeek','maxSessionMin','longSessionMin','longDay','weeklyHoursCap','maxRunMin','maxBikeMin','maxSwimMin','sleepHours','stress','reminderTime']){
    const el=$(k==='triTime5k'?'time5k':k); if(el&&p[k]!=null)el.value=p[k];
  }
  document.querySelectorAll('#dayPicker input').forEach(x=>x.checked=(p.days||[]).includes(Number(x.value)));
  $('adultConfirmed').checked=false;$('redFlag').checked=false;
}
function save(){localStorage.setItem(STORAGE,JSON.stringify(state));}
function rebuild(){result=E.generatePlan(state.profile);}
$('setupForm').onsubmit=e=>{
  e.preventDefault();$('formError').classList.add('hidden');
  try{
    const p=profile();
    if(p.hasRedFlag)throw new Error('Le plan est suspendu tant qu’un signal d’alerte est présent. Fais d’abord évaluer la situation avant de reprendre.');
    const generated=E.generatePlan(p);
    state={profile:generated.profile,createdAt:new Date().toISOString()};result=generated;save();render();show('dashboardScreen');
  }catch(err){$('formError').textContent=err.message;$('formError').classList.remove('hidden');}
};
function currentWeekIndex(){
  const today=E.localToday();let i=result.weeks.findIndex(w=>today>=w.start&&today<=E.dateAdd(w.start,6));return i<0?0:i;
}
function render(){
  const p=state.profile,f=E.eventConfig(p);$('raceTypeLabel').textContent=f.name;$('raceTitle').textContent='Ma préparation triathlon';
  $('raceMeta').textContent=`Jour J : ${new Intl.DateTimeFormat('fr-FR',{day:'numeric',month:'long',year:'numeric'}).format(new Date(p.raceDate+'T12:00:00'))}`;
  $('weekSelect').innerHTML=result.weeks.map((w,i)=>`<option value="${i}">Semaine ${i+1} · ${w.phase}</option>`).join('');$('weekSelect').value=String(currentWeekIndex());
  const warns=(result.warnings||[]).map(w=>w.message||w.text||String(w));
  if(warns.length){$('warningBox').innerHTML='<strong>À vérifier avant de suivre le plan :</strong><br>'+warns.map(esc).join('<br>');$('warningBox').classList.remove('hidden')}else $('warningBox').classList.add('hidden');
  renderWeek();
}
function renderWeek(){
  const idx=Number($('weekSelect').value),w=result.weeks[idx];if(!w)return;
  $('weekTitle').textContent=`Semaine ${idx+1} · ${w.phase}`;
  const sessions=result.plan.filter(s=>s.weekStart===w.start&&s.kind!=='rest'&&s.kind!=='paused');
  const mins=Math.round(sessions.reduce((a,s)=>a+(s.minutes||0),0));
  const swim=sessions.reduce((a,s)=>a+(s.swimMeters||0),0);
  $('weekSummary').textContent=`${sessions.filter(s=>s.kind==='training').length} séances · ${Math.floor(mins/60)} h ${mins%60} · ${swim?swim+' m de natation':''}`;
  $('sessionList').innerHTML=sessions.map(s=>{
    const meta=s.kind==='race'?'Jour J':`${E.timeText(s.durationSec)}${s.swimMeters?' · '+s.swimMeters+' m':''}`;
    return `<article class="session" data-id="${esc(s.id)}"><div class="date">${esc(fmt(s.date))}</div><div><div class="title">${esc(s.title)}</div><div class="meta">${esc(meta)}</div></div><span class="badge">${esc(s.phase==='race'?'Course':s.discipline||'Triathlon')}</span></article>`;
  }).join('')||'<p class="hint">Aucune séance cette semaine.</p>';
  document.querySelectorAll('.session[data-id]').forEach(x=>x.onclick=()=>openSession(x.dataset.id));
}
function openSession(id){
  const s=result.plan.find(x=>x.id===id);if(!s)return;
  $('sessionDate').textContent=fmt(s.date);$('sessionTitle').textContent=s.title;$('sessionIntro').textContent=s.kind==='race'?'Jour de compétition. Vérifie les horaires et consignes de l’organisateur.':`${E.timeText(s.durationSec)}${s.swimMeters?' · '+s.swimMeters+' m':''}`;
  $('sessionBlocks').innerHTML=(s.blocks||[]).map(b=>`<div class="block"><strong>${esc(E.timeText(b.seconds))}</strong><div>${esc(b.label)}<small>RPE ${esc(b.rpe)}/10${b.distanceM?' · '+esc(b.distanceM)+' m':''}</small></div></div>`).join('');
  $('sessionDetail').textContent=s.detail||'';$('sessionDialog').showModal();
}
$('closeSession').onclick=()=>$('sessionDialog').close();$('weekSelect').onchange=renderWeek;
$('editBtn').onclick=()=>{populate(state.profile);show('setupScreen')};
$('calendarBtn').onclick=()=>{const ics=C.exportICS(result.plan,state.profile,{namespace:'triprep-personal',revision:1});download(ics,'triprep-calendrier.ics','text/calendar;charset=utf-8');toast('Calendrier exporté.');};
$('resetBtn').onclick=()=>{if(confirm('Effacer ce plan de cet appareil ?')){localStorage.removeItem(STORAGE);state=null;result=null;show('setupScreen')}};
$('notifBtn').onclick=async()=>{if(!('Notification'in window)){toast('Notifications non prises en charge ici. Utilise l’export calendrier.');return}try{const p=await Notification.requestPermission();toast(p==='granted'?'Notifications autorisées.':'Autorisation non accordée.')}catch{toast('Impossible de demander l’autorisation ici.')}};
try{const saved=JSON.parse(localStorage.getItem(STORAGE)||'null');if(saved?.profile){state=saved;rebuild();render();show('dashboardScreen')}}catch{}
if('serviceWorker'in navigator&&location.protocol!=='file:')navigator.serviceWorker.register('./sw.js').catch(()=>{});
