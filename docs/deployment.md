# Déploiement et Configuration Production

## Vue d'ensemble

Le déploiement se fait en deux étapes :
1. **Build** : Compilation des applications Angular
2. **Déploiement FTP** : Upload vers le serveur

## Configuration Production

### Variables d'environnement

#### Frontend

**Fichier** : `projects/frontend/src/environments/environment.prod.ts`

```typescript
export const environment = {
  production: true,
  supabaseUrl: 'VOTRE_URL_SUPABASE_PRODUCTION',
  supabaseAnonKey: 'VOTRE_CLE_ANON_PRODUCTION',
};
```

#### Admin

**Fichier** : `projects/admin/src/environments/environment.prod.ts`

```typescript
export const environment = {
  production: true,
  supabaseUrl: 'VOTRE_URL_SUPABASE_PRODUCTION',
  supabaseAnonKey: 'VOTRE_CLE_ANON_PRODUCTION',
  customAuthEnabled: true,
  deepseek: {
    model: 'deepseek-chat',
  },
  deepseekProxy: {
    url: 'VOTRE_URL_SUPABASE_PRODUCTION/functions/v1/deepseek-proxy'
  }
};
```

**⚠️ Important** : Ne jamais commiter les fichiers `environment.prod.ts` avec les vraies clés. Utiliser les fichiers `.example.ts` comme modèles.

### Configuration Angular

#### Budgets de taille

**Admin** (`angular.json`) :
```json
{
  "budgets": [
    {
      "type": "initial",
      "maximumWarning": "500kB",
      "maximumError": "1MB"
    },
    {
      "type": "anyComponentStyle",
      "maximumWarning": "6kB",
      "maximumError": "15kB"
    }
  ]
}
```

**Frontend** : Mêmes budgets.

#### Output Hashing

**Production** : `outputHashing: "all"` pour le cache busting.

#### Base Href

**Admin** : `/appv2/admin/`
**Frontend** : `/appv2/frontend/`

## Scripts de Build

### Build Production

#### Admin

```bash
npm run build:admin
```

**Résultat** : Dossier `dist/admin/browser/` avec les fichiers optimisés.

**Configuration** :
- Base href : `/appv2/admin/`
- Output hashing : `all`
- Optimisations : Activées
- Source maps : Désactivées (production)

#### Frontend

```bash
npm run build:frontend
```

**Résultat** : Dossier `dist/frontend/browser/` avec les fichiers optimisés.

**Configuration** :
- Base href : `/appv2/frontend/`
- Output hashing : `all`
- Optimisations : Activées
- Source maps : Désactivées (production)

### Build Watch (Développement)

#### Admin

```bash
npm run watch:admin
```

**Fonctionnalités** :
- Rebuild automatique lors des changements
- Source maps activées
- Optimisations désactivées

#### Frontend

```bash
npm run watch:frontend
```

## Déploiement FTP

### Configuration FTP

**Fichier** : `.env` (à la racine, non commité)

```env
FTP_HOST=votre-serveur-ftp.com
FTP_PORT=21
FTP_USER=votre-utilisateur
FTP_PASSWORD=votre-mot-de-passe
FTP_DESTINATION_ADMIN=appv2/admin
FTP_DESTINATION_FRONTEND=appv2/frontend
```

### Scripts de déploiement

#### Déploiement Admin

```bash
npm run deploy:admin
```

**Étapes** :
1. Build production (`npm run build:admin`)
2. Upload FTP vers `appv2/admin/`

**Script** : `scripts/deploy-ftp.js`

**Fonctionnalités** :
- Vérification des variables d'environnement
- Vérification du dossier source
- Suppression de l'ancien contenu sur le serveur
- Upload des nouveaux fichiers
- Gestion des erreurs

#### Déploiement Frontend

```bash
npm run deploy:frontend
```

**Étapes** :
1. Build production (`npm run build:frontend`)
2. Upload FTP vers `appv2/frontend/`

**Script** : `scripts/deploy-ftp-frontend.js`

### Structure de déploiement

```
serveur-ftp/
└── appv2/
    ├── admin/          # Application admin
    │   ├── index.html
    │   ├── main-*.js
    │   ├── polyfills-*.js
    │   └── assets/
    └── frontend/      # Application frontend
        ├── index.html
        ├── main-*.js
        ├── polyfills-*.js
        └── assets/
```

## Migrations Supabase

### Ordre d'exécution

Les migrations doivent être exécutées dans l'ordre chronologique :

1. **Schéma initial** : Tables, relations, contraintes
2. **Catégories de matières** : `002_subject_categories.sql`
3. **Storage buckets** : `003_game_images_storage.sql`
4. **RLS enfants** : `008_child_login_rls.sql`
5. **RLS frontend** : `009_frontend_tables_rls.sql`
6. **Storage puzzle** : `010_puzzle_storage.sql`
7. **Aides média** : `011_add_aide_media.sql`
8. **Contraintes** : `012_fix_check_constraints.sql`
9. **Commentaires** : `013_add_table_comments.sql`
10. **Badges système** : `014_badges_system.sql`

### Exécution des migrations

#### Via Supabase Dashboard

1. Se connecter à [Supabase Dashboard](https://app.supabase.com)
2. Aller dans **SQL Editor**
3. Ouvrir chaque fichier de migration dans l'ordre
4. Exécuter le SQL

#### Via Supabase CLI

```bash
# Installer Supabase CLI
npm install -g supabase

# Se connecter au projet
supabase link --project-ref votre-project-ref

# Appliquer les migrations
supabase db push
```

### Vérification post-migration

**Vérifier** :
- Tables créées correctement
- Index créés
- RLS activées
- Triggers fonctionnels
- Fonctions SQL créées

## Configuration serveur

### .htaccess (Apache)

**Fichier** : `projects/admin/public/.htaccess` et `projects/frontend/public/.htaccess`

**Configuration** :
- Redirection vers `index.html` pour le routing Angular
- Headers de cache pour les assets statiques
- Compression GZIP

**Exemple** :
```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /appv2/admin/
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /appv2/admin/index.html [L]
</IfModule>
```

### Headers de sécurité

**Recommandations** :
- Content-Security-Policy
- X-Frame-Options
- X-Content-Type-Options
- Strict-Transport-Security (HTTPS)

## Variables d'environnement production

### Fichier .env

**Localisation** : `.env` (à la racine, non commité)

**Variables requises** :
```env
# FTP
FTP_HOST=votre-serveur-ftp.com
FTP_PORT=21
FTP_USER=votre-utilisateur
FTP_PASSWORD=votre-mot-de-passe
FTP_DESTINATION_ADMIN=appv2/admin
FTP_DESTINATION_FRONTEND=appv2/frontend

# Supabase (optionnel, déjà dans environment.prod.ts)
SUPABASE_URL=votre-url-supabase
SUPABASE_ANON_KEY=votre-cle-anon
```

### Fichier .env.example

**Localisation** : `.env.example` (commité, modèle)

**Contenu** :
```env
# FTP Configuration
FTP_HOST=
FTP_PORT=21
FTP_USER=
FTP_PASSWORD=
FTP_DESTINATION_ADMIN=appv2/admin
FTP_DESTINATION_FRONTEND=appv2/frontend
```

## Checklist de déploiement

### Pré-déploiement

- [ ] Vérifier que toutes les migrations sont appliquées
- [ ] Vérifier les variables d'environnement production
- [ ] Tester le build localement
- [ ] Vérifier les budgets de taille (pas d'erreurs)
- [ ] Tester les deux applications en local

### Build

- [ ] Exécuter `npm run build:admin`
- [ ] Vérifier qu'aucune erreur n'est présente
- [ ] Exécuter `npm run build:frontend`
- [ ] Vérifier qu'aucune erreur n'est présente
- [ ] Vérifier la taille des bundles

### Déploiement

- [ ] Vérifier les variables FTP dans `.env`
- [ ] Exécuter `npm run deploy:admin`
- [ ] Vérifier l'upload réussi
- [ ] Exécuter `npm run deploy:frontend`
- [ ] Vérifier l'upload réussi

### Post-déploiement

- [ ] Tester l'application admin en production
- [ ] Tester l'application frontend en production
- [ ] Vérifier les routes (pas de 404)
- [ ] Vérifier l'authentification
- [ ] Vérifier les appels API
- [ ] Vérifier les assets (images, fonts, etc.)

## Rollback

### En cas de problème

1. **Restaurer l'ancienne version** :
   - Garder une copie de l'ancien build
   - Re-uploader l'ancienne version via FTP

2. **Revert des migrations** :
   - Utiliser les fichiers de rollback (`*_rollback.sql`)
   - Exécuter dans l'ordre inverse

3. **Revert des variables d'environnement** :
   - Restaurer les anciennes valeurs
   - Rebuild et redéployer

## Monitoring production

### Logs Supabase

**Accès** : Supabase Dashboard → Logs

**Services monitorés** :
- API : Requêtes et erreurs
- Auth : Authentifications et erreurs
- Postgres : Requêtes lentes
- Storage : Uploads et erreurs

### Métriques à surveiller

**Performance** :
- Temps de réponse des requêtes
- Taux d'erreur
- Utilisation des ressources

**Utilisation** :
- Nombre d'utilisateurs actifs
- Nombre de requêtes par jour
- Taille de la base de données

## Bonnes pratiques

### Déploiement

1. **Toujours tester en local** avant de déployer
2. **Vérifier les migrations** avant de déployer
3. **Backup de la base de données** avant migrations importantes
4. **Déployer en heures creuses** si possible
5. **Communiquer les changements** aux utilisateurs

### Sécurité

1. **Ne jamais commiter** les clés API
2. **Utiliser HTTPS** en production
3. **Configurer les headers de sécurité**
4. **Limiter les accès FTP** (IP whitelist si possible)
5. **Rotater les mots de passe** régulièrement

### Performance

1. **Optimiser les images** avant upload
2. **Minifier le code** (automatique avec build production)
3. **Activer la compression GZIP** sur le serveur
4. **Configurer le cache** pour les assets statiques
5. **Monitorer les performances** après déploiement
