import { Injectable, signal } from '@angular/core';

interface SoundConfig {
  description: string;
  file: string | null;
}

interface SoundsConfig {
  sounds: Record<string, SoundConfig>;
}

@Injectable({
  providedIn: 'root',
})
export class SoundService {
  private readonly soundsEnabled = signal<boolean>(true);
  private readonly volume = signal<number>(0.7);
  private audioContext: AudioContext | null = null;
  private soundCache = new Map<string, AudioBuffer>();
  private soundsConfig: SoundsConfig | null = null;
  private configLoaded = false;

  constructor() {
    // Initialiser le contexte audio
    if (typeof AudioContext !== 'undefined' || typeof (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext !== 'undefined') {
      this.audioContext = new (AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    this.loadSoundsConfig();
  }

  /**
   * Charge la configuration des sons depuis le fichier JSON
   */
  private async loadSoundsConfig(): Promise<void> {
    try {
      const response = await fetch('/sounds.config.json');
      if (response.ok) {
        this.soundsConfig = await response.json();
      } else {
        console.warn(`Configuration des sons non trouvée (HTTP ${response.status})`);
      }
    } catch (error) {
      console.warn('Configuration des sons non trouvée, utilisation des sons par défaut: ' , error);
    } finally {
      this.configLoaded = true;
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
  async playSuccessSound(): Promise<void> {
    if (!this.soundsEnabled()) return;
    await this.playSoundByKey('success', () => this.playTone(523.25, 0.1));
  }

  /**
   * Joue un son de feedback (échec)
   */
  async playFailureSound(): Promise<void> {
    if (!this.soundsEnabled()) return;
    await this.playSoundByKey('failure', () => this.playTone(220, 0.2));
  }

  /**
   * Joue un son de déblocage
   */
  async playUnlockSound(): Promise<void> {
    if (!this.soundsEnabled()) return;
    await this.playSoundByKey('unlock', () => this.playToneSequence([523.25, 659.25, 783.99], 0.15));
  }

  /**
   * Joue un son de badge obtenu (méthode générique, utilise le son par défaut)
   */
  async playBadgeSound(): Promise<void> {
    if (!this.soundsEnabled()) return;
    // Son de badge : séquence ascendante plus joyeuse que le déblocage
    await this.playSoundByKey('badge', () => this.playToneSequence([523.25, 659.25, 783.99, 1046.50], 0.12));
  }

  /**
   * Joue un son de snap/placement (pour les puzzles avec magnétisme)
   */
  async playSnapSound(): Promise<void> {
    if (!this.soundsEnabled()) return;
    // Son court et discret pour indiquer qu'une pièce a été aimantée
    await this.playSoundByKey('snap', () => this.playTone(440, 0.08));
  }

  /**
   * Joue un son spécifique selon le type de badge (dynamique)
   * @param badgeType Le type de badge (ex: 'consecutive_game_days', 'daily_activity', etc.)
   * Le système génère automatiquement la clé badge_<badge_type> et utilise le son générique "badge" en fallback
   */
  async playBadgeSoundByType(badgeType: string): Promise<void> {
    if (!this.soundsEnabled()) return;
    
    // Construire dynamiquement la clé du son : badge_<badge_type>
    // Cela fonctionne pour n'importe quel type de badge, même ceux ajoutés plus tard
    const soundKey = `badge_${badgeType}`;
    
    // Son par défaut générique pour tous les badges
    const defaultBadgeSound = () => this.playToneSequence([523.25, 659.25, 783.99, 1046.50], 0.12);
    
    // Essayer dans cet ordre :
    // 1. Son spécifique au badge (badge_<badge_type>)
    // 2. Son générique "badge" 
    // 3. Son par défaut (séquence de notes)
    await this.playSoundByKey(soundKey, async () => {
      // Si le son spécifique n'existe pas, essayer le son générique "badge"
      await this.playSoundByKey('badge', defaultBadgeSound);
    });
  }

  /**
   * Joue un son par sa clé, avec fallback sur le son par défaut
   */
  private async playSoundByKey(key: string, defaultSound: () => void): Promise<void> {
    if (!this.configLoaded) {
      // Si la config n'est pas encore chargée, utiliser le son par défaut
      console.log('playSoundByKey: config not loaded, using default sound');
      defaultSound();
      return;
    }

    const soundConfig = this.soundsConfig?.sounds[key];
    
    // Si un fichier est défini et valide (pas null, pas vide, ne se termine pas par /), l'utiliser
    if (soundConfig?.file && soundConfig.file.trim() !== '' && !soundConfig.file.endsWith('/')) {
      const audioBuffer = await this.loadSound(soundConfig.file);
      if (audioBuffer) {
        this.playSound(audioBuffer);
        return;
      }
    }
    
    // Utiliser le son par défaut
    defaultSound();
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
    // Normaliser l'URL : s'assurer qu'elle commence par / pour les fichiers dans public
    const normalizedUrl = url.startsWith('/') ? url : `/${url}`;
    
    if (this.soundCache.has(normalizedUrl)) {
      return this.soundCache.get(normalizedUrl) || null;
    }

    if (!this.audioContext) return null;

    try {
      // Réactiver le contexte audio si nécessaire (certains navigateurs le suspendent)
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      const response = await fetch(normalizedUrl);
      
      if (!response.ok) {
        console.error(`Erreur HTTP ${response.status} lors du chargement du son: ${normalizedUrl}`);
        return null;
      }

      const contentType = response.headers.get('content-type');
      if (contentType && !contentType.match(/audio\//)) {
        console.warn(`Avertissement: Content-Type inattendu (${contentType}) pour le son: ${normalizedUrl}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      
      if (arrayBuffer.byteLength === 0) {
        console.error(`Le fichier audio est vide: ${normalizedUrl}`);
        return null;
      }

      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      this.soundCache.set(normalizedUrl, audioBuffer);
      return audioBuffer;
    } catch (error) {
      console.error(`Erreur lors du chargement du son ${normalizedUrl}:`, error);
      if (error instanceof Error) {
        console.error(`Détails: ${error.name} - ${error.message}`);
      }
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

