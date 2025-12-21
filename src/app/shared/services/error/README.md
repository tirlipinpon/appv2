# Système de gestion centralisée des erreurs

Ce système capture **toutes** les erreurs de l'application et les affiche via `ErrorSnackbarService`.

## Architecture

Le système est composé de plusieurs couches :

1. **GlobalErrorHandler** - Capture les erreurs runtime Angular (composants, services, promesses non catchées)
2. **HttpErrorInterceptor** - Capture les erreurs HTTP
3. **ApiErrorWrapperService** - Wrapper pour les appels fetch/API
4. **@CatchError Decorator** - Décorateur pour les méthodes de services

Toutes les erreurs passent par `ErrorHandlerService` pour normalisation, puis sont affichées via `ErrorSnackbarService`.

## Utilisation

### Erreurs automatiques

Les erreurs suivantes sont **automatiquement** capturées et affichées :

- ✅ Erreurs dans les composants (via GlobalErrorHandler)
- ✅ Erreurs dans les services (via GlobalErrorHandler)
- ✅ Erreurs HTTP (via HttpErrorInterceptor)
- ✅ Erreurs runtime Angular (via GlobalErrorHandler)

### Utilisation du wrapper API

Pour les appels `fetch()` ou promesses qui ne passent pas par HttpClient :

```typescript
import { ApiErrorWrapperService } from "@shared/services/error/api-error-wrapper.service";

@Injectable({ providedIn: "root" })
export class MyService {
  private readonly apiWrapper = inject(ApiErrorWrapperService);

  async loadData() {
    // Wrapper automatique avec gestion d'erreur
    return await this.apiWrapper.fetchWithErrorHandling<Data>("https://api.example.com/data");
  }

  async processData() {
    // Wrapper pour promesse
    return await this.apiWrapper.wrapPromise(this.someAsyncOperation(), "Erreur lors du traitement des données");
  }
}
```

### Utilisation du décorateur @CatchError

Pour les méthodes de services qui doivent capturer automatiquement les erreurs :

```typescript
import { CatchError } from "@shared/decorators/catch-error.decorator";
import { ErrorHandlerService } from "@shared/services/error/error-handler.service";
import { ErrorSnackbarService } from "@shared/services/snackbar/error-snackbar.service";

@Injectable({ providedIn: "root" })
export class MyService {
  // IMPORTANT: Les services doivent être injectés pour que le décorateur fonctionne
  private readonly errorHandler = inject(ErrorHandlerService);
  private readonly errorSnackbar = inject(ErrorSnackbarService);

  @CatchError("Erreur lors du chargement des données")
  async loadData(): Promise<Data> {
    // Si une erreur survient, elle sera automatiquement capturée et affichée
    return await this.api.getData();
  }
}
```

## Configuration

Le système est configuré dans `app.config.ts` :

- `ErrorHandler` est configuré avec `GlobalErrorHandler`
- `HttpClient` est configuré avec `httpErrorInterceptor`

## Notes importantes

- Toutes les erreurs sont loggées en console pour le debugging
- Les erreurs HTTP sont propagées pour permettre une gestion locale si nécessaire
- Le système est extensible (peut ajouter d'autres handlers)
- Les erreurs sont normalisées via `ErrorHandlerService` pour un format uniforme
