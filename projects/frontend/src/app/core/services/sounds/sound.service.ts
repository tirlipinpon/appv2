import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class SoundService {
  private readonly soundsEnabled = signal<boolean>(true);
  private readonly volume = signal<number>(0.7);
  private audioContext: AudioContext | null = null;
  private soundCache: Map<string, AudioBuffer> = new Map();

  constructor() {
    // Initialiser le contexte audio
    if (typeof AudioContext !== 'undefined' || typeof (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext !== 'undefined') {
      this.audioContext = new (AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
  }

  /**
   * Active ou désactive les sons
   */
  setSoundsEnabled(enabled: boolean): void {
    this.soundsEnabled.set(enabled);
    localStorage.setItem('sounds_enabled', String(enabled));
  }

  /**
   * Vérifie si les sons sont activés
   */
  areSoundsEnabled(): boolean {
    return this.soundsEnabled();
  }

  /**
   * Définit le volume
   */
  setVolume(volume: number): void {
    const clampedVolume = Math.max(0, Math.min(1, volume));
    this.volume.set(clampedVolume);
    localStorage.setItem('sounds_volume', String(clampedVolume));
  }

  /**
   * Récupère le volume actuel
   */
  getVolume(): number {
    return this.volume();
  }

  /**
   * Joue un son de feedback (succès)
   */
  playSuccessSound(): void {
    if (!this.soundsEnabled()) return;
    this.playTone(523.25, 0.1); // Note Do
  }

  /**
   * Joue un son de feedback (échec)
   */
  playFailureSound(): void {
    if (!this.soundsEnabled()) return;
    this.playTone(220, 0.2); // Note La plus grave
  }

  /**
   * Joue un son de déblocage
   */
  playUnlockSound(): void {
    if (!this.soundsEnabled()) return;
    // Séquence de notes ascendantes
    this.playToneSequence([523.25, 659.25, 783.99], 0.15);
  }

  /**
   * Joue un ton simple
   */
  private playTone(frequency: number, duration: number): void {
    if (!this.audioContext) return;

    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    oscillator.frequency.value = frequency;
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(this.volume(), this.audioContext.currentTime + 0.01);
    gainNode.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + duration);

    oscillator.start(this.audioContext.currentTime);
    oscillator.stop(this.audioContext.currentTime + duration);
  }

  /**
   * Joue une séquence de tons
   */
  private playToneSequence(frequencies: number[], duration: number): void {
    frequencies.forEach((freq, index) => {
      setTimeout(() => {
        this.playTone(freq, duration);
      }, index * duration * 1000);
    });
  }

  /**
   * Charge un son depuis une URL
   */
  async loadSound(url: string): Promise<AudioBuffer | null> {
    if (this.soundCache.has(url)) {
      return this.soundCache.get(url) || null;
    }

    if (!this.audioContext) return null;

    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      this.soundCache.set(url, audioBuffer);
      return audioBuffer;
    } catch (error) {
      console.error('Erreur lors du chargement du son:', error);
      return null;
    }
  }

  /**
   * Joue un son chargé
   */
  playSound(audioBuffer: AudioBuffer): void {
    if (!this.soundsEnabled() || !this.audioContext) return;

    const source = this.audioContext.createBufferSource();
    const gainNode = this.audioContext.createGain();

    source.buffer = audioBuffer;
    source.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    gainNode.gain.value = this.volume();

    source.start(0);
  }
}

