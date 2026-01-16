import { ApplicationConfig, ErrorHandler, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { routes } from './app.routes';
import { GlobalErrorHandler, httpErrorInterceptor, APP_VERSION_TOKEN } from './shared';
import { ENVIRONMENT } from '@shared/tokens/environment.token';
import { environment } from '../environments/environment';
import { APP_VERSION } from './core/version';
import { GamesStatsService } from '@shared/services/games-stats/games-stats.service';
import { GamesStatsWrapperService } from './shared/services/games-stats/games-stats-wrapper.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideAnimationsAsync(),
    provideHttpClient(
      withInterceptors([httpErrorInterceptor])
    ),
    {
      provide: ErrorHandler,
      useClass: GlobalErrorHandler
    },
    {
      provide: ENVIRONMENT,
      useValue: environment
    },
    {
      provide: APP_VERSION_TOKEN,
      useValue: APP_VERSION
    },
    // Fournir GamesStatsWrapperService comme implémentation de GamesStatsService dans admin
    // Cela permet au composant games-stats-display d'utiliser automatiquement le wrapper service
    {
      provide: GamesStatsService,
      useClass: GamesStatsWrapperService
    }
  ]
};
