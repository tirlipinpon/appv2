# Guide de dépannage - MCP Supabase en "Loading Tools"

## Problème

Les outils MCP Supabase restent en état "loading tools" et ne se connectent pas, même après une utilisation précédente.

## Solutions à essayer (dans l'ordre)

### 1. ✅ Vérifier que le fichier de configuration existe

Le fichier `.cursor/mcp.json` doit exister avec la configuration suivante :

```json
{
  "mcpServers": {
    "supabase": {
      "url": "https://mcp.supabase.com/mcp?project_ref=piaahwlfyvezdfnzoxeb&features=database%2Cdebugging%2Cfunctions%2Cdevelopment%2Cbranching%2Cstorage%2Caccount%2Cdocs"
    }
  }
}
```

**Action** : Le fichier a été créé automatiquement. Si le problème persiste, passez à l'étape 2.

### 2. 🔄 Redémarrer Cursor complètement

**Important** : Un simple rechargement ne suffit pas. Il faut fermer complètement Cursor.

1. Fermer toutes les fenêtres de Cursor
2. Vérifier dans le gestionnaire de tâches qu'aucun processus Cursor n'est actif
3. Rouvrir Cursor
4. Attendre quelques secondes pour que les outils MCP se chargent

### 3. 🔐 Compléter l'authentification OAuth

Le MCP Supabase utilise OAuth 2.1. Si vous n'avez pas encore autorisé l'accès :

1. Cursor devrait automatiquement ouvrir une fenêtre de navigateur
2. Connectez-vous à votre compte Supabase
3. Autorisez l'accès à Cursor
4. Retournez dans Cursor - la connexion devrait être établie

**Si la fenêtre OAuth ne s'ouvre pas automatiquement** :

- Vérifiez que les pop-ups ne sont pas bloqués
- Essayez de redémarrer Cursor à nouveau
- Vérifiez les logs de Cursor (View > Output > MCP)

### 4. 🧹 Nettoyer le cache MCP

Parfois, le cache MCP peut causer des problèmes :

1. Fermer Cursor
2. Supprimer le cache MCP (emplacement typique sur Windows) :
   - `%APPDATA%\Cursor\Cache\` ou
   - `%LOCALAPPDATA%\Cursor\Cache\`
3. Rouvrir Cursor

### 5. 🔍 Vérifier les logs MCP

Pour diagnostiquer le problème :

1. Dans Cursor : `View > Output`
2. Sélectionner "MCP" dans la liste déroulante
3. Vérifier les messages d'erreur
4. Rechercher des erreurs de connexion ou d'authentification

### 6. 🌐 Vérifier la connectivité réseau

Assurez-vous que :

- Votre connexion Internet fonctionne
- Aucun pare-feu ne bloque `mcp.supabase.com`
- Aucun proxy d'entreprise ne bloque la connexion

### 7. 🔑 Vérifier le project_ref

Vérifiez que le `project_ref` dans l'URL (`piaahwlfyvezdfnzoxeb`) correspond bien à votre projet Supabase :

1. Aller sur https://supabase.com/dashboard
2. Sélectionner votre projet
3. Vérifier l'URL : `https://supabase.com/dashboard/project/[VOTRE_PROJECT_REF]`
4. Si différent, mettre à jour `.cursor/mcp.json` avec le bon `project_ref`

### 8. 🔄 Réinitialiser la configuration MCP

Si rien ne fonctionne :

1. Sauvegarder votre configuration actuelle
2. Supprimer temporairement `.cursor/mcp.json`
3. Redémarrer Cursor
4. Recréer le fichier `.cursor/mcp.json` avec la configuration
5. Redémarrer Cursor à nouveau

### 9. 📞 Support Supabase

Si le problème persiste après avoir essayé toutes ces solutions :

- Consulter le forum Cursor : https://forum.cursor.com
- Consulter les discussions GitHub Supabase : https://github.com/orgs/supabase/discussions
- Vérifier la documentation officielle : https://supabase.com/docs/guides/getting-started/mcp

## Vérification que ça fonctionne

Une fois connecté, vous devriez pouvoir :

1. Voir les ressources MCP Supabase disponibles dans la liste des outils
2. Exécuter des requêtes SQL via le MCP
3. Accéder aux tables, fonctions, etc. de votre projet Supabase

## Alternative : Utiliser Supabase CLI

Si le MCP continue de poser problème, vous pouvez utiliser le Supabase CLI pour exécuter les migrations :

```bash
# Installer le CLI
npm install -g supabase

# Se connecter
supabase login

# Lier le projet
supabase link --project-ref piaahwlfyvezdfnzoxeb

# Exécuter les migrations
supabase db push
```
