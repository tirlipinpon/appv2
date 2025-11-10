const SUPABASE_URL = 'https://piaahwlfyvezdfnzoxeb.supabase.co';

interface SupabaseSession {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  expires_at: number;
  user: {
    id: string;
    email: string;
    user_metadata: Record<string, unknown>;
    app_metadata: Record<string, unknown>;
    aud: string;
    created_at: string;
  };
}

const sessionState: { current: SupabaseSession | null } = { current: null };

const stubAuthSession = () => {
  cy.intercept('GET', '**/auth/v1/session**', req => {
    req.reply({
      statusCode: 200,
      body: {
        data: { session: sessionState.current },
        error: null
      },
      headers: { 'content-type': 'application/json' }
    });
  }).as('getSession');
};

const stubProfilesRequest = (
  body: Record<string, unknown> | null,
  alias = 'getProfiles'
) => {
  cy.intercept('GET', `${SUPABASE_URL}/rest/v1/profiles*`, req => {
    req.reply({
      statusCode: 200,
      body,
      headers: { 'content-type': 'application/json' }
    });
  }).as(alias);
};

describe('Smoke - Pages Auth', () => {
  beforeEach(() => {
    sessionState.current = null;
    stubAuthSession();
  });

  it('affiche la page de connexion sans erreur', () => {
    cy.visit('/login');

    cy.contains('h1', 'Connexion').should('be.visible');
    cy.get('form').within(() => {
      cy.get('input#email').should('be.visible');
      cy.get('input#password').should('be.visible');
      cy.contains('button', 'Se connecter').should('be.disabled');
    });
  });

  it('affiche la page de choix d’inscription', () => {
    cy.visit('/signup');

    cy.contains('h1', 'Inscription').should('be.visible');
    cy.contains('button', 'Je suis parent').should('be.visible');
    cy.contains('button', 'Je suis professeur').should('be.visible');
  });

  it('affiche les formulaires d’inscription parent et professeur', () => {
    cy.visit('/signup/parent');
    cy.contains('h1', 'Inscription Parent').should('be.visible');
    cy.get('input#email').should('exist');
    cy.get('input#password').should('exist');
    cy.get('input#confirmPassword').should('exist');

    cy.visit('/signup/prof');
    cy.contains('h1', 'Inscription Professeur').should('be.visible');
  });
});

describe('Parcours critiques - Auth', () => {
  const userId = '11111111-2222-3333-4444-555555555555';

  beforeEach(() => {
    sessionState.current = null;
    stubAuthSession();
  });

  it('permet de se connecter et d’accéder au tableau de bord', () => {
    const loginEmail = 'parent@example.com';
    const supabaseSession: SupabaseSession = {
      access_token: 'test-access-token',
      token_type: 'bearer',
      expires_in: 3600,
      refresh_token: 'test-refresh-token',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: {
        id: userId,
        email: loginEmail,
        user_metadata: { roles: ['parent'] },
        app_metadata: { provider: 'email' },
        aud: 'authenticated',
        created_at: new Date().toISOString()
      }
    };

    stubProfilesRequest({
      id: userId,
      display_name: 'Parent Démo',
      avatar_url: null,
      roles: ['parent'],
      metadata: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    cy.intercept(
      'POST',
      `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
      req => {
        sessionState.current = supabaseSession;
        req.reply({
          statusCode: 200,
          body: {
            access_token: supabaseSession.access_token,
            token_type: supabaseSession.token_type,
            expires_in: supabaseSession.expires_in,
            refresh_token: supabaseSession.refresh_token,
            expires_at: supabaseSession.expires_at,
            user: supabaseSession.user
          },
          headers: { 'content-type': 'application/json' }
        });
      }
    ).as('signIn');

    cy.visit('/login');

    cy.get('input#email').type(loginEmail);
    cy.get('input#password').type('Password123!');
    cy.contains('button', 'Se connecter').click();

    cy.wait('@signIn');
    cy.wait('@getProfiles');

    cy.location('pathname').should('eq', '/dashboard');
    cy.contains('h1', 'Tableau de bord').should('be.visible');
    cy.contains('Bienvenue, Parent Démo').should('be.visible');
    cy.contains('Rôle actif: parent').should('be.visible');
  });

  it('permet une inscription parent et redirige vers la connexion', () => {
    const signupEmail = 'nouveau-parent@example.com';
    const createdUserId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

    stubProfilesRequest(null, 'checkExistingProfile');

    cy.intercept(
      'POST',
      `${SUPABASE_URL}/auth/v1/signup**`,
      req => {
        req.reply({
          statusCode: 200,
          body: {
            user: {
              id: createdUserId,
              email: signupEmail,
              aud: 'authenticated',
              role: 'authenticated',
              confirmed_at: null,
              email_confirmed_at: null,
              last_sign_in_at: null,
              user_metadata: { roles: ['parent'] },
              app_metadata: { provider: 'email', providers: ['email'] },
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            },
            session: null
          },
          headers: { 'content-type': 'application/json' }
        });
      }
    ).as('signUpParent');

    cy.intercept(
      'POST',
      `${SUPABASE_URL}/rest/v1/rpc/check_email_exists`,
      {
        statusCode: 200,
        body: false,
        headers: { 'content-type': 'application/json' }
      }
    ).as('checkEmailExists');

    cy.visit('/signup/parent');

    cy.get('input#email').type(signupEmail);
    cy.get('input#password').type('Password123!');
    cy.get('input#confirmPassword').type('Password123!');
    cy.contains('button', 'S\'inscrire').click();

    cy.wait('@signUpParent');
    cy.wait('@checkEmailExists');
    cy.wait('@checkExistingProfile');

    cy.location('pathname').should('eq', '/login');
    cy.contains('.success-message', 'Veuillez vérifier votre email pour confirmer votre compte').should('be.visible');
  });

  it('confirme un compte depuis le lien Supabase et redirige vers la connexion', () => {
    cy.clock();

    const confirmedUserId = 'cccccccc-dddd-eeee-ffff-111111111111';
    const confirmationEmail = 'confirm@example.com';
    const supabaseSession: SupabaseSession = {
      access_token: 'confirm-access-token',
      token_type: 'bearer',
      expires_in: 3600,
      refresh_token: 'confirm-refresh-token',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: {
        id: confirmedUserId,
        email: confirmationEmail,
        user_metadata: { roles: ['parent'] },
        app_metadata: { provider: 'email' },
        aud: 'authenticated',
        created_at: new Date().toISOString()
      }
    };

    let profileFetchCount = 0;
    cy.intercept('GET', `${SUPABASE_URL}/rest/v1/profiles*`, req => {
      profileFetchCount += 1;
      if (profileFetchCount === 1) {
        req.reply({
          statusCode: 200,
          body: null,
          headers: { 'content-type': 'application/json' }
        });
      } else {
        req.reply({
          statusCode: 200,
          body: {
            id: confirmedUserId,
            display_name: 'Compte Confirmé',
            avatar_url: null,
            roles: ['parent'],
            metadata: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          },
          headers: { 'content-type': 'application/json' }
        });
      }
    }).as('profileFetch');

    cy.intercept(
      'POST',
      `${SUPABASE_URL}/rest/v1/rpc/create_profile_after_signup`,
      {
        statusCode: 200,
        body: {
          data: {
            id: confirmedUserId,
            roles: ['parent']
          }
        },
        headers: { 'content-type': 'application/json' }
      }
    ).as('createProfile');

    cy.intercept(
      {
        method: 'POST',
        url: `${SUPABASE_URL}/auth/v1/token`,
        query: { grant_type: 'refresh_token' }
      },
      req => {
        sessionState.current = supabaseSession;
        req.reply({
          statusCode: 200,
          body: {
            access_token: supabaseSession.access_token,
            token_type: supabaseSession.token_type,
            expires_in: supabaseSession.expires_in,
            refresh_token: supabaseSession.refresh_token,
            expires_at: supabaseSession.expires_at,
            user: supabaseSession.user
          },
          headers: { 'content-type': 'application/json' }
        });
      }
    );

    cy.visit('/auth/confirm#access_token=confirm-access-token&refresh_token=confirm-refresh-token&type=signup');

    cy.tick(500);
    cy.wait('@profileFetch');
    cy.wait('@createProfile');
    cy.wait('@profileFetch');

    cy.contains('h1', 'Email confirmé !').should('be.visible');
    cy.contains('.redirect-message', 'Redirection vers la page de connexion').should('be.visible');

    cy.tick(2000);
    cy.location('pathname').should('eq', '/login');
    cy.location('search').should('contain', 'message=');
  });

  it('redirige vers le sélecteur de rôle pour un utilisateur multi-rôles', () => {
    const multiRoleUserId = 'bbbbbbbb-cccc-dddd-eeee-222222222222';
    const loginEmail = 'multi-role@example.com';
    const supabaseSession: SupabaseSession = {
      access_token: 'multi-role-access-token',
      token_type: 'bearer',
      expires_in: 3600,
      refresh_token: 'multi-role-refresh-token',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: {
        id: multiRoleUserId,
        email: loginEmail,
        user_metadata: { roles: ['parent', 'prof'] },
        app_metadata: { provider: 'email' },
        aud: 'authenticated',
        created_at: new Date().toISOString()
      }
    };

    stubProfilesRequest({
      id: multiRoleUserId,
      display_name: 'Utilisateur Multi-rôles',
      avatar_url: null,
      roles: ['parent', 'prof'],
      metadata: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    cy.intercept(
      'POST',
      `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
      req => {
        sessionState.current = supabaseSession;
        req.reply({
          statusCode: 200,
          body: {
            access_token: supabaseSession.access_token,
            token_type: supabaseSession.token_type,
            expires_in: supabaseSession.expires_in,
            refresh_token: supabaseSession.refresh_token,
            expires_at: supabaseSession.expires_at,
            user: supabaseSession.user
          },
          headers: { 'content-type': 'application/json' }
        });
      }
    ).as('signInMulti');

    cy.visit('/login');

    cy.get('input#email').type(loginEmail);
    cy.get('input#password').type('Password123!');
    cy.contains('button', 'Se connecter').click();

    cy.wait('@signInMulti');
    cy.wait('@getProfiles');

    cy.location('pathname').should('eq', '/select-role');
    cy.contains('h1', 'Choisissez votre identité').should('be.visible');
    cy.contains('button', 'Parent').should('be.visible');
    cy.contains('button', 'Professeur').should('be.visible');

    cy.contains('button', 'Professeur').click();

    cy.wait('@getProfiles');
    cy.location('pathname').should('eq', '/dashboard');
    cy.contains('Rôle actif: prof').should('be.visible');
  });
});

