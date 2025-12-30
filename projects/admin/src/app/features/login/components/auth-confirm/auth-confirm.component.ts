import { Component, OnInit, inject, ChangeDetectionStrategy } from '@angular/core';

import { ActivatedRoute, Router } from '@angular/router';

import { CommonModule } from '@angular/common';

import { EmailConfirmationService } from '../../services/email-confirmation.service';

import { LoggerService } from '../../../../shared';



/**

 * Composant de confirmation d'email (refactorisé)

 * Principe SRP : Gère uniquement l'UI de confirmation

 */

@Component({

  selector: 'app-auth-confirm',

  standalone: true,

  imports: [CommonModule],

  templateUrl: './auth-confirm.component.html',

  styleUrl: './auth-confirm.component.scss',

  changeDetection: ChangeDetectionStrategy.OnPush,

})

export class AuthConfirmComponent implements OnInit {



  private readonly route = inject(ActivatedRoute);



  private readonly router = inject(Router);



  private readonly confirmationService = inject(EmailConfirmationService);



  private readonly logger = inject(LoggerService);



  



  isLoading = true;



  isSuccess = false;



  errorMessage: string | null = null;







  async ngOnInit() {



    const hash = window.location.hash.substring(1);



    const hashParams = new URLSearchParams(hash);



    const queryParams = this.route.snapshot.queryParams;



    



    const accessToken = hashParams.get('access_token') || queryParams['access_token'];



    const refreshToken = hashParams.get('refresh_token') || queryParams['refresh_token'];



    const tokenHash = queryParams['token_hash'] || hashParams.get('token_hash');







    if (accessToken) {



      await this.confirmWithTokens(accessToken, refreshToken || '');



    } else if (tokenHash) {



      await this.confirmWithTokenHash(tokenHash);



    } else {



      this.errorMessage = 'Token de confirmation manquant';



      this.isLoading = false;



    }



  }







  private async confirmWithTokens(accessToken: string, refreshToken: string): Promise<void> {



    const result = await this.confirmationService.confirmWithTokens(accessToken, refreshToken);



    this.handleConfirmationResult(result.success, result.error);



  }







  private async confirmWithTokenHash(tokenHash: string): Promise<void> {

    const result = await this.confirmationService.confirmWithTokenHash(tokenHash);



    this.handleConfirmationResult(result.success, result.error);



  }







  private handleConfirmationResult(success: boolean, error: Error | null): void {



    if (!success || error) {



      this.errorMessage = error?.message || 'Erreur lors de la confirmation';



      this.isLoading = false;



      this.logger.error('Email confirmation failed', error);



      return;



    }







    this.isSuccess = true;



    this.isLoading = false;



    this.logger.info('Email confirmed successfully');







    window.history.replaceState(null, '', window.location.pathname);







    setTimeout(() => {



      this.router.navigate(['/login'], {



        queryParams: {



          message: 'Votre email a été confirmé avec succès ! Vous pouvez maintenant vous connecter.'



        }



      });



    }, 2000);



  }







  navigateToLogin(): void {



    this.router.navigate(['/login']);



  }



}



