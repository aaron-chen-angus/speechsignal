/* ==========================================================================
   In-memory session state. NOTHING is written to localStorage,
   sessionStorage, IndexedDB or any other persistent store. A session exists
   only in memory and leaves only through explicit export. State survives
   navigation between routes because this module is a singleton.
   ========================================================================== */

export const FS = 16000;   // analysis sample rate — resample once to 16 kHz

/* Central session object. Kept flat and serialisable-ish; audio PCM stays as
   Float32Array in memory and is only turned into WAV on export. */
export const state = {
  /* participant / setup (Route 1) */
  meta: { participant:'', age:'', sex:'m', timepoint:'' },
  lang: 'en',

  /* device / capture context */
  deviceId: null,          // chosen microphone
  inputRate: 48000,        // actual hardware rate; recorded in export metadata
  secureContext: (typeof window !== 'undefined') ? window.isSecureContext : false,
  micPermission: 'unknown',// granted | denied | prompt | unknown
  fileMode: false,         // true when running file:// (mic disabled, upload only)

  /* per-task capture + analysis */
  audio: {},               // { taskId: {pcm, fs, dur, clip, at} }
  res: {},                 // { taskId: analysis result }
  tx: {},                  // { taskId: transcript string }
  played: {},              // { taskId: model-playback count } — exported
  optVowel: false,         // optional sustained-vowel task enabled

  /* results controls */
  baseline: null,          // loaded prior session's results, or null
  cppsCal: null,           // Praat calibration offset (dB), or null
  tab: 'pronunciation',    // active parameter-deviation tab

  /* transient */
  busy: false,             // analysis in progress
  exported: true,          // false once a recording exists and hasn't been exported
};

/* ---- subscribers: routes register to re-render on state change -------- */
const subs = new Set();
export function subscribe(fn){ subs.add(fn); return () => subs.delete(fn); }
export function notify(){ for(const fn of subs) { try { fn(); } catch(e){ console.error(e); } } }

/* ---- helpers ---------------------------------------------------------- */
export function hasRecording(){ return Object.keys(state.audio).length > 0; }
export function readingCaptured(){ return !!state.audio.read; }
export function recordedCount(){
  return ['read','free','vowel'].filter(id => state.audio[id]).length;
}
export function requiredCount(){ return state.optVowel ? 3 : 2; }

/* Mark that unexported recordings exist (drives the unload warning). */
export function markDirty(){ state.exported = false; }
export function markExported(){ state.exported = true; }

/* Reset everything except participant meta (used sparingly). */
export function resetCaptures(){
  state.audio = {}; state.res = {}; state.tx = {}; state.played = {};
  state.busy = false; state.exported = true;
}
