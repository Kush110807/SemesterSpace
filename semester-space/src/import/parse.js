// Interpretation proposes rows only. No fixtures, filenames or expected answers are consulted.
export const DAYS=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
export const issue=(code,path,message,rowIds=[],evidence=[],severity='ERROR')=>({code,path,message,rowIds,evidence,severity});
const clean=s=>s.replace(/\s+/g,' ').trim();
export const evidence=(source,page,items)=>({sourceId:source.id,page:page.page,bbox:items.length?[Math.min(...items.map(i=>i.x))/page.width,Math.min(...items.map(i=>i.y))/page.height,Math.max(...items.map(i=>i.x+i.w))/page.width,Math.max(...items.map(i=>i.y+i.h))/page.height]:null,rawText:items.map(i=>i.text).join(' '),method:page.method,confidence:page.confidence??null});
const family=s=>clean(s.replace(/\bLab(?:oratory)?\b.*$/i,'').replace(/\([^)]*\)/g,'').replace(/\bProg\.?(?=\s)/ig,'Programming').replace(/\bSys\./ig,'System').replace(/\bTech\./ig,'Techniques')).replace(/\s*-\s*/g,'-');
const clock=s=>{let [h,m]=s.split(/[.:]/).map(Number);if(h<8)h+=12;return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;};
export function parseTimetable(source,pages,section,id){
  const subjects=[],registers=[],rows=[],issues=[],found=[];let serial=0;
  const next=k=>`${id}-${k}-${++serial}`;
  for(const page of pages){
    const headings=page.items.filter(i=>/Section\s*:\s*\w+/i.test(i.text)).sort((a,b)=>a.y-b.y);
    for(const h of headings){const name=h.text.match(/Section\s*:\s*(\w+)/i)[1];found.push(name);if(name.toUpperCase()!==section.toUpperCase())continue;
      const bottom=headings.find(i=>i.y>h.y+5)?.y??page.height;
      const area=page.items.filter(i=>i.y>h.y+h.h&&i.y<bottom);
      const days=area.filter(i=>DAYS.some(d=>d.toLowerCase()===i.text.trim().toLowerCase())).sort((a,b)=>a.y-b.y);
      const times=area.filter(i=>/^\d{1,2}[.:]\d\d\s*[-–]\s*\d{1,2}[.:]\d\d$/.test(i.text.trim())&&i.y<(days[0]?.y??0)).sort((a,b)=>a.x-b.x).map(i=>{const t=i.text.match(/(\d{1,2}[.:]\d\d)\s*[-–]\s*(\d{1,2}[.:]\d\d)/);return {...i,cx:i.x+i.w/2,start:clock(t[1]),end:clock(t[2])};});
      if(days.length<5||times.length<2){issues.push(issue('TIMETABLE_LAYOUT','timetableEntries','Could not establish day/time geometry. Review this section visually; use manual setup if necessary.',[],[evidence(source,page,[h])]));continue;}
      const spacing=days.length>1?days[1].y-days[0].y:page.height/8;
      for(const day of days){
        const band=area.filter(i=>i.y>=day.y-spacing/2&&i.y<day.y+spacing/2&&i.x>day.x+day.w);
        const titles=band.filter(i=>i.y<day.y+day.h*0.6&&/[A-Za-z]/.test(i.text)&&!/^\s*(Dr\.?|Prof\.?|Mr\.?|Ms\.?|\w+\s*\d+\s*(?:Dr|--))\b/i.test(i.text)&&!(/^(?:[A-Z-]+LAB|LUN|CH|BRE|AK|BREAK)$/i.test(i.text.trim()))&&!/^\d/.test(i.text)&&!/^\s*[A-Z]+[- ]?\d+\b/i.test(i.text)&&!/^[-A-Z]*LAB\b/i.test(i.text));
        for(const title of titles){
          const isActivity=/library|NCC|NSS|sports/i.test(title.text);
          const lab=/\blab\b/i.test(title.text)||band.some(i=>/-LAB\b/i.test(i.text)&&Math.abs(i.x+i.w/2-title.x-title.w/2)<Math.max(...times.map(t=>t.w))*2);
          const cx=title.x+title.w/2;
          let columns=[...times].sort((a,b)=>Math.abs(a.cx-cx)-Math.abs(b.cx-cx)).slice(0,lab?2:1).sort((a,b)=>a.x-b.x);
          // A merged lab spans adjacent time columns, never the lunch gap.
          if(lab&&columns.length===2&&columns[0].end!==columns[1].start){issues.push(issue('MERGED_CELL_TIME','timetableEntries','Merged block crosses a gap; confirm its exact start/end.'));}
          const left=columns[0].cx-(times[1].cx-times[0].cx)/2,right=columns.at(-1).cx+(times.at(-1).cx-times.at(-2).cx)/2;
          const cell=band.filter(i=>i.x+i.w/2>=left&&i.x+i.w/2<=right);
          const ev=[evidence(source,page,cell)];
          const groupOptions=[...new Set(cell.flatMap(i=>[...i.text.matchAll(new RegExp(`\\b${section}[- ]?(\\d+)\\b`,'ig'))].map(m=>section.toUpperCase()+m[1])))];
          const name=family(title.text),kind=isActivity?'ACTIVITY':lab?'LAB':'LECTURE';
          // Alternative staff/group labels in the same merged cell are one occurrence.
          const existing=rows.find(r=>r.weekday===DAYS.findIndex(d=>d.toLowerCase()===day.text.toLowerCase())+1&&r.start===columns[0].start&&subjects.find(s=>s.id===r.subjectId)?.name.toLowerCase()===name.toLowerCase()&&r.kind===kind);
          if(existing){existing.groupOptions=[...new Set([...existing.groupOptions,...groupOptions])];continue;}
          let subject=subjects.find(s=>s.name.toLowerCase()===name.toLowerCase());
          if(!subject){subject={id:next('subject'),name,aliases:[title.text],review:'UNREVIEWED',evidence:ev};subjects.push(subject);}else if(!subject.aliases.includes(title.text))subject.aliases.push(title.text);
          const rk=isActivity?'ACTIVITY':lab?'PRACTICAL':'THEORY';
          let register=registers.find(r=>r.subjectId===subject.id&&r.kind===rk);
          if(!register){register={id:next('register'),subjectId:subject.id,name:`${name} — ${rk.toLowerCase()}`,kind:rk,review:'UNREVIEWED',evidence:ev};registers.push(register);}
          rows.push({id:next('entry'),kind,subjectId:subject.id,registerId:register.id,weekday:DAYS.findIndex(d=>d.toLowerCase()===day.text.toLowerCase())+1,start:columns[0].start,end:columns.at(-1).end,groupOptions,groupChoice:null,applicability:groupOptions.length?'UNRESOLVED':'APPLIES',treatment:isActivity?'UNRESOLVED':'ATTENDANCE',weight:null,review:'UNREVIEWED',evidence:ev});
        }
      }
    }
  }
  if(!found.some(s=>s.toUpperCase()===section.toUpperCase()))issues.push(issue('SECTION_NOT_FOUND','selectedSection',`Section ${section} was not found. No other section was substituted.`));
  if(!rows.length)issues.push(issue('NO_TIMETABLE_ROWS','timetableEntries','No usable timetable rows. Review source coverage or use manual setup.'));
  return {subjects,registers,timetableEntries:rows,sectionCandidates:[...new Set(found)],issues};
}
const months=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
export function validDate(s){if(!/^\d{4}-\d{2}-\d{2}$/.test(s??''))return false;const d=new Date(s+'T12:00:00Z');return Number.isFinite(+d)&&d.toISOString().slice(0,10)===s;}
export function dateKey(y,m,d){const s=`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;return validDate(s)?s:null;}
export function parseDates(text,year){
  const results=[];let m;
  const numeric=/\b(\d{1,2})\s*[./:-]\s*(\d{1,2})\s*[./:-]\s*(20\d{2})(?=\b|t[o0]\b)/g;
  while((m=numeric.exec(text)))results.push({date:dateKey(+m[3],+m[2],+m[1]),index:m.index,raw:m[0]});
  const malformed=/\b\d{1,2}\s*[./:-]\s*\d{1,2}\s*[./:-]\s*20\d{3,}\b/g;
  while((m=malformed.exec(text)))results.push({date:null,index:m.index,raw:m[0]});
  // Scan whole named-date phrases, so a day-first date cannot consume the next date's day.
  // Academic year headings are not a day before a month ("2026-27 Jan 05, 2027").
  const namedText=text.replace(/\b20\d{2}\s*[-–/]\s*(?:20)?\d{2}\b/g,v=>' '.repeat(v.length));
  const month='(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sept?(?:ember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)';
  const ord='(?:st|nd|rd|th)?',yr='(?:[\\s,.]*(20\\d{2}))?',candidates=[];
  const patterns=[
    [new RegExp('\\b(\\d{1,2})'+ord+'\\s*(?:[-–—]|to|&)\\s*(\\d{1,2})'+ord+'\\s*'+month+'\\b\\.?'+yr,'ig'),m=>[m[3],m[1],m[2],m[4]]],
    [new RegExp('\\b'+month+'\\b\\.?\\s*(\\d{1,2})'+ord+'\\s*(?:[-–—]|to|&)\\s*(\\d{1,2})(?!\\d)'+ord+yr,'ig'),m=>[m[1],m[2],m[3],m[4]]],
    // OCR may lose a range dash, but only two explicit day numbers followed by a year qualify.
    [new RegExp('\\b'+month+'\\b\\.?\\s*(\\d{1,2})\\s+(\\d{1,2})[.,]?\\s*(20\\d{2})\\b','ig'),m=>[m[1],m[2],m[3],m[4]]],
    [new RegExp('\\b(\\d{1,2})'+ord+'\\s*[-.]?\\s*'+month+'\\b\\.?'+yr,'ig'),m=>[m[2],m[1],null,m[3]]],
    [new RegExp('\\b'+month+'\\b\\.?\\s*(\\d{1,2})(?!\\d)'+ord+yr,'ig'),m=>[m[1],m[2],null,m[3]]],
  ];
  for(const [pattern,fields] of patterns)while((m=pattern.exec(namedText))){const [mon,a,b,y]=fields(m);candidates.push({index:m.index,end:m.index+m[0].length,mon,a,b,y,raw:text.slice(m.index,m.index+m[0].length)});}
  let until=-1;
  for(const c of candidates.sort((a,b)=>a.index-b.index||b.end-a.end)){
    if(c.index<until)continue;until=c.end;
    const mon=months.indexOf(c.mon.toLowerCase().slice(0,3))+1;
    results.push({date:dateKey(+(c.y??year),mon,+c.a),index:c.index,raw:c.raw});
    if(c.b)results.push({date:dateKey(+(c.y??year),mon,+c.b),index:c.index+1,raw:c.raw});
  }
  const compact=/\b(\d{2})[.]?(\d{2})[.]?(20\d{2})\b/g;while((m=compact.exec(text)))results.push({date:dateKey(+m[3],+m[2],+m[1]),index:m.index,raw:m[0]});
  return results.filter((r,i)=>results.findIndex(v=>v.index===r.index&&v.date===r.date)===i).sort((a,b)=>a.index-b.index);
}
export function pageLines(page){
  const lines=[];
  for(const i of [...page.items].sort((a,b)=>a.y-b.y||a.x-b.x)){
    let line=lines.find(l=>Math.abs(l.y-i.y)<Math.max(3,i.h*0.45));
    if(!line){line={y:i.y,items:[]};lines.push(line);}line.items.push(i);
  }
  return lines.sort((a,b)=>a.y-b.y).map(l=>({...l,items:l.items.sort((a,b)=>a.x-b.x),text:clean(l.items.map(i=>i.text).join(' '))}));
}
function category(text){
  if(/(?:time\s*table|timetable)\s*(?:adjustment|substitution)|(?:time\s*table|timetable)\s+of\s+[a-z]+|in\s+lieu|\bTTA\b/i.test(text))return 'REPLACEMENT';
  if(/working\s+saturday/i.test(text))return 'WORKING_DAY_NOTICE';
  if(/celebration|observance/i.test(text))return 'ACADEMIC_ACTIVITY';
  if(/holiday|janmashtami|independence day|diwali|dussehra|christmas|guru nanak|gandhi jayanti|raksha|milad/i.test(text))return 'HOLIDAY';
  if(/non.?teaching|suspend|\brecess\b|\bNT\b/i.test(text))return 'NON_TEACHING';
  if(/teaching\s+period\s+ends|end\s+of\s+instruction|teaching\s+and\s+continuous\s+evaluation/i.test(text))return 'TEACHING_BOUNDARY';
  if(/exam|sessional|mid.?term|end.?term|\bMST\b|\bEST\b/i.test(text))return 'EXAM_WINDOW';
  if(/(?:start|commencement) of classes|classes.*(?:begin|start|end|commence)|teaching.*(?:period|end|start)|last.*(?:working|teaching|class)|day of class/i.test(text))return 'TEACHING_BOUNDARY';
  if(/vacation|winter break/i.test(text))return 'VACATION';
  if(/orientation|induction|student|spardha|sports|cultural/i.test(text))return 'ACADEMIC_ACTIVITY';
  return 'UNKNOWN';
}
export function parseCalendar(source,pages,id){
  const rows=[],issues=[];let serial=0;
  const all=pages.map(p=>p.text).join(' '),year=Number(all.match(/\b(20\d{2})\s*[-–/]\s*(?:20)?\d{2}\b/)?.[1]??all.match(/\b20\d{2}\b/)?.[0]);
  for(const page of pages){
    if(page.method==='PDF_TEXT'&&/Hkkjrh|izkS|lsesLVj/.test(page.text)){
      issues.push(issue('TEXT_ENCODING_OR_LAYOUT',`pages.${source.id}.${page.page}`,'Legacy Hindi glyph encoding is not usable English text. Compare the bilingual source visually, including conflicting years; no translated duplicates were added.',[],[evidence(source,page,page.items)],'WARNING'));continue;
    }
    const lines=pageLines(page);
    // Serial-numbered activity tables: associate wrapped cells using actual row anchors.
    const hasSerialHeader=!(/Week\s*(?:[-–]?\d|No)/i.test(page.text)&&!page.items.some(i=>/^Responsibility/i.test(i.text)))&&page.items.some(i=>(/^No[.|:]?$/i.test(i.text)&&i.x<page.width*.15||/^Responsibility/i.test(i.text))&&i.y<page.height*.2);
    const serials=page.items.filter(i=>/^\d{1,3}[.)]?$/.test(i.text)&&i.x<page.width*0.13&&i.y>page.height*0.08).sort((a,b)=>a.y-b.y);
    let chunks;
    const oddHeader=page.items.find(i=>/^ODD$/i.test(i.text)),evenHeader=page.items.find(i=>/^EVEN$/i.test(i.text));
    if(oddHeader&&evenHeader&&Math.abs(oddHeader.y-evenHeader.y)<30){
      const tableEnd=page.items.find(i=>/^Details$/i.test(i.text)&&i.y>oddHeader.y)?.y??page.height*.72;
      const monthWord=i=>/^["“‘']?(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i.test(i.text);
      const starts=page.items.filter(i=>monthWord(i)&&i.y>oddHeader.y+60&&i.y<tableEnd&&i.x>page.width*.3);
      const oddX=Math.min(...starts.filter(i=>i.x<evenHeader.x-100).map(i=>i.x))-10;
      const evenX=Math.min(...starts.filter(i=>i.x>evenHeader.x-180).map(i=>i.x))-10;
      chunks=[];
      for(const [term,left,right] of [['ODD',oddX,evenX],['EVEN',evenX,page.width]]){
        const column=page.items.filter(i=>i.x>=left&&i.x<right&&i.y>oddHeader.y+65&&i.y<tableEnd);
        const anchors=[];for(const i of column.filter(i=>monthWord(i)||/^To$/i.test(i.text)).sort((a,b)=>a.y-b.y))if(!anchors.some(a=>Math.abs(a.y-i.y)<25))anchors.push(i);
        for(let n=0;n<anchors.length;n++){const a=anchors[n],top=n?(anchors[n-1].y+a.y)/2:a.y-25,bottom=anchors[n+1]?(a.y+anchors[n+1].y)/2:tableEnd;
          const values=column.filter(i=>i.y>=top&&i.y<bottom),titles=page.items.filter(i=>i.x<oddX&&i.y>=top&&i.y<bottom);
          chunks.push({items:[...titles,...values],text:pageLines({...page,items:[...titles,...values]}).map(l=>l.text).join(' '),term});
        }
      }
      chunks.push(...lines.filter(l=>l.y>=tableEnd).map(l=>({items:l.items,text:l.text,term:'UNSPECIFIED'})));
      issues.push(issue('DUAL_TERM_REVIEW','calendarEntries','Odd/even columns were separated geometrically. Check shared cells, TBA entries, cohorts and every bottom note against the image.',[],[],'WARNING'));
    }

    const holidayPage=/GAZETTED HOLIDAYS/i.test(page.text);
    const dateAnchors=holidayPage?page.items.filter(i=>i.y>(page.items.find(j=>/^date$/i.test(j.text)&&j.y<page.height*.13)?.y??page.height*0.1)&&i.y<page.height*0.9&&parseDates(i.text,year).some(d=>d.date)).sort((a,b)=>a.y-b.y):[];
    if(chunks){ /* dual-term geometry already separated above */ }
    else if(holidayPage&&dateAnchors.length>=3){chunks=dateAnchors.map((s,n)=>{const top=n?(dateAnchors[n-1].y+s.y)/2:s.y-s.h*2,bottom=dateAnchors[n+1]?(dateAnchors[n+1].y+s.y)/2:s.y+s.h*2;const items=page.items.filter(i=>i.y>=top&&i.y<bottom);return {items,text:pageLines({...page,items}).map(l=>l.text).join(' ')};});}
    else if(hasSerialHeader&&serials.length>=3&&serials[0].y<page.height*0.35){chunks=serials.map((s,n)=>{const top=s.y-s.h*0.7,bottom=serials[n+1]?serials[n+1].y-serials[n+1].h*0.7:page.height*0.96;const items=page.items.filter(i=>i.y>=top&&i.y<bottom);return {serialRow:true,items,text:pageLines({...page,items}).map(l=>l.text).join(' ')};});}
    else chunks=lines.map(l=>({items:l.items,text:l.text}));
    if(hasSerialHeader&&serials.length>=3&&serials[0].y<page.height*.35)chunks.unshift(...lines.filter(l=>l.y<serials[0].y&&/teaching.*continuous.*evaluation/i.test(l.text)&&parseDates(l.text,year).length).map(l=>({items:l.items,text:l.text})));
    // A wrapped makeup note is a single semantic block, even beside unrelated holiday columns.
    for(const anchor of page.items.filter(i=>/^lieu$/i.test(i.text))){const items=page.items.filter(i=>i.x>=anchor.x-page.width*.09&&i.y>=anchor.y-anchor.h*1.5&&i.y<anchor.y+anchor.h*4);chunks.push({items,text:pageLines({...page,items}).map(l=>l.text).join(' '),makeup:true});}
    // Recover explicit printed exam ranges from OCR text when word boxes lose tokens.
    // Do not synthesize grid dates, colours or omitted Sundays.
    if(page.method==='OCR')for(const text of page.text.split('\n')){
      const dates=parseDates(text,year).filter(d=>d.date);
      if(text.length<600&&/exam/i.test(text)&&dates.length===2&&dates[0].date<=dates[1].date&&!chunks.some(c=>c.text===text))chunks.push({items:[],text,rawEvidence:text});
    }
    // English event/date tables can put merged parent labels between cohort rows.
    // Keep cohort qualifiers separate; this is geometry-driven, not institution/filename selection.
    const eventHeader=page.items.find(i=>/^EVENTS?$/i.test(i.text)),dateHeader=page.items.find(i=>/^DATES?$/i.test(i.text));
    if(page.method==='PDF_TEXT'&&eventHeader&&dateHeader&&eventHeader.x<dateHeader.x){
      const split=(eventHeader.x+dateHeader.x)/2,dateCells=page.items.filter(i=>i.x>split&&parseDates(i.text,year).some(d=>d.date));
      const parents=page.items.filter(i=>i.x<split&&/^(?:Start of Classes\b|Classes End$|End Semester Examination$)/i.test(i.text));
      for(const parent of parents){
        const exam=/^End Semester Examination$/i.test(parent.text),band=exam?parent.h*5:parent.h*1.7;
        const anchors=dateCells.filter(i=>exam?i.y>=parent.y-parent.h&&i.y<parent.y+band:Math.abs(i.y-parent.y)<band);
        for(const date of anchors){
          const qualifiers=page.items.filter(i=>i.x>parent.x+Math.max(parent.w*.9,page.width*.05)&&i.x<split&&/first\s+sem|except|all other/i.test(i.text)&&Math.abs(i.y-date.y)<parent.h*2).sort((a,b)=>Math.abs(a.y-date.y)-Math.abs(b.y-date.y));
          const items=[parent,...qualifiers.slice(0,1),date];chunks.push({items,text:items.map(i=>i.text).join(' ')});
        }
      }
      if(parents.length)issues.push(issue('MERGED_COHORT_REVIEW','calendarEntries','Merged event/date labels were associated by geometry. Review cohort qualifiers and wrapped programme/semester exceptions against the page.',[],[],'WARNING'));
    }
    for(const chunk of chunks){
      const text=chunk.text,dates=parseDates(text,year),kind=category(text);
      if(!dates.length&&kind==='UNKNOWN')continue;
      // A malformed OCR line immediately before an exam's readable endpoint may be its start.
      // Keep it unresolved rather than guessing the year or narrowing the examination window.
      if(chunk.serialRow&&page.method==='OCR'&&kind==='EXAM_WINDOW'&&dates.length===1&&dates[0].date){
        const rawLines=page.text.split('\n'),at=rawLines.findIndex(line=>/exam/i.test(line)&&parseDates(line,year).some(d=>d.date===dates[0].date));
        const prior=at>0?rawLines[at-1]:null;
        if(prior&&parseDates(prior,year).some(d=>!d.date)){dates.unshift({date:null,index:-1,raw:prior});chunk.rawPrefix=prior;}
      }
      if(dates.some(d=>!d.date))issues.push(issue('DATE_TOKEN_REVIEW','calendarEntries','An invalid or malformed printed/OCR date remains unresolved. Compare the page; a readable endpoint does not complete the source window.',[],[evidence(source,page,chunk.items)],'WARNING'));
      const ev=[evidence(source,page,chunk.items)],week=DAYS.findIndex(d=>new RegExp(`\\b${d}\\b`,'i').test(text));
      if(chunk.rawEvidence)ev[0].rawText=chunk.rawEvidence;
      if(chunk.rawPrefix){ev[0].rawText=chunk.rawPrefix+'\n'+ev[0].rawText;ev[0].bbox=null;}
      const pattern=text.match(/(?:time\s*table(?:\s+of)?|timetable(?:\s+of)?)\s+(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b/i)?.[1]??text.match(/\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)(?:'s)?\s+(?:TT|time\s*table|timetable)\b/i)?.[1];
      const replacementWeekday=pattern?DAYS.findIndex(d=>d.toLowerCase()===pattern.toLowerCase())+1:null;
      // Never interpret weekday words in an adjustment as the source date's weekday.
      const term=chunk.term??(/\bodd\b/i.test(text)?'ODD':/\beven\b/i.test(text)?'EVEN':/\bodd\b/i.test(all)&&!/\beven\b/i.test(all)?'ODD':'UNSPECIFIED');
      const separateBoundary=kind==='TEACHING_BOUNDARY'&&dates.length===2;
      const separateNotice=['WORKING_DAY_NOTICE','REPLACEMENT'].includes(kind)&&dates.length===2&&/\d{1,2}\s*(?:&|and)\s*\d{1,2}/i.test(text);
      rows.push({id:`${id}-calendar-${++serial}`,title:text,kind,startDate:dates[0]?.date??null,endDate:separateBoundary||separateNotice||chunk.makeup?dates[0]?.date??null:dates.at(-1)?.date??null,rawDateText:dates.map(d=>d.raw).join(' — ')||text,term,audienceText:text,printedCalendarWeekday:kind==='REPLACEMENT'?null:week<0?null:week+1,replacementWeekday:kind==='REPLACEMENT'?replacementWeekday:null,replacesDate:chunk.makeup?dates[1]?.date??null:null,certainty:/tentative/i.test(text)?'TENTATIVE':/announced|notified|unspecified|decided|\bTBA\b/i.test(text)?'UNSPECIFIED':'AS_LISTED',applicability:'UNRESOLVED',treatment:'UNRESOLVED',allDay:null,startTime:null,endTime:null,review:'UNREVIEWED',evidence:ev});
      if(separateNotice)rows.push({...rows.at(-1),id:`${id}-calendar-${++serial}`,startDate:dates[1].date,endDate:dates[1].date});
      if(kind==='REPLACEMENT'&&!replacementWeekday)issues.push(issue('UNKNOWN_REPLACEMENT_PATTERN','calendarEntries','The source substitution pattern is unreadable or unspecified. Confirm the weekday from the page; the actual calendar weekday is not a substitute.',[rows.at(-1).id],ev,'WARNING'));
      if(separateBoundary)rows.push({...rows.at(-1),id:`${id}-calendar-${++serial}`,title:(/last.*working day/i.test(text)?'Last ordinary working day: ':'Other teaching boundary: ')+text,startDate:dates[1].date,endDate:dates[1].date});
    }
    if(!/\b(?:teaching|academic|holiday|calendar|semester|classes|timetable|examination)\b/i.test(page.text)||!page.items.length)issues.push(issue('TEXT_ENCODING_OR_LAYOUT',`pages.${source.id}.${page.page}`,'Text may be encoded, unreadable, or outside supported layouts. Review the page image; untranslated text is not parsed as English.',[],[evidence(source,page,page.items)],'WARNING'));
    if(/Week\s*[-–]?\d/i.test(page.text))issues.push(issue('GRID_LAYOUT_REVIEW','calendarEntries','Dense week-grid interpretation is partial. Confirm missing dates, colour legends, cohort conditions and timetable-adjustment notes against the original preview; add missing rows before confirming page coverage.',[],[],'WARNING'));
    if(page.method==='OCR')issues.push(issue('OCR_REVIEW',`pages.${source.id}.${page.page}`,'OCR can lose table geometry, colours and superscripts. Check every page against the preview, including legends and footnotes.',[],[],'WARNING'));
  }
  if(!rows.length)issues.push(issue('NO_CALENDAR_ROWS','calendarEntries','No interpreted calendar rows; add reviewed rows from the preview or use manual setup.'));
  return {calendarEntries:rows,issues,year:Number.isFinite(year)?year:null};
}
