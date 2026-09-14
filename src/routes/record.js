/* ==========================================================================
   Route 2 — /record. Capture + live feedback ONLY. No metrics, no scores, no
   analysis output of any kind on this screen.

   Two-column split: live signal left (the visual anchor), script + controls
   right. Collapses to one column under 900px; the script stays large.

   Live scrolling waveform + level meter + clipping indicator. Live
   transcription streaming (interim results). Task stepper. Per-task model
   playback (stops on record, counts recorded). Record/stop, elapsed-vs-target
   timer, load-audio fallback, per-task thumbnail + re-record. Recording
   quality lives here and only here. Analysis runs in a worker on completion.
   Persistent footer with progress + View results (disabled until reading
   task captured).
   ========================================================================== */
import { state, notify, subscribe, readingCaptured, recordedCount, requiredCount } from '../app/state.js';
import { go, announce } from '../app/router.js';
import { el, f, toast, cssVar } from '../app/ui.js';
import { SCRIPTS, TASKS } from '../data/scripts.js';
import {
  initMic, micReady, readLevel, startRecording, stopRecording, isRecording,
  recordingTask, ingest, loadFile
} from '../app/capture.js';
import {
  playModel, stopModel, modelPlaying, startASR, stopASR, modelAvailable, SR
} from '../app/media.js';
import { fit, drawWave } from '../app/charts.js';

export const title = 'Record';

let raf = null, unsub = null, timerRaf = null;
let liveCanvas = null, levelFill = null, clipEl = null;
let liveHist = null;
let activeTask = 'read';          // which task is the focus of the stepper
let interimText = { read:'', free:'' };
let thumbPlaying = null;          // { ac, src } while a captured clip is playing
let thumbPlayBtn = null;          // the current clip play/stop button

function stopThumb(){
  if(thumbPlaying){
    try { thumbPlaying.src.onended = null; thumbPlaying.src.stop(); } catch(e){}
    try { thumbPlaying.ac.close(); } catch(e){}
    thumbPlaying = null;
  }
  if(thumbPlayBtn) thumbPlayBtn.textContent = '\u25b6 Play';
}

function visibleTasks(){ return TASKS.filter(t => !t.optional || state.optVowel); }

function taskName(t, L){
  if(t.id === 'read' && L.mode === 'repeat') return 'Repeat after examiner';
  return t.name;
}

export async function render(root){
  const L = () => SCRIPTS[state.lang];

  const head = el('div',{class:'page-head'},
    el('h1',{}, 'Record'),
    el('p',{class:'lede'}, 'Read the script at arm\u2019s length. Watch the waveform to confirm the microphone is live. No results appear here \u2014 analysis runs automatically when a recording completes.'),
    el('p',{class:'dim'}, el('span',{class:'kbd'},'Space'),' stops the current recording.')
  );

  /* unvalidated-language warning (also shown on /session) */
  const warn = el('div',{id:'recWarn'});
  function paintWarn(){
    warn.innerHTML = '';
    const l = L();
    if(!l.validated){
      warn.appendChild(el('div',{class:'warn-box', role:'note'},
        el('b',{}, l.name + ' \u2014 draft script. '),
        'Not yet signed off by a native-speaking clinician. ' + l.evidence + '.'
      ));
    }
  }

  /* ================= LEFT: live signal ================= */
  liveCanvas = el('canvas',{class:'cv-live', id:'liveCv', role:'img','aria-label':'Live input waveform'});
  levelFill = null;
  const meter = el('div',{class:'meter', role:'meter','aria-label':'Input level','aria-valuemin':'0','aria-valuemax':'100'}, el('i',{id:'recLvl'}), el('u',{}));
  clipEl = el('span',{class:'clip-ind out', id:'recClip'});
  const micStatus = el('span',{class:'dim', id:'micStatus'});

  const signalPanel = el('section',{class:'panel live-wrap'},
    el('h2',{class:'ptitle'}, 'Live signal', el('span',{class:'meta', id:'sigMeta'}, 'idle')),
    liveCanvas,
    el('div',{style:'display:flex;justify-content:space-between;align-items:baseline;gap:10px;margin-top:8px'},
      micStatus, clipEl),
    meter
  );

  const transcriptPanel = el('section',{class:'panel transcript-panel'},
    el('h2',{class:'ptitle'}, 'Live transcription', el('span',{class:'meta', id:'txMeta'})),
    el('div',{class:'tx', id:'liveTx', 'aria-live':'polite'})
  );

  const signalCol = el('div',{class:'signal-col'}, signalPanel, transcriptPanel);

  /* ================= RIGHT: script + controls ================= */
  const stepper = el('div',{class:'stepper', id:'stepper', role:'list','aria-label':'Task progress'});
  const scriptBox = el('div',{class:'script-big', id:'scriptBox'});
  const controls = el('div',{class:'rec-controls', id:'recControls'});
  const thumbRow = el('div',{class:'thumb-row', id:'thumbRow'});
  const modelNote = el('p',{class:'dim', id:'modelNote', style:'font-size:12px;margin-top:10px'});

  const taskPanel = el('section',{class:'panel'},
    el('h2',{class:'ptitle'}, 'Protocol', el('span',{class:'meta'}, '2 tasks \u00b7 about 60 seconds')),
    stepper,
    scriptBox,
    controls,
    thumbRow,
    el('label',{style:'display:flex;gap:8px;align-items:center;margin-top:14px;text-transform:none;letter-spacing:normal;font-size:13px;color:var(--dim)'},
      el('input',{type:'checkbox', id:'optVowel', checked:state.optVowel, style:'width:auto'}),
      'Add a 6-second sustained \u201cah\u201d for true jitter, shimmer and maximum phonation time'),
    modelNote
  );

  const qualityPanel = el('section',{class:'panel quality-panel'},
    el('h2',{class:'ptitle'}, 'Recording quality', el('span',{class:'meta'}, 'a capture concern, not a result')),
    el('div',{class:'rows', id:'qualityRows'}, el('div',{class:'dim'}, 'Record a task to assess.'))
  );

  const controlCol = el('div',{class:'control-col'}, taskPanel, qualityPanel);

  /* ================= footer ================= */
  const footer = el('div',{class:'record-footer'},
    el('span',{class:'prog-text', id:'progText'}),
    el('span',{class:'spacer'}),
    (() => {
      const b = el('button',{class:'go', id:'viewResults'}, 'View results \u2192');
      b.addEventListener('click', () => go('results'));
      return b;
    })()
  );

  root.appendChild(head);
  root.appendChild(warn);
  root.appendChild(el('div',{class:'record-split'}, signalCol, controlCol));
  root.appendChild(footer);

  /* mic status / file-mode message */
  if(state.fileMode || !micReady()){
    if(state.fileMode){ micStatus.textContent = 'file:// \u2014 recording disabled; use "Load audio" per task'; }
    else { micStatus.textContent = 'microphone not enabled \u2014 enable it on the Session screen, or load audio'; }
  } else {
    micStatus.textContent = 'microphone live';
  }

  const optCb = taskPanel.querySelector('#optVowel');
  optCb.addEventListener('change', () => { state.optVowel = optCb.checked; paintTasks(); paintFooter(); });

  /* ---------- painters ---------- */
  function paintStepper(){
    stepper.innerHTML = '';
    visibleTasks().forEach(t => {
      const done = !!state.audio[t.id];
      const active = activeTask === t.id;
      const st = active ? 'active' : done ? 'done' : 'pending';
      const chip = el('div',{class:'step-chip', role:'listitem', dataset:{ state: st }},
        el('span',{class:'tag'}, t.tag),
        el('span',{}, taskName(t, L())),
        el('span',{class:'dim', style:'font-size:11px'}, done ? '\u2713 captured' : active ? 'active' : 'pending')
      );
      chip.tabIndex = 0;
      chip.setAttribute('aria-label', taskName(t, L()) + ' \u2014 ' + (done?'captured':active?'active':'pending'));
      const focus = () => { if(!isRecording()){ activeTask = t.id; paintTasks(); } };
      chip.addEventListener('click', focus);
      chip.addEventListener('keydown', e => { if(e.key==='Enter'||e.key===' '){ e.preventDefault(); focus(); } });
      stepper.appendChild(chip);
    });
  }

  function paintScript(){
    const l = L();
    const t = visibleTasks().find(x => x.id === activeTask) || visibleTasks()[0];
    activeTask = t.id;
    const sc = t.id === 'vowel' ? { line:t.line, gloss:t.gloss } : l[t.id];
    scriptBox.innerHTML = '';
    const heading = (t.id === 'read' && l.mode === 'repeat')
      ? 'Repeat after examiner' : (t.id==='vowel' ? 'Sustained \u201cah\u201d' : (t.id==='read'?'Read aloud':'Free speech'));
    scriptBox.appendChild(el('div',{class:'dim', style:'font-size:11px;letter-spacing:.1em;text-transform:uppercase;margin-bottom:8px'},
      t.tag + ' \u00b7 ' + heading));
    scriptBox.appendChild(el('div',{class:'line'}, sc.line));
    if(sc.roman) scriptBox.appendChild(el('div',{class:'roman'}, sc.roman));
    scriptBox.appendChild(el('details',{},
      el('summary',{}, 'Phonetic rationale'),
      el('p',{}, sc.gloss)
    ));
  }

  function paintControls(){
    const l = L();
    const t = visibleTasks().find(x => x.id === activeTask);
    controls.innerHTML = '';
    const rec = isRecording(t.id);
    const done = !!state.audio[t.id];

    const recBtn = el('button',{class: rec ? 'stop' : 'go'}, rec ? '\u25a0 Stop' : (done ? 'Record again' : '\u25cf Record'));
    recBtn.addEventListener('click', () => rec ? doStop() : doStart(t));
    controls.appendChild(recBtn);

    if(t.id !== 'vowel'){
      const playing = modelPlaying();
      const playBtn = el('button',{ title:'Plays audio/'+state.lang+'_'+t.id+'.mp3 if present, otherwise a synthetic voice reading the script' },
        playing ? '\u25a0 Stop instructions' : '\u25b6 Play instructions');
      playBtn.addEventListener('click', () => {
        if(modelPlaying()) stopModel(paintControls);
        else playModel(state.lang, t.id, undefined, paintControls);
      });
      if(state.fileMode) { /* playback still allowed offline via TTS/local file */ }
      controls.appendChild(playBtn);
    }

    const loadBtn = el('button',{}, 'Load audio');
    const fileInput = el('input',{type:'file', accept:'audio/*', hidden:true});
    loadBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async e => {
      if(e.target.files[0]){
        try { await loadFile(t.id, e.target.files[0], onAnalysed); toast('Loaded audio for ' + taskName(t,l)); }
        catch(err){ toast('Could not decode that file.'); }
      }
    });
    controls.appendChild(loadBtn);
    controls.appendChild(fileInput);

    // elapsed / target timer
    const timer = el('span',{class:'rec-timer', id:'recTimer'}, rec ? '0.0s / ' + t.dur + 's' : ('target ~' + t.dur + 's'));
    controls.appendChild(timer);
  }

  function paintThumb(){
    stopThumb();                 // stop any clip playback before rebuilding
    thumbPlayBtn = null;
    thumbRow.innerHTML = '';
    const t = visibleTasks().find(x => x.id === activeTask);
    const a = state.audio[t.id];
    if(!a) return;
    const cv = el('canvas',{'aria-label': taskName(t,L())+' waveform ('+a.dur.toFixed(1)+' seconds)', role:'img'});
    thumbRow.appendChild(cv);
    const playBtn = el('button',{}, '\u25b6 Play');
    // play / stop toggle for the captured clip
    playBtn.addEventListener('click', () => {
      if(thumbPlaying){ stopThumb(); return; }
      const ac = new (window.AudioContext||window.webkitAudioContext)();
      const buf = ac.createBuffer(1, a.pcm.length, a.fs);
      buf.copyToChannel(a.pcm, 0);
      const s = ac.createBufferSource(); s.buffer = buf; s.connect(ac.destination); s.start();
      thumbPlaying = { ac, src:s };
      playBtn.textContent = '\u25a0 Stop';
      s.onended = () => { if(thumbPlaying && thumbPlaying.src === s){ stopThumb(); } };
    });
    thumbPlayBtn = playBtn;
    thumbRow.appendChild(playBtn);
    thumbRow.appendChild(el('span',{class:'dim', style:'font-size:12px'}, a.dur.toFixed(1) + 's captured'));
    // draw after in DOM
    requestAnimationFrame(() => drawWave(cv, a.pcm));
  }

  function paintQuality(){
    const host = qualityPanel.querySelector('#qualityRows');
    const rows = [];
    for(const id of ['read','free','vowel']){
      const a = state.audio[id]; if(!a) continue;
      const r = state.res[id] || {};
      const t = TASKS.find(x => x.id === id);
      const nm = taskName(t, L());
      const dur = a.dur, durOk = dur >= (id==='free'?15:6);
      const clipOk = a.clip < 0.002;
      const snr = r.contours ? (pctOf(r.contours.intensity,95) - pctOf(r.contours.intensity,10)) : NaN;
      const snrOk = !isFinite(snr) || snr > 18;
      const frames = r.vowelSpace ? r.vowelSpace.nFrames : (r.nPulses || 0);
      rows.push([nm+' duration', dur.toFixed(1)+'s', durOk, durOk?'':'short \u2014 aim for '+(id==='free'?'15s+':'6s+')]);
      rows.push([nm+' clipping', (a.clip*100).toFixed(2)+'%', clipOk, clipOk?'':'reduce input gain']);
      if(isFinite(snr)) rows.push([nm+' speech-to-floor', snr.toFixed(0)+' dB', snrOk, snrOk?'':'move closer / quieter room']);
      if(frames) rows.push([nm+' analysed frames', String(frames), frames>60, frames>60?'':'more voiced speech needed']);
    }
    host.innerHTML = '';
    if(!rows.length){ host.appendChild(el('div',{class:'dim'}, 'Record a task to assess.')); return; }
    for(const [k,v,ok,remedy] of rows){
      host.appendChild(el('div',{class:'rw'},
        el('span',{class:'n'}, k),
        el('span',{class:'v ' + (ok?'ok':'watch')}, v + (ok ? '' : '')),
        remedy ? el('span',{class:'dim', style:'flex:0 0 auto;font-size:11px'}, remedy) : el('span',{})
      ));
    }
  }

  function paintModelNote(){
    const l = L(); const av = modelAvailable(state.lang);
    modelNote.innerHTML = '';
    modelNote.appendChild(el('b',{style:'color:var(--ice)'}, 'Model reading. '));
    modelNote.appendChild(document.createTextNode(
      '\u201cPlay model\u201d looks for audio/'+state.lang+'_read.mp3 and audio/'+state.lang+'_free.mp3 first; ' +
      (av.tts ? 'if absent it falls back to this device\u2019s ' + av.code + ' synthetic voice. '
              : 'no ' + (av.code||'matching') + ' voice is installed here, so a recorded file is the only option. ')));
    const w = el('b',{class:'watch'}, 'Play it during familiarisation, not immediately before recording');
    modelNote.appendChild(w);
    modelNote.appendChild(document.createTextNode(
      ' \u2014 talkers converge on a rate they have just heard, and rate entrainment contaminates the speaking-rate and articulation-rate markers. Playback counts are written into the export.'));
  }

  function paintTxMeta(){
    const l = L();
    const meta = document.getElementById('txMeta');
    if(!meta) return;
    if(!l.asr){ meta.textContent = 'no recogniser for this language'; }
    else if(!SR){ meta.textContent = 'recogniser unavailable in this browser'; }
    else { meta.textContent = l.asr; }
    paintTranscript();
  }

  function paintTranscript(){
    const l = L();
    const host = document.getElementById('liveTx');
    if(!host) return;
    if(!l.asr){
      host.innerHTML = '';
      host.appendChild(el('div',{class:'norecog'}, 'No recogniser for ' + l.name + '. Live transcription, word accuracy and text sentiment are unavailable; all acoustic measures still work.'));
      return;
    }
    if(!SR){
      host.innerHTML = '';
      host.appendChild(el('div',{class:'none'}, 'Live transcription needs Chrome or Edge with network access. Capture still works without it.'));
      return;
    }
    const parts = [];
    ['read','free'].forEach(id => {
      const fin = state.tx[id];
      const intr = (recordingTask()===id) ? interimText[id] : '';
      if(!fin && !intr) return;
      const block = el('div',{style:'margin-bottom:8px'},
        el('div',{class:'dim', style:'font-size:10px;letter-spacing:.1em;text-transform:uppercase'}, id==='read'?'Reading':'Free speech'));
      if(fin) block.appendChild(el('span',{class:'final'}, fin + ' '));
      if(intr) block.appendChild(el('span',{class:'interim'}, intr));
      parts.push(block);
    });
    host.innerHTML = '';
    if(!parts.length){ host.appendChild(el('div',{class:'none'}, 'Transcription streams here as the participant speaks.')); }
    else parts.forEach(p => host.appendChild(p));
  }

  function paintFooter(){
    const pt = document.getElementById('progText');
    const vr = document.getElementById('viewResults');
    if(pt) pt.textContent = recordedCount() + ' of ' + requiredCount() + ' recorded' +
      (state.busy ? ' \u00b7 analysing\u2026' : '');
    if(vr) vr.disabled = !readingCaptured() || state.busy;
  }

  function paintSigMeta(){
    const m = document.getElementById('sigMeta');
    if(m) m.textContent = micReady() ? (Math.round(state.inputRate/1000)+' kHz in \u00b7 16 kHz analysis') : 'idle';
  }

  function paintTasks(){
    paintStepper(); paintScript(); paintControls(); paintThumb(); paintQuality(); paintModelNote(); paintFooter(); paintSigMeta();
  }

  /* ---------- record actions ---------- */
  function doStart(t){
    if(!micReady()){
      toast('Enable the microphone on the Session screen, or load an audio file.');
      return;
    }
    stopModel(paintControls);           // model playback stops on record
    activeTask = t.id;
    startRecording(t.id);
    interimText[t.id] = '';
    startASR(state.lang, t.id, (fin, intr) => { interimText[t.id] = intr; paintTranscript(); });
    announce(taskName(t, L()) + ' recording started');
    paintTasks();
    runTimer(t);
  }

  function doStop(){
    const id = recordingTask();
    stopASR();
    const out = stopRecording();
    if(timerRaf){ cancelAnimationFrame(timerRaf); timerRaf = null; }
    if(!out){ paintTasks(); return; }
    if(out.tooShort){ toast('Recording too short to analyse.'); paintTasks(); return; }
    announce('Recording stopped, analysing');
    ingest(out.id, out.buf, out.fsIn, onAnalysed);
    paintTasks();
  }

  function onAnalysed(id){
    announce('Analysis complete for ' + id);
    // advance stepper to next uncaptured task
    const vis = visibleTasks();
    const next = vis.find(t => !state.audio[t.id]);
    if(next) activeTask = next.id;
    paintTasks();
  }

  function runTimer(t){
    const t0 = performance.now();
    const tick = () => {
      if(!isRecording(t.id)) return;
      const elapsed = (performance.now() - t0) / 1000;
      const timer = document.getElementById('recTimer');
      if(timer) timer.textContent = elapsed.toFixed(1) + 's / ' + t.dur + 's';
      if(elapsed >= t.dur + 6){ doStop(); return; }
      timerRaf = requestAnimationFrame(tick);
    };
    tick();
  }

  /* ---------- live waveform loop ---------- */
  function liveLoop(){
    raf = requestAnimationFrame(liveLoop);
    if(!micReady()) return;
    const { g, w, h } = fit(liveCanvas);
    if(!liveHist || liveHist.length !== Math.round(w)) liveHist = new Array(Math.round(w)).fill(0);
    const lv = readLevel();
    g.fillStyle = '#030A12'; g.fillRect(0,0,w,h);
    // grid
    g.strokeStyle='#0D2942'; g.lineWidth=1;
    for(let i=1;i<4;i++){const y=Math.round(h*i/4)+.5;g.beginPath();g.moveTo(0,y);g.lineTo(w,y);g.stroke();}
    if(!lv) return;
    liveHist.push(lv.peak); liveHist.shift();
    g.strokeStyle = lv.peak > 0.985 ? '#FB7185' : '#22D3EE'; g.lineWidth = 1.4; g.beginPath();
    for(let x=0;x<liveHist.length;x++){ const a = liveHist[x]*h*0.45; x?g.lineTo(x,h/2-a):g.moveTo(x,h/2-a); }
    for(let x=liveHist.length-1;x>=0;x--){ const a = liveHist[x]*h*0.45; g.lineTo(x,h/2+a); }
    g.stroke();
    if(isRecording()){
      g.fillStyle='#FB7185'; g.beginPath(); g.arc(w-14,14,6,0,7); g.fill();
      g.fillStyle='#FFD7DE'; g.font='10px '+cssVar('--sans'); g.textAlign='right'; g.fillText('REC', w-26, 18);
    }
    const fillEl = document.getElementById('recLvl');
    if(fillEl) fillEl.style.width = Math.min(100, lv.rms*420) + '%';
    if(clipEl) clipEl.textContent = lv.peak > 0.985 ? 'CLIPPING' : '';
  }

  // initial paint + loops
  paintWarn();
  paintTasks();
  paintTxMeta();
  liveLoop();

  // re-render on state changes (analysis completion updates quality/footer)
  unsub = subscribe(() => { paintQuality(); paintFooter(); paintSigMeta(); paintThumb(); paintStepper(); paintControls(); });

  // spacebar stops recording
  keyHandler = (e) => {
    if(e.code === 'Space' && !/input|textarea|select|button/i.test(e.target.tagName)){
      if(isRecording()){ e.preventDefault(); doStop(); }
    }
  };
  document.addEventListener('keydown', keyHandler);

  // redraw thumbnails on resize
  resizeHandler = () => { paintThumb(); };
  window.addEventListener('resize', resizeHandler);
}

let keyHandler = null, resizeHandler = null;

function pctOf(arr, p){
  if(!arr || !arr.length) return NaN;
  const b = [...arr].sort((x,y)=>x-y);
  const i = Math.min(b.length-1, Math.max(0, Math.round(p/100*(b.length-1))));
  return b[i];
}

export function teardown(){
  if(raf){ cancelAnimationFrame(raf); raf = null; }
  if(timerRaf){ cancelAnimationFrame(timerRaf); timerRaf = null; }
  if(unsub){ unsub(); unsub = null; }
  if(keyHandler){ document.removeEventListener('keydown', keyHandler); keyHandler = null; }
  if(resizeHandler){ window.removeEventListener('resize', resizeHandler); resizeHandler = null; }
  // do NOT stop the mic on teardown — it must stay live across nav to results and back
  if(isRecording()){ stopASR(); stopRecording(); }
  stopModel();
  stopThumb();
}
