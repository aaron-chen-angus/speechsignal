/* ==========================================================================
   Scoring, gating, slur-marker placement, sentiment and word accuracy.
   Ported VERBATIM (logic) from the prototype's scoring block. Refactored only
   to take the session store explicitly instead of reading a module-global,
   so the same functions serve both /results rendering and export.

   Nothing here alters an algorithm or a constant. Gating rules preserved:
     - nonTonal markers removed for tonal languages
     - enOnly slur markers greyed out for non-English
     - CPPS excluded from the slur tally until a Praat offset is entered
   No output is a diagnosis, a stroke probability, a health grade, or a
   confidence score.
   ========================================================================== */
import { REF, DOMAINS } from '../data/reference.js';
import { SLUR } from '../data/slur.js';
import { SCRIPTS, TASKS } from '../data/scripts.js';
import { LEX, NEG } from '../data/lexicon.js';

/* ---- deviation table -------------------------------------------------- */
function dig(o, path){ return path.split('.').reduce((a,k)=>a==null?undefined:a[k], o); }

export function val(store, name, spec){
  for(const t of spec.p){ const r = store[t]; if(!r || r.error) continue;
    const v = dig(r, spec.k||name); if(isFinite(v)) return {v, task:t}; }
  return {v:NaN, task:null};
}

export function zed(name, spec, v, baseline){
  if(baseline){ const b = val(baseline, name, spec).v;
    if(isFinite(b) && b!==0) return (v-b)/Math.max(1e-9, Math.abs(b)*0.15); }
  const mid=(spec.lo+spec.hi)/2, half=(spec.hi-spec.lo)/2;
  return (v-mid)/(half/2);
}

/* rows for every applicable reference parameter, given current session */
export function rowsAll(res, lang, baseline){
  const out=[];
  const tonal=!!SCRIPTS[lang].tonal;
  for(const [n,sp] of Object.entries(REF)){
    if(sp.nonTonal && tonal) continue;            // lexical tone drives F0; monopitch measures do not apply
    const {v,task}=val(res,n,sp); if(!isFinite(v)) continue;
    const z=zed(n,sp,v,baseline), bad=sp.dir==='high'?z:-z;
    out.push({n,sp,v,task,z,bad,flag:bad>3?'out':bad>2?'watch':'ok'});
  }
  return out;
}

export function domainScores(rows){
  const d={};
  DOMAINS.forEach(([k])=>{
    const r=rows.filter(x=>x.sp.g===k); if(!r.length){ d[k]=null; return; }
    const m=r.reduce((s,x)=>s+Math.max(0,x.bad),0)/r.length;
    d[k]={score:Math.round(Math.max(0,Math.min(100,100-m*22))),n:r.length,
          flag:r.some(x=>x.flag==='out')?'out':r.some(x=>x.flag==='watch')?'watch':'ok'};
  });
  return d;
}

export function overall(rows){
  if(!rows.length) return null;
  const w=rows.map(r=>Math.max(0,r.bad)).sort((a,b)=>b-a);
  const top=w.slice(0,Math.max(3,Math.ceil(w.length*0.4)));
  return Math.round(Math.min(100,top.reduce((a,b)=>a+b,0)/top.length*22));
}

/* ---- slur markers ----------------------------------------------------- */
export function pickVal(res, name){
  if(name==='fcrEst'||name==='f2RatioEst'){
    for(const t of ['read','free']){const r=res[t]; if(!r||r.error||!r.vowelSpace) continue;
      const v=name==='fcrEst'?r.vowelSpace.fcr:r.vowelSpace.f2Ratio; if(isFinite(v)) return v;}
    return NaN;
  }
  for(const t of ['read','free']){const r=res[t]; if(!r||r.error) continue;
    const v=r[name]; if(isFinite(v)) return v;}
  return NaN;
}

export function wpmValue(res, tx){
  for(const t of ['read','free']){
    const r=res[t]; if(!r||r.error||!isFinite(r.speakingDur)) continue;
    const txt=tx[t];
    if(txt){const n=txt.trim().split(/\s+/).filter(Boolean).length; if(n>3) return n/r.speakingDur*60;}
    if(isFinite(r.nSyllables)&&r.nSyllables>4) return r.nSyllables/1.55/r.speakingDur*60;
  }
  return NaN;
}

/* resolve a marker's measured value using its declared accessor kind */
function slurValue(mk, res, tx){
  switch(mk.getKind){
    case 'wpm': return wpmValue(res, tx);
    case 'metric': return pickVal(res, mk.getKey);
    case 'vowelSpace': return pickVal(res, mk.getKey==='fcr'?'fcrEst':'f2RatioEst');
    default: return NaN;
  }
}

const gauss=(x,d)=>Math.exp(-0.5*Math.pow((x-d.m)/d.sd,2))/d.sd;

export function slurRows(res, tx, lang, cppsCal){
  return SLUR.map(mk=>{
    let v=slurValue(mk, res, tx);
    if(!isFinite(v)) return {mk,v:NaN};
    if(mk.enOnly && lang!=='en') return {mk,v,naLang:true};
    if(mk.cal){
      if(cppsCal===null||cppsCal===undefined) return {mk,v,uncal:true};
      v=v+cppsCal;
    }
    const lr=gauss(v,mk.dys)/Math.max(1e-12,gauss(v,mk.ctrl));
    const dprime=Math.abs(mk.ctrl.m-mk.dys.m)/Math.sqrt((mk.ctrl.sd*mk.ctrl.sd+mk.dys.sd*mk.dys.sd)/2);
    const side=lr>3?'dys':lr>1/3?'mid':'ctrl';
    return {mk,v,lr,dprime,side};
  });
}

export const slurGauss = gauss;

/* ---- transcript, sentiment, emotion ----------------------------------- */
export function sentiment(txt){
  if(!txt) return null;
  const w=txt.toLowerCase().replace(/[^a-z' ]/g,' ').split(/\s+/).filter(Boolean);
  let v=0,a=0,n=0;
  w.forEach((x,i)=>{const e=LEX[x]; if(!e) return; const f=(i>0&&NEG.has(w[i-1]))||(i>1&&NEG.has(w[i-2]))?-1:1; v+=e[0]*f; a+=e[1]; n++;});
  return {words:w.length,matched:n,valence:n?v/n:0,arousal:n?a/n:0};
}

export function wordAcc(target, hyp){
  if(!target||!hyp) return null;
  const nz=s=>s.toLowerCase().replace(/[^\p{L}\p{N} ]/gu,' ').split(/\s+/).filter(Boolean);
  const A=nz(target),B=nz(hyp);
  const dp=Array.from({length:A.length+1},(_,i)=>Array(B.length+1).fill(0));
  for(let i=0;i<=A.length;i++)dp[i][0]=i; for(let j=0;j<=B.length;j++)dp[0][j]=j;
  for(let i=1;i<=A.length;i++)for(let j=1;j<=B.length;j++)
    dp[i][j]=Math.min(dp[i-1][j]+1,dp[i][j-1]+1,dp[i-1][j-1]+(A[i-1]===B[j-1]?0:1));
  return {wer:dp[A.length][B.length]/A.length,ref:A.length,hyp:B.length};
}

export function acousticArousal(res){
  const p=res.free||res.read; if(!p||p.error) return null;
  const z=(v,lo,hi)=>isFinite(v)?(v-(lo+hi)/2)/((hi-lo)/4):0;
  const t=p.spectral?p.spectral.tiltDbPerKhz:-12;
  const s=(z(p.f0Mean,100,220)*0.9+z(p.f0RangeSemitones,6,20)+z(p.intensitySd,3,11)*0.8+
           z(p.articulationRate,4.0,6.2)*0.9+z(-t,7,16)*0.6)/4.2;
  return Math.max(-1,Math.min(1,s));
}

export { REF, DOMAINS, SLUR, SCRIPTS, TASKS };
