/* RunPrep V3 -- deterministic planning, no network dependency.
 * All policy values below are PRODUCT HEURISTICS, not validated medical limits.
 * Read METHODE.md before changing them. No result establishes fitness to race.
 * Pure functions and civil-date arithmetic make the engine testable offline.
 */
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.RunPrepEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';
  const VERSION = '3.0.0';
  const DAY = 86400000;
  const PHASES = {foundation:'Entretien / fondations',base:'Base',build:'Developpement',specific:'Specifique',recovery:'Semaine allegee',taper:'Affutage',race:'Competition'};
  const FORMATS = {
    sprint:{name:'Triathlon Sprint',swimM:750,bikeKm:20,runKm:5,window:16,taper:7,runMax:150,bikeMax:240,swimMax:3500,longBike:90,longRun:60},
    standard:{name:'Triathlon Standard',swimM:1500,bikeKm:40,runKm:10,window:20,taper:10,runMax:210,bikeMax:360,swimMax:5000,longBike:120,longRun:80},
    middle:{name:'Triathlon 70.3',swimM:1900,bikeKm:90,runKm:21.1,window:24,taper:14,runMax:270,bikeMax:540,swimMax:6000,longBike:180,longRun:110},
    long:{name:'Triathlon longue distance',swimM:3800,bikeKm:180,runKm:42.2,window:28,taper:21,runMax:330,bikeMax:720,swimMax:8000,longBike:240,longRun:140}
  };
  const STATIONS = [
    {name:'SkiErg',eq:'skierg',alt:'Marche active sur place (cardio general, pas equivalent au SkiErg)'},
    {name:'Sled push',eq:'sled',alt:'Squat au poids du corps vers une chaise stable (pas equivalent au sled)'},
    {name:'Sled pull',eq:'sled',alt:'Mobilite scapulaire et gainage debout (pas equivalent au tirage)'},
    {name:'Burpees avec saut vers l\u2019avant',eq:null,alt:'Burpee sans saut, mains sur appui stable si necessaire'},
    {name:'Rameur',eq:'rower',alt:'Marche active (cardio general, pas equivalent au rameur)'},
    {name:'Farmer carry',eq:'kettlebells',alt:'Marche en posture droite sans charge (pas equivalent au porte)'},
    {name:'Fentes avec sandbag',eq:'sandbag',alt:'Fentes arriere sans charge, amplitude confortable'},
    {name:'Wall balls',eq:'wallball',alt:'Squat sans charge avec extension des bras (pas equivalent aux wall balls)'}
  ];
  const clamp = (n,a,b) => Math.max(a,Math.min(b,n));
  const sum = a => a.reduce((s,n)=>s+n,0);
  const clone = v => JSON.parse(JSON.stringify(v));
  const pad = n => String(n).padStart(2,'0');
  function civil(s) {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error('Date invalide : AAAA-MM-JJ attendu.');
    const [y,m,d] = s.split('-').map(Number), t = Date.UTC(y,m-1,d);
    if (new Date(t).toISOString().slice(0,10)!==s) throw new Error('Date inexistante.');
    return t;
  }
  function dateAdd(s,n) { return new Date(civil(s)+n*DAY).toISOString().slice(0,10); }
  function daysBetween(a,b) { return Math.round((civil(b)-civil(a))/DAY); }
  function weekday(s) { return new Date(civil(s)).getUTCDay(); }
  function monday(s) { return dateAdd(s,-((weekday(s)+6)%7)); }
  function localToday() { const d=new Date(); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
  // TWO components mean minutes:seconds, never hours:minutes. Explicit H:M:S for hours.
  function parseDuration(raw) {
    const value=String(raw??'').trim();
    if (!value) return null;
    if (!/^\d{1,3}:\d{2}(:\d{2})?$/.test(value)) throw new Error('Temps invalide. Utilise mm:ss (25:30) ou hh:mm:ss (01:25:30).');
    const p=value.split(':').map(Number);
    if (p[p.length-1]>=60 || (p.length===3&&p[1]>=60)) throw new Error('Minutes et secondes doivent etre inferieures a 60 dans hh:mm:ss.');
    const seconds=p.length===2?p[0]*60+p[1]:p[0]*3600+p[1]*60+p[2];
    if (seconds<=0) throw new Error('Le temps doit etre positif.');
    return seconds;
  }
  function paceText(s) { if (!Number.isFinite(s)||s<=0) return 'au ressenti'; const n=Math.round(s); return `${Math.floor(n/60)}:${pad(n%60)}/km`; }
  function timeText(sec) { const s=Math.round(sec),m=Math.floor(s/60); return s<60?`${s} s`:s%60?`${m} min ${pad(s%60)} s`:`${m} min`; }
  function num(value,fallback) { return value===''||value==null?fallback:Number(value); }
  function profileError(message) { const e=new Error(message);e.name='ProfileError';throw e; }
  function normalizeProfile(input) {
    if(input&&Object.values(input).some(v=>typeof v==='number'&&!Number.isFinite(v)))profileError('Valeur numerique non finie dans le profil.');
    const p=clone(input||{});
    p.sport=p.sport||'running';
    if (!['running','triathlon','hyrox'].includes(p.sport)) profileError('Sport non pris en charge.');
    p.startDate=p.startDate||localToday();
    civil(p.startDate); civil(p.raceDate);
    const horizon=daysBetween(p.startDate,p.raceDate);
    if(horizon<14||horizon>550) profileError('Choisis une competition dans 14 a 550 jours. Le moteur ne propose pas de preparation acceleree.');
    if(p.hasRedFlag||p.adultConfirmed!==true) profileError('Generation suspendue : ce moteur est reserve aux adultes sans signal d\u2019alerte declare. Demande un accompagnement adapte.');
    p.sessionsPerWeek=num(p.sessionsPerWeek,3);
    if(!Number.isInteger(p.sessionsPerWeek)||p.sessionsPerWeek<2||p.sessionsPerWeek>6) profileError('La V3 accepte 2 a 6 seances, avec au moins un jour sans seance.');
    if(p.sport!=='running'&&p.sessionsPerWeek<3) profileError('Au moins 3 creneaux sont necessaires pour ce sport.');
    p.days=[...new Set(p.days||[])];
    if(p.days.some(d=>!Number.isInteger(d)||d<0||d>6)||p.days.length<p.sessionsPerWeek) profileError('Selectionne suffisamment de jours disponibles.');
    p.maxSessionMin=num(p.maxSessionMin,60);
    p.longSessionMin=num(p.longSessionMin,p.maxSessionMin);
    p.longDay=num(p.longDay,p.days.includes(0)?0:p.days[p.days.length-1]);
    p.weeklyHoursCap=num(p.weeklyHoursCap,(p.maxSessionMin*(p.sessionsPerWeek-1)+p.longSessionMin)/60);
    p.maxRunMin=num(p.maxRunMin,75);p.maxBikeMin=num(p.maxBikeMin,90);p.maxSwimMin=num(p.maxSwimMin,60);p.maxStrengthMin=num(p.maxStrengthMin,60);
    for(const k of ['maxSessionMin','longSessionMin','maxRunMin','maxBikeMin','maxSwimMin','maxStrengthMin']) {
      if(!Number.isFinite(p[k])||p[k]<15||p[k]>300) profileError('Les durees disponibles doivent etre comprises entre 15 et 300 minutes.');
    }
    if(!Number.isFinite(p.weeklyHoursCap)||p.weeklyHoursCap<.5||p.weeklyHoursCap>30) profileError('Le plafond hebdomadaire doit etre compris entre 0,5 et 30 heures.');
    if(!p.days.includes(p.longDay)) profileError('Le jour du creneau long doit etre un jour disponible.');
    p.experience=num(p.experience,1);p.sleepHours=num(p.sleepHours,7);p.stress=num(p.stress,2);
    p.runWeeklyMin=num(p.runWeeklyMin,0);p.recentLongRunMin=num(p.recentLongRunMin,0);
    p.swimWeeklyM=num(p.swimWeeklyM,0);p.bikeWeeklyHours=num(p.bikeWeeklyHours,0);p.recentLongBikeMin=num(p.recentLongBikeMin,0);
    p.strengthSessions=num(p.strengthSessions,0);p.recentStrengthMin=num(p.recentStrengthMin,40);
    for(const k of ['runWeeklyMin','recentLongRunMin','swimWeeklyM','bikeWeeklyHours','recentLongBikeMin','strengthSessions','recentStrengthMin']) {
      if(!Number.isFinite(p[k])||p[k]<0) profileError('Volume recent invalide : utilise un nombre positif ou nul.');
    }
    if(p.runWeeklyMin>1200||p.recentLongRunMin>300||p.swimWeeklyM>50000||p.bikeWeeklyHours>30||p.strengthSessions>7) profileError('Volume hors du perimetre de ce prototype.');
    if(p.recentLongRunMin>p.runWeeklyMin&&p.runWeeklyMin>0) profileError('La sortie longue recente depasse le volume hebdomadaire de course declare.');
    if(p.recentLongBikeMin>p.bikeWeeklyHours*60&&p.bikeWeeklyHours>0) profileError('La sortie longue velo depasse le volume hebdomadaire declare.');
    p.raceDistance=num(p.raceDistance,10);
    if(p.sport==='running'&&(!Number.isFinite(p.raceDistance)||p.raceDistance<1||p.raceDistance>42.195)) profileError('Cette V3 couvre la course sur route de 1 km au marathon, pas l\u2019ultra ni le trail.');
    p.triDistance=p.triDistance||'standard';
    if(p.sport==='triathlon'&&!FORMATS[p.triDistance]) profileError('Format de triathlon inconnu.');
    if(p.sport==='triathlon'&&(!p.poolAccess||!p.bikeAccess)) profileError('Sans acces a la natation et au velo, ce moteur ne peut pas generer une preparation triathlon specifique.');
    p.poolDays=Array.isArray(p.poolDays)&&p.poolDays.length?p.poolDays:p.days.slice();
    if(p.sport==='triathlon'&&!p.poolDays.some(d=>p.days.includes(d))) profileError('Aucun jour disponible pour la natation.');
    p.hyroxEquipment=Array.isArray(p.hyroxEquipment)?p.hyroxEquipment:[];
    p.hyroxDivision=p.hyroxDivision||'open';
    p.dayMinutes=p.dayMinutes||{};
    for(const value of Object.values(p.dayMinutes)) if(!Number.isFinite(Number(value))||Number(value)<15||Number(value)>300) profileError('Duree par jour invalide (15 a 300 min).');
    p.paceSource=(p.sport==='triathlon'?p.triTime5k:p.sport==='hyrox'?p.hyroxTime5k:p.time5k)||'';
    const t5=parseDuration(p.paceSource),t10=p.sport==='running'?parseDuration(p.time10k):null;
    if(t5&&(t5<600||t5>5400)) profileError('Chrono 5 km hors plage : verifie le format mm:ss. Aucun chrono n\u2019est obligatoire.');
    if(t10&&(t10<1500||t10>10800)) profileError('Chrono 10 km hors plage : verifie le format mm:ss ou hh:mm:ss.');
    p.easyPaceSec=parseDuration(p.easyPace);
    if(p.easyPaceSec&&(p.easyPaceSec<150||p.easyPaceSec>1200)) profileError('Allure facile invalide : utilise par exemple 06:30 pour 6 min 30 /km.');
    p.swimPaceSec=parseDuration(p.swimPace)||150;
    if(p.swimPaceSec<50||p.swimPaceSec>600) profileError('Allure natation invalide : utilise mm:ss pour 100 metres.');
    p.goalTimeSec=parseDuration(p.goalTime);
    p.referencePaceSec=t5?t5/5:t10?t10/10:null;
    p.easyRange=p.easyPaceSec?[p.easyPaceSec,p.easyPaceSec]:p.referencePaceSec?[p.referencePaceSec+60,p.referencePaceSec+90]:null;
    // Objective pace is deliberately NOT used as the athlete's current fitness.
    p.policyVersion=VERSION;
    return p;
  }
  function eventConfig(p) {
    if(p.sport==='triathlon') return FORMATS[p.triDistance];
    if(p.sport==='hyrox') return {name:`HYROX ${p.hyroxDivision}`,window:16,taper:10,runMax:210,bikeMax:0,swimMax:0,longRun:75};
    const km=p.raceDistance;
    return {name:`Course ${km} km`,window:km>21?22:km>10?18:km>5?16:12,taper:km>21?14:km>10?10:7,runMax:km>21?420:km>10?300:240,longRun:km>21?150:km>10?100:km>5?80:65};
  }
  function availableMinutes(p,day) { return num(p.dayMinutes[day],day===p.longDay?p.longSessionMin:p.maxSessionMin); }
  function combinations(a,n) { const out=[];function rec(start,prefix){if(prefix.length===n){out.push(prefix);return;}for(let i=start;i<a.length;i++)rec(i+1,prefix.concat(a[i]));}rec(0,[]);return out; }
  function selectDays(p) {
    const variants=combinations(p.days,p.sessionsPerWeek);
    let best=variants[0],score=-Infinity;
    for(const days of variants){if(p.sport==='triathlon'&&!days.some(d=>p.poolDays.includes(d)))continue;const d=days.map(n=>(n+6)%7).sort((a,b)=>a-b);const gaps=d.map((n,i)=>((d[(i+1)%d.length]-n+7)%7));
      let s=sum(gaps.map(g=>Math.min(g,3)**2))+(days.includes(p.longDay)?12:0);
      if(p.sport==='triathlon')s+=days.filter(n=>p.poolDays.includes(n)).length*3;
      if(s>score){score=s;best=days;}}
    return best.sort((a,b)=>(a+6)%7-(b+6)%7);
  }
  function phaseAt(date,p,cfg) {
    const left=daysBetween(date,p.raceDate);
    if(left===0)return'race';
    if(left<=cfg.taper)return'taper';
    if(left>cfg.window*7)return'foundation';
    const activeStart=dateAdd(p.raceDate,-cfg.window*7);
    const ratio=clamp(daysBetween(activeStart,date)/(cfg.window*7-cfg.taper),0,1);
    return ratio<.36?'base':ratio<.72?'build':'specific';
  }
  function weekContext(start,p,cfg,index) {
    const activeStart=p.startDate>dateAdd(p.raceDate,-cfg.window*7)?p.startDate:dateAdd(p.raceDate,-cfg.window*7);
    const active=Math.max(0,Math.floor(daysBetween(monday(activeStart),start)/7));
    const phase=phaseAt(start<p.startDate?p.startDate:start,p,cfg);
    const cycle=p.experience<2?3:4;
    const deload=phase!=='taper'&&((phase==='foundation'?index:active+1)%cycle===0);
    return {start,index,phase,active,deload,cycle,label:deload?'recovery':phase};
  }
  // Small, bounded increases are assumptions for a draft, not a 'safe %' rule.
  function disciplineTargets(p,cfg,w) {
    const baseRun=p.runWeeklyMin>0?p.runWeeklyMin:40;
    const baseBike=p.bikeWeeklyHours>0?p.bikeWeeklyHours*60:45;
    const baseSwim=p.swimWeeklyM>0?p.swimWeeklyM:400;
    const baseStrength=p.strengthSessions>0?p.strengthSessions*p.recentStrengthMin:25;
    const steps=w.phase==='foundation'?0:w.active-Math.floor(w.active/w.cycle);
    let factor=w.deload?.76:1;
    if(p.stress>=3||p.sleepHours<6) factor*=.88;
    // Taper reductions reference the same peak, rather than a rising base.
    if(w.phase==='taper') factor*=daysBetween(w.start,p.raceDate)<=7?.48:.66;
    const limited=(base,rate,ratio,max)=>Math.min(base*Math.pow(1+rate,steps),base*ratio,Math.max(base,max))*.92*factor;
    return {run:limited(baseRun,.03,1.65,cfg.runMax),bike:limited(baseBike,.045,2.05,cfg.bikeMax),swim:limited(baseSwim,.04,1.9,cfg.swimMax),strength:limited(baseStrength,.02,1.3,180)};
  }
  function makeRoles(p,w) {
    const rotation=w.phase==='foundation'?w.index-1:w.active;
    const n=p.sessionsPerWeek, quality=['build','specific'].includes(w.phase)&&!w.deload&&p.experience>0;
    if(p.sport==='running') {
      const roles=Array.from({length:n},()=>({type:'runEasy',discipline:'run'}));
      roles[n-1]={type:'runLong',discipline:'run',long:true};
      if(n>=3&&quality)roles[1]={type:w.phase==='specific'?'runTempo':w.active%2?'runIntervals':'runTempo',discipline:'run',quality:true};
      return roles;
    }
    if(p.sport==='triathlon') {
      const sw={type:'swimTechnique',discipline:'swim'},bike={type:quality?'bikeIntervals':'bikeEasy',discipline:'bike',quality},
        longB={type:'bikeLong',discipline:'bike',long:true},run={type:'runLong',discipline:'run',long:true},easy={type:'runEasy',discipline:'run'},sw2={type:'swimEndurance',discipline:'swim'};
      let roles=n===3?[sw,longB,run]:n===4?[sw,bike,longB,run]:n===5?(rotation%2===0?[sw,bike,easy,longB,run]:[sw,bike,sw2,longB,run]):[sw,bike,easy,sw2,longB,run];
      // The brick is ADDED inside a bike slot, never replaces the long run.
      if(quality&&w.active%3===1&&n>=4&&p.runWeeklyMin>=60)roles=roles.map(r=>r===longB?{...r,type:'brick',brick:true}:r);
      if(w.phase==='taper')roles=roles.map(r=>({...r,type:r.discipline==='swim'?'swimTechnique':r.discipline==='bike'?'bikeEasy':'runEasy',quality:false,long:false,brick:false}));
      const poolAvailable=selectDays(p).filter(d=>p.poolDays.includes(d)).length;
      if(roles.filter(r=>r.discipline==='swim').length>poolAvailable){let swims=0;roles=roles.map(r=>r.discipline==='swim'&&++swims>poolAvailable?{type:'runEasy',discipline:'run'}:r);}
      return roles;
    }
    const force={type:'strength',discipline:'strength'}, circuit={type:quality&&w.active%3===1?'hyroxCircuit':'stations',discipline:'strength',quality};
    let roles=[{type:'runEasy',discipline:'run'},force,circuit];
    if(n>=4)roles.splice(2,0,{type:'runLong',discipline:'run',long:true});
    if(n>=5)roles.splice(1,0,{type:'runEasy',discipline:'run'});
    if(n>=6)roles.push({type:'mobility',discipline:'strength'});
    if(w.phase==='taper'||w.deload)roles=roles.map(r=>r.discipline==='strength'?{type:'mobility',discipline:'strength'}:{type:'runEasy',discipline:'run'});
    return roles;
  }
  function assignDays(roles,days,p,weekStart,previousDemanding) {
    let best=null,bestScore=-Infinity;
    function rec(rest,assignment) {
      if(rest.length===0) {
        let score=0,qualityDays=[];
        for(let i=0;i<assignment.length;i++){
          const r=assignment[i],d=days[i],cap=availableMinutes(p,d);
          if(r.discipline==='swim'&&!p.poolDays.includes(d))return;
          const longPreferred=p.sport==='triathlon'?(r.type==='bikeLong'||r.type==='brick'):r.long;
          if(longPreferred)score+=d===p.longDay?50:0;
          if(r.long)score+=cap*.03;
          if(r.quality){qualityDays.push((d+6)%7);if(previousDemanding&&daysBetween(previousDemanding,dateAdd(weekStart,(d+6)%7))<2)score-=60;}
          if(r.discipline==='swim'&&d===p.longDay)score-=8;
        }
        for(let i=1;i<qualityDays.length;i++)if(qualityDays[i]-qualityDays[i-1]<2)score-=80;
        const longPositions=assignment.flatMap((r,i)=>r.long?[(days[i]+6)%7]:[]);
        if(longPositions.length>1&&Math.abs(longPositions[0]-longPositions[1])<2)score-=12;
        if(score>bestScore){bestScore=score;best=assignment.slice();}
        return;
      }
      const seen=new Set();
      for(let i=0;i<rest.length;i++){const key=rest[i].type;if(seen.has(key))continue;seen.add(key);rec(rest.slice(0,i).concat(rest.slice(i+1)),assignment.concat(rest[i]));}
    }
    rec(roles,[]);
    if(!best)profileError('Les jours de piscine ne permettent pas de placer les seances. Ajoute un creneau de nage ou change les jours.');
    return days.map((day,i)=>({...best[i],day,date:dateAdd(weekStart,(day+6)%7)}));
  }
  function sessionCap(p,r,cfg) {
    const normal=r.discipline==='run'?p.maxRunMin:r.discipline==='bike'?p.maxBikeMin:r.discipline==='swim'?p.maxSwimMin:p.maxStrengthMin;
    const sportCap=r.long? (r.discipline==='bike'?Math.max(normal,p.longSessionMin):Math.max(normal,Math.min(p.longSessionMin,cfg.longRun))):normal;
    return Math.min(availableMinutes(p,r.day),sportCap);
  }
  function block(label,seconds,discipline,rpe=3,kind='easy',distanceM=0) {
    return {label,seconds:Math.max(1,Math.round(seconds)),discipline,rpe,kind,distanceM};
  }
  function easyBlocks(total,discipline,runWalk=false) {
    const warm=Math.min(600,Math.floor(total*.2)),cool=Math.min(480,Math.floor(total*.15)),body=total-warm-cool;
    const out=[block('Mise en route progressive',warm,discipline,2,'warmup')];
    if(runWalk&&discipline==='run'){
      let remain=body,i=1;
      while(remain>0){const sec=Math.min(remain,60);out.push(block(i%2?'Course tres facile (marche possible)':'Marche de recuperation',sec,'run',i%2?3:1,'easy'));remain-=sec;i++;}
    }else out.push(block('Endurance confortable, conversation possible',body,discipline,3));
    out.push(block('Retour au calme',cool,discipline,2,'cooldown'));return out;
  }
  function intervalBlocks(total,discipline,week,tempo=false) {
    if(total<1800)return easyBlocks(total,discipline);
    const warm=Math.min(900,Math.round(total*.25)),cool=Math.min(600,Math.round(total*.18));
    const work=tempo?[180,240,300][week%3]:[60,90,120][week%3],rest=tempo?120:work;
    const workBudget=Math.floor(total*(discipline==='bike'?.23:.18));
    const reps=Math.min(tempo?4:8,Math.floor(workBudget/work),Math.floor((total-warm-cool+rest)/(work+rest)));
    if(reps<2)return easyBlocks(total,discipline);
    const out=[block('Echauffement progressif',warm,discipline,2,'warmup')];
    for(let i=0;i<reps;i++){out.push(block(`${i+1}/${reps} - ${tempo?'Soutenu controle':'Acceleration controlee'}, jamais sprint`,work,discipline,tempo?6:7,'work'));if(i<reps-1)out.push(block('Recuperation tres facile',rest,discipline,2,'recovery'));}
    const used=sum(out.map(b=>b.seconds)),remaining=total-used-cool;
    if(remaining>0)out.push(block('Endurance facile complementaire',remaining,discipline,3));
    out.push(block('Retour au calme',cool,discipline,2,'cooldown'));return out;
  }
  function swimBlocks(targetM,capMin,p,type,w) {
    let meters=Math.floor(targetM/25)*25;
    function assemble(m) {
      const warm=Math.max(25,Math.floor(m*.2/25)*25),cool=Math.max(25,Math.floor(m*.1/25)*25);
      const body=m-warm-cool;
      let unit=type==='swimTechnique'?25:w.phase==='specific'?200:w.phase==='build'?100:50;
      if(p.swimWeeklyM<1000)unit=Math.min(unit,50);
      const out=[block(`Echauffement - ${warm} m tres faciles`,warm*p.swimPaceSec/100,'swim',2,'warmup',warm)];
      let remaining=body,i=1;
      while(remaining>0){const distance=Math.min(remaining,unit);out.push(block(`${i} - ${distance} m : ${type==='swimTechnique'?(i%2?'alignement, nage relachee':'nage complete facile'):'nage reguliere, respiration confortable'}`,distance*p.swimPaceSec/100,'swim',type==='swimTechnique'?3:4,'easy',distance));remaining-=distance;if(remaining>0)out.push(block('Repos au mur',20,'swim',1,'recovery'));i++;}
      out.push(block(`Retour au calme - ${cool} m`,cool*p.swimPaceSec/100,'swim',2,'cooldown',cool));return out;
    }
    let blocks=[];
    while(meters>=100){blocks=assemble(meters);if(sum(blocks.map(b=>b.seconds))<=capMin*60)return blocks;meters-=25;}
    return [];
  }
  function stationLabel(st,p) {
    if(!st.eq)return 'Burpees sans saut si besoin, geste lent et controle';
    return p.hyroxEquipment.includes(st.eq)?`${st.name} - charge technique, au moins 3 repetitions en reserve`:st.alt;
  }
  function strengthBlocks(total,p,w,type) {
    const warm=Math.min(480,Math.floor(total*.2)),cool=Math.min(300,Math.floor(total*.15));
    const out=[block('Mobilite active et mise en route',warm,'strength',2,'warmup')];
    let remain=total-warm-cool,i=0;
    if(type==='mobility'){out.push(block('Mobilite confortable, sans forcer les amplitudes',remain,'strength',2));}
    else {
      const items=type==='hyroxCircuit'?4:3;
      while(remain>0){
        if(type==='hyroxCircuit'&&i%2===0){const t=Math.min(120,remain);out.push(block('Course controlee apres station, aucun sprint',t,'run',5));remain-=t;}
        else{const station=STATIONS[(w.active*items+i)%STATIONS.length];const t=Math.min(40,remain);out.push(block(stationLabel(station,p),t,'strength',type==='hyroxCircuit'?6:4,'work'));remain-=t;}
        if(remain>0){const t=Math.min(type==='strength'?80:50,remain);out.push(block('Repos complet / transition, pas de repetitions forcees',t,'strength',1,'recovery'));remain-=t;}i++;
      }
    }
    out.push(block('Relachement et retour au calme',cool,'strength',1,'cooldown'));return out;
  }
  const TITLES={runEasy:'Course - endurance facile',runLong:'Course - sortie longue',runTempo:'Course - blocs soutenus controles',runIntervals:'Course - intervalles controles',bikeEasy:'Velo - endurance',bikeLong:'Velo - sortie longue',bikeIntervals:'Velo - intervalles controles',swimTechnique:'Natation - technique',swimEndurance:'Natation - series d\u2019endurance',brick:'Velo long + transition + course courte',strength:'Force - technique et mouvements controles',stations:'HYROX - technique des stations',hyroxCircuit:'HYROX - circuit partiel controle',mobility:'Mobilite / recuperation'};
  const DISCIPLINES={run:'Course',swim:'Natation',bike:'Velo',strength:'Force / mobilite'};
  function describe(s,p) {
    if(s.kind==='race')return s.detail;
    const lines=[`${TITLES[s.type]||s.title} - ${timeText(s.durationSec)}${s.swimMeters?` ; ${s.swimMeters} m (temps estime)`:''}.`];
    lines.push(...s.blocks.map(b=>`${timeText(b.seconds)} : ${b.label}. Effort ${b.rpe}/10.`));
    if(s.blocks.some(b=>b.discipline==='run')){
      if(p.easyRange)lines.push(`Repere indicatif pour les blocs FACILES seulement : ${paceText(p.easyRange[0])}${p.easyRange[1]!==p.easyRange[0]?' a '+paceText(p.easyRange[1]):''}. Priorite a l\u2019aisance, pas a la vitesse.`);
      else lines.push('Pas de vitesse imposee sans reference recente : utilise l\u2019effort ressenti.');
    }
    if(s.swimMeters)lines.push('Durees estimees a partir de ton allure /100 m ; repos inclus. Ne depasse pas le creneau si tu nages plus lentement. Pas d\u2019apnee, nage dans un lieu surveille adapte.');
    if(s.type==='brick'||s.type==='bikeLong')lines.push('Tester progressivement materiel, hydratation et alimentation deja toleres. Aucun nouvel aliment le jour J.');
    if(s.adapted)lines.push('Seance recalculee : suivre les blocs affiches, pas une ancienne version.');
    lines.push('Arreter en cas de douleur inhabituelle, malaise ou symptome anormal. Ce programme est une ebauche, pas une validation medicale.');
    return lines.join('\n');
  }
  function finalize(s,p) {
    s.durationSec=sum(s.blocks.map(b=>b.seconds));s.minutes=Number((s.durationSec/60).toFixed(2));
    s.swimMeters=sum(s.blocks.map(b=>b.discipline==='swim'?b.distanceM||0:0));
    s.load=Math.round(sum(s.blocks.map(b=>b.seconds/60*b.rpe))); // planning index only
    s.hardSeconds=sum(s.blocks.map(b=>b.rpe>=6?b.seconds:0));
    s.intensity=s.hardSeconds>0?'hard':'easy';
    s.discipline=s.type==='brick'?'Enchainement':DISCIPLINES[s.primary]||'Entrainement';
    s.title=TITLES[s.type]||s.title;s.detail=describe(s,p);return s;
  }
  function buildSession(role,budget,p,w,cfg) {
    const cap=sessionCap(p,role,cfg);
    let min=Math.min(budget,cap);
    // Longest recent outing caps are independent of weekly load and sport.
    if(role.discipline==='run'||role.discipline==='bike') {
      const recent=role.discipline==='bike'?p.recentLongBikeMin:p.recentLongRunMin;
      const fallback=role.discipline==='bike'?30:20;
      const growth=Math.min(2,Math.pow(1.04,w.phase==='foundation'?0:w.active));
      min=Math.min(min,(recent||fallback)*growth*(w.deload?.8:1)+(role.brick?Math.min(15,p.runWeeklyMin*.1)+2:0));
    }
    if(w.phase==='taper')min=Math.min(min,daysBetween(role.date,p.raceDate)<=3?25:role.discipline==='bike'?60:45);
    if(min<8&&role.discipline!=='swim')return null; // do not inflate small budgets
    const total=Math.max(1,Math.floor(min*60));
    let blocks,type=role.type;
    const beginner=p.experience===0||p.runWeeklyMin<45;
    if(role.discipline==='swim')blocks=swimBlocks(budget,cap,p,type,w);
    else if(type==='brick'){
      const run=Math.min(900,Math.floor(total*.12),Math.floor(p.runWeeklyMin*60*.1));
      if(run<300){type='bikeLong';blocks=easyBlocks(total,'bike');}
      else{blocks=easyBlocks(total-run-120,'bike').concat(block('Transition preparee velo vers course',120,'strength',1,'transition'),easyBlocks(run,'run'));}
    }else if(role.discipline==='strength')blocks=strengthBlocks(total,p,w,type);
    else if(role.quality&&!beginner)blocks=intervalBlocks(total,role.discipline,w.active,type==='runTempo');
    else blocks=easyBlocks(total,role.discipline,beginner);
    if(!blocks.length)return null;
    const s={id:`rp3-${role.date}-${p.sport}`,date:role.date,week:w.index,weekStart:w.start,phase:w.label,kind:'training',type,primary:role.discipline,blocks,capMinutes:cap,provisional:daysBetween(p.startDate,role.date)>13,status:'planned',adapted:false};
    return finalize(s,p);
  }
  function reduceSession(session,p,ratio,easyOnly=false) {
    const s=clone(session);
    if(s.kind!=='training'||ratio>=1&&!easyOnly)return s;
    // Swim lengths remain multiples of 25 m; rebuild the full set and rests.
    if(s.primary==='swim') {
      s.type='swimTechnique';s.blocks=swimBlocks(Math.floor(s.swimMeters*ratio/25)*25,s.minutes*ratio,p,s.type,{phase:'base',active:s.week});
      if(!s.blocks.length)return {...s,kind:'rest',type:'rest',title:'Repos - volume disponible trop faible',durationSec:0,minutes:0,load:0,hardSeconds:0,swimMeters:0,blocks:[],detail:'Repos. Aucun rattrapage.',intensity:'easy',adapted:true};
    }else {
      const budget=Math.floor(s.durationSec*ratio);
      if(easyOnly&&s.intensity==='hard') {
        s.type=s.primary==='run'?'runEasy':s.primary==='bike'?'bikeEasy':'mobility';
        s.blocks=s.primary==='strength'?strengthBlocks(budget,p,{active:0},'mobility'):easyBlocks(budget,s.primary,p.experience===0||p.runWeeklyMin<45);
      }else{s.blocks=s.blocks.map(b=>({...b,seconds:Math.max(1,Math.floor(b.seconds*ratio))}));}
    }
    s.adapted=true;return finalize(s,p);
  }
  function warning(code,message,severity='warning'){return {code,message,severity};}
  function initialWarnings(p,cfg) {
    const out=[warning('EXPERIMENTAL','Moteur experimental non valide cliniquement. Les coefficients sont des choix de conception, pas des seuils de securite garantis.','info'),warning('PROVISIONAL','Les seances a plus de 14 jours sont une projection. Refaire un bilan de disponibilite et de volume reel regulierement.','info')];
    if(!p.easyRange)out.push(warning('NO_PACE','Aucun chrono recent ni allure facile saisis : pas d\u2019allure imposee.','info'));
    if(p.goalTime)out.push(warning('TIME_NOT_VALIDATED','Le chrono cible est enregistre, mais sa faisabilite n\u2019est pas evaluee. Il ne sert jamais a accelerer artificiellement les allures.','info'));
    if(daysBetween(p.startDate,p.raceDate)<cfg.window*4)out.push(warning('SHORT_HORIZON','Horizon plus court que la fenetre de travail du moteur : aucune acceleration de progression pour compenser. Objectif a reevaluer.'));
    if(p.sport==='triathlon') {
      if(p.sessionsPerWeek<6)out.push(warning('TRI_SLOTS','Avec moins de 6 creneaux, la repartition impose des compromis. A 5, le moteur alterne une et deux nages ; la sortie longue course est conservee.'));
      if(!p.swimPace)out.push(warning('SWIM_ESTIMATE','Durees natation estimees avec 2:30/100 m faute de reference. Ce n\u2019est pas une allure cible : renseigne ton allure habituelle.','info'));
      if(p.swimWeeklyM<800)out.push(warning('SWIM_LOW_BASE','Base natation limitee : apprentissage encadre et suivi technique prioritaires. Le plan n\u2019atteste pas de l\u2019aptitude a nager la distance en eau libre.'));
      if(p.longSessionMin<cfg.longBike)out.push(warning('LONG_SLOT','Le creneau long est inferieur au repere de planification velo de ce format. Le moteur respecte tes limites et ne peut pas proposer une preparation complete dans ces contraintes.'));
      if(p.triDistance==='middle'&&(p.bikeWeeklyHours<2||p.runWeeklyMin<90))out.push(warning('MIDDLE_BASE','Base declaree faible pour une preparation 70.3 specifique : cette sortie est une ebauche de mise en condition, pas une assurance de preparation suffisante.'));
      if(p.triDistance==='long')out.push(warning('LONG_REVIEW','Longue distance : validation par un entraineur qualifie necessaire. Ce prototype ne valide ni nutrition, ni endurance requise, ni aptitude a finir.'));
    }
    if(p.sport==='hyrox'){
      if(p.hyroxEquipment.length<6)out.push(warning('EQUIPMENT','Des variantes sans materiel sont proposees. Elles ne sont pas equivalentes aux stations de course ; une pratique specifique reste a organiser.'));
      if(['pro','relay','doubles'].includes(p.hyroxDivision))out.push(warning('DIVISION','Preparation physique generale seulement pour cette division : charges, partage des stations et roles ne sont pas personnalises.'));
    }
    if(p.runWeeklyMin<45)out.push(warning('LOW_RUN_BASE','Base course faible : alternance course/marche et pas de fractionne rapide.'));
    return out;
  }
  function summarizeWeeks(plan,p) {
    const map=new Map();
    for(const s of plan){if(!map.has(s.weekStart))map.set(s.weekStart,{start:s.weekStart,index:s.week,minutes:0,runMinutes:0,bikeMinutes:0,swimMeters:0,strengthMinutes:0,load:0,hardMinutes:0,count:0,phase:s.phase});
      const w=map.get(s.weekStart);if(s.kind!=='training')continue;w.count++;w.minutes+=s.minutes;w.swimMeters+=s.swimMeters||0;w.load+=s.load;w.hardMinutes+=(s.hardSeconds||0)/60;
      for(const b of s.blocks){if(b.discipline==='run')w.runMinutes+=b.seconds/60;else if(b.discipline==='bike')w.bikeMinutes+=b.seconds/60;else if(b.discipline==='strength')w.strengthMinutes+=b.seconds/60;}
    }
    return [...map.values()].map(w=>({...w,minutes:Math.round(w.minutes),runMinutes:Math.round(w.runMinutes),bikeMinutes:Math.round(w.bikeMinutes),strengthMinutes:Math.round(w.strengthMinutes),hardMinutes:Math.round(w.hardMinutes)}));
  }
  function generatePlan(input) {
    const p=normalizeProfile(input),cfg=eventConfig(p),selected=selectDays(p),warnings=initialWarnings(p,cfg),plan=[];
    const first=monday(p.startDate),weeks=Math.floor(daysBetween(first,p.raceDate)/7)+1;
    let previousDemanding=null;
    const references=[];let taperReference=null;
    for(let wi=0;wi<weeks;wi++) {
      const start=dateAdd(first,wi*7),w=weekContext(start,p,cfg,wi+1),targets=disciplineTargets(p,cfg,w);
      const assigned=assignDays(makeRoles(p,w),selected,p,start,previousDemanding);
      const counts={run:0,bike:0,swim:0,strength:0};
      const weight=r=>r.long?1.3:r.type==='mobility'?.55:1;
      assigned.forEach(r=>counts[r.discipline]+=weight(r));
      let sessions=[];
      for(let role of assigned) {
        if(role.date<p.startDate||role.date>=p.raceDate)continue;
        // Last 48 h: no long sessions, stations or intense work. Day before is rest.
        const left=daysBetween(role.date,p.raceDate);
        if(left===1)continue;
        let budget=targets[role.discipline]*weight(role)/counts[role.discipline];
        if(left<=cfg.taper&&w.phase!=='taper')budget*=left<=7?.48:.66;
        if(left<=cfg.taper){role={...role,long:false,quality:false,brick:false,type:role.discipline==='run'?'runEasy':role.discipline==='bike'?'bikeEasy':role.discipline==='swim'?'swimTechnique':'mobility'};}
        const sessionW=left<=cfg.taper?{...w,phase:'taper',label:'taper'}:w;
        let s=buildSession(role,budget,p,sessionW,cfg);if(!s)continue;
        const demanding=s.intensity==='hard'||s.primary==='run'&&s.minutes>75||s.primary==='bike'&&s.minutes>120||s.type==='brick';
        if(demanding&&previousDemanding&&daysBetween(previousDemanding,s.date)<2){
          s=reduceSession(s,p,Math.min(1,(s.primary==='bike'?90:60)/s.minutes),true);
          warnings.push(warning('RECOVERY_SPACING','Des seances ont ete allegees pour eviter deux sollicitations exigeantes sur des jours consecutifs.'));
        } else if(demanding)previousDemanding=s.date;
        sessions.push(s);
      }
      // Mixed blocks (bricks/HYROX) count towards ALL relevant discipline totals.
      const runTotal=sum(sessions.flatMap(s=>s.blocks.filter(b=>b.discipline==='run').map(b=>b.seconds/60)));
      if(runTotal>targets.run+1){const ratio=targets.run/runTotal;sessions=sessions.map(s=>s.blocks.some(b=>b.discipline==='run')?reduceSession(s,p,ratio):s);}
      const total=sum(sessions.map(s=>s.minutes));
      if(total>p.weeklyHoursCap*60){const ratio=p.weeklyHoursCap*60/total;sessions=sessions.map(s=>reduceSession(s,p,ratio));warnings.push(warning('WEEK_CAP','Le volume a ete reduit pour respecter le plafond hebdomadaire. Les minutes retirees ne sont pas reportees sur les autres jours.'));}
      // Enforce recovery/progression on the ACTUAL emitted work, after all caps.
      // Otherwise a target reduced by 24% could remain clipped to the same 80 min.
      const amounts=items=>({
        run:sum(items.flatMap(s=>s.blocks.filter(b=>b.discipline==='run').map(b=>b.seconds/60))),
        bike:sum(items.flatMap(s=>s.blocks.filter(b=>b.discipline==='bike').map(b=>b.seconds/60))),
        swim:sum(items.map(s=>s.swimMeters||0)),
        strength:sum(items.flatMap(s=>s.blocks.filter(b=>b.discipline==='strength').map(b=>b.seconds/60)))
      });
      const recent=references.slice(-3);
      const ref=recent.length?Object.fromEntries(['run','bike','swim','strength'].map(k=>[k,Math.max(...recent.map(r=>r[k]))])):null;
      if(w.phase==='taper'&&!taperReference)taperReference=ref;
      const effective=w.phase==='taper'?taperReference:ref;
      if(effective) {
        const a=amounts(sessions),ratios={};
        for(const k of ['run','bike','swim','strength']) {
          const multiplier=w.phase==='taper'?(daysBetween(start,p.raceDate)<=7?.48:.66):w.deload?.8:k==='bike'?1.06:1.04;
          // Absent disciplines (e.g. the first short brick) use their baseline.
          const reference=effective[k]|| (k==='strength'&&p.sport==='triathlon'?2:targets[k]);
          ratios[k]=a[k]>0?Math.min(1,reference*multiplier/a[k]):1;
        }
        sessions=sessions.map(s=>{const keys=[...new Set(s.blocks.map(b=>b.discipline))];const ratio=Math.min(1,...keys.map(k=>ratios[k]||1));return ratio<.999?reduceSession(s,p,ratio):s;});
      }
      if(!w.deload&&w.phase!=='taper'&&start>=p.startDate)references.push(amounts(sessions));
      plan.push(...sessions);
    }
    if(!plan.some(s=>s.kind==='training'))profileError('La base recente et les creneaux ne permettent aucune seance exploitable. Reduis le nombre de creneaux ou demande un accompagnement de reprise ; le moteur ne remplira pas artificiellement le calendrier.');
    const f=eventConfig(p);
    const detail=p.sport==='triathlon'?`${f.swimM} m natation / ${f.bikeKm} km velo / ${f.runKm} km course. Horaires et parcours a confirmer aupres de l\u2019organisateur.`:p.sport==='hyrox'?'Format individuel de reference : 8 x 1 km, alterne avec SkiErg, sled push, sled pull, burpees, rameur, farmer carry, fentes et wall balls. Verifier les regles actuelles de sa division.':`${p.raceDistance} km. Horaires et parcours a confirmer aupres de l\u2019organisateur.`;
    plan.push({id:`rp3-${p.raceDate}-race`,date:p.raceDate,week:weeks,weekStart:monday(p.raceDate),phase:'race',kind:'race',type:'race',title:`Jour J - ${f.name}`,detail:detail+' La presence de cet evenement ne confirme pas ton aptitude a participer.',durationSec:0,minutes:0,load:0,hardSeconds:0,swimMeters:0,blocks:[],intensity:'race',discipline:'Competition',status:'planned',provisional:true});
    const summaries=summarizeWeeks(plan,p);
    if(p.sport==='triathlon'&&['middle','long'].includes(p.triDistance)) {
      const longest=Math.max(0,...plan.filter(s=>s.primary==='bike').map(s=>s.minutes));
      if(longest<f.longBike)warnings.push(warning('BIKE_READINESS','Aucune sortie velo n\u2019atteint le repere de planification de ce format avec la base et les contraintes saisies. Ne considere pas ce plan comme une preparation complete.'));
    }
    const unique=[...new Map(warnings.map(x=>[x.code,x])).values()];
    const errors=validatePlan(plan,p);
    if(errors.length)throw new Error('Verification interne echouee : '+errors.slice(0,4).join(' ; '));
    return {version:VERSION,profile:p,plan,weeks:summaries,warnings:unique,createdAt:new Date().toISOString(),label:'Ebauche personnalisee a revoir regulierement'};
  }
  function validatePlan(plan,p) {
    const errors=[],ids=new Set(),daySet=new Set(),weekTotals=new Map();
    for(const s of plan){
      if(ids.has(s.id))errors.push('Identifiant duplique');ids.add(s.id);
      if(daySet.has(s.date))errors.push('Deux evenements le meme jour');daySet.add(s.date);
      if(s.date<p.startDate||s.date>p.raceDate)errors.push('Date hors preparation');
      if(s.kind==='race')continue;
      if(s.kind==='paused'||s.kind==='rest')continue;
      if(!p.days.includes(weekday(s.date)))errors.push('Jour indisponible');
      if(s.primary==='swim'&&!p.poolDays.includes(weekday(s.date)))errors.push('Piscine indisponible');
      if(!Number.isFinite(s.durationSec)||s.durationSec<=0)errors.push('Duree invalide');
      if(sum(s.blocks.map(b=>b.seconds))!==s.durationSec)errors.push('Somme des blocs incoherente');
      if(s.durationSec>s.capMinutes*60+1)errors.push('Creneau depasse');
      if(s.blocks.some(b=>b.seconds<=0||!Number.isFinite(b.seconds)))errors.push('Bloc invalide');
      if(s.swimMeters!==sum(s.blocks.map(b=>b.discipline==='swim'?b.distanceM||0:0)))errors.push('Metres natation incoherents');
      if(daysBetween(s.date,p.raceDate)<=3&&s.hardSeconds>0)errors.push('Intensite en fin d\u2019affutage');
      weekTotals.set(s.weekStart,(weekTotals.get(s.weekStart)||0)+s.durationSec);
    }
    for(const v of weekTotals.values())if(v>p.weeklyHoursCap*3600+5)errors.push('Plafond de semaine depasse');
    if(plan.filter(s=>s.kind==='race'||s.originalKind==='race').length!==1)errors.push('Jour J absent ou duplique');
    return errors;
  }
  // Always rebuild from an immutable plan: saving the same feedback twice cannot
  // compound a 25% reduction into 44%, 58%, ... . No missed-session catch-up.
  function adaptPlan(basePlan,feedback,p,today=localToday(),hold=false) {
    const validEntries=Object.entries(feedback||{}).map(([id,f])=>({s:basePlan.find(s=>s.id===id),f})).filter(x=>x.s&&x.s.date<=today);
    const pain=hold||validEntries.some(x=>x.f.pain||x.f.illness);
    const recent=validEntries.filter(x=>daysBetween(x.s.date,today)>=0&&daysBetween(x.s.date,today)<7);
    const latest=validEntries.slice().sort((a,b)=>a.s.date.localeCompare(b.s.date)).at(-1);
    const staleConcern=latest&&daysBetween(latest.s.date,today)>=7&&(latest.f.fatigue>=4||latest.f.difficulty>=4);
    const high=recent.some(x=>x.f.fatigue>=5||x.f.difficulty>=5),tired=recent.some(x=>x.f.fatigue>=4||x.f.difficulty>=4);
    const missed=recent.filter(x=>x.f.status==='missed').length;
    const incomplete=recent.some(x=>x.f.status==='done'&&Number.isFinite(x.f.actualMinutes)&&x.f.actualMinutes<x.s.minutes*.7);
    let ratio=high?.70:tired?.85:staleConcern?(latest.f.fatigue>=5||latest.f.difficulty>=5?.70:.85):missed>=2||incomplete?.85:1;
    let message=pain?'Plan suspendu, competition comprise. Pas de reprise automatique : reevaluation de la situation et nouveau profil apres avis adapte.':high?'Fatigue tres elevee : suppression des blocs intenses et reduction provisoire de 30 %.':tired?'Fatigue elevee : suppression des blocs intenses et reduction provisoire de 15 %.':missed>=2||incomplete?'Assiduite ou duree realisee en baisse : reduction provisoire de 15 %, sans rattrapage.':'Aucune hausse automatique apres une seance facile. Les seances manquees ne sont pas rattrapees.';
    const concern=validEntries.filter(x=>x.f.fatigue>=4||x.f.difficulty>=4).sort((a,b)=>a.s.date.localeCompare(b.s.date)).at(-1);
    if(ratio===1&&concern&&latest&&latest.s.date>concern.s.date&&latest.f.status==='done') {
      const elapsed=daysBetween(concern.s.date,today);
      ratio=Math.min(1,.8+.1*Math.max(0,Math.floor((elapsed-7)/7)));
      if(ratio<1)message='Nouveau bilan plus favorable : reprise progressive du volume, pas de retour immediat a la charge initiale. Les blocs intenses restent neutralises pendant cette reprise.';
    }
    if(staleConcern&&!pain)message='Le dernier bilan signalait une fatigue elevee. Reduction maintenue en l\u2019absence de nouveau bilan ; aucune reprise automatique a une date supposee.';
    const plan=basePlan.map(original=>{
      const s=clone(original),f=feedback?.[s.id];
      if(f){s.status=f.status;s.feedback=clone(f);return s;}
      if(s.date<today){s.status='unlogged';return s;}
      if(pain)return {...s,kind:'paused',originalKind:s.kind,minutes:0,durationSec:0,swimMeters:0,load:0,hardSeconds:0,blocks:[],title:`Suspendu - ${s.title}`,detail:'Aucune seance prescrite. Une douleur ou maladie signalee doit etre reevaluee ; ce moteur ne decide pas de la reprise.',status:'paused',adapted:true};
      if(ratio<1&&s.kind==='training')return reduceSession(s,p,ratio,true);
      return s;
    });
    return {plan,message,hold:pain,ratio,weeks:summarizeWeeks(plan,p)};
  }
  return {VERSION,PHASES,FORMATS,STATIONS,normalizeProfile,parseDuration,paceText,timeText,localToday,dateAdd,daysBetween,weekday,monday,eventConfig,selectDays,generatePlan,validatePlan,adaptPlan,reduceSession,summarizeWeeks};
});
