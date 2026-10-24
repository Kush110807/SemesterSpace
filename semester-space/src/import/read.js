import {textCanvas} from './image.js';
// Device-local decoding. No document bytes are sent to a server.
const asset=new URL('./vendor/',import.meta.url);
export function aborted(signal){if(signal?.aborted)throw new DOMException('Import cancelled','AbortError');}
export function abortable(promise,signal){
  if(!signal)return promise;
  aborted(signal);
  return new Promise((resolve,reject)=>{
    const cancel=()=>reject(new DOMException('Import cancelled','AbortError'));
    signal.addEventListener('abort',cancel,{once:true});
    promise.then(resolve,reject).finally(()=>signal.removeEventListener('abort',cancel));
  });
}
export function checkSource(source){
  if(!(source?.bytes instanceof Uint8Array)||!source.bytes.length)throw Error('EMPTY_FILE: Select a nonempty file.');
  if(source.bytes.length>15*1024*1024)throw Error('FILE_LIMIT: Each file must be at most 15 MB.');
  const b=source.bytes,pdf=new TextDecoder().decode(b.slice(0,5))==='%PDF-';
  const png=b[0]===137&&b[1]===80&&b[2]===78&&b[3]===71,jpg=b[0]===255&&b[1]===216;
  if(!pdf&&!png&&!jpg)throw Error('UNSUPPORTED_FORMAT: Only PDF, PNG and JPEG bytes are supported.');
  return pdf?'application/pdf':png?'image/png':'image/jpeg';
}
export async function readSource(source,role,{signal,onProgress=()=>{}}={}){
  const mime=checkSource(source),pages=[];let pdfTask,worker,workerPromise,renderTask;
  const progress=(stage,page=null,count=null)=>{aborted(signal);onProgress({stage,sourceRole:role,page,pages:count});};
  const cancel=()=>{renderTask?.cancel();void pdfTask?.destroy();void worker?.terminate();};
  signal?.addEventListener('abort',cancel,{once:true});
  async function ocr(canvas,page,count){
    progress('OCR',page,count);
    if(!worker){
      const {default:tess}=await import('./vendor/tesseract.js');aborted(signal);
      workerPromise=tess.createWorker('eng',1,{workerPath:new URL('worker.min.js',asset).href,corePath:asset.href,langPath:asset.href,workerBlobURL:false,cacheMethod:'none',errorHandler:()=>{}});
      // An initialization that completes after cancellation must release its worker too.
      workerPromise.then(w=>{if(signal?.aborted)void w.terminate();},()=>{});
      worker=await abortable(workerPromise,signal);
      await worker.setParameters({preserve_interword_spaces:'1',tessedit_pageseg_mode:'3'});
    }
    const input=mime==='application/pdf'?canvas:textCanvas(canvas);
    let data;try{({data}=await abortable(worker.recognize(input,{}, {text:true,blocks:true}),signal));}finally{if(input!==canvas)input.width=input.height=0;}
    const items=[];
    for(const b of data.blocks??[])for(const p of b.paragraphs??[])for(const l of p.lines??[])for(const w of l.words??[]){
      items.push({text:w.text,x:w.bbox.x0,y:w.bbox.y0,w:w.bbox.x1-w.bbox.x0,h:w.bbox.y1-w.bbox.y0,confidence:w.confidence});
    }
    return {text:data.text,items,method:'OCR',confidence:data.confidence};
  }
  async function capture(canvas,page,count,textData){
    aborted(signal);
    const content=textData??await ocr(canvas,page,count);
    const thumb=document.createElement('canvas');thumb.width=canvas.width;thumb.height=Math.round(canvas.height*thumb.width/canvas.width);
    thumb.getContext('2d').drawImage(canvas,0,0,thumb.width,thumb.height);
    const preview=thumb.toDataURL('image/jpeg',0.8);thumb.width=thumb.height=0;
    pages.push({...content,page,width:canvas.width,height:canvas.height,preview});
    canvas.width=canvas.height=0;
  }
  try{
    progress('READING');
    if(mime==='application/pdf'){
      let lib;try{lib=await import('./vendor/pdf.mjs');}catch{throw Error('MISSING_ASSETS: Run npm ci (or npm run prepare:assets) to install local PDF/OCR assets.');}
      lib.GlobalWorkerOptions.workerSrc=new URL('pdf.worker.mjs',asset).href;
      pdfTask=lib.getDocument({data:source.bytes.slice(),isEvalSupported:false,enableXfa:false,useSystemFonts:true,standardFontDataUrl:new URL('standard_fonts/',asset).href,stopAtErrors:true});
      const pdf=await abortable(pdfTask.promise,signal);
      if(pdf.numPages>20)throw Error('PAGE_LIMIT: At most 20 pages per PDF; no pages were silently omitted.');
      for(let n=1;n<=pdf.numPages;n++){
        progress('EXTRACTING_TEXT',n,pdf.numPages);
        const page=await abortable(pdf.getPage(n),signal),viewport=page.getViewport({scale:1});
        const scale=Math.min(3,2200/Math.max(viewport.width,viewport.height)),v=page.getViewport({scale});
        const text=await abortable(page.getTextContent(),signal),items=text.items.filter(i=>i.str?.trim()).map(i=>{
          const p=lib.Util.transform(v.transform,i.transform);return {text:i.str,x:p[4],y:p[5]-i.height*scale,w:i.width*scale,h:i.height*scale,confidence:null};
        });
        const raw=items.map(i=>i.text).join(' ');
        progress('RENDERING',n,pdf.numPages);
        const canvas=document.createElement('canvas');canvas.width=Math.ceil(v.width);canvas.height=Math.ceil(v.height);
        renderTask=page.render({canvasContext:canvas.getContext('2d'),viewport:v});await abortable(renderTask.promise,signal);renderTask=null;
        await capture(canvas,n,pdf.numPages,raw.trim().length>=30?{text:raw,items,method:'PDF_TEXT',confidence:null}:null);
        page.cleanup();
      }
    }else{
      const bitmap=await abortable(createImageBitmap(new Blob([source.bytes],{type:mime})),signal);
      try{
        if(bitmap.width*bitmap.height>40000000)throw Error('IMAGE_LIMIT: Image exceeds 40 megapixels.');
        const scale=Math.min(2,4000/Math.max(bitmap.width,bitmap.height));const canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);
        canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);await capture(canvas,1,1);
      }finally{bitmap.close();}
    }
    aborted(signal);return {mime,pages};
  }finally{signal?.removeEventListener('abort',cancel);await worker?.terminate();await pdfTask?.destroy();}
}
