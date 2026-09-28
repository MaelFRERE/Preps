const STORAGE_KEY = 'runprep_multisport_v2';
const LEGACY_KEY = 'runprep_v1';
const $ = (id) => document.getElementById(id);
const screens = [...document.querySelectorAll('.screen')];
let deferredInstallPrompt = null;

function emptyState(){ return { profile:null, plan:[], feedback:{}, adaptations:[], createdAt:null }; }
function loadState(){
  try {
    const current = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if(current) return current;
    const legacy = JSON.parse(localStorage.getItem(LEGACY_KEY));
    if(legacy?.profile){
      legacy.profile.sport = 'running';
      legacy.plan = (legacy.plan||[]).map(s=>({
        ...s,
        discipline:'Course',
        intensity:s.type==='race'?'race':['tempo','interval','racepace'].includes(s.type)?'hard':'easy'
      }));
      return legacy;
    }
  } catch {}
  return null;
}
let state = loadState() || emptyState();

function saveState(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); refreshResume(); }
function cap(s){ return s.charAt(0).toUpperCase()+s.slice(1); }
function showScreen(name){ screens.forEach(s=>s.classList.remove('active')); $('screen'+cap(name)).classList.add('active'); window.scrollTo({top:0,behavior:'smooth'}); }
function pad(n){ return String(n).padStart(2,'0'); }
function isoDate(d){ const x=new Date(d); return `${x.getFullYear()}-${pad(x.getMonth()+1)}-${pad(x.getDate())}`; }
function startOfDay(d){ const x=new Date(d); x.setHours(0,0,0,0); return x; }
function addDays(d,n){ const x=new Date(d); x.setDate(x.getDate()+n); return x; }
function daysBetween(a,b){ return Math.ceil((startOfDay(b)-startOfDay(a))/86400000); }
function formatDate(d){ return new Intl.DateTimeFormat('fr-FR',{weekday:'short',day:'numeric',month:'short'}).format(new Date(d+'T12:00:00')); }
function fullDate(d){ return new Intl.DateTimeFormat('fr-FR',{day:'numeric',month:'long',year:'numeric'}).format(new Date(d)); }
function clamp(v,min,max){ return Math.max(min,Math.min(max,v)); }
function toast(msg){ const t=$('toast'); t.textContent=msg; t.classList.remove('hidden'); setTimeout(()=>t.classList.add('hidden'),2800); }
function parseTimeString(v){ if(!v) return null; const p=v.trim().split(':').map(Number); if(p.some(Number.isNaN)) return null; if(p.length===2) return p[0]*3600+p[1]*60; if(p.length===3) return p[0]*3600+p[1]*60+p[2]; return null; }
function secPerKm(totalSec,km){ return totalSec && km ? totalSec/km : null; }
function paceText(sec){ if(!sec) return 'à l’effort'; const s=Math.round(sec); return `${Math.floor(s/60)}:${pad(s%60)}/km`; }
function sportLabel(s){ return s==='triathlon'?'Triathlon':s==='hyrox'?'HYROX':'Course à pied'; }
function phaseLabel(p){ return ({base:'Base',build:'Développement',specific:'Spécifique',taper:'Affûtage',race:'Course'})[p] || p; }

function refreshResume(){ $('resumeBtn').classList.toggle('hidden', !state?.profile || !state?.plan?.length); }
refreshResume();

const defaultRace=addDays(new Date(),70);
$('raceDate').value=isoDate(defaultRace);
$('raceDate').min=isoDate(addDays(new Date(),7));

function selectedSport(){ return document.querySelector('input[name="sport"]:checked')?.value || 'running'; }
function updateSportUI(){
  const sport=selectedSport();
  document.querySelectorAll('.sport-specific').forEach(el=>el.classList.add('hidden'));
  if(sport==='running'){ $('runningGoal').classList.remove('hidden'); $('runningLevel').classList.remove('hidden'); }
  if(sport==='triathlon'){ $('triathlonGoal').classList.remove('hidden'); $('triathlonLevel').classList.remove('hidden'); }
  if(sport==='hyrox'){ $('hyroxGoal').classList.remove('hidden'); $('hyroxLevel').classList.remove('hidden'); $('hyroxEquipmentCard').classList.remove('hidden'); }
  const suggested = sport==='running' ? 3 : sport==='triathlon' ? 5 : 4;
  if(!state.profile || state.profile.sport!==sport) $('sessionsPerWeek').value=String(suggested);
}
document.querySelectorAll('input[name="sport"]').forEach(r=>r.addEventListener('change',updateSportUI));
$('raceType').addEventListener('change',e=>$('customDistanceWrap').classList.toggle('hidden',e.target.value!=='custom'));
$('goalType').addEventListener('change',e=>$('goalTimeWrap').classList.toggle('hidden',e.target.value!=='time'));
$('startBtn').onclick=()=>{ updateSportUI(); showScreen('questionnaire'); };
document.querySelectorAll('[data-start-sport]').forEach(btn=>btn.onclick=()=>{
  const radio=document.querySelector(`input[name="sport"][value="${btn.dataset.startSport}"]`); if(radio) radio.checked=true;
  updateSportUI(); showScreen('questionnaire');
});
$('resumeBtn').onclick=()=>{ renderDashboard(); showScreen('dashboard'); };
$('editProfileBtn').onclick=()=>{ populateForm(state.profile); showScreen('questionnaire'); };
document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>showScreen(b.dataset.go));

function getSelectedDays(){ return [...document.querySelectorAll('#dayPicker input:checked')].map(x=>Number(x.value)); }
function getHyroxEquipment(){ return [...document.querySelectorAll('.hyrox-equipment:checked')].map(x=>x.value); }
function getRaceDistance(){ return $('raceType').value==='custom' ? Number($('customDistance').value) : Number($('raceType').value); }

$('questionnaire').addEventListener('submit',(e)=>{
  e.preventDefault();
  const sport=selectedSport();
  const days=getSelectedDays();
  const sessions=Number($('sessionsPerWeek').value);
  const error=$('formError'); error.classList.add('hidden');
  if(days.length < sessions){ error.textContent=`Choisis au moins ${sessions} jours disponibles.`; error.classList.remove('hidden'); return; }
  const raceDate=new Date($('raceDate').value+'T12:00:00');
  if(daysBetween(new Date(),raceDate)<7){ error.textContent='Choisis une compétition dans au moins 7 jours.'; error.classList.remove('hidden'); return; }
  if(sport==='triathlon' && sessions<3){ error.textContent='Pour le triathlon, choisis au moins 3 séances par semaine afin de couvrir les trois disciplines.'; error.classList.remove('hidden'); return; }
  if(sport==='hyrox' && sessions<3){ error.textContent='Pour HYROX, choisis au moins 3 séances par semaine afin de combiner course et renforcement.'; error.classList.remove('hidden'); return; }
  const hasRedFlag=[...document.querySelectorAll('.redflag')].some(x=>x.checked);
  const profile={
    sport,
    raceDate:$('raceDate').value,
    goalType:$('goalType').value,
    goalTime:$('goalTime').value.trim(),
    experience:Number($('experience').value),
    sessionsPerWeek:sessions,
    maxSessionMin:Number($('maxSessionMin').value),
    days,
    reminderTime:$('reminderTime').value,
    sleepHours:Number($('sleepHours').value),
    stress:Number($('stress').value),
    crossTraining:Number($('crossTraining').value),
    hasRedFlag,
    raceType:$('raceType').value,
    raceDistance:getRaceDistance(),
    weeklyKm:Number($('weeklyKm').value||0),
    longRunKm:Number($('longRunKm').value||0),
    time5k:$('time5k').value.trim(),
    time10k:$('time10k').value.trim(),
    triDistance:$('triDistance').value,
    triPriority:$('triPriority').value,
    swimWeeklyM:Number($('swimWeeklyM').value||0),
    bikeWeeklyHours:Number($('bikeWeeklyHours').value||0),
    triRunWeeklyKm:Number($('triRunWeeklyKm').value||0),
    triTime5k:$('triTime5k').value.trim(),
    poolAccess:$('poolAccess').checked,
    bikeAccess:$('bikeAccess').checked,
    hyroxDivision:$('hyroxDivision').value,
    hyroxPriority:$('hyroxPriority').value,
    hyroxWeeklyKm:Number($('hyroxWeeklyKm').value||0),
    strengthSessions:Number($('strengthSessions').value||0),
    hyroxTime5k:$('hyroxTime5k').value.trim(),
    strengthLevel:$('strengthLevel').value,
    hyroxEquipment:getHyroxEquipment()
  };
  state={profile,plan:[],feedback:{},adaptations:[],createdAt:new Date().toISOString()}; saveState();
  if(hasRedFlag){ showScreen('safety'); return; }
  state.plan=generatePlan(profile); saveState(); renderDashboard(); showScreen('dashboard');
});

function populateForm(p){
  if(!p) return;
  const sport=p.sport||'running'; const radio=document.querySelector(`input[name="sport"][value="${sport}"]`); if(radio) radio.checked=true; updateSportUI();
  $('raceDate').value=p.raceDate; $('goalType').value=p.goalType||'improve'; $('goalTime').value=p.goalTime||''; $('goalTimeWrap').classList.toggle('hidden',p.goalType!=='time');
  $('experience').value=p.experience??2; $('sessionsPerWeek').value=p.sessionsPerWeek||3; $('maxSessionMin').value=p.maxSessionMin||75; $('reminderTime').value=p.reminderTime||'18:30'; $('sleepHours').value=p.sleepHours||7; $('stress').value=p.stress||2; $('crossTraining').value=p.crossTraining||0;
  $('raceType').value=p.raceType||'10'; $('customDistance').value=p.raceDistance||15; $('customDistanceWrap').classList.toggle('hidden',p.raceType!=='custom');
  $('weeklyKm').value=p.weeklyKm??20; $('longRunKm').value=p.longRunKm??8; $('time5k').value=p.time5k||''; $('time10k').value=p.time10k||'';
  $('triDistance').value=p.triDistance||'standard'; $('triPriority').value=p.triPriority||'balanced'; $('swimWeeklyM').value=p.swimWeeklyM??1500; $('bikeWeeklyHours').value=p.bikeWeeklyHours??2; $('triRunWeeklyKm').value=p.triRunWeeklyKm??15; $('triTime5k').value=p.triTime5k||''; $('poolAccess').checked=p.poolAccess!==false; $('bikeAccess').checked=p.bikeAccess!==false;
  $('hyroxDivision').value=p.hyroxDivision||'open'; $('hyroxPriority').value=p.hyroxPriority||'balanced'; $('hyroxWeeklyKm').value=p.hyroxWeeklyKm??15; $('strengthSessions').value=p.strengthSessions??2; $('hyroxTime5k').value=p.hyroxTime5k||''; $('strengthLevel').value=p.strengthLevel||'intermediate';
  const eq=p.hyroxEquipment||['skierg','sled','rower','kettlebells','sandbag','wallball']; document.querySelectorAll('.hyrox-equipment').forEach(x=>x.checked=eq.includes(x.value));
  document.querySelectorAll('#dayPicker input').forEach(x=>x.checked=(p.days||[]).includes(Number(x.value)));
}

function estimatePaces(profile){
  let racePace=null; let t5=null; let t10=null;
  if(profile.sport==='running'){ t5=parseTimeString(profile.time5k); t10=parseTimeString(profile.time10k); const target=parseTimeString(profile.goalTime); if(profile.goalType==='time'&&target) racePace=secPerKm(target,profile.raceDistance); else if(t10) racePace=secPerKm(t10,10); else if(t5) racePace=secPerKm(t5,5)*1.06; }
  else { t5=parseTimeString(profile.sport==='triathlon'?profile.triTime5k:profile.hyroxTime5k); if(t5) racePace=secPerKm(t5,5)*1.08; }
  if(!racePace) return {easy:null,tempo:null,interval:null,race:null};
  return {race:racePace,easy:racePace+75,tempo:Math.max(racePace+10,racePace*1.03),interval:Math.max(racePace-18,racePace*.92)};
}

function chooseTrainingDays(profile){
  const preferred=[...profile.days]; const weekend=preferred.filter(d=>d===0||d===6), others=preferred.filter(d=>d!==0&&d!==6); const chosen=[];
  if(weekend.length) chosen.push(weekend[weekend.length-1]);
  const pool=[...others,...weekend.filter(d=>!chosen.includes(d))];
  while(chosen.length<profile.sessionsPerWeek && pool.length) chosen.push(pool.shift());
  return chosen.sort((a,b)=>((a+6)%7)-((b+6)%7));
}
function phaseForWeek(week,totalWeeks){ const left=totalWeeks-week+1; if(left<=1)return'race'; if(left<=3)return'taper'; const ratio=week/Math.max(totalWeeks,1); if(ratio<.28)return'base'; if(ratio<.72)return'build'; return'specific'; }
function weekLoadFactor(week,totalWeeks,profile){ const phase=phaseForWeek(week,totalWeeks); let growth=1+Math.min(.42,(week-1)*.04); if(week%4===0)growth*=.8; if(phase==='taper')growth*=week===totalWeeks-2?.74:.58; if(phase==='race')growth=.35; if(profile.stress===3||profile.sleepHours<=5)growth*=.9; return growth; }

function baseSession(type,minutes,week,phase,profile,discipline,intensity='easy'){
  return {type,minutes:Math.round(clamp(minutes,20,profile.maxSessionMin)),week,phase,status:'planned',adapted:false,discipline,intensity};
}
function makeRunningSession(type,minutes,week,phase,paces,profile){
  const b=baseSession(type,minutes,week,phase,profile,'Course',['tempo','interval','racepace'].includes(type)?'hard':type==='race'?'race':'easy'); const m=b.minutes;
  if(type==='easy') return {...b,title:'Endurance facile',detail:`${m} min en aisance respiratoire (RPE 2–3/10${paces.easy?`, env. ${paceText(paces.easy)}`:''}). Tu dois pouvoir parler en phrases complètes.`};
  if(type==='recovery') return {...b,title:'Footing récupération',detail:`${m} min très faciles (RPE 1–2/10). Aucun objectif de vitesse.`};
  if(type==='long') return {...b,title:'Sortie longue',detail:`${m} min faciles (RPE 2–3/10${paces.easy?`, proche de ${paceText(paces.easy)}`:''}). Reste régulier, sans finir épuisé.`};
  if(type==='tempo') return {...b,title:'Seuil / tempo',detail:`10–15 min faciles, puis ${Math.max(10,Math.round(m*.42))} min soutenues mais contrôlées (RPE 6–7/10${paces.tempo?`, env. ${paceText(paces.tempo)}`:''}), puis retour au calme.`};
  if(type==='interval') return {...b,title:'Intervalles courts',detail:`15 min faciles, puis 6 à 10 répétitions de 1 à 3 min rapides (RPE 8/10${paces.interval?`, env. ${paceText(paces.interval)}`:''}) avec récupération équivalente, puis 10 min faciles.`};
  if(type==='racepace') return {...b,title:'Allure spécifique',detail:`15 min faciles, puis 2 à 4 blocs à l'allure objectif (RPE 6–7/10${paces.race?`, env. ${paceText(paces.race)}`:''}) avec récupération courte, puis retour au calme.`};
  if(type==='strides') return {...b,title:'Endurance + lignes droites',detail:`${Math.max(20,m-8)} min faciles puis 4 à 6 accélérations souples de 15–20 s, récupération complète.`};
  if(type==='race'){ const target=parseTimeString(profile.goalTime); return {...b,minutes:target?Math.max(20,Math.round(target/60)):Math.max(30,Math.round(profile.raceDistance*6)),title:`Jour J — ${profile.raceDistance} km`,detail:'Échauffement progressif, départ contrôlé, puis gestion de l’allure selon ton objectif. Interromps l’effort en cas de symptôme inhabituel.'}; }
  return b;
}

const TRI_FORMATS={sprint:{label:'Sprint',swim:'750 m',bike:'20 km',run:'5 km',raceMinutes:90},standard:{label:'Standard',swim:'1,5 km',bike:'40 km',run:'10 km',raceMinutes:150},middle:{label:'70.3',swim:'1,9 km',bike:'90 km',run:'21,1 km',raceMinutes:360},long:{label:'Longue distance',swim:'3,8 km',bike:'180 km',run:'42,2 km',raceMinutes:720}};
function makeTriSession(type,minutes,week,phase,paces,profile){
  let discipline='Triathlon',intensity=['bikeIntervals','runTempo','brick'].includes(type)?'hard':'easy'; if(type.startsWith('swim'))discipline='Natation'; if(type.startsWith('bike'))discipline='Vélo'; if(type.startsWith('run'))discipline='Course'; if(type==='brick')discipline='Enchaînement';
  const b=baseSession(type,minutes,week,phase,profile,discipline,intensity); const m=b.minutes;
  if(type==='swimTechnique') return {...b,title:profile.poolAccess?'Natation — technique':'Technique natation à sec',detail:profile.poolAccess?`${m} min faciles : éducatifs, respiration, position et séries courtes propres. RPE 2–4/10.`:`${m} min de mobilité épaules/tronc et éducatifs à sec. Ce travail ne remplace pas la nage : prévois un accès à l’eau dès que possible.`};
  if(type==='swimEndurance') return {...b,title:profile.poolAccess?'Natation — endurance':'Préparation natation hors bassin',detail:profile.poolAccess?`${m} min avec séries continues/modérées, technique maintenue sous fatigue, RPE 3–5/10.`:`${m} min de renforcement doux du haut du corps et mobilité. Pour préparer un triathlon, des séances de nage réelles restent nécessaires.`};
  if(type==='swimRecovery') return {...b,title:'Natation récupération',detail:profile.poolAccess?`${m} min très faciles, priorité à la relâche et à la technique.`:`Mobilité très douce et récupération ; aucune intensité.`};
  if(type==='bikeEndurance') return {...b,title:'Vélo — endurance',detail:profile.bikeAccess?`${m} min souples, cadence confortable, RPE 2–4/10.`:`${m} min de cardio sans impact disponible. Un vélo/home-trainer reste nécessaire pour une préparation spécifique.`};
  if(type==='bikeIntervals') return {...b,title:'Vélo — intervalles',detail:profile.bikeAccess?`Échauffement puis 4 à 6 blocs soutenus de 4–8 min (RPE 7/10) séparés par récupération facile. Total ${m} min.`:`Remplace par cardio soutenu contrôlé sans impact. Travaille sur vélo dès que possible pour la spécificité.`};
  if(type==='bikeLong') return {...b,title:'Vélo — sortie longue',detail:profile.bikeAccess?`${m} min à intensité facile à modérée, alimentation/hydratation testées progressivement.`:`Cardio continu facile. Ce remplacement ne reproduit pas les contraintes spécifiques du vélo.`};
  if(type==='runEasy') return {...b,title:'Course — endurance',detail:`${m} min faciles, RPE 2–3/10${paces.easy?`, env. ${paceText(paces.easy)}`:''}.`};
  if(type==='runTempo') return {...b,title:'Course — tempo',detail:`Échauffement puis blocs contrôlés RPE 6–7/10${paces.tempo?`, proche de ${paceText(paces.tempo)}`:''}. Total ${m} min.`};
  if(type==='runLong') return {...b,title:'Course — sortie longue',detail:`${m} min en endurance, sans finir épuisé. Priorité à la régularité.`};
  if(type==='brick') return {...b,title:'Enchaînement vélo → course',detail:`Environ ${Math.round(m*.68)} min de vélo facile/modéré puis ${Math.max(15,Math.round(m*.32))} min de course contrôlée. Objectif : habituer les jambes à la transition, pas chercher un record.`};
  if(type==='triRace'){ const f=TRI_FORMATS[profile.triDistance]||TRI_FORMATS.standard; const target=parseTimeString(profile.goalTime); return {...b,discipline:'Course',intensity:'race',minutes:target?Math.round(target/60):f.raceMinutes,title:`Jour J — Triathlon ${f.label}`,detail:`Format prévu : ${f.swim} natation • ${f.bike} vélo • ${f.run} course. Départ contrôlé, transitions préparées, hydratation/alimentation déjà testées à l’entraînement.`}; }
  return b;
}

const HYROX_STATIONS='SkiErg 1000 m → Sled Push 50 m → Sled Pull 50 m → Burpee Broad Jumps 80 m → Row 1000 m → Farmers Carry 200 m → Sandbag Lunges 100 m → 100 Wall Balls';
function missingEquipment(profile){ const eq=profile.hyroxEquipment||[]; const names={skierg:'SkiErg',sled:'sled',rower:'rameur',kettlebells:'kettlebells',sandbag:'sandbag',wallball:'wall ball'}; return Object.keys(names).filter(k=>!eq.includes(k)).map(k=>names[k]); }
function makeHyroxSession(type,minutes,week,phase,paces,profile){
  const discipline=type.startsWith('run')?'Course':type==='strengthStations'?'Force':type==='recovery'?'Récupération':'HYROX'; const hard=['runIntervals','engine','compromised','simulation','strengthStations'].includes(type); const b=baseSession(type,minutes,week,phase,profile,discipline,hard?'hard':'easy'); const m=b.minutes; const missing=missingEquipment(profile);
  const alt=missing.length?` Matériel absent (${missing.join(', ')}) : utilise une variante de même mouvement/intention sans chercher à reproduire exactement la station.`:'';
  if(type==='runEasy') return {...b,title:'Course — endurance facile',detail:`${m} min faciles, RPE 2–3/10${paces.easy?`, env. ${paceText(paces.easy)}`:''}. Construis le moteur aérobie.`};
  if(type==='runIntervals') return {...b,title:'Course — intervalles 1 km',detail:`Échauffement, puis répétitions de 800 m à 1 km à RPE 7–8/10 avec récupération contrôlée. Total ${m} min. Le but est de rester propre, pas de sprinter.`};
  if(type==='strengthStations') return {...b,title:'Force & technique stations',detail:`Travail technique et force sur poussée/tirage, portés, fentes et wall balls, avec charges progressives adaptées à ton niveau et à ta division. Garde 2–3 répétitions en réserve.${alt}`};
  if(type==='engine') return {...b,title:'Engine — ergos + course',detail:`Alternance cardio contrôlée : blocs course + SkiErg/rameur lorsque disponibles, RPE 6–7/10. Total ${m} min.${alt}`};
  if(type==='compromised') return {...b,title:'Compromised running',detail:`Blocs courts de station fonctionnelle suivis immédiatement de course facile à modérée. Objectif : retrouver une foulée efficace sous fatigue, pas maximiser les charges.${alt}`};
  if(type==='simulation') return {...b,title:'Simulation HYROX progressive',detail:`Simulation partielle à intensité contrôlée : 3 à 6 blocs de course + stations selon la phase. Ne réalise pas une course complète chaque semaine.${alt}`};
  if(type==='recovery') return {...b,title:'Récupération active',detail:`${m} min très faciles : marche, vélo doux ou mobilité selon ce qui est totalement confortable.`};
  if(type==='hyroxRace'){ const target=parseTimeString(profile.goalTime); return {...b,discipline:'Course',intensity:'race',minutes:target?Math.round(target/60):90,title:`Jour J — HYROX ${profile.hyroxDivision==='pro'?'Pro':profile.hyroxDivision==='doubles'?'Doubles':profile.hyroxDivision==='relay'?'Relay':'Open'}`,detail:`Format : 8 × 1 km de course, chacun suivi d’une station dans l’ordre officiel : ${HYROX_STATIONS}. Utilise les charges/règles officielles de ta division le jour de l’épreuve.`}; }
  return b;
}

function generateRunningPlan(profile){
  const today=startOfDay(new Date()), race=startOfDay(new Date(profile.raceDate+'T12:00:00')); const totalDays=Math.max(7,daysBetween(today,race)), totalWeeks=Math.ceil(totalDays/7); const paces=estimatePaces(profile), chosen=chooseTrainingDays(profile); const baseMinutes=clamp(Math.max(60,profile.weeklyKm*6),60,profile.sessionsPerWeek*profile.maxSessionMin); const out=[];
  for(let i=0;i<=totalDays;i++){ const d=addDays(today,i); if(d>race)break; const week=Math.floor(i/7)+1; if(isoDate(d)===isoDate(race)){ const s=makeRunningSession('race',60,week,'race',paces,profile); out.push({...s,id:`s-${isoDate(d)}-race`,date:isoDate(d)}); break; } if(!chosen.includes(d.getDay()))continue; const phase=phaseForWeek(week,totalWeeks), factor=weekLoadFactor(week,totalWeeks,profile), weekly=Math.min(profile.sessionsPerWeek*profile.maxSessionMin,baseMinutes*factor), slot=chosen.indexOf(d.getDay()), last=chosen.length-1; let type='easy'; if(slot===last)type='long'; if(profile.sessionsPerWeek>=3&&slot===1&&phase!=='base')type=phase==='specific'?'racepace':'tempo'; if(profile.sessionsPerWeek>=4&&slot===2&&slot!==last&&phase==='build')type='interval'; if(profile.sessionsPerWeek>=5&&slot===0)type='recovery'; if(phase==='base'&&slot===1&&slot!==last)type=week%2===0?'strides':'easy'; if(phase==='taper'&&type==='interval')type='easy'; const shares={long:.34,tempo:.22,interval:.19,racepace:.24,easy:.20,recovery:.14,strides:.18}; let minutes=weekly*(shares[type]||.2); if(type==='long')minutes=Math.max(minutes,Math.min(profile.maxSessionMin,45+week*4)); if(profile.experience===0)minutes*=.82; const s=makeRunningSession(type,minutes,week,phase,paces,profile); out.push({...s,id:`s-${isoDate(d)}-${slot}`,date:isoDate(d)}); }
  return out;
}

function triTemplate(count,phase,priority){
  let arr=count<=3?['swimTechnique','bikeEndurance','brick']:count===4?['swimTechnique','bikeEndurance','runEasy','brick']:count===5?['swimTechnique','bikeIntervals','runEasy','swimEndurance','brick']:count===6?['swimTechnique','bikeIntervals','runEasy','swimEndurance','bikeLong','runLong']:['swimRecovery','swimTechnique','bikeIntervals','runEasy','swimEndurance','bikeLong','brick'];
  if(phase==='base') arr=arr.map(x=>x==='bikeIntervals'?'bikeEndurance':x==='brick'?'runLong':x);
  if(phase==='specific' && !arr.includes('brick')) arr[arr.length-1]='brick';
  if(phase==='taper') arr=arr.map(x=>['bikeIntervals','runTempo'].includes(x)?(x==='bikeIntervals'?'bikeEndurance':'runEasy'):x);
  if(priority==='swim'&&count>=5) arr[Math.max(0,arr.length-2)]='swimEndurance';
  if(priority==='bike'&&count>=5) arr[Math.max(0,arr.length-2)]='bikeLong';
  if(priority==='run'&&count>=5) arr[Math.max(0,arr.length-2)]='runTempo';
  return arr;
}
function generateTriathlonPlan(profile){
  const today=startOfDay(new Date()), race=startOfDay(new Date(profile.raceDate+'T12:00:00')); const totalDays=Math.max(7,daysBetween(today,race)), totalWeeks=Math.ceil(totalDays/7), chosen=chooseTrainingDays(profile), paces=estimatePaces(profile), out=[];
  const baseTotal=clamp(profile.swimWeeklyM/35 + profile.bikeWeeklyHours*60 + profile.triRunWeeklyKm*6,150,profile.sessionsPerWeek*profile.maxSessionMin);
  for(let i=0;i<=totalDays;i++){ const d=addDays(today,i); if(d>race)break; const week=Math.floor(i/7)+1; if(isoDate(d)===isoDate(race)){ const s=makeTriSession('triRace',120,week,'race',paces,profile); out.push({...s,id:`s-${isoDate(d)}-race`,date:isoDate(d)}); break; } if(!chosen.includes(d.getDay()))continue; const phase=phaseForWeek(week,totalWeeks), factor=weekLoadFactor(week,totalWeeks,profile), template=triTemplate(chosen.length,phase,profile.triPriority), slot=chosen.indexOf(d.getDay()), type=template[slot]||'runEasy'; let minutes=(baseTotal*factor)/chosen.length; if(['bikeLong','brick','runLong'].includes(type))minutes*=1.35; if(type.startsWith('swim'))minutes*=.82; if(profile.experience===0)minutes*=.85; const s=makeTriSession(type,minutes,week,phase,paces,profile); out.push({...s,id:`s-${isoDate(d)}-${slot}`,date:isoDate(d)}); }
  return out;
}

function hyroxTemplate(count,phase,priority){
  let arr=count<=3?['runEasy','strengthStations','compromised']:count===4?['runEasy','strengthStations','runIntervals','compromised']:count===5?['runEasy','strengthStations','runIntervals','engine','simulation']:['recovery','runEasy','strengthStations','runIntervals','engine','simulation'];
  if(phase==='base')arr=arr.map(x=>x==='simulation'?'compromised':x==='engine'?'runEasy':x);
  if(phase==='taper')arr=arr.map(x=>['simulation','strengthStations','runIntervals'].includes(x)?(x==='strengthStations'?'compromised':'runEasy'):x);
  if(priority==='running'&&count>=4)arr[Math.max(0,arr.length-2)]='runIntervals';
  if(priority==='strength'&&count>=4)arr[Math.max(0,arr.length-2)]='strengthStations';
  if(priority==='engine'&&count>=4)arr[Math.max(0,arr.length-2)]='engine';
  return arr;
}
function generateHyroxPlan(profile){
  const today=startOfDay(new Date()), race=startOfDay(new Date(profile.raceDate+'T12:00:00')); const totalDays=Math.max(7,daysBetween(today,race)), totalWeeks=Math.ceil(totalDays/7), chosen=chooseTrainingDays(profile), paces=estimatePaces(profile), out=[]; const baseTotal=clamp(profile.hyroxWeeklyKm*6+profile.strengthSessions*45,150,profile.sessionsPerWeek*profile.maxSessionMin);
  for(let i=0;i<=totalDays;i++){ const d=addDays(today,i); if(d>race)break; const week=Math.floor(i/7)+1; if(isoDate(d)===isoDate(race)){ const s=makeHyroxSession('hyroxRace',90,week,'race',paces,profile); out.push({...s,id:`s-${isoDate(d)}-race`,date:isoDate(d)}); break; } if(!chosen.includes(d.getDay()))continue; const phase=phaseForWeek(week,totalWeeks),factor=weekLoadFactor(week,totalWeeks,profile),template=hyroxTemplate(chosen.length,phase,profile.hyroxPriority),slot=chosen.indexOf(d.getDay()),type=template[slot]||'runEasy'; let minutes=(baseTotal*factor)/chosen.length; if(type==='simulation')minutes*=1.25; if(type==='recovery')minutes*=.65; if(profile.experience===0)minutes*=.85; const s=makeHyroxSession(type,minutes,week,phase,paces,profile); out.push({...s,id:`s-${isoDate(d)}-${slot}`,date:isoDate(d)}); }
  return out;
}
function generatePlan(profile){ return profile.sport==='triathlon'?generateTriathlonPlan(profile):profile.sport==='hyrox'?generateHyroxPlan(profile):generateRunningPlan(profile); }

function recomputeStatuses(){ const today=isoDate(new Date()); state.plan.forEach(s=>{ if(state.feedback[s.id])s.status=state.feedback[s.id].status; else if(s.date<today&&s.intensity!=='race')s.status='missed'; else s.status='planned'; }); }
function eventTitle(p){ if(p.sport==='triathlon'){const f=TRI_FORMATS[p.triDistance]||TRI_FORMATS.standard;return`Triathlon ${f.label}`;} if(p.sport==='hyrox')return`HYROX ${p.hyroxDivision==='pro'?'Pro':p.hyroxDivision==='doubles'?'Doubles':p.hyroxDivision==='relay'?'Relay':'Open'}`; return `${p.raceDistance} km`; }
function metricVolume(p){ if(p.sport==='triathlon')return{value:'3',label:'disciplines entraînées'}; if(p.sport==='hyrox')return{value:`${p.hyroxWeeklyKm} km`,label:'course au départ'}; return{value:`${p.weeklyKm} km`,label:'volume de départ'}; }
function renderDashboard(){
  if(!state.profile)return; recomputeStatuses(); const p=state.profile,race=new Date(p.raceDate+'T12:00:00'); $('dashboardSport').textContent=sportLabel(p.sport); $('dashboardTitle').textContent=`${eventTitle(p)} — ${fullDate(race)}`; $('dashboardSubtitle').textContent=`${p.sessionsPerWeek} séances/semaine • ${Math.max(0,daysBetween(new Date(),race))} jours jusqu'au jour J`;
  const completed=state.plan.filter(s=>s.status==='done').length,missed=state.plan.filter(s=>s.status==='missed').length,thisWeek=Math.max(1,Math.floor(daysBetween(new Date(state.createdAt||new Date()),new Date())/7)+1),mv=metricVolume(p);
  $('metrics').innerHTML=`<div class="card metric"><strong>${completed}</strong><span>séances terminées</span></div><div class="card metric"><strong>${missed}</strong><span>séances manquées</span></div><div class="card metric"><strong>${mv.value}</strong><span>${mv.label}</span></div><div class="card metric"><strong>S${thisWeek}</strong><span>semaine actuelle</span></div>`;
  const notice=$('sportNotice'); notice.classList.remove('hidden');
  if(p.sport==='triathlon') notice.innerHTML=`<strong>Triathlon :</strong> le moteur répartit natation, vélo, course et enchaînements. ${!p.poolAccess||!p.bikeAccess?'Ton profil signale un accès matériel incomplet : les alternatives proposées ne remplacent pas une pratique spécifique avant la compétition.':'Les séances sont pilotées surtout par durée et RPE pour rester utilisables sans capteurs.'}`;
  else if(p.sport==='hyrox') notice.innerHTML=`<strong>HYROX :</strong> le plan combine course, force, stations et travail sous fatigue. Les charges d’entraînement doivent rester progressives et adaptées à ta technique ; vérifie les règles officielles de ta division avant l’épreuve.`;
  else notice.classList.add('hidden');
  renderNext(); renderWeekFilter(); renderPlan(); renderAdaptation(); updateNotificationUI(); saveState();
}
function renderNext(){ const today=isoDate(new Date()); const next=state.plan.find(s=>s.status==='planned'&&s.date>=today)||state.plan.find(s=>s.status==='planned'); const el=$('nextSession'); if(!next){el.innerHTML='<p>Aucune séance à venir.</p>';return;} el.innerHTML=`<span class="session-tag">${phaseLabel(next.phase)}</span><h3>${next.title}</h3><p>${next.detail}</p><div class="session-meta"><span>📅 ${formatDate(next.date)}</span><span>⏱ ${next.minutes} min</span><span>${next.discipline}</span>${next.adapted?'<span>↻ adaptée</span>':''}</div><div class="session-actions">${next.intensity!=='race'?`<button class="btn primary" data-feedback="${next.id}">Faire le bilan</button>`:''}</div>`; const b=el.querySelector('[data-feedback]'); if(b)b.onclick=()=>openFeedback(next.id); }
function renderWeekFilter(){ const weeks=[...new Set(state.plan.map(s=>s.week))]; const sel=$('weekFilter'); const current=Number(sel.value)||weeks[0]||1; sel.innerHTML=weeks.map(w=>`<option value="${w}" ${w===current?'selected':''}>Semaine ${w}</option>`).join(''); sel.onchange=renderPlan; }
function renderPlan(){ const w=Number($('weekFilter').value||1),list=state.plan.filter(s=>s.week===w),container=$('planList'); if(!list.length){container.innerHTML='<div class="card mini"><p>Aucune séance cette semaine.</p></div>';return;} container.innerHTML=list.map(s=>`<div class="session-row ${s.status}"><div class="session-date"><strong>${formatDate(s.date).split(' ')[0]}</strong><span>${formatDate(s.date).replace(/^\S+\s/,'')}</span></div><div class="session-info"><strong><span class="discipline-pill">${s.discipline}</span>${s.title}</strong><span>${s.minutes} min • ${phaseLabel(s.phase)}${s.adapted?' • adaptée':''}</span></div><div><span class="status-pill ${s.status}">${s.status==='done'?'faite':s.status==='missed'?'ratée':'prévue'}</span>${s.intensity!=='race'?` <button class="btn ghost" data-feedback="${s.id}">Bilan</button>`:''}</div></div>`).join(''); container.querySelectorAll('[data-feedback]').forEach(b=>b.onclick=()=>openFeedback(b.dataset.feedback)); }

function openFeedback(id){ const s=state.plan.find(x=>x.id===id); if(!s)return; $('feedbackSessionId').value=id; $('feedbackTitle').textContent=s.title; const f=state.feedback[id]; $('feedbackStatus').value=f?.status||'done'; $('feedbackDifficulty').value=f?.difficulty||3; $('feedbackFatigue').value=f?.fatigue||3; $('feedbackPain').checked=!!f?.pain; $('feedbackNote').value=f?.note||''; $('feedbackDialog').showModal(); }
$('feedbackForm').addEventListener('submit',(e)=>{ if(e.submitter&&e.submitter.value==='cancel')return; e.preventDefault(); const id=$('feedbackSessionId').value; state.feedback[id]={status:$('feedbackStatus').value,difficulty:Number($('feedbackDifficulty').value),fatigue:Number($('feedbackFatigue').value),pain:$('feedbackPain').checked,note:$('feedbackNote').value.trim(),at:new Date().toISOString()}; adaptPlanFromFeedback(id,state.feedback[id]); saveState(); $('feedbackDialog').close(); renderDashboard(); toast('Bilan enregistré. Le plan a été réévalué.'); });
function recoveryReplacement(s,kind){
  const p=state.profile; if(kind==='pain')return{...s,type:'rest',discipline:'Récupération',intensity:'easy',title:'Repos / récupération',minutes:20,detail:'Pas d’intensité. Repos ou mobilité très douce uniquement si totalement indolore. Si la douleur persiste, s’aggrave ou modifie ton mouvement, demande un avis professionnel avant de reprendre.'};
  const paces=estimatePaces(p); if(p.sport==='triathlon')return{...makeTriSession(p.poolAccess?'swimRecovery':'runEasy',Math.max(20,s.minutes*.65),s.week,s.phase,paces,p),id:s.id,date:s.date,adapted:true};
  if(p.sport==='hyrox')return{...makeHyroxSession('recovery',Math.max(20,s.minutes*.65),s.week,s.phase,paces,p),id:s.id,date:s.date,adapted:true};
  return{...makeRunningSession('recovery',Math.max(20,s.minutes*.65),s.week,s.phase,paces,p),id:s.id,date:s.date,adapted:true};
}
function adaptPlanFromFeedback(id,f){
  const session=state.plan.find(s=>s.id===id); if(!session)return; const baseDate=new Date(session.date+'T12:00:00'); let kind='stable',message='Aucun changement important nécessaire.';
  if(f.pain){kind='pain';message='Douleur inhabituelle signalée : les séances exigeantes des 7 prochains jours sont neutralisées. Le moteur ne cherche pas à diagnostiquer la cause.';}
  else if(f.fatigue>=5||f.difficulty>=5){kind='highfatigue';message='Fatigue/difficulté très élevée : charge réduite d’environ 25 % sur les 5 prochains jours et intensité supprimée temporairement.';}
  else if(f.fatigue>=4||f.difficulty>=4){kind='fatigue';message='Fatigue élevée : charge réduite d’environ 15 % sur les 4 prochains jours.';}
  else if(f.status==='missed'){kind='missed';message='Séance ratée : elle n’est pas rattrapée. Le plan continue sans ajouter de charge.';}
  else if(f.difficulty<=2&&f.fatigue<=2){kind='fresh';message='Séance facile et fatigue basse : progression maintenue sans augmentation brutale.';}
  state.adaptations.push({id:'a'+Date.now(),date:new Date().toISOString(),kind,message,source:id}); if(['stable','missed','fresh'].includes(kind))return;
  const horizon=kind==='pain'?7:kind==='highfatigue'?5:4,reduction=kind==='pain'?.35:kind==='highfatigue'?.25:.15;
  state.plan.forEach((s,idx)=>{ const d=new Date(s.date+'T12:00:00'),delta=daysBetween(baseDate,d); if(delta<=0||delta>horizon||s.intensity==='race'||s.status==='done')return; if(kind==='pain'||(kind==='highfatigue'&&s.intensity==='hard')){ state.plan[idx]=recoveryReplacement(s,kind); state.plan[idx].adapted=true; } else { s.minutes=Math.max(20,Math.round(s.minutes*(1-reduction))); s.adapted=true; } });
}
function renderAdaptation(){ const last=[...state.adaptations].reverse()[0],box=$('adaptationState'); if(!last){box.innerHTML='<p>Le plan suit sa progression initiale. Fais un bilan après chaque séance pour l’adapter.</p>';return;} const cls=['pain','highfatigue'].includes(last.kind)?'danger':last.kind==='fatigue'?'warn':''; box.innerHTML=`<div class="coach-note ${cls}"><strong>${last.kind==='pain'?'Douleur signalée':last.kind.includes('fatigue')?'Charge ajustée':'Plan réévalué'}</strong><span>${last.message}</span></div>`; }

$('resetBtn').onclick=()=>{ if(confirm('Supprimer le profil, le plan et tous les bilans enregistrés sur cet appareil ?')){localStorage.removeItem(STORAGE_KEY);state=emptyState();refreshResume();showScreen('welcome');toast('Données locales supprimées.');} };
async function requestNotifications(){ if(!('Notification'in window)){toast('Les notifications ne sont pas prises en charge par ce navigateur.');return;} const perm=await Notification.requestPermission(); updateNotificationUI(); if(perm==='granted'){toast('Notifications activées.');maybeNotifyToday(true);}else toast('Permission de notification non accordée.'); }
$('notifBtn').onclick=requestNotifications; $('bannerNotifBtn').onclick=requestNotifications;
function updateNotificationUI(){ const supported='Notification'in window,granted=supported&&Notification.permission==='granted'; $('notifBtn').textContent=granted?'Notifications activées':'Activer les notifications'; $('notificationBanner').classList.toggle('hidden',granted||!state.profile); }
function maybeNotifyToday(force=false){ if(!state.profile||!('Notification'in window)||Notification.permission!=='granted')return; const today=isoDate(new Date()),s=state.plan.find(x=>x.date===today&&x.status==='planned'&&x.intensity!=='race'); if(!s)return; const [h,m]=(state.profile.reminderTime||'18:30').split(':').map(Number),now=new Date(),key=`runprep_notified_${today}_${s.id}`; if(localStorage.getItem(key)&&!force)return; if(force||now.getHours()>h||(now.getHours()===h&&now.getMinutes()>=m)){const body=`${s.title} — ${s.minutes} min. Ouvre RunPrep pour le détail.`; if(navigator.serviceWorker?.controller)navigator.serviceWorker.ready.then(reg=>reg.showNotification('Séance RunPrep',{body,icon:'icons/icon.svg',badge:'icons/icon.svg',tag:key})); else new Notification('Séance RunPrep',{body}); localStorage.setItem(key,'1');} }
setInterval(()=>maybeNotifyToday(false),60000); setTimeout(()=>maybeNotifyToday(false),1500);

$('calendarExportBtn').onclick=()=>{ if(!state.profile)return; const [rh,rm]=(state.profile.reminderTime||'18:30').split(':').map(Number),pad2=n=>String(n).padStart(2,'0'),esc=s=>String(s).replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;'),lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//RunPrep MultiSport//FR','CALSCALE:GREGORIAN','METHOD:PUBLISH']; state.plan.forEach(s=>{const d=new Date(s.date+'T12:00:00'),start=`${d.getFullYear()}${pad2(d.getMonth()+1)}${pad2(d.getDate())}T${pad2(rh)}${pad2(rm)}00`,endDate=new Date(d);endDate.setHours(rh,rm+Math.max(15,s.minutes),0,0);const end=`${endDate.getFullYear()}${pad2(endDate.getMonth()+1)}${pad2(endDate.getDate())}T${pad2(endDate.getHours())}${pad2(endDate.getMinutes())}00`;lines.push('BEGIN:VEVENT',`UID:${s.id}@runprep.local`,`DTSTART:${start}`,`DTEND:${end}`,`SUMMARY:${esc('RunPrep — '+s.title)}`,`DESCRIPTION:${esc(s.detail)}`,'BEGIN:VALARM','TRIGGER:-PT30M','ACTION:DISPLAY',`DESCRIPTION:${esc('Séance dans 30 minutes : '+s.title)}`,'END:VALARM','END:VEVENT');}); lines.push('END:VCALENDAR'); const blob=new Blob([lines.join('\r\n')],{type:'text/calendar;charset=utf-8'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='runprep-multisport-calendrier.ics';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);toast('Calendrier exporté avec rappels 30 min avant.'); };

window.addEventListener('beforeinstallprompt',(e)=>{e.preventDefault();deferredInstallPrompt=e;$('installBtn').classList.remove('hidden');});
$('installBtn').onclick=async()=>{if(!deferredInstallPrompt)return;deferredInstallPrompt.prompt();await deferredInstallPrompt.userChoice;deferredInstallPrompt=null;$('installBtn').classList.add('hidden');};
if('serviceWorker'in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));}
updateSportUI(); updateNotificationUI();
