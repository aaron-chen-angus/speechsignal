/* ==========================================================================
   Optional, opt-in upload of a session to a Google Sheet via a Google Apps
   Script Web App. This is the ONLY runtime network call the app makes besides
   the browser's own SpeechRecognition. It sends nothing unless the user
   clicks the "Send to Google Sheet" button on the Results page.

   The payload is exactly what export.js builds (meta, domains, deviation
   index, transcripts and the long-format flags[] data dictionary), minus the
   bulky referenceRanges/results blocks that a spreadsheet does not need.

   Privacy: enabling this means session data leaves the device. Keep it
   opt-in and consented. No field sent is a diagnosis, a stroke probability,
   a health grade or a confidence score.
   ========================================================================== */
import { buildPayload } from './export.js';
import { markExported } from './state.js';

/* -------------------------------------------------------------------------
   CONFIGURE THESE TWO VALUES.
   1. SHEET_ENDPOINT: paste the /exec URL from your Apps Script Web App deploy.
   2. SHEET_TOKEN: optional shared secret; must match SHARED_TOKEN in the
      Apps Script. Leave '' in both places to disable the check.
   ------------------------------------------------------------------------- */
export const SHEET_ENDPOINT = 'https://script.google.com/macros/s/AKfycbw2etf6oX-uBghFTXAZlxJlaLy0PUdJ7lIMAj8r_YTHweBerelUB539ct5qCdS7JJCZ/exec';
export const SHEET_TOKEN = '';

export function sheetConfigured(){
  return /^https:\/\/script\.google\.com\/.+\/exec$/.test(SHEET_ENDPOINT);
}

/* Trim the payload to what the Sheet stores. Keeps the wire small and avoids
   sending the whole reference table and per-task DSP blocks on every session. */
function sheetPayload(){
  const p = buildPayload();
  return {
    token: SHEET_TOKEN,
    meta: p.meta,
    deviationIndex: p.deviationIndex,
    domains: p.domains,
    transcripts: p.transcripts,
    flags: p.flags
  };
}

/* POST to the Apps Script. Apps Script Web Apps do not return CORS headers
   for a normal fetch, so we send as text/plain (a "simple" request) and read
   the JSON reply. If your deployment blocks the read, switch to no-cors mode
   (see the commented block) — the row is still written, you just can't read
   the confirmation. */
export async function sendToSheet(){
  if(!sheetConfigured()){
    throw new Error('Google Sheet endpoint is not configured. Set SHEET_ENDPOINT in src/app/sheet.js.');
  }
  const res = await fetch(SHEET_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(sheetPayload())
  });
  const out = await res.json();
  if(!out.ok) throw new Error(out.error || 'Sheet rejected the upload.');
  markExported();
  return out;

  /* --- Fallback for deployments that refuse the read (uncomment to use) ---
  await fetch(SHEET_ENDPOINT, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(sheetPayload())
  });
  markExported();
  return { ok: true, opaque: true };
  ------------------------------------------------------------------------- */
}
