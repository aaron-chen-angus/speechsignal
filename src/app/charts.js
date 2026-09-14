/* ==========================================================================
   Canvas charts. The drawing routines are ported from the prototype and kept
   faithful to it; they are parameterised to take a canvas + data instead of
   reading module globals, and given more room + axis labels per the brief.
   The DSP spectrogram/data used here is unchanged.
   ========================================================================== */
import { DSP } from '../dsp/dsp.js';
import { DOMAINS } from '../data/reference.js';
import { slurGauss } from './scoring.js';
import { cssVar } from './ui.js';

const FS = 16000;

export function fit(c){
  const r = window.devicePixelRatio || 1, b = c.getBoundingClientRect();
  c.width = Math.max(1, Math.round(b.width * r));
  c.height = Math.max(1, Math.round(b.height * r));
  const g = c.getContext('2d'); g.setTransform(r,0,0,r,0,0);
  return { g, w:b.width, h:b.height };
}
function grid(g,w,h,rows,cols){
  g.strokeStyle='#0D2942'; g.lineWidth=1;
  for(let i=1;i<rows;i++){const y=Math.round(h*i/rows)+.5;g.beginPath();g.moveTo(0,y);g.lineTo(w,y);g.stroke();}
  for(let i=1;i<cols;i++){const x=Math.round(w*i/cols)+.5;g.beginPath();g.moveTo(x,0);g.lineTo(x,h);g.stroke();}
}

export function drawWave(c, pcm){
  const { g,w,h } = fit(c);
  g.fillStyle='#030A12'; g.fillRect(0,0,w,h); grid(g,w,h,4,8);
  const N=Math.max(1,Math.floor(pcm.length/w));
  g.strokeStyle='#22D3EE'; g.lineWidth=1; g.beginPath();
  for(let x=0;x<w;x++){
    let mx=0; const s=x*N;
    for(let i=0;i<N;i++){const v=Math.abs(pcm[s+i]||0); if(v>mx)mx=v;}
    const a=mx*h*0.46; g.moveTo(x+.5,h/2-a); g.lineTo(x+.5,h/2+a);
  }
  g.stroke();
  g.strokeStyle='rgba(34,211,238,.25)'; g.beginPath(); g.moveTo(0,h/2+.5); g.lineTo(w,h/2+.5); g.stroke();
}

function heat(t){
  const st=[[3,10,22],[10,44,92],[16,110,160],[45,200,190],[220,220,90],[250,120,60]];
  const p=t*(st.length-1), i=Math.min(st.length-2,Math.floor(p)), f=p-i;
  return [0,1,2].map(k=>Math.round(st[i][k]+(st[i+1][k]-st[i][k])*f));
}
export function drawSpec(c, pcm){
  const { g,w,h } = fit(c);
  g.fillStyle='#030A12'; g.fillRect(0,0,w,h);
  const sg=DSP.spectrogram(pcm,FS,{winMs:25,hopMs:Math.max(6,Math.round(pcm.length/FS*1000/Math.max(1,w*1.2))),maxHz:8000});
  if(!sg.cols.length) return;
  const img=g.createImageData(Math.round(w),Math.round(h));
  const nb=sg.bins;
  let lo=1e9,hi=-1e9;
  for(let i=0;i<sg.cols.length;i+=7) for(let b=0;b<nb;b+=3){const v=sg.cols[i][b]; if(v>hi)hi=v; if(v<lo)lo=v;}
  hi=Math.max(hi,lo+1); lo=Math.max(lo,hi-62);
  for(let x=0;x<img.width;x++){
    const ci=Math.min(sg.cols.length-1,Math.floor(x/img.width*sg.cols.length));
    const col=sg.cols[ci];
    for(let y=0;y<img.height;y++){
      const b=Math.min(nb-1,Math.floor((1-y/img.height)*nb));
      let t=(col[b]-lo)/(hi-lo); t=t<0?0:t>1?1:t;
      const p=(y*img.width+x)*4, cc=heat(t);
      img.data[p]=cc[0]; img.data[p+1]=cc[1]; img.data[p+2]=cc[2]; img.data[p+3]=255;
    }
  }
  const tmp=document.createElement('canvas'); tmp.width=img.width; tmp.height=img.height;
  tmp.getContext('2d').putImageData(img,0,0);
  g.drawImage(tmp,0,0,w,h);
  g.strokeStyle='rgba(18,53,79,.8)'; g.lineWidth=1;
  for(let k=1;k<4;k++){const y=Math.round(h*k/4)+.5;g.beginPath();g.moveTo(0,y);g.lineTo(w,y);g.stroke();}
  g.fillStyle='#7FA6C2'; g.font='10px '+cssVar('--mono');
  for(let k=1;k<4;k++) g.fillText((8-2*k)+' kHz',5,h*k/4-3);
}

export function drawF0(c, res){
  const { g,w,h } = fit(c);
  g.fillStyle='#030A12'; g.fillRect(0,0,w,h); grid(g,w,h,4,8);
  const ct=res&&res.contours; if(!ct){ return {}; }
  const db=ct.intensity, n=db.length;
  g.strokeStyle='rgba(59,130,246,.6)'; g.lineWidth=1.4; g.beginPath();
  let lo=1e9,hi=-1e9; db.forEach(v=>{if(isFinite(v)){if(v<lo)lo=v;if(v>hi)hi=v;}});
  hi=Math.max(hi,lo+6); lo=Math.max(lo,hi-45);
  db.forEach((v,i)=>{const x=i/n*w, y=h-(Math.max(lo,Math.min(hi,v))-lo)/(hi-lo)*h*0.9-2; i?g.lineTo(x,y):g.moveTo(x,y);});
  g.stroke();
  const f0=ct.f0, m=f0.length;
  const vals=f0.filter(v=>v>0); if(!vals.length) return {};
  const fmin=Math.max(50,Math.min(...vals)*0.85), fmax=Math.min(420,Math.max(...vals)*1.1);
  g.strokeStyle='#2DD4A7'; g.lineWidth=2; g.lineCap='round';
  let pen=false;
  g.beginPath();
  f0.forEach((v,i)=>{
    const x=i/m*w;
    if(v>0){const y=h-(v-fmin)/(fmax-fmin)*h*0.9-2; pen?g.lineTo(x,y):g.moveTo(x,y); pen=true;}
    else pen=false;
  });
  g.stroke();
  return { fmin:Math.round(fmin), fmax:Math.round(fmax) };
}

export function drawRadar(c, dom){
  const { g,w,h } = fit(c);
  g.clearRect(0,0,w,h);
  const cx=w/2, cy=h/2+4, R=Math.min(w,h)/2-34, N=DOMAINS.length;
  const pt=(i,r)=>{const a=-Math.PI/2+i*2*Math.PI/N; return [cx+Math.cos(a)*r,cy+Math.sin(a)*r];};
  for(let ring=1;ring<=4;ring++){
    g.strokeStyle=ring===4?'#1B4A6B':'#10314A'; g.lineWidth=1; g.beginPath();
    for(let i=0;i<=N;i++){const [x,y]=pt(i%N,R*ring/4); i?g.lineTo(x,y):g.moveTo(x,y);} g.closePath(); g.stroke();
  }
  g.strokeStyle='#10314A';
  for(let i=0;i<N;i++){const [x,y]=pt(i,R); g.beginPath(); g.moveTo(cx,cy); g.lineTo(x,y); g.stroke();}
  const vals=DOMAINS.map(([k])=>dom[k]?dom[k].score/100:0);
  if(vals.some(v=>v>0)){
    g.beginPath();
    vals.forEach((v,i)=>{const [x,y]=pt(i,R*Math.max(0.04,v)); i?g.lineTo(x,y):g.moveTo(x,y);});
    g.closePath();
    const grd=g.createLinearGradient(cx-R,cy-R,cx+R,cy+R);
    grd.addColorStop(0,'rgba(34,211,238,.30)'); grd.addColorStop(1,'rgba(45,212,167,.22)');
    g.fillStyle=grd; g.fill();
    g.strokeStyle='#22D3EE'; g.lineWidth=2; g.stroke();
    vals.forEach((v,i)=>{const [x,y]=pt(i,R*Math.max(0.04,v)); g.fillStyle='#EAFBFF'; g.beginPath(); g.arc(x,y,3,0,7); g.fill();});
  }
  g.font='11px '+cssVar('--sans'); g.fillStyle='#7FA6C2';
  DOMAINS.forEach(([k,lab],i)=>{
    const [x,y]=pt(i,R+18);
    g.textAlign=Math.abs(x-cx)<6?'center':(x>cx?'left':'right');
    g.textBaseline=y<cy-4?'bottom':(y>cy+4?'top':'middle');
    g.fillText(lab,x,y);
  });
}

export function drawRing(c, score){
  const { g,w,h } = fit(c);
  g.clearRect(0,0,w,h);
  const cx=w/2,cy=h/2,R=Math.min(w,h)/2-16;
  g.lineWidth=14; g.lineCap='round';
  g.strokeStyle='#0B2135'; g.beginPath(); g.arc(cx,cy,R,0,Math.PI*2); g.stroke();
  const frac=score==null?0:Math.max(0.01,Math.min(1,score/100));
  const grd=g.createLinearGradient(0,0,w,h);
  const col=score==null?['#233B52','#233B52']:score<25?['#2DD4A7','#22D3EE']:score<50?['#22D3EE','#FBBF24']:['#FBBF24','#FB7185'];
  grd.addColorStop(0,col[0]); grd.addColorStop(1,col[1]);
  g.strokeStyle=grd; g.beginPath(); g.arc(cx,cy,R,-Math.PI/2,-Math.PI/2+frac*Math.PI*2); g.stroke();
  g.textAlign='center'; g.textBaseline='middle';
  g.fillStyle='#FFFFFF'; g.font='600 40px '+cssVar('--mono');
  g.fillText(score==null?'—':String(score),cx,cy-6);
  g.fillStyle='#6F8CA6'; g.font='10px '+cssVar('--sans');
  g.fillText('DEVIATION INDEX',cx,cy+20);
}

/* slur-marker distribution plot — enlarged, with control/impaired Gaussians,
   the speaker's needle, optional cut-off line, and axis end labels. */
export function drawSlur(c, row){
  const mk=row.mk, { g,w,h } = fit(c);
  g.clearRect(0,0,w,h);
  const lo=Math.min(mk.ctrl.m-3*mk.ctrl.sd, mk.dys.m-3*mk.dys.sd);
  const hi=Math.max(mk.ctrl.m+3*mk.ctrl.sd, mk.dys.m+3*mk.dys.sd);
  const X=v=>(v-lo)/(hi-lo)*(w-10)+5;
  const base=h-17;
  const peak=Math.max(slurGauss(mk.ctrl.m,mk.ctrl),slurGauss(mk.dys.m,mk.dys));
  const curve=(d,fill,stroke)=>{
    g.beginPath(); g.moveTo(X(lo),base);
    for(let px=0;px<=w;px+=2){const v=lo+(px-5)/(w-10)*(hi-lo); const y=base-slurGauss(v,d)/peak*(base-6); g.lineTo(px,y);}
    g.lineTo(X(hi),base); g.closePath();
    g.fillStyle=fill; g.fill(); g.strokeStyle=stroke; g.lineWidth=1.4; g.stroke();
  };
  curve(mk.dys,'rgba(251,113,133,.16)','rgba(251,113,133,.8)');
  curve(mk.ctrl,'rgba(45,212,167,.16)','rgba(45,212,167,.85)');
  g.strokeStyle='#123550'; g.lineWidth=1; g.beginPath(); g.moveTo(0,base+.5); g.lineTo(w,base+.5); g.stroke();
  if(mk.cut!=null && mk.cut>lo && mk.cut<hi){
    g.setLineDash([3,3]); g.strokeStyle='#8FD8F0'; g.beginPath(); g.moveTo(X(mk.cut),4); g.lineTo(X(mk.cut),base); g.stroke(); g.setLineDash([]);
    g.fillStyle='#8FD8F0'; g.font='10px '+cssVar('--sans'); g.textAlign='center'; g.fillText('cut-off '+mk.cut,X(mk.cut),h-4);
  }
  if(isFinite(row.v)){
    const x=Math.max(3,Math.min(w-3,X(row.v)));
    g.strokeStyle=(row.uncal||row.naLang)?'rgba(255,255,255,.35)':'#FFFFFF'; g.lineWidth=2.2; g.beginPath(); g.moveTo(x,2); g.lineTo(x,base); g.stroke();
    g.fillStyle=(row.uncal||row.naLang)?'rgba(255,255,255,.35)':'#FFFFFF'; g.beginPath(); g.arc(x,base,4,0,7); g.fill();
  }
  g.font='10px '+cssVar('--mono');
  const fmt=v=>(Math.abs(v)>50?Math.round(v):v.toFixed(2));
  g.fillStyle='#4A6E8A'; g.textAlign='left'; g.fillText(fmt(lo),3,h-4);
  g.textAlign='right'; g.fillText(fmt(hi),w-3,h-4);
  g.textAlign='center'; g.fillStyle='rgba(45,212,167,.95)'; g.fillText('control',X(mk.ctrl.m),h-4);
  g.fillStyle='rgba(251,113,133,.95)'; g.fillText('impaired',X(mk.dys.m),h-4);
}
