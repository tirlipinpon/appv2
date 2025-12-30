import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

bootstrapApplication(App, appConfig)
  .catch((err) => {
    // Capturer les erreurs de bootstrap
    // Note: Les services Angular ne sont pas encore disponibles au moment du bootstrap
    // Le GlobalErrorHandler prendra le relais une fois l'application démarrée
    console.error('Erreur lors du bootstrap de l\'application:', err);
    
    if (err instanceof Error) {
      console.error('Message:', err.message);
      console.error('Stack:', err.stack);
    }
  });
