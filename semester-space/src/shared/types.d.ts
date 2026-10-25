export type DateKey = string; // strictly valid Gregorian YYYY-MM-DD
export type TimeKey = string; // HH:mm, 00:00..23:59
export type Clock = { date: DateKey; time: TimeKey; timeZone: 'Asia/Kolkata' };
export type Counts = { attended: number; held: number };
export type Issue = { code: string; path: string; message: string };
export type Course = { id: string; name: string; mustAttend: boolean };
export type Register = {
  id: string; courseId: string; name: string;
  requiredBps: number; personalMinBps: number | null; bufferBps: number;
};
export type Session = {
  id: string; registerId: string; date: DateKey; start: TimeKey; end: TimeKey;
  weight: number; protected: boolean; cancelled: boolean;
  origin: 'weekly' | 'extra'; templateId: string | null;
};
export type WeeklyTemplate = {
  id: string; registerId: string; weekday: number; start: TimeKey; end: TimeKey;
  weight: number; protected: boolean;
};
export type Event = {
  id: string; title: string; cancelled: boolean; sessionId: string | null;
  date: DateKey | null; start: TimeKey | null; end: TimeKey | null;
};
export type Snapshot = {
  id: string; date: DateKey; counts: Record<string, Counts>; confirmed: true;
  // Confirmation must be on/after date, never later than evaluation clock.
  // Same-day confirmation needs completeToday=true and all that day's sessions ended.
  completeToday: boolean; confirmedAt: Clock; sequence: number;
};
export type Schedule = {
  startDate: DateKey; teachingEnd: DateKey; confirmed: boolean; initialized: boolean;
  weeklyTemplates: WeeklyTemplate[];
  holidays: { date: DateKey; label: string }[];
  replacements: { date: DateKey; weekday: number; confirmed: boolean }[];
  holidayTeachingDates: DateKey[];
};
export type ScheduleDraft = {
  schedule: Schedule; courses: Course[]; registers: Register[];
  extraSessions: Session[];
  overrides: { sessionId: string; changes: Partial<Pick<Session, 'date'|'start'|'end'|'weight'|'protected'|'cancelled'|'registerId'>> }[];
};
export type Preferences = {
  candidateStart: DateKey; candidateEnd: DateKey; preferredDates: DateKey[];
  requestedDays: number; notes: string;
};
export type Commitment = { id: string; date: DateKey; createdAtRevision: number };
export type Model = {
  schemaVersion: 1; revision: number; id: string; timeZone: 'Asia/Kolkata';
  context: { college: string; academicYear: string; semester: string; programme: string;
    section: string; sourceLabel: string; preparedOn: DateKey; applicabilityConfirmed: boolean };
  schedule: Schedule; courses: Course[]; registers: Register[]; sessions: Session[];
  events: Event[]; snapshots: Snapshot[]; commitments: Commitment[];
  attendanceConfirmation: { throughDate: DateKey; noUnlistedClasses: boolean } | null;
  preferences: Preferences;
};
export type PlanStatus = 'INVALID_SETUP' | 'ATTENDANCE_UPDATE_NEEDED' |
  'EXISTING_UNRECOVERABLE_SHORTFALL' | 'PLAN_BLOCKED' |
  'CONDITIONAL_RECOVERY' | 'MEETS_PLANNING_RULES';
export type Ratio = Counts & { percentage: string | null };
export type RegisterResult = {
  registerId: string; requiredBps: number; floorBps: number;
  initial: Ratio; final: Ratio; initialShortfall: 'NONE'|'REQUIREMENT'|'MARGIN';
  recovery: { status: 'NOT_NEEDED'|'RECOVERABLE'|'UNRECOVERABLE'|'NOT_STARTED'; sessionId: string|null; date: DateKey|null };
};
export type Failure = {
  kind: 'ATTENDANCE'|'RECOVERY'|'PROTECTION'|'COMPULSORY'|'OUTSIDE_HORIZON'|'SELECTION';
  date: DateKey|null; sessionId: string|null; registerId: string|null; eventId: string|null;
  attended: number|null; held: number|null; percentage: string|null;
  requiredBps: number|null; floorBps: number|null; combinedAbsenceDates: DateKey[]; message: string;
};
export type Marker = 'HOLIDAY'|'TEACHING'|'PROTECTED'|'COMPULSORY'|'SELECTED'|
  'COMMITTED'|'INVALID_COMMITMENT'|'ALREADY_OFF'|'HISTORICAL'|'OUTSIDE_HORIZON'|'SUGGESTED';
export type DateResult = {
  date: DateKey; markers: Marker[]; sessionIds: string[]; eventIds: string[];
  absenceUnits: { registerId: string; units: number }[];
  conflictScope: 'NONE'|'DATE'|'PLAN'; messages: string[];
};
export type PlanResult = {
  contractVersion: '1.1.0'; status: PlanStatus;
  // Null only when malformed input prevents recovery of a valid value (INVALID_SETUP).
  modelRevision: number|null; evaluatedAt: Clock|null;
  issues: Issue[]; firstFailure: Failure|null; registers: RegisterResult[];
  dates: DateResult[]; combinedAbsenceDates: DateKey[]; assumptions: string[];
};
export type SuggestionBatch = {
  modelRevision: number; evaluatedAt: Clock; dates: DateKey[]; evaluation: PlanResult;
};
export type SearchResult = {
  evaluation: PlanResult; batch: SuggestionBatch|null;
  search: { requested: number|null; found: number;
    outcome: 'COMPLETE'|'EXHAUSTED'|'NO_CANDIDATES'|'BLOCKED'; considered: number;
    rejections: { date: DateKey; evaluation: PlanResult }[]; preferenceWarnings: Issue[] };
};
export type Engine = {
  validateModel(model: Model, clock: Clock): {ok: boolean; issues: Issue[]};
  expandSchedule(draft: ScheduleDraft): {ok: boolean; issues: Issue[]; sessions: Session[]};
  evaluatePlan(model: Model, request: {additionalDates: DateKey[]; clock: Clock}): PlanResult;
  suggestPlan(model: Model, request: {clock: Clock}): SearchResult;
};
export type ViewState = {
  mode: 'personal'|'demo'; model: Model|null; month: string; selectedDate: DateKey|null;
  manualDates: DateKey[]; batch: SuggestionBatch|null;
  persistence: {status: 'NOT_SAVED'|'SAVED'|'FAILED'|'QUARANTINED'|'DEMO_MEMORY'; message: string};
  notice: string;
};
export type Results = {
  runtime: 'NO_SETUP'|'ENGINE_UNAVAILABLE'|'ERROR'|'READY';
  evaluation: PlanResult|null; search: SearchResult|null; error: string|null;
};
export type Callbacks = {
  onEnterDemo(): void; onExitDemo(): void;
  // Initial model.snapshots[0].confirmedAt is a Clock placeholder; A overwrites it.
  onReplaceSetup(payload: {model: Model}): void;
  // draft courses/registers must exactly match the existing model roster by ID/value.
  onInitializeSchedule(payload: {draft: ScheduleDraft}): void;
  onSetPreferences(payload: Preferences): void;
  onSetThreshold(payload: {registerId: string; requiredBps: number; personalMinBps: number|null; bufferBps: number}): void;
  onSetCourseProtection(payload: {courseId: string; mustAttend: boolean}): void;
  onConfirmSnapshot(payload: {date: DateKey; counts: Record<string, Counts>; confirmed: boolean; completeToday: boolean}): void;
  onConfirmGap(payload: {throughDate: DateKey; noUnlistedClasses: boolean}): void;
  onSetTeachingEnd(payload: {date: DateKey; confirmed: boolean}): void;
  onAddSession(payload: {session: Session; teachingOnHolidayConfirmed: boolean}): void;
  onEditSession(payload: {sessionId: string; changes: Partial<Pick<Session, 'date'|'start'|'end'|'registerId'|'weight'|'protected'|'cancelled'>>; teachingOnHolidayConfirmed: boolean}): void;
  onUpsertEvent(payload: ManualEventRequest): ManualEventResult;
  onUncommit(payload: {commitmentId: string}): void;
  onSelectDate(payload: {date: DateKey}): void;
  onSetMonth(payload: {month: string}): void;
  onSetManualDates(payload: {dates: DateKey[]}): void;
  onCheckManual(): void; onSuggest(): void;
  onAccept(payload: {dates: DateKey[]; modelRevision: number}): void;
  onRefresh(): void;
};
export declare function render(state: Readonly<ViewState>, results: Readonly<Results>, callbacks: Callbacks): void;

// DIAMOND-001 command outcomes are distinct from engine PlanStatus.
export type ManualEventRequest = {
  requestVersion: 1; mode: 'personal'|'demo'; expectedModelId: string;
  expectedModelRevision: number; operation: 'CREATE'|'UPDATE';
  targetEventId: string|null; event: Event;
};
export type SaveCode = 'SAVE_OK'|'PERSISTED_CONFLICT'|'CANDIDATE_INVALID'|
  'STORAGE_READ_FAILED'|'PERSISTED_DATA_INVALID'|'UNSUPPORTED_PERSISTED_VERSION'|
  'PERSISTED_REWRITE_UNSUPPORTED'|'SERIALIZATION_FAILED'|'STORAGE_WRITE_FAILED';
export type SaveResult = {status:'SAVED'|'FAILED'; code:SaveCode; message:string;
  reason?:string; path?:string|null};
export type ManualEventResult = {
  ok:boolean; code:'COMMITTED'|'DEMO_APPLIED'|'NO_CHANGE'|'VALIDATION_REJECTED'|
  'STALE_REVISION'|'CLOCK_CONFLICT'|'HISTORY_PROTECTED'|'SOURCE_CHANGE_BLOCKED'|
  'SOURCE_REVIEW_REQUIRED'|'PERSISTENCE_FAILED';
  effect:'NONE'|'MUTATED'; commitState:'NONE'|'DURABLE'|'MEMORY_ONLY';
  modelRevision:number|null; reason?:string; engineStatus?:PlanStatus;
};
export type TransientEventPermission = 'SOURCE_BOUND'|'DATASET_SOURCE_RESTRICTION'|
  'LOCAL_ORIGIN_UNPROVEN'|'SESSION_LOCAL_ENTRY'; // never a persisted origin
