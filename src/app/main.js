/* ==========================================================================
   Entry point. Detects the runtime context (secure context, file://, mic API),
   registers the four routes, and starts the router.
   ========================================================================== */
import { state } from './state.js';
import { register, start } from './router.js';
import * as session from '../routes/session.js';
import * as record from '../routes/record.js';
import * as results from '../routes/results.js';
import * as method from '../routes/method.js';

/* runtime context detection */
state.secureContext = window.isSecureContext;
state.fileMode = location.protocol === 'file:';
// A microphone is only usable in a secure context with the mediaDevices API.
// file:// pages are non-secure in every target browser, so recording is
// disabled there and only file upload works.
if(state.fileMode || !state.secureContext || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){
  state.fileMode = state.fileMode || !state.secureContext || !navigator.mediaDevices;
}

register('session', session);
register('record', record);
register('results', results);
register('method', method);

start(document.getElementById('main'), document.getElementById('live'));
