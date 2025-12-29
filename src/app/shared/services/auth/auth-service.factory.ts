import { inject } from '@angular/core';
import { AuthService } from './auth.service';
import { CustomAuthService } from './custom-auth.service';
import { environment } from '../../../../environments/environment';

// Interface commune pour les deux services
export interface IAuthService {
  getCurrentUser(): any;
  getSession(): Promise<any>;
  getProfile(): Promise<any>;
  getCurrentProfile(): any;
  getActiveRole(): string | null;
  setActiveRole(role: string): void;
  hasRole(role: string): boolean;
  hasMultipleRoles(): boolean;
  currentUser$: any;
  currentProfile$: any;
  activeRole$: any;
  signIn(email: string, password: string): Promise<any>;
  signOut(): Promise<void>;
  signUp(email: string, password: string, roles: string[]): Promise<any>;
  requestPasswordReset(email: string): Promise<any>;
  updatePassword(newPassword: string, resetToken?: string): Promise<any>;
  addRoleToProfile(role: string): Promise<any>;
}

export function getAuthService(): IAuthService {
  if (environment.customAuthEnabled) {
    return inject(CustomAuthService);
  }
  return inject(AuthService);
}

