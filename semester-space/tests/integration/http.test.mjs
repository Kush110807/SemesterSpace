import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { makeServer } from '../../tools/serve.mjs';
test('HTTP smoke: entry and ES modules serve with correct MIME, metadata hidden',async()=>{
  const server=makeServer();server.listen(0,'127.0.0.1');await once(server,'listening');
  try{
    const origin=`http://127.0.0.1:${server.address().port}`;
    for(const [path,content] of [['/','text/html'],['/src/main.js','text/javascript'],['/src/ui/styles.css','text/css'],['/src/engine/index.js','text/javascript']]){
      const response=await fetch(origin+path);assert.equal(response.status,200);assert.match(response.headers.get('content-type'),new RegExp(content));
    }
    assert.equal((await fetch(origin+'/.git/config')).status,404);
  }finally{server.close();await once(server,'close');}
});
