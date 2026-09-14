/* ==========================================================================
   Route 1 — /session (default).
   A short setup screen. Participant code, age, sex, language (ten options),
   timepoint. Microphone selection + live input-level check with a clear
   pass/fail. Secure-context and permission state surfaced plainly. The
   language selector drives everything downstream, so its consequences are
   shown here. One primary action: Start recording -> /record.
   ========================================================================== */
import { state } from '../app/state.js';
import { go } from '../app/router.js';
import { el, toast } from '../app/ui.js';
import { SCRIPTS } from '../data/scripts.js';
import { initMic, listMics, permissionState, readLevel, micReady } from '../app/capture.js';
import { modelAvailable, SR } from '../app/media.js';

export const title = 'Session setup';

let raf = null;

const LANG_ORDER = [
  { group:'Validated protocol drafted', codes:['en','zh','ms','ta'] },
  { group:'Added — draft scripts, native check required', codes:['yue','ja','ko','th','my','nan'] }
];

function langConsequences(lang){
  const L = SCRIPTS[lang];
  const av = modelAvailable(lang);
  const items = [];
  items.push(['Recogniser locale', L.asr
    ? el('span',{class:'num'}, L.asr)
    : el('span',{class:'watch'}, 'none — no live transcript, word accuracy or text sentiment')]);
  items.push(['Script status', L.validated
    ? el('span',{class:'ok'}, 'validated protocol drafted')
    : el('span',{class:'watch'}, 'draft — needs native-speaker clinical sign-off')]);
  items.push(['Rhythm class', el('span',{}, L.rhythm)]);
  items.push(['Tonal language', L.tonal
    ? el('span',{class:'watch'}, 'yes — pitch-variation and pitch-range markers are disabled (lexical tone drives F0)')
    : el('span',{class:'ok'}, 'no — pitch markers apply')]);
  items.push(['Model reading', av.tts
    ? el('span',{}, 'recorded file if present, else ' + av.code + ' synthetic voice')
    : el('span',{class:'watch'}, 'no ' + (av.code||'matching') + ' synthetic voice on this device — recorded file only')]);
  items.push(['Reading task', L.mode === 'repeat'
    ? el('span',{class:'watch'}, 'becomes a repetition task — examiner reads each clause, participant repeats')
    : el('span',{class:'ok'}, 'read aloud')]);
  items.push(['Evidence grading', el('span',{class:'dim'}, L.evidence)]);
  return items;
}

function renderConsequences(host, lang){
  host.innerHTML = '';
  for(const [lab, valNode] of langConsequences(lang)){
    host.appendChild(el('div',{class:'consequence'},
      el('div',{class:'lab'}, lab),
      el('div',{class:'val'}, typeof valNode === 'string' ? valNode : valNode)
    ));
  }
}

export async function render(root){
  const L = () => SCRIPTS[state.lang];

  const head = el('div',{class:'page-head'},
    el('h1',{}, 'Session setup'),
    el('p',{class:'lede'}, 'Enter the participant details and choose the language. Check the microphone level before you start. Everything runs on this device; nothing is uploaded.')
  );

  /* ---- setup fields ---- */
  const pid = el('input',{id:'pid', value:state.meta.participant, placeholder:'RP-014', autocomplete:'off', 'aria-label':'Participant code'});
  const age = el('input',{id:'age', type:'number', min:'0', max:'120', value:state.meta.age, placeholder:'years', 'aria-label':'Age in years'});
  const sex = el('select',{id:'sex','aria-label':'Sex'},
    el('option',{value:'m', selected:state.meta.sex==='m'}, 'Male'),
    el('option',{value:'f', selected:state.meta.sex==='f'}, 'Female'),
    el('option',{value:'x', selected:state.meta.sex==='x'}, '—')
  );
  const cond = el('input',{id:'cond', value:state.meta.timepoint, placeholder:'baseline', autocomplete:'off', 'aria-label':'Timepoint'});

  const langSel = el('select',{id:'lang','aria-label':'Language'});
  for(const grp of LANG_ORDER){
    const og = el('optgroup',{label:grp.group});
    for(const code of grp.codes){
      og.appendChild(el('option',{value:code, selected:state.lang===code}, SCRIPTS[code].name));
    }
    langSel.appendChild(og);
  }

  pid.addEventListener('input', () => { state.meta.participant = pid.value; });
  age.addEventListener('input', () => { state.meta.age = age.value; });
  sex.addEventListener('change', () => { state.meta.sex = sex.value; });
  cond.addEventListener('input', () => { state.meta.timepoint = cond.value; });

  const consequences = el('div',{class:'consequences', id:'consequences', 'aria-live':'polite'});
  langSel.addEventListener('change', () => {
    state.lang = langSel.value;
    renderConsequences(consequences, state.lang);
    renderUnvalidatedWarn();
  });

  const setupPanel = el('section',{class:'panel'},
    el('h2',{class:'ptitle'}, 'Participant', el('span',{class:'meta'}, 'in memory only')),
    el('div',{class:'setup-fields'},
      el('div',{class:'field'}, el('label',{for:'pid'},'Participant code'), pid),
      el('div',{class:'field'}, el('label',{for:'age'},'Age'), age),
      el('div',{class:'field'}, el('label',{for:'sex'},'Sex'), sex),
      el('div',{class:'field'}, el('label',{for:'cond'},'Timepoint'), cond),
      el('div',{class:'field full'}, el('label',{for:'lang'},'Language (drives the whole protocol)'), langSel)
    ),
    el('div',{class:'field full', style:'margin-top:12px'},
      el('label',{},'Language consequences'),
      consequences
    )
  );

  const warnHost = el('div',{id:'unvalidatedWarn'});
  function renderUnvalidatedWarn(){
    warnHost.innerHTML = '';
    const l = L();
    if(!l.validated){
      warnHost.appendChild(el('div',{class:'warn-box', role:'note'},
        el('b',{}, l.name + ' — draft. '),
        'Script and prompt need sign-off from a native-speaking clinician before use with participants. This warning also appears on the recording screen.'
      ));
    }
  }

  /* ---- context + mic panel ---- */
  const ctxRows = el('div',{class:'rows', id:'ctxRows'});
  const micSel = el('select',{id:'micSel','aria-label':'Microphone'});
  const enableBtn = el('button',{class:'go', id:'enableMic'}, 'Enable microphone');
  const levelMeter = el('div',{class:'meter', role:'meter','aria-label':'Input level','aria-valuemin':'0','aria-valuemax':'100'}, el('i',{id:'lvlFill'}), el('u',{}));
  const levelVerdict = el('div',{class:'level-verdict', id:'lvlVerdict', 'aria-live':'polite'}, 'Enable the microphone to check your level.');
  const clipInd = el('span',{class:'clip-ind out', id:'clipInd'});

  const micPanel = el('section',{class:'panel'},
    el('h2',{class:'ptitle'}, 'Microphone & context'),
    el('div',{class:'rows', id:'ctxHost'}, ctxRows),
    el('div',{class:'field', style:'margin-top:14px'}, el('label',{for:'micSel'},'Microphone'), micSel),
    el('div',{class:'rec-controls'}, enableBtn),
    el('div',{class:'level-check'},
      el('div',{style:'display:flex;justify-content:space-between;align-items:baseline;gap:10px'},
        el('label',{style:'margin:0'},'Live input level'), clipInd),
      levelMeter,
      levelVerdict
    )
  );

  const startBtn = el('button',{class:'go big', id:'startBtn'}, 'Start recording →');
  startBtn.addEventListener('click', () => { go('record'); });
  const startRow = el('div',{class:'start-row'},
    startBtn,
    el('span',{class:'dim'}, 'Capture and results are on separate screens. This begins the reading task.')
  );

  root.appendChild(head);
  root.appendChild(el('div',{class:'session-grid'}, setupPanel, micPanel));
  root.appendChild(warnHost);
  root.appendChild(startRow);

  renderConsequences(consequences, state.lang);
  renderUnvalidatedWarn();

  /* ---- context rows: secure context, permission, file mode ---- */
  async function paintContext(){
    ctxRows.innerHTML = '';
    const rows = [];
    rows.push(['Secure context', state.secureContext ? el('span',{class:'ok'},'yes — microphone allowed') : el('span',{class:'out'},'no — microphone blocked')]);
    if(state.fileMode){
      rows.push(['Running from', el('span',{class:'watch'}, 'file:// — recording disabled, load audio files instead')]);
    }
    const perm = await permissionState();
    state.micPermission = perm;
    const permMap = {
      granted: el('span',{class:'ok'},'granted'),
      denied: el('span',{class:'out'},'denied — reset it in the browser site settings'),
      prompt: el('span',{class:'dim'},'will prompt on enable'),
      unknown: el('span',{class:'dim'},'unknown until enabled')
    };
    rows.push(['Microphone permission', permMap[perm] || permMap.unknown]);
    rows.push(['Live recogniser', SR ? el('span',{class:'ok'},'available (Chrome / Edge)') : el('span',{class:'watch'},'not in this browser — capture still works')]);
    for(const [k,v] of rows){
      ctxRows.appendChild(el('div',{class:'rw'}, el('span',{class:'n'}, k), el('span',{class:'v', style:'width:auto'}, v)));
    }
  }
  paintContext();

  /* ---- mic device list ---- */
  async function paintMics(){
    micSel.innerHTML = '';
    const mics = await listMics();
    if(!mics.length){
      micSel.appendChild(el('option',{value:''}, 'default microphone'));
      return;
    }
    mics.forEach((m,i) => {
      micSel.appendChild(el('option',{value:m.deviceId}, m.label || ('Microphone ' + (i+1))));
    });
    if(state.deviceId) micSel.value = state.deviceId;
  }
  paintMics();

  if(state.fileMode || !state.secureContext){
    enableBtn.disabled = true;
    enableBtn.textContent = 'Microphone unavailable here';
    levelVerdict.textContent = 'Microphone is disabled in this context. You can still load audio files on the recording screen.';
  }

  micSel.addEventListener('change', async () => {
    if(micReady()){ try { await initMic(micSel.value || undefined); } catch(e){ toast('Could not switch microphone.'); } }
  });

  enableBtn.addEventListener('click', async () => {
    try {
      await initMic(micSel.value || undefined);
      enableBtn.textContent = 'Microphone ready';
      enableBtn.disabled = true;
      await paintContext();
      await paintMics();
      micSel.value = state.deviceId || '';
      startLevelLoop();
    } catch(e){
      levelVerdict.innerHTML = '';
      levelVerdict.appendChild(el('span',{class:'out'}, 'Blocked — ' + e.message + '. Use "load audio" on the recording screen instead.'));
    }
  });

  /* ---- live level loop with pass/fail verdict ---- */
  const fill = levelMeter.querySelector('#lvlFill');
  function startLevelLoop(){
    stopLevelLoop();
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const lv = readLevel();
      if(!lv) return;
      const pctLvl = Math.min(100, lv.rms * 420);
      fill.style.width = pctLvl + '%';
      levelMeter.setAttribute('aria-valuenow', Math.round(pctLvl));
      // pass/fail verdict
      if(lv.peak > 0.985){
        clipInd.textContent = 'CLIPPING';
        setVerdict('out', 'Clipping — reduce input gain.');
      } else {
        clipInd.textContent = '';
        if(lv.rms < 0.012){ setVerdict('watch', 'Too quiet — move closer to the microphone.'); }
        else { setVerdict('ok', 'Your level looks good.'); }
      }
    };
    loop();
  }
  function setVerdict(cls, msg){
    if(levelVerdict.dataset.state === cls + msg) return;
    levelVerdict.dataset.state = cls + msg;
    levelVerdict.innerHTML = '';
    levelVerdict.appendChild(el('span',{class:cls}, msg));
  }
  function stopLevelLoop(){ if(raf){ cancelAnimationFrame(raf); raf = null; } }

  // if mic was already enabled earlier in the session, resume the loop
  if(micReady()){ enableBtn.textContent = 'Microphone ready'; enableBtn.disabled = true; startLevelLoop(); }
}

export function teardown(){
  if(raf){ cancelAnimationFrame(raf); raf = null; }
}
