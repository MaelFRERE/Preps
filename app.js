/* TriPlan v7 - static, dependency-free application. No external requests. */
(() => {
  'use strict';
  const C=window.TriCore, PLAN=window.TRIPLAN_PLAN;
  const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const ICONS={
    calendar:'<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18m-13 4h2m4 0h2"/>',
    chart:'<path d="M4 3v17h17M8 15v-4m5 4V7m5 8V4"/>',
    list:'<path d="M8 6h12M8 12h12M8 18h12M3 6h.01M3 12h.01M3 18h.01"/>',
    plus:'<path d="M12 5v14M5 12h14"/>',
    left:'<path d="m14 6-6 6 6 6"/>',right:'<path d="m10 6 6 6-6 6"/>',
    close:'<path d="m6 6 12 12M6 18 18 6"/>',
    check:'<path d="m5 12 4 4L19 6"/>',
    data:'<path d="M12 3v12m-4-4 4 4 4-4M4 15v5h16v-5"/>',
    grip:'<circle cx="8" cy="5" r="1.5"/><circle cx="16" cy="5" r="1.5"/><circle cx="8" cy="12" r="1.5"/><circle cx="16" cy="12" r="1.5"/><circle cx="8" cy="19" r="1.5"/><circle cx="16" cy="19" r="1.5"/>'
  };
  const icon=name=>`<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]||ICONS.calendar}</svg>`;
  const sportClass=sp=>sp==='Natation'?'swim':sp==='V\u00e9lo'?'bike':sp==='Brick'?'brick':'run';
  const sportLabel=sp=>sp==='Course'?'Course \u00e0 pied':sp==='Brick'?'V\u00e9lo + course':sp;
  const ratings={easy:'Facile',normal:'Normal',hard:'Difficile'};
  const outcomes={completed:'Termin\u00e9e',shortened:'\u00c9court\u00e9e',skipped:'Non faite',rescheduled:'Report\u00e9e',planned:'Pr\u00e9vue'};
  const num=(n,max=1)=>Number(n).toLocaleString('fr-FR',{maximumFractionDigits:max});
  const dformat=(s,opts)=>C.date(s).toLocaleDateString('fr-FR',opts);
  const shortDate=s=>dformat(s,{day:'numeric',month:'short'});
  function dateRange(w) {
    const end=C.addDays(w,6),a=C.date(w),b=C.date(end);
    if(a.getMonth()===b.getMonth() && a.getFullYear()===b.getFullYear()) return `${a.getDate()} \u2013 ${dformat(end,{day:'numeric',month:'long',year:'numeric'})}`;
    return `${shortDate(w)} \u2013 ${dformat(end,{day:'numeric',month:'short',year:'numeric'})}`;
  }
  function durationText(min) {
    if(min==null) return '\u2014';
    const total=Math.round(min),hours=Math.floor(total/60),minutes=total%60;
    return hours ? `${hours} h${minutes?' '+String(minutes).padStart(2,'0'):''}` : `${num(min)} min`;
  }
  function distanceText(km,sport) {
    if(km==null) return '\u2014';
    return sport==='Natation'?`${num(km*1000,0)} m`:`${num(km,2)} km`;
  }
  function speedText(kmh) {return kmh ? `${num(kmh,1)} km/h` : '\u2014';}
  function paceFor(sport,distance,minutes) {
    if(!distance || !minutes) return '\u2014';
    return sport==='Natation' ? `${C.paceText(minutes*60/(distance*10))} /100 m` : sport==='Course' ? `${C.paceText(minutes*60/distance)} /km` : speedText(distance/(minutes/60));
  }
  function actualText(row,includeSport=false) {
    const pieces=[];
    if(includeSport) pieces.push(sportLabel(row.sport));
    if(row.distanceKm) pieces.push(distanceText(row.distanceKm,row.sport));
    if(row.durationMin) pieces.push(durationText(row.durationMin));
    if(row.distanceKm && row.durationMin) pieces.push(paceFor(row.sport,row.distanceKm,row.durationMin));
    return pieces.join(' \u00b7 ');
  }
  let storageProblem='',storageReadOnly=false,corruptRaw=null;
  function load() {
    try {
      const raw=localStorage.getItem(C.KEY);
      if(!raw) return C.initial(PLAN);
      let parsed;
      try {parsed=JSON.parse(raw);} catch {corruptRaw=raw;throw new Error('La sauvegarde existante est illisible.');}
      const normalized=C.normalize(parsed,PLAN);
      if(parsed.schemaVersion===6) {
        try {if(!localStorage.getItem(C.KEY+'_backup_v6')) localStorage.setItem(C.KEY+'_backup_v6',raw);} catch {}
      }
      if(!parsed.schemaVersion) {
        try {if(!localStorage.getItem(C.KEY+'_backup_v5')) localStorage.setItem(C.KEY+'_backup_v5',raw);} catch {}
      }
      return normalized;
    } catch(error) {
      storageReadOnly=true;
      storageProblem='Sauvegarde locale indisponible ou illisible. Les changements restent en m\u00e9moire : exportez vos donn\u00e9es avant de fermer. Aucune ancienne sauvegarde n\u2019est effac\u00e9e.';
      return C.initial(PLAN);
    }
  }
  let state=load(),currentMonday=C.defaultWeek(state),activeView='week',statsSport='all';
  let editorId=null,moveId=null,feedbackId=null,mutationSeq=0,toastTimer=null,lastToday=C.localISO(new Date());
  let drag=null,ignoreGripClickUntil=0;
  function persist() {
    if(storageReadOnly) return false;
    try {localStorage.setItem(C.KEY,JSON.stringify(state));storageProblem='';return true;}
    catch {storageProblem='Les changements ne peuvent pas \u00eatre sauvegard\u00e9s dans ce navigateur. Exportez votre sauvegarde avant de fermer cette page.';return false;}
  }
  function showStorage() {
    const el=$('#storageAlert');el.hidden=!storageProblem;el.textContent=storageProblem;
  }
  function transact(fn) {
    const draft=C.clone(state),result=fn(draft);
    draft.updatedAt=new Date().toISOString();state=draft;mutationSeq++;persist();showStorage();
    return result;
  }
  function toast(message,actionText=null,action=null) {
    clearTimeout(toastTimer);
    $('#toastMessage').textContent=message;$('#toast').hidden=false;
    const btn=$('#toastAction');btn.hidden=!actionText;btn.textContent=actionText||'';
    btn.onclick=()=>{hideToast();action?.();};
    toastTimer=setTimeout(hideToast,actionText?14000:8000);
  }
  function hideToast() {$('#toast').hidden=true;clearTimeout(toastTimer);}

  function dayStatus(arr) {
    if(!arr.length || !arr.every(C.isResolved)) return '';
    if(arr.some(s=>C.isPerformed(s) && s.rating==='hard'))return 'hard';
    return arr.every(s=>C.statusOf(s)==='skipped')?'neutral':'good';
  }
  function reportHTML(m) {
    return `<div class="report-marker"><strong>Report\u00e9e</strong><span>${esc(m.title)} \u2192 ${esc(shortDate(m.to))}</span>${m.reason?`<small>${esc(m.reason)}</small>`:''}<button type="button" class="text-btn" data-view-week="${C.monday(m.to)}">Voir la nouvelle semaine</button></div>`;
  }
  function renderWeek() {
    const ws=C.forWeek(state,currentMonday),today=C.localISO(new Date()),b=C.bounds(state),outgoing=C.outgoingReports(state,currentMonday);
    const done=ws.filter(C.isPerformed).length,skipped=ws.filter(s=>C.statusOf(s)==='skipped').length;
    const treated=ws.filter(C.isResolved).length+outgoing.length,total=ws.length+outgoing.length,planned=ws.reduce((a,s)=>a+s.duration,0);
    $('#weekTitle').textContent=dateRange(currentMonday);
    $('#prev').disabled=currentMonday<=b.first;$('#next').disabled=currentMonday>=b.last;
    const deload=C.isDeloadDate(currentMonday);
    const phase=deload?'Semaine deload \u00b7 r\u00e9cup\u00e9ration':(ws[0]?.phase || C.phaseFor(currentMonday));
    $('#weekBadge').innerHTML=`<span class="badge ${deload?'deload':''}">${esc(phase)}</span>`;
    $('#weekCount').innerHTML=`<strong>${treated}/${total}</strong> trait\u00e9es &nbsp;\u00b7&nbsp; ${esc(durationText(planned))} planifi\u00e9es${skipped||outgoing.length?`<small>${done} r\u00e9alis\u00e9e(s) \u00b7 ${skipped} non faite(s) \u00b7 ${outgoing.length} report\u00e9e(s)</small>`:''}`;
    const pct=total?Math.round(treated/total*100):0;
    $('#weekBar').style.width=pct+'%';$('.week-meter').setAttribute('aria-valuenow',pct);
    const ribbons=[],days=[],markers=C.reportMarkers(state,currentMonday,C.addDays(currentMonday,6));
    for(let i=0;i<7;i++) {
      const d=C.addDays(currentMonday,i),arr=ws.filter(s=>s.date===d),reports=markers.filter(m=>m.from===d);
      const status=dayStatus(arr)||(!arr.length && reports.length?'neutral':'');
      ribbons.push(`<button type="button" class="day-pill ${d===today?'today':''} ${status}" data-drop-date="${d}" data-jump-day="${d}" aria-label="${esc(dformat(d,{weekday:'long',day:'numeric',month:'long'}))}" ${d===today?'aria-current="date"':''}><span>${esc(dformat(d,{weekday:'short'}).replace('.',''))}</span><strong>${C.date(d).getDate()}</strong></button>`);
      days.push(`<section id="day-${d}" class="day ${status} ${arr.length||reports.length?'':'rest-day'}" data-drop-date="${d}" aria-label="${esc(dformat(d,{weekday:'long',day:'numeric',month:'long'}))}"><header class="day-head"><strong>${esc(dformat(d,{weekday:'long'}))}</strong><span>${status?(arr.every(C.isPerformed)&&arr.length?'Termin\u00e9':'Trait\u00e9'):esc(shortDate(d))}</span></header><div class="day-list">${arr.map(sessionHTML).join('')}${reports.map(reportHTML).join('')}${!arr.length&&!reports.length?'<p class="rest">Repos / aucune s\u00e9ance</p>':''}</div><button type="button" class="day-add" data-add-date="${d}">+ Ajouter</button></section>`);
    }
    $('#weekRibbon').innerHTML=ribbons.join('');$('#weekGrid').innerHTML=days.join('');
    $('#weekGrid').querySelectorAll('.grip').forEach(handle=>handle.addEventListener('pointerdown',startDrag));
  }

  function comparisonText(s) {
    if(!C.isPerformed(s))return '';
    const a=C.actualRows(s),hasTime=a.some(r=>r.durationMin);
    if(!hasTime)return '';
    const total=a.reduce((sum,r)=>sum+(r.durationMin||0),0),missing=a.some(r=>!r.durationMin);
    if(missing)return `${durationText(total)} renseign\u00e9es / ${durationText(s.duration)} pr\u00e9vues (bilan incomplet)`;
    const delta=total-s.duration;
    return `${durationText(total)} r\u00e9alis\u00e9es / ${durationText(s.duration)} pr\u00e9vues${Math.abs(delta)>0.01?' \u00b7 '+(delta>0?'+':'\u2212')+num(Math.abs(delta))+' min':''}`;
  }
  function sessionHTML(s) {
    const status=C.statusOf(s),performed=C.isPerformed(s),resolved=C.isResolved(s);
    const cls=performed?'completed '+(s.rating==='hard'?'hard':'good'):status==='skipped'?'skipped':'';
    const records=C.actualRows(s).filter(a=>a.durationMin||a.distanceKm),rate=C.adjustmentPercent(s);
    let added='';
    if(s.custom) added+='<span class="small-badge">Personnelle</span> ';
    if((s.rescheduleHistory||[]).length) added+='<span class="small-badge">Report\u00e9e</span> ';
    else if(s.originalDate && s.originalDate!==s.date) added+='<span class="small-badge">D\u00e9plac\u00e9e</span> ';
    if(s.deload && !C.isDeloadDate(s.date)) added+='<span class="small-badge">S\u00e9ance all\u00e9g\u00e9e</span> ';
    if(s.adjusted) added+=`<span class="small-badge">+${num(rate)} %${rate!==C.INCREASE_PERCENT?' (ancien)':''}</span>`;
    return `<article class="session ${cls}" data-card-id="${esc(s.id)}">
      <div class="session-top"><span class="sport-label ${sportClass(s.sport)}">${esc(sportLabel(s.sport))}</span><button class="grip" type="button" data-grip-id="${esc(s.id)}" title="Faire glisser ou choisir une date" aria-label="D\u00e9placer ${esc(s.title)}" aria-describedby="dragHelp">${icon('grip')}</button></div>
      <h3>${esc(s.title)}</h3>
      <div class="duration"><strong>${num(s.duration)}</strong><span>min pr\u00e9vues</span></div>
      ${s.plannedDistanceKm?`<p class="distance-planned">${esc(distanceText(s.plannedDistanceKm,s.sport))} pr\u00e9vus</p>`:''}
      ${added?`<div>${added}</div>`:''}
      ${s.notes?`<details class="session-details"><summary>Contenu de la s\u00e9ance</summary><p>${esc(s.notes)}</p>${s.adjustment?`<p class="adjust-note">Le +${num(rate)} % concerne le volume pr\u00e9vu de cette s\u00e9ance. L'intensit\u00e9 reste inchang\u00e9e ; les minutes suppl\u00e9mentaires se font en facile.</p>`:''}</details>`:''}
      ${resolved?`<p class="rating-status">${icon('check')}${esc(outcomes[status])}${performed?' \u00b7 '+esc(ratings[s.rating]||'Bilan ancien'):''}</p>${performed?(records.length?records.map(a=>`<div class="actual-stats">${esc(actualText(a,s.sport==='Brick'))}</div>`).join(''):'<p class="help">Chiffres non renseign\u00e9s</p>'):'<p class="help">Aucun volume compt\u00e9. Aucun rattrapage ajout\u00e9.</p>'}`:''}
      ${comparisonText(s)?`<p class="volume-comparison">${esc(comparisonText(s))}</p>`:''}
      ${s.reason?`<p class="outcome-reason">${esc(s.reason)}</p>`:''}
      <div class="card-actions"><button type="button" data-edit-id="${esc(s.id)}">Modifier</button><button type="button" data-move-id="${esc(s.id)}">D\u00e9placer</button></div>
      <button type="button" class="complete-button" data-feedback-id="${esc(s.id)}">${resolved?'Voir / corriger le bilan':'Faire le bilan'}</button>
    </article>`;
  }
  function renderActive() {
    renderWeek();refreshPlanFilters();
    if(activeView==='progress') renderProgress();if(activeView==='plan') renderPlan();
  }
  function switchView(name) {
    if(!['week','plan','progress'].includes(name))return;
    activeView=name;
    $$('.view').forEach(el=>el.hidden=el.id!==name);
    $$('.tab').forEach(btn=>{btn.classList.toggle('active',btn.dataset.view===name);if(btn.dataset.view===name)btn.setAttribute('aria-current','page');else btn.removeAttribute('aria-current');});
    if(name==='week')renderWeek();if(name==='progress')renderProgress();if(name==='plan'){refreshPlanFilters();renderPlan();}
  }
  function setWeek(w,scroll=false) {
    const b=C.bounds(state);currentMonday=w<b.first?b.first:w>b.last?b.last:w;
    renderWeek();if(scroll)$('#weekHeading').scrollIntoView({block:'start'});
  }
  function openDialog(el) {hideToast();el.showModal();}
  function closeDialog(el) {el.close();}
  function defaultAddDate() {
    const today=C.localISO(new Date());return today>=currentMonday && today<=C.addDays(currentMonday,6)?today:currentMonday;
  }
  function openEditor(id=null,dateValue=null) {
    const s=id?state.sessions.find(x=>x.id===id):null;editorId=id;
    $('#editorTitle').textContent=id?'Modifier la s\u00e9ance':'Ajouter une s\u00e9ance';
    $('#editDate').value=s?.date||dateValue||defaultAddDate();$('#editSport').value=s?.sport||'Course';
    $('#editSport').disabled=Boolean(s && C.isPerformed(s));
    $('#editTitle').value=s?.title||'';$('#editDuration').value=s?.duration||60;
    $('#editDistance').value=s?.plannedDistanceKm ? num(s.plannedDistanceKm*(s.sport==='Natation'?1000:1),3).replace(/\s/g,'') : '';
    $('#editNotes').value=s?.notes||'';$('#editorError').textContent='';updateEditorHint();openDialog($('#editorDialog'));
  }
  function updateEditorHint() {
    const sp=$('#editSport').value,d=$('#editDate').value;
    $('#plannedDistanceField').hidden=sp==='Brick';
    $('#plannedDistanceLabel').textContent=sp==='Natation'?'Distance pr\u00e9vue (m)':'Distance pr\u00e9vue (km)';
    let hint='La modification reste enregistr\u00e9e sur cet appareil.';
    if(C.validDate(d) && C.isDeloadDate(d)) hint='Semaine deload : aucun +10 % automatique. Un ajout ou d\u00e9placement manuel conserve votre dur\u00e9e ; v\u00e9rifiez que la semaine reste all\u00e9g\u00e9e.';
    if($('#editSport').disabled)hint+=' Le sport ne change pas, pour conserver le bilan d\u00e9j\u00e0 enregistr\u00e9.';
    $('#editorHint').textContent=hint;
  }
  function submitEditor(e) {
    e.preventDefault();
    try {
      const sport=$('#editSport').value,dist=C.nullableNumber($('#editDistance').value,sport==='Natation'?2000000:2000);
      const fields={date:$('#editDate').value,sport,title:$('#editTitle').value,duration:$('#editDuration').value,notes:$('#editNotes').value,plannedDistanceKm:dist==null?null:dist/(sport==='Natation'?1000:1)};
      const newId='custom-'+(crypto.randomUUID?crypto.randomUUID():Date.now()+'-'+Math.random().toString(36).slice(2));
      transact(draft=>C.editSession(draft,editorId,fields,newId));
      closeDialog($('#editorDialog'));currentMonday=C.monday(fields.date);switchView('week');refreshPlanFilters();
      toast(editorId?'S\u00e9ance modifi\u00e9e.':'S\u00e9ance ajout\u00e9e au planning.');
    } catch(error) {$('#editorError').textContent=error.message;}
  }
  function openMove(id) {
    const s=state.sessions.find(x=>x.id===id);if(!s)return;moveId=id;
    $('#moveName').textContent=sportLabel(s.sport)+' \u00b7 '+s.title;$('#moveDate').value=s.date;$('#moveError').textContent='';updateMoveHint();openDialog($('#moveDialog'));
  }
  function updateMoveHint() {
    const d=$('#moveDate').value;
    $('#moveHint').textContent=C.validDate(d)&&C.isDeloadDate(d)?'Destination en deload : aucun +10 % automatique. La dur\u00e9e manuelle n\u2019est pas r\u00e9duite automatiquement.':'Choisissez n\u2019importe quel jour, y compris une autre semaine. Le contenu de la s\u00e9ance est conserv\u00e9.';
  }
  function moveWithUndo(id,date,before=null) {
    const snapshot=C.clone(state);
    const result=transact(draft=>C.moveSession(draft,id,date,before));
    const sequence=mutationSeq;
    renderActive();
    const suffix=result.deload?' Attention : semaine ou s\u00e9ance deload.':'';
    toast('S\u00e9ance d\u00e9plac\u00e9e au '+shortDate(date)+'.'+suffix,'Annuler',()=>{
      if(mutationSeq!==sequence){toast('D\u2019autres changements ont \u00e9t\u00e9 enregistr\u00e9s. Utilisez D\u00e9placer pour revenir en arri\u00e8re.');return;}
      state=snapshot;state.updatedAt=new Date().toISOString();mutationSeq++;persist();showStorage();currentMonday=C.monday(result.from);renderActive();toast('D\u00e9placement annul\u00e9.');
    });
  }
  function submitMove(e) {
    e.preventDefault();try {
      const d=$('#moveDate').value;if(!C.validDate(d))throw new Error('Choisir une date valide.');
      closeDialog($('#moveDialog'));currentMonday=C.monday(d);switchView('week');moveWithUndo(moveId,d);
    } catch(error) {$('#moveError').textContent=error.message;}
  }

  function selectedOutcome() { return $('#feedbackForm input[name="outcome"]:checked')?.value||'completed'; }
  function updateOutcomeFields() {
    const s=state.sessions.find(x=>x.id===feedbackId);if(!s)return;
    const outcome=selectedOutcome(),performed=['completed','shortened'].includes(outcome);
    $('#performedFeedback').hidden=!performed;
    $('#reportDateField').hidden=outcome!=='rescheduled';
    $('#outcomeReasonField').hidden=outcome==='completed';
    let hint='';
    if(outcome==='skipped')hint=C.isPerformed(s)?'Ce choix retirera les chiffres de cette s\u00e9ance des statistiques. Aucun rattrapage ni +10 % ne sera ajout\u00e9.':'La s\u00e9ance compte comme trait\u00e9e, pas comme r\u00e9alis\u00e9e. Aucun rattrapage ni +10 %.';
    else if(outcome==='rescheduled')hint='La m\u00eame s\u00e9ance sera d\u00e9plac\u00e9e, sans copie. L\u2019ancien jour gardera une trace du report. Aucun volume r\u00e9alis\u00e9 n\u2019est ajout\u00e9.';
    else if(outcome==='shortened')hint='Seul le temps r\u00e9ellement effectu\u00e9 sera compt\u00e9. Aucun +10 % ni rattrapage automatique pour une s\u00e9ance \u00e9court\u00e9e.';
    else if(C.isResolved(s))hint='Corriger le bilan ne d\u00e9clenche pas un second +10 %. Une correction peut retirer un ajustement encore non r\u00e9alis\u00e9.';
    else if(C.protectedSession(s))hint='Deload : aucun +10 % ne sera appliqu\u00e9, m\u00eame avec un ressenti facile.';
    else hint='Termin\u00e9e + Facile : +10 % sur le volume pr\u00e9vu de la prochaine s\u00e9ance du m\u00eame sport, hors deload. La dur\u00e9e r\u00e9elle ne remplace pas cette base.';
    $('#feedbackHint').textContent=hint;
    $('#saveFeedback').textContent=outcome==='rescheduled'?'Reporter la s\u00e9ance':'Enregistrer le bilan';
    $('#feedbackError').textContent='';updateMetricResults();
  }
  function openFeedback(id) {
    const s=state.sessions.find(x=>x.id===id);if(!s)return;feedbackId=id;
    $('#feedbackTitle').textContent=s.title;
    $('#feedbackSubtitle').textContent=`${sportLabel(s.sport)} \u00b7 ${dformat(s.date,{day:'numeric',month:'long'})} \u00b7 ${durationText(s.duration)} pr\u00e9vues`;
    const outcome=C.isResolved(s)?C.statusOf(s):'completed';
    $$('#feedbackForm input[name="outcome"]').forEach(r=>{r.checked=r.value===outcome;r.disabled=r.value==='rescheduled' && C.isPerformed(s);});
    $('#feedbackReportDate').value=C.addDays(s.date,1);$('#feedbackReason').value=s.reason||'';
    $$('#feedbackForm input[name="rating"]').forEach(r=>r.checked=r.value===(s.rating||'normal'));
    const disciplines=s.sport==='Brick'?['V\u00e9lo','Course']:[s.sport];
    $('#metricFields').innerHTML=disciplines.map((sp,i)=>{
      const a=(s.actual||[]).find(x=>x.sport===sp)||{},dist=a.distanceKm?(a.distanceKm*(sp==='Natation'?1000:1)):null;
      return `<section class="metric-segment" data-metric-sport="${esc(sp)}"><h3>${esc(sportLabel(sp))}</h3><div class="metric-inputs"><div class="field"><label for="actualTime${i}">Dur\u00e9e r\u00e9alis\u00e9e (min)</label><input id="actualTime${i}" class="actual-time" type="text" inputmode="decimal" value="${a.durationMin?esc(num(a.durationMin,2).replace(/\s/g,'')):''}" placeholder="${s.sport==='Brick'?'Temps r\u00e9el':esc(s.duration+' pr\u00e9vues')}"></div><div class="field"><label for="actualDistance${i}">Distance (${sp==='Natation'?'m':'km'})</label><input id="actualDistance${i}" class="actual-distance" type="text" inputmode="decimal" value="${dist?esc(num(dist,3).replace(/\s/g,'')):''}" placeholder="Facultatif"></div></div><p class="metric-result" aria-live="polite"></p>${s.sport!=='Brick'?`<button type="button" class="metric-use-planned" data-use-planned="${s.duration}">Utiliser la dur\u00e9e pr\u00e9vue (${s.duration} min)</button>`:''}</section>`;
    }).join('');
    $('#feedbackComment').value=s.comment||'';
    updateOutcomeFields();openDialog($('#feedbackDialog'));
  }
  function readMetrics() {
    return $$('#metricFields .metric-segment').map(el=>{
      const sp=el.dataset.metricSport,dur=C.nullableNumber(el.querySelector('.actual-time').value,1440),distance=C.nullableNumber(el.querySelector('.actual-distance').value,sp==='Natation'?2000000:2000);
      return {sport:sp,durationMin:dur,distanceKm:distance==null?null:distance/(sp==='Natation'?1000:1)};
    });
  }

  function updateMetricResults() {
    let total=0,hasTime=false,missing=false,valid=true;
    $$('#metricFields .metric-segment').forEach(el=>{
      const out=el.querySelector('.metric-result');
      try {
        const sp=el.dataset.metricSport,t=C.nullableNumber(el.querySelector('.actual-time').value,1440),d=C.nullableNumber(el.querySelector('.actual-distance').value,sp==='Natation'?2000000:2000),km=d==null?null:d/(sp==='Natation'?1000:1);
        if(t){total+=t;hasTime=true;}else if(selectedOutcome()!=='shortened' || km)missing=true;
        out.textContent=t&&km ? `Vitesse : ${speedText(km/(t/60))}${sp!=='V\u00e9lo'?' \u00b7 Allure : '+paceFor(sp,km,t):''}`:'Vitesse / allure : renseignez dur\u00e9e + distance.';
      } catch {valid=false;out.textContent='V\u00e9rifiez les nombres saisis.';}
    });
    const s=state.sessions.find(x=>x.id===feedbackId),delta=total-(s?.duration||0),cmp=$('#actualComparison');
    cmp.hidden=!hasTime||!valid;
    cmp.textContent=s&&hasTime&&valid?`${durationText(total)} renseign\u00e9es / ${durationText(s.duration)} pr\u00e9vues${missing?' \u00b7 bilan incomplet':Math.abs(delta)>0.01?' \u00b7 '+(delta>0?'+':'\u2212')+num(Math.abs(delta))+' min':' \u00b7 dur\u00e9e identique'}`:'';
  }

  function submitFeedback(e) {
    e.preventDefault();
    try {
      const before=state.sessions.find(s=>s.id===feedbackId),sourceWeek=C.monday(before.date),wasComplete=C.weekComplete(state,sourceWeek);
      const status=selectedOutcome(),performed=['completed','shortened'].includes(status);
      const fields={status,rating:performed?$('#feedbackForm input[name="rating"]:checked')?.value:null,actual:performed?readMetrics():[],comment:$('#feedbackComment').value,reason:$('#feedbackReason').value,reportDate:$('#feedbackReportDate').value};
      const result=transact(draft=>C.completeSession(draft,feedbackId,fields));
      closeDialog($('#feedbackDialog'));
      let message=status==='rescheduled'?`S\u00e9ance report\u00e9e au ${shortDate(result.to)}, sans doublon.`:status==='skipped'?'S\u00e9ance non faite enregistr\u00e9e. Aucun rattrapage.':status==='shortened'?'S\u00e9ance \u00e9court\u00e9e : seul le r\u00e9alis\u00e9 est compt\u00e9.':result.first?'S\u00e9ance termin\u00e9e.':'Bilan mis \u00e0 jour.';
      if(result.adjustment.applied)message+=` +${result.adjustment.percent} % le ${shortDate(result.adjustment.date)} (${result.adjustment.duration} min).`;
      else if(result.first && fields.rating==='easy' && result.adjustment.reason==='deload')message+=' Le deload reste prot\u00e9g\u00e9.';
      if(result.retracted)message+=' L\u2019ajustement li\u00e9, encore non r\u00e9alis\u00e9, a \u00e9t\u00e9 retir\u00e9.';
      if(!wasComplete && C.weekComplete(state,sourceWeek)) {
        const last=C.bounds(state).last;
        if(sourceWeek<last) {
          currentMonday=C.addDays(sourceWeek,7);
          while(C.weekComplete(state,currentMonday) && currentMonday<last) currentMonday=C.addDays(currentMonday,7);
          switchView('week');message+=' Semaine trait\u00e9e : passage \u00e0 la suivante.';
          $('#weekHeading').scrollIntoView({block:'start'});
        } else message+=' Toutes les s\u00e9ances de cette semaine ont \u00e9t\u00e9 trait\u00e9es.';
      }
      renderActive();toast(message);
    } catch(error) {$('#feedbackError').textContent=error.message;}
  }
  function statsRange() {
    const p=$('#statsPeriod').value,today=C.localISO(new Date());
    if(p==='week')return {from:currentMonday,to:C.addDays(currentMonday,6)};
    if(p==='all')return {from:'2000-01-01',to:'2100-12-31'};
    return {from:C.addDays(C.monday(today),-(Number(p)-1)*7),to:C.addDays(C.monday(today),6)};
  }
  function renderProgress() {
    const range=statsRange(),stats=C.metrics(state,{...range,sport:statsSport});
    $('#statsSports').innerHTML=['all',...C.SPORTS].map(sp=>`<button class="filter-chip ${statsSport===sp?'active':''}" data-stats-sport="${esc(sp)}" aria-pressed="${statsSport===sp}">${sp!=='all'?`<span class="dot ${sportClass(sp)}"></span>`:''}${sp==='all'?'Les 3 sports':esc(sportLabel(sp))}</button>`).join('');
    $('#statsSummary').innerHTML=`<div><strong>${stats.count}</strong> r\u00e9alis\u00e9es${stats.shortenedCount?` (dont ${stats.shortenedCount} \u00e9court\u00e9e(s))`:''}</div><div><strong>${esc(durationText(stats.minutes))}</strong> de dur\u00e9e renseign\u00e9e</div>${stats.skippedCount?`<div>${stats.skippedCount} non faite(s) \u00b7 aucun volume</div>`:''}`;
    $('#sportStats').innerHTML=C.SPORTS.filter(sp=>statsSport==='all'||sp===statsSport).map(sp=>{
      const a=stats.totals[sp],swim=sp==='Natation';
      const distance=a.distanceCount?num(a.distanceKm*(swim?1000:1),swim?0:1):'\u2014';
      const pace=sp==='V\u00e9lo'?speedText(a.speedKmh):sp==='Natation'?(a.paceSec100m?C.paceText(a.paceSec100m)+' /100 m':'\u2014'):(a.paceMinKm?C.paceText(a.paceMinKm*60)+' /km':'\u2014');
      return `<article class="sport-stat ${sportClass(sp)}"><h2><span class="dot ${sportClass(sp)}"></span>${esc(sportLabel(sp))}<span>${a.count} s\u00e9ance${a.count!==1?'s':''}</span></h2><div class="stat-distance">${distance}<small>${swim?'m':'km'}</small></div><div class="stat-bottom"><span><strong>${a.timeCount?esc(durationText(a.durationMin)):'\u2014'}</strong> enregistr\u00e9es</span></div><div class="stat-pace">${sp==='V\u00e9lo'?'Vitesse moyenne':'Allure moyenne'} : <strong>${esc(pace)}</strong>${sp!=='V\u00e9lo'&&a.speedKmh?` \u00b7 ${esc(speedText(a.speedKmh))}`:''}</div></article>`;
    }).join('');
    $('#chartLegend').innerHTML=C.SPORTS.filter(sp=>statsSport==='all'||sp===statsSport).map(sp=>`<span><i class="dot ${sportClass(sp)}"></i>${esc(sp)}</span>`).join('');
    let chartFrom=range.from,chartTo=range.to;
    if($('#statsPeriod').value==='all') {
      const dates=state.sessions.filter(C.isPerformed).map(s=>s.date).sort();
      let end=C.localISO(new Date());if(dates.at(-1)>end)end=dates.at(-1);if(end>C.END && !dates.some(d=>d>C.END))end=C.END;if(end<C.START)end=C.START;
      chartTo=C.addDays(C.monday(end),6);const start=dates[0]&&dates[0]<C.START?dates[0]:C.START;
      chartFrom=C.addDays(C.monday(end),-11*7);if(chartFrom<start)chartFrom=C.monday(start);
    }
    const weekly=C.weeklyTotals(state,chartFrom,chartTo,statsSport);
    renderChart(weekly);
    let note='Les distances et dur\u00e9es non renseign\u00e9es restent absentes : les dur\u00e9es pr\u00e9vues ne sont pas compt\u00e9es comme r\u00e9alis\u00e9es. Les moyennes utilisent uniquement les bilans avec distance et dur\u00e9e.';
    if(stats.missingTime)note+=` ${stats.missingTime} partie(s) de s\u00e9ance sans dur\u00e9e r\u00e9elle.`;
    note+=' Les encha\u00eenements sont r\u00e9partis entre v\u00e9lo et course, sans double compter le temps.';
    if($('#statsPeriod').value==='all')note+=' Le graphique affiche au maximum les 12 derni\u00e8res semaines ; les totaux couvrent toute la p\u00e9riode.';
    $('#statsFootnote').textContent=note;
    const relevantIds=new Set(stats.rows.map(r=>r.sessionId));
    state.sessions.filter(s=>C.statusOf(s)==='skipped' && s.date>=range.from && s.date<=range.to && (statsSport==='all'||s.sport===statsSport||(s.sport==='Brick'&&['Course','V\u00e9lo'].includes(statsSport)))).forEach(s=>relevantIds.add(s.id));
    const history=C.sorted(state.sessions.filter(s=>relevantIds.has(s.id))).reverse().slice(0,12);
    $('#historyList').innerHTML=history.length?history.map(s=>{
      const metric=C.actualRows(s).filter(r=>(statsSport==='all'||r.sport===statsSport)&&(r.durationMin||r.distanceKm)).map(r=>actualText(r,s.sport==='Brick')).join(' / ');
      return `<div class="history-row"><div class="history-date">${esc(shortDate(s.date))}</div><div class="history-main"><h3>${esc(s.title)}</h3><p>${esc(sportLabel(s.sport))} \u00b7 ${esc(outcomes[C.statusOf(s)])}${s.rating?' \u00b7 '+esc(ratings[s.rating]):''}</p></div><div class="history-metrics">${esc(C.statusOf(s)==='skipped'?(s.reason||'Aucun volume compt\u00e9'):metric||'Chiffres \u00e0 compl\u00e9ter')}</div><button class="btn" data-feedback-id="${esc(s.id)}">Bilan</button></div>`;
    }).join(''):'<div class="empty-state"><strong>Vos bilans appara\u00eetront ici.</strong>Terminez une s\u00e9ance pour commencer le suivi.</div>';
  }
  function renderChart(weeks) {
    const sports=C.SPORTS.filter(sp=>statsSport==='all'||sp===statsSport);
    const rows=weeks.map(w=>({...w,total:sports.reduce((n,sp)=>n+w[sp],0)}));
    const max=Math.max(0,...rows.map(r=>r.total));
    if(!max)$('#chartArea').innerHTML='<div class="empty-state"><strong>Le suivi commence avec vos premiers chiffres.</strong>Ajoutez une dur\u00e9e r\u00e9alis\u00e9e dans un bilan pour voir le graphique.</div>';
    else {
      const width=780,height=276,left=42,right=16,top=18,bottom=42,plotHeight=height-top-bottom;
      const maxHours=Math.max(1,Math.ceil((max/60)*2)/2),step=(width-left-right)/rows.length;
      const colors={'Course':'#7561b6','Natation':'#338d97','V\u00e9lo':'#ad8039'};
      let svg=`<svg viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="volumeSvgTitle volumeSvgDesc"><title id="volumeSvgTitle">Volume hebdomadaire r\u00e9alis\u00e9 par sport</title><desc id="volumeSvgDesc">Histogramme des dur\u00e9es saisies, en heures. Les valeurs exactes sont disponibles dans le tableau sous le graphique.</desc>`;
      for(let i=0;i<5;i++) {
        const y=top+plotHeight*(1-i/4),v=maxHours*i/4;
        svg+=`<line x1="${left}" y1="${y}" x2="${width-right}" y2="${y}" stroke="#eceef2"/><text x="${left-10}" y="${y+4}" text-anchor="end" font-size="11" fill="#747b89">${num(v,1)}</text>`;
      }
      rows.forEach((r,i)=>{
        const bar=Math.min(48,step*.48),x=left+step*i+(step-bar)/2;let cumulative=0;
        sports.forEach(sp=>{const h=(r[sp]/60/maxHours)*plotHeight;if(h>0){const y=top+plotHeight-cumulative-h;svg+=`<rect x="${x}" y="${y}" width="${bar}" height="${h}" fill="${colors[sp]}" rx="2"><title>${esc(shortDate(r.week))} \u00b7 ${esc(sp)} : ${esc(durationText(r[sp]))}</title></rect>`;cumulative+=h;}});
        if(rows.length<=8 || i%2===0 || i===rows.length-1)svg+=`<text x="${left+step*(i+.5)}" y="${height-17}" text-anchor="middle" font-size="11" fill="#747b89">${esc(dformat(r.week,{day:'2-digit',month:'2-digit'}))}</text>`;
      });
      svg+='</svg>';$('#chartArea').innerHTML=svg;
    }
    $('#chartTable').innerHTML=`<table><thead><tr><th>Semaine du</th>${sports.map(sp=>`<th>${esc(sp)}</th>`).join('')}<th>Total</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(dformat(r.week,{day:'2-digit',month:'2-digit',year:'numeric'}))}</td>${sports.map(sp=>`<td>${esc(durationText(r[sp]))}</td>`).join('')}<td>${esc(durationText(r.total))}</td></tr>`).join('')}</tbody></table>`;
  }
  let filtersReady=false;
  function refreshPlanFilters() {
    const months=[...new Set(state.sessions.map(s=>s.date.slice(0,7)))].sort();
    const prevMonth=filtersReady?$('#monthFilter').value:currentMonday.slice(0,7);
    $('#monthFilter').innerHTML='<option value="">Toute l\u2019ann\u00e9e</option>'+months.map(m=>`<option value="${m}">${esc(dformat(m+'-01',{month:'long',year:'numeric'}))}</option>`).join('');
    $('#monthFilter').value=months.includes(prevMonth)?prevMonth:'';
    const phases=[...new Set(state.sessions.map(s=>s.phase))],prevPhase=$('#phaseFilter').value;
    $('#phaseFilter').innerHTML='<option value="">Toutes les phases</option>'+phases.map(p=>`<option value="${esc(p)}">${esc(p)}</option>`).join('');
    $('#phaseFilter').value=phases.includes(prevPhase)?prevPhase:'';filtersReady=true;
  }
  function renderPlan() {
    const month=$('#monthFilter').value,sport=$('#sportFilter').value,phase=$('#phaseFilter').value;
    const rows=C.sorted(state.sessions.filter(s=>(!month||s.date.startsWith(month))&&(!sport||s.sport===sport||(s.sport==='Brick'&&['Course','V\u00e9lo'].includes(sport)))&&(!phase||s.phase===phase)));
    const groups=new Map();rows.forEach(s=>{const k=C.monday(s.date);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(s);});
    $('#planList').innerHTML=groups.size?[...groups].map(([w,arr])=>`<section class="plan-week"><header class="plan-week-heading"><h2>${esc(dateRange(w))} ${C.isDeloadDate(w)?'<span class="badge deload">Deload</span>':''}</h2><button class="text-btn" data-view-week="${w}">Voir la semaine</button></header>${arr.map(s=>`<div class="plan-row ${C.isResolved(s)?'completed':''}"><div class="plan-row-date">${esc(dformat(s.date,{weekday:'short',day:'numeric'}))}</div><div class="plan-row-title">${esc(s.title)}<small>${esc(sportLabel(s.sport))}${C.isResolved(s)?' \u00b7 '+esc(outcomes[C.statusOf(s)]):''}</small></div><div class="plan-row-minutes">${num(s.duration)} min</div><button class="btn" data-move-id="${esc(s.id)}">D\u00e9placer</button><button class="btn" data-edit-id="${esc(s.id)}">Modifier</button></div>`).join('')}</section>`).join(''):'<div class="empty-state">Aucune s\u00e9ance avec ces filtres.</div>';
  }
  // Pointer-based dragging supports mouse, pen and touch; the date dialog is the keyboard fallback.
  function startDrag(e) {
    if((e.pointerType==='mouse' && e.button!==0) || drag)return;
    const handle=e.currentTarget;
    drag={id:handle.dataset.gripId,pointerId:e.pointerId,startX:e.clientX,startY:e.clientY,x:e.clientX,y:e.clientY,active:false,target:null,ghost:null,hoverNav:null,navSince:0,lastNav:0,frame:null};
    document.addEventListener('pointermove',dragMove,{passive:false});
    document.addEventListener('pointerup',dragEnd);
    document.addEventListener('pointercancel',dragCancel);
  }
  function dragMove(e) {
    if(!drag || e.pointerId!==drag.pointerId)return;
    drag.x=e.clientX;drag.y=e.clientY;
    if(!drag.active && Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)>6) {
      drag.active=true;ignoreGripClickUntil=Date.now()+600;hideToast();
      document.body.classList.add('dragging-now');
      try {document.body.setPointerCapture(e.pointerId);} catch {}
      const s=state.sessions.find(x=>x.id===drag.id),ghost=document.createElement('div');ghost.className='drag-ghost';ghost.textContent=s.title;document.body.appendChild(ghost);drag.ghost=ghost;
      $('#dragLive').textContent='D\u00e9placement en cours. Rel\u00e2chez sur un jour.';
      drag.frame=requestAnimationFrame(dragLoop);
    }
    if(drag.active){e.preventDefault();updateDragTarget();}
  }
  function updateDragTarget() {
    if(!drag?.active)return;
    $$('.drop-over').forEach(el=>el.classList.remove('drop-over'));
    $$('.is-dragging').forEach(el=>el.classList.remove('is-dragging'));
    $$('[data-card-id]').find(el=>el.dataset.cardId===drag.id)?.classList.add('is-dragging');
    drag.ghost.style.left=Math.max(10,Math.min(window.innerWidth-235,drag.x+12))+'px';
    drag.ghost.style.top=Math.min(window.innerHeight-70,Math.max(8,drag.y+14))+'px';
    const under=document.elementFromPoint(drag.x,drag.y),target=under?.closest('[data-drop-date]');
    drag.target=target||null;
    if(target)target.classList.add('drop-over');
    const nav=under?.closest('#prev,#next');
    if(nav && !nav.disabled) {
      if(drag.hoverNav!==nav.id){drag.hoverNav=nav.id;drag.navSince=performance.now();}
    } else {drag.hoverNav=null;drag.navSince=0;}
  }
  function dragLoop(now) {
    if(!drag?.active)return;
    let amount=0;
    if(drag.y>window.innerHeight-100)amount=Math.min(18,(drag.y-(window.innerHeight-100))/4);
    if(drag.y<100)amount=-Math.min(18,(100-drag.y)/4);
    if(amount)window.scrollBy(0,amount);
    if(drag.hoverNav && now-drag.navSince>800 && now-drag.lastNav>900) {
      const next=C.addDays(currentMonday,drag.hoverNav==='prev'?-7:7);setWeek(next);drag.lastNav=now;drag.navSince=now;
    }
    updateDragTarget();drag.frame=requestAnimationFrame(dragLoop);
  }
  function dragEnd(e) {
    if(!drag||e.pointerId!==drag.pointerId)return;
    const d=drag;
    if(!d.active){cleanupDrag();return;}
    updateDragTarget();
    const target=d.target,date=target?.dataset.dropDate;
    let before=null;
    if(date && target.classList.contains('day')) {
      const cards=[...target.querySelectorAll('[data-card-id]')].filter(x=>x.dataset.cardId!==d.id);
      const candidate=cards.find(el=>e.clientY < el.getBoundingClientRect().top+el.getBoundingClientRect().height/2);
      before=candidate?.dataset.cardId||null;
    }
    cleanupDrag();ignoreGripClickUntil=Date.now()+650;
    if(date){try{moveWithUndo(d.id,date,before);$('#dragLive').textContent='S\u00e9ance d\u00e9plac\u00e9e au '+shortDate(date);}catch(error){toast(error.message);}}
    else toast('D\u00e9placement annul\u00e9 : rel\u00e2chez sur un jour du planning.');
  }
  function dragCancel(){cleanupDrag();}
  function cleanupDrag() {
    if(!drag)return;
    if(drag.frame)cancelAnimationFrame(drag.frame);
    try{if(document.body.hasPointerCapture(drag.pointerId))document.body.releasePointerCapture(drag.pointerId);}catch{}
    drag.ghost?.remove();drag=null;document.body.classList.remove('dragging-now');
    $$('.drop-over,.is-dragging').forEach(el=>el.classList.remove('drop-over','is-dragging'));
    document.removeEventListener('pointermove',dragMove);document.removeEventListener('pointerup',dragEnd);document.removeEventListener('pointercancel',dragCancel);
  }
  function downloadJSON(data,name) {
    const blob=new Blob([typeof data==='string'?data:JSON.stringify(data,null,2)],{type:'application/json;charset=utf-8'});
    const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);
  }
  function exportBackup() {
    downloadJSON({...state,exportedAt:new Date().toISOString()},`triplan-sauvegarde-${C.localISO(new Date())}.json`);
    if(corruptRaw)downloadJSON(corruptRaw,'triplan-ancienne-sauvegarde-brute.json');
    $('#dataStatus').textContent='Sauvegarde export\u00e9e. Conservez ce fichier pour changer d\u2019appareil ou d\u2019adresse.';
  }
  async function importBackup(file) {
    if(!file)return;
    try {
      if(file.size>12000000)throw new Error('Le fichier est trop volumineux (maximum 12 Mo).');
      const imported=C.normalize(JSON.parse(await file.text()),PLAN);
      if(!confirm(`Importer ${imported.sessions.length} s\u00e9ances ? Cela remplace le planning de cet appareil. Exportez la sauvegarde actuelle avant de continuer.`))return;
      try{localStorage.setItem(C.KEY+'_before_import',JSON.stringify(state));}catch{}
      state=imported;state.updatedAt=new Date().toISOString();mutationSeq++;storageReadOnly=false;
      persist();showStorage();currentMonday=C.defaultWeek(state);renderActive();
      $('#dataStatus').textContent=`${state.sessions.length} s\u00e9ances import\u00e9es. ${state.sessions.filter(s=>s.completed).length} bilans conserv\u00e9s.`;
    }catch(error){$('#dataStatus').textContent='Import impossible : '+error.message;}
    finally{$('#importFile').value='';}
  }
  // Bind fixed controls.
  $$('[data-icon]').forEach(el=>el.innerHTML=icon(el.dataset.icon));
  $('#dataButton').innerHTML=icon('data');$('#prev').innerHTML=icon('left');$('#next').innerHTML=icon('right');
  $$('.icon-btn.close-dialog').forEach(el=>el.innerHTML=icon('close'));$('#dismissToast').innerHTML=icon('close');
  $$('.close-dialog').forEach(el=>el.onclick=()=>closeDialog(el.closest('dialog')));
  $$('.tab').forEach(el=>el.onclick=()=>switchView(el.dataset.view));
  $('.brand').onclick=e=>{e.preventDefault();switchView('week');};
  $('#prev').onclick=()=>setWeek(C.addDays(currentMonday,-7));$('#next').onclick=()=>setWeek(C.addDays(currentMonday,7));
  $('#todayButton').onclick=()=>setWeek(C.monday(C.localISO(new Date())));
  $('#addButton').onclick=()=>openEditor();$('#addFromPlan').onclick=()=>openEditor();
  $('#editorForm').onsubmit=submitEditor;$('#editDate').onchange=updateEditorHint;
  $('#editSport').onchange=()=>{$('#editDistance').value='';updateEditorHint();};
  $('#moveForm').onsubmit=submitMove;$('#moveDate').onchange=updateMoveHint;
  $('#feedbackForm').onsubmit=submitFeedback;
  $$('#feedbackForm input[name="outcome"]').forEach(r=>r.addEventListener('change',updateOutcomeFields));$('#metricFields').addEventListener('input',updateMetricResults);
  $('#statsPeriod').onchange=renderProgress;
  ['monthFilter','sportFilter','phaseFilter'].forEach(id=>$('#'+id).onchange=renderPlan);
  $('#dataButton').onclick=()=>openDialog($('#dataDialog'));
  $('#exportData').onclick=exportBackup;$('#exportFooter').onclick=exportBackup;
  $('#importData').onclick=()=>$('#importFile').click();$('#importFile').onchange=e=>importBackup(e.target.files[0]);
  $('#dismissToast').onclick=hideToast;
  document.addEventListener('click',e=>{
    const t=e.target.closest('button');if(!t)return;
    if(t.dataset.gripId){if(Date.now()>ignoreGripClickUntil)openMove(t.dataset.gripId);return;}
    if(t.dataset.editId)openEditor(t.dataset.editId);
    else if(t.dataset.moveId)openMove(t.dataset.moveId);
    else if(t.dataset.feedbackId)openFeedback(t.dataset.feedbackId);
    else if(t.dataset.addDate)openEditor(null,t.dataset.addDate);
    else if(t.dataset.jumpDay && !drag)$('#day-'+t.dataset.jumpDay)?.scrollIntoView({behavior:'auto',block:'start'});
    else if(t.dataset.viewWeek){currentMonday=t.dataset.viewWeek;switchView('week');$('#weekHeading').scrollIntoView({block:'start'});}
    else if(t.dataset.statsSport){statsSport=t.dataset.statsSport;renderProgress();}
    else if(t.dataset.usePlanned){t.closest('.metric-segment').querySelector('.actual-time').value=t.dataset.usePlanned;updateMetricResults();}
  });
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&drag){cleanupDrag();toast('D\u00e9placement annul\u00e9.');}});
  function checkDateChange() {
    const now=C.localISO(new Date());
    if(now!==lastToday && !drag && !document.querySelector('dialog[open]')){lastToday=now;currentMonday=C.defaultWeek(state,now);renderActive();}
  }
  window.addEventListener('focus',checkDateChange);document.addEventListener('visibilitychange',()=>{if(!document.hidden)checkDateChange();});setInterval(checkDateChange,60000);
  window.addEventListener('storage',e=>{
    if(e.key!==C.KEY || !e.newValue)return;
    try{state=C.normalize(JSON.parse(e.newValue),PLAN);mutationSeq++;renderActive();toast('Planning actualis\u00e9 depuis un autre onglet.');}catch{toast('Une mise \u00e0 jour d\u2019un autre onglet n\u2019a pas pu \u00eatre lue.');}
  });
  showStorage();refreshPlanFilters();renderWeek();
})();
