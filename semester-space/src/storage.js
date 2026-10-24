import { SCHEMA_VERSION, STORAGE_KEY } from './shared/constants.js';

export function loadModel(storage, validate, clock) {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw === null) return { model: null, persistence: {status: 'NOT_SAVED', message: 'No personal setup saved on this browser.'} };
    const envelope = JSON.parse(raw);
    if (envelope?.schemaVersion !== SCHEMA_VERSION || !envelope.model || envelope.model.schemaVersion !== SCHEMA_VERSION) throw new Error('Unrecognized saved schema.');
    const check = validate(envelope.model, clock);
    if (!check.ok) throw new Error(check.issues.map(x => x.message).join(' '));
    return { model: envelope.model, persistence: {status: 'SAVED', message: 'Personal setup loaded. Decisions are recalculated.'} };
  } catch (error) {
    return {model: null, persistence: {status: 'QUARANTINED', message: `Saved setup could not be loaded; stored data was left untouched. ${error.message}`}};
  }
}

export function saveModel(storage, model) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify({schemaVersion: SCHEMA_VERSION, model}));
    return {status: 'SAVED', message: 'Saved in this browser only.'};
  } catch (error) {
    return {status: 'FAILED', message: `Changes remain in memory and were not saved. ${error.message}`};
  }
}
