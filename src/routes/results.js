/* ==========================================================================
   Route 3 — /results. Everything computed, nothing to do with capture.
   A narrative report, most interpretable first:
     Headline (ring, interpretation, reference mode, flagged count, identity)
     Slur markers (six published control-vs-impaired plots, LR, d', citation,
                   CPPS calibration offset, language/calibration gating)
     Domain profile (five-axis radar + numeric + a sentence per domain)
     Key metrics (six large cards)
     Parameter deviation (full table tabbed by domain, z bars, provisional)
     Signal views (waveform, spectrogram, pitch/intensity, task selector)
     Transcript, sentiment and emotion (visually separated, confound caveat)
     Export and baseline

   No output is a diagnosis, a stroke probability, a health grade, or a
   confidence score. Likelihood ratios are shown per marker and never
   multiplied. CPPS stays out of the slur tally until a Praat offset is set.
   ========================================================================== */
import { state, notify, subscribe, hasRecording } from '../app/state.js';
import { go } from '../app/router.js';
import { el, f, toast } from '../app/ui.js';
import { SCRIPTS, TASKS } from '../data/scripts.js';
import { DOMAINS } from '../data/reference.js';
import {
  rowsAll, domainScores, overall, slurRows, sentiment, wordAcc, acousticArousal
} from '../app/scoring.js';
import { drawRing, drawRadar, drawSlur, drawWave, drawSpec, drawF0 } from '../app/charts.js';
import { exportAll } from '../app/export.js';

export const title = 'Results';

let unsub = null, resizeHandler = null;
let signalTask = null;

const DOMAIN_SENTENCE = {
  pronunciation:'articulation and vowel-space measures',
  intonation:'pitch and loudness variation',
  fluency:'speaking rate, pausing and rhythm',
  voice:'voice-quality measures (CPPS, HNR, perturbation)',
  clarity:'voicing continuity and spectral balance'
};

/* metric cards — ported verbatim from the prototype CARDS list */
const CARDS = [
  {n:'articulationRate',k:'Articulation rate',u:'syll/s',d:2,sub:r=>r&&isFinite(r.v)?'\u2248 '+Math.round(r.v/1.55*60)+' words/min':''},
  {n:'pauseRatio',k:'Pause ratio',u:'%',d:0,scale:100},
  {n:'f0SdSemitones',k:'Pitch variation',u:'st',d:2},
  {n:'hullArea',k:'Vowel space',u:'kHz\u00b2',d:2,scale:1e-6},
  {n:'cpps',k:'Voice clarity',u:'dB',d:1},
  {n:'voicedFraction',k:'Voicing continuity',u:'%',d:0,scale:100}
];

export async function render(root){
  const L = () => SCRIPTS[state.lang];

  const head = el('div',{class:'page-head'},
    el('h1',{}, 'Results'),
    el('p',{class:'lede'}, 'A description of the measurements and how far they sit from published reference distributions. This is not a diagnosis.')
  );
  root.appendChild(head);

  if(!hasRecording()){
    root.appendChild(el('section',{class:'panel'},
      el('h2',{class:'ptitle'}, 'No recording yet'),
      el('p',{class:'dim'}, 'Record the reading task first.'),
      (() => { const b = el('button',{class:'go'}, 'Go to recording \u2192'); b.addEventListener('click',()=>go('record')); return b; })()
    ));
    return;
  }

  const masonry = el('div',{class:'results-masonry'});
  root.appendChild(masonry);
  root.appendChild(buildFootnotes());

  // default signal task = first captured
  if(!signalTask || !state.audio[signalTask]) signalTask = Object.keys(state.audio)[0];

  function repaint(){
    const rows = rowsAll(state.res, state.lang, state.baseline);
    const dom = domainScores(rows);
    const o = overall(rows);
    masonry.innerHTML = '';
    masonry.appendChild(buildHeadline(rows, o));
    masonry.appendChild(buildSlur());
    masonry.appendChild(buildDomain(dom));
    masonry.appendChild(buildCards(rows));
    masonry.appendChild(buildDeviation(rows));
    masonry.appendChild(buildSignals());
    masonry.appendChild(buildTranscript());
    masonry.appendChild(buildExport());
    // draw canvases after they are in the DOM
    requestAnimationFrame(() => {
      const ring = masonry.querySelector('#ringCv'); if(ring) drawRing(ring, rows.length?o:null);
      const radar = masonry.querySelector('#radarCv'); if(radar) drawRadar(radar, dom);
      masonry.querySelectorAll('canvas.slurcv').forEach(c => {
        const idx = +c.dataset.i; drawSlur(c, currentSlurRows[idx]);
      });
      drawSignalViews();
    });
  }

  let currentSlurRows = [];

  /* ---------- Headline ---------- */
  function buildHeadline(rows, o){
    const flagged = rows.filter(r => r.flag !== 'ok').length;
    const verdict = !rows.length ? 'Awaiting data'
      : o < 25 ? 'Within reference ranges'
      : o < 50 ? 'Borderline \u2014 some parameters outside'
      : 'Multiple parameters outside range';
    const vcls = !rows.length ? 'dim' : o < 25 ? 'ok' : o < 50 ? 'watch' : 'out';

    const identity = el('div',{class:'identity-strip'});
    const idItems = [
      ['Participant', state.meta.participant || '\u2014'],
      ['Language', L().name],
      ['Date', new Date().toISOString().slice(0,10)],
    ];
    for(const id of ['read','free','vowel']){
      const a = state.audio[id]; if(!a) continue;
      const t = TASKS.find(x=>x.id===id);
      idItems.push([t.name+' duration', a.dur.toFixed(1)+'s']);
    }
    idItems.forEach(([k,v]) => identity.appendChild(el('div',{class:'item'},
      el('span',{class:'k'}, k), el('span',{class:'v'}, v))));

    return el('section',{class:'panel'},
      el('h2',{class:'ptitle'}, 'Headline'),
      el('div',{class:'headline'},
        el('canvas',{id:'ringCv', role:'img','aria-label':'Deviation index '+(rows.length?o:'unavailable')}),
        el('div',{class:'read-out'},
          el('div',{class:'dim', style:'font-size:10px;letter-spacing:.11em;text-transform:uppercase'}, 'Interpretation'),
          el('div',{class:'verdict '+vcls}, verdict),
          el('div',{class:'dim', style:'font-size:13px;margin-top:6px'},
            !rows.length ? 'Record the reading task to begin.'
            : flagged + ' of ' + rows.length + ' parameters flagged. This is a description of the measurements, not a diagnosis.'),
          el('div',{class:'dim', style:'font-size:10px;letter-spacing:.11em;text-transform:uppercase;margin-top:12px'}, 'Reference mode'),
          el('div',{class:'num', style:'font-size:14px;color:var(--ice)'}, state.baseline ? 'personal baseline' : 'population ranges')
        )
      ),
      identity
    );
  }

  /* ---------- Slur markers ---------- */
  function buildSlur(){
    currentSlurRows = slurRows(state.res, state.tx, state.lang, state.cppsCal);
    const done = currentSlurRows.filter(r => isFinite(r.v));
    const scored = done.filter(r => !r.uncal && !r.naLang);
    const nd = scored.filter(r => r.side === 'dys').length;
    const nm = scored.filter(r => r.side === 'mid').length;

    const cal = el('input',{type:'number', step:'0.1', id:'cppsCal', placeholder:'uncalibrated',
      value: state.cppsCal==null?'':state.cppsCal, style:'width:120px', 'aria-label':'CPPS calibration offset in dB'});
    cal.addEventListener('input', () => {
      const v = parseFloat(cal.value); state.cppsCal = isFinite(v) ? v : null; repaint();
    });

    const panel = el('section',{class:'panel'},
      el('h2',{class:'ptitle'}, 'Slur markers vs published distributions',
        el('span',{class:'meta'}, done.length + '/' + currentSlurRows.length + ' measured')),
      el('div',{style:'display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:14px;font-size:12px;color:var(--dim)'},
        el('label',{for:'cppsCal', style:'margin:0;text-transform:none;letter-spacing:normal'}, 'CPPS calibration offset vs Praat (dB)'),
        cal,
        el('span',{}, 'Measure the same recordings in Praat, enter (Praat \u2212 this tool), and the published cut-off becomes usable.'),
        el('a',{href:'#/method'}, 'Praat instructions'))
    );

    const rowsHost = el('div',{});
    if(!done.length){
      rowsHost.appendChild(el('div',{class:'dim'}, 'Record the reading task to place this speaker against the published distributions.'));
    } else {
      currentSlurRows.forEach((r,i) => {
        const mk = r.mk, has = isFinite(r.v);
        const badge = !has ? el('span',{class:'pill info'}, 'not measured')
          : r.naLang ? el('span',{class:'pill watch'}, 'English norms only')
          : r.uncal ? el('span',{class:'pill watch'}, 'needs calibration')
          : r.side==='dys' ? el('span',{class:'pill out'}, 'resembles impaired')
          : r.side==='mid' ? el('span',{class:'pill watch'}, 'in the overlap')
          : el('span',{class:'pill ok'}, 'resembles control');
        const lrTxt = (!has||r.uncal||r.naLang) ? ''
          : (r.lr>=1 ? (r.lr>100?'>100\u00d7 toward impaired':'likelihood ratio '+r.lr.toFixed(1)+'\u00d7 toward impaired')
                     : (1/r.lr>100?'>100\u00d7 toward control':'likelihood ratio '+(1/r.lr).toFixed(1)+'\u00d7 toward control'));
        const dprime = (Math.abs(mk.ctrl.m-mk.dys.m)/Math.sqrt((mk.ctrl.sd**2+mk.dys.sd**2)/2)).toFixed(2);
        rowsHost.appendChild(el('div',{class:'slur-marker'},
          el('div',{class:'head'},
            el('span',{}, mk.lab, ' ', el('span',{class:'dim'}, mk.u)),
            el('span',{class:'val'}, has ? f(r.v, mk.id==='pause'?2:(r.v>50?0:2)) : '\u2014'),
            el('span',{class:'badge'}, badge)),
          el('canvas',{class:'slurcv', dataset:{ i:String(i) }, role:'img',
            'aria-label': mk.lab + (has ? ' value ' + f(r.v,2) : ' not measured')}),
          el('div',{class:'sub'},
            el('span',{}, 'separation d\u2032 ' + dprime + (mk.firm ? '' : ' \u00b7 indicative distribution')),
            el('span',{}, lrTxt)),
          el('details',{},
            el('summary',{}, 'Source \u2014 where this distribution comes from'),
            el('p',{}, 'Control ' + mk.ctrl.m + '\u00b1' + mk.ctrl.sd + ', impaired ' + mk.dys.m + '\u00b1' + mk.dys.sd +
              (mk.cut ? ', published cut-off ' + mk.cut + ' ' + mk.u : '') + '. ' + mk.src),
            el('p',{}, el('a',{href:'#/method'}, 'Full source table on the Method page \u2192')))
        ));
      });
    }
    panel.appendChild(rowsHost);

    const sumColor = nd>=3?'var(--red)':nd>=1?'var(--amber)':'var(--green)';
    panel.appendChild(el('div',{class:'dim', style:'font-size:12px;margin-top:12px'},
      el('b',{style:'color:'+sumColor}, nd + ' of ' + scored.length),
      ' markers sit closer to the published dysarthric distribution, ' + nm + ' fall in the overlap. ' +
      'Converging deviation across markers is the signal; any single marker on its own is not. These likelihood ratios are shown per marker and deliberately not multiplied together \u2014 the markers are correlated and the reference cohorts are not stroke cohorts.'));
    panel.appendChild(el('details',{},
      el('summary',{}, 'These are not stroke thresholds'),
      el('p',{}, 'Every reference distribution was measured on dysarthric speakers of mixed aetiology \u2014 Parkinson\u2019s disease, cerebral palsy, ALS, mixed neurological \u2014 against healthy controls, on different equipment and software. They tell you whether this speech resembles impaired speech. They do not tell you the cause, and they were not derived on Singaporean speakers or on this implementation. Calibrate against your own controls before treating any line here as a threshold.')));
    return panel;
  }

  /* ---------- Domain profile ---------- */
  function buildDomain(dom){
    const rowsHost = el('div',{class:'rows'});
    DOMAINS.forEach(([k,lab]) => {
      const d = dom[k];
      if(!d){ rowsHost.appendChild(el('div',{class:'rw'}, el('span',{class:'n'},lab), el('span',{class:'dim', style:'font-size:12px'},'no data'))); return; }
      const col = d.flag==='ok'?'var(--green)':d.flag==='watch'?'var(--amber)':'var(--red)';
      const label = d.flag==='ok'?'in range':d.flag==='watch'?'borderline':'outside';
      rowsHost.appendChild(el('div',{class:'rw'},
        el('span',{class:'n'}, lab),
        el('span',{class:'b'}, el('i',{style:'width:'+d.score+'%;background:'+col})),
        el('span',{class:'v '+d.flag}, String(d.score)),
        el('span',{class:d.flag, style:'font-size:11px;width:auto'}, label)));
    });
    // one sentence per domain saying what drove it
    const sentences = el('div',{style:'margin-top:12px'});
    DOMAINS.forEach(([k,lab]) => {
      const d = dom[k]; if(!d) return;
      const state2 = d.flag==='ok'?'within range':d.flag==='watch'?'borderline':'outside range';
      sentences.appendChild(el('p',{class:'dim', style:'font-size:12px;margin:0 0 4px'},
        el('b',{style:'color:var(--ice)'}, lab + ': '), state2 + ' \u2014 driven by ' + DOMAIN_SENTENCE[k] + '.'));
    });
    return el('section',{class:'panel'},
      el('h2',{class:'ptitle'}, 'Domain profile',
        el('span',{class:'meta'}, Object.values(dom).filter(Boolean).length + '/5 measured')),
      rowsHost,
      el('canvas',{id:'radarCv', style:'height:280px;margin-top:14px', role:'img','aria-label':'Five-axis domain radar'}),
      sentences);
  }

  /* ---------- Key metrics ---------- */
  function buildCards(rows){
    const map = {}; rows.forEach(r => map[r.n]=r);
    const cardsHost = el('div',{class:'cards'});
    CARDS.forEach(c => {
      const r = map[c.n];
      const v = r ? r.v*(c.scale||1) : NaN;
      const flag = r ? r.flag : '';
      const sub = r ? (c.sub ? c.sub(r) : (r.flag==='ok'?'within range':r.flag==='watch'?'borderline':'outside range')) : 'not measured';
      cardsHost.appendChild(el('div',{class:'card '+flag},
        el('div',{class:'k'}, c.k),
        el('div',{class:'v'}, f(v,c.d), el('em',{}, c.u)),
        el('div',{class:'s'}, sub)));
    });
    return el('section',{class:'panel'},
      el('h2',{class:'ptitle'}, 'Key metrics', el('span',{class:'meta'}, 'plain figures')),
      cardsHost);
  }

  /* ---------- Parameter deviation table ---------- */
  function buildDeviation(rows){
    const tabs = el('div',{class:'tabs', role:'tablist','aria-label':'Deviation domains'});
    const body = el('div',{id:'devBody'});
    const groups = [...DOMAINS, ['all','All parameters']];
    function renderBody(){
      const sel = state.tab==='all' ? rows : rows.filter(r => r.sp.g===state.tab);
      body.innerHTML = '';
      if(!sel.length){ body.appendChild(el('div',{class:'dim', style:'padding:8px 0'}, 'No parameters in this group yet.')); return; }
      sel.sort((a,b)=>b.bad-a.bad);
      const tb = el('table',{},
        el('thead',{}, el('tr',{},
          el('th',{}, 'Parameter'), el('th',{class:'r'}, 'Value'),
          el('th',{class:'r'}, 'Typical'), el('th',{style:'width:32%'}, 'Deviation'),
          el('th',{class:'r'}, 'z'))));
      const tbody = el('tbody',{});
      sel.forEach(r => {
        const z = Math.max(-4.5,Math.min(4.5,r.z)), wd = Math.abs(z)/4.5*50, left = z<0?50-wd:50;
        const col = r.flag==='out'?'var(--red)':r.flag==='watch'?'var(--amber)':'var(--cyan)';
        const nameCell = el('td',{},
          r.sp.lab, ' ',
          r.sp.prov ? el('span',{class:'prov', title:'provisional range, no published cutoff'}, '\u25e6') : '',
          ' ', el('span',{class:'dim'}, r.sp.u));
        tbody.appendChild(el('tr',{},
          nameCell,
          el('td',{class:'r'}, f(r.v, r.v>1000?0:2)),
          el('td',{class:'r dim'}, f(r.sp.lo, r.sp.lo>1000?0:2)+'\u2013'+f(r.sp.hi, r.sp.hi>1000?0:2)),
          el('td',{}, el('div',{class:'bar'}, el('i',{style:'left:'+left+'%;width:'+wd+'%;background:'+col}), el('u',{}))),
          el('td',{class:'r '+r.flag}, (z>0?'+':'')+z.toFixed(1))));
      });
      tb.appendChild(tbody);
      body.appendChild(tb);
      body.appendChild(el('div',{class:'dim', style:'font-size:11px;margin-top:8px'},
        'z is scaled so \u00b12 sits on the edge of the reference interval. \u25e6 marks a provisional range with no published cutoff \u2014 ',
        el('a',{href:'#/method'}, 'see Method'), '.'));
    }
    groups.forEach(([k,lab]) => {
      const b = el('button',{role:'tab','aria-selected': String(state.tab===k)}, lab);
      b.addEventListener('click', () => { state.tab = k; tabs.querySelectorAll('button').forEach(x=>x.setAttribute('aria-selected','false')); b.setAttribute('aria-selected','true'); renderBody(); });
      tabs.appendChild(b);
    });
    renderBody();
    return el('section',{class:'panel'},
      el('h2',{class:'ptitle'}, 'Parameter deviation', el('span',{class:'meta'}, rows.length + ' parameters')),
      tabs, body);
  }

  /* ---------- Signal views ---------- */
  function buildSignals(){
    const sel = el('select',{id:'signalTask','aria-label':'Signal view task', style:'max-width:220px'});
    Object.keys(state.audio).forEach(id => {
      const t = TASKS.find(x=>x.id===id);
      sel.appendChild(el('option',{value:id, selected:signalTask===id}, t?t.name:id));
    });
    sel.addEventListener('change', () => { signalTask = sel.value; drawSignalViews(); });
    return el('section',{class:'panel'},
      el('h2',{class:'ptitle'}, 'Signal views', el('span',{class:'meta'}, 'per task')),
      el('div',{style:'margin-bottom:12px'}, sel),
      el('figure',{class:'chart-fig'},
        el('canvas',{id:'sigWave', style:'height:110px', role:'img','aria-label':'Waveform'}),
        el('figcaption',{}, 'Waveform \u2014 amplitude over time')),
      el('figure',{class:'chart-fig', style:'margin-top:12px'},
        el('canvas',{id:'sigSpec', style:'height:150px', role:'img','aria-label':'Spectrogram 0 to 8 kHz'}),
        el('figcaption',{}, 'Spectrogram \u2014 0\u20138 kHz, brighter = more energy')),
      el('figure',{class:'chart-fig', style:'margin-top:12px'},
        el('canvas',{id:'sigF0', style:'height:100px', role:'img','aria-label':'Pitch and intensity contour'}),
        el('figcaption',{id:'sigF0cap'}, 'Pitch (green, Hz) and loudness (blue, dB) over time')));
  }
  function drawSignalViews(){
    const a = state.audio[signalTask]; if(!a) return;
    const wave = document.getElementById('sigWave'); if(wave) drawWave(wave, a.pcm);
    const spec = document.getElementById('sigSpec'); if(spec) drawSpec(spec, a.pcm);
    const f0 = document.getElementById('sigF0');
    if(f0){ const info = drawF0(f0, state.res[signalTask]);
      const cap = document.getElementById('sigF0cap');
      if(cap && info && info.fmin) cap.textContent = 'Pitch (green, Hz, '+info.fmin+'\u2013'+info.fmax+') and loudness (blue, dB) over time'; }
  }

  /* ---------- Transcript, sentiment & emotion ---------- */
  function buildTranscript(){
    const l = L();
    const txHost = el('div',{});
    let any = false;
    ['read','free'].forEach(id => {
      const t = state.tx[id]; if(!t) return; any = true;
      txHost.appendChild(el('div',{style:'margin-bottom:8px'},
        el('div',{class:'dim', style:'font-size:10px;letter-spacing:.1em;text-transform:uppercase'}, id==='read'?'Reading':'Free speech'),
        el('div',{style:'font-size:14px'}, t)));
    });
    if(!any){
      txHost.appendChild(el('div',{class:'dim', style:'font-size:13px'},
        l.asr ? 'No transcript captured (needs Chrome/Edge with network).' : 'No recogniser for ' + l.name + '.'));
    }

    // emotion / sentiment — reported SEPARATELY, never folded into motor score
    const emo = el('div',{});
    const acc = state.tx.read ? wordAcc(l.read.line, state.tx.read) : null;
    const sr = sentiment(state.tx.free || state.tx.read);
    const ar = acousticArousal(state.res);
    const items = [];
    if(acc) items.push(['Word error rate vs script', (acc.wer*100).toFixed(0)+'%'], ['Words recognised / expected', acc.hyp+' / '+acc.ref]);
    if(sr && sr.matched) items.push(['Text valence (\u22121 \u2026 +1)', sr.valence.toFixed(2)], ['Text arousal (0 \u2026 1)', sr.arousal.toFixed(2)], ['Lexicon coverage', sr.matched+' / '+sr.words+' words']);
    if(ar !== null) items.push(['Acoustic arousal proxy', (ar>0?'+':'')+ar.toFixed(2)]);
    if(items.length){
      const rowsH = el('div',{class:'rows'});
      items.forEach(([k,v]) => rowsH.appendChild(el('div',{class:'rw'}, el('span',{class:'n'},k), el('span',{class:'v num', style:'width:auto'}, v))));
      emo.appendChild(rowsH);
      if(state.lang!=='en' && sr) emo.appendChild(el('div',{class:'emo-caveat'}, 'The sentiment lexicon is English-only; scores for other languages reflect only code-switched English words.'));
    } else {
      emo.appendChild(el('div',{class:'dim', style:'font-size:13px'}, 'Available after a task with a transcript.'));
    }

    return el('section',{class:'panel'},
      el('h2',{class:'ptitle'}, 'Transcript, sentiment & emotion', el('span',{class:'meta'}, 'separate from the motor-speech score')),
      el('div',{class:'tx', style:'border:1px solid var(--line2);border-radius:6px;padding:11px 13px;background:rgba(3,12,22,.7)'}, txHost),
      el('div',{style:'margin-top:14px;padding-top:12px;border-top:1px solid var(--line2)'},
        el('div',{class:'dim', style:'font-size:10px;letter-spacing:.11em;text-transform:uppercase;margin-bottom:8px'}, 'Emotion & sentiment (reported separately)'),
        emo),
      el('details',{},
        el('summary',{}, 'What these can and cannot tell you'),
        el('p',{}, 'Text valence and arousal come from a small inspectable lexicon, not a model. Acoustic arousal is a composite of pitch level, pitch range, loudness variation, rate and spectral tilt.'),
        el('p',{}, 'These features covary with arousal and with dysarthria itself: flat pitch, low loudness variation and slow rate are simultaneously the signature of low arousal and of hypokinetic or flaccid dysarthria. In a stroke context the two are confounded at signal level, which is why emotion is reported beside the motor-speech score and never folded into it.')));
  }

  /* ---------- Export & baseline ---------- */
  function buildExport(){
    const exportBtn = el('button',{class:'go'}, 'Export JSON + CSV + WAV');
    exportBtn.addEventListener('click', () => { const stem = exportAll(); toast('Exported ' + stem); });

    const baseFile = el('input',{type:'file', accept:'application/json', style:'max-width:230px;font-size:12px'});
    const baseState = el('p',{class:'dim', id:'baseState'}, state.baseline ? 'Baseline loaded.' : 'No baseline loaded.');
    baseFile.addEventListener('change', async e => {
      const fl = e.target.files[0]; if(!fl) return;
      try {
        const j = JSON.parse(await fl.text());
        state.baseline = j.results || null;
        baseState.textContent = state.baseline
          ? ('Baseline: ' + ((j.meta&&j.meta.participant)||'unnamed') + ' \u00b7 ' + ((j.meta&&j.meta.recordedAt)||''))
          : 'That file had no results.';
        repaint();
      } catch(err){ baseState.textContent = 'Could not read that file.'; }
    });
    const clearBtn = el('button',{}, 'Clear baseline');
    clearBtn.addEventListener('click', () => { state.baseline=null; baseState.textContent='No baseline loaded.'; repaint(); });

    return el('section',{class:'panel'},
      el('h2',{class:'ptitle'}, 'Export & baseline'),
      el('div',{class:'export-row'}, exportBtn),
      el('p',{class:'dim', style:'font-size:12px'}, 'Per-task 16 kHz WAV, full JSON and a flat CSV. All data stays on this device \u2014 export is the only way the session leaves memory.'),
      el('details',{open:true},
        el('summary',{}, 'Use this person\u2019s own baseline instead'),
        el('p',{}, 'Within-person change beats any population range. Export a session recorded when the person is well, then load it here.'),
        el('div',{style:'display:flex;gap:10px;align-items:center;margin-top:8px;flex-wrap:wrap'}, baseFile, clearBtn),
        baseState));
  }

  function buildFootnotes(){
    return el('div',{class:'footnotes'},
      el('b',{style:'color:var(--ice)'}, 'Why two tasks are enough \u2014 and what they cost you.'),
      el('ol',{},
        el('li',{}, 'Reading a fixed sentence gives a controlled, repeatable sample: identical phonetic content across sessions, which makes rate, pausing and vowel-space measures comparable over time.'),
        el('li',{}, 'Vowel space is taken from running speech as a convex hull over the F1\u00d7F2 cloud rather than from isolated corner vowels (Whitfield & Gravelin, JSLHR 2022).'),
        el('li',{}, 'Voice quality in connected speech is carried by smoothed cepstral peak prominence, recommended for running speech.'),
        el('li',{}, 'Jitter and shimmer are computed only on stable voiced runs with onset/offset ramps trimmed, and are not comparable to sustained-vowel norms. Add the optional \u201cah\u201d task for clinic-grade perturbation.'),
        el('li',{}, 'What genuinely goes away without diadochokinesis: alternating/sequential motion rates and their rhythm irregularity. Connected-speech articulation rate and the 2\u20138 Hz envelope modulation peak are partial substitutes.'),
        el('li',{}, 'Ranges marked provisional have no published cutoff. Replace every range with values measured on your own hardware and control speakers before drawing any conclusion.'),
        el('li',{}, 'The slur-marker panel places the speaker between a published control distribution and a published dysarthric distribution per marker, because no published threshold defines \u201cslurred speech\u201d from acoustics alone. The reference standard remains perceptual (NIHSS item 10).'),
        el('li',{}, 'FCR and F2(i)/F2(u) are estimated from percentile corners of the running-speech F1\u00d7F2 cloud; on synthetic speech this reproduced the corner-vowel FCR to three decimals and separated a centralised talker at 1.60.')));
  }

  repaint();
  unsub = subscribe(() => { if(!state.busy) repaint(); });
  resizeHandler = () => requestAnimationFrame(() => {
    const rows = rowsAll(state.res, state.lang, state.baseline);
    const ring = document.getElementById('ringCv'); if(ring) drawRing(ring, rows.length?overall(rows):null);
    const radar = document.getElementById('radarCv'); if(radar) drawRadar(radar, domainScores(rows));
    document.querySelectorAll('canvas.slurcv').forEach(c => { const i=+c.dataset.i; if(currentSlurRows[i]) drawSlur(c, currentSlurRows[i]); });
    drawSignalViews();
  });
  window.addEventListener('resize', resizeHandler);
}

export function teardown(){
  if(unsub){ unsub(); unsub = null; }
  if(resizeHandler){ window.removeEventListener('resize', resizeHandler); resizeHandler = null; }
}
