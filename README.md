# SMILE Speech Signal Lab

A production, client-side web application for the School of Sports & Health at
Republic Polytechnic. It records a short speech protocol in the browser,
computes motor-speech and prosodic acoustic parameters **entirely on the
device**, and presents the results against published reference distributions.

> **Not a stroke test and not a medical device.** It reports acoustic
> measurements and how far they sit from reference ranges. No threshold here is
> clinically validated. It does not output a diagnosis, a probability of
> stroke, a speech-health verdict, or a confidence score. Sudden face droop,
> arm weakness or new speech difficulty — call 995.

## Running it

No package manager, no build step, no framework. Vanilla ES modules, plain CSS,
static files.

### Served (full features, incl. microphone)
ES modules and the analysis Web Worker require an `http(s)` origin. Serve the
folder with any static server and open `index.html`, for example:

    python -m http.server 8000      # then open http://localhost:8000/

GitHub Pages: copy the whole directory into the Pages source and browse to it.
A `.nojekyll` file is included so the `src/` folder is served as-is.

### From `file://` (degraded)
Opening `index.html` directly works, with the microphone **disabled** (browsers
treat `file://` as a non-secure context). Recording is off; **loading audio
files** per task still works, analysis runs via a `setTimeout` fallback instead
of the Web Worker, and all charts, results, method pages and export function.

## Routes

- **`#/session`** — setup: participant, language (ten options), microphone
  selection and a live level pass/fail, secure-context and permission state,
  and the downstream consequences of the chosen language.
- **`#/record`** — capture and live feedback only. Live waveform, level meter,
  live transcription, task stepper, model playback, per-task quality. No
  results here.
- **`#/results`** — the report: deviation-index ring, six slur-marker
  distributions, domain radar, key metrics, full parameter table, signal views,
  transcript/sentiment/emotion, and export.
- **`#/method`** — reference tables, published sources, provisional-range
  disclosure, language coverage with evidence grading, tonal-language
  explanation, and Praat calibration instructions.

## Privacy

Nothing is written to `localStorage`, `sessionStorage`, `IndexedDB` or any
persistent store. A session lives only in memory and leaves only through
explicit export (JSON + CSV + per-task 16 kHz WAV). The app warns before unload
if recordings are unexported. No network calls at runtime except the browser's
own `SpeechRecognition` service and loading local files from `audio/`.

## Optional model recordings

Drop native-speaker recordings into `audio/` as `<lang>_<task>.mp3` (see
`audio/README.md`). If absent, the "Play model" control falls back to the
browser's speech synthesiser (except Hokkien, which has no synthetic voice).

## The DSP engine

`src/dsp/dsp.js` is the verified DSP engine **ported verbatim** from the
prototype (`reference/smile-speech-lab.html`). The only change is module syntax
(the UMD wrapper became an ES `export`). No algorithm, constant, or line of
computational logic was altered. See `reference/README.md`.

## Tests

A dependency-free suite runs the same specs in Node and the browser against
synthetic signals with known ground truth.

### Node

    node tests/run-node.mjs

Runs `tests/dsp.test.js` (F0, formants, DDK rate/CV, FCR, jitter/shimmer
monotonicity, deviation-index bounds, 30-s timing budget) and `tests/app.test.js`
(gating, slur placement, sentiment, word accuracy). Exits non-zero on any
failure. Requires Node 16+.

### Browser

Serve the folder and open `tests/browser.html`. It runs the Node specs plus
browser-only behavioural tests (route-state persistence, export JSON/CSV/WAV
validity, Hokkien repetition mode, language swapping, unload-warning arming).
The summary is also left on `window.__SMILE_TEST_SUMMARY__`.

## Project layout

    index.html                 app shell (topbar, emergency banner, routed region)
    .nojekyll                  serve src/ as-is on GitHub Pages
    src/
      dsp/dsp.js               verified DSP, ported verbatim
      data/                    scripts, reference ranges, slur markers, lexicon
      app/                     router, state, capture, media, charts, scoring, export
      routes/                  session, record, results, method
      styles/                  tokens, app, routes CSS
    tests/                     synth signals, harness, specs, Node runner, browser page
    audio/                     optional model recordings (empty by default)
    reference/                 the source-of-truth prototype
