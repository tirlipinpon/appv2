/*
 * Public API Surface of shared
 */

// Components
export * from './components/action-links/action-links.component';
export * from './components/app-header/app-header.component';
export * from './components/confirmation-dialog/confirmation-dialog.component';
export * from './components/form-field/form-field.component';
export * from './components/games-stats-display/games-stats-display.component';
export * from './components/letter-by-letter-input/letter-by-letter-input.component';
export * from './components/school-level-select/school-level-select.component';
export * from './components/scroll-to-top/scroll-to-top.component';
export * from './components/toast/toast.component';

// Services
export * from './services/auth/auth.service';
export * from './services/cache/cache.service';
export * from './services/categories-cache/categories-cache.service';
export * from './services/error/api-error-wrapper.service';
export * from './services/error/error-handler.service';
export * from './services/error/global-error-handler.service';
export * from './services/games-stats/games-stats.service';
export * from './services/logging/logger.service';
export * from './services/snackbar/error-snackbar.service';
export * from './services/supabase/supabase.service';
export * from './services/synchronization/profile-sync.service';
export * from './services/toast/toast.service';

// Repositories
// BaseRepository is imported directly from './repositories/base-repository.service' to avoid barrel export issues
// export { BaseRepository, RepositoryResult } from './repositories/base-repository.service';

// Stores
export * from './store/enrollments.store';
export * from './store/schools.store';
export * from './store/subject-categories.store';
export * from './store/subjects.store';
// Export ChildStore from child feature (using relative path from shared)
export { ChildStore } from '../features/child/store/index';

// Utils
export * from './utils/store-error-helper';
export * from './utils/track-by.util';
export * from './utils/word-validation.util';

// Decorators
export * from './decorators/catch-error.decorator';

// Interceptors
export * from './interceptors/http-error.interceptor';

// Tokens
export * from './tokens/environment.token';
export * from './tokens/app-version.token';

