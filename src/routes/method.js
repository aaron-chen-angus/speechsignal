/* ==========================================================================
   Route 4 — /method. The reference tables, every published source with its
   numbers, the provisional-range disclosure, the language coverage table with
   evidence grading, the "two tasks are enough and what they cost you" notes,
   the tonal-language explanation, and the Praat calibration instructions.

   Linked to from anywhere a number needs justifying. Section ids allow
   deep-linking (e.g. #/method + scroll to #sources or #provisional).

   Content is drawn from citations, evidence gradings and reference tables
   already embedded in the prototype (slur src strings, per-language evidence
   fields, the REF table). No numbers are invented. assessment.md was not
   supplied; if added later, reconcile this page against it.
   ========================================================================== */
import { el } from '../app/ui.js';
import { REF, DOMAINS } from '../data/reference.js';
import { SLUR } from '../data/slur.js';
import { SCRIPTS } from '../data/scripts.js';

export const title = 'Method';

const DOMAIN_LABEL = Object.fromEntries(DOMAINS);

function evidenceClass(ev){
  const s = ev.toLowerCase();
  if(s.startsWith('strong')||s.startsWith('good')) return 'evidence-strong';
  if(s.startsWith('moderate')) return 'evidence-mod';
  if(s.startsWith('sparse')) return 'evidence-sparse';
  return 'evidence-none';
}

export async function render(root){
  root.appendChild(el('div',{class:'page-head'},
    el('h1',{}, 'Method & references'),
    el('p',{class:'lede'}, 'Every number in this tool traces back to here \u2014 the reference ranges, the published slur-marker distributions, the language coverage and its evidence grading, the provisional-range disclosure, and the Praat calibration procedure.')
  ));

  // table of contents
  const toc = el('nav',{class:'method-toc','aria-label':'Method sections'},
    el('a',{href:'#/method#reference'}, 'Reference ranges'),
    el('a',{href:'#/method#sources'}, 'Slur-marker sources'),
    el('a',{href:'#/method#provisional'}, 'Provisional ranges'),
    el('a',{href:'#/method#languages'}, 'Language coverage'),
    el('a',{href:'#/method#tonal'}, 'Tonal languages'),
    el('a',{href:'#/method#rate'}, 'Rate markers (English)'),
    el('a',{href:'#/method#tasks'}, 'Two tasks'),
    el('a',{href:'#/method#calibration'}, 'Praat calibration'),
    el('a',{href:'#/method#standard'}, 'Reference standard')
  );
  toc.querySelectorAll('a').forEach(a => a.addEventListener('click', e => {
    e.preventDefault();
    const id = a.getAttribute('href').split('#').pop();
    const t = document.getElementById(id);
    if(t) t.scrollIntoView({ behavior:'smooth', block:'start' });
  }));
  root.appendChild(toc);

  const wrap = el('div',{class:'method'});
  root.appendChild(wrap);

  /* ---- Reference ranges ---- */
  const refTable = el('table',{},
    el('thead',{}, el('tr',{},
      el('th',{},'Parameter'), el('th',{},'Domain'), el('th',{class:'r'},'Typical range'),
      el('th',{},'Unit'), el('th',{},'Flag direction'), el('th',{},'Provisional'))));
  const refBody = el('tbody',{});
  for(const [n,sp] of Object.entries(REF)){
    refBody.appendChild(el('tr',{},
      el('td',{}, sp.lab),
      el('td',{class:'dim'}, DOMAIN_LABEL[sp.g] || sp.g),
      el('td',{class:'r'}, fmt(sp.lo)+'\u2013'+fmt(sp.hi)),
      el('td',{class:'dim'}, sp.u || '\u2014'),
      el('td',{class:'dim'}, sp.dir==='high'?'higher = more deviant':'lower = more deviant'),
      el('td',{}, sp.prov ? el('span',{class:'prov'}, '\u25e6 provisional') : el('span',{class:'ok'}, 'published'))));
  }
  refTable.appendChild(refBody);
  wrap.appendChild(el('section',{class:'panel', id:'reference'},
    el('h2',{class:'ptitle'}, 'Reference ranges'),
    el('p',{class:'dim', style:'font-size:12.5px'}, 'The interval each parameter is compared against. z is scaled so \u00b12 sits at the edge of the interval. \u25e6 marks a provisional range with no published cutoff.'),
    refTable));

  /* ---- Slur-marker sources ---- */
  const src = el('div',{class:'src-list'});
  SLUR.forEach(mk => {
    src.appendChild(el('p',{},
      el('b',{}, mk.lab), ' \u2014 control ' + mk.ctrl.m + '\u00b1' + mk.ctrl.sd +
      ', impaired ' + mk.dys.m + '\u00b1' + mk.dys.sd +
      (mk.cut ? ', published cut-off ' + mk.cut + ' ' + mk.u : '') +
      (mk.enOnly ? ' [English-derived]' : '') +
      (mk.cal ? ' [needs Praat calibration]' : '') + '. ' + mk.src));
  });
  wrap.appendChild(el('section',{class:'panel', id:'sources'},
    el('h2',{class:'ptitle'}, 'Slur-marker sources'),
    el('p',{class:'dim', style:'font-size:12.5px'}, 'Each marker places the speaker between a published control distribution and a published dysarthric distribution. Likelihood ratios are reported per marker and never multiplied \u2014 the markers are correlated and the reference cohorts are not stroke cohorts.'),
    src));

  /* ---- Provisional disclosure ---- */
  const provList = Object.entries(REF).filter(([,sp]) => sp.prov).map(([,sp]) => sp.lab);
  wrap.appendChild(el('section',{class:'panel', id:'provisional'},
    el('h2',{class:'ptitle'}, 'Provisional ranges'),
    el('p',{}, 'A provisional range has no published cutoff. It is marked \u25e6 everywhere it appears \u2014 on the metric cards, in the deviation table, and here. Replace every provisional range with values measured on your own hardware and your own control speakers before drawing any conclusion.'),
    el('p',{class:'dim'}, 'Currently provisional: ' + provList.join(', ') + '.')));

  /* ---- Language coverage ---- */
  const langTable = el('table',{},
    el('thead',{}, el('tr',{},
      el('th',{},'Language'), el('th',{},'Status'), el('th',{},'Recogniser'),
      el('th',{},'TTS'), el('th',{},'Rhythm'), el('th',{},'Tonal'), el('th',{},'Evidence'))));
  const langBody = el('tbody',{});
  for(const [code,L] of Object.entries(SCRIPTS)){
    langBody.appendChild(el('tr',{},
      el('td',{}, L.name),
      el('td',{}, L.validated ? el('span',{class:'ok'},'validated draft') : el('span',{class:'watch'},'draft')),
      el('td',{class:'dim mono'}, L.asr || (L.mode==='repeat'?'repeat mode':'none')),
      el('td',{class:'dim mono'}, L.tts || 'none'),
      el('td',{class:'dim'}, L.rhythm),
      el('td',{}, L.tonal ? el('span',{class:'watch'},'tonal') : el('span',{class:'ok'},'no')),
      el('td',{class:evidenceClass(L.evidence)+'', style:'font-size:12px'}, L.evidence)));
  }
  langTable.appendChild(langBody);
  wrap.appendChild(el('section',{class:'panel', id:'languages'},
    el('h2',{class:'ptitle'}, 'Language coverage & evidence grading'),
    el('p',{class:'dim', style:'font-size:12.5px'}, 'Nine of the ten reading sentences are drafts pending native-speaker clinical sign-off, and the app keeps saying so. Hokkien has no browser recogniser and no synthetic voice, so its reading task becomes a repetition task and transcript features are unavailable.'),
    langTable));

  /* ---- Tonal explanation ---- */
  const tonalLangs = Object.values(SCRIPTS).filter(L => L.tonal).map(L => L.name);
  wrap.appendChild(el('section',{class:'panel', id:'tonal'},
    el('h2',{class:'ptitle'}, 'Tonal languages'),
    el('p',{}, 'In a tonal language, lexical tone drives the fundamental frequency: the pitch pattern of a word is part of its meaning. \u201cMonopitch\u201d is therefore not interpretable, so the pitch-variation and pitch-range markers are disabled for these languages.'),
    el('p',{class:'dim'}, 'Tonal here: ' + tonalLangs.join(', ') + '. All other acoustic measures still apply.')));

  /* ---- Rate markers (English) ---- */
  wrap.appendChild(el('section',{class:'panel', id:'rate'},
    el('h2',{class:'ptitle'}, 'Speaking-rate & articulation-rate markers'),
    el('p',{}, 'The speaking-rate and articulation-rate markers use English-derived reference distributions. Their direction (slower with dysarthria) is well established for English, but syllable-rate norms do not transfer across rhythm classes \u2014 stress-timed, syllable-timed and mora-timed languages differ systematically. These two markers are therefore greyed out for every language except English.')));

  /* ---- Two tasks ---- */
  wrap.appendChild(el('section',{class:'panel', id:'tasks'},
    el('h2',{class:'ptitle'}, 'Why two tasks are enough \u2014 and what they cost you'),
    el('ol',{style:'font-size:13px;color:var(--dim);padding-left:20px'},
      el('li',{}, 'A fixed reading sentence gives identical phonetic content across sessions, which makes rate, pausing and vowel-space comparable over time.'),
      el('li',{}, 'Vowel space is a convex hull over the running-speech F1\u00d7F2 cloud (Whitfield & Gravelin, JSLHR 2022), validated against token-based vowel-space area as an intelligibility predictor.'),
      el('li',{}, 'Connected-speech voice quality is carried by smoothed cepstral peak prominence, which discriminates pathological from healthy voices in running speech.'),
      el('li',{}, 'Jitter and shimmer are computed only on stable voiced runs with onset/offset ramps trimmed, reported as smoothed quotients (RAP, PPQ5, APQ3, APQ5); they are not comparable to sustained-vowel norms.'),
      el('li',{}, 'What goes away without diadochokinesis: alternating/sequential motion rates and their rhythm irregularity, which separate sequencing (apraxia) from execution (dysarthria). Connected-speech articulation rate and the 2\u20138 Hz envelope modulation peak are partial substitutes, not replacements.'),
      el('li',{}, 'FCR and F2(i)/F2(u) are estimated from percentile corners of the running-speech cloud. On synthetic speech this reproduced the corner-vowel FCR to three decimals (0.889 vs 0.888) and separated a centralised talker at 1.60.'))));

  /* ---- Praat calibration ---- */
  wrap.appendChild(el('section',{class:'panel', id:'calibration'},
    el('h2',{class:'ptitle'}, 'Praat calibration for CPPS'),
    el('p',{}, 'Cepstral peak prominence is implementation-specific, so the published connected-speech cut-off (9.33 dB) only applies once this tool is calibrated against Praat on the same recordings. Until an offset is entered, the CPPS marker stays out of the slur tally.'),
    el('ol',{style:'font-size:13px;color:var(--dim);padding-left:20px'},
      el('li',{}, 'Export the per-task 16 kHz WAV files from the Results screen.'),
      el('li',{}, 'In Praat, open a recording and run the smoothed CPP measurement on the connected-speech sample.'),
      el('li',{}, 'Note the Praat CPPS value and this tool\u2019s CPPS value for the same file.'),
      el('li',{}, 'Compute the offset: (Praat \u2212 this tool), in dB.'),
      el('li',{}, 'Enter that offset on the Results screen. The published cut-off line then becomes usable and CPPS joins the slur tally.')),
    el('p',{class:'dim'}, 'Calibrate against your own control speakers before treating any line as a threshold.')));

  /* ---- Reference standard ---- */
  wrap.appendChild(el('section',{class:'panel', id:'standard'},
    el('h2',{class:'ptitle'}, 'Reference standard for slurring'),
    el('p',{}, 'No published threshold defines \u201cslurred speech\u201d from acoustics alone. The reference standard remains perceptual: the NIH Stroke Scale item 10 scores dysarthria 0 (normal), 1 (slurs at least some words, still understandable with effort) or 2 (unintelligible out of proportion to any dysphasia).'),
    el('p',{class:'dim'}, 'This tool reports measurements and their distance from published reference distributions. It does not output a diagnosis, a probability of stroke, a speech-health verdict, or a confidence score.')));
}

function fmt(v){
  if(!isFinite(v)) return '\u2014';
  return Math.abs(v) >= 10000 ? Math.round(v).toLocaleString() : (Math.abs(v) >= 100 ? String(Math.round(v)) : v.toFixed(2));
}
