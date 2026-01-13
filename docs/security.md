# Sécurité : RLS, Permissions, Guards et RGPD

## Vue d'ensemble

La sécurité est gérée à plusieurs niveaux :
- **RLS (Row-Level Security)** : Politiques de sécurité au niveau base de données
- **Guards Angular** : Protection des routes côté client
- **Authentification** : Supabase Auth pour admin, PIN pour enfants
- **RGPD** : Conformité et gestion des données personnelles

## RLS (Row-Level Security)

### Principes généraux

Les politiques RLS filtrent automatiquement les données selon l'utilisateur connecté :

1. **Professeurs (`prof`)** : Accès complet aux tables pédagogiques (subjects, games, questions, etc.)
2. **Parents** : Accès uniquement aux données de leurs enfants
3. **Enfants** : Accès en lecture publique limité pour la connexion, puis accès à leurs propres données frontend
4. **Public** : Accès en lecture seule aux tables frontend actives (collectibles, bonus_games, themes)

### Tables avec RLS spécifiques

#### `children` - Politique publique pour connexion

**Politique** : Lecture seule des enfants actifs avec `firstname` et `login_pin`

**Usage** : Permet la connexion enfant sans authentification Supabase complète.

**Exemple de politique** :
```sql
CREATE POLICY "Public read access for login"
ON children
FOR SELECT
USING (is_active = true);
```

#### `frontend_*` - Politiques permissives pour enfants

**Politique** : Lecture/écriture de leurs propres données

**Tables concernées** :
- `frontend_game_attempts`
- `frontend_subject_category_progress`
- `frontend_child_badges`
- `frontend_child_collectibles`
- `frontend_child_bonus_game_unlocks`
- `frontend_child_themes`
- `frontend_child_mascot_state`
- `frontend_child_checkpoints`

**Exemple de politique** :
```sql
CREATE POLICY "Children can manage their own data"
ON frontend_game_attempts
FOR ALL
USING (child_id = auth.uid()::text OR child_id IN (
  SELECT id::text FROM children WHERE login_pin = current_setting('app.child_pin', true)
));
```

#### `subject_categories` - Accès réservé aux professeurs

**Politique** : Seuls les professeurs peuvent créer/modifier les sous-catégories

**Exemple de politique** :
```sql
CREATE POLICY "Teachers can manage subject categories"
ON subject_categories
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM teachers t
    JOIN profiles p ON t.profile_id = p.id
    WHERE p.id = auth.uid()
    AND 'prof' = ANY(p.roles)
  )
);
```

#### `child_subject_category_enrollments` - Accès réservé aux parents

**Politique** : Les parents peuvent gérer les inscriptions de leurs enfants

**Exemple de politique** :
```sql
CREATE POLICY "Parents can manage their children's enrollments"
ON child_subject_category_enrollments
FOR ALL
USING (
  child_id IN (
    SELECT id FROM children
    WHERE parent_id = auth.uid()
  )
);
```

### Tables publiques (lecture seule)

**Tables** :
- `frontend_badges` : Badges actifs
- `frontend_collectibles` : Collectibles actifs
- `frontend_bonus_games` : Jeux bonus actifs
- `frontend_themes` : Thèmes actifs

**Politique** : Lecture publique pour tous, écriture réservée aux admins

## Permissions par rôle

### Enfant

**Authentification** : `firstname` + `login_pin` (4 chiffres)

**Permissions** :
- ✅ Lecture de ses propres données (`frontend_*` avec `child_id`)
- ✅ Écriture de ses propres tentatives, progression, badges
- ✅ Lecture des jeux disponibles (filtrés par RLS)
- ✅ Lecture des matières et sous-catégories activées
- ❌ Modification des données d'autres enfants
- ❌ Accès aux données administratives

**RLS** : Filtrage automatique via `child_id = current_child_id`

### Parent

**Authentification** : Supabase Auth (email/password)

**Permissions** :
- ✅ Gestion de ses propres données (profil, enfants)
- ✅ Lecture/écriture des données de ses enfants
- ✅ Gestion des inscriptions aux matières/sous-catégories
- ✅ Accès aux statistiques de progression de ses enfants
- ❌ Accès aux données d'autres parents
- ❌ Création/modification de jeux

**RLS** : Filtrage via `parent_id = auth.uid()`

### Professeur

**Authentification** : Supabase Auth (email/password)

**Permissions** :
- ✅ Création/modification de jeux pour ses matières
- ✅ Création/modification de matières et sous-catégories
- ✅ Gestion des affectations (matière, classe, niveau)
- ✅ Accès aux statistiques de ses classes
- ❌ Accès aux données d'enfants non liés à ses affectations
- ❌ Modification des données d'autres professeurs

**RLS** : Filtrage via `teacher_assignments` avec `teacher_id = current_teacher_id`

### Administrateur

**Authentification** : Supabase Auth avec rôle spécial

**Permissions** :
- ✅ Accès complet à toutes les données
- ✅ Gestion de tous les utilisateurs
- ✅ Gestion de toutes les écoles, matières, jeux
- ✅ Bypass des politiques RLS (via `service_role`)

**RLS** : Utilisation de `service_role` pour bypasser les politiques

## Guards Angular

### Frontend

#### childAuthGuard

**Localisation** : `projects/frontend/src/app/core/auth/child-auth.guard.ts`

**Rôle** : Protège toutes les routes nécessitant une session enfant valide.

**Logique** :
1. Vérifie la session via `ChildAuthService.isSessionValid()`
2. Vérifie présence, expiration, validité JWT, activité
3. Met à jour l'activité si session valide
4. Redirige vers `/login` si session invalide

**Utilisation** :
```typescript
{
  path: '',
  canActivate: [childAuthGuard],  // Protection globale
  children: [/* routes protégées */]
}
```

**Validation** :
- Session présente dans `localStorage`
- JWT valide et non expiré
- Activité récente (délai configurable)

### Admin

#### authGuard

**Localisation** : `projects/admin/src/app/features/login/guards/auth.guard.ts`

**Rôle** : Vérifie l'authentification Supabase.

**Logique** :
1. Vérifie la session Supabase
2. Redirige vers `/login` si non authentifié

**Utilisation** :
```typescript
{
  path: 'dashboard',
  canActivate: [authGuard],
  loadComponent: () => import('./features/dashboard/dashboard.component')
}
```

#### childParentGuard

**Localisation** : `projects/admin/src/app/features/child/guards/child-parent.guard.ts`

**Rôle** : Vérifie que l'enfant appartient au parent connecté.

**Logique** :
1. Récupère l'enfant depuis la route (`:id` ou `:childId`)
2. Vérifie la relation parent/enfant via RLS
3. Redirige si pas de relation

**Utilisation** :
```typescript
{
  path: 'child-profile/:id',
  canActivate: [authGuard, childParentGuard],
  loadComponent: () => import('./features/child/child.component')
}
```

**Vérification** :
```typescript
// Vérifie que child.parent_id === currentUser.id
const { data: child } = await supabase
  .from('children')
  .select('id, parent_id')
  .eq('id', childId)
  .maybeSingle();

if (child.parent_id !== user.id) {
  // Accès refusé
  return false;
}
```

## Authentification

### Frontend (Enfants)

**Méthode** : Authentification simplifiée via `firstname` + `login_pin`

**Service** : `ChildAuthService`

**Localisation** : `projects/frontend/src/app/core/auth/child-auth.service.ts`

**Flux** :
1. Enfant saisit `firstname` + `login_pin` (4 chiffres)
2. Requête Supabase avec RLS publique :
   ```typescript
   const { data } = await supabase
     .from('children')
     .select('*')
     .eq('firstname', firstname)
     .eq('login_pin', pin)
     .eq('is_active', true)
     .single();
   ```
3. Génération de JWT local (ou via Edge Function)
4. Stockage de la session dans `localStorage`
5. Redirection vers le dashboard

**Sécurité** :
- PIN à 4 chiffres (limité mais suffisant pour enfants)
- Vérification `is_active = true`
- JWT avec expiration
- Vérification d'activité pour expiration de session

### Admin (Parents/Profs)

**Méthode** : Authentification Supabase complète

**Service** : `AuthService`

**Flux** :
1. Utilisateur saisit email + password
2. Authentification Supabase :
   ```typescript
   const { data, error } = await supabase.auth.signInWithPassword({
     email,
     password
   });
   ```
3. Récupération du profil et des rôles
4. Stockage de la session
5. Redirection selon le rôle

**Sécurité** :
- Hashage des mots de passe (géré par Supabase)
- JWT avec expiration
- Refresh token automatique
- Gestion multi-rôles

## RGPD et données personnelles

### Données collectées

**Enfants** :
- Prénom, nom, date de naissance
- Niveau scolaire, école
- Progression, tentatives de jeux
- Badges, collectibles, mascotte

**Parents** :
- Nom, email, téléphone, adresse
- Relations avec enfants

**Professeurs** :
- Nom, email, téléphone, biographie
- Affectations, jeux créés

### Droits des utilisateurs

#### Droit d'accès

Les utilisateurs peuvent accéder à leurs données via :
- Interface parent : Consultation des données enfants
- Interface enfant : Consultation de sa propre progression
- Export de données (à implémenter)

#### Droit de rectification

Les utilisateurs peuvent modifier leurs données via :
- Interface parent : Modification du profil et des enfants
- Interface professeur : Modification du profil

#### Droit à l'effacement

**Implémentation** :
- Soft delete : `is_active = false` pour les enfants
- Suppression définitive : Via interface admin (avec confirmation)

**Tables concernées** :
- `children` : Soft delete via `is_active`
- `frontend_*` : Conservation pour statistiques (anonymisation possible)

#### Droit à la portabilité

**Export de données** :
- Format JSON ou CSV
- Toutes les données de l'utilisateur
- Progression, badges, collectibles

#### Droit d'opposition

Les utilisateurs peuvent :
- Désactiver leur compte (`is_active = false`)
- Supprimer leur compte (avec confirmation)

### Conservation des données

**Politique** :
- Données actives : Conservées indéfiniment
- Données inactives : Conservation 3 ans après dernière activité
- Suppression automatique : Via script de nettoyage (à implémenter)

### Anonymisation

**Stratégie** :
- Anonymisation des données pour statistiques agrégées
- Suppression des identifiants personnels
- Conservation des données anonymisées pour analyses

## Intercepteurs et gestion d'erreurs

### Frontend

#### SupabaseService - Interception des erreurs

**Localisation** : `projects/frontend/src/app/core/services/supabase/supabase.service.ts`

**Fonctionnalités** :
- Interception des erreurs 401/403
- Ajout automatique du JWT aux requêtes
- Gestion des erreurs d'authentification

**Exemple** :
```typescript
async executeWithErrorHandling<T>(
  operation: () => Promise<{ data: T | null; error: any }>
): Promise<{ data: T | null; error: any }> {
  const result = await operation();
  
  if (result.error) {
    if (this.errorHandler.isAuthError(result.error)) {
      await this.errorHandler.handleError(result.error);
    }
  }
  
  return result;
}
```

### Admin

#### httpErrorInterceptor

**Localisation** : `projects/admin/src/app/shared/interceptors/http-error.interceptor.ts`

**Fonctionnalités** :
- Interception de toutes les erreurs HTTP
- Normalisation des erreurs
- Affichage dans snackbar
- Messages conviviaux selon le code HTTP

**Codes HTTP gérés** :
- `0` : Connexion impossible
- `400` : Requête invalide
- `401` : Non authentifié
- `403` : Permissions insuffisantes
- `404` : Ressource non trouvée
- `500` : Erreur serveur
- `503` : Service indisponible

## Bonnes pratiques

### RLS

1. **Toujours activer RLS** sur les tables contenant des données sensibles
2. **Tester les politiques** avec différents utilisateurs
3. **Utiliser `auth.uid()`** pour identifier l'utilisateur connecté
4. **Éviter les politiques trop permissives** (principe du moindre privilège)

### Guards

1. **Protéger toutes les routes sensibles** avec des guards
2. **Vérifier les permissions** avant d'afficher les données
3. **Rediriger vers login** si non authentifié
4. **Logger les tentatives d'accès non autorisées**

### Authentification

1. **Ne jamais stocker les mots de passe** en clair
2. **Utiliser des tokens avec expiration** (JWT)
3. **Renouveler les tokens** automatiquement
4. **Gérer la déconnexion** proprement (nettoyage de session)

### RGPD

1. **Documenter les données collectées** dans la politique de confidentialité
2. **Implémenter les droits des utilisateurs** (accès, rectification, effacement)
3. **Anonymiser les données** pour les statistiques
4. **Conserver les données** selon la politique de rétention
5. **Informer les utilisateurs** de l'utilisation de leurs données

## Exemples de politiques RLS

### Exemple 1 : Enfants - Accès à leurs propres tentatives

```sql
CREATE POLICY "Children can view their own attempts"
ON frontend_game_attempts
FOR SELECT
USING (child_id IN (
  SELECT id FROM children
  WHERE login_pin = current_setting('app.child_pin', true)
  AND firstname = current_setting('app.child_firstname', true)
));
```

### Exemple 2 : Parents - Accès aux données de leurs enfants

```sql
CREATE POLICY "Parents can view their children's data"
ON frontend_game_attempts
FOR SELECT
USING (child_id IN (
  SELECT id FROM children
  WHERE parent_id = auth.uid()
));
```

### Exemple 3 : Professeurs - Accès aux jeux de leurs matières

```sql
CREATE POLICY "Teachers can view games from their subjects"
ON games
FOR SELECT
USING (
  subject_id IN (
    SELECT subject_id FROM teacher_assignments
    WHERE teacher_id = (
      SELECT id FROM teachers WHERE profile_id = auth.uid()
    )
    AND deleted_at IS NULL
  )
);
```

## Audit et logging

### Logging des actions sensibles

**Actions à logger** :
- Connexions/déconnexions
- Tentatives d'accès non autorisées
- Modifications de données sensibles
- Suppressions de données

**Service** : `LoggerService` (admin)

**Localisation** : `projects/admin/src/app/shared/services/logging/logger.service.ts`

### Monitoring

**Métriques à surveiller** :
- Nombre de tentatives d'accès non autorisées
- Erreurs d'authentification
- Temps de réponse des requêtes
- Utilisation des ressources
