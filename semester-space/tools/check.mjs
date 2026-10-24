import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
async function files(dir){return(await Promise.all((await readdir(dir,{withFileTypes:true})).map(d=>d.isDirectory()?files(`${dir}/${d.name}`):[`${dir}/${d.name}`]))).flat();}
let count=0;
for(const path of [...await files('src'),...await files('tools'),...await files('tests')].filter(p=>/\.(js|mjs)$/.test(p))){const r=spawnSync(process.execPath,['--check',path],{stdio:'inherit'});if(r.status!==0)process.exit(r.status??1);count++;}
console.log(`Syntax checked ${count} JavaScript modules. This is not browser or engine verification.`);
