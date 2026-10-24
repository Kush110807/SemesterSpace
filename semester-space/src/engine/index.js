// Public synchronous facade; only B edits engine code.
export {validateModel} from './validation.js';
export {evaluatePlan} from './plan.js';
export class EngineUnavailable extends Error {
  constructor(operation) {super(`${operation} is awaiting the planning-engine delivery.`);this.name='EngineUnavailable';}
}
export {expandSchedule} from './expand.js';
export {suggestPlan} from './search.js';
