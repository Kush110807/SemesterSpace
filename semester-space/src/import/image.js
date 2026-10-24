// OCR-only preprocessing: preserve the original coloured source preview separately.
// Remove long table rules; never derive holiday semantics from pixels or colours.
export function textCanvas(source){
  const c=document.createElement('canvas');c.width=source.width;c.height=source.height;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(source,0,0);
  const pixels=ctx.getImageData(0,0,c.width,c.height),data=pixels.data,w=c.width,h=c.height,mask=new Uint8Array(w*h);
  const luminance=new Uint8Array(w*h),integral=new Float64Array((w+1)*(h+1));
  for(let y=0;y<h;y++){let sum=0;for(let x=0;x<w;x++){const i=y*w+x,k=i*4;const lum=data[k]*.299+data[k+1]*.587+data[k+2]*.114;luminance[i]=lum;sum+=lum;integral[(y+1)*(w+1)+x+1]=integral[y*(w+1)+x+1]+sum;}}
  // White lettering on dark table headers must survive alongside black text on light cells.
  const radius=24;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const a=Math.max(0,x-radius),b=Math.min(w,x+radius+1),t=Math.max(0,y-radius),u=Math.min(h,y+radius+1);const mean=(integral[u*(w+1)+b]-integral[t*(w+1)+b]-integral[u*(w+1)+a]+integral[t*(w+1)+a])/((b-a)*(u-t));const lum=luminance[y*w+x];mask[y*w+x]=mean<100?Number(lum>mean+45):Number(lum<mean-35);}
  const lines=new Uint8Array(mask.length);
  function runs(horizontal){const length=horizontal?w:h,count=horizontal?h:w,min=horizontal?Math.max(70,w*.035):Math.max(70,h*.025);for(let fixed=0;fixed<count;fixed++){let start=-1;for(let along=0;along<=length;along++){const at=horizontal?fixed*w+along:along*w+fixed;if(along<length&&mask[at]){if(start<0)start=along;}else if(start>=0){if(along-start>=min)for(let p=start;p<along;p++){const index=horizontal?fixed*w+p:p*w+fixed;lines[index]=1;}start=-1;}}}}
  runs(true);runs(false);
  for(let i=0;i<mask.length;i++){const v=mask[i]&&!lines[i]?0:255;data[i*4]=data[i*4+1]=data[i*4+2]=v;data[i*4+3]=255;}
  ctx.putImageData(pixels,0,0);return c;
}
