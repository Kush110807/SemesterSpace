// Prospective import contract 0.2.0; not current executable exports.
import type {Model, Clock, Preferences, Counts} from '../../src/shared/types';
export type Review = 'UNREVIEWED'|'CONFIRMED'|'CORRECTED'|'EXCLUDED';
export type Evidence = {
  sourceId:string; page:number; // one-based
  bbox:[number,number,number,number]|null; // normalized x0,y0,x1,y1, top-left origin
  rawText:string; method:'PDF_TEXT'|'OCR'|'HUMAN_VISUAL'; confidence:number|null;
};
export type ImportSource = {fileName:string; mimeType:string; bytes:Uint8Array};
export type ImportIssue = {
  code:string; path:string; severity:'ERROR'|'WARNING'; message:string;
  rowIds:string[]; evidence:Evidence[];
};
export type SubjectDraft = {id:string; name:string; aliases:string[]; review:Review; evidence:Evidence[]};
export type RegisterDraft = {id:string; subjectId:string; name:string; kind:'THEORY'|'PRACTICAL'|'ACTIVITY'; review:Review; evidence:Evidence[]};
export type TimetableEntry = {
  id:string; kind:'LECTURE'|'LAB'|'ACTIVITY'|'LUNCH'|'UNKNOWN';
  subjectId:string|null; registerId:string|null; weekday:number|null;
  start:string|null; end:string|null; groupOptions:string[]; groupChoice:string|null;
  applicability:'UNRESOLVED'|'APPLIES'|'DOES_NOT_APPLY';
  treatment:'UNRESOLVED'|'ATTENDANCE'|'COMPULSORY_ZERO_UNITS'|'OPTIONAL'|'BREAK';
  weight:number|null; review:Review; evidence:Evidence[];
};
export type CalendarEntry = {
  id:string; title:string;
  kind:'HOLIDAY'|'NON_TEACHING'|'REPLACEMENT'|'WORKING_DAY_NOTICE'|'TEACHING_BOUNDARY'|'EXAM_WINDOW'|'ACADEMIC_ACTIVITY'|'VACATION'|'UNKNOWN';
  startDate:string|null; endDate:string|null; rawDateText:string;
  term:'ODD'|'EVEN'|'BOTH'|'UNSPECIFIED'; audienceText:string|null;
  printedCalendarWeekday:number|null; // actual calendar weekday, never the replacement pattern
  replacementWeekday:number|null; replacesDate:string|null;
  certainty:'AS_LISTED'|'TENTATIVE'|'UNSPECIFIED';
  applicability:'UNRESOLVED'|'APPLIES'|'DOES_NOT_APPLY';
  treatment:'UNRESOLVED'|'HOLIDAY'|'NON_TEACHING'|'REPLACEMENT'|'TEACHING_BOUNDARY'|'COMPULSORY'|'INFORMATION_ONLY'|'DOES_NOT_APPLY';
  allDay:boolean|null; startTime:string|null; endTime:string|null;
  review:Review; evidence:Evidence[];
};
export type ImportDraft = {
  importVersion:'0.2.0'; id:string; revision:number;
  status:'REVIEW_REQUIRED'|'UNREADABLE'|'UNSUPPORTED';
  sources:{id:string; role:'TIMETABLE'|'ACADEMIC_CALENDAR'; fileName:string; sha256:string; mimeType:string; pageCount:number; institutionLabel:string|null; extractionMode:'PDF_TEXT'|'OCR'|'MIXED'}[];
  sectionCandidates:string[]; selectedSection:string|null; declaredSubgroup:string|null;
  subjects:SubjectDraft[]; registers:RegisterDraft[];
  timetableEntries:TimetableEntry[]; calendarEntries:CalendarEntry[];
  issues:ImportIssue[];
};
export type ImportProgress = {stage:'READING'|'EXTRACTING_TEXT'|'RENDERING'|'OCR'|'ASSEMBLING'; sourceRole:'TIMETABLE'|'ACADEMIC_CALENDAR'; page:number|null; pages:number|null};
export type ImportOptions = {
  modelId:string;
  context:Model['context']; // explicit applicability confirmation, not a college-name guess
  academicScope:{institution:string;academicYear:string;term:'ODD'|'EVEN';degreeGroup:'UG'|'PG'|'PHD'|'OTHER';semesterNumber:number;programme:string;isTeachingAssistant:boolean|null};
  sourceApplicability:Record<string,{institutionConfirmed:boolean;termConfirmed:boolean;cohortConfirmed:boolean}>;
  clockPlaceholder:Clock; // A overwrites initial confirmedAt
  startDate:string; teachingEnd:string; horizonConfirmed:boolean;
  protectedSubjectIds:string[];
  registerRules:Record<string,{requiredBps:number;personalMinBps:number|null;bufferBps:number}>;
  snapshot:{date:string;counts:Record<string,Counts>;confirmed:boolean;completeToday:boolean};
  preferences:Preferences;
  // Explicit exceptions; imported holiday teaching must not be guessed.
  replacements:{date:string;weekday:number;confirmed:boolean}[];
  holidayTeachingDates:string[];
};
export declare function extractDocuments(request:{timetable:ImportSource;academicCalendar:ImportSource;section:string;signal?:AbortSignal;onProgress?:(progress:ImportProgress)=>void}):Promise<ImportDraft>;
export declare function validateImportDraft(draft:ImportDraft,options:ImportOptions):{ok:boolean;issues:ImportIssue[]};
export declare function compileConfirmedImport(draft:ImportDraft,options:ImportOptions):{ok:boolean;model:Model|null;issues:ImportIssue[]};
