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

export function saveModel(storage, model, release = makeEmptyRelease(model), options = {}) {
  try {
    validateRelease(release,model);
    if (Object.hasOwn(options,'expectedRevision')) {
      const existing=storage.getItem(STORAGE_KEY);
      if (options.expectedRevision === null) {
        if(existing!==null)throw new Error('STALE_PERSISTED_REVISION: setup now exists in browser storage.');
      } else {
        if(existing===null)throw new Error('STALE_PERSISTED_REVISION: saved setup is missing.');
        const parsed=JSON.parse(existing);
        if(parsed?.model?.revision!==options.expectedRevision ||
          parsed?.model?.id!==options.expectedModelId)throw new Error('STALE_PERSISTED_REVISION: another version is stored. Reload before changing it.');
      }
    }
    const bytes=JSON.stringify({schemaVersion: RELEASE_ENVELOPE_VERSION, model, release});
    if (typeof bytes !== 'string') throw new Error('Could not serialize model.');
    storage.setItem(STORAGE_KEY,bytes); // one key, one atomic browser operation
    return {status: 'SAVED', message: 'Saved in this browser only.'};
  } catch (error) {
    return {status: 'FAILED', message: `Changes were not saved. ${error.message}`};
  }
}
