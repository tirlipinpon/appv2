import { inject, Injectable } from '@angular/core';
import { SettingsStore } from '../../store/index';
import { ChildAuthService } from '../../../../core/auth/child-auth.service';
import { SoundService } from '../../../../core/services/sounds/sound.service';
import { ThemesService } from '../../../../core/services/themes/themes.service';
import { DynamicStylesService } from '../../../../core/services/themes/dynamic-styles.service';

@Injectable({
  providedIn: 'root',
})
export class SettingsApplication {
  private readonly store = inject(SettingsStore);
  private readonly authService = inject(ChildAuthService);
  private readonly soundService = inject(SoundService);
  private readonly themesService = inject(ThemesService);
  private readonly dynamicStyles = inject(DynamicStylesService);

  async initialize(): Promise<void> {
    const child = await this.authService.getCurrentChild();
    if (child) {
      await this.store.loadStatistics({ childId: child.child_id });
    }
  }

  // Sons
  toggleSounds(): void {
    const current = this.soundService.areSoundsEnabled();
    this.soundService.setSoundsEnabled(!current);
  }

  setVolume(volume: number): void {
    this.soundService.setVolume(volume);
  }

  areSoundsEnabled(): boolean {
    return this.soundService.areSoundsEnabled();
  }

  getVolume(): number {
    return this.soundService.getVolume();
  }

  // Statistiques
  getStatistics() {
    return this.store.statistics;
  }

  isLoading() {
    return this.store.loading;
  }

  getError() {
    return this.store.error;
  }

  // Thèmes
  async getAvailableThemes() {
    const child = await this.authService.getCurrentChild();
    if (!child) return [];
    return this.themesService.getAvailableThemes(child.school_level);
  }

  async getUnlockedThemes() {
    const child = await this.authService.getCurrentChild();
    if (!child) return [];
    return this.themesService.getUnlockedThemes(child.child_id);
  }

  async selectTheme(themeId: string): Promise<void> {
    const child = await this.authService.getCurrentChild();
    if (!child) return;
    await this.themesService.selectTheme(child.child_id, themeId);
    await this.applyTheme(themeId);
  }

  async applyTheme(themeId: string): Promise<void> {
    const themes = await this.getAvailableThemes();
    const theme = themes.find(t => t.id === themeId);
    if (theme && theme.shapes_colors_json) {
      this.dynamicStyles.applyThemeStyles(theme.shapes_colors_json);
    }
  }
}

