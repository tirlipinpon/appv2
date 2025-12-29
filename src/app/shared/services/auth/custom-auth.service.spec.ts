import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { CustomAuthService } from './custom-auth.service';
import { SupabaseService } from '../supabase/supabase.service';
import { Router } from '@angular/router';
import { AppInitializationService } from '../initialization/app-initialization.service';
import { of } from 'rxjs';

describe('CustomAuthService', () => {
  let service: CustomAuthService;
  let supabaseService: jasmine.SpyObj<SupabaseService>;
  let router: jasmine.SpyObj<Router>;
  let appInitService: jasmine.SpyObj<AppInitializationService>;

  beforeEach(() => {
    const supabaseSpy = jasmine.createSpyObj('SupabaseService', ['client']);
    const routerSpy = jasmine.createSpyObj('Router', ['navigate']);
    const appInitSpy = jasmine.createSpyObj('AppInitializationService', ['initializeForRole']);

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        CustomAuthService,
        { provide: SupabaseService, useValue: supabaseSpy },
        { provide: Router, useValue: routerSpy },
        { provide: AppInitializationService, useValue: appInitSpy },
      ],
    });

    service = TestBed.inject(CustomAuthService);
    supabaseService = TestBed.inject(SupabaseService) as jasmine.SpyObj<SupabaseService>;
    router = TestBed.inject(Router) as jasmine.SpyObj<Router>;
    appInitService = TestBed.inject(AppInitializationService) as jasmine.SpyObj<AppInitializationService>;
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should store and retrieve token', () => {
    const token = 'test-token-123';
    service['setStoredToken'](token);
    const retrievedToken = service['getStoredToken']();
    expect(retrievedToken).toBe(token);
  });

  it('should clear token on signOut', async () => {
    const token = 'test-token-123';
    service['setStoredToken'](token);
    await service.signOut();
    const retrievedToken = service['getStoredToken']();
    expect(retrievedToken).toBeNull();
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('should return null for getCurrentUser when not logged in', () => {
    const user = service.getCurrentUser();
    expect(user).toBeNull();
  });

  // Note: Pour des tests complets, il faudrait :
  // 1. Mock fetch pour les appels Edge Functions
  // 2. Tester signIn avec différents scénarios (succès, erreur, email non vérifié)
  // 3. Tester signUp avec validation
  // 4. Tester requestPasswordReset
  // 5. Tester updatePassword
  // 6. Tester getProfile
  // 7. Tester la gestion des rôles
});

