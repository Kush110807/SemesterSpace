// Build-time only. All browser PDF/OCR resources are copied from the frozen npm tree.
import {cp,mkdir,readdir,writeFile,readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=new URL('../../',import.meta.url),out=new URL('./vendor/',import.meta.url);
await mkdir(out,{recursive:true});
const copy=async(from,to)=>cp(new URL(`node_modules/${from}`,root),new URL(to,out),{recursive:true});
await copy('pdfjs-dist/build/pdf.min.mjs','pdf.mjs');
await copy('pdfjs-dist/build/pdf.worker.min.mjs','pdf.worker.mjs');
await copy('pdfjs-dist/standard_fonts','standard_fonts');
await copy('pdfjs-dist/LICENSE','PDFJS-LICENSE');
await copy('tesseract.js/dist/tesseract.esm.min.js','tesseract.js');
await copy('tesseract.js/dist/worker.min.js','worker.min.js');
await copy('tesseract.js/LICENSE.md','TESSERACT-LICENSE');
await copy('tesseract.js/dist/worker.min.js.LICENSE.txt','WORKER-LICENSES');
await copy('tesseract.js-core/LICENSE','CORE-LICENSE');
for(const f of await readdir(new URL('node_modules/tesseract.js-core/',root)))if(/\.wasm(?:\.js)?$/.test(f))await copy(`tesseract.js-core/${f}`,f);
await copy('@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz','eng.traineddata.gz');
await writeFile(new URL('ENG-LICENSE',out),'English tessdata: Apache-2.0. https://github.com/tesseract-ocr/tessdata_best/blob/main/LICENSE\nDistributed by @tesseract.js-data/eng@1.0.0 (package metadata: MIT; upstream tessdata: Apache-2.0).\n');
await cp(new URL('./licenses/ENG-TRAINEDDATA-LICENSE',import.meta.url),new URL('ENG-TRAINEDDATA-LICENSE',out));
const manifest={};
async function hashes(dir,prefix=''){for(const f of await readdir(dir,{withFileTypes:true})){const path=new URL(f.name+(f.isDirectory()?'/':''),dir);if(f.isDirectory())await hashes(path,prefix+f.name+'/');else if(f.name!=='SHA256.json')manifest[prefix+f.name]=createHash('sha256').update(await readFile(path)).digest('hex');}}
await hashes(out);await writeFile(new URL('SHA256.json',out),JSON.stringify(manifest,null,2)+'\n');
console.log(`Prepared ${Object.keys(manifest).length} self-hosted PDF/OCR assets in ${fileURLToPath(out)}`);
