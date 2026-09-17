/* ==========================================================================
   SMILE Speech Signal Lab — Google Apps Script Web App receiver.

   This is NOT part of the app. It lives in a Google Sheet:
     Extensions -> Apps Script -> paste this -> Deploy -> New deployment ->
     Web app -> Execute as: Me -> Who has access: Anyone -> copy the /exec URL.

   The app (src/app/sheet.js) POSTs the full session payload here. This script
   appends:
     - one wide row per session to the "sessions" tab
     - one long row per scored parameter to the "parameters" tab (full data
       dictionary: parameter,label,value,unit,task,z,flag,provisional)

   Privacy note: enabling upload in the app means session data leaves the
   device to this Sheet. Keep it opt-in and consented. No field sent is a
   diagnosis, a stroke probability, a health grade or a confidence score.
   ========================================================================== */

// Optional shared secret. Set the SAME string here and in src/app/sheet.js
// SHEET_TOKEN. Leave both empty to disable the check.
var SHARED_TOKEN = '';

var SESSIONS_HEADERS = [
  'receivedAt', 'participant', 'age', 'sex', 'language', 'languageName',
  'timepoint', 'recordedAt', 'analysisRate', 'inputRate', 'script',
  'tool', 'version', 'deviationIndex',
  'domain_pronunciation', 'domain_intonation', 'domain_fluency',
  'domain_voice', 'domain_clarity',
  'transcript_read', 'transcript_free', 'sessionId'
];

var PARAM_HEADERS = [
  'receivedAt', 'sessionId', 'participant', 'timepoint', 'language',
  'recordedAt', 'parameter', 'label', 'value', 'unit', 'task', 'z',
  'flag', 'provisional'
];

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);

    if (SHARED_TOKEN && body.token !== SHARED_TOKEN) {
      return json_({ ok: false, error: 'bad token' });
    }

    var meta = body.meta || {};
    var domains = body.domains || {};
    var tx = body.transcripts || {};
    var flags = body.flags || [];

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var receivedAt = new Date().toISOString();
    var sessionId = (meta.participant || 'session') + '__' + (meta.recordedAt || receivedAt);

    // ---- sessions tab (one wide row) ----
    var sSheet = sheet_(ss, 'sessions', SESSIONS_HEADERS);
    sSheet.appendRow([
      receivedAt, meta.participant || '', meta.age || '', meta.sex || '',
      meta.language || '', meta.languageName || '', meta.timepoint || '',
      meta.recordedAt || '', meta.analysisRate || '', meta.inputRate || '',
      meta.script || '', meta.tool || '', meta.version || '',
      num_(body.deviationIndex),
      score_(domains.pronunciation), score_(domains.intonation),
      score_(domains.fluency), score_(domains.voice), score_(domains.clarity),
      tx.read || '', tx.free || '', sessionId
    ]);

    // ---- parameters tab (one long row per parameter) ----
    var pSheet = sheet_(ss, 'parameters', PARAM_HEADERS);
    var rows = flags.map(function (fl) {
      return [
        receivedAt, sessionId, meta.participant || '', meta.timepoint || '',
        meta.language || '', meta.recordedAt || '',
        fl.parameter || '', fl.label || '', num_(fl.value), fl.unit || '',
        fl.fromTask || '', num_(fl.z), fl.flag || '', fl.provisional ? 1 : 0
      ];
    });
    if (rows.length) {
      pSheet.getRange(pSheet.getLastRow() + 1, 1, rows.length, PARAM_HEADERS.length)
        .setValues(rows);
    }

    return json_({ ok: true, sessionId: sessionId, parameters: rows.length });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function doGet() {
  return json_({ ok: true, message: 'SMILE Sheet receiver is live. POST session JSON here.' });
}

function sheet_(ss, name, headers) {
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(headers);
    sh.setFrozenRows(1);
  }
  return sh;
}

function num_(v) { return (typeof v === 'number' && isFinite(v)) ? v : (v == null ? '' : v); }
function score_(d) { return (d && typeof d.score === 'number') ? d.score : ''; }

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
