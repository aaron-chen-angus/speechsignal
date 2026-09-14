/* ==========================================================================
   Multilingual protocol table — ported VERBATIM from the prototype.
   Ten languages, each carrying a reading sentence, a free-speech prompt,
   romanisation where the script is non-Latin, a phonetic rationale, a
   recogniser locale (asr), a TTS locale (tts), a rhythm class, a tonal flag,
   a validation flag and an evidence grading.

   DO NOT ALTER THE SENTENCES. Nine of the ten are drafts pending
   native-speaker clinical sign-off, and the app must keep saying so.
   ========================================================================== */
export const SCRIPTS = {
  en:{
    name:'English', asr:'en-SG', tts:'en-GB', validated:true, tonal:false, rhythm:'stress-timed', evidence:'strong — TORGO, UA-Speech, most published norms',
    read:{line:'The park is far from the blue school, but Peter needs to see his mother at three.',
          gloss:'Loads the corner vowels /a/ /i/ /u/, the stops p·t·k, the fricatives f·s·th and the liquids l·r.'},
    free:{line:'Tell me what you did this morning, from waking up until now.',
          gloss:'Speak for about thirty seconds.'}
  },
  zh:{
    name:'Mandarin 华语', asr:'zh-CN', tts:'zh-CN', validated:false, tonal:true, rhythm:'syllable-timed', evidence:'moderate — MSDM post-stroke dysarthria corpus; tone production affected',
    read:{line:'妈妈今天去书店，买了三本新书，弟弟在家喝了一大杯苦茶。',
          roman:'Māma jīntiān qù shūdiàn, mǎi le sān běn xīn shū, dìdi zài jiā hē le yí dà bēi kǔ chá.',
          gloss:'All four tones. /a/ 妈·大·茶, /i/ 弟·今·新, /u/ 书·苦 (note 去 qù is the front rounded /y/, not /u/); bilabials 妈·买·本·杯, alveolars 店·弟·大, velar 苦, sibilants 书·三·新.'},
    free:{line:'请说说你今天早上做了什么，从起床到现在。',
          roman:'Qǐng shuōshuo nǐ jīntiān zǎoshang zuò le shénme, cóng qǐchuáng dào xiànzài.',
          gloss:'请说大约三十秒。'}
  },
  ms:{
    name:'Bahasa Melayu', asr:'ms-MY', tts:'ms-MY', validated:false, tonal:false, rhythm:'syllable-timed', evidence:'sparse — no published dysarthria norms located',
    read:{line:'Bapa saya membeli tiga buah buku biru di kedai berhampiran pokok besar itu.',
          gloss:'“My father bought three blue books at the shop near that big tree.” Vokal /a/ bapa·saya·besar, /i/ membeli·tiga·di, /u/ buku·biru·itu; bibir b·p·m, gigi t·d·s, lelangit k·g.'},
    free:{line:'Ceritakan apa yang anda lakukan pagi ini, dari bangun tidur hingga sekarang.',
          gloss:'Bercakap selama kira-kira tiga puluh saat.'}
  },
  ta:{
    name:'தமிழ் Tamil', asr:'ta-IN', tts:'ta-IN', validated:false, tonal:false, rhythm:'syllable-timed', evidence:'good — SSNCE dysarthric corpus, used in cross-lingual severity work',
    read:{line:'அப்பா காலையில் கடைக்குச் சென்று இரண்டு புதிய புத்தகங்களை வாங்கினார்.',
          roman:'Appā kālaiyil kaṭaikkuc ceṉṟu iraṇṭu putiya puttakaṅkaḷai vāṅkiṉār.',
          gloss:'“Father went to the shop in the morning and bought two new books.” /a/ அப்பா·காலை·வாங், /i/ இரண்டு·கடை, /u/ புதிய·புத்தகம்; bilabial ப·ம, retroflex ட·ண·ள, velar க·ங, and the mid vowel in சென்று.'},
    free:{line:'இன்று காலை நீங்கள் என்ன செய்தீர்கள் என்பதைச் சொல்லுங்கள் — நீங்கள் எழுந்ததில் இருந்து இப்போது வரை.',
          roman:'Iṉṟu kālai nīṅkaḷ eṉṉa ceytīrkaḷ eṉpataic colluṅkaḷ — nīṅkaḷ eḻuntatil iruntu ippōtu varai.',
          gloss:'சுமார் முப்பது வினாடிகள் பேசுங்கள்.'}
  },
  yue:{
    name:'Cantonese 粵語', asr:'yue-Hant-HK', tts:'zh-HK', validated:false, tonal:true, rhythm:'syllable-timed',
    evidence:'good — Cantonese Parkinsonian dysarthria studies report restricted pitch range and a smaller tonal space; six-tone system makes tone production itself a marker',
    read:{line:'我知阿媽今日去書店買咗三本新書，細佬喺屋企飲咗一大杯苦茶。',
          roman:'Ngo5 zi1 aa3 maa1 gam1 jat6 heoi3 syu1 dim3 maai5 zo2 saam1 bun2 san1 syu1, sai3 lou2 hai2 uk1 kei2 jam2 zo2 jat1 daai6 bui1 fu2 caa4.',
          gloss:'All six lexical tones. /aː/ 媽·大·茶, /iː/ 知, /uː/ 苦·屋; bilabials 媽·買·本·杯, alveolars 店·大, velars today·企.'},
    free:{line:'講吓你今朝做咗啲乜嘢，由起身到而家。',
          roman:'Gong2 haa5 nei5 gam1 ziu1 zou6 zo2 di1 mat1 je5, jau4 hei2 san1 dou3 ji4 gaa1.',
          gloss:'講大約三十秒。'}
  },
  ja:{
    name:'Japanese 日本語', asr:'ja-JP', tts:'ja-JP', validated:false, tonal:false, rhythm:'mora-timed',
    evidence:'moderate — Japanese motor speech assessment (AMSD) is established clinically; mora timing means syllable-rate norms do not transfer from English',
    read:{line:'母は今朝、本屋で新しい本を三冊買い、弟は家で苦いお茶を一杯飲む。',
          roman:'Haha wa kesa, hon\'ya de atarashii hon o san-satsu kai, otōto wa ie de nigai ocha o ippai nomu.',
          gloss:'/a/ 母·茶, /i/ 新しい·家, /u/ 三冊·飲む; bilabials 母·本, alveolars 茶·作, velars 今朝·買. Pitch accent, not lexical tone.'},
    free:{line:'今朝起きてから今までに何をしたか、話してください。',
          roman:'Kesa okite kara ima made ni nani o shita ka, hanashite kudasai.',
          gloss:'三十秒ほどお話しください。'}
  },
  ko:{
    name:'Korean 한국어', asr:'ko-KR', tts:'ko-KR', validated:false, tonal:false, rhythm:'syllable-timed',
    evidence:'strong — QoLT dysarthric corpus with pathologist intelligibility ratings; used in published cross-lingual severity classification',
    read:{line:'어머니는 오늘 아침 서점에서 새 책 두 권을 샀고, 동생은 집에서 쓴 차 한 잔을 마셨다.',
          roman:'Eomeonineun oneul achim seojeom-eseo sae chaek du gwon-eul satgo, dongsaeng-eun jib-eseo sseun cha han jan-eul masyeotda.',
          gloss:'/a/ 아침·차, /i/ 집·마셨, /u/ 두·쓴; bilabials 어머니·본, alveolars 두·다, velars 권·고.'},
    free:{line:'오늘 아침에 일어나서 지금까지 무엇을 했는지 말씀해 주세요.',
          roman:'Oneul achim-e ireonaseo jigeumkkaji mueos-eul haenneunji malsseumhae juseyo.',
          gloss:'삼십 초 정도 말씀해 주세요.'}
  },
  th:{
    name:'Thai ภาษาไทย', asr:'th-TH', tts:'th-TH', validated:false, tonal:true, rhythm:'syllable-timed',
    evidence:'sparse — five-tone system, some published tone-production work in other disorders, no dysarthria norms located',
    read:{line:'แม่ไปร้านหนังสือเมื่อเช้านี้ ซื้อหนังสือใหม่สามเล่ม น้องชายดื่มชาขมหนึ่งแก้วที่บ้านกับคุณพ่อ',
          roman:'Mae pai ran nangsue muea chao ni, sue nangsue mai sam lem, nong chai duem cha khom nueng kaeo thi ban kap khun pho.',
          gloss:'“Mother went to the bookshop this morning and bought three new books; younger brother drank a cup of bitter tea at home with father.” /aː/ แม่·ชา·บ้าน, /iː/ นี้·ที่, /uː/ คุณ. Spans the five tones.'},
    free:{line:'ช่วยเล่าให้ฟังหน่อยว่าเช้านี้คุณทำอะไรบ้าง ตั้งแต่ตื่นนอนจนถึงตอนนี้',
          roman:'Chuai lao hai fang noi wa chao ni khun tham arai bang, tangtae tuen non chon thueng ton ni.',
          gloss:'พูดประมาณสามสิบวินาที'}
  },
  my:{
    name:'Burmese မြန်မာ', asr:'my-MM', tts:'my-MM', validated:false, tonal:true, rhythm:'syllable-timed',
    evidence:'none located — no dysarthria acoustic norms, no dysarthric speech corpus, browser recogniser support uncertain. Acoustic measures still valid; all reference distributions are borrowed.',
    read:{line:'အမေဟာ ဒီမနက် စာအုပ်ဆိုင်ကို သွားပြီး စာအုပ်အသစ် သုံးအုပ် ဝယ်ခဲ့တယ်။ ညီလေးက အိမ်မှာ လက်ဖက်ရည် တစ်ခွက် သောက်တယ်။',
          roman:'A-me ha di ma-net sa-ouq-hsain-go thwa-byi sa-ouq a-thiq thoun-ouq we-ge-de. Nyi-le ka ein-hma la-hpeq-ye ta-khweq thauq-te.',
          gloss:'“Mother went to the bookshop this morning and bought three new books. Younger brother drank a cup of tea at home.” Draft only — orthography and register must be checked by a native-speaking clinician before use.'},
    free:{line:'ဒီမနက် အိပ်ရာထကတည်းက အခုအချိန်ထိ ဘာတွေလုပ်ခဲ့လဲ ပြောပြပါ။',
          roman:'Di ma-net eiq-ya hta-ga-de-ga a-khu a-chein hti ba-dwe louq-khe-le pyaw-pya-ba.',
          gloss:'အချိန် သုံးဆယ်စက္ကန့်ခန့် ပြောပါ။'}
  },
  nan:{
    name:'Hokkien 福建話', asr:null, tts:null, mode:'repeat', validated:false, tonal:true, rhythm:'syllable-timed',
    evidence:'none located — no dysarthria norms, no standard reading orthography for Singaporean speakers, and no browser recogniser. Use repetition rather than reading, and expect acoustic measures only.',
    read:{line:'阿母今仔日去書店買三本新書，小弟佇厝內啉一大杯苦茶。',
          roman:'A-bú kin-á-ji̍t khì su-tiàm bé saⁿ pún sin-su, sió-tī tī tshù-lāi lim tsi̍t tuā pue khóo-tê.',
          gloss:'REPETITION TASK — the examiner reads this aloud one clause at a time and the participant repeats. Most Singaporean Hokkien speakers do not read Hokkien, so a reading task would measure literacy, not speech motor control. Romanisation is Tâi-lô and needs native verification.'},
    free:{line:'講看覓，你今仔早起到這馬做啥物代誌？',
          roman:'Kóng khuànn-māi, lí kin-á-tsá-khí kàu tsit-má tsò siánn-mih tāi-tsì?',
          gloss:'請講大約三十秒。'}
  }
};

/* Protocol tasks — ported verbatim. */
export const TASKS = [
  {id:'read', tag:'T1', name:'Read aloud', dur:14,
   why:'Fixed phonetic content: articulation rate, pausing, vowel space, voice quality, all comparable session to session.'},
  {id:'free', tag:'T2', name:'Free speech', dur:32,
   why:'Spontaneous prosody, language content, sentiment and emotion.'},
  {id:'vowel', tag:'T3', name:'Sustained “ah”', dur:7, optional:true,
   line:'aaaaaaaaaaaaaa', gloss:'Take a comfortable breath and hold “ah” steadily until you run out of air.',
   why:'Clinic-grade jitter, shimmer, HNR and maximum phonation time.'}
];
