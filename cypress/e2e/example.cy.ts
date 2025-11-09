describe('E2E - Authentification', () => {
  it('redirige vers la page de connexion et affiche le titre', () => {
    cy.visit('/');
    cy.contains('h1', 'Connexion').should('be.visible');
  });
});

