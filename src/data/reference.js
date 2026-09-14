/* ==========================================================================
   Reference ranges and domain taxonomy — ported VERBATIM from the prototype.

   REF: each parameter's preferred task order (p), label, unit, published
   reference interval (lo/hi), the deviation direction (dir), the scoring
   domain (g), an optional nested key (k), and flags:
     prov     — provisional range, no published cutoff
     nonTonal — disabled for tonal languages (lexical tone drives F0)
     enOnly   — English-only reference distribution (rate markers)
   ========================================================================== */
export const REF = {
  articulationRate:{p:['read','free'],lab:'Articulation rate',u:'syll/s',lo:4.0,hi:6.2,dir:'low',g:'fluency'},
  speechRate:      {p:['read','free'],lab:'Speech rate',u:'syll/s',lo:3.0,hi:5.5,dir:'low',g:'fluency'},
  pauseRatio:      {p:['read','free'],lab:'Pause ratio',u:'',lo:0.05,hi:0.32,dir:'high',g:'fluency'},
  pauseMean:       {p:['read','free'],lab:'Mean pause',u:'s',lo:0.15,hi:0.60,dir:'high',g:'fluency'},
  modPeak:         {p:['read','free'],lab:'Syllabic rhythm peak',u:'Hz',lo:3.0,hi:6.5,dir:'low',g:'fluency',k:'modulation.peakHz'},
  hullArea:        {p:['read','free'],lab:'Vowel space (hull)',u:'Hz²',lo:250000,hi:800000,dir:'low',g:'pronunciation',k:'vowelSpace.hullArea',prov:1},
  workingArea:     {p:['read','free'],lab:'Articulatory working area',u:'Hz²',lo:200000,hi:900000,dir:'low',g:'pronunciation',k:'vowelSpace.workingArea',prov:1},
  f2Range:         {p:['read','free'],lab:'F2 excursion',u:'Hz',lo:800,hi:1900,dir:'low',g:'pronunciation',k:'vowelSpace.f2Range',prov:1},
  f1Range:         {p:['read','free'],lab:'F1 excursion',u:'Hz',lo:250,hi:700,dir:'low',g:'pronunciation',k:'vowelSpace.f1Range',prov:1},
  f2Slope:         {p:['read','free'],lab:'F2 transition speed',u:'Hz/s',lo:450,hi:1700,dir:'low',g:'pronunciation',k:'f2.f2SlopeP80',prov:1},
  fcr:             {p:['read','free'],lab:'Formant centralisation ratio',u:'',lo:0.80,hi:1.02,dir:'high',g:'pronunciation',k:'vowelSpace.fcr'},
  f2Ratio:         {p:['read','free'],lab:'F2(i)/F2(u)',u:'',lo:1.9,hi:3.4,dir:'low',g:'pronunciation',k:'vowelSpace.f2Ratio'},
  f0SdSemitones:   {p:['free','read'],lab:'Pitch variation',u:'st',lo:1.8,hi:5.5,dir:'low',g:'intonation',nonTonal:1},
  f0RangeSemitones:{p:['free','read'],lab:'Pitch range',u:'st',lo:6,hi:20,dir:'low',g:'intonation',nonTonal:1},
  intensitySd:     {p:['free','read'],lab:'Loudness variation',u:'dB',lo:3.0,hi:11,dir:'low',g:'intonation'},
  cpps:            {p:['read','free'],lab:'Cepstral peak prominence',u:'dB',lo:6.0,hi:14,dir:'low',g:'voice'},
  hnrMean:         {p:['read','free'],lab:'Harmonics-to-noise',u:'dB',lo:8,hi:20,dir:'low',g:'voice'},
  jitterRap:       {p:['read','free'],lab:'Jitter RAP (connected)',u:'%',lo:0.08,hi:0.70,dir:'high',g:'voice',k:'perturbation.jitterRap',prov:1},
  shimmerApq5:     {p:['read','free'],lab:'Shimmer APQ5 (connected)',u:'%',lo:0.8,hi:4.5,dir:'high',g:'voice',k:'perturbation.shimmerApq5',prov:1},
  voicedFraction:  {p:['read','free'],lab:'Voicing continuity',u:'',lo:0.42,hi:0.82,dir:'low',g:'clarity'},
  phonationRatio:  {p:['read','free'],lab:'Phonation ratio',u:'',lo:0.60,hi:0.95,dir:'low',g:'clarity'},
  tilt:            {p:['read','free'],lab:'Spectral tilt',u:'dB/kHz',lo:-16,hi:-7,dir:'low',g:'clarity',k:'spectral.tiltDbPerKhz'},
  centroid:        {p:['read','free'],lab:'Spectral centroid',u:'Hz',lo:450,hi:1400,dir:'low',g:'clarity',k:'spectral.centroid',prov:1},
  /* optional sustained vowel */
  vJitter:         {p:['vowel'],lab:'Jitter local (vowel)',u:'%',lo:0.10,hi:1.04,dir:'high',g:'voice',k:'jitterLocal'},
  vShimmer:        {p:['vowel'],lab:'Shimmer local (vowel)',u:'%',lo:0.8,hi:3.81,dir:'high',g:'voice',k:'shimmerLocal'},
  vHnr:            {p:['vowel'],lab:'HNR (vowel)',u:'dB',lo:15,hi:32,dir:'low',g:'voice',k:'hnrMean'},
  vCpps:           {p:['vowel'],lab:'CPPS (vowel)',u:'dB',lo:9,hi:20,dir:'low',g:'voice',k:'cpps'},
  vMpt:            {p:['vowel'],lab:'Maximum phonation time',u:'s',lo:12,hi:40,dir:'low',g:'voice',k:'phonationTimeS'}
};

export const DOMAINS = [
  ['pronunciation','Pronunciation'],
  ['intonation','Intonation'],
  ['fluency','Fluency'],
  ['voice','Voice quality'],
  ['clarity','Clarity']
];
