export const CONSONANTS = ['ㄱ', 'ㄴ', 'ㄷ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅅ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
export const VOWELS     = ['ㅏ', 'ㅑ', 'ㅓ', 'ㅕ', 'ㅗ', 'ㅛ', 'ㅜ', 'ㅠ', 'ㅡ', 'ㅣ'];
export const DIPHTHONGS = ['ㅐ', 'ㅒ', 'ㅔ', 'ㅖ', 'ㅘ', 'ㅙ', 'ㅚ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅢ'];

export const CHAR_LABELS: Record<string, string> = {
  // consonants
  ㄱ: '[ ɡ ] [ k ]', ㄴ: '[ n ]',    ㄷ: '[ t ]',     ㄹ: '[ r ] [ l ]', ㅁ: '[ m ]',
  ㅂ: '[ p ]',       ㅅ: '[ s ]',    ㅇ: '[ ŋ ]',     ㅈ: '[ tʃ ]',      ㅊ: '[ tʃʰ ]',
  ㅋ: '[ kʰ ]',      ㅌ: '[ tʰ ]',   ㅍ: '[ pʰ ]',    ㅎ: '[ h ]',
  // simple vowels
  ㅏ: '[ aː ]',  ㅑ: '[ ja ]',   ㅓ: '[ ɔː ]',  ㅕ: '[ jɔ ]',  ㅗ: '[ oː ]',
  ㅛ: '[ jo ]',  ㅜ: '[ uː ]',   ㅠ: '[ ju ]',  ㅡ: '[ ɯː ]',  ㅣ: '[ iː ]',
  // diphthongs
  ㅐ: '[ ɛː ]',  ㅒ: '[ jɛː ]',  ㅔ: '[ eː ]',  ㅖ: '[ jeː ]', ㅘ: '[ waː ]',
  ㅙ: '[ wɛː ]', ㅚ: '[ weː ]',  ㅝ: '[ wɔː ]', ㅞ: '[ weː ]', ㅟ: '[ wiː ]',
  ㅢ: '[ ɯiː ]',
};

// unique IPA labels for use as distractor pool (ㅚ and ㅞ share [ weː ])
export const ALL_LABELS = [...new Set(Object.values(CHAR_LABELS))];
