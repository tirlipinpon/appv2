import { Component, inject, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
import { SettingsApplication } from './components/application/application';
import { ChildAuthService } from '../../core/auth/child-auth.service';
import { Theme } from '../../core/types/game.types';
import { SupabaseService } from '../../core/services/supabase/supabase.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  template: `
    <div class="settings-container">
      <h1>Paramètres</h1>

      <!-- Section Sons -->
      <section class="settings-section">
        <h2>🔊 Sons</h2>
        <div class="setting-item">
          <div class="setting-label">
            <span>Activer les sons</span>
            <p class="setting-description">Active ou désactive les sons de l'application</p>
          </div>
          <label class="toggle-switch">
            <input
              type="checkbox"
              [checked]="application.areSoundsEnabled()"
              (change)="toggleSounds()">
            <span class="slider"></span>
          </label>
        </div>
        @if (application.areSoundsEnabled()) {
          <div class="setting-item">
          <div class="setting-label">
            <span>Volume</span>
            <p class="setting-description">Ajuste le volume des sons</p>
          </div>
          <div class="volume-control">
            <input
              type="range"
              min="0"
              max="100"
              [value]="application.getVolume() * 100"
              (input)="onVolumeChange($event)"
              class="volume-slider">
            <span class="volume-value">{{ Math.round(application.getVolume() * 100) }}%</span>
          </div>
          </div>
        }
      </section>

      <!-- Section Thèmes -->
      <section class="settings-section">
        <h2>🎨 Thèmes</h2>
        @if (themesLoading()) {
          <div class="loading">Chargement des thèmes...</div>
        }
        @if (!themesLoading()) {
          <div class="themes-grid">
            @for (theme of availableThemes(); track theme.id) {
              <div
                class="theme-card"
                [class.selected]="isThemeSelected(theme.id)"
                [class.unlocked]="isThemeUnlocked(theme.id)"
                [class.locked]="!isThemeUnlocked(theme.id)"
                (click)="selectTheme(theme.id)">
                <div class="theme-preview" [style.background]="getThemeColor(theme)">
                  @for (shape of getThemeShapes(theme); track shape) {
                    <div class="theme-shape"></div>
                  }
                </div>
                <div class="theme-info">
                  <h3>{{ theme.name }}</h3>
                  @if (!isThemeUnlocked(theme.id)) {
                    <div class="locked-badge">🔒 Verrouillé</div>
                  }
                </div>
              </div>
            }
          </div>
        }
      </section>

      <!-- Section Statistiques -->
      <section class="settings-section">
        <h2>📊 Mes Statistiques</h2>
        @if (application.isLoading()) {
          <div class="loading">
            Chargement de tes statistiques...
          </div>
        }
        @if (application.getError()) {
          <div class="error">
            {{ application.getError() }}
          </div>
        }
        @if (!application.isLoading() && !application.getError() && application.getStatistics()()) {
          <div class="stats-details">
          <div class="stat-row">
            <span class="stat-label">Jeux joués</span>
            <span class="stat-value">{{ application.getStatistics()()?.total_games_played || 0 }}</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Jeux réussis</span>
            <span class="stat-value">{{ application.getStatistics()()?.total_games_succeeded || 0 }}</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Taux de réussite</span>
            <span class="stat-value">{{ Math.round(application.getStatistics()()?.success_rate || 0) }}%</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Étoiles totales</span>
            <span class="stat-value">{{ application.getStatistics()()?.total_stars || 0 }}</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Sous-matières terminées</span>
            <span class="stat-value">{{ application.getStatistics()()?.completed_subject_categories_count || 0 }}</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Objets débloqués</span>
            <span class="stat-value">{{ application.getStatistics()()?.collectibles_count || 0 }}</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Mini-jeux bonus</span>
            <span class="stat-value">{{ application.getStatistics()()?.bonus_games_unlocked_count || 0 }}</span>
          </div>
          </div>
        }
      </section>

      <!-- Section Informations -->
      <section class="settings-section">
        <h2>ℹ️ Informations</h2>
        @if (childInfoLoading()) {
          <div class="loading">Chargement des informations...</div>
        }
        @if (!childInfoLoading() && childData()) {
          <div class="info-content">
            <!-- Avatar -->
            @if (getAvatarUrl()) {
              <div class="info-avatar">
                <img [src]="getAvatarUrl()" alt="Avatar" class="avatar-image">
              </div>
            }
            
            <!-- Informations de l'enfant -->
            <div class="info-section">
              <h3 class="info-section-title">👤 Mon profil</h3>
              <div class="info-item">
                <span class="info-label">Prénom</span>
                <span class="info-value">{{ childData()?.firstname || 'Non défini' }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Nom</span>
                <span class="info-value">{{ childData()?.lastname || 'Non défini' }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Date de naissance</span>
                <span class="info-value">{{ formatDate(childData()?.birthdate) || 'Non définie' }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Genre</span>
                <span class="info-value">{{ childData()?.gender || 'Non défini' }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Niveau scolaire</span>
                <span class="info-value">{{ childData()?.school_level || 'Non défini' }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">École</span>
                <span class="info-value">{{ schoolData()?.name || 'Non définie' }}</span>
              </div>
              @if (childData()?.notes) {
                <div class="info-item">
                  <span class="info-label">Notes</span>
                  <span class="info-value">{{ childData()?.notes }}</span>
                </div>
              }
            </div>

            <!-- Informations du parent -->
            @if (parentData()) {
              <div class="info-section">
                <h3 class="info-section-title">👨‍👩‍👧 Parent</h3>
                <div class="info-item">
                  <span class="info-label">Nom</span>
                  <span class="info-value">{{ parentData()?.fullname || 'Non défini' }}</span>
                </div>
              </div>
            }

            <!-- Professeurs et matières -->
            @if (teachersData() && teachersData()!.length > 0) {
              <div class="info-section">
                <h3 class="info-section-title">👨‍🏫 Mes professeurs</h3>
                @for (teacher of teachersData(); track teacher.teacher_id) {
                  <div class="teacher-item">
                    <div class="teacher-name">{{ teacher.teacher_name }}</div>
                    <div class="teacher-subjects">
                      <span class="subjects-label">Matières :</span>
                      <span class="subjects-list">{{ teacher.subjects.join(', ') }}</span>
                    </div>
                  </div>
                }
              </div>
            }
          </div>
        }
      </section>
    </div>
  `,
  styles: [`
    .settings-container {
      padding: 1rem;
      max-width: 1000px;
      margin: 0 auto;
    }
    @media (min-width: 768px) {
      .settings-container {
        padding: 2rem;
      }
    }

    h1 {
      margin-bottom: 2rem;
      color: var(--theme-text-color, #333);
    }

    .settings-section {
      background: white;
      border-radius: var(--theme-border-radius, 12px);
      padding: 1.5rem;
      margin-bottom: 2rem;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    h2 {
      margin: 0 0 1.5rem 0;
      color: var(--theme-text-color, #333);
      font-size: 1.25rem;
    }

    .setting-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem 0;
      border-bottom: 1px solid #e0e0e0;
    }

    .setting-item:last-child {
      border-bottom: none;
    }

    .setting-label {
      flex: 1;
    }

    .setting-label span {
      display: block;
      font-weight: 600;
      margin-bottom: 0.25rem;
      color: var(--theme-text-color, #333);
    }

    .setting-description {
      font-size: 0.875rem;
      color: #666;
      margin: 0;
    }

    .toggle-switch {
      position: relative;
      display: inline-block;
      width: 60px;
      height: 34px;
    }

    .toggle-switch input {
      opacity: 0;
      width: 0;
      height: 0;
    }

    .slider {
      position: absolute;
      cursor: pointer;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: #ccc;
      transition: 0.4s;
      border-radius: 34px;
    }

    .slider:before {
      position: absolute;
      content: "";
      height: 26px;
      width: 26px;
      left: 4px;
      bottom: 4px;
      background-color: white;
      transition: 0.4s;
      border-radius: 50%;
    }

    input:checked + .slider {
      background-color: var(--theme-primary-color, #4CAF50);
    }

    input:checked + .slider:before {
      transform: translateX(26px);
    }

    .volume-control {
      display: flex;
      align-items: center;
      gap: 1rem;
      min-width: 200px;
    }

    .volume-slider {
      flex: 1;
      height: 8px;
      border-radius: 4px;
      background: #e0e0e0;
      outline: none;
    }

    .volume-value {
      min-width: 50px;
      text-align: right;
      font-weight: 600;
      color: var(--theme-primary-color, #4CAF50);
    }

    .themes-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
      gap: 0.75rem;
    }
    @media (min-width: 768px) {
      .themes-grid {
        grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
        gap: 1rem;
      }
    }

    .theme-card {
      border: 2px solid #e0e0e0;
      border-radius: var(--theme-border-radius, 12px);
      overflow: hidden;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .theme-card.unlocked:hover {
      transform: translateY(-4px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }

    .theme-card.selected {
      border-color: var(--theme-primary-color, #4CAF50);
      box-shadow: 0 0 0 3px rgba(76, 175, 80, 0.2);
    }

    .theme-card.locked {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .theme-preview {
      width: 100%;
      height: 100px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
    }

    .theme-shape {
      width: 30px;
      height: 30px;
      background: rgba(255, 255, 255, 0.8);
      border-radius: 50%;
    }

    .theme-info {
      padding: 1rem;
      text-align: center;
    }

    .theme-info h3 {
      margin: 0 0 0.5rem 0;
      font-size: 1rem;
      color: var(--theme-text-color, #333);
    }

    .locked-badge {
      font-size: 0.75rem;
      color: #999;
    }

    .stats-details {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .stat-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.75rem;
      background: #f5f5f5;
      border-radius: 8px;
    }

    .stat-label {
      font-weight: 600;
      color: var(--theme-text-color, #333);
    }

    .stat-value {
      font-weight: 700;
      color: var(--theme-primary-color, #4CAF50);
      font-size: 1.125rem;
    }

    .info-item {
      display: flex;
      justify-content: space-between;
      padding: 0.75rem 0;
      border-bottom: 1px solid #e0e0e0;
    }

    .info-item:last-child {
      border-bottom: none;
    }

    .info-label {
      font-weight: 600;
      color: var(--theme-text-color, #333);
    }

    .info-value {
      color: #666;
    }

    .info-content {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .info-avatar {
      display: flex;
      justify-content: center;
      margin-bottom: 1rem;
    }

    .avatar-image {
      width: 120px;
      height: 120px;
      border-radius: 50%;
      object-fit: cover;
      border: 3px solid var(--theme-primary-color, #4CAF50);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    .info-section {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .info-section-title {
      margin: 0 0 0.75rem 0;
      font-size: 1.1rem;
      font-weight: 600;
      color: var(--theme-text-color, #333);
      padding-bottom: 0.5rem;
      border-bottom: 2px solid var(--theme-primary-color, #4CAF50);
    }

    .teacher-item {
      padding: 0.75rem;
      background: #f5f5f5;
      border-radius: 8px;
      margin-bottom: 0.5rem;
    }

    .teacher-name {
      font-weight: 600;
      color: var(--theme-text-color, #333);
      margin-bottom: 0.25rem;
    }

    .teacher-subjects {
      font-size: 0.875rem;
      color: #666;
      display: flex;
      gap: 0.5rem;
    }

    .subjects-label {
      font-weight: 600;
    }

    .subjects-list {
      color: var(--theme-primary-color, #4CAF50);
    }

    .loading, .error {
      text-align: center;
      padding: 2rem;
    }

    .error {
      color: var(--theme-warn-color, #F44336);
    }
  `]
})
export class SettingsComponent implements OnInit {
  protected readonly application = inject(SettingsApplication);
  private readonly authService = inject(ChildAuthService);
  private readonly supabaseService = inject(SupabaseService);

  Math = Math;
  child = signal<any>(null);
  childData = signal<any>(null);
  parentData = signal<any>(null);
  schoolData = signal<any>(null);
  teachersData = signal<Array<{ teacher_id: string; teacher_name: string; subjects: string[] }> | null>(null);
  childInfoLoading = signal<boolean>(false);
  availableThemes = signal<Theme[]>([]);
  unlockedThemes = signal<string[]>([]);
  themesLoading = signal<boolean>(false);

  async ngOnInit(): Promise<void> {
    const currentChild = await this.authService.getCurrentChild();
    if (currentChild) {
      this.child.set(currentChild);
      await this.application.initialize();
      await this.loadThemes();
      await this.loadChildInfo();
    }
  }

  async loadChildInfo(): Promise<void> {
    this.childInfoLoading.set(true);
    try {
      const currentChild = this.child();
      if (!currentChild?.child_id) {
        return;
      }

      // Récupérer les données complètes de l'enfant
      const { data: childData, error: childError } = await this.supabaseService.client
        .from('children')
        .select('*')
        .eq('id', currentChild.child_id)
        .single();

      if (childError) {
        console.error('Erreur lors du chargement des données enfant:', childError);
        return;
      }

      this.childData.set(childData);

      // Récupérer les données du parent
      if (childData.parent_id) {
        const { data: parentProfile, error: parentProfileError } = await this.supabaseService.client
          .from('profiles')
          .select('id')
          .eq('id', childData.parent_id)
          .single();

        if (!parentProfileError && parentProfile) {
          const { data: parentData, error: parentError } = await this.supabaseService.client
            .from('parents')
            .select('fullname')
            .eq('profile_id', parentProfile.id)
            .single();

          if (!parentError && parentData) {
            this.parentData.set(parentData);
          }
        }
      }

      // Récupérer les données de l'école
      if (childData.school_id) {
        const { data: schoolData, error: schoolError } = await this.supabaseService.client
          .from('schools')
          .select('name')
          .eq('id', childData.school_id)
          .single();

        if (!schoolError && schoolData) {
          this.schoolData.set(schoolData);
        }
      }

      // Récupérer les professeurs et leurs matières
      if (childData.school_level && childData.school_id) {
        const { data: assignments, error: assignmentsError } = await this.supabaseService.client
          .from('teacher_assignments')
          .select(`
            teacher_id,
            subject_id,
            school_level,
            teachers!inner(
              id,
              fullname,
              profile_id
            ),
            subjects!inner(
              id,
              name
            )
          `)
          .eq('school_level', childData.school_level)
          .eq('school_id', childData.school_id)
          .is('deleted_at', null);

        if (!assignmentsError && assignments) {
          // Grouper par professeur
          const teachersMap = new Map<string, { teacher_id: string; teacher_name: string; subjects: string[] }>();

          for (const assignment of assignments) {
            const teacherId = assignment.teacher_id;
            const teacherName = (assignment.teachers as any)?.fullname || 'Professeur inconnu';
            const subjectName = (assignment.subjects as any)?.name || 'Matière inconnue';

            if (!teachersMap.has(teacherId)) {
              teachersMap.set(teacherId, {
                teacher_id: teacherId,
                teacher_name: teacherName,
                subjects: []
              });
            }

            const teacher = teachersMap.get(teacherId)!;
            if (!teacher.subjects.includes(subjectName)) {
              teacher.subjects.push(subjectName);
            }
          }

          this.teachersData.set(Array.from(teachersMap.values()));
        }
      }
    } catch (error) {
      console.error('Erreur lors du chargement des informations:', error);
    } finally {
      this.childInfoLoading.set(false);
    }
  }

  formatDate(dateString: string | null | undefined): string {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
      return dateString;
    }
  }

  getAvatarUrl(): string | null {
    const data = this.childData();
    if (!data) return null;
    
    // Utiliser avatar_url s'il existe
    if (data.avatar_url) {
      return data.avatar_url;
    }
    
    // Sinon, générer l'URL depuis DiceBear si seed et style sont disponibles
    if (data.avatar_seed && data.avatar_style) {
      const style = data.avatar_style === 'bottts' ? 'bottts' : 'fun-emoji';
      return `https://api.dicebear.com/7.x/${style}/svg?seed=${encodeURIComponent(data.avatar_seed)}`;
    }
    
    return null;
  }

  async loadThemes(): Promise<void> {
    this.themesLoading.set(true);
    try {
      const themes = await this.application.getAvailableThemes();
      this.availableThemes.set(themes);
      const unlocked = await this.application.getUnlockedThemes();
      this.unlockedThemes.set(unlocked.map(t => t.theme_id));
    } catch (error) {
      console.error('Erreur lors du chargement des thèmes:', error);
    } finally {
      this.themesLoading.set(false);
    }
  }

  toggleSounds(): void {
    this.application.toggleSounds();
  }

  onVolumeChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    const volume = parseInt(target.value, 10) / 100;
    this.application.setVolume(volume);
  }

  isThemeUnlocked(themeId: string): boolean {
    return this.unlockedThemes().includes(themeId);
  }

  isThemeSelected(themeId: string): boolean {
    // TODO: Vérifier le thème sélectionné actuellement
    return false;
  }

  async selectTheme(themeId: string): Promise<void> {
    if (!this.isThemeUnlocked(themeId)) return;
    await this.application.selectTheme(themeId);
    await this.loadThemes();
  }

  getThemeColor(theme: Theme): string {
    const colors = theme.shapes_colors_json as any;
    return colors?.['primary_color'] || '#4CAF50';
  }

  getThemeShapes(theme: Theme): string[] {
    const colors = theme.shapes_colors_json as any;
    return colors?.['shapes'] || [];
  }
}
