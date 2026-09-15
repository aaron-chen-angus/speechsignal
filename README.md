# SMILE Speech Signal Lab

A production, client-side web application for the School of Sports & Health at
Republic Polytechnic. It records a short speech protocol in the browser,
computes motor-speech and prosodic acoustic parameters **entirely on the
device**, and presents the results against published reference distributions.

---

> ## ⚠️ Scope, safety and what this tool is *not*
>
> **This is not a stroke test and not a medical device.** It reports acoustic
> measurements and how far they sit from published reference ranges. No
> threshold in this tool is clinically validated on Singaporean speakers or on
> this specific implementation.
>
> The application **never** outputs a diagnosis, a probability of stroke, a
> "speech-health" grade, or a confidence score. It reports *measurements* and
> their *distance from reference distributions*. Any clinical interpretation is
> made by a qualified human, not by this tool.
>
> **Emergency:** sudden face droop, arm weakness or new speech difficulty is a
> medical emergency — call **995** (Singapore) immediately and do not spend
> time recording. This banner appears on every screen of the app and its
> wording must not be softened without human clinical approval.

---

## Table of contents

1. [What the app does](#1-what-the-app-does)
2. [Scientific basis](#2-scientific-basis)
3. [Clinical basis and the stroke connection](#3-clinical-basis-and-the-stroke-connection)
4. [The six slur markers](#4-the-six-slur-markers-control-vs-impaired-distributions)
5. [Full data dictionary](#5-full-data-dictionary)
6. [How measurements become domain and deviation scores](#6-how-measurements-become-domain-and-deviation-scores)
7. [Language coverage and evidence grading](#7-language-coverage-and-evidence-grading)
8. [The Results page — analytics and how to interpret them](#8-the-results-page--analytics-and-how-to-interpret-them)
9. [Technical manual — architecture and tech stack](#9-technical-manual--architecture-and-tech-stack)
10. [Running and deploying](#10-running-and-deploying)
11. [Data retrieval and analysis](#11-data-retrieval-and-analysis)
12. [References](#12-references)
13. [Limitations and responsible use](#13-limitations-and-responsible-use)

---

## 1. What the app does

The participant completes a short protocol in the browser:

- **T1 — Read aloud** (~14 s): a fixed sentence with controlled phonetic
  content. For Hokkien this becomes **Repeat after examiner** because most
  Singaporean Hokkien speakers do not read written Hokkien.
- **T2 — Free speech** (~32 s): a spontaneous-speech prompt.
- **T3 — Sustained "ah"** (optional, ~6 s): a held vowel for clinic-grade
  jitter, shimmer, harmonics-to-noise ratio and maximum phonation time.

Audio is captured as **raw PCM**, resampled once to **16 kHz**, and analysed by
a digital-signal-processing (DSP) engine that runs locally in the browser. The
results are shown against published reference distributions and can be exported
as JSON, CSV and per-task WAV files. **Nothing is uploaded and nothing is
stored persistently** — a session lives only in memory until you export it.

The interface is split across four screens (routes):

- `#/session` — participant setup, microphone check, language selection.
- `#/record` — capture and live feedback only (no results shown here).
- `#/results` — the full report.
- `#/method` — the reference tables, sources and calibration instructions.

---

## 2. Scientific basis

### 2.1 The clinical target: dysarthria and its acoustic signature

**Dysarthria** is a motor-speech disorder caused by disturbed neuromuscular
control of the speech apparatus (respiration, phonation, resonance,
articulation, prosody). It is a common and often *early* consequence of stroke,
particularly in strokes affecting the corticobulbar tracts, brainstem or
cerebellum. Perceptually it is heard as *slurred*, imprecise, slow, monotone or
strained speech.

The core scientific premise of this tool is that the perceptual impression of
"slurring" has **measurable acoustic correlates**, and that these correlates
can be extracted from ordinary connected speech without specialist equipment.
The measures fall into five interpretable **domains**:

| Domain | What it captures | Physiological basis |
|---|---|---|
| **Pronunciation** | Articulatory precision, vowel-space size | Reduced range/speed of tongue, jaw and lip movement flattens the acoustic vowel space and slows formant transitions ("articulatory undershoot"). |
| **Intonation** | Pitch and loudness variation | Reduced laryngeal and respiratory control produces monopitch and monoloudness. |
| **Fluency** | Rate, pausing, syllabic rhythm | Slowed, effortful or dysrhythmic articulation lowers speaking/articulation rate and increases pausing. |
| **Voice quality** | Phonatory stability | Vocal-fold control problems raise cycle-to-cycle perturbation (jitter, shimmer), lower harmonics-to-noise ratio, and lower cepstral peak prominence. |
| **Clarity** | Overall signal integrity | Voicing continuity and spectral balance degrade with imprecise articulation and breathiness. |

### 2.2 Why two tasks (reading + free speech) instead of a full clinical battery

A classic clinical motor-speech exam includes **diadochokinesis** (DDK, rapid
"pa-ta-ka" repetition) and isolated sustained vowels. This tool deliberately
uses only connected speech for the core protocol, with the sustained vowel as
an *optional* add-on, for defensible reasons:

1. **A fixed reading sentence** provides identical phonetic content across
   sessions, which is what makes rate, pausing and vowel-space measures
   comparable over time within a person.
2. **Vowel space** is measured from running speech as a **convex hull over the
   F1×F2 cloud** rather than from isolated corner vowels. This trajectory-based
   approach was validated against traditional token-based vowel-space area as a
   predictor of intelligibility in dysarthria (Whitfield & Gravelin, *JSLHR*
   2022). On synthetic speech with known formants, the running-speech estimate
   reproduced the corner-vowel formant centralisation ratio to three decimals.
3. **Voice quality** in connected speech is carried by **smoothed cepstral peak
   prominence (CPPS)**, which discriminates pathological from healthy voices in
   connected speech as well as in sustained vowels and is the measure
   recommended for running speech.
4. **Jitter and shimmer** are still computed, but only on stable voiced runs
   with the onset/offset ramps trimmed, and are reported as smoothed quotients
   (RAP, PPQ5, APQ3, APQ5). They are **not** comparable to sustained-vowel
   norms — tick the optional "ah" task for clinic-grade perturbation.

**What genuinely cannot be recovered without DDK:** alternating- and
sequential-motion rates and their rhythm irregularity, which help separate
*sequencing* problems (apraxia of speech) from *execution* problems
(dysarthria). Connected-speech articulation rate and the 2–8 Hz envelope
modulation peak are partial substitutes, not full replacements.

### 2.3 The DSP algorithms and their published definitions

Every measure is computed from first principles using published algorithm
definitions — there is no machine-learning model and no external library:

| Measure family | Algorithm | Source |
|---|---|---|
| F0 (pitch) and HNR | Normalised autocorrelation with octave-error guard and parabolic peak refinement | Boersma (1993) |
| Jitter / shimmer | Glottal-pulse-mark perturbation quotients (local, RAP, PPQ5, APQ3, APQ5) | Titze (1995) / MDVP definitions |
| Cepstral peak prominence (smoothed) | Time- then quefrency-smoothed cepstrum with regression baseline | Hillenbrand (1994); Awan (2010) |
| Formants (F1–F3) | LPC via autocorrelation + Levinson–Durbin, roots by Durand–Kerner | Standard LPC formant tracking |
| Vowel space / FCR | Formant centralisation ratio; trajectory hull over running speech | Sapir et al. (2010); Whitfield & Gravelin (2022) |
| Syllable nuclei / rate | Intensity-peak detection with dip and voicing constraints | de Jong & Wempe (2009) |
| MFCC | 26 mel filters → 13 DCT coefficients | Davis & Mermelstein (1980) |

This engine is *verified against synthetic signals with known ground truth* and
is ported **verbatim** into the app (only the module wrapper changed). See the
test suite in `tests/` and section 9.

---

## 3. Clinical basis and the stroke connection

### 3.1 Slurred speech as a stroke warning sign

Public stroke-recognition campaigns (FAST: **F**ace, **A**rm, **S**peech,
**T**ime) list speech disturbance as one of three cardinal warning signs. In
clinical stroke assessment, dysarthria is scored on the **NIH Stroke Scale
(NIHSS) item 10**:

- **0** — normal
- **1** — mild-to-moderate: slurs at least some words, still understandable with
  effort
- **2** — severe: unintelligible speech out of proportion to any dysphasia

The **reference standard for "slurring" is perceptual** — a trained rater's
judgement — because **no published acoustic threshold defines slurred speech on
its own**. This is the single most important scientific caveat in the tool: it
cannot replace the perceptual standard. What it *can* do is quantify the
acoustic features that tend to accompany that perceptual impression, and show
how far a speaker sits from published control and impaired distributions.

### 3.2 How this leads to a potential stroke marker — and the confounds

The chain of reasoning is:

1. Stroke can damage motor-speech control → **dysarthria**.
2. Dysarthria has measurable **acoustic correlates** (slower rate, reduced
   vowel space, monopitch, raised perturbation, lowered CPPS, more pausing).
3. These correlates can be measured client-side from a short speech sample.
4. Converging deviation across *several* markers is more informative than any
   single marker.

**Critical confounds this tool is explicit about:**

- The published reference distributions were derived from dysarthric speakers of
  **mixed aetiology** (Parkinson's disease, cerebral palsy, ALS, mixed
  neurological), **not** stroke cohorts, on different equipment and analysis
  software. They indicate whether speech *resembles impaired speech* — not its
  cause.
- **Emotion/arousal is confounded with dysarthria at the signal level.** Flat
  pitch, low loudness variation and slow rate are simultaneously the signature
  of low arousal *and* of hypokinetic/flaccid dysarthria. This is why the app
  reports sentiment and emotion **separately** and never folds them into any
  motor-speech score.
- Likelihood ratios are shown **per marker and never multiplied together**,
  because the markers are correlated and the source cohorts are not stroke
  cohorts — multiplying them would grossly overstate certainty.

### 3.3 Intended use

Longitudinal, **within-person** monitoring (e.g. baseline-vs-follow-up in a
rehabilitation or research context) is the strongest use case, because a
person's own baseline beats any population range. The app supports loading a
prior session as a personal baseline for exactly this reason.

---

## 4. The six slur markers (control-vs-impaired distributions)

The Results page places the speaker between a **published control distribution**
and a **published dysarthric distribution** for each of six markers, rather than
against a single threshold. Each is drawn as two overlapping Gaussians with the
speaker's value shown as a needle. All six values, distributions and citations
are held in `src/data/slur.js`.

| Marker | Unit | Control (mean±SD) | Impaired (mean±SD) | Direction | Notes |
|---|---|---|---|---|---|
| **Speaking rate** | words/min | 170 ± 20 | 107 ± 34 | lower = impaired | English-only. Typical conversation 150–190 wpm; dysarthric sample M=107, range 52–171, intelligibility M=63%. |
| **Articulation rate** | syll/s | 5.0 ± 0.6 | 3.7 ± 0.9 | lower = impaired | English-only reference distribution; direction well established, but syllable-rate norms do not transfer across rhythm classes. |
| **Vowel centralisation (FCR)** | ratio | 0.94 ± 0.07 | 1.12 ± 0.12 | higher = impaired | Sapir et al. (2010). Near 1.0 in healthy speakers, ~0.90 in clear/hyperarticulated speech; rises with articulatory undershoot. |
| **F2(i)/F2(u) ratio** | ratio | 2.60 ± 0.45 | 1.80 ± 0.40 | lower = impaired | Sapir et al. (2010). Falls as intelligibility falls; estimated from running speech. |
| **Cepstral peak prominence** | dB | 11.8 ± 1.9 | 7.6 ± 2.4 | lower = impaired | Published connected-speech cut-off 9.33 dB (AUC .98). **CPPS is implementation-specific — see calibration below.** |
| **Pause burden** | ratio | 0.18 ± 0.07 | 0.38 ± 0.13 | higher = impaired | TORGO corpus: between-word pauses rise ~2–9× with severity; expressed as proportion of the sample occupied by pauses. |

**Per-marker likelihood ratio (LR)** — for each marker the app computes the
ratio of the Gaussian density under the impaired distribution to that under the
control distribution at the speaker's value. LR > 1 means the value is more
consistent with impaired speech; LR < 1 more consistent with control. **LRs are
displayed per marker and never combined into a single number.**

**Separation d′** — for each marker, `d′ = |mean_control − mean_impaired| /
sqrt((SD_control² + SD_impaired²)/2)`, a standardised measure of how far apart
the two published distributions are. Higher d′ = the marker separates the two
groups more cleanly.

**CPPS calibration gate.** Because CPPS values depend on the exact algorithm,
the CPPS marker is **excluded from the slur tally until you enter a Praat
calibration offset**. Measure the same recordings in Praat, compute
`offset = (Praat CPPS − this tool's CPPS)`, and enter it on the Results page.
Only then does the published 9.33 dB cut-off become usable.

---

## 5. Full data dictionary

Every parameter the app computes, its unit, published reference interval, the
direction that indicates impairment, the scoring domain, which task supplies it,
and its basis. Reference intervals are defined verbatim in
`src/data/reference.js`. **"Provisional" (◦)** means there is no published
cut-off and the range must be replaced with values measured on your own hardware
and control speakers before drawing conclusions.

### 5.1 Fluency domain

| Parameter | Key | Unit | Typical range | Impaired dir. | Prov. | Basis |
|---|---|---|---|---|:---:|---|
| Articulation rate | `articulationRate` | syll/s | 4.0 – 6.2 | low | | Syllable nuclei ÷ phonation time (excludes pauses). de Jong & Wempe (2009). Slowed in most dysarthrias. |
| Speech rate | `speechRate` | syll/s | 3.0 – 5.5 | low | | Syllable nuclei ÷ total speaking time (includes pauses). |
| Pause ratio | `pauseRatio` | — | 0.05 – 0.32 | high | | Fraction of the speaking window occupied by silent pauses (>150 ms). Rises with effortful/dysrhythmic speech. |
| Mean pause | `pauseMean` | s | 0.15 – 0.60 | high | | Mean silent-pause duration. |
| Syllabic rhythm peak | `modulation.peakHz` | Hz | 3.0 – 6.5 | low | | Peak of the amplitude-envelope modulation spectrum (2–8 Hz band = syllabic rhythm). Flattens/slows in dysarthria. |

### 5.2 Pronunciation domain

| Parameter | Key | Unit | Typical range | Impaired dir. | Prov. | Basis |
|---|---|---|---|---|:---:|---|
| Vowel space (hull) | `vowelSpace.hullArea` | Hz² | 250,000 – 800,000 | low | ◦ | Convex-hull area over the running-speech F1×F2 cloud. Shrinks with articulatory undershoot. Whitfield & Gravelin (2022). |
| Articulatory working area | `vowelSpace.workingArea` | Hz² | 200,000 – 900,000 | low | ◦ | 2-SD covariance-ellipse area of the F1×F2 cloud (robust "working" vowel space). |
| F2 excursion | `vowelSpace.f2Range` | Hz | 800 – 1900 | low | ◦ | 5th–95th percentile F2 spread; reduced tongue front–back range lowers it. |
| F1 excursion | `vowelSpace.f1Range` | Hz | 250 – 700 | low | ◦ | 5th–95th percentile F1 spread; reduced jaw/tongue-height range lowers it. |
| F2 transition speed | `f2.f2SlopeP80` | Hz/s | 450 – 1700 | low | ◦ | 80th-percentile |dF2/dt| within voiced runs. Flatter transitions accompany reduced intelligibility. |
| Formant centralisation ratio | `vowelSpace.fcr` | ratio | 0.80 – 1.02 | high | | `(F2u+F2a+F1i+F1u)/(F2i+F1a)` from percentile corners of the running-speech cloud. Sapir et al. (2010). |
| F2(i)/F2(u) | `vowelSpace.f2Ratio` | ratio | 1.9 – 3.4 | low | | Front-vowel vs back-vowel F2 contrast; falls with centralisation. Sapir et al. (2010). |

### 5.3 Intonation domain

| Parameter | Key | Unit | Typical range | Impaired dir. | Prov. | Basis |
|---|---|---|---|---|:---:|---|
| Pitch variation | `f0SdSemitones` | semitones | 1.8 – 5.5 | low | | SD of F0 in semitones. Reduced = monopitch. **Disabled for tonal languages.** |
| Pitch range | `f0RangeSemitones` | semitones | 6 – 20 | low | | 5th–95th percentile F0 span in semitones. **Disabled for tonal languages.** |
| Loudness variation | `intensitySd` | dB | 3.0 – 11 | low | | SD of the intensity contour over the loud (speech) portion. Reduced = monoloudness. |

### 5.4 Voice-quality domain

| Parameter | Key | Unit | Typical range | Impaired dir. | Prov. | Basis |
|---|---|---|---|---|:---:|---|
| Cepstral peak prominence | `cpps` | dB | 6.0 – 14 | low | | Smoothed CPP over connected speech. Lower = more dysphonic/breathy. Awan (2010). |
| Harmonics-to-noise | `hnrMean` | dB | 8 – 20 | low | | Mean HNR from the normalised autocorrelation peak. Lower = noisier phonation. Boersma (1993). |
| Jitter RAP (connected) | `perturbation.jitterRap` | % | 0.08 – 0.70 | high | ◦ | 3-point relative average perturbation of period, on trimmed stable voiced runs. |
| Shimmer APQ5 (connected) | `perturbation.shimmerApq5` | % | 0.8 – 4.5 | high | ◦ | 5-point amplitude perturbation quotient, on trimmed stable voiced runs. |

### 5.5 Clarity domain

| Parameter | Key | Unit | Typical range | Impaired dir. | Prov. | Basis |
|---|---|---|---|---|:---:|---|
| Voicing continuity | `voicedFraction` | — | 0.42 – 0.82 | low | | Fraction of frames voiced. Broken/interrupted voicing lowers it. |
| Phonation ratio | `phonationRatio` | — | 0.60 – 0.95 | low | | Phonation time ÷ speaking time. |
| Spectral tilt | `spectral.tiltDbPerKhz` | dB/kHz | −16 – −7 | low (more negative) | | Regression slope of the 0–5 kHz spectrum. Steeper (more negative) with breathiness/reduced high-frequency energy. |
| Spectral centroid | `spectral.centroid` | Hz | 450 – 1400 | low | ◦ | Energy-weighted mean frequency; shifts with articulatory precision. |

### 5.6 Optional sustained-vowel measures (task T3 only)

These use *sustained-vowel* norms and are **not** comparable to the
connected-speech perturbation measures above.

| Parameter | Key | Unit | Typical range | Impaired dir. | Basis |
|---|---|---|---|---|---|
| Jitter local (vowel) | `jitterLocal` | % | 0.10 – 1.04 | high | Cycle-to-cycle period perturbation on the held vowel. |
| Shimmer local (vowel) | `shimmerLocal` | % | 0.8 – 3.81 | high | Cycle-to-cycle amplitude perturbation on the held vowel. |
| HNR (vowel) | `hnrMean` | dB | 15 – 32 | low | Harmonics-to-noise on the steady vowel. |
| CPPS (vowel) | `cpps` | dB | 9 – 20 | low | Sustained-vowel cepstral peak prominence (published cut-off ~14.45 dB). |
| Maximum phonation time | `phonationTimeS` | s | 12 – 40 | low | Longest steady voiced run; respiratory/phonatory support. |

### 5.7 Additional computed features (exported, not scored against ranges)

The DSP engine also computes and exports **MFCCs** (13 coefficients, mean+SD),
additional spectral descriptors (spread, 85% roll-off, flux, flatness),
modulation-band energies (0.2–2, 2–8, 8–20 Hz), voice-break counts, and per-task
pitch/intensity contours. These appear in the exported JSON for downstream
analysis even though they are not each assigned a reference range in the UI.

---

## 6. How measurements become domain and deviation scores

All scoring logic lives in `src/app/scoring.js`. It is deterministic and
inspectable — there is no model.

### 6.1 Per-parameter z-score

For each parameter with a value `v` and reference interval `[lo, hi]`:

```
mid  = (lo + hi) / 2
half = (hi - lo) / 2
z    = (v - mid) / (half / 2)
```

This scales z so that **±2 sits on the edge of the reference interval**. A
signed "badness" is then formed by orienting z in the impaired direction
(`bad = z` if higher is worse, `bad = -z` if lower is worse). Flags:

- `bad > 3` → **outside range** (out)
- `bad > 2` → **borderline** (watch)
- otherwise → **within range** (ok)

**With a personal baseline loaded**, z is instead computed as a proportional
change from the baseline value (`(v − baseline)/(0.15·|baseline|)`), so the
comparison becomes within-person.

### 6.2 Domain scores (radar)

Each of the five domains averages the positive "badness" of its parameters and
maps it to a 0–100 score: `score = clamp(100 − meanBad·22, 0, 100)`. Higher =
closer to typical.

### 6.3 Overall deviation index (headline ring)

The deviation index summarises the **worst** parameters (the top ~40%, minimum
3) rather than the average, so a few strongly deviant parameters are not diluted
by many normal ones: `index = min(100, mean(topBad)·22)`. Interpretation bands:

- **< 25** — within reference ranges
- **25–49** — borderline; some parameters outside
- **≥ 50** — multiple parameters outside range

The deviation index is a **distance measure, not a probability or a grade.**

### 6.4 Gating rules (must not change)

- **Tonal languages** (Mandarin, Cantonese, Thai, Burmese, Hokkien): the two
  pitch markers (`f0SdSemitones`, `f0RangeSemitones`) are removed, because
  lexical tone drives F0 and "monopitch" is not interpretable.
- **English-only rate markers**: Speaking rate and Articulation rate slur
  markers are greyed out for non-English languages, because their reference
  distributions are English-derived.
- **CPPS** stays out of the slur tally until a Praat offset is entered.

---

## 7. Language coverage and evidence grading

Ten languages are supported. Each carries a reading sentence, a free-speech
prompt, romanisation where the script is non-Latin, a phonetic rationale, a
recogniser locale, a text-to-speech locale, a rhythm class, a tonal flag, a
validation flag and an evidence grade (all in `src/data/scripts.js`).

**Nine of the ten reading sentences are drafts pending native-speaker clinical
sign-off**, and the app displays this warning on both the Session and Record
screens. Do not alter the sentences without that sign-off.

| Language | Recogniser | TTS | Rhythm | Tonal | Status | Evidence | Papers to base on / further testing needed |
|---|---|---|---|---|---|---|---|
| **English** | en-SG | en-GB | stress-timed | no | validated draft | **strong** | TORGO, UA-Speech corpora; most published norms derive from English. Rate markers valid here only. |
| **Mandarin 华语** | zh-CN | zh-CN | syllable-timed | yes | draft | moderate | MSDM post-stroke dysarthria corpus; tone production affected. FCR direction *unverified* for Mandarin — needs local validation. |
| **Malay** | ms-MY | ms-MY | syllable-timed | no | draft | **sparse** | No published dysarthria norms located. All reference distributions are borrowed; requires primary validation. |
| **Tamil** | ta-IN | ta-IN | syllable-timed | no | draft | good | SSNCE dysarthric corpus, used in cross-lingual severity work. FCR direction has published support. |
| **Cantonese 粵語** | yue-Hant-HK | zh-HK | syllable-timed | yes | draft | good | Cantonese Parkinsonian dysarthria studies report restricted pitch range and smaller tonal space; six-tone system makes tone production itself a marker. Pitch markers gated. |
| **Japanese 日本語** | ja-JP | ja-JP | mora-timed | no | draft | moderate | AMSD (Assessment of Motor Speech for Dysarthria) established clinically. **Mora timing means syllable-rate norms do not transfer** — rate markers gated. |
| **Korean 한국어** | ko-KR | ko-KR | syllable-timed | no | draft | **strong** | QoLT dysarthric corpus with pathologist intelligibility ratings; used in published cross-lingual severity classification. |
| **Thai ภาษาไทย** | th-TH | th-TH | syllable-timed | yes | draft | sparse | Five-tone system; some tone-production work in other disorders, no dysarthria norms located. Pitch markers gated; needs primary validation. |
| **Burmese မြန်မာ** | my-MM | my-MM | syllable-timed | yes | draft | **none located** | No dysarthria acoustic norms, no dysarthric corpus, recogniser support uncertain. Acoustic measures still valid; all reference distributions borrowed. |
| **Hokkien 福建話** | *(none)* | *(none)* | syllable-timed | yes | draft | **none located** | **No browser recogniser and no synthetic voice.** Reading task becomes **repetition** (examiner reads each clause, participant repeats). Transcript, word accuracy and text sentiment unavailable; acoustic measures only. Tâi-lô romanisation needs native verification. |

**Behaviour that follows from the table:**

- **Hokkien** has no recogniser and no synthetic voice → transcript, word
  accuracy and text sentiment are unavailable, and the reading task is a
  repetition task with a changed heading.
- **Tonal languages** (Mandarin, Cantonese, Thai, Burmese, Hokkien): pitch-
  variation and pitch-range markers disabled.
- **Speaking-rate and articulation-rate markers** are English-only.
- **Unvalidated languages** display the sign-off warning on both Session and
  Record screens.

**Practical grading for deployment planning:**

- *Ready for pilot with local calibration:* English, Korean.
- *Usable but validate the FCR/rate direction locally:* Tamil, Cantonese,
  Japanese, Mandarin.
- *Requires primary normative work before interpretation:* Malay, Thai,
  Burmese, Hokkien.

---

## 8. The Results page — analytics and how to interpret them

The Results page is ordered as a narrative, most interpretable first. Every
number links back to the Method page where its basis is given.

1. **Headline — deviation-index ring.** A 0–100 ring (see §6.3) with a
   plain-language interpretation, the reference mode (population ranges vs
   personal baseline), the count of flagged parameters, and a session-identity
   strip (participant, language, date, task durations). *Interpret as: how far,
   overall, this sample sits from typical — not a probability of anything.*

2. **Slur markers.** Six distribution plots, each showing the published control
   Gaussian (green) and impaired Gaussian (rose), with the speaker's value as a
   white needle. Read each one as: *which distribution does this speaker's value
   sit closer to?* The badge says "resembles control / in the overlap /
   resembles impaired". The per-marker likelihood ratio and separation d′ are
   shown beneath. *Interpret the panel as a whole:* converging deviation across
   several markers is the signal; a single marker is not. The CPPS marker shows
   "needs calibration" until you enter a Praat offset, and the two rate markers
   show "English norms only" for other languages.

3. **Domain profile — five-axis radar.** Pronunciation, Intonation, Fluency,
   Voice quality, Clarity, each 0–100, with a one-sentence explanation of what
   drove each domain. *Interpret as: which aspect of speech is most affected.*

4. **Key metrics — six cards.** Articulation rate (with an approximate
   words/min), pause ratio, pitch variation, vowel space, voice clarity (CPPS),
   voicing continuity — each colour-coded and labelled within/borderline/outside.

5. **Parameter deviation table.** The full parameter set, tabbed by domain, with
   z-scaled deviation bars and provisional-range markers (◦). The z bar shows
   direction and magnitude; ±2 is the edge of the reference interval.

6. **Signal views.** Waveform, spectrogram (0–8 kHz) and pitch/intensity contour,
   with a task selector, for visual inspection of the recording itself.

7. **Transcript, sentiment and emotion.** Visually separated from the motor-
   speech score, with the confound caveat intact. Text valence/arousal come from
   a small inspectable lexicon (English only); acoustic arousal is a composite
   proxy. **These are never folded into the motor-speech score.**

8. **Export and baseline.** Export JSON + CSV + per-task WAV; load a prior
   session as a personal baseline.

**Colour never carries meaning alone** — every flag state has a text label
beside its colour (within range / borderline / outside range).

---

## 9. Technical manual — architecture and tech stack

### 9.1 Tech stack

- **No framework, no build step, no package manager, no runtime dependency.**
- **Vanilla ES modules** (`<script type="module">`), **plain CSS**, static files.
- **Web Audio API** for capture (`getUserMedia` + `ScriptProcessor`), **Web
  Workers** for off-thread analysis, **Canvas 2D** for all charts, **Web Speech
  API** (`SpeechRecognition`, `speechSynthesis`) for optional transcription and
  model playback.
- **Hash-based routing** via the `hashchange` event (works from `file://` and
  GitHub Pages alike).
- Target browsers: current Chrome, Edge, Safari (desktop), iOS Safari, Android
  Chrome. Degrades gracefully where an API is missing.

### 9.2 Capture pipeline (behaviour that must not change)

- `getUserMedia` is **always** called with `echoCancellation:false`,
  `noiseSuppression:false`, `autoGainControl:false`. These browser defaults
  destroy shimmer, intensity variation and HNR.
- Audio is captured as **raw PCM** via a `ScriptProcessor` — **never** through
  `MediaRecorder`/Opus, which would lossily re-encode.
- Audio is resampled **once** to 16 kHz (2nd-order Butterworth anti-alias
  low-pass before decimation); the original input sample rate is recorded in the
  export metadata.
- Analysis runs in a **Web Worker**, with a `setTimeout` fallback for `file://`
  and browsers without module workers, so the UI thread is never blocked.

### 9.3 Privacy and data handling

- **No network calls at runtime** except the browser's own `SpeechRecognition`
  service and loading local files from `audio/`. No CDN, no web fonts, no
  analytics, no telemetry.
- **Nothing is written to** `localStorage`, `sessionStorage`, `IndexedDB` or any
  persistent store. A session lives only in memory and leaves only through
  explicit export. The app warns before unload if recordings are unexported.

### 9.4 Project layout

```
index.html                 app shell (topbar, emergency banner, routed region)
.nojekyll                  serve src/ as-is on GitHub Pages
src/
  dsp/dsp.js               verified DSP engine, ported verbatim from the prototype
  data/
    scripts.js             SCRIPTS (10 languages) + TASKS
    reference.js           REF reference ranges + DOMAINS
    slur.js                SLUR six-marker distributions + citations
    lexicon.js             sentiment lexicon (English) + negation set
  app/
    main.js                entry point; registers routes; runtime detection
    router.js              hash router, focus management, ARIA live announcements
    state.js               in-memory session state (singleton) + FS=16000
    capture.js             mic init (3 flags off), PCM record, resample, worker, WAV
    media.js               model playback (file→TTS) + live SpeechRecognition
    analysis.worker.js     module Web Worker running the DSP
    charts.js              canvas charts (waveform, spectrogram, pitch, radar, ring, slur)
    scoring.js             rows, z-scores, domain scores, deviation index, slur placement
    export.js              JSON + CSV + WAV export; contour stripping
    ui.js                  DOM helper, number formatter, toast
  routes/
    session.js  record.js  results.js  method.js
  styles/
    tokens.css  app.css  routes.css
tests/                     synthetic signals, harness, DSP + app + browser specs
audio/                     optional native-speaker model recordings (empty by default)
reference/                 the source-of-truth prototype + notes
```

### 9.5 The DSP port and its verification

`src/dsp/dsp.js` is the verified DSP engine **ported verbatim** from the
prototype (`reference/smile-speech-lab.html`); the *only* change is module
syntax (UMD wrapper → ES `export`). No algorithm, constant or line of
computational logic was altered.

The test suite (`tests/`) runs the same specs in Node and the browser against
synthetic signals with known ground truth. Regression thresholds (all currently
passing, 20/20):

| Test | Expected |
|---|---|
| Synthesised vowel, F0 = 120 Hz | 120 ± 1 Hz, SD < 1 Hz |
| Formants 730 / 1090 / 2440 Hz | each within 1% |
| DDK 6.00 syll/s, 3% jitter | rate 6.00 ± 0.15, CV within 1.5 pts |
| DDK 3.20 syll/s, 22% jitter | rate 3.2 ± 0.2, CV 13 ± 2 |
| Connected jitter 0.5% vs 2.4% | monotonic increase |
| Connected shimmer APQ5 4% vs 12% | monotonic increase |
| Healthy-like passage | deviation index < 25 |
| Impaired-like passage | deviation index high, multiple markers impaired |
| 30 s full analysis | under 4 s |

Plus behavioural tests: route-state persistence, export validity (JSON/CSV/WAV),
tonal + English-only gating, Hokkien repetition mode, unload-warning arming.

**Running the tests:**

- **Node:** `node tests/run-node.mjs` (requires Node 16+; exits non-zero on
  failure).
- **Browser:** serve the folder and open `tests/browser.html`; the summary is
  also left on `window.__SMILE_TEST_SUMMARY__`.

---

## 10. Running and deploying

### 10.1 The one thing that matters: secure context for the microphone

The microphone only works in a **secure context** — `https://` or
`http://localhost`. Opening `index.html` directly as `file://` loads the app
fully but **disables recording** (browsers block the mic on `file://`); you can
still analyse **uploaded audio files** there, and all charts/results/export work.

### 10.2 GitHub Pages (recommended — gives you https)

Deploy the **entire folder's contents**:

1. Create a GitHub repo (public repos get free Pages).
2. Upload everything — `index.html`, `.nojekyll`, `src/`, `audio/`,
   `reference/`, `tests/`, `README.md`.
3. Repo **Settings → Pages → Source: Deploy from a branch**, branch `main`,
   folder `/ (root)`, Save.
4. Open the `https://<user>.github.io/<repo>/` URL. The mic works because it is
   https.

Keep `.nojekyll` — it stops GitHub stripping the `src/` folder. `reference/` and
`tests/` are harmless to publish but not needed by end users; you may omit them.

**When you change the app, redeploy only the files that changed.** `index.html`
rarely changes — it only loads `src/app/main.js`, and everything else is
imported from `src/`. The file you edit is the file you redeploy; when in doubt,
re-upload the whole `src/` folder. After pushing, hard-refresh (Ctrl+F5) so the
browser doesn't serve a cached module.

### 10.3 Local https-equivalent (localhost)

Serving the folder over `http://localhost` gives a secure context, so the mic
works without publishing anything. Use any static server available to you and
open the served URL.

### 10.4 Optional model recordings

Drop native-speaker recordings into `audio/` as `<lang>_<task>.mp3`
(e.g. `en_read.mp3`, `zh_free.mp3`). If a file is absent the "Play instructions"
control falls back to the browser's speech synthesiser at the language's TTS
locale (except Hokkien, which has no synthetic voice). Playback counts per task
are recorded and exported, because hearing a model immediately before recording
causes **rate entrainment** — play the model during familiarisation, not
immediately before recording.

---

## 11. Data retrieval and analysis

Data leaves the device **only** through the **Export** button on the Results
page. There is no server and no database. Export produces, per session:

### 11.1 The JSON file (`<participant>_<timestamp>.json`)

The primary record. Structure:

```jsonc
{
  "meta": {
    "participant": "RP-014",
    "age": "68", "sex": "m",
    "language": "en", "languageName": "English",
    "timepoint": "baseline",
    "recordedAt": "2026-01-31T09:15:00.000Z",
    "analysisRate": 16000,           // Hz — always 16 kHz
    "inputRate": 48000,              // Hz — the hardware capture rate
    "script": "The park is far ...", // the exact sentence shown
    "modelPlaybacks": { "read": 1 }, // how many times the model was played per task
    "tool": "SMILE Speech Signal Lab", "version": "2.1"
  },
  "results": { "read": { /* every DSP measure for T1 */ }, "free": { ... } },
  "transcripts": { "read": "...", "free": "..." },
  "deviationIndex": 31,
  "domains": { "pronunciation": { "score": 78, "flag": "ok" }, ... },
  "referenceRanges": { /* the REF table used, for provenance */ },
  "flags": [
    { "parameter": "articulationRate", "label": "Articulation rate",
      "value": 3.1, "unit": "syll/s", "fromTask": "read",
      "z": 2.4, "flag": "watch", "provisional": false },
    ...
  ]
}
```

Notes for analysis:
- Bulky per-frame contour arrays are stripped from the JSON (they are only used
  for on-screen charts). All scalar measures remain.
- `flags[]` is the analysis-ready long-format record: one row per parameter with
  its value, unit, source task, z-score and flag.
- The `results` block additionally contains features not shown in the UI
  (MFCCs, extra spectral descriptors, modulation-band energies) for downstream
  modelling.

### 11.2 The CSV file (`<participant>_<timestamp>.csv`)

A flat, spreadsheet-friendly long-format table with columns:

```
parameter, label, value, unit, task, z, flag, provisional
```

One row per scored parameter. This is the easiest starting point for
aggregating many sessions: concatenate the CSVs, add the participant/timepoint
from the filename or a joined copy of `meta`, and pivot on `parameter`.

### 11.3 The WAV files (`<participant>_<timestamp>_<task>.wav`)

Per-task **16 kHz mono 16-bit PCM** WAV files (one for `read`, `free`, and
`vowel` if recorded). These are the exact signals the DSP analysed. Use them to:
- Re-analyse in Praat (and to compute the CPPS calibration offset).
- Archive the raw material for a research dataset.
- Perceptually rate the speech (e.g. NIHSS item 10) as a reference standard.

### 11.4 Suggested analysis workflow

1. Collect the exported JSON/CSV/WAV per session into a per-participant folder.
2. Build a longitudinal table keyed on `participant` + `timepoint`, pivoting the
   CSV `parameter`→`value` (and `z`).
3. For each participant, prefer **within-person change** over population ranges:
   load the well-state session as the baseline in the app, or compute deltas
   offline.
4. Calibrate CPPS in Praat once per recording setup and record the offset with
   the dataset.
5. Keep the WAVs so a clinician can provide perceptual (NIHSS-10) labels for any
   future validation study.

*(A future release can add a small offline script to merge many exports into a
single tidy table; the exports already contain everything needed for that.)*

---

## 12. References

The reference distributions, cut-offs and methods are drawn from the following
published work (as embedded in `src/data/slur.js`, `src/data/reference.js` and
the DSP source). Citations are given in short form; consult the original papers
for full detail.

**Motor-speech / dysarthria acoustics**
- Sapir, S., Ramig, L. O., Spielman, J. L., & Fox, C. (2010). Formant
  Centralization Ratio: A proposal for a new acoustic measure of dysarthric
  speech. *Journal of Speech, Language, and Hearing Research.*
- Whitfield, J. A., & Gravelin, A. C. (2022). Vowel-space measures from
  connected speech / trajectory-based vowel space as a predictor of
  intelligibility in dysarthria. *Journal of Speech, Language, and Hearing
  Research.*
- Awan, S. N., and colleagues (2010). Cepstral/spectral analysis of connected
  speech (smoothed CPP; connected-speech cut-off ~9.33 dB; sustained-vowel
  cut-off ~14.45 dB).
- NIH Stroke Scale, item 10 (Dysarthria): 0 normal / 1 mild-to-moderate / 2
  severe — the perceptual reference standard for slurring.
- TORGO dysarthric speech database (pausing and severity data).
- Reports of dysarthric speaking rate (~107 wpm, SD 34) with Sentence
  Intelligibility Test.

**DSP algorithm definitions**
- Boersma, P. (1993). Accurate short-term analysis of the fundamental frequency
  and the harmonics-to-noise ratio of a sampled sound. *Proc. Institute of
  Phonetic Sciences.*
- Titze, I. R. (1995). Workshop on Acoustic Voice Analysis: Summary Statement
  (jitter/shimmer/MDVP definitions).
- Hillenbrand, J., et al. (1994). Cepstral peak prominence.
- de Jong, N. H., & Wempe, T. (2009). Praat script to detect syllable nuclei and
  measure speech rate automatically. *Behavior Research Methods.*
- Davis, S. B., & Mermelstein, P. (1980). Comparison of parametric
  representations for monosyllabic word recognition (MFCC). *IEEE TASSP.*

**Cross-lingual dysarthria corpora referenced for language coverage**
- SSNCE Tamil dysarthric corpus.
- QoLT Korean dysarthric corpus with pathologist intelligibility ratings.
- MSDM Mandarin post-stroke dysarthria corpus.
- AMSD — Assessment of Motor Speech for Dysarthria (Japanese clinical standard).
- Cantonese Parkinsonian dysarthria studies (restricted pitch range / tonal
  space).

> **Note on the evidence base document.** The build brief referenced an
> `assessment.md` evidence-base document that was **not** supplied with the
> project. The clinical and reference content in this README and in the app's
> Method page is therefore drawn from the citations, evidence gradings and
> reference tables **already embedded in the verified prototype**. No numbers
> have been invented. If the assessment document is later added to `reference/`,
> reconcile this section and the Method page against it.

---

## 13. Limitations and responsible use

- **Not diagnostic.** No output is a diagnosis, a stroke probability, a
  speech-health grade, or a confidence score.
- **Reference distributions are borrowed**, from mixed-aetiology dysarthria
  cohorts on different equipment — not stroke cohorts, not Singaporean speakers,
  not this implementation. Provisional ranges (◦) have no published cut-off at
  all.
- **Calibrate before you interpret.** Replace provisional ranges with values
  from your own hardware and control speakers, and calibrate CPPS against Praat.
- **Emotion and dysarthria are confounded** at the signal level; sentiment and
  emotion are reported separately and never folded into the motor-speech score.
- **Nine of ten language scripts are unvalidated drafts** pending native-speaker
  clinical sign-off; Malay, Thai, Burmese and Hokkien additionally lack local
  normative data.
- **The perceptual standard prevails.** Slurring is defined perceptually
  (NIHSS-10); this tool quantifies accompanying acoustic features, it does not
  replace clinical judgement.
- **In a real emergency, do not record — call 995.**
