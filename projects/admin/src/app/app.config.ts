import { ApplicationConfig, ErrorHandler, provideZoneChangeDetection, inject } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { createClient } from '@supabase/supabase-js';

import { routes } from './app.routes';
import { GlobalErrorHandler, httpErrorInterceptor, APP_VERSION_TOKEN } from './shared';
import { ENVIRONMENT } from '@shared/tokens/environment.token';
import { SUPABASE_CLIENT } from '@shared/tokens/supabase-client.token';
import { environment } from '../environments/environment';
import { APP_VERSION } from './core/version';
import { GamesStatsService } from '@shared/services/games-stats/games-stats.service';
import { GamesStatsWrapperService } from './shared/services/games-stats/games-stats-wrapper.service';
import type { Environment } from '@shared/tokens/environment.token';

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
      provide: SUPABASE_CLIENT,
      useFactory: () => {
        const env = inject<Environment>(ENVIRONMENT);
        if (!env?.supabaseUrl || !env?.supabaseAnonKey) {
          throw new Error('Configuration Supabase manquante. Vérifiez que ENVIRONMENT est fourni avec supabaseUrl et supabaseAnonKey.');
        }
        return createClient(env.supabaseUrl, env.supabaseAnonKey);
      },
      deps: [ENVIRONMENT]
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
