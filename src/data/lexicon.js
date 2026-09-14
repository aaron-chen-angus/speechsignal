/* ==========================================================================
   Sentiment lexicon and negation set — ported VERBATIM from the prototype.
   A small, inspectable [valence, arousal] lexicon (English only). Not a model.
   Emotion/sentiment is reported separately and never folded into any
   motor-speech score.
   ========================================================================== */
export const LEX = {
  good:[.8,.4],great:[.9,.6],happy:[.9,.6],love:[.9,.6],enjoy:[.7,.5],fine:[.5,.3],calm:[.6,.1],
  nice:[.7,.4],glad:[.8,.5],hope:[.5,.4],better:[.6,.4],well:[.5,.3],thanks:[.6,.3],easy:[.5,.2],
  bad:[-.7,.5],sad:[-.8,.3],angry:[-.7,.9],upset:[-.7,.7],worried:[-.6,.7],scared:[-.8,.9],afraid:[-.8,.8],
  pain:[-.8,.7],hurt:[-.7,.6],tired:[-.4,.1],exhausted:[-.6,.2],hard:[-.4,.5],difficult:[-.5,.5],
  weak:[-.6,.3],dizzy:[-.6,.6],numb:[-.5,.4],confused:[-.6,.6],lost:[-.6,.5],alone:[-.6,.3],hate:[-.9,.8],
  terrible:[-.9,.7],awful:[-.9,.7],sorry:[-.3,.3],slow:[-.3,.2],stuck:[-.5,.5],frustrated:[-.7,.8],anxious:[-.6,.8],
  panic:[-.8,1],excited:[.7,.9],proud:[.8,.5],grateful:[.8,.4],safe:[.6,.2],help:[.1,.6],hospital:[-.2,.6]
};

export const NEG = new Set(['not',"don't",'no','never','cannot',"can't",'nothing']);
