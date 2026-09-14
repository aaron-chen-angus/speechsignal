/* ==========================================================================
   Export: JSON, CSV, and per-task 16 kHz WAV. Ported from the prototype.
   All audio and all results stay on the device; export is the only way a
   session leaves memory. Model playback counts are included. Bulky contour
   arrays are stripped from the JSON. No exported field is a diagnosis, a
   stroke probability, a health grade, or a confidence score.
   ========================================================================== */
import { state, markExported } from './state.js';
import { SCRIPTS } from '../data/scripts.js';
import { REF } from '../data/reference.js';
import { rowsAll, domainScores, overall } from './scoring.js';
import { wav } from './capture.js';

function dl(blob, name){
  const u = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = u; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(u), 5000);
}

/* drop bulky contours/hull/cloud from the JSON */
function strip(o){
  return JSON.parse(JSON.stringify(o, (k,v) =>
    (k==='contours' || k==='hull' || k==='cloud') ? undefined : v));
}

export function buildPayload(){
  const meta = {
    participant: state.meta.participant, age: state.meta.age, sex: state.meta.sex,
    language: state.lang, languageName: SCRIPTS[state.lang].name, timepoint: state.meta.timepoint,
    recordedAt: new Date().toISOString(), analysisRate: 16000, inputRate: state.inputRate,
    script: SCRIPTS[state.lang].read.line, modelPlaybacks: state.played,
    tool: 'SMILE Speech Signal Lab', version: '2.1'
  };
  const rows = rowsAll(state.res, state.lang, state.baseline);
  return {
    meta,
    results: strip(state.res),
    transcripts: state.tx,
    deviationIndex: overall(rows),
    domains: domainScores(rows),
    referenceRanges: REF,
    flags: rows.map(r => ({
      parameter: r.n, label: r.sp.lab, value: r.v, unit: r.sp.u,
      fromTask: r.task, z: r.z, flag: r.flag, provisional: !!r.sp.prov
    }))
  };
}

export function exportAll(){
  const payload = buildPayload();
  const meta = payload.meta;
  const stem = ((meta.participant || 'session').replace(/[^\w-]/g,'_')) + '_' +
    meta.recordedAt.slice(0,19).replace(/[:T]/g,'-');

  // JSON
  dl(new Blob([JSON.stringify(payload, null, 2)], { type:'application/json' }), stem + '.json');

  // CSV
  const rows = rowsAll(state.res, state.lang, state.baseline);
  const csv = [['parameter','label','value','unit','task','z','flag','provisional']]
    .concat(rows.map(r => [r.n, r.sp.lab, r.v, r.sp.u, r.task, r.z.toFixed(3), r.flag, r.sp.prov?1:0]));
  dl(new Blob([csv.map(r => r.join(',')).join('\n')], { type:'text/csv' }), stem + '.csv');

  // WAVs (per task, 16 kHz)
  Object.entries(state.audio).forEach(([id,a]) => dl(wav(a.pcm, a.fs), stem + '_' + id + '.wav'));

  markExported();
  return stem;
}

/* export just the JSON (used by tests / programmatic callers) */
export function exportJSON(){
  const payload = buildPayload();
  const stem = ((payload.meta.participant || 'session').replace(/[^\w-]/g,'_')) + '_' +
    payload.meta.recordedAt.slice(0,19).replace(/[:T]/g,'-');
  dl(new Blob([JSON.stringify(payload, null, 2)], { type:'application/json' }), stem + '.json');
  markExported();
}
