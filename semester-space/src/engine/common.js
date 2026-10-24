// Calendar and arithmetic primitives used only by the deterministic engine.
export const TIME_ZONE = 'Asia/Kolkata';
export const isObject = x => x !== null && typeof x === 'object' && !Array.isArray(x) && Object.getPrototypeOf(x) === Object.prototype;
export const safeInt = x => Number.isSafeInteger(x);
export const nonnegative = x => safeInt(x) && x >= 0;
export const issue = (code, path, message) => ({code,path,message});
export const validTime = t => typeof t === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
export function validDate(d) {
  if (typeof d !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/.test(d)) return false;
  const [y,m,day] = d.split('-').map(Number);
  // Constrain to four-digit Gregorian years; no local timezone conversion.
  if (y < 1) return false;
  const days = [31, ((y%4===0 && y%100!==0)||y%400===0)?29:28,31,30,31,30,31,31,30,31,30,31];
  return day >= 1 && day <= days[m-1];
}
export const validClock = c => isObject(c) && validDate(c.date) && validTime(c.time) && c.timeZone===TIME_ZONE;
export const clockStamp = c => `${c.date}T${c.time}`;
function ordinal(d) {
  const [y,m,day] = d.split('-').map(Number);
  // Use UTC only to manipulate date keys; never convert a local timestamp to a date.
  const a = new Date(0); a.setUTCFullYear(y,m-1,day); a.setUTCHours(0,0,0,0);
  return Math.floor(a.getTime()/86400000);
}
export function dateAdd(d, n) {
  const v = new Date((ordinal(d)+n)*86400000);
  return `${String(v.getUTCFullYear()).padStart(4,'0')}-${String(v.getUTCMonth()+1).padStart(2,'0')}-${String(v.getUTCDate()).padStart(2,'0')}`;
}
export function weekday(d) {
  const w = new Date(ordinal(d)*86400000).getUTCDay(); return w===0?7:w;
}
export function* datesBetween(a,b) {
  if (a>b) return;
  // Date keys are at most 9999-12-31. Explicit finite stop.
  for (let d=a; d<=b; d=dateAdd(d,1)) { yield d; if(d==='9999-12-31') break; }
}
export const sessionOrder = (a,b) => a.date.localeCompare(b.date)||a.start.localeCompare(b.start)||a.end.localeCompare(b.end)||a.id.localeCompare(b.id);
export function roundedPercentage(attended, held) {
  if (!held) return null;
  const n=BigInt(attended)*10000n, denom=BigInt(held);
  const bps=(2n*n+denom)/(2n*denom);
  return `${bps/100n}.${String(bps%100n).padStart(2,'0')}`;
}
export const ratio = (a,h) => ({attended:a,held:h,percentage:roundedPercentage(a,h)});
export const meets = (a,h,floor) => h===0 || BigInt(a)*10000n >= BigInt(floor)*BigInt(h);
export const floorOf = r => Math.max(r.requiredBps,r.personalMinBps??r.requiredBps)+r.bufferBps;
export const copy = x => structuredClone(x);
export const ASSUMPTIONS = Object.freeze([
  'Every other projected attendance session is assumed attended.',
  'Results are conditional on the supplied dates, counts, weights and restrictions.',
  'The per-session planning floor is conservative and is not verified institutional policy.',
]);
