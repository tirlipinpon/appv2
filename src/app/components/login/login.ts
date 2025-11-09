import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './login.html',
  styleUrl: './login.scss'
})
export class LoginComponent implements OnInit {
  loginForm: FormGroup;
  errorMessage: string | null = null;
  successMessage: string | null = null;
  isLoading = false;
  addRoleAfterLogin: string | null = null;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  ngOnInit() {
    // Vérifier les query params pour ajouter un rôle après connexion
    this.route.queryParams.subscribe(params => {
      if (params['addRole']) {
        this.addRoleAfterLogin = params['addRole'];
      }
      if (params['email']) {
        this.loginForm.patchValue({ email: params['email'] });
      }
      if (params['message']) {
        this.successMessage = params['message'];
      }
    });
  }

  async onSubmit() {
    if (this.loginForm.invalid) {
      return;
    }

    this.isLoading = true;
    this.errorMessage = null;
    this.successMessage = null;

    const { email, password } = this.loginForm.value;
    const { session, error } = await this.authService.signIn(email, password);

    this.isLoading = false;

    if (error) {
      this.errorMessage = error.message || 'Une erreur est survenue lors de la connexion';
      return;
    }

    if (session) {
      // Si on doit ajouter un rôle après connexion
      if (this.addRoleAfterLogin) {
        console.log('🟡 [LOGIN] Adding role after login:', this.addRoleAfterLogin);
        
        // Vérifier d'abord si l'utilisateur a déjà ce rôle
        const profile = await this.authService.getProfile();
        console.log('📥 [LOGIN] Current profile:', profile);
        
        if (profile && profile.roles.includes(this.addRoleAfterLogin)) {
          console.log('⚠️ [LOGIN] Role already exists!');
          this.errorMessage = `Vous avez déjà le rôle '${this.addRoleAfterLogin}'. Connectez-vous normalement.`;
          return;
        }
        
        console.log('➕ [LOGIN] Role does not exist, adding...');
        const { profile: updatedProfile, error: roleError } = await this.authService.addRoleToProfile(this.addRoleAfterLogin);
        
        console.log('📥 [LOGIN] addRoleToProfile result:', { updatedProfile, roleError });
        
        if (roleError) {
          console.error('❌ [LOGIN] Error adding role:', roleError);
          this.errorMessage = roleError.message || 'Erreur lors de l\'ajout du rôle';
          return;
        }
        console.log('✅ [LOGIN] Role added successfully!');
        this.successMessage = `Le rôle '${this.addRoleAfterLogin}' a été ajouté à votre profil avec succès !`;
      }

      // Récupérer le profil
      const profile = await this.authService.getProfile();
      
      if (profile) {
        // Si plusieurs rôles, rediriger vers le sélecteur de rôle
        if (this.authService.hasMultipleRoles()) {
          this.router.navigate(['/select-role']);
        } else if (profile.roles.length === 1) {
          // Un seul rôle, définir automatiquement et rediriger
          this.authService.setActiveRole(profile.roles[0]);
          this.router.navigate(['/dashboard']);
        } else {
          // Pas de rôle, rediriger vers le sélecteur
          this.router.navigate(['/select-role']);
        }
      } else {
        this.router.navigate(['/dashboard']);
      }
    }
  }
}
