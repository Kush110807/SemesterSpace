// Independent-review scenario, adapted to report either vulnerable or repaired outcomes.
// The supplied SS_D_IMPORT_LINK_REPRO.mjs is retained unchanged beside this runner.
import {linkFixture,redirectLink,publicOutcome} from './d-imp-01-fixture.mjs';
import {compileConfirmedImport} from '../../src/import/compile.js';
import {validateCalendarCoverage} from '../../src/import/coverage.js';
export function reproduceDImp01(compile=compileConfirmedImport,validate=validateCalendarCoverage){
 const cases=[];
 for(const kind of ['EXAM_WINDOW','NON_TEACHING','REPLACEMENT']){
  const {d,o}=linkFixture(kind),sourceDates=d.calendarEntries.map(r=>r.startDate),baseline=compile(d,o);if(!baseline.ok)throw Error('Valid baseline rejected: '+JSON.stringify(baseline.issues));
  const baselineOutcome=publicOutcome(baseline,o);redirectLink(d,o);const validation=validate(d,o),attack=compile(d,o);
  cases.push({kind,sourceDates,teachingHorizon:[o.startDate,o.teachingEnd],baseline:baselineOutcome,coverageErrors:validation.map(i=>i.code),attack:publicOutcome(attack,o)});
 }
 return {finding:'D-IMP-01',repairBase:'16fe844f56c98f8b1d529a250dac3a7d67a6c3c9',phase:process.env.SS_REPRO_PHASE??'current',cases};
}
if(process.argv.includes('--run'))console.log(JSON.stringify(reproduceDImp01(),null,2));
