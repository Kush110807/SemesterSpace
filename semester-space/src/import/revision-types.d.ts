// Importer-local RC-001 adapter types. A owns release envelope/controller typing.
import type {Model,Clock} from '../shared/types.d.ts';
export type CalendarChange = {
 changeId:string; kind:'ADD_SESSION'|'EDIT_SESSION'|'CANCEL_SESSION'|'ADD_HOLIDAY'|'REMOVE_HOLIDAY'|'REPLACE_PATTERN'|'UPSERT_EVENT'|'TEACHING_END';
 occurrenceId:string|null; before:Record<string,unknown>|null; after:Record<string,unknown>|null;
 evidence:{sourceId:string;page:number|null;excerpt:string;basis?:'EXPLICIT_CANCELLATION'|'REVIEWED_OFFICIAL_CORRECTION'|'DIRECT_SOURCE'};
 match:'EXACT_ID'|'REVIEWED_CROSSWALK'|'ADDED'|'AMBIGUOUS'; affectsConfirmedHistory:boolean;
};
export type CalendarRevisionProposal = {
 proposalVersion:1;proposalId:string;baseModelRevision:number;
 source:{sha256:string;fileName:string;role:'ACADEMIC_CALENDAR';coverage:'COMPLETE'|'PARTIAL'|'UNSUPPORTED';section:string|null;pageRefs:string[]};
 scope:{start:string;end:string;section:string;subgroup:string|null;programmingGroup:string|null};
 changes:CalendarChange[];unresolved:{code:string;sourceRef:string;message:string}[];createdAtUntrusted:string|null;
};
export type SourceLink={sourceRef:string;kind:CalendarChange['kind'];targetId:string|null;value:Record<string,unknown>|null;evidence?:CalendarChange['evidence'];changeId?:string};
export type LegacySourceRevision={sha256:string;fileName:string};
export type SourceRevision={version:1;source?:CalendarRevisionProposal['source'];scope?:CalendarRevisionProposal['scope'];links:SourceLink[]};
export type RevisionEffect={
 id:string;sourceRef:string;kind:CalendarChange['kind'];after:Record<string,unknown>|null;
 occurrenceId?:string;targetId?:string;previousSourceRef?:string;
 confirmed:boolean;applicabilityConfirmed:boolean;effectiveDateConfirmed:boolean;
 matchConfirmed?:boolean;matchReason?:string;additionConfirmed?:boolean;manual?:boolean;reason?:string;
 evidence?:CalendarChange['evidence'];reconciliation?:{confirmed:true;note:string;binding:string};
};
export type RevisionDraft={
 revisionDraftVersion:1;status:'REVIEW_REQUIRED'|'PARTIAL'|'UNSUPPORTED'|'UNREADABLE';
 source:({id:string;pageCount:number;institutionLabel?:string|null}&CalendarRevisionProposal['source'])|null;
 pages:any[];calendarEntries:any[];issues:any[];
 review:{proposalKey?:string;scope:CalendarRevisionProposal['scope']|null;scopeConfirmed:boolean;
 academicScope?:{institution:string;academicYear:string;semesterNumber:number;programme:string;term:'ODD'|'EVEN';degreeGroup:'UG'|'PG'|'PHD'|'OTHER';isTeachingAssistant?:boolean};
 sourceCoverageConfirmed:boolean;coverageNote:string;legacySourceReviewed?:boolean;legacySourceNote?:string;
 effects:RevisionEffect[];exclusions:{sourceRef:string;confirmed:boolean;reason:string}[];
 missing:{sourceRef:string;decision:'KEEP_EXISTING';confirmed:boolean;reason:string}[];};
};
export declare function extractCalendarRevision(request:{academicCalendar:{fileName:string;bytes:Uint8Array};section?:string;signal?:AbortSignal;onProgress?:(p:unknown)=>void}):Promise<RevisionDraft>;
export declare function prepareCalendarRevision(input:{currentModel:Model;existingSourceRevision:SourceRevision|LegacySourceRevision|null;extractedDraft:RevisionDraft}):{proposal:CalendarRevisionProposal;comparison:{sourceRef:string;changeId:string|null;status:'UNCHANGED'|'ADDED'|'CHANGED'|'NEEDS_REVIEW'|'POSSIBLE_REMOVAL';targetId:string|null}[]};
export declare function buildRevisionCandidate(input:{model:Model;proposal:CalendarRevisionProposal;acceptedChangeIds:string[];clock:Clock}):{ok:boolean;issues:{code:string;message:string;changeId?:string;occurrenceId?:string}[];proposedModel:Model|null;sourceRevisionPatch:SourceRevision|null;engineStatus:string|null;preservedCommitmentIds?:string[]};

export declare function reconcileRevisionEffect(draft:RevisionDraft,effectId:string,note:string):void;
