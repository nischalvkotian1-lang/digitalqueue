class AudioManager {
  private audioCtx: AudioContext | null = null;
  private isVoiceEnabled: boolean = true;
  private isChimeEnabled: boolean = true;
  private volume: number = 0.8;

  constructor() {
    // AudioContext will be initialized upon user gesture
  }

  public init() {
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  public setVoiceEnabled(enabled: boolean) {
    this.isVoiceEnabled = enabled;
  }

  public setChimeEnabled(enabled: boolean) {
    this.isChimeEnabled = enabled;
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
  }

  public getSettings() {
    return {
      voice: this.isVoiceEnabled,
      chime: this.isChimeEnabled,
      volume: this.volume,
      isInitialized: !!this.audioCtx && this.audioCtx.state === 'running'
    };
  }

  // Play pleasant, crisp, hospital-grade chime (tri-tone harmonic: C5 -> E5 -> G5)
  public playChime(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.isChimeEnabled) return resolve();
      try {
        this.init();
        if (!this.audioCtx) return resolve();

        const ctx = this.audioCtx;
        const now = ctx.currentTime;
        const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
        const duration = 0.25;

        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + (idx * 0.18));

          // Soft bell attack & exponential decay
          gain.gain.setValueAtTime(0.0001, now + (idx * 0.18));
          gain.gain.exponentialRampToValueAtTime(0.3 * this.volume, now + (idx * 0.18) + 0.04);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + (idx * 0.18) + duration + 0.3);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(now + (idx * 0.18));
          osc.stop(now + (idx * 0.18) + duration + 0.35);
        });

        setTimeout(resolve, 800);
      } catch (err) {
        console.warn('Audio chime playback failed:', err);
        resolve();
      }
    });
  }

  // Speak announcement using SpeechSynthesis
  public speak(text: string): Promise<void> {
    return new Promise((resolve) => {
      if (!this.isVoiceEnabled || !('speechSynthesis' in window)) {
        return resolve();
      }

      try {
        // Cancel any pending speech
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.volume = this.volume;
        utterance.rate = 0.95; // slightly slower for clear public hall acoustics
        utterance.pitch = 1.0;

        // Try to pick a natural English voice if available
        const voices = window.speechSynthesis.getVoices();
        const preferredVoice = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha')));
        if (preferredVoice) {
          utterance.voice = preferredVoice;
        }

        utterance.onend = () => resolve();
        utterance.onerror = () => resolve();

        window.speechSynthesis.speak(utterance);
      } catch (err) {
        console.warn('Speech synthesis error:', err);
        resolve();
      }
    });
  }

  // Announce Token Call (Chime first, then spoken direction)
  public async announceCall(tokenNumber: string, counterLabel: string, stationType?: string) {
    await this.playChime();
    
    // Spell out letters with spaces so speech engine speaks clearly (e.g. "G E N 1 0 1")
    const parts = tokenNumber.split('-');
    let spokenToken = tokenNumber;
    if (parts.length === 2) {
      const letters = parts[0].split('').join(' ');
      spokenToken = `Token ${letters}, ${parts[1]}`;
    } else {
      spokenToken = `Token ${tokenNumber}`;
    }

    const message = `${spokenToken}. Please proceed to ${counterLabel}.`;
    await this.speak(message);
  }
}

export const audioService = new AudioManager();
