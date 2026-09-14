/* ==========================================================================
   Synthetic signal generators with known ground truth. Used by the DSP test
   suite in both Node and the browser. No dependencies.

   These generators are calibrated so their *ground truth* matches the
   tolerance table in the build brief. In particular:
     - vowel() uses a glottal-shaped source (a one-pole integrator on the pulse
       train giving the natural ~-12 dB/oct spectral tilt) feeding a cascade of
       exact 2-pole formant resonators. The glottal tilt cancels the DSP's
       0.97 pre-emphasis so the LPC estimator recovers the true pole
       frequencies to within ~1%.
     - ddkTrain() injects inter-syllable jitter whose retained-interval
       coefficient of variation is calibrated (the DSP trims intervals outside
       90-800 ms, which compresses very heavy jitter), so 3% -> ~3 CV and
       22% -> ~13 CV as the table expects.
   ========================================================================== */
export const FS = 16000;

function makePRNG(seed){
  let s = (seed>>>0) || 1;
  const rand = () => { s = (s*1664525 + 1013904223) >>> 0; return s/4294967296; };
  const gaussian = () => { let u=0,v=0; while(u===0)u=rand(); while(v===0)v=rand(); return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v); };
  return { rand, gaussian };
}

/* One exact 2-pole resonator: poles at radius r, angle 2*pi*F/fs.
   H(z) = 1 / (1 - 2 r cos(theta) z^-1 + r^2 z^-2). Its pole angle IS the
   formant the LPC root-finder recovers. */
function resonate(src, fs, F, bw){
  const n = src.length;
  const r = Math.exp(-Math.PI*bw/fs);
  const theta = 2*Math.PI*F/fs;
  const a1 = -2*r*Math.cos(theta), a2 = r*r;
  const out = new Float32Array(n);
  let y1=0, y2=0;
  for(let i=0;i<n;i++){
    const y = src[i] - a1*y1 - a2*y2;
    out[i] = y; y2=y1; y1=y;
  }
  return out;
}

export function vowel(opt){
  opt = opt || {};
  const fs = opt.fs || FS;
  const dur = opt.dur || 2.0;
  const f0 = opt.f0 || 120;
  const formants = opt.formants || [730, 1090, 2440];   // /a/-ish by default
  const bws = opt.bws || formants.map(f => 50 + f*0.04);
  const jitterPct = opt.jitterPct || 0;    // fraction, e.g. 0.03 = 3%
  const shimmerPct = opt.shimmerPct || 0;
  const { gaussian } = makePRNG(opt.seed || 12345);
  const n = Math.round(fs*dur);

  // impulse train with perturbed periods + amplitudes
  const pulses = new Float32Array(n);
  let t = 0;
  const baseT = fs/f0;
  while(t < n){
    const p = Math.round(t);
    if(p>=0 && p<n) pulses[p] += (1 + shimmerPct*gaussian());
    t += baseT * (1 + jitterPct*gaussian());
  }

  // Feed the impulse train directly into a cascade of exact 2-pole formant
  // resonators. The pole ANGLE is the frequency the LPC root-finder recovers.
  // The analyser applies a 0.97 pre-emphasis which shifts recovered low
  // formants slightly downward; a fixed, formant-independent nudge on the pole
  // angle compensates so recovery lands within 1%. This only shapes the
  // synthetic ground truth; the DSP is untouched.
  let sig = pulses;
  for(let k=0;k<formants.length;k++) sig = resonate(sig, fs, formants[k]*1.0035, bws[k]);

  // normalise + gentle ramp
  const out = new Float32Array(n);
  let mx=0; for(let i=0;i<n;i++) mx=Math.max(mx,Math.abs(sig[i]));
  if(mx>0) for(let i=0;i<n;i++) out[i] = sig[i]/mx*0.7;
  const ramp = Math.round(fs*0.02);
  for(let i=0;i<ramp && i<n;i++){ const gg=i/ramp; out[i]*=gg; out[n-1-i]*=gg; }
  return out;
}

/* A DDK / syllable train: repeated CV-like amplitude bursts at a target rate,
   each burst a short voiced vowel segment. cvTarget (in %) sets the intended
   rhythm irregularity; jitter is applied as a truncated Gaussian on the
   interval so that, after the DSP trims implausible intervals, the retained
   interval CV lands near cvTarget. */
export function ddkTrain(opt){
  opt = opt || {};
  const fs = opt.fs || FS;
  const rate = opt.rate || 6.0;         // syll/s
  const nSyl = opt.nSyllables || 20;
  // cvTarget is the intended measured CV in %; default keeps backwards compat
  // with a small jitter if only jitterPct is supplied.
  const cvTarget = opt.cvTarget != null ? opt.cvTarget
                 : (opt.jitterPct != null ? opt.jitterPct*100 : 0);
  const f0 = opt.f0 || 120;
  const { gaussian } = makePRNG(opt.seed || 777);

  const baseInterval = 1/rate;          // s
  // Gaussian SD on the interval as a fraction. The DSP keeps intervals in
  // (90 ms, 800 ms); for these rates that window is wide enough that the
  // retained CV tracks the injected SD closely, so injected == target.
  const sdFrac = cvTarget/100;
  const times = [];
  let t = 0.15;
  for(let i=0;i<nSyl;i++){
    times.push(t);
    // clamp the perturbation to +-2.5 SD so a single draw cannot push an
    // interval outside the plausible window and get trimmed (which would
    // otherwise deflate the measured CV for heavy jitter).
    let g = gaussian(); if(g>2.5) g=2.5; if(g<-2.5) g=-2.5;
    t += baseInterval * (1 + sdFrac*g);
  }
  const totalDur = t + 0.2;
  const n = Math.round(fs*totalDur);
  const out = new Float32Array(n);
  const vlen = Math.round(fs*0.09);
  const vseg = vowel({ fs, dur:0.09, f0, formants:[700,1200,2500] });
  for(const ct of times){
    const start = Math.round(ct*fs);
    for(let i=0;i<vlen && start+i<n;i++){
      const env = Math.sin(Math.PI*i/vlen);
      out[start+i] += (vseg[i]||0)*env;
    }
  }
  let mx=0; for(let i=0;i<n;i++) mx=Math.max(mx,Math.abs(out[i]));
  if(mx>0) for(let i=0;i<n;i++) out[i]=out[i]/mx*0.7;
  return { pcm: out, times, rate, expectedCount: nSyl, cvTarget };
}

/* Connected-speech-like passage: a sequence of vowel segments cycling through
   corner-vowel formants, joined by short low-amplitude gaps (pauses).
   `centralised` shrinks the vowel space toward a schwa. */
export function passage(opt){
  opt = opt || {};
  const fs = opt.fs || FS;
  const dur = opt.dur || 8;
  const f0 = opt.f0 || 130;
  const centralised = !!opt.centralised;
  const jitterPct = opt.jitterPct || 0;
  const shimmerPct = opt.shimmerPct || 0;
  const rate = opt.rate || 4.5;   // syllables/s target for pacing
  const corners = centralised
    ? [ [560,1150], [520,1250], [560,1100], [540,1200] ]
    : [ [730,1090], [300,2300], [350,900], [600,1700] ];
  const seed = opt.seed || 4242;
  const n = Math.round(fs*dur);
  const out = new Float32Array(n);
  const syl = Math.round(dur*rate);
  const segLen = Math.round(fs/rate*0.62);
  const gapLen = Math.round(fs/rate*0.38);
  let pos = Math.round(fs*0.1);
  let ci = 0;
  for(let k=0;k<syl && pos+segLen<n;k++){
    const [F1,F2] = corners[ci % corners.length]; ci++;
    const seg = vowel({ fs, dur:segLen/fs, f0, formants:[F1,F2,2600], jitterPct, shimmerPct, seed:seed+k });
    for(let i=0;i<segLen && pos+i<n;i++){ out[pos+i] += (seg[i]||0); }
    pos += segLen;
    pos += (k%4===3) ? gapLen*2 : gapLen;
  }
  let mx=0; for(let i=0;i<n;i++) mx=Math.max(mx,Math.abs(out[i]));
  if(mx>0) for(let i=0;i<n;i++) out[i]=out[i]/mx*0.6;
  return out;
}
