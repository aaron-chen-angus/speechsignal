/* ==========================================================================
   SLURR-1 DSP CORE  —  dependency-free acoustic analysis for motor speech
   All algorithms implemented from published definitions:
     F0 / HNR .......... Boersma (1993) normalised autocorrelation
     Jitter / Shimmer .. Titze (1995) / MDVP definitions on glottal pulse marks
     CPPS .............. Hillenbrand (1994) / Awan (2010) smoothed cepstral peak
     Formants .......... LPC autocorrelation + Levinson-Durbin + Durand-Kerner
     VSA / FCR ......... Sapir et al. (2010) formant centralisation ratio
     Syllable nuclei ... de Jong & Wempe (2009) intensity-peak method
     MFCC .............. Davis & Mermelstein (1980), 26 mel filters -> 13 DCT

   PORTED VERBATIM from reference/smile-speech-lab.html (first <script> block).
   The ONLY change from the prototype is module syntax: the original
   `(function (root) { ... root.DSP = {...}; })(module.exports||window)`
   UMD wrapper is replaced by a single ES-module `export const DSP = {...}`.
   No algorithm, constant, threshold, or line of computational logic has been
   altered, reordered, or "improved". If a function looks wrong, it is left as
   written in the verified prototype.
   ========================================================================== */
'use strict';

/* ---------- small helpers ------------------------------------------------ */
const mean = a => a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN;
const sd = a => { if (a.length < 2) return NaN; const m = mean(a); return Math.sqrt(a.reduce((s, v) => s + (v - m) * (v - m), 0) / (a.length - 1)); };
const median = a => { if (!a.length) return NaN; const b = [...a].sort((x, y) => x - y); const h = b.length >> 1; return b.length % 2 ? b[h] : (b[h - 1] + b[h]) / 2; };
const pct = (a, p) => { if (!a.length) return NaN; const b = [...a].sort((x, y) => x - y); const i = Math.min(b.length - 1, Math.max(0, Math.round(p / 100 * (b.length - 1)))); return b[i]; };
const clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;

function hann(N) { const w = new Float32Array(N); for (let i = 0; i < N; i++) w[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (N - 1)); return w; }
function hamming(N) { const w = new Float32Array(N); for (let i = 0; i < N; i++) w[i] = 0.54 - 0.46 * Math.cos(2 * Math.PI * i / (N - 1)); return w; }

/* ---------- FFT (iterative radix-2, in-place) ---------------------------- */
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ur = re[i + k], ui = im[i + k];
        const vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci;
        const vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
        re[i + k] = ur + vr; im[i + k] = ui + vi;
        re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi;
        const ncr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = ncr;
      }
    }
  }
}
const nextPow2 = n => { let p = 1; while (p < n) p <<= 1; return p; };

function magSpectrum(frame, nfft) {
  const N = nfft || nextPow2(frame.length);
  const re = new Float64Array(N), im = new Float64Array(N);
  for (let i = 0; i < frame.length; i++) re[i] = frame[i];
  fft(re, im);
  const m = new Float64Array(N / 2 + 1);
  for (let i = 0; i <= N / 2; i++) m[i] = Math.hypot(re[i], im[i]);
  return m;
}

/* ---------- resampling / pre-processing ---------------------------------- */
function resample(x, fsIn, fsOut) {
  if (Math.abs(fsIn - fsOut) < 1) return Float32Array.from(x);
  // 2nd-order Butterworth low-pass at 0.45*fsOut before decimation
  if (fsOut < fsIn) x = lowpass(x, fsIn, 0.45 * fsOut);
  const ratio = fsIn / fsOut, n = Math.floor(x.length / ratio), y = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const p = i * ratio, i0 = Math.floor(p), f = p - i0;
    y[i] = (1 - f) * x[i0] + f * (x[Math.min(i0 + 1, x.length - 1)]);
  }
  return y;
}
function lowpass(x, fs, fc) {
  const w = Math.tan(Math.PI * fc / fs), n = 1 / (1 + Math.SQRT2 * w + w * w);
  const b0 = w * w * n, b1 = 2 * b0, b2 = b0;
  const a1 = 2 * (w * w - 1) * n, a2 = (1 - Math.SQRT2 * w + w * w) * n;
  const y = new Float32Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v;
  }
  return y;
}
function removeDC(x) {
  let m = 0; for (let i = 0; i < x.length; i++) m += x[i]; m /= x.length;
  const y = new Float32Array(x.length);
  for (let i = 0; i < x.length; i++) y[i] = x[i] - m;
  return y;
}
function preEmphasis(x, a) {
  a = a === undefined ? 0.97 : a;
  const y = new Float32Array(x.length); y[0] = x[0];
  for (let i = 1; i < x.length; i++) y[i] = x[i] - a * x[i - 1];
  return y;
}
function normalise(x) {
  let mx = 0; for (let i = 0; i < x.length; i++) mx = Math.max(mx, Math.abs(x[i]));
  if (mx < 1e-9) return Float32Array.from(x);
  const y = new Float32Array(x.length); for (let i = 0; i < x.length; i++) y[i] = x[i] / mx * 0.95;
  return y;
}

/* ---------- intensity contour (dB SPL-relative) -------------------------- */
function intensityContour(x, fs, winMs, hopMs) {
  const W = Math.round(fs * winMs / 1000), H = Math.round(fs * hopMs / 1000);
  const out = [];
  for (let s = 0; s + W <= x.length; s += H) {
    let e = 0; for (let i = 0; i < W; i++) e += x[s + i] * x[s + i];
    out.push(10 * Math.log10(e / W + 1e-12));
  }
  return { db: out, hop: H / fs, win: W / fs };
}

/* ---------- F0 + HNR : Boersma normalised autocorrelation ---------------- */
function acfFrame(frame, fs, fmin, fmax) {
  const N = frame.length, nfft = nextPow2(2 * N);
  const w = hann(N);
  const wf = new Float64Array(N);
  let m = 0; for (let i = 0; i < N; i++) m += frame[i]; m /= N;
  for (let i = 0; i < N; i++) wf[i] = (frame[i] - m) * w[i];
  const acx = autocorr(wf, nfft), acw = autocorr(w, nfft);
  // window must hold >= 3 periods for a stable normalised ACF (Boersma 1993)
  const minLag = Math.floor(fs / fmax);
  const maxLag = Math.min(Math.ceil(fs / fmin), Math.floor(N / 3));
  const rn = new Float64Array(maxLag + 2);
  let best = -1, bestLag = -1;
  for (let lag = minLag; lag <= maxLag; lag++) {
    const norm = acw[lag] / acw[0];
    if (norm < 0.05) continue;
    const r = (acx[lag] / acx[0]) / norm;
    rn[lag] = r;
    if (r > best) { best = r; bestLag = lag; }
  }
  if (bestLag < 0) return { f0: 0, r: 0, hnr: -Infinity };
  // octave-error guard: take the shortest lag that is a local peak reaching
  // octaveCost x the global maximum
  for (let lag = minLag + 1; lag < bestLag; lag++) {
    if (rn[lag] >= 0.86 * best && rn[lag] >= rn[lag - 1] && rn[lag] >= rn[lag + 1]) {
      bestLag = lag; best = rn[lag]; break;
    }
  }
  // parabolic refinement
  let lag = bestLag;
  if (bestLag > minLag && bestLag < maxLag) {
    const y0 = acx[bestLag - 1], y1 = acx[bestLag], y2 = acx[bestLag + 1];
    const d = (y0 - 2 * y1 + y2);
    if (Math.abs(d) > 1e-15) lag = bestLag + 0.5 * (y0 - y2) / d;
  }
  const r = clamp(best, 0, 0.999999);
  return { f0: fs / lag, r: r, hnr: 10 * Math.log10(r / (1 - r)) };
}
function autocorr(sig, nfft) {
  const re = new Float64Array(nfft), im = new Float64Array(nfft);
  for (let i = 0; i < sig.length; i++) re[i] = sig[i];
  fft(re, im);
  for (let i = 0; i < nfft; i++) { re[i] = re[i] * re[i] + im[i] * im[i]; im[i] = 0; }
  fft(re, im);                      // FFT of real even sequence == IFFT * N
  const out = new Float64Array(nfft);
  for (let i = 0; i < nfft; i++) out[i] = re[i] / nfft;
  return out;
}

function pitchTrack(x, fs, opt) {
  opt = opt || {};
  const fmin = opt.fmin || 60, fmax = opt.fmax || 500;
  const W = Math.round(fs * (opt.winMs || 40) / 1000), H = Math.round(fs * (opt.hopMs || 10) / 1000);
  const f0 = [], hnr = [], voiced = [], rms = [], t = [];
  for (let s = 0; s + W <= x.length; s += H) {
    const fr = x.subarray(s, s + W);
    let e = 0; for (let i = 0; i < W; i++) e += fr[i] * fr[i];
    const r = Math.sqrt(e / W);
    const a = acfFrame(fr, fs, fmin, fmax);
    const isV = a.r > (opt.voicingThreshold || 0.45) && r > (opt.silenceRms || 0.004);
    f0.push(isV ? a.f0 : 0); hnr.push(isV ? a.hnr : NaN);
    voiced.push(isV); rms.push(r); t.push(s / fs);
  }
  return { f0, hnr, voiced, rms, t, hop: H / fs };
}

/* ---------- glottal pulse marks -> jitter / shimmer ---------------------- */
function pulseMarks(x, fs, f0med) {
  if (!(f0med > 0)) return [];
  const T = fs / f0med;
  // band-limit to first 3 harmonics region to stabilise peak picking
  const s = lowpass(x, fs, Math.min(fs / 2 - 200, Math.max(600, f0med * 3.5)));
  // seed: global max
  let seed = 0, mx = -1;
  for (let i = 0; i < s.length; i++) if (Math.abs(s[i]) > mx) { mx = Math.abs(s[i]); seed = i; }
  const marks = [seed];
  const search = (from, dir) => {
    let cur = from;
    for (;;) {
      const centre = cur + dir * T;
      const lo = Math.round(centre - 0.35 * T), hi = Math.round(centre + 0.35 * T);
      if (lo < 1 || hi >= s.length - 1) break;
      let p = -1, best = -Infinity;
      for (let i = lo; i <= hi; i++) if (s[i] > best) { best = s[i]; p = i; }
      if (p < 0) break;
      marks.push(p); cur = p;
    }
  };
  search(seed, +1); search(seed, -1);
  marks.sort((a, b) => a - b);
  return marks;
}
function perturbation(x, fs, f0med) {
  const marks = pulseMarks(x, fs, f0med);
  if (marks.length < 6) return null;
  const T = [], A = [];
  for (let i = 1; i < marks.length; i++) {
    const p = (marks[i] - marks[i - 1]) / fs;
    if (p < 1 / 500 || p > 1 / 55) continue;                       // reject octave errors
    T.push(p);
    let a = 0; const lo = marks[i - 1], hi = marks[i];
    for (let k = lo; k < hi; k++) a = Math.max(a, Math.abs(x[k]));
    A.push(a);
  }
  if (T.length < 5) return null;
  const mT = mean(T), mA = mean(A);
  const absDiff = arr => { let s = 0; for (let i = 1; i < arr.length; i++) s += Math.abs(arr[i] - arr[i - 1]); return s / (arr.length - 1); };
  const ppq = (arr, K) => {                                        // K-point period/amp perturbation quotient
    const h = (K - 1) / 2; let s = 0, n = 0;
    for (let i = h; i < arr.length - h; i++) {
      let loc = 0; for (let k = -h; k <= h; k++) loc += arr[i + k];
      s += Math.abs(arr[i] - loc / K); n++;
    }
    return n ? (s / n) / mean(arr) * 100 : NaN;
  };
  const dbA = A.map(v => 20 * Math.log10(v + 1e-12));
  return {
    nPulses: T.length + 1,
    meanPeriod: mT,
    f0FromPulses: 1 / mT,
    jitterLocal: absDiff(T) / mT * 100,                            // %
    jitterAbsUs: absDiff(T) * 1e6,                                 // µs
    jitterRap: ppq(T, 3),
    jitterPpq5: ppq(T, 5),
    shimmerLocal: absDiff(A) / mA * 100,                           // %
    shimmerDb: absDiff(dbA),                                       // dB
    shimmerApq3: ppq(A, 3),
    shimmerApq5: ppq(A, 5),
    periodCv: sd(T) / mT * 100
  };
}

/* ---------- cepstral peak prominence (smoothed) -------------------------- */
function cpps(x, fs, opt) {
  opt = opt || {};
  const W = Math.round(fs * 0.04);
  const H = Math.round(fs * 0.01) * (opt.stride || (x.length / fs > 12 ? 3 : 1));
  const nfft = nextPow2(W * 2), w = hann(W);
  const qMin = Math.floor(fs / (opt.fmax || 350)), qMax = Math.ceil(fs / (opt.fmin || 60));
  const frames = [];
  for (let s = 0; s + W <= x.length; s += H) {
    const re = new Float64Array(nfft), im = new Float64Array(nfft);
    for (let i = 0; i < W; i++) re[i] = x[s + i] * w[i];
    fft(re, im);
    for (let i = 0; i < nfft; i++) { re[i] = Math.log(re[i] * re[i] + im[i] * im[i] + 1e-20); im[i] = 0; }
    fft(re, im);
    const c = new Float64Array(qMax + 2);
    for (let i = 0; i <= qMax + 1; i++) c[i] = Math.abs(re[i]) / nfft;
    frames.push(c);
  }
  if (!frames.length) return NaN;
  // time smoothing (10 frames) then quefrency smoothing (10 bins)
  const L = qMax + 2, sm = [];
  for (let f = 0; f < frames.length; f++) {
    const c = new Float64Array(L);
    for (let q = 0; q < L; q++) {
      let s = 0, n = 0;
      for (let k = -5; k <= 5; k++) { const j = f + k; if (j >= 0 && j < frames.length) { s += frames[j][q]; n++; } }
      c[q] = s / n;
    }
    const c2 = new Float64Array(L);
    for (let q = 0; q < L; q++) {
      let s = 0, n = 0;
      for (let k = -5; k <= 5; k++) { const j = q + k; if (j >= 0 && j < L) { s += c[j]; n++; } }
      c2[q] = s / n;
    }
    sm.push(c2);
  }
  const vals = [];
  for (const c of sm) {
    // log-magnitude cepstrum in dB, regression over the analysis quefrency range
    const db = [], qs = [];
    for (let q = qMin; q <= qMax; q++) { db.push(20 * Math.log10(c[q] + 1e-12)); qs.push(q); }
    const n = qs.length, mq = mean(qs), md = mean(db);
    let num = 0, den = 0;
    for (let i = 0; i < n; i++) { num += (qs[i] - mq) * (db[i] - md); den += (qs[i] - mq) * (qs[i] - mq); }
    const slope = num / den, intercept = md - slope * mq;
    let peak = -Infinity, pq = qMin;
    for (let i = 0; i < n; i++) if (db[i] > peak) { peak = db[i]; pq = qs[i]; }
    vals.push(peak - (slope * pq + intercept));
  }
  return mean(vals);
}

/* ---------- LPC + formants ----------------------------------------------- */
function levinson(r, order) {
  const a = new Float64Array(order + 1); a[0] = 1;
  let e = r[0];
  if (e <= 0) return { a, e: 0 };
  for (let i = 1; i <= order; i++) {
    let acc = r[i];
    for (let j = 1; j < i; j++) acc += a[j] * r[i - j];
    const k = -acc / e;
    const prev = a.slice();
    for (let j = 1; j < i; j++) a[j] = prev[j] + k * prev[i - j];
    a[i] = k;
    e *= (1 - k * k);
    if (e <= 0) break;
  }
  return { a, e };
}
function lpc(frame, order) {
  const N = frame.length, r = new Float64Array(order + 1);
  for (let k = 0; k <= order; k++) { let s = 0; for (let i = 0; i < N - k; i++) s += frame[i] * frame[i + k]; r[k] = s; }
  r[0] *= 1.0001; r[0] += 1e-9;                                     // ridge for stability
  return levinson(r, order).a;
}
function durandKerner(coef) {                                       // coef[0]*z^n + ... + coef[n]
  const n = coef.length - 1;
  const c = coef.map(v => v / coef[0]);
  let zr = new Float64Array(n), zi = new Float64Array(n);
  for (let i = 0; i < n; i++) { const ang = 2 * Math.PI * i / n + 0.4; zr[i] = 0.4 * Math.cos(ang); zi[i] = 0.4 * Math.sin(ang); }
  const evalP = (xr, xi) => { let ar = c[0], ai = 0; for (let k = 1; k <= n; k++) { const nr = ar * xr - ai * xi + c[k]; ai = ar * xi + ai * xr; ar = nr; } return [ar, ai]; };
  for (let it = 0; it < 200; it++) {
    let maxd = 0;
    for (let i = 0; i < n; i++) {
      let [pr, pi] = evalP(zr[i], zi[i]);
      let dr = 1, di = 0;
      for (let j = 0; j < n; j++) {
        if (j === i) continue;
        const ar = zr[i] - zr[j], ai = zi[i] - zi[j];
        const nr = dr * ar - di * ai, ni = dr * ai + di * ar; dr = nr; di = ni;
      }
      const den = dr * dr + di * di; if (den < 1e-300) continue;
      const qr = (pr * dr + pi * di) / den, qi = (pi * dr - pr * di) / den;
      zr[i] -= qr; zi[i] -= qi;
      maxd = Math.max(maxd, Math.hypot(qr, qi));
    }
    if (maxd < 1e-12) break;
  }
  return { re: zr, im: zi };
}
function formants(frame, fs, opt) {
  opt = opt || {};
  const order = opt.order || Math.round(2 + fs / 1000);
  const w = hamming(frame.length);
  const f = new Float64Array(frame.length);
  const pe = preEmphasis(frame, 0.97);
  for (let i = 0; i < frame.length; i++) f[i] = pe[i] * w[i];
  const a = lpc(f, order);
  const roots = durandKerner(Array.from(a));
  const out = [];
  for (let i = 0; i < roots.re.length; i++) {
    const re = roots.re[i], im = roots.im[i];
    if (im <= 0) continue;
    const r = Math.hypot(re, im); if (r >= 1 || r < 0.5) continue;
    const freq = Math.atan2(im, re) * fs / (2 * Math.PI);
    const bw = -Math.log(r) * fs / Math.PI;
    if (freq > 90 && freq < fs / 2 - 150 && bw < (opt.maxBw || 700)) out.push({ f: freq, bw });
  }
  out.sort((p, q) => p.f - q.f);
  return out;
}
function trackFormants(x, fs, opt) {
  opt = opt || {};
  const hopMs = opt.hopMs || 10;
  const W = Math.round(fs * 0.025), H = Math.round(fs * hopMs / 1000);
  const F1 = [], F2 = [], F3 = [], t = [];
  const pt = opt.pt || pitchTrack(x, fs, { hopMs: hopMs, winMs: 40 });
  let fi = 0;
  for (let s = 0; s + W <= x.length; s += H, fi++) {
    if (pt.voiced[fi] === false) { continue; }
    const fm = formants(x.subarray(s, s + W), fs, opt);
    if (fm.length >= 3) { F1.push(fm[0].f); F2.push(fm[1].f); F3.push(fm[2].f); t.push(s / fs); }
  }
  return { F1, F2, F3, t };
}
/* steady-state formant estimate: median of the middle 60 % of a vowel */
function steadyVowelFormants(x, fs) {
  const tr = trackFormants(x, fs);
  if (tr.F1.length < 5) return null;
  const a = Math.floor(tr.F1.length * 0.2), b = Math.ceil(tr.F1.length * 0.8);
  return {
    F1: median(tr.F1.slice(a, b)), F2: median(tr.F2.slice(a, b)), F3: median(tr.F3.slice(a, b)),
    F1sd: sd(tr.F1.slice(a, b)), F2sd: sd(tr.F2.slice(a, b)), n: b - a
  };
}

/* ---------- vowel space -------------------------------------------------- */
function vowelSpace(v) {   // v = {a:{F1,F2}, i:{F1,F2}, u:{F1,F2}}
  if (!v.a || !v.i || !v.u) return null;
  const A = v.a, I = v.i, U = v.u;
  const tVSA = Math.abs(A.F1 * (I.F2 - U.F2) + I.F1 * (U.F2 - A.F2) + U.F1 * (A.F2 - I.F2)) / 2;
  const FCR = (U.F2 + A.F2 + I.F1 + U.F1) / (I.F2 + A.F1);
  const VAI = 1 / FCR;
  const F2ratio = I.F2 / U.F2;
  return { tVSA, FCR, VAI, F2ratio };
}

/* ---------- syllable nuclei (de Jong & Wempe 2009) ----------------------- */
function syllableNuclei(x, fs, opt) {
  opt = opt || {};
  const silenceDb = opt.silenceDb === undefined ? -25 : opt.silenceDb;   // rel. to 99th pct
  const minDip = opt.minDip === undefined ? 2 : opt.minDip;              // dB
  const minGapMs = opt.minGapMs === undefined ? 70 : opt.minGapMs;
  const ic = intensityContour(x, fs, opt.envWinMs || 32, opt.envHopMs || 8);
  const db = ic.db;
  const peak99 = pct(db, 99);
  const thresh = peak99 + silenceDb;
  const pt = opt.pt || pitchTrack(x, fs, { hopMs: opt.envHopMs || 8, winMs: 40, voicingThreshold: opt.voicingThreshold || 0.35 });
  const peaks = [];
  for (let i = 1; i < db.length - 1; i++) {
    if (db[i] > db[i - 1] && db[i] >= db[i + 1] && db[i] > thresh) peaks.push(i);
  }
  const kept = [];
  for (let p = 0; p < peaks.length; p++) {
    const i = peaks[p];
    // require a dip of >= minDip dB between this and the previous kept peak
    if (kept.length) {
      const j = kept[kept.length - 1];
      let valley = Infinity;
      for (let k = j; k <= i; k++) valley = Math.min(valley, db[k]);
      if (Math.min(db[i], db[j]) - valley < minDip) { if (db[i] > db[j]) kept[kept.length - 1] = i; continue; }
      if ((i - j) * ic.hop * 1000 < minGapMs) { if (db[i] > db[j]) kept[kept.length - 1] = i; continue; }
    }
    const vIdx = Math.round(i * ic.hop / pt.hop);
    if (pt.voiced[vIdx] || pt.voiced[Math.max(0, vIdx - 1)] || pt.voiced[Math.min(pt.voiced.length - 1, vIdx + 1)]) kept.push(i);
  }
  return { times: kept.map(i => i * ic.hop), count: kept.length, hop: ic.hop, db, thresh };
}

/* ---------- voice activity, pauses, rate --------------------------------- */
function speechTiming(x, fs, opt) {
  opt = opt || {};
  const ic = intensityContour(x, fs, 30, 10);
  const db = ic.db, hop = ic.hop;
  const thresh = pct(db, 95) - (opt.silenceDb === undefined ? 25 : opt.silenceDb);
  const minPause = opt.minPauseMs === undefined ? 150 : opt.minPauseMs;
  const active = db.map(v => v > thresh);
  // merge short gaps
  const segs = [];
  let i = 0;
  while (i < active.length) {
    if (!active[i]) { i++; continue; }
    let j = i; while (j < active.length && active[j]) j++;
    segs.push([i, j]); i = j;
  }
  const merged = [];
  for (const s of segs) {
    if (merged.length && (s[0] - merged[merged.length - 1][1]) * hop * 1000 < minPause) merged[merged.length - 1][1] = s[1];
    else merged.push([...s]);
  }
  const pauses = [];
  for (let k = 1; k < merged.length; k++) pauses.push((merged[k][0] - merged[k - 1][1]) * hop);
  const phonTime = merged.reduce((s, m) => s + (m[1] - m[0]) * hop, 0);
  const start = merged.length ? merged[0][0] * hop : 0;
  const end = merged.length ? merged[merged.length - 1][1] * hop : x.length / fs;
  const total = Math.max(1e-6, end - start);
  const syl = syllableNuclei(x, fs, opt);
  return {
    totalDur: x.length / fs,
    speakingDur: total,
    phonationTime: phonTime,
    phonationRatio: phonTime / total,
    nPauses: pauses.length,
    pauseTotal: pauses.reduce((s, v) => s + v, 0),
    pauseMean: pauses.length ? mean(pauses) : 0,
    pauseMax: pauses.length ? Math.max(...pauses) : 0,
    pauseRatio: 1 - phonTime / total,
    nSyllables: syl.count,
    speechRate: syl.count / total,                 // syll/s incl. pauses
    articulationRate: phonTime > 0 ? syl.count / phonTime : NaN,  // syll/s excl. pauses
    syllableTimes: syl.times,
    segments: merged.map(m => [m[0] * hop, m[1] * hop])
  };
}

/* ---------- DDK (diadochokinesis) ---------------------------------------- */
function ddkAnalysis(x, fs) {
  const syl = syllableNuclei(x, fs, { minDip: 1.5, minGapMs: 80, silenceDb: -32, envWinMs: 18, envHopMs: 4, voicingThreshold: 0.30 });
  const t = syl.times;
  if (t.length < 4) return { nSyllables: t.length, rate: NaN, cvInterval: NaN, times: t };
  const iv = []; for (let i = 1; i < t.length; i++) iv.push(t[i] - t[i - 1]);
  // trim implausible intervals (< 90 ms or > 800 ms)
  const ok = iv.filter(v => v > 0.09 && v < 0.8);
  const dur = t[t.length - 1] - t[0];
  return {
    nSyllables: t.length,
    rate: (t.length - 1) / dur,                     // syll/s
    meanInterval: mean(ok),
    sdInterval: sd(ok),
    cvInterval: sd(ok) / mean(ok) * 100,            // % — rhythm irregularity
    times: t
  };
}

/* ---------- spectral descriptors ----------------------------------------- */
function spectralFeatures(x, fs) {
  const W = Math.round(fs * 0.025), H = Math.round(fs * 0.010), nfft = nextPow2(W);
  const w = hann(W);
  const cen = [], spr = [], rol = [], flx = [], flt = [], tilt = [];
  let prev = null;
  const lts = new Float64Array(nfft / 2 + 1); let nlts = 0;
  for (let s = 0; s + W <= x.length; s += H) {
    const fr = new Float64Array(W);
    let e = 0;
    for (let i = 0; i < W; i++) { fr[i] = x[s + i] * w[i]; e += x[s + i] * x[s + i]; }
    if (Math.sqrt(e / W) < 0.005) { prev = null; continue; }
    const m = magSpectrum(fr, nfft);
    for (let i = 0; i < m.length; i++) lts[i] += m[i] * m[i]; nlts++;
    let sum = 0, wsum = 0;
    for (let i = 0; i < m.length; i++) { const f = i * fs / nfft; sum += m[i]; wsum += f * m[i]; }
    const c = wsum / (sum + 1e-12); cen.push(c);
    let v = 0; for (let i = 0; i < m.length; i++) { const f = i * fs / nfft; v += (f - c) * (f - c) * m[i]; }
    spr.push(Math.sqrt(v / (sum + 1e-12)));
    let acc = 0, r = 0; for (let i = 0; i < m.length; i++) { acc += m[i]; if (acc >= 0.85 * sum) { r = i * fs / nfft; break; } }
    rol.push(r);
    let lg = 0; for (let i = 1; i < m.length; i++) lg += Math.log(m[i] + 1e-12);
    flt.push(Math.exp(lg / (m.length - 1)) / (sum / m.length + 1e-12));
    if (prev) { let d = 0; for (let i = 0; i < m.length; i++) { const dd = m[i] - prev[i]; d += dd * dd; } flx.push(Math.sqrt(d)); }
    prev = m;
    // spectral tilt: regression of dB spectrum 0–5 kHz
    const nHi = Math.min(m.length - 1, Math.floor(5000 * nfft / fs));
    let sx = 0, sy = 0, sxy = 0, sxx = 0, n = 0;
    for (let i = 1; i <= nHi; i++) { const f = i * fs / nfft, d = 20 * Math.log10(m[i] + 1e-12); sx += f; sy += d; sxy += f * d; sxx += f * f; n++; }
    tilt.push((n * sxy - sx * sy) / (n * sxx - sx * sx) * 1000);   // dB per kHz
  }
  return {
    centroid: mean(cen), centroidSd: sd(cen),
    spread: mean(spr), rolloff85: mean(rol),
    flux: mean(flx), flatness: mean(flt),
    tiltDbPerKhz: mean(tilt)
  };
}

/* ---------- MFCC --------------------------------------------------------- */
function melFilterbank(nFilters, nfft, fs, fLo, fHi) {
  const hz2mel = f => 2595 * Math.log10(1 + f / 700), mel2hz = m => 700 * (Math.pow(10, m / 2595) - 1);
  const lo = hz2mel(fLo), hi = hz2mel(fHi);
  const pts = []; for (let i = 0; i < nFilters + 2; i++) pts.push(Math.floor((nfft + 1) * mel2hz(lo + (hi - lo) * i / (nFilters + 1)) / fs));
  const fb = [];
  for (let i = 1; i <= nFilters; i++) {
    const f = new Float64Array(nfft / 2 + 1);
    for (let k = pts[i - 1]; k < pts[i]; k++) f[k] = (k - pts[i - 1]) / Math.max(1, pts[i] - pts[i - 1]);
    for (let k = pts[i]; k < pts[i + 1]; k++) f[k] = (pts[i + 1] - k) / Math.max(1, pts[i + 1] - pts[i]);
    fb.push(f);
  }
  return fb;
}
function mfcc(x, fs, nCoef) {
  nCoef = nCoef || 13;
  const W = Math.round(fs * 0.025), H = Math.round(fs * 0.010), nfft = nextPow2(W);
  const w = hamming(W), fb = melFilterbank(26, nfft, fs, 50, Math.min(8000, fs / 2 - 100));
  const acc = []; for (let i = 0; i < nCoef; i++) acc.push([]);
  const pe = preEmphasis(x, 0.97);
  for (let s = 0; s + W <= pe.length; s += H) {
    const fr = new Float64Array(W); let e = 0;
    for (let i = 0; i < W; i++) { fr[i] = pe[s + i] * w[i]; e += pe[s + i] * pe[s + i]; }
    if (Math.sqrt(e / W) < 0.005) continue;
    const m = magSpectrum(fr, nfft);
    const eb = fb.map(f => { let s2 = 0; for (let k = 0; k < f.length; k++) s2 += f[k] * m[k] * m[k]; return Math.log(s2 + 1e-12); });
    for (let c = 0; c < nCoef; c++) {
      let v = 0; for (let k = 0; k < eb.length; k++) v += eb[k] * Math.cos(Math.PI * c * (k + 0.5) / eb.length);
      acc[c].push(v);
    }
  }
  return { mean: acc.map(mean), sd: acc.map(sd), nFrames: acc[0].length };
}

/* ---------- envelope modulation spectrum (speech rhythm) ----------------- */
function modulationSpectrum(x, fs) {
  const ic = intensityContour(x, fs, 25, 5);          // 200 Hz envelope
  const env = ic.db.map(v => Math.pow(10, v / 20));
  const m = mean(env);
  const n = nextPow2(env.length);
  const re = new Float64Array(n), im = new Float64Array(n);
  const w = hann(env.length);
  for (let i = 0; i < env.length; i++) re[i] = (env[i] - m) * w[i];
  fft(re, im);
  const envFs = 1 / ic.hop;
  const spec = [], freqs = [];
  for (let i = 1; i <= n / 2; i++) { const f = i * envFs / n; if (f > 20) break; spec.push(Math.hypot(re[i], im[i])); freqs.push(f); }
  const total = spec.reduce((s, v) => s + v, 0) + 1e-12;
  const band = (lo, hi) => { let s = 0; for (let i = 0; i < freqs.length; i++) if (freqs[i] >= lo && freqs[i] < hi) s += spec[i]; return s / total; };
  let pk = 0, pf = 0; for (let i = 0; i < freqs.length; i++) if (freqs[i] >= 1 && freqs[i] <= 12 && spec[i] > pk) { pk = spec[i]; pf = freqs[i]; }
  return { peakHz: pf, e2_8: band(2, 8), e0_2: band(0.2, 2), e8_20: band(8, 20) };
}

/* ---------- top-level task analysers ------------------------------------- */
function analyseSustainedVowel(x, fs, vowel) {
  const s = normalise(removeDC(x));
  const pt = pitchTrack(s, fs, { winMs: 55, hopMs: 10 });
  const vIdx = pt.voiced.map((v, i) => v ? i : -1).filter(i => i >= 0);
  if (vIdx.length < 10) return { error: 'no voiced signal detected' };
  const f0v = vIdx.map(i => pt.f0[i]).filter(v => v > 0);
  const f0med = median(f0v);
  // longest voiced run, trimmed 10 % at each end
  let bestA = 0, bestB = 0, a = vIdx[0], prev = vIdx[0];
  for (let k = 1; k < vIdx.length; k++) {
    if (vIdx[k] !== prev + 1) { if (prev - a > bestB - bestA) { bestA = a; bestB = prev; } a = vIdx[k]; }
    prev = vIdx[k];
  }
  if (prev - a > bestB - bestA) { bestA = a; bestB = prev; }
  const hopS = pt.hop;
  let s0 = Math.round((bestA + (bestB - bestA) * 0.1) * hopS * fs);
  let s1 = Math.round((bestB - (bestB - bestA) * 0.1) * hopS * fs);
  s1 = Math.min(s1, s.length); s0 = Math.max(0, s0);
  const seg = s.subarray(s0, Math.max(s0 + Math.round(fs * 0.2), s1));
  const pert = perturbation(seg, fs, f0med) || {};
  const hnrV = vIdx.map(i => pt.hnr[i]).filter(v => isFinite(v));
  const fm = steadyVowelFormants(seg, fs);
  const f0seg = pitchTrack(seg, fs, { winMs: 55, hopMs: 10 }).f0.filter(v => v > 0);
  return {
    vowel: vowel || 'a',
    durationS: x.length / fs,
    phonationTimeS: (bestB - bestA) * hopS,
    f0Mean: mean(f0seg), f0Sd: sd(f0seg), f0Median: median(f0seg),
    f0Cv: sd(f0seg) / mean(f0seg) * 100,
    f0Range: f0seg.length ? Math.max(...f0seg) - Math.min(...f0seg) : NaN,
    hnrMean: mean(hnrV), hnrSd: sd(hnrV),
    cpps: cpps(seg, fs),
    ...pert,
    F1: fm ? fm.F1 : NaN, F2: fm ? fm.F2 : NaN, F3: fm ? fm.F3 : NaN,
    F1sd: fm ? fm.F1sd : NaN, F2sd: fm ? fm.F2sd : NaN,
    voiceBreaks: countVoiceBreaks(pt),
    spectral: spectralFeatures(seg, fs)
  };
}
function countVoiceBreaks(pt) {
  let n = 0, inV = false, started = false;
  for (let i = 0; i < pt.voiced.length; i++) {
    if (pt.voiced[i]) { if (started && !inV) n++; inV = true; started = true; }
    else inV = false;
  }
  return Math.max(0, n);
}

function analyseDdk(x, fs) {
  const s = normalise(removeDC(x));
  const d = ddkAnalysis(s, fs);
  const t = speechTiming(s, fs, { minPauseMs: 250 });
  return { ...d, phonationRatio: t.phonationRatio, durationS: x.length / fs, spectral: spectralFeatures(s, fs) };
}

function analyseConnectedSpeech(x, fs) {
  const s = normalise(removeDC(x));
  const t = speechTiming(s, fs);
  const pt = pitchTrack(s, fs);
  const f0v = pt.f0.filter(v => v > 0);
  const hnrV = pt.hnr.filter(v => isFinite(v));
  const dbAll = intensityContour(s, fs, 30, 10).db;
  const loud = dbAll.filter(v => v > pct(dbAll, 95) - 25);
  const semitoneSd = f0v.length > 2 ? sd(f0v.map(v => 12 * Math.log2(v / median(f0v)))) : NaN;
  return {
    ...t,
    f0Mean: mean(f0v), f0Sd: sd(f0v), f0Median: median(f0v),
    f0P5: pct(f0v, 5), f0P95: pct(f0v, 95),
    f0RangeSemitones: f0v.length ? 12 * Math.log2(pct(f0v, 95) / Math.max(1, pct(f0v, 5))) : NaN,
    f0SdSemitones: semitoneSd,
    intensitySd: sd(loud),
    intensityRange: pct(loud, 95) - pct(loud, 5),
    hnrMean: mean(hnrV),
    cpps: cpps(s, fs),
    voicedFraction: pt.voiced.filter(Boolean).length / pt.voiced.length,
    spectral: spectralFeatures(s, fs),
    modulation: modulationSpectrum(s, fs),
    mfcc: mfcc(s, fs, 13)
  };
}


/* ---- connected-speech extensions (two-task protocol) -------------------- */

/* stable voiced runs: >= minMs, F0 coefficient of variation below cvMax */
function voicedRuns(pt, minMs, cvMax) {
  minMs = minMs || 120; cvMax = cvMax === undefined ? 12 : cvMax;
  const runs = [];
  let a = -1;
  for (let i = 0; i <= pt.voiced.length; i++) {
    const v = i < pt.voiced.length && pt.voiced[i];
    if (v && a < 0) a = i;
    if (!v && a >= 0) {
      const len = (i - a) * pt.hop * 1000;
      if (len >= minMs) {
        const f = pt.f0.slice(a, i).filter(x => x > 0);
        if (f.length > 3) {
          const cv = sd(f) / mean(f) * 100;
          if (cv <= cvMax) runs.push({ a, b: i, f0: median(f), cv, durMs: len });
        }
      }
      a = -1;
    }
  }
  return runs;
}

/* jitter / shimmer measured on the stable voiced portions of running speech.
   Less reliable than a sustained vowel: report nRuns and total analysed time. */
function perturbationConnected(x, fs, pt) {
  const runs = voicedRuns(pt, 150, 10);
  if (!runs.length) return null;
  runs.sort((p, q) => q.durMs - p.durMs);
  const use = runs.slice(0, 25);
  const acc = {}, keys = ['jitterLocal', 'jitterAbsUs', 'jitterRap', 'jitterPpq5',
                          'shimmerLocal', 'shimmerDb', 'shimmerApq3', 'shimmerApq5', 'periodCv'];
  keys.forEach(k => acc[k] = []);
  let ok = 0, secs = 0;
  for (const r of use) {
    // trim the onset/offset ramp: keep the middle 70 % of the run, where the
    // syllable amplitude envelope is flattest
    let s0 = Math.round(r.a * pt.hop * fs), s1 = Math.round(r.b * pt.hop * fs);
    const trim = Math.round((s1 - s0) * 0.15);
    s0 += trim; s1 -= trim;
    if (s1 - s0 < fs * 0.09) continue;
    const seg = x.subarray(s0, Math.min(x.length, s1));
    const p = perturbation(seg, fs, r.f0);
    if (!p) continue;
    ok++; secs += (s1 - s0) / fs;
    keys.forEach(k => { if (isFinite(p[k])) acc[k].push(p[k]); });
  }
  if (!ok) return null;
  const out = { nRuns: ok, analysedS: secs };
  keys.forEach(k => out[k] = median(acc[k]));
  return out;
}

/* convex hull (Andrew monotone chain) and polygon area */
function convexHull(pts) {
  if (pts.length < 3) return pts.slice();
  const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [], upper = [];
  for (const q of p) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop(); lower.push(q); }
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop(); upper.push(q); }
  lower.pop(); upper.pop();
  return lower.concat(upper);
}
function polygonArea(h) {
  let a = 0;
  for (let i = 0, j = h.length - 1; i < h.length; j = i++) a += (h[j][0] + h[i][0]) * (h[j][1] - h[i][1]);
  return Math.abs(a / 2);
}

/* trajectory-based vowel space from running speech (Whitfield & Gravelin style):
   hull area over the F1 x F2 cloud, plus a covariance-ellipse "working area"
   and the F2 excursion range. Replaces corner-vowel VSA when no isolated
   vowels are recorded. */
function connectedVowelSpace(x, fs, pt) {
  const tr = trackFormants(x, fs, { hopMs: 10, pt: pt });
  const pts = [];
  for (let i = 0; i < tr.F1.length; i++) {
    const f1 = tr.F1[i], f2 = tr.F2[i];
    if (f1 > 200 && f1 < 1100 && f2 > 600 && f2 < 3200 && f2 > f1 * 1.1) pts.push([f2, f1]);
  }
  if (pts.length < 40) return null;
  // trim the sparse 5 % tail by Mahalanobis distance so single bad frames
  // cannot inflate the hull
  const mx = mean(pts.map(p => p[0])), my = mean(pts.map(p => p[1]));
  const sx = sd(pts.map(p => p[0])), sy = sd(pts.map(p => p[1]));
  let sxy = 0; pts.forEach(p => sxy += (p[0] - mx) * (p[1] - my)); sxy /= (pts.length - 1);
  const r = sxy / (sx * sy);
  const d = pts.map(p => {
    const zx = (p[0] - mx) / sx, zy = (p[1] - my) / sy;
    return (zx * zx - 2 * r * zx * zy + zy * zy) / (1 - r * r);
  });
  const cut = pct(d, 95);
  const core = pts.filter((p, i) => d[i] <= cut);
  const hull = convexHull(core);
  const hullArea = polygonArea(hull);
  const ellipse = Math.PI * 4 * sx * sy * Math.sqrt(Math.max(1e-6, 1 - r * r)); // 2-SD ellipse
  const f2s = core.map(p => p[0]), f1s = core.map(p => p[1]);
  // pseudo-corner vowels from the running-speech cloud, so that the
  // formant centralisation ratio and F2i/F2u can be estimated without
  // isolated /a/ /i/ /u/ tokens. Corners are robust percentile regions,
  // not single frames.
  const hiF2 = pct(f2s, 90), loF2 = pct(f2s, 10), hiF1 = pct(f1s, 90), medF1 = median(f1s);
  const pick = f => { const g = core.filter(f); return g.length >= 3 ? { F1: median(g.map(p => p[1])), F2: median(g.map(p => p[0])), n: g.length } : null; };
  const Ci = pick(p => p[0] >= hiF2);
  let Cu = pick(p => p[0] <= loF2 && p[1] <= medF1) || pick(p => p[0] <= loF2);
  const Ca = pick(p => p[1] >= hiF1);
  let fcr = NaN, vai = NaN, f2Ratio = NaN, corners = null;
  if (Ci && Cu && Ca) {
    fcr = (Cu.F2 + Ca.F2 + Ci.F1 + Cu.F1) / (Ci.F2 + Ca.F1);
    vai = 1 / fcr;
    f2Ratio = Ci.F2 / Cu.F2;
    corners = { i: Ci, u: Cu, a: Ca };
  }
  return {
    nFrames: core.length,
    fcr: fcr, vai: vai, f2Ratio: f2Ratio, corners: corners,
    hullArea: hullArea,                       // Hz^2
    workingArea: ellipse,                     // Hz^2
    f2Range: pct(f2s, 95) - pct(f2s, 5),
    f1Range: pct(f1s, 95) - pct(f1s, 5),
    f2Median: median(f2s), f1Median: median(f1s),
    dispersion: mean(d.map(Math.sqrt)),
    hull: hull, cloud: core
  };
}

/* articulatory transition speed: |dF2/dt| within voiced runs.
   Flatter F2 transitions accompany reduced intelligibility in dysarthria. */
function f2Dynamics(x, fs, pt) {
  const tr = trackFormants(x, fs, { hopMs: 10, pt: pt });
  const sl = [];
  for (let i = 1; i < tr.F2.length; i++) {
    const dt = tr.t[i] - tr.t[i - 1];
    if (dt > 0.025) continue;                 // only within continuous voicing
    const d = Math.abs(tr.F2[i] - tr.F2[i - 1]) / dt;
    if (isFinite(d) && d < 20000) sl.push(d);
  }
  if (sl.length < 20) return null;
  return { f2SlopeMean: mean(sl), f2SlopeP80: pct(sl, 80), f2SlopeMax: pct(sl, 98), n: sl.length };
}

/* magnitude spectrogram for display (dB, frames x bins) */
function spectrogram(x, fs, opt) {
  opt = opt || {};
  const win = Math.round(fs * (opt.winMs || 25) / 1000) || 400;
  const hop = Math.round(fs * (opt.hopMs || 10) / 1000) || 160;
  const nfft = nextPow2(win), w = hann(win);
  const maxBin = Math.min(nfft / 2, Math.floor((opt.maxHz || 8000) * nfft / fs));
  const cols = [];
  for (let s = 0; s + win <= x.length; s += hop) {
    const fr = new Float64Array(win);
    for (let i = 0; i < win; i++) fr[i] = x[s + i] * w[i];
    const m = magSpectrum(fr, nfft);
    const c = new Float32Array(maxBin);
    for (let i = 0; i < maxBin; i++) c[i] = 20 * Math.log10(m[i] + 1e-9);
    cols.push(c);
  }
  return { cols, bins: maxBin, hop: hop / fs, maxHz: (maxBin * fs / nfft) };
}

/* full two-task connected-speech analysis */
function analyseSpeechFull(x, fs, opt) {
  opt = opt || {};
  const s = normalise(removeDC(x));
  const pt = pitchTrack(s, fs, { winMs: 45, hopMs: 10 });
  const ptFast = pitchTrack(s, fs, { winMs: 40, hopMs: 8, voicingThreshold: 0.35 });
  const timing = speechTiming(s, fs, { pt: ptFast, envHopMs: 8 });
  const f0v = pt.f0.filter(v => v > 0);
  const hnrV = pt.hnr.filter(v => isFinite(v));
  const dbAll = intensityContour(s, fs, 30, 10).db;
  const floorDb = pct(dbAll, 95) - 25;
  const loud = dbAll.filter(v => v > floorDb);
  const med = f0v.length ? median(f0v) : 0;
  const vsp = connectedVowelSpace(s, fs, pt);
  const f2d = f2Dynamics(s, fs, pt);
  const pert = perturbationConnected(s, fs, pt);
  return {
    ...timing,
    f0Mean: mean(f0v), f0Sd: sd(f0v), f0Median: med,
    f0P5: pct(f0v, 5), f0P95: pct(f0v, 95),
    f0RangeSemitones: f0v.length ? 12 * Math.log2(pct(f0v, 95) / Math.max(1, pct(f0v, 5))) : NaN,
    f0SdSemitones: f0v.length > 2 ? sd(f0v.map(v => 12 * Math.log2(v / med))) : NaN,
    intensitySd: sd(loud), intensityRange: pct(loud, 95) - pct(loud, 5),
    hnrMean: mean(hnrV), hnrSd: sd(hnrV),
    cpps: cpps(s, fs),
    voicedFraction: pt.voiced.filter(Boolean).length / pt.voiced.length,
    voiceBreaks: countVoiceBreaks(pt),
    perturbation: pert,
    vowelSpace: vsp,
    f2: f2d,
    spectral: spectralFeatures(s, fs),
    modulation: modulationSpectrum(s, fs),
    mfcc: mfcc(s, fs, 13),
    contours: {
      f0: pt.f0, voiced: pt.voiced, hop: pt.hop,
      intensity: dbAll, intensityHop: 0.01
    }
  };
}

export const DSP = {
  mean, sd, median, pct, hann, hamming, fft, magSpectrum, resample, lowpass, removeDC,
  preEmphasis, normalise, intensityContour, acfFrame, pitchTrack, pulseMarks, perturbation,
  cpps, lpc, formants, trackFormants, steadyVowelFormants, vowelSpace, syllableNuclei,
  speechTiming, ddkAnalysis, spectralFeatures, mfcc, modulationSpectrum,
  analyseSustainedVowel, analyseDdk, analyseConnectedSpeech,
  voicedRuns, perturbationConnected, connectedVowelSpace, convexHull, polygonArea,
  f2Dynamics, spectrogram, analyseSpeechFull
};

export default DSP;
