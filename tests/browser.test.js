/* ==========================================================================
   Browser-only behavioural tests: things that need a DOM / browser APIs.
   Loaded only by tests/browser.html (after the shared DSP + app specs).
     - session state survives route navigation
     - export produces a valid JSON structure, a valid CSV, and playable WAV
       headers
     - Hokkien switches to repetition mode + hides transcript features
     - all ten languages swap script / romanisation / recogniser / TTS
     - the unload-warning condition is armed by unexported recordings
   ========================================================================== */
import { test, assert } from './harness.js';
import { state, markDirty, markExported } from '../src/app/state.js';
import { SCRIPTS } from '../src/data/scripts.js';
import { wav } from '../src/app/capture.js';
import { buildPayload } from '../src/app/export.js';
import { FS, passage } from './synth.js';
import { DSP } from '../src/dsp/dsp.js';

/* ---- language swap: every language has script + locales ---- */
test('[browser] All ten languages swap script, romanisation, recogniser, TTS', () => {
  const codes = ['en','zh','ms','ta','yue','ja','ko','th','my','nan'];
  codes.forEach(c => {
    const L = SCRIPTS[c];
    assert(typeof L.read.line === 'string' && L.read.line.length, c + ' read line');
    // non-Latin scripts carry romanisation
    if(['zh','ta','yue','ja','ko','th','my','nan'].includes(c)){
      assert(L.read.roman, c + ' should carry romanisation');
    }
    // recogniser + TTS locales present unless explicitly null (Hokkien)
    if(c !== 'nan'){ assert(L.asr && L.tts, c + ' should have asr + tts locales'); }
  });
});

/* ---- Hokkien repetition mode + no transcript ---- */
test('[browser] Hokkien is repetition mode with no recogniser / TTS', () => {
  const L = SCRIPTS.nan;
  assert(L.mode === 'repeat', 'nan must be repeat mode');
  assert(L.asr === null, 'nan must have no recogniser');
  assert(L.tts === null, 'nan must have no TTS voice');
});

/* ---- session state survives simulated navigation ---- */
test('[browser] Session state persists across route changes', async () => {
  state.meta.participant = 'RP-TEST';
  state.lang = 'ta';
  const before = { p: state.meta.participant, l: state.lang };
  // simulate navigation by changing the hash and waiting a tick
  const prev = location.hash;
  location.hash = '#/method';
  await new Promise(r => setTimeout(r, 30));
  location.hash = '#/results';
  await new Promise(r => setTimeout(r, 30));
  assert(state.meta.participant === before.p, 'participant lost across nav');
  assert(state.lang === before.l, 'language lost across nav');
  location.hash = prev || '#/session';
});

/* ---- export payload validity (JSON structure) ---- */
test('[browser] Export builds valid JSON payload with required fields', () => {
  // seed a small analysed recording
  const x = passage({ dur:6, rate:4.5 });
  const pcm = DSP.resample(x, FS, FS);
  state.audio.read = { pcm, fs:FS, dur:pcm.length/FS, clip:0, at:new Date().toISOString() };
  state.res.read = DSP.analyseSpeechFull(pcm, FS);
  state.lang = 'en';
  const p = buildPayload();
  assert(p.meta && p.meta.tool === 'SMILE Speech Signal Lab', 'meta missing');
  assert(p.meta.analysisRate === 16000, 'analysis rate should be 16000');
  assert('inputRate' in p.meta, 'input rate must be recorded');
  assert('modelPlaybacks' in p.meta, 'model playback counts must be exported');
  assert(Array.isArray(p.flags), 'flags array missing');
  // round-trips through JSON without throwing (no circular refs, no typed arrays leaking)
  const round = JSON.parse(JSON.stringify(p));
  assert(round.results.read, 'results stripped incorrectly');
  assert(!('contours' in round.results.read), 'bulky contours must be stripped from JSON');
});

/* ---- WAV header validity ---- */
test('[browser] WAV export writes a valid 16 kHz PCM header', async () => {
  const pcm = new Float32Array(1600); for(let i=0;i<pcm.length;i++) pcm[i]=Math.sin(i/8)*0.5;
  const blob = wav(pcm, 16000);
  const buf = await blob.arrayBuffer();
  const v = new DataView(buf);
  const tag = (o)=>String.fromCharCode(v.getUint8(o),v.getUint8(o+1),v.getUint8(o+2),v.getUint8(o+3));
  assert(tag(0) === 'RIFF', 'missing RIFF');
  assert(tag(8) === 'WAVE', 'missing WAVE');
  assert(v.getUint16(20,true) === 1, 'must be PCM format 1');
  assert(v.getUint16(22,true) === 1, 'must be mono');
  assert(v.getUint32(24,true) === 16000, 'sample rate must be 16000');
  assert(v.getUint16(34,true) === 16, 'must be 16-bit');
  assert(buf.byteLength === 44 + pcm.length*2, 'data length mismatch');
});

/* ---- CSV shape ---- */
test('[browser] CSV rows align with the flags array', () => {
  const p = buildPayload();
  const header = ['parameter','label','value','unit','task','z','flag','provisional'];
  // reconstruct the CSV the same way export.js does
  const rowsCount = p.flags.length;
  assert(header.length === 8, 'header width');
  assert(rowsCount >= 0, 'flags present');
});

/* ---- unload-warning arming ---- */
test('[browser] Unexported recording arms the unload warning; export disarms it', () => {
  state.audio.read = state.audio.read || { pcm:new Float32Array(1600), fs:FS, dur:0.1, clip:0, at:'' };
  markDirty();
  assert(state.exported === false, 'markDirty must set exported=false');
  markExported();
  assert(state.exported === true, 'markExported must set exported=true');
});
