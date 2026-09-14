/* ==========================================================================
   Analysis Web Worker. Runs the ported DSP off the UI thread. Receives
   { id, kind, pcm (Float32Array), fs } and posts back { id, result }.
   For kind 'vowel' -> analyseSustainedVowel, otherwise analyseSpeechFull.

   Loaded as a module worker: new Worker(url, { type:'module' }). When module
   workers are unavailable (older Safari) or the page is file://, the main
   thread falls back to running the same DSP inline via a setTimeout — see
   capture.js. This file has no side effects beyond the message handler.
   ========================================================================== */
import { DSP } from '../dsp/dsp.js';

self.onmessage = (e) => {
  const { id, kind, pcm, fs } = e.data;
  let result;
  try {
    result = kind === 'vowel'
      ? DSP.analyseSustainedVowel(pcm, fs, 'a')
      : DSP.analyseSpeechFull(pcm, fs);
    result._dur = pcm.length / fs;
  } catch (err) {
    result = { error: String(err && err.message ? err.message : err) };
  }
  self.postMessage({ id, result });
};
