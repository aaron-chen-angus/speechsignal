/* ==========================================================================
   Audio capture engine.

   Behaviour that MUST NOT change (ported from the prototype):
     - getUserMedia ALWAYS called with echoCancellation:false,
       noiseSuppression:false, autoGainControl:false. These defaults destroy
       shimmer, intensity variation and HNR.
     - Audio captured as raw PCM via a ScriptProcessor (never MediaRecorder /
       Opus). Resampled ONCE to 16 kHz; the input rate is recorded in export
       metadata.

   Analysis runs in a Web Worker; a setTimeout inline fallback is used when a
   module worker cannot be created (older Safari or file://). Analysis never
   blocks the UI thread beyond the fallback's single tick.
   ========================================================================== */
import { state, FS, notify, markDirty } from './state.js';
import { DSP } from '../dsp/dsp.js';

let ctx = null, stream = null, srcNode = null, analyser = null, procNode = null, sink = null;
let chunks = [];
let recTask = null;          // id of task currently recording
let levelBuf = null;

/* ---- worker (with fallback) ------------------------------------------ */
let worker = null, workerOk = false, reqId = 0;
const pending = new Map();

function initWorker(){
  if(worker !== null || workerOk) return;
  try {
    worker = new Worker(new URL('./analysis.worker.js', import.meta.url), { type:'module' });
    worker.onmessage = (e) => {
      const { id, result } = e.data;
      const cb = pending.get(id);
      if(cb){ pending.delete(id); cb(result); }
    };
    worker.onerror = () => { workerOk = false; worker = null; };
    workerOk = true;
  } catch (e) {
    worker = null; workerOk = false;
  }
}

function runAnalysis(kind, pcm, cb){
  initWorker();
  if(workerOk && worker){
    const id = ++reqId;
    pending.set(id, cb);
    // copy so the caller keeps its Float32Array (transfer would detach it)
    const copy = Float32Array.from(pcm);
    try { worker.postMessage({ id, kind, pcm: copy, fs: FS }, [copy.buffer]); return; }
    catch(e){ workerOk = false; worker = null; }
  }
  // setTimeout fallback — keeps the UI responsive on file:// / no-module-worker
  setTimeout(() => {
    let result;
    try {
      result = kind === 'vowel'
        ? DSP.analyseSustainedVowel(pcm, FS, 'a')
        : DSP.analyseSpeechFull(pcm, FS);
      result._dur = pcm.length / FS;
    } catch (err) { result = { error: String(err && err.message ? err.message : err) }; }
    cb(result);
  }, 40);
}

/* ---- device + mic ---------------------------------------------------- */
export async function listMics(){
  if(!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return [];
  try {
    const devs = await navigator.mediaDevices.enumerateDevices();
    return devs.filter(d => d.kind === 'audioinput');
  } catch { return []; }
}

export async function permissionState(){
  try {
    if(navigator.permissions && navigator.permissions.query){
      const p = await navigator.permissions.query({ name:'microphone' });
      return p.state; // granted | denied | prompt
    }
  } catch {}
  return 'unknown';
}

export function micReady(){ return !!ctx && !!procNode; }

export async function initMic(deviceId){
  if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){
    throw new Error('no getUserMedia in this context');
  }
  // stop any prior stream
  stopMic();
  const audio = {
    echoCancellation:false, noiseSuppression:false, autoGainControl:false, channelCount:1
  };
  if(deviceId) audio.deviceId = { exact: deviceId };
  stream = await navigator.mediaDevices.getUserMedia({ audio });
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  state.inputRate = ctx.sampleRate;
  srcNode = ctx.createMediaStreamSource(stream);
  analyser = ctx.createAnalyser(); analyser.fftSize = 2048;
  procNode = ctx.createScriptProcessor(4096, 1, 1);
  procNode.onaudioprocess = (e) => {
    if(recTask) chunks.push(Float32Array.from(e.inputBuffer.getChannelData(0)));
  };
  srcNode.connect(analyser);
  srcNode.connect(procNode);
  // ScriptProcessor needs a destination to pump; route through a muted gain.
  sink = ctx.createGain(); sink.gain.value = 0;
  procNode.connect(sink); sink.connect(ctx.destination);
  state.deviceId = deviceId || null;
  state.micPermission = 'granted';
  levelBuf = new Float32Array(2048);
  return true;
}

export function stopMic(){
  try { if(procNode){ procNode.disconnect(); procNode.onaudioprocess = null; } } catch {}
  try { if(srcNode) srcNode.disconnect(); } catch {}
  try { if(sink) sink.disconnect(); } catch {}
  try { if(stream) stream.getTracks().forEach(t => t.stop()); } catch {}
  try { if(ctx && ctx.state !== 'closed') ctx.close(); } catch {}
  ctx = null; stream = null; srcNode = null; analyser = null; procNode = null; sink = null;
  recTask = null; chunks = [];
}

/* Live level read for the input-level check + live waveform.
   Returns { peak, rms } in 0..1, or null if no analyser. */
export function readLevel(){
  if(!analyser) return null;
  analyser.getFloatTimeDomainData(levelBuf);
  let peak = 0, rms = 0;
  for(let i=0;i<levelBuf.length;i++){ const a = Math.abs(levelBuf[i]); if(a>peak) peak=a; rms += levelBuf[i]*levelBuf[i]; }
  rms = Math.sqrt(rms/levelBuf.length);
  return { peak, rms, buf: levelBuf };
}

/* ---- recording ------------------------------------------------------- */
export function isRecording(id){ return id ? recTask === id : !!recTask; }
export function recordingTask(){ return recTask; }

export function startRecording(id){
  if(!ctx) throw new Error('microphone not enabled');
  if(ctx.state === 'suspended') ctx.resume();
  chunks = [];
  recTask = id;
  notify();
  return true;
}

/* Stop recording; returns the raw Float32Array + input rate, or null if too
   short. Does NOT analyse — caller calls ingest(). */
export function stopRecording(){
  const id = recTask; if(!id) return null;
  recTask = null;
  let n = 0; chunks.forEach(c => n += c.length);
  const buf = new Float32Array(n);
  let o = 0; chunks.forEach(c => { buf.set(c, o); o += c.length; });
  chunks = [];
  notify();
  if(n < state.inputRate * 0.8) return { id, tooShort:true };
  return { id, buf, fsIn: state.inputRate };
}

/* Resample to 16 kHz, store in state.audio, kick off analysis. onDone() fires
   after analysis completes. */
export function ingest(id, buf, fsIn, onDone){
  let clip = 0;
  for(let i=0;i<buf.length;i++) if(Math.abs(buf[i]) > 0.985) clip++;
  const x = DSP.resample(buf, fsIn, FS);
  state.audio[id] = { pcm:x, fs:FS, dur:x.length/FS, clip: clip/buf.length, at:new Date().toISOString() };
  state.inputRate = fsIn;
  markDirty();
  state.busy = true;
  notify();
  runAnalysis(id === 'vowel' ? 'vowel' : 'speech', x, (result) => {
    state.res[id] = result;
    state.busy = false;
    notify();
    if(onDone) onDone(id, result);
  });
}

/* Decode an uploaded audio file and ingest it (fallback path, and the only
   path on file://). */
export async function loadFile(id, file, onDone){
  const ac = ctx || new (window.AudioContext || window.webkitAudioContext)();
  const decoded = await ac.decodeAudioData(await file.arrayBuffer());
  ingest(id, decoded.getChannelData(0), decoded.sampleRate, onDone);
  if(ac !== ctx){ try { ac.close(); } catch {} }
}

/* ---- WAV export (16 kHz PCM) ----------------------------------------- */
export function wav(pcm, fs){
  const b = new ArrayBuffer(44 + pcm.length*2), v = new DataView(b);
  const w = (o,s)=>{ for(let i=0;i<s.length;i++) v.setUint8(o+i, s.charCodeAt(i)); };
  w(0,'RIFF'); v.setUint32(4, 36+pcm.length*2, true); w(8,'WAVEfmt ');
  v.setUint32(16,16,true); v.setUint16(20,1,true); v.setUint16(22,1,true);
  v.setUint32(24,fs,true); v.setUint32(28,fs*2,true); v.setUint16(32,2,true); v.setUint16(34,16,true);
  w(36,'data'); v.setUint32(40, pcm.length*2, true);
  for(let i=0;i<pcm.length;i++){ const s = Math.max(-1, Math.min(1, pcm[i])); v.setInt16(44+i*2, s<0? s*0x8000 : s*0x7FFF, true); }
  return new Blob([b], { type:'audio/wav' });
}
