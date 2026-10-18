/* TriPlan v7. Pure domain functions, shared by the UI and the tests. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.TriCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const INCREASE_PERCENT = 10;
  const OUTCOMES = ['planned', 'completed', 'shortened', 'skipped'];
  const KEY = 'triplan_full_year_v1'; // Keep the v5 key: never discard existing feedback.
  const START = '2026-10-12', END = '2027-09-30';
  const SPORTS = ['Course', 'Natation', 'V\u00e9lo'];
  const ALL_SPORTS = [...SPORTS, 'Brick'];
  const clone = obj => JSON.parse(JSON.stringify(obj));
  const pad = n => String(n).padStart(2, '0');
  const localISO = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  function validDate(s) {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    const [y,m,d] = s.split('-').map(Number);
    if (y < 2000 || y > 2100) return false;
    const x = new Date(y,m-1,d,12);
    return localISO(x) === s;
  }
  function date(s) {
    if (!validDate(s)) throw new Error('Date invalide.');
    const [y,m,d] = s.split('-').map(Number);
    return new Date(y,m-1,d,12);
  }
  function addDays(s,n) { const d = date(s); d.setDate(d.getDate()+n); return localISO(d); }
  function monday(s) { const d = date(s); return addDays(s,-((d.getDay()+6)%7)); }
  function weekNumber(s) {
    const a = date(monday(s)), b = date(START);
    // UTC civil dates avoid daylight-saving 23/25-hour days.
    return Math.round((Date.UTC(a.getFullYear(),a.getMonth(),a.getDate()) - Date.UTC(b.getFullYear(),b.getMonth(),b.getDate())) / 604800000);
  }
  function isDeloadDate(s) { return s >= START && s <= END && weekNumber(s) % 4 === 3; }
  function protectedSession(s) { return Boolean(s.deload) || isDeloadDate(s.date); }
  function phaseFor(s) {
    if (s < START || s > END) return 'S\u00e9ance personnelle';
    if (s <= '2026-12-31') return 'Base + technique natation';
    if (s <= '2027-03-31') return 'D\u00e9veloppement endurance';
    if (s <= '2027-06-30') return 'Bricks + sp\u00e9cifique triathlon';
    if (s <= '2027-08-15') return 'Sp\u00e9cifique 70.3';
    return 'Aff\u00fbtage';
  }
  function nullableNumber(value, max = 100000) {
    if (value === null || value === undefined || String(value).trim() === '') return null;
    const n = Number(String(value).trim().replace(',', '.'));
    if (!Number.isFinite(n) || n <= 0 || n > max) throw new Error('Saisir un nombre positif valide.');
    return n;
  }
  function normalizeActual(actual, sport) {
    if (actual === undefined || actual === null) return [];
    if (!Array.isArray(actual) || actual.length > 2) throw new Error('Bilan invalide.');
    const expected = sport === 'Brick' ? ['V\u00e9lo', 'Course'] : [sport];
    const seen = new Set();
    return actual.map(a => {
      if (!a || !expected.includes(a.sport) || seen.has(a.sport)) throw new Error('Sport du bilan invalide.');
      seen.add(a.sport);
      return {
        sport:a.sport,
        durationMin:nullableNumber(a.durationMin,1440),
        distanceKm:nullableNumber(a.distanceKm,2000)
      };
    });
  }

  function statusOf(s) {
    if (s.status === 'skipped' || s.status === 'shortened') return s.status;
    return s.status === 'completed' || s.completed ? 'completed' : 'planned';
  }
  function isPerformed(s) { return ['completed','shortened'].includes(statusOf(s)); }
  function isResolved(s) { return isPerformed(s) || statusOf(s)==='skipped'; }
  function adjustmentPercent(s) {
    return s.adjusted ? (s.adjustment?.percent || s.adjustmentPercent || 5) : 0;
  }
  function normalizeReports(value) {
    if (value == null) return [];
    if (!Array.isArray(value) || value.length > 300) throw new Error('Historique des reports invalide.');
    return value.map(r => {
      if (!r || !validDate(r.from) || !validDate(r.to) || r.from===r.to) throw new Error('Date de report invalide.');
      return {from:r.from,to:r.to,reason:String(r.reason||'').slice(0,300),at:typeof r.at==='string'?r.at:null};
    });
  }
  function reportMarkers(state, from, to=from) {
    const markers=[];
    for (const s of state.sessions) {
      const latestByDate=new Map();
      for (const h of (s.rescheduleHistory||[])) {
        if(h.from>=from && h.from<=to && h.from!==s.date) latestByDate.set(h.from,h);
      }
      for (const h of latestByDate.values()) markers.push({id:s.id,from:h.from,to:s.date,title:s.title,sport:s.sport,reason:h.reason});
    }
    return markers.sort((a,b)=>a.from.localeCompare(b.from));
  }
  function outgoingReports(state, start) {
    const end=addDays(start,6), unique=new Map();
    for(const m of reportMarkers(state,start,end)) {
      if(m.to<start || m.to>end) unique.set(m.id,m);
    }
    return [...unique.values()];
  }
  function normalize(raw, plan) {
    if (!raw || !Array.isArray(raw.sessions) || raw.sessions.length > 15000) throw new Error('Sauvegarde non reconnue.');
    const seen = new Set(), originals = new Map(plan.map(s => [s.id,s]));
    const sessions = raw.sessions.map((source,idx) => {
      if (!source || typeof source.id !== 'string' || source.id.length > 140 || seen.has(source.id)) throw new Error('Identifiant de s\u00e9ance invalide ou en double.');
      seen.add(source.id);
      if (!validDate(source.date) || !ALL_SPORTS.includes(source.sport)) throw new Error('Date ou sport invalide dans la sauvegarde.');
      const duration = nullableNumber(source.duration,1440);
      if (!duration) throw new Error('Dur\u00e9e pr\u00e9vue manquante.');
      const original = originals.get(source.id);
      if(source.status != null && !OUTCOMES.includes(source.status)) throw new Error('Statut de s\u00e9ance invalide.');
      const outcome=statusOf(source);
      const s = {
        id:source.id, date:source.date, sport:source.sport,
        title:String(source.title || 'S\u00e9ance').slice(0,160),
        duration, notes:String(source.notes || '').slice(0,6000),
        phase:String(source.phase || phaseFor(source.date)).slice(0,120),
        deload:Boolean(source.deload), status:outcome, completed:['completed','shortened'].includes(outcome),
        rating:outcome!=='skipped' && ['easy','normal','hard'].includes(source.rating) ? source.rating : null,
        comment:String(source.comment || '').slice(0,3000), adjusted:Boolean(source.adjusted),
        order:Number.isFinite(source.order) ? source.order : idx,
        originalDate:validDate(source.originalDate) ? source.originalDate : (original?.date || source.date),
        custom:Boolean(source.custom || !original),
        actual:outcome==='skipped'?[]:normalizeActual(source.actual,source.sport),
        reason:String(source.reason||'').slice(0,300),
        rescheduleHistory:normalizeReports(source.rescheduleHistory),
        adjustmentPercent:source.adjusted ? (Number(source.adjustmentPercent)||Number(source.adjustment?.percent)||5) : null,
        plannedDistanceKm:nullableNumber(source.plannedDistanceKm,2000),
        adaptationEvaluated:Boolean(source.adaptationEvaluated || outcome!=='planned'),
        updatedAt:typeof source.updatedAt === 'string' ? source.updatedAt : null
      };
      if (source.adjustment && typeof source.adjustment === 'object') {
        const base = nullableNumber(source.adjustment.baseDuration,1440);
        if (base) s.adjustment = {
          sourceId:String(source.adjustment.sourceId || ''), baseDuration:base,
          baseDistanceKm:nullableNumber(source.adjustment.baseDistanceKm,2000),
          percent:Number(source.adjustment.percent)||s.adjustmentPercent||5
        };
      }
      return s;
    });
    return {schemaVersion:7, planVersion:'2026-10-full-year', sessions, updatedAt:raw.updatedAt || null};
  }
  function initial(plan) { return normalize({sessions:clone(plan)},plan); }
  function sorted(sessions) { return [...sessions].sort((a,b)=>a.date.localeCompare(b.date) || (a.order??0)-(b.order??0) || a.id.localeCompare(b.id)); }
  function forWeek(state,start) { const end=addDays(start,6); return sorted(state.sessions.filter(s=>s.date>=start && s.date<=end)); }
  function weekComplete(state,start) {
    const s=forWeek(state,start), reports=outgoingReports(state,start);
    return (s.length>0 || reports.length>0) && s.every(isResolved);
  }
  function bounds(state) {
    const dates=state.sessions.map(s=>s.date).sort();
    return {first:monday(dates[0] && dates[0]<START ? dates[0] : START),last:monday(dates.at(-1)>END ? dates.at(-1) : END)};
  }
  function defaultWeek(state,today=localISO(new Date())) {
    const b=bounds(state); let w=monday(today);
    if (w<b.first) w=b.first; if (w>b.last) w=b.last;
    while (weekComplete(state,w) && w<b.last) w=addDays(w,7);
    return w;
  }
  function removePendingAdjustment(s) {
    if (!isPerformed(s) && s.adjustment) {
      s.duration=s.adjustment.baseDuration;
      s.plannedDistanceKm=s.adjustment.baseDistanceKm;
      s.adjusted=false; s.adjustmentPercent=null; delete s.adjustment;
    }
  }
  function moveSession(state,id,targetDate,beforeId=null) {
    if (!validDate(targetDate)) throw new Error('Date de destination invalide.');
    const s=state.sessions.find(x=>x.id===id); if(!s) throw new Error('S\u00e9ance introuvable.');
    const from=s.date;
    s.date=targetDate;
    // A move must never import an automatic increase into a deload calendar week.
    if(protectedSession(s)) removePendingAdjustment(s);
    const dest=sorted(state.sessions.filter(x=>x.date===targetDate && x.id!==id));
    let at=dest.findIndex(x=>x.id===beforeId); if(at<0) at=dest.length;
    dest.splice(at,0,s); dest.forEach((x,i)=>x.order=i);
    return {from,to:targetDate,deload:protectedSession(s)};
  }
  function editSession(state,id,fields,newId) {
    if(!validDate(fields.date) || !ALL_SPORTS.includes(fields.sport)) throw new Error('V\u00e9rifier la date et le sport.');
    const title=String(fields.title||'').trim(); if(!title) throw new Error('Ajouter un titre.');
    const duration=nullableNumber(fields.duration,1440); if(!duration) throw new Error('Ajouter une dur\u00e9e pr\u00e9vue.');
    let s=id ? state.sessions.find(x=>x.id===id) : null;
    if(id && !s) throw new Error('S\u00e9ance introuvable.');
    if(s && isPerformed(s) && fields.sport!==s.sport) throw new Error('Le sport d\u2019une s\u00e9ance termin\u00e9e reste inchang\u00e9 pour conserver son bilan.');
    if(!s) {
      s={id:newId,date:fields.date,sport:fields.sport,title,duration,notes:'',phase:phaseFor(fields.date),deload:isDeloadDate(fields.date),status:'planned',completed:false,rating:null,comment:'',reason:'',rescheduleHistory:[],adjusted:false,adjustmentPercent:null,actual:[],custom:true,originalDate:fields.date,order:state.sessions.length,adaptationEvaluated:false,plannedDistanceKm:null};
      state.sessions.push(s);
    }
    const changedLoad=duration!==s.duration || fields.sport!==s.sport;
    if(changedLoad) {s.adjusted=false;s.adjustmentPercent=null;delete s.adjustment;}
    s.sport=fields.sport;s.title=title.slice(0,160);s.duration=duration;
    s.notes=String(fields.notes||'').slice(0,6000);
    s.plannedDistanceKm=fields.sport==='Brick' ? null : nullableNumber(fields.plannedDistanceKm,2000);
    if(s.date!==fields.date) moveSession(state,s.id,fields.date);
    return s;
  }

  function adaptNext(state,s) {
    if(protectedSession(s)) return {applied:false,reason:'deload'};
    const next=sorted(state.sessions.filter(x=>x.sport===s.sport && x.date>s.date && !isResolved(x)))[0];
    if(!next) return {applied:false,reason:'none'};
    // Never jump over a deload to increase a later week.
    if(protectedSession(next)) return {applied:false,reason:'deload'};
    if(next.adjusted) return {applied:false,reason:'already'};
    const factor=1+INCREASE_PERCENT/100, increased=Math.round(next.duration*factor);
    if(increased<=next.duration) return {applied:false,reason:'rounding'};
    if(increased>1440 || (next.plannedDistanceKm||0)*factor>2000) return {applied:false,reason:'limit'};
    next.adjustment={sourceId:s.id,baseDuration:next.duration,baseDistanceKm:next.plannedDistanceKm??null,percent:INCREASE_PERCENT};
    next.duration=increased;
    if(next.plannedDistanceKm) next.plannedDistanceKm=Math.round(next.plannedDistanceKm*factor*1000)/1000;
    next.adjusted=true;next.adjustmentPercent=INCREASE_PERCENT;
    return {applied:true,id:next.id,date:next.date,duration:next.duration,percent:INCREASE_PERCENT};
  }
  function retractPendingAdjustment(state,id) {
    let count=0;
    for(const s of state.sessions) {
      if(s.adjustment?.sourceId===id && !isPerformed(s)) {removePendingAdjustment(s);count++;}
    }
    return count;
  }
  function reportSession(state,id,fields) {
    const s=state.sessions.find(x=>x.id===id);if(!s)throw new Error('S\u00e9ance introuvable.');
    if(isPerformed(s))throw new Error('Une s\u00e9ance d\u00e9j\u00e0 r\u00e9alis\u00e9e garde son bilan. D\u00e9placez-la avec le bouton D\u00e9placer.');
    const to=fields.reportDate;
    if(!validDate(to) || to===s.date)throw new Error('Choisir une autre date pour le report.');
    const from=s.date, history=s.rescheduleHistory||(s.rescheduleHistory=[]);
    if(history.length>=300)throw new Error('Limite de reports atteinte pour cette s\u00e9ance.');
    history.push({from,to,reason:String(fields.reason||'').slice(0,300),at:new Date().toISOString()});
    s.status='planned';s.completed=false;s.rating=null;s.actual=[];s.reason='';s.adaptationEvaluated=false;
    moveSession(state,id,to);
    return {first:true,status:'rescheduled',from,to,adjustment:{applied:false,reason:'rescheduled'}};
  }

  function completeSession(state,id,fields) {
    const s=state.sessions.find(x=>x.id===id); if(!s) throw new Error('S\u00e9ance introuvable.');
    const status=fields.status||'completed';
    if(status==='rescheduled')return reportSession(state,id,fields);
    if(!['completed','shortened','skipped'].includes(status))throw new Error('Choisir un statut de s\u00e9ance.');
    const performed=status!=='skipped';
    if(performed && !['easy','normal','hard'].includes(fields.rating)) throw new Error('Choisir un ressenti.');
    const actual=performed?normalizeActual(fields.actual,s.sport):[];
    if(status==='shortened' && !actual.some(a=>a.durationMin))throw new Error('Pour une s\u00e9ance \u00e9court\u00e9e, renseignez le temps r\u00e9ellement effectu\u00e9.');
    const first=!isResolved(s), retracted=(status!=='completed' || fields.rating!=='easy')?retractPendingAdjustment(state,id):0;
    s.status=status;s.completed=performed;s.actual=actual;s.rating=performed?fields.rating:null;
    s.reason=String(fields.reason||'').slice(0,300);s.comment=String(fields.comment||'').slice(0,3000);
    let adjustment={applied:false,reason:status==='completed'?'unchanged':status};
    // A shortened or missed workout is not evidence for more volume. No catch-up is added.
    if(first && !s.adaptationEvaluated && status==='completed' && fields.rating==='easy') adjustment=adaptNext(state,s);
    s.adaptationEvaluated=true;
    return {first,status,retracted,adjustment};
  }

  function actualRows(s) {
    if(!isPerformed(s)) return [];
    const disciplines=s.sport==='Brick' ? ['V\u00e9lo','Course'] : [s.sport];
    return disciplines.map(sport=>({sessionId:s.id,date:s.date,rating:s.rating,status:statusOf(s),sport,durationMin:null,distanceKm:null,...(s.actual||[]).find(a=>a.sport===sport)}))
      .filter(a=>statusOf(s)!=='shortened' || a.durationMin || a.distanceKm);
  }
  function metrics(state,{from='2000-01-01',to='2100-12-31',sport='all'}={}) {
    const within=s=>s.date>=from && s.date<=to && (sport==='all' || s.sport===sport || (s.sport==='Brick' && ['Course','V\u00e9lo'].includes(sport)));
    const done=state.sessions.filter(s=>isPerformed(s) && within(s));
    const allRows=done.flatMap(actualRows), rows=allRows.filter(r=>sport==='all'||r.sport===sport);
    const totals={};
    for(const sp of SPORTS) {
      const r=rows.filter(x=>x.sport===sp), paired=r.filter(x=>x.durationMin && x.distanceKm);
      const ptime=paired.reduce((a,x)=>a+x.durationMin,0), pdist=paired.reduce((a,x)=>a+x.distanceKm,0);
      totals[sp]={count:r.length,durationMin:r.reduce((a,x)=>a+(x.durationMin||0),0),distanceKm:r.reduce((a,x)=>a+(x.distanceKm||0),0),timeCount:r.filter(x=>x.durationMin).length,distanceCount:r.filter(x=>x.distanceKm).length,speedKmh:ptime ? pdist/(ptime/60) : null,paceMinKm:pdist ? ptime/pdist : null,paceSec100m:pdist ? ptime*60/(pdist*10) : null,missingTime:r.filter(x=>!x.durationMin).length};
    }
    return {rows,totals,count:new Set(rows.map(x=>x.sessionId)).size,shortenedCount:new Set(rows.filter(r=>r.status==='shortened').map(r=>r.sessionId)).size,skippedCount:state.sessions.filter(s=>statusOf(s)==='skipped' && within(s)).length,minutes:rows.reduce((a,x)=>a+(x.durationMin||0),0),distanceKm:rows.reduce((a,x)=>a+(x.distanceKm||0),0),missingTime:rows.filter(x=>!x.durationMin).length};
  }
  function weeklyTotals(state,from,to,sport='all') {
    const {rows}=metrics(state,{from,to,sport}), result=[];
    for(let w=monday(from);w<=monday(to);w=addDays(w,7)) {
      const row={week:w,...Object.fromEntries(SPORTS.map(x=>[x,0]))};
      rows.filter(x=>monday(x.date)===w).forEach(x=>row[x.sport]+=x.durationMin||0);result.push(row);
      if(result.length>5300) break;
    }
    return result;
  }
  function paceText(seconds) {
    if(!Number.isFinite(seconds) || seconds<=0) return '\u2014';
    const n=Math.round(seconds);return `${Math.floor(n/60)}:${pad(n%60)}`;
  }
  return {INCREASE_PERCENT,OUTCOMES,statusOf,isPerformed,isResolved,adjustmentPercent,reportMarkers,outgoingReports,reportSession,KEY,START,END,SPORTS,ALL_SPORTS,clone,localISO,validDate,date,addDays,monday,weekNumber,isDeloadDate,protectedSession,phaseFor,nullableNumber,normalize,initial,sorted,forWeek,weekComplete,bounds,defaultWeek,moveSession,editSession,adaptNext,completeSession,actualRows,metrics,weeklyTotals,paceText};
});
