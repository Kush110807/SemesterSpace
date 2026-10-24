import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildConfirmDayRequest,buildApplyRevisionRequest} from '../../src/ui/release.js';

test('daily close uses exact RC-001 fields with stable IDs and optimistic revision',()=>{
  const request=buildConfirmDayRequest({model:{revision:12},date:'2026-11-02',dayKey:'day:2026-11-02:opaque',marks:[{occurrenceId:'weekly:t:2026-11-02',registerId:'lecture',disposition:'NOT_HELD',note:'Explicit cancelled session'}]});
  assert.deepEqual(request,{expectedModelRevision:12,date:'2026-11-02',marks:[{occurrenceId:'weekly:t:2026-11-02',registerId:'lecture',disposition:'NOT_HELD',note:'Explicit cancelled session'}],confirmCompleteDay:true,confirmNoUnlistedMeetings:true,dayKey:'day:2026-11-02:opaque'});
  assert.equal(Object.hasOwn(request,'observedAt'),false);
  assert.equal(Object.hasOwn(request,'confirmedAt'),false);
  assert.equal(Object.hasOwn(request.marks[0],'weight'),false);
});
test('correction explicitly names previous closure without mutating marks',()=>{
  const marks=[{occurrenceId:'occ-1',registerId:'reg-1',disposition:'ATTENDED',note:''}];
  const request=buildConfirmDayRequest({model:{revision:15},date:'2026-10-21',dayKey:'corrected-key',correctionOfDayKey:'original-key',marks});
  assert.equal(request.correctionOfDayKey,'original-key');
  assert.equal(request.dayKey,'corrected-key');
  assert.deepEqual(marks,[{occurrenceId:'occ-1',registerId:'reg-1',disposition:'ATTENDED',note:''}]);
});
test('calendar apply uses exact RC-001 confirmation shape',()=>{
  const request=buildApplyRevisionRequest({model:{revision:13},proposal:{proposalId:'revision:sha256:abcd'},acceptedChangeIds:['c-1','c-2'],historicalResolutions:[{changeId:'c-2',action:'KEEP_HISTORY',reason:'Reviewed historical record'}]});
  assert.deepEqual(request,{expectedModelRevision:13,proposalId:'revision:sha256:abcd',acceptedChangeIds:['c-1','c-2'],confirmedSourceCoverage:true,historicalResolutions:[{changeId:'c-2',action:'KEEP_HISTORY',reason:'Reviewed historical record'}],confirmation:true});
  assert.equal(Object.hasOwn(request,'confirmedAt'),false);
});
