import { cp, mkdir, rm } from 'node:fs/promises';
await rm('dist',{recursive:true,force:true});await mkdir('dist',{recursive:true});
await cp('index.html','dist/index.html');await cp('src','dist/src',{recursive:true});
console.log('Static files copied to dist/. Build success alone does not establish release readiness.');
