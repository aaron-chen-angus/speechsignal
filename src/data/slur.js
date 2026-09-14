/* ==========================================================================
   Slur markers vs published distributions — ported VERBATIM from the prototype.

   Each marker carries a control distribution and a dysarthric distribution
   taken from published work, so a measured value can be placed between the
   two rather than against an arbitrary cut-off. Nothing here is combined into
   a probability: the markers are correlated and the source cohorts are not
   stroke cohorts.

   Flags:
     firm   — the distribution is well established (vs "indicative")
     enOnly — English-derived reference distribution (rate markers)
     cal    — requires a Praat calibration offset before its cut-off is usable
              (CPPS stays excluded from the slur tally until then)

   The `get` accessors are wired to the app's results store by
   ../app/scoring.js (slurRows), which supplies pickVal / wpmValue. Here the
   accessors are stored as string keys so this module stays pure data.
   ========================================================================== */
export const SLUR = [
 {id:'wpm',lab:'Speaking rate',u:'words/min',dir:'low',firm:1,enOnly:1,
  ctrl:{m:170,sd:20},dys:{m:107,sd:34},
  src:'Typical adult conversational speech runs 150–190 wpm. In a dysarthric sample assessed with the Sentence Intelligibility Test, speaking rate was M = 107 wpm, SD = 34, range 52–171, with intelligibility M = 63%.',
  getKind:'wpm'},
 {id:'artrate',lab:'Articulation rate',u:'syll/s',dir:'low',firm:0,enOnly:1,
  ctrl:{m:5.0,sd:0.6},dys:{m:3.7,sd:0.9},
  src:'Dysarthric speakers produce slower speaking and articulation rates than healthy speakers. English direction is well established; reference distributions here are English-derived. These markers are greyed out for other languages.',
  getKind:'metric', getKey:'articulationRate'},
 {id:'fcr',lab:'Vowel centralisation (FCR)',u:'',dir:'high',firm:0,
  ctrl:{m:0.94,sd:0.07},dys:{m:1.12,sd:0.12},
  src:'The formant centralisation ratio sits near 1.0 for healthy men, women and children, and near 0.90 for clear hyperarticulated speech; it rises with articulatory undershoot and robustly separated dysarthric from healthy speech without gender sensitivity (Sapir et al., 2010). The cross-language direction (higher FCR with lower intelligibility) has published support in English and Tamil; it is unverified for Mandarin and Malay. Even in English, FCR did not cleanly separate healthy from mild dysarthric speakers in at least one multilingual study. Estimated here from percentile corners of the running-speech F1×F2 cloud rather than from isolated /a/ /i/ /u/.',
  getKind:'vowelSpace', getKey:'fcr'},
 {id:'f2r',lab:'F2(i)/F2(u) ratio',u:'',dir:'low',firm:0,
  ctrl:{m:2.60,sd:0.45},dys:{m:1.80,sd:0.40},
  src:'The F2i/F2u ratio differentiated dysarthric from healthy speech as robustly as the FCR and was likewise not gender sensitive (Sapir et al., 2010); it falls as intelligibility falls. Estimated here from running speech.',
  getKind:'vowelSpace', getKey:'f2Ratio'},
 {id:'cpps',lab:'Cepstral peak prominence',u:'dB',dir:'low',firm:1,cut:9.33,cal:1,
  src:'For connected speech, a Praat smoothed-CPP threshold of 9.33 dB classified disordered from healthy voices with ROC AUC .98, accuracy 94.5%, sensitivity 0.95 and specificity 0.90; the sustained-vowel threshold was 14.45 dB (AUC .93). A separate study of dysarthria following stroke reported a CPPs threshold of 5.08 dB with 63.6% sensitivity and 100% specificity on connected speech, using a different algorithm. Because CPPS is implementation-specific, the cut-off line only applies once this tool has been calibrated against Praat on the same recordings.',
  ctrl:{m:11.8,sd:1.9},dys:{m:7.6,sd:2.4},
  getKind:'metric', getKey:'cpps'},
 {id:'pause',lab:'Pause burden',u:'ratio',dir:'high',firm:0,
  ctrl:{m:0.18,sd:0.07},dys:{m:0.38,sd:0.13},
  src:'Between-word pauses per sentence in the TORGO corpus rise from 0.26 in typical speakers to 0.57, 1.21 and 2.51 across increasing dysarthria severity — roughly two to nine times more frequent. Expressed here as the proportion of the sample occupied by pauses.',
  getKind:'metric', getKey:'pauseRatio'}
];
