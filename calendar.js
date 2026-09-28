(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.RunPrepCalendar=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const escapeText=s=>String(s).replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,');
  const stamp=d=>d.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
  // RFC 5545 folding at <=75 UTF-8 OCTETS, preserving complete code points.
  function fold(line){let out='',part='',bytes=0;for(const char of line){const n=new TextEncoder().encode(char).length;if(bytes+n>75){out+=part+'\r\n';part=' ';bytes=1;}part+=char;bytes+=n;}return out+part;}
  function exportICS(plan,profile,{now=new Date(),namespace='runprep-v3',revision=0}={}){
    const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//RunPrep V3//FR','CALSCALE:GREGORIAN','METHOD:PUBLISH','X-WR-CALNAME:RunPrep V3 - projection'];
    const [h,m]=(profile.reminderTime||'18:30').split(':').map(Number);
    const safeNs=String(namespace).replace(/[^a-zA-Z0-9-]/g,'').slice(0,80)||'runprep-v3';
    for(const s of plan){
      if(s.kind==='paused'||s.kind==='rest')continue;
      lines.push('BEGIN:VEVENT',`UID:${s.id}-${safeNs}@runprep.local`,`DTSTAMP:${stamp(now)}`,`SEQUENCE:${Math.max(0,Math.floor(revision))}`);
      if(s.kind==='race'){
        // An all-day marker is not an invented race start or finish time.
        const date=s.date.replace(/-/g,''),end=new Date(s.date+'T12:00:00Z');end.setUTCDate(end.getUTCDate()+1);
        lines.push(`DTSTART;VALUE=DATE:${date}`,`DTEND;VALUE=DATE:${end.toISOString().slice(0,10).replace(/-/g,'')}`);
      }else{
        // Local civil date -> UTC captures DST for each individual event.
        const start=new Date(s.date+`T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00`),end=new Date(start.getTime()+s.durationSec*1000);
        lines.push(`DTSTART:${stamp(start)}`,`DTEND:${stamp(end)}`);
      }
      lines.push(`SUMMARY:${escapeText('RunPrep - '+s.title)}`,`DESCRIPTION:${escapeText((s.provisional?'PROJECTION A REEVALUER.\n':'')+s.detail)}`,`STATUS:${s.provisional?'TENTATIVE':'CONFIRMED'}`);
      if(s.kind==='training')lines.push('BEGIN:VALARM','TRIGGER:-PT30M','ACTION:DISPLAY','DESCRIPTION:Rappel RunPrep - verifier la seance actualisee','END:VALARM');
      lines.push('END:VEVENT');
    }
    lines.push('END:VCALENDAR');return lines.map(fold).join('\r\n')+'\r\n';
  }
  return {exportICS,fold,escapeText};
});
