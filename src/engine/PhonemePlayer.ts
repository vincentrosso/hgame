export class PhonemePlayer {
  private voice: SpeechSynthesisVoice | null = null;

  constructor() {
    this.initVoice();
  }

  private initVoice() {
    const voices = window.speechSynthesis.getVoices();
    this.voice = voices.find(v => v.lang === 'ko-KR') || null;
    
    if (!this.voice) {
      window.speechSynthesis.onvoiceschanged = () => {
        const updatedVoices = window.speechSynthesis.getVoices();
        this.voice = updatedVoices.find(v => v.lang === 'ko-KR') || null;
      };
    }
  }

  play(character: string) {
    if (!('speechSynthesis' in window)) return;

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(character);
    utterance.lang = 'ko-KR';
    if (this.voice) {
      utterance.voice = this.voice;
    }
    utterance.rate = 0.8; // Slightly slower for clarity
    window.speechSynthesis.speak(utterance);
  }
}
