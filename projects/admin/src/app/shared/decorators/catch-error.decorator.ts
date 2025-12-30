import { ErrorHandlerService } from '../services/error/error-handler.service';
import { ErrorSnackbarService } from '../services/snackbar/error-snackbar.service';

/**
 * Décorateur pour capturer automatiquement les erreurs dans les méthodes de services
 * 
 * IMPORTANT: Ce décorateur nécessite que le service injecte ErrorHandlerService et ErrorSnackbarService
 * dans son constructeur ou via inject().
 * 
 * @param errorMessage Message d'erreur personnalisé (optionnel)
 * 
 * @example
 * ```typescript
 * @Injectable({ providedIn: 'root' })
 * class MyService {
 *   private readonly errorHandler = inject(ErrorHandlerService);
 *   private readonly errorSnackbar = inject(ErrorSnackbarService);
 * 
 *   @CatchError('Erreur lors du chargement des données')
 *   async loadData(): Promise<Data> {
 *     // Si une erreur survient, elle sera automatiquement capturée et affichée
 *     return await this.api.getData();
 *   }
 * }
 * ```
 */
interface ServiceWithErrorHandling {
  errorHandler?: ErrorHandlerService;
  errorSnackbar?: ErrorSnackbarService;
}

interface ClassConstructor {
  name: string;
  constructor: ClassConstructor;
}

export function CatchError(errorMessage?: string) {
  return function (
    target: ClassConstructor,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    const className = target.name || 'Unknown';

    descriptor.value = function (...args: unknown[]) {
      // Récupérer les services depuis l'instance (doivent être injectés dans le service)
      const serviceInstance = this as ServiceWithErrorHandling;
      const errorHandler = serviceInstance.errorHandler;
      const errorSnackbar = serviceInstance.errorSnackbar;
      
      // Si les services ne sont pas disponibles, essayer de les obtenir autrement
      if (!errorHandler || !errorSnackbar) {
        console.warn(`@CatchError: ErrorHandlerService et ErrorSnackbarService doivent être injectés dans ${className} pour utiliser le décorateur @CatchError`);
      }

      try {
        const result = originalMethod.apply(this, args);
        
        // Si c'est une promesse, capturer les erreurs
        if (result instanceof Promise) {
          return result.catch((error: unknown) => {
            if (!errorHandler || !errorSnackbar) {
              // Si les services ne sont pas disponibles, logger et propager l'erreur
              console.error('Erreur dans méthode décorée (services non disponibles):', {
                target: className,
                method: propertyKey,
                error
              });
              throw error;
            }
            
            const normalized = errorHandler.normalize(
              error,
              errorMessage || `Erreur dans ${className}.${propertyKey}`
            );
            
            console.error('Erreur capturée par décorateur @CatchError:', {
              target: className,
              method: propertyKey,
              error: normalized,
              originalError: error
            });
            
            errorSnackbar.showError(normalized.message);
            throw normalized;
          });
        }
        
        // Pour les méthodes synchrones, retourner le résultat
        return result;
      } catch (error) {
        // Gérer les erreurs synchrones
        if (!errorHandler || !errorSnackbar) {
          console.error('Erreur synchrone dans méthode décorée (services non disponibles):', {
            target: className,
            method: propertyKey,
            error
          });
          throw error;
        }
        
        const normalized = errorHandler.normalize(
          error,
          errorMessage || `Erreur dans ${className}.${propertyKey}`
        );
        
        console.error('Erreur synchrone capturée par décorateur @CatchError:', {
          target: className,
          method: propertyKey,
          error: normalized,
          originalError: error
        });
        
        errorSnackbar.showError(normalized.message);
        throw normalized;
      }
    };

    return descriptor;
  };
}

