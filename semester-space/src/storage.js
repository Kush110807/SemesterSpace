import {validateModel} from './engine/validation.js';
import {validateAttendanceJournal} from './attendance/ledger.js';
import { SCHEMA_VERSION, STORAGE_KEY } from './shared/constants.js';

// Version 2 is a single atomic persistence envelope; the engine Model stays schema 1.
export const RELEASE_ENVELOPE_VERSION = 2;
const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const nonempty = x => typeof x === 'string' && x.trim().length > 0;
// Provenance is a cryptographic digest, not merely a non-empty source label.
// Accept legacy SHA casing without rewriting persisted evidence on read.
const validSha256 = x => typeof x === 'string' && /^[a-f0-9]{64}$/i.test(x);
const shaKey = x => x.toLowerCase();
const unique = rows => new Set(rows).size === rows.length;
const validDate = s => typeof s === 'string' && /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().slice(0,10) === s;
const validClock = c => object(c) && validDate(c.date) && /^([01]\d|2[0-3]):[0-5]\d$/.test(c.time) && c.timeZone === 'Asia/Kolkata';

export function makeEmptyRelease(model) {
  return {
    version: 1,
    attendance: {version: 1, records: [], closedDays: [],
      // All legacy snapshots are treated as independently confirmed baselines; no
      // historical day-by-day details can legitimately be reconstructed from them.
      officialSnapshotIds: (model?.snapshots ?? []).map(s => s.id), reconciliationIssues: []},
    calendar: {version: 1, appliedRevisions: [], sourceRevision: null},
  };
}

export function validateRelease(release, model) {
  if (!object(release) || release.version !== 1) throw new Error('Invalid release payload version.');
  const a = release.attendance, c = release.calendar;
  if (!object(a) || a.version !== 1 || !Array.isArray(a.records) || !Array.isArray(a.closedDays) ||
    !Array.isArray(a.officialSnapshotIds) || !Array.isArray(a.reconciliationIssues)) throw new Error('Malformed attendance journal.');
  if (!object(c) || c.version !== 1 || !Array.isArray(c.appliedRevisions) ||
    (c.sourceRevision !== null && !object(c.sourceRevision))) throw new Error('Malformed calendar revision history.');
  const snapshotIds = new Set(model.snapshots.map(s => s.id));
  if (!unique(a.officialSnapshotIds) || a.officialSnapshotIds.some(id => !snapshotIds.has(id))) throw new Error('Invalid official snapshot references.');
  if (!a.officialSnapshotIds.length) throw new Error('At least one authoritative baseline reference is required.');
  const registerIds = new Set(model.registers.map(r => r.id));
  const idRows = new Set(), recordById = new Map();
  for (const row of a.records) {
    if (!object(row) || !nonempty(row.recordId) || !nonempty(row.dayKey) || !nonempty(row.occurrenceId) ||
      !registerIds.has(row.registerId) || !validDate(row.date) || !Number.isSafeInteger(row.weight) || row.weight < 1 ||
      !['ATTENDED','MISSED','NOT_HELD'].includes(row.disposition) || !validClock(row.confirmedAt) ||
      !Number.isSafeInteger(row.recordRevision) || row.recordRevision < 1 ||
      !Number.isSafeInteger(row.sourceModelRevision) || row.sourceModelRevision < 0 ||
      (row.supersedesRecordId !== null && !nonempty(row.supersedesRecordId)) || typeof row.note !== 'string') throw new Error('Invalid attendance record.');
    if (idRows.has(row.recordId)) throw new Error('Duplicate attendance record ID.');
    idRows.add(row.recordId); recordById.set(row.recordId,row);
  }
  for (const row of a.records) if (row.supersedesRecordId !== null) {
    const old=recordById.get(row.supersedesRecordId);
    if (!old || old === row || old.occurrenceId !== row.occurrenceId || old.registerId !== row.registerId || old.date !== row.date || old.weight !== row.weight ||
      old.recordRevision >= row.recordRevision) throw new Error('Invalid attendance correction chain.');
  }
  const dayKeys=[];
  for (const day of a.closedDays) {
    if (!object(day) || !nonempty(day.dayKey) || !validDate(day.date) || !Array.isArray(day.recordIds) ||
      !unique(day.recordIds) || !validClock(day.confirmedAt) || day.noUnlistedMeetings !== true ||
      !Number.isSafeInteger(day.sourceModelRevision) || day.sourceModelRevision < 0 ||
      (day.supersedesDayKey !== null && !nonempty(day.supersedesDayKey)) ||
      day.recordIds.some(id => !recordById.has(id) || recordById.get(id).dayKey !== day.dayKey || recordById.get(id).date !== day.date)) throw new Error('Invalid closed-day record.');
    dayKeys.push(day.dayKey);
  }
  if (!unique(dayKeys)) throw new Error('Duplicate closed-day key.');
  const closed=new Map(a.closedDays.map(d=>[d.dayKey,d]));
  for(const day of a.closedDays) {
    const occurrences=day.recordIds.map(id=>recordById.get(id).occurrenceId);
    if(!unique(occurrences))throw new Error('Duplicate occurrence in closed day.');
  }
  for (const day of a.closedDays) if (day.supersedesDayKey !== null &&
    (!closed.has(day.supersedesDayKey) || closed.get(day.supersedesDayKey).date !== day.date)) throw new Error('Invalid day correction reference.');
  // A date has one original close and a linear correction chain, never forks
  // or independent competing closes that could double-credit an occurrence.
  const groupedDays=new Map(),supersessionCounts=new Map();
  for(const day of a.closedDays){
    const rows=groupedDays.get(day.date)??[];rows.push(day);groupedDays.set(day.date,rows);
    if(day.supersedesDayKey!==null){
      const n=(supersessionCounts.get(day.supersedesDayKey)??0)+1;
      if(n>1)throw new Error('Forked day correction history.');
      supersessionCounts.set(day.supersedesDayKey,n);
    }
    for(const id of day.recordIds){
      const record=recordById.get(id);
      if(!validClock(record.confirmedAt) ||
        JSON.stringify(record.confirmedAt)!==JSON.stringify(day.confirmedAt) ||
        record.sourceModelRevision!==day.sourceModelRevision)
        throw new Error('Attendance record and day attestation disagree.');
    }
  }
  const effectiveOccurrenceIds=new Set();
  for(const [date,rows] of groupedDays){
    if(rows.filter(d=>d.supersedesDayKey===null).length!==1)
      throw new Error(`Multiple independent attendance closures on ${date}.`);
    if(rows.filter(d=>!supersessionCounts.has(d.dayKey)).length!==1)
      throw new Error(`Ambiguous active attendance closure on ${date}.`);
    const active=rows.find(d=>!supersessionCounts.has(d.dayKey));
    for(const id of active.recordIds){
      const occurrenceId=recordById.get(id).occurrenceId;
      if(effectiveOccurrenceIds.has(occurrenceId))throw new Error('Active occurrence credited more than once.');
      effectiveOccurrenceIds.add(occurrenceId);
    }
  }
  for(const day of a.closedDays)if(day.supersedesDayKey!==null){
    const previous=closed.get(day.supersedesDayKey);
    const before=new Map(previous.recordIds.map(id=>[recordById.get(id).occurrenceId,recordById.get(id)]));
    if(day.recordIds.length!==previous.recordIds.length)throw new Error('Day correction changed the occurrence roster.');
    for(const id of day.recordIds){
      const record=recordById.get(id),old=before.get(record.occurrenceId);
      if(!old || record.supersedesRecordId!==old.recordId || record.recordRevision!==old.recordRevision+1)
        throw new Error('Day correction is not linked to previous occurrence revision.');
    }
  }
  for(const day of a.closedDays) {
    const visited=new Set();let node=day;
    while(node){
      if(visited.has(node.dayKey))throw new Error('Cyclic day correction history.');
      visited.add(node.dayKey);node=node.supersedesDayKey===null?null:closed.get(node.supersedesDayKey);
    }
  }
  if (a.records.some(r=>!closed.has(r.dayKey) || !closed.get(r.dayKey).recordIds.includes(r.recordId))) throw new Error('Unlinked attendance record.');
  if (!a.reconciliationIssues.every(nonempty)) throw new Error('Invalid reconciliation issue.');
  if (!unique(c.appliedRevisions.map(r=>r.proposalId))) throw new Error('Duplicate applied proposal ID.');
  for (const item of c.appliedRevisions) if (!object(item) || !nonempty(item.proposalId) || !validSha256(item.sourceSha256) ||
    !validClock(item.appliedAt) || !Number.isSafeInteger(item.modelRevision) || !Array.isArray(item.changeIds) || !unique(item.changeIds) || !item.changeIds.every(nonempty)) throw new Error('Invalid applied revision metadata.');
  if (c.sourceRevision !== null) {
    const s = c.sourceRevision;
    if (!validSha256(s.sha256) || !nonempty(s.fileName)) throw new Error('Invalid calendar source revision.');
    // Old RC-001/RC-001.2 envelopes stored only filename and hash. They remain
    // readable; first reviewed application upgrades source metadata in one write.
    if (s.version === undefined) {
      // Pre-crosswalk releases persist only these two fields. Do not let a
      // damaged newer record masquerade as a harmless legacy source.
      if (Object.keys(s).some(key => !['sha256','fileName'].includes(key)))
        throw new Error('Invalid legacy calendar source metadata.');
    } else {
      if (s.version !== 1 || !object(s.source) || !validSha256(s.source.sha256) ||
        shaKey(s.source.sha256) !== shaKey(s.sha256) ||
        s.source.fileName !== s.fileName || !object(s.scope) || !Array.isArray(s.links) ||
        !Array.isArray(s.sourceHistory)) throw new Error('Invalid source crosswalk schema.');
      const refs = new Set();
      const hashes = new Set([shaKey(s.sha256)]);
      for (const older of s.sourceHistory) {
        if (!object(older) || !validSha256(older.sha256) || !nonempty(older.fileName))
          throw new Error('Invalid source history.');
        hashes.add(shaKey(older.sha256));
      }
      for (const l of s.links) {
        if (!object(l) || !nonempty(l.sourceRef) || !nonempty(l.kind) || !nonempty(l.targetId) ||
          !validSha256(l.sourceSha256) || !hashes.has(shaKey(l.sourceSha256)) ||
          !object(l.evidence) || !nonempty(l.evidence.sourceId) ||
          !Number.isInteger(l.evidence.page) || l.evidence.page < 1 ||
          !nonempty(l.evidence.excerpt) || refs.has(l.sourceRef))
          throw new Error('Invalid source crosswalk entry.');
        refs.add(l.sourceRef);
      }
    }
  }
  // Reject envelopes B could not safely use for totals or correction. A's
  // shape checks alone cannot identify moved historical occurrences.
  const journalCheck=validateAttendanceJournal(model,a);
  if(!journalCheck.ok)throw new Error(`Unsafe attendance journal: ${journalCheck.issues.map(i=>i.code).join(', ')}`);
  return release;
}

export function loadModel(storage, validate, clock) {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw === null) return {model: null, release: null, persistence: {status: 'NOT_SAVED', message: 'No personal setup saved on this browser.'}};
    const envelope = JSON.parse(raw);
    if (!object(envelope) || !envelope.model || envelope.model.schemaVersion !== SCHEMA_VERSION) throw new Error('Unrecognized saved schema.');
    if (envelope.schemaVersion !== SCHEMA_VERSION && envelope.schemaVersion !== RELEASE_ENVELOPE_VERSION) throw new Error('Unrecognized saved envelope schema.');
    const check = validate(envelope.model, clock);
    if (!check.ok) throw new Error(check.issues.map(x => x.message).join(' '));
    const release = envelope.schemaVersion === RELEASE_ENVELOPE_VERSION
      ? validateRelease(envelope.release,envelope.model) : makeEmptyRelease(envelope.model);
    return {model: envelope.model, release,
      persistence: {status: 'SAVED', message: envelope.schemaVersion === SCHEMA_VERSION
        ? 'Legacy setup loaded. Audit journal starts empty; migration occurs on next confirmed save.'
        : 'Personal setup and release journal loaded. Decisions are recalculated.'}};
  } catch (error) {
    return {model: null, release: null, persistence: {status: 'QUARANTINED', message: `Saved setup could not be loaded; stored data was left untouched. ${error.message}`}};
  }
}

// DIAMOND-001 closed write profile. Unknown fixed-record fields remain readable,
// but cannot be rewritten. Opaque source values are deliberately not projected.
const profile = {
 envelope1:'schemaVersion model', envelope2:'schemaVersion model release',
 model:'schemaVersion revision id timeZone context schedule courses registers sessions events snapshots commitments attendanceConfirmation preferences',
 context:'college academicYear semester programme section sourceLabel preparedOn applicabilityConfirmed',
 schedule:'startDate teachingEnd confirmed initialized weeklyTemplates holidays replacements holidayTeachingDates',
 weeklyTemplates:'id registerId weekday start end weight protected', holidays:'date label', replacements:'date weekday confirmed',
 courses:'id name mustAttend',registers:'id courseId name requiredBps personalMinBps bufferBps',
 sessions:'id registerId date start end weight protected cancelled origin templateId',events:'id title cancelled sessionId date start end',
 snapshots:'id date counts confirmed completeToday confirmedAt sequence',counts:'attended held',
 commitments:'id date createdAtRevision',attendanceConfirmation:'throughDate noUnlistedClasses',
 preferences:'candidateStart candidateEnd preferredDates requestedDays notes',release:'version attendance calendar',
 attendance:'version records closedDays officialSnapshotIds reconciliationIssues',
 records:'recordId dayKey occurrenceId registerId date weight disposition confirmedAt recordRevision sourceModelRevision supersedesRecordId note',
 closedDays:'dayKey date recordIds confirmedAt noUnlistedMeetings sourceModelRevision supersedesDayKey',
 calendar:'version appliedRevisions sourceRevision',appliedRevisions:'proposalId sourceSha256 appliedAt modelRevision changeIds',
 legacySource:'sha256 fileName',sourceRevision:'version sha256 fileName source scope links sourceHistory',
 source:'sha256 fileName role coverage section pageRefs',sourceHistory:'sha256 fileName role coverage section pageRefs',
 scope:'start end section subgroup programmingGroup',links:'sourceRef changeId kind targetId value evidence sourceSha256',
 evidence:'sourceId page excerpt basis',clock:'date time timeZone'
};
const pointer = key => String(key).replaceAll('~','~0').replaceAll('/','~1');
function unknownField(value, name, path='') {
  if(value===null || !object(value)) return null;
  if(name==='sourceRevision' && !Object.hasOwn(value,'version')) name='legacySource';
  const keys=profile[name]?.split(' ');
  if(!keys) return null;
  for(const key of Object.keys(value).sort()) {
    const at=path+'/'+pointer(key);
    if(!keys.includes(key)) return at;
    const child=value[key];
    if(name==='links' && key==='value') continue;
    if(name==='snapshots' && key==='counts') {
      for(const id of Object.keys(child??{}).sort()) {
        const bad=unknownField(child[id],'counts',at+'/'+pointer(id));if(bad)return bad;
      }
    } else if(['confirmedAt','appliedAt'].includes(key)) {
      const bad=unknownField(child,'clock',at);if(bad)return bad;
    } else if(Array.isArray(child)) {
      for(let i=0;i<child.length;i++) {const bad=unknownField(child[i],key,at+'/'+i);if(bad)return bad;}
    } else {const bad=unknownField(child,key,at);if(bad)return bad;}
  }
  return null;
}
// Descriptor-only admission: never execute accessors or serialization hooks.
function detachedJSON(value, ancestors=new Set()) {
  if(value===null || ['string','boolean'].includes(typeof value)) return value;
  if(typeof value==='number' && Number.isFinite(value) && !Object.is(value,-0)) return value;
  if(typeof value!=='object' || ancestors.has(value)) throw new Error('NON_JSON_DATA');
  const array=Array.isArray(value),proto=Object.getPrototypeOf(value);
  if(array ? proto!==Array.prototype : proto!==Object.prototype && proto!==null) throw new Error('NON_JSON_DATA');
  const descriptors=Object.getOwnPropertyDescriptors(value),keys=Reflect.ownKeys(descriptors);
  if(keys.some(k=>typeof k!=='string'))throw new Error('NON_JSON_DATA');
  if(array && (keys.length!==value.length+1 || keys.some(k=>k!=='length' && (!/^(0|[1-9][0-9]*)$/.test(k) || Number(k)>=value.length)))) throw new Error('NON_JSON_DATA');
  const out=array?[]:{};ancestors.add(value);
  for(const key of keys) {
    if(array && key==='length')continue;
    const d=descriptors[key];
    if(!d.enumerable || !Object.hasOwn(d,'value'))throw new Error('NON_JSON_DATA');
    Object.defineProperty(out,key,{value:detachedJSON(d.value,ancestors),enumerable:true,writable:true,configurable:true});
  }
  ancestors.delete(value);return Object.freeze(out);
}
export function equalJSON(a,b) {
  if(a===b)return true;
  if(a===null || b===null || typeof a!=='object' || typeof b!=='object' || Array.isArray(a)!==Array.isArray(b))return false;
  const x=Object.keys(a).sort(),y=Object.keys(b).sort();
  return x.length===y.length && (!Array.isArray(a)||a.length===b.length) && x.every((k,i)=>k===y[i] && equalJSON(a[k],b[k]));
}
const ceiling=Object.freeze({date:'9999-12-31',time:'23:59',timeZone:'Asia/Kolkata'});
function core(model,release) {
  const check=validateModel(model,ceiling);
  if(!check.ok) return check.issues;
  validateRelease(release,model);return [];
}
export function saveModel(storage, model, release, options = {}) {
  const failed=(code,reason,path=null)=>({status:'FAILED',code,reason,path,message:`Changes were not saved: ${code} (${reason}).`});
  // P0. No candidate access before all persisted fences and expectations.
  let expected;
  try {
    if(!object(options))return failed('CANDIDATE_INVALID','INVALID_EXPECTATION');
    if(Object.hasOwn(options,'expectedModelId') && !nonempty(options.expectedModelId))return failed('CANDIDATE_INVALID','INVALID_EXPECTATION');
    expected=Object.hasOwn(options,'expectedRevision')?options.expectedRevision:undefined;
    if(expected!==undefined && expected!==null && (!Number.isSafeInteger(expected)||expected<0||!nonempty(options.expectedModelId)))return failed('CANDIDATE_INVALID','INVALID_EXPECTATION');
    if(Object.hasOwn(options,'expectedRevision') && expected===undefined)return failed('CANDIDATE_INVALID','INVALID_EXPECTATION');
  }catch{return failed('CANDIDATE_INVALID','INVALID_EXPECTATION');}
  let raw;
  try{raw=storage.getItem(STORAGE_KEY);}catch{return failed('STORAGE_READ_FAILED','THREW');}
  if(raw===null && expected!==null && expected!==undefined)return failed('PERSISTED_CONFLICT','MISSING');
  if(raw!==null) {
    let e;
    try{if(typeof raw!=='string')throw new Error();e=JSON.parse(raw);if(!object(e))throw new Error();}
    catch{return failed('PERSISTED_DATA_INVALID','JSON_OR_ROOT');}
    const tags=[['/schemaVersion',e.schemaVersion,[1,2]]];
    // Do not interpret an unsupported outer body.
    if([1,2].includes(e.schemaVersion) || !Number.isInteger(e.schemaVersion) || e.schemaVersion<=0) {
      tags.push(['/model/schemaVersion',e.model?.schemaVersion,[1]]);
      if(e.release!==undefined) {
        tags.push(['/release/version',e.release?.version,[1]],['/release/attendance/version',e.release?.attendance?.version,[1]],['/release/calendar/version',e.release?.calendar?.version,[1]]);
        if(e.release?.calendar?.sourceRevision && Object.hasOwn(e.release.calendar.sourceRevision,'version'))tags.push(['/release/calendar/sourceRevision/version',e.release.calendar.sourceRevision.version,[1]]);
      }
    }
    for(const [path,v,supported] of tags)if(Number.isInteger(v)&&v>0&&!supported.includes(v))return failed('UNSUPPORTED_PERSISTED_VERSION','VERSION',path);
    if(e.schemaVersion===1 && e.model?.schemaVersion===1 && e.release?.version===1)return failed('PERSISTED_REWRITE_UNSUPPORTED','UNSUPPORTED_COMBINATION','/release');
    if(tags.some(([,v,supported])=>!supported.includes(v)) || (e.schemaVersion===2&&!object(e.release)))return failed('PERSISTED_DATA_INVALID','VERSION_SHAPE');
    try{if(core(e.model,e.schemaVersion===1?makeEmptyRelease(e.model):e.release).length)return failed('PERSISTED_DATA_INVALID','CORE_INVALID');}
    catch{return failed('PERSISTED_DATA_INVALID','CORE_INVALID');}
    const bad=unknownField(e,e.schemaVersion===1?'envelope1':'envelope2');
    if(bad)return failed('PERSISTED_REWRITE_UNSUPPORTED','UNRECOGNIZED_RETAINED_FIELD',bad);
    if(expected===null)return failed('PERSISTED_CONFLICT','EXPECTED_EMPTY');
    if(expected!==undefined) {
      if(e.model.id!==options.expectedModelId)return failed('PERSISTED_CONFLICT','MODEL_ID');
      if(e.model.revision!==expected)return failed('PERSISTED_CONFLICT','MODEL_REVISION');
    }
  }
  let m,r;
  try{m=detachedJSON(model);r=release===undefined?detachedJSON(makeEmptyRelease(m)):detachedJSON(release);}
  catch{return failed('CANDIDATE_INVALID','NON_JSON_DATA');}
  const bad=unknownField(m,'model','/model')??unknownField(r,'release','/release');
  if(bad)return failed('CANDIDATE_INVALID','UNSUPPORTED_CANDIDATE_FIELD',bad);
  try{if(core(m,r).length)return failed('CANDIDATE_INVALID','CORE_INVALID');}
  catch{return failed('CANDIDATE_INVALID','CORE_INVALID');}
  const envelope=Object.freeze({schemaVersion:2,model:m,release:r});let bytes,roundtrip;
  try{bytes=JSON.stringify(envelope);}catch{return failed('SERIALIZATION_FAILED','THREW');}
  if(typeof bytes!=='string')return failed('SERIALIZATION_FAILED','NONSTRING');
  try{roundtrip=JSON.parse(bytes);}catch{return failed('SERIALIZATION_FAILED','INVALID_SERIALIZED_JSON');}
  if(!equalJSON(roundtrip,envelope))return failed('SERIALIZATION_FAILED','ROUNDTRIP_MISMATCH');
  try{storage.setItem(STORAGE_KEY,bytes);}catch{return failed('STORAGE_WRITE_FAILED','THREW');}
  return {status:'SAVED',code:'SAVE_OK',message:'Saved in this browser only.'};
}
