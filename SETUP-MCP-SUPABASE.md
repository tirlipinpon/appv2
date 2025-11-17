# Configuration du MCP Supabase pour exécuter les migrations SQL

## Problème actuel

Le MCP Supabase hébergé nécessite une authentification **OAuth 2.1**, mais la configuration actuelle utilise un token Bearer statique. Cela empêche l'exécution automatique des migrations SQL.

## Solutions

### Option 1 : Configuration OAuth du MCP Supabase (Recommandé) ✅

**Configuration actuelle** dans `mcp.json` :

```json
{
  "mcpServers": {
    "supabase": {
      "url": "https://mcp.supabase.com/mcp?project_ref=piaahwlfyvezdfnzoxeb&features=database%2Cdebugging%2Cfunctions%2Cdevelopment%2Cbranching%2Cstorage%2Caccount%2Cdocs"
    }
  }
}
```

**Prochaines étapes** :

1. **Redémarrer Cursor** pour activer la nouvelle configuration et déclencher le flux OAuth
2. **Autoriser l'accès** lorsque Cursor vous redirige vers Supabase (OAuth 2.1)
3. **Vérifier la connexion** : Le MCP devrait maintenant être connecté avec OAuth
4. **Tester** : Une fois connecté, vous pourrez exécuter les migrations SQL directement via le MCP

### Option 2 : Utiliser le Supabase CLI

1. **Installer le Supabase CLI** :

   ```bash
   npm install -g supabase
   ```

2. **Se connecter à Supabase** :

   ```bash
   supabase login
   ```

3. **Lier le projet** :

   ```bash
   supabase link --project-ref piaahwlfyvezdfnzoxeb
   ```

4. **Exécuter les migrations** :
   ```bash
   supabase db push
   ```

### Option 3 : Créer une fonction RPC pour exécuter le SQL

1. **Créer la fonction** `exec_sql` dans Supabase (voir `create-exec-sql-function.sql`)

2. **Utiliser l'API REST** pour appeler cette fonction avec le SQL de la migration

⚠️ **Attention** : Cette méthode nécessite des permissions SECURITY DEFINER et peut être un risque de sécurité.

### Option 4 : Exécution manuelle (Solution actuelle)

Pour l'instant, la solution la plus simple est d'exécuter manuellement les migrations dans l'éditeur SQL de Supabase :

1. Ouvrir l'éditeur SQL de Supabase
2. Copier le contenu du fichier de migration
3. Exécuter la requête

## Migration actuelle à exécuter

📄 **Fichier** : `supabase/migrations/2025-01-24-fix-children-rls-policy-insert.sql`

Cette migration corrige les politiques RLS sur la table `children` pour permettre aux parents de créer des enfants.

