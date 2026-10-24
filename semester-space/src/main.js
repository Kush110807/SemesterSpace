import * as engine from './engine/index.js';
import { render } from './ui/index.js';
import { createController } from './controller.js';
import * as attendance from './attendance/ledger.js';
import * as revision from './import/revision.js';

// Access itself can throw when browser storage is disabled.
let storage;
try {storage=window.localStorage;} catch(error) {
  storage={getItem(){throw error;},setItem(){throw error;}};
}
const app=createController({engine,render,storage,attendance,revision});
window.addEventListener('focus',()=>app.callbacks.onRefresh());
document.addEventListener('visibilitychange',()=>{if(!document.hidden)app.callbacks.onRefresh();});
setInterval(()=>app.callbacks.onRefresh(),60_000);
