import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, extname, sep } from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const port=Number(process.env.PORT??5173),host=process.env.HOST??'127.0.0.1';
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.wasm':'application/wasm','.gz':'application/gzip'};
export function makeServer(base=root) {
  return createServer(async(req,res)=>{
    try{
      const path=decodeURIComponent(new URL(req.url,'http://local').pathname);
      const file=resolve(base,'.'+(path==='/'?'/index.html':path));
      if(file!==resolve(base)&&!file.startsWith(resolve(base)+sep))throw new Error('Invalid path');
      // Local development serves app assets only, never repo metadata or user inputs.
      const allowed=path==='/'||path==='/index.html'||path.startsWith('/src/');
      if(!allowed||!(await stat(file)).isFile()){res.writeHead(404);res.end('Not found');return;}
      res.writeHead(200,{'Content-Type':mime[extname(file)]??'text/plain; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(await readFile(file));
    }catch{res.writeHead(404);res.end('Not found');}
  });
}
if(process.argv[1]===fileURLToPath(import.meta.url))makeServer().listen(port,host,()=>process.stdout.write(`SemesterSpace: http://${host}:${port}\n`));
