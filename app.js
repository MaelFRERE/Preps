const KEY='triplan70_data_v1';
const startPlan = new Date('2026-10-12T12:00:00');

function iso(d){ return d.toISOString().slice(0,10); }
function addDays(d,n){ const x=new Date(d); x.setDate(x.getDate()+n); return x; }
function mondayOf(d){ const x=new Date(d); const day=(x.getDay()+6)%7; x.setDate(x.getDate()-day); x.setHours(12,0,0,0); return x; }
function fmtDate(d){ return d.toLocaleDateString('fr-FR',{day:'2-digit',month:'short'}); }
function weekLabel(m){ const s=mondayOf(m), e=addDays(s,6); return `${fmtDate(s)} – ${fmtDate(e)}`; }

function defaultData(){
  const sessions=[];
  const weeks=[
    {run1:50,swim1:45,bike:60,run2:50,swim2:45,sat:90,quality:'5 × 3 min soutenues, récup 2 min'},
    {run1:55,swim1:50,bike:70,run2:55,swim2:50,sat:null,quality:'20–25 min tempo contrôlé'},
    {run1:60,swim1:55,bike:75,run2:60,swim2:55,sat:100,quality:'6 × 3 min soutenues, récup 2 min'},
    {run1:45,swim1:45,bike:60,run2:50,swim2:45,sat:null,quality:'Facile + 6 accélérations de 20 s'}
  ];
  weeks.forEach((w,wi)=>{
    const base=addDays(startPlan, wi*7);
    const add=(day,sport,title,duration,notes,distance='')=>sessions.push({
      id:crypto.randomUUID(),date:iso(addDays(base,day)),sport,title,duration,distance,notes,
      rating:null,comment:'',completed:false,adjusted:false
    });
    add(0,'Course','Endurance fondamentale',w.run1,'Rester facile, autour de 6:20–6:45/km et ~135–145 bpm.');
    add(1,'Natation','Technique crawl',w.swim1,'Respiration, position, relâchement. Priorité à la technique.');
    add(2,'Vélo','Endurance vélo',w.bike,'Effort confortable, cadence souple. Ne pas chasser la vitesse moyenne.');
    add(3,'Course','Séance qualité',w.run2,`15 min faciles · ${w.quality} · retour au calme.`);
    add(4,'Natation','Endurance + technique',w.swim2,'Nage facile, éducatifs puis blocs continus adaptés au niveau.');
    if(w.sat) add(5,'Vélo','Sortie longue',w.sat,'Endurance facile à modérée. Hydratation régulière.');
  });
  return {sessions, created:new Date().toISOString()};
}
function load(){ try{return JSON.parse(localStorage.getItem(KEY))||defaultData()}catch(e){return defaultData()} }
let data=load();
function save(){localStorage.setItem(KEY,JSON.stringify(data));}

let currentMonday=mondayOf(startPlan);
const weekGrid=document.getElementById('weekGrid'), weekTitle=document.getElementById('weekTitle');

function sessionCard(s){
  const div=document.createElement('div'); div.className='session'+(s.completed?' done':'');
  const adj=s.adjusted?' · ajustée +5%':'';
  div.innerHTML=`<div class="sport">${s.sport}</div><h3>${s.title}</h3>
    <div class="meta">${s.duration||0} min${s.distance?` · ${s.distance}`:''}${adj}<br>${s.notes||''}</div>`;
  if(!s.completed){
    const a=document.createElement('div'); a.className='actions';
    const b=document.createElement('button'); b.className='chip normal'; b.textContent='Terminer + noter'; b.onclick=()=>openFeedback(s.id);
    a.appendChild(b); div.appendChild(a);
  }else{
    const map={easy:'Facile',normal:'Normal',hard:'Difficile'};
    const st=document.createElement('div'); st.className='status'; st.textContent=`✓ ${map[s.rating]||'Terminée'}${s.comment?' · '+s.comment:''}`; div.appendChild(st);
  }
  return div;
}

function renderWeek(){
  weekTitle.textContent=weekLabel(currentMonday); weekGrid.innerHTML='';
  const today=iso(new Date());
  for(let i=0;i<7;i++){
    const d=addDays(currentMonday,i), ds=iso(d);
    const box=document.createElement('div'); box.className='day'+(ds===today?' today':'');
    box.innerHTML=`<div class="dayhead"><div class="dow">${d.toLocaleDateString('fr-FR',{weekday:'short'}).replace('.','')}</div><div class="date">${fmtDate(d)}</div></div>`;
    const list=data.sessions.filter(s=>s.date===ds).sort((a,b)=>a.sport.localeCompare(b.sport));
    if(!list.length){ const e=document.createElement('div');e.className='empty';e.textContent='Repos / aucune séance';box.appendChild(e); }
    list.forEach(s=>box.appendChild(sessionCard(s)));
    weekGrid.appendChild(box);
  }
}
document.getElementById('prevWeek').onclick=()=>{currentMonday=addDays(currentMonday,-7);renderWeek()};
document.getElementById('nextWeek').onclick=()=>{currentMonday=addDays(currentMonday,7);renderWeek()};

document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{
  document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active')); b.classList.add('active');
  document.querySelectorAll('.screen').forEach(x=>x.classList.remove('active')); document.getElementById(b.dataset.screen).classList.add('active');
  if(b.dataset.screen==='details')renderStats();
  if(b.dataset.screen==='plan')renderFuture();
});

let feedbackId=null;
function openFeedback(id){
  feedbackId=id; const s=data.sessions.find(x=>x.id===id);
  document.getElementById('modalTitle').textContent=s.title;
  document.getElementById('mRating').value='easy';document.getElementById('mComment').value='';
  document.getElementById('feedbackModal').classList.add('show');
}
document.getElementById('cancelModal').onclick=()=>document.getElementById('feedbackModal').classList.remove('show');

function adjustNextSameSport(s){
  const next=data.sessions
    .filter(x=>x.sport===s.sport && x.date>s.date && !x.completed)
    .sort((a,b)=>a.date.localeCompare(b.date))[0];
  if(next && !next.adjusted){
    next.duration=Math.max(1,Math.round(next.duration*1.05));
    if(next.distance) next.distance=Math.round(Number(next.distance)*1.05*10)/10;
    next.adjusted=true;
  }
}
document.getElementById('saveFeedback').onclick=()=>{
  const s=data.sessions.find(x=>x.id===feedbackId); if(!s)return;
  s.completed=true;s.rating=document.getElementById('mRating').value;s.comment=document.getElementById('mComment').value.trim();
  if(s.rating==='easy')adjustNextSameSport(s);
  save();document.getElementById('feedbackModal').classList.remove('show');renderWeek();
};

document.getElementById('addSession').onclick=()=>{
  const date=document.getElementById('fDate').value;
  const sport=document.getElementById('fSport').value;
  const duration=Number(document.getElementById('fDuration').value||0);
  if(!date||!duration){alert('Ajoute au minimum une date et une durée.');return}
  data.sessions.push({
    id:crypto.randomUUID(),date,sport,duration,
    distance:document.getElementById('fDistance').value,
    title:document.getElementById('fTitle').value.trim()||`Séance ${sport.toLowerCase()}`,
    notes:document.getElementById('fNotes').value.trim(),rating:null,comment:'',completed:false,adjusted:false
  });
  save();renderFuture();alert('Séance ajoutée.');
};
document.getElementById('fDate').value=iso(startPlan);

function renderFuture(){
  const el=document.getElementById('futureList');el.innerHTML='';
  const today=iso(new Date());
  const arr=data.sessions.filter(s=>s.date>=today && !s.completed).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,20);
  if(!arr.length){el.innerHTML='<div class="hint">Aucune séance future.</div>';return}
  arr.forEach(s=>{
    const d=document.createElement('div');d.className='future-item';
    d.innerHTML=`<div><strong>${new Date(s.date+'T12:00:00').toLocaleDateString('fr-FR',{weekday:'short',day:'2-digit',month:'short'})}</strong> · ${s.sport}<br><span class="hint">${s.title}</span></div><div><strong>${s.duration} min</strong></div>`;
    el.appendChild(d);
  });
}

function renderStats(){
  const done=data.sessions.filter(s=>s.completed);
  const mins=done.reduce((a,s)=>a+(Number(s.duration)||0),0);
  const easy=done.filter(s=>s.rating==='easy').length;
  document.getElementById('statDone').textContent=done.length;
  document.getElementById('statMinutes').textContent=mins+' min';
  document.getElementById('statEasy').textContent=(done.length?Math.round(easy/done.length*100):0)+'%';
  const weekSet=new Set(done.map(s=>iso(mondayOf(new Date(s.date+'T12:00:00')))));
  document.getElementById('statStreak').textContent=weekSet.size;
  const planned=Math.max(1,data.sessions.filter(s=>new Date(s.date)>=startPlan).length);
  const pct=Math.min(100,Math.round(done.length/planned*100));
  document.getElementById('goalBar').style.width=pct+'%';document.getElementById('goalPct').textContent=pct+'%';
  drawChart();
}
function drawChart(){
  const c=document.getElementById('volumeChart'),ctx=c.getContext('2d');ctx.clearRect(0,0,c.width,c.height);
  const groups={};
  data.sessions.filter(s=>s.completed).forEach(s=>{const k=iso(mondayOf(new Date(s.date+'T12:00:00')));groups[k]=(groups[k]||0)+Number(s.duration||0)});
  const keys=Object.keys(groups).sort().slice(-8), vals=keys.map(k=>groups[k]);
  const max=Math.max(60,...vals), pad=50, w=(c.width-pad*2)/Math.max(1,keys.length);
  ctx.fillStyle='#a9b3c7';ctx.font='20px sans-serif';ctx.fillText('Minutes',15,28);
  keys.forEach((k,i)=>{
    const h=(vals[i]/max)*(c.height-90),x=pad+i*w+10,y=c.height-45-h;
    ctx.fillStyle='#6ea8fe';ctx.fillRect(x,y,Math.max(20,w-20),h);
    ctx.fillStyle='#f5f7fb';ctx.font='18px sans-serif';ctx.fillText(vals[i],x,y-8);
    ctx.fillStyle='#a9b3c7';ctx.font='15px sans-serif';ctx.fillText(new Date(k+'T12:00:00').toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit'}),x,c.height-18);
  });
}
renderWeek();renderFuture();
