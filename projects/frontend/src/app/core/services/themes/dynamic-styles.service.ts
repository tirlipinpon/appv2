import { Injectable, inject, effect } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { ThemesService } from './themes.service';
import { ChildAuthService } from '../../auth/child-auth.service';

@Injectable({
  providedIn: 'root',
})
export class DynamicStylesService {
  private readonly document = inject(DOCUMENT);
  private readonly themesService = inject(ThemesService);
  private readonly authService = inject(ChildAuthService);

  constructor() {
    // Appliquer le thème au démarrage et quand il change
    effect(() => {
      const child = this.authService.getCurrentChild();
      if (child) {
        this.applyTheme(child.child_id);
      }
    });
  }

  /**
   * Applique le thème sélectionné via CSS variables
   */
  async applyTheme(childId: string): Promise<void> {
    try {
      const selectedTheme = await this.themesService.getSelectedTheme(childId);
      if (!selectedTheme) {
        // Utiliser le thème par défaut
        const themes = await this.themesService.getAvailableThemes(null);
        const defaultTheme = themes.find((t) => t.is_default);
        if (defaultTheme) {
          this.applyThemeStyles(defaultTheme.shapes_colors_json);
        }
        return;
      }

      // Récupérer les détails du thème via le service
      const themes = await this.themesService.getAvailableThemes(null);
      const theme = themes.find((t) => t.id === selectedTheme.theme_id);

      if (theme && theme.shapes_colors_json) {
        this.applyThemeStyles(theme.shapes_colors_json);
      }
    } catch (error) {
      console.error('Erreur lors de l\'application du thème:', error);
    }
  }

  /**
   * Applique les styles du thème aux CSS variables
   */
  private applyThemeStyles(shapesColors: Record<string, unknown>): void {
    const root = this.document.documentElement;

    // Appliquer les couleurs
    if (shapesColors['primary_color']) {
      root.style.setProperty('--theme-primary-color', shapesColors['primary_color'] as string);
    }
    if (shapesColors['secondary_color']) {
      root.style.setProperty('--theme-secondary-color', shapesColors['secondary_color'] as string);
    }
    if (shapesColors['accent_color']) {
      root.style.setProperty('--theme-accent-color', shapesColors['accent_color'] as string);
    }
    if (shapesColors['background_color']) {
      root.style.setProperty('--theme-background-color', shapesColors['background_color'] as string);
    }

    // Appliquer les formes (peut être utilisé pour des classes CSS)
    if (shapesColors['shapes']) {
      const shapes = shapesColors['shapes'] as string[];
      root.setAttribute('data-theme-shapes', shapes.join(' '));
    }
  }
}

