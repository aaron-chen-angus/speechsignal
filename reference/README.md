# reference/ — source of truth

This directory holds the two documents that define correctness for
**SMILE Speech Signal Lab**.

## smile-speech-lab.html
The working single-file prototype. Its DSP engine (the first `<script>`
block) is verified against synthetic signals with known ground truth and is
ported **verbatim** into `../src/dsp/dsp.js` — the only change is module
syntax (UMD wrapper → ES `export`). Its protocol design, reference tables,
slur-marker definitions, scoring logic, language data and safety copy are all
correct and are preserved. Only its information architecture and visual
presentation are replaced by the production app.

> The prototype was supplied inline with the build brief. The full original
> markup lives beside this README as `smile-speech-lab.html`.

## assessment.md
The evidence base — parameter taxonomy, multilingual strategy, validation
plan and regulatory position.

> **Not present in this build.** `slurred-speech-app-assessment.md` was
> referenced in the brief but was not attached to the workspace. The
> production app's `/method` route is therefore populated from the citations,
> evidence gradings and reference tables that are **already embedded in the
> prototype** (the slur-marker `src` strings, the per-language `evidence`
> fields, the footnotes, and the `REF` reference-range table). No evidence or
> numbers have been invented. If `assessment.md` is later added here, the
> `/method` route content should be reconciled against it.
