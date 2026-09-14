/* ==========================================================================
   Model reading playback + live SpeechRecognition transcription.
   Ported from the prototype. Behaviour preserved:
     - "Play model" prefers a recorded human file audio/<lang>_<task>.mp3,
       falling back to speechSynthesis at the language's TTS locale.
     - Playback stops automatically when recording starts (caller does this).
     - The playback count per task is recorded into state.played and exported.
     - Hokkien (nan) has no recogniser and no synthetic voice: transcript,
       word accuracy and text sentiment are unavailable.
   ========================================================================== */
import { state } from './state.js';
import { SCRIPTS } from '../data/scripts.js';

/* ---- TTS voice resolution ------------------------------------------- */
export function ttsVoice(code){
  if(!code || !window.speechSynthesis) return null;
  const vs = speechSynthesis.getVoices() || [];
  const base = code.split('-')[0];
  return vs.find(v => v.lang.replace('_','-').toLowerCase() === code.toLowerCase())
      || vs.find(v => v.lang.replace('_','-').toLowerCase().startsWith(base+'-'))
      || vs.find(v => v.lang.toLowerCase().startsWith(base)) || null;
}

export function modelAvailable(lang){
  const L = SCRIPTS[lang];
  return { file:true, tts: !!ttsVoice(L.tts), code: L.tts };
}

/* ---- playback -------------------------------------------------------- */
let audioEl = null;

export function modelPlaying(){
  return !!audioEl || (window.speechSynthesis && speechSynthesis.speaking);
}

export function stopModel(onChange){
  if(audioEl){ audioEl.pause(); audioEl = null; }
  if(window.speechSynthesis) speechSynthesis.cancel();
  if(onChange) onChange();
}

export function playModel(lang, taskId, rate, onChange){
  stopModel();
  const L = SCRIPTS[lang], sc = L[taskId]; if(!sc) return;
  state.played[taskId] = (state.played[taskId]||0) + 1;
  const url = 'audio/' + lang + '_' + taskId + '.mp3';
  const a = new Audio(url);
  a.onerror = () => { audioEl = null; speakFallback(lang, sc.line, L.tts, rate, onChange); };
  a.onended = () => { audioEl = null; if(onChange) onChange(); };
  a.play().then(() => { audioEl = a; if(onChange) onChange(); })
          .catch(() => { audioEl = null; speakFallback(lang, sc.line, L.tts, rate, onChange); });
}

function speakFallback(lang, text, code, rate, onChange){
  if(!window.speechSynthesis){
    alert('No recorded model file found at audio/'+lang+'_*.mp3, and this browser has no speech synthesiser.');
    if(onChange) onChange(); return;
  }
  const v = ttsVoice(code);
  if(!v){
    alert('No recorded model file found, and no '+(code||'matching')+' synthetic voice is installed on this device. Record a native speaker and save it as audio/'+lang+'_read.mp3');
    if(onChange) onChange(); return;
  }
  const u = new SpeechSynthesisUtterance(text);
  u.voice = v; u.lang = v.lang; u.rate = rate || 0.9;
  u.onend = () => { if(onChange) onChange(); };
  speechSynthesis.speak(u);
  if(onChange) onChange();
}

/* ---- live transcription --------------------------------------------- */
export const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let asr = null;

/* onUpdate(finalText, interimText) fires as results stream. Uses interim
   results so the operator can see the recogniser is working live. */
export function startASR(lang, taskId, onUpdate){
  const L = SCRIPTS[lang];
  if(!SR || taskId === 'vowel' || !L.asr) return false;
  try {
    asr = new SR();
    asr.continuous = true;
    asr.interimResults = true;
    asr.lang = L.asr;
    let finalText = '';
    asr.onresult = (e) => {
      let interim = '';
      for(let i=e.resultIndex;i<e.results.length;i++){
        const r = e.results[i];
        if(r.isFinal) finalText += r[0].transcript + ' ';
        else interim += r[0].transcript;
      }
      state.tx[taskId] = finalText.trim();
      if(onUpdate) onUpdate(finalText.trim(), interim.trim());
    };
    asr.onerror = () => {};
    asr.start();
    return true;
  } catch(e){ asr = null; return false; }
}

export function stopASR(){
  if(asr){ try { asr.stop(); } catch(e){} asr = null; }
}
