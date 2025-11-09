# Configuration Supabase

## 🔧 Application de la migration SQL

Pour configurer votre base de données Supabase, vous devez appliquer la migration SQL manuellement.

### Étapes :

1. **Connectez-vous à votre projet Supabase** :
   - Allez sur https://supabase.com
   - Connectez-vous à votre projet : `piaahwlfyvezdfnzoxeb`

2. **Accédez à l'éditeur SQL** :
   - Dans le menu de gauche, cliquez sur "SQL Editor"
   - Cliquez sur "New query"

3. **Copiez et exécutez la migration** :
   - Ouvrez le fichier `supabase/migrations/001_initial_schema.sql`
   - Copiez tout le contenu
   - Collez-le dans l'éditeur SQL de Supabase
   - Cliquez sur "Run" ou appuyez sur `Ctrl+Enter` (Windows) / `Cmd+Enter` (Mac)

4. **Vérifiez que la migration a réussi** :
   - Allez dans "Table Editor"
   - Vous devriez voir la table `profiles` dans la liste
   - Allez dans "Database" > "Functions" pour vérifier que les fonctions RPC sont créées :
     - `create_profile_after_signup`
     - `add_role_to_profile`

## ✅ Vérification

Pour vérifier que tout fonctionne :

1. **Vérifier la table profiles** :
   ```sql
   SELECT * FROM public.profiles LIMIT 1;
   ```

2. **Vérifier les policies RLS** :
   ```sql
   SELECT * FROM pg_policies WHERE tablename = 'profiles';
   ```

3. **Vérifier les fonctions RPC** :
   ```sql
   SELECT routine_name 
   FROM information_schema.routines 
   WHERE routine_schema = 'public' 
   AND routine_name IN ('create_profile_after_signup', 'add_role_to_profile');
   ```

## 🔐 Configuration de l'authentification

Les variables d'environnement sont déjà configurées dans les fichiers `environment.ts` et `environment.prod.ts` (non commités dans Git pour des raisons de sécurité).

**URL Supabase** : `https://piaahwlfyvezdfnzoxeb.supabase.co`

**Clé API Anon** : Déjà configurée dans les fichiers d'environnement locaux.

## 📝 Notes importantes

- ⚠️ **Ne commitez jamais** les fichiers `environment.ts` et `environment.prod.ts` contenant les vraies clés API
- Les fichiers `.example.ts` sont là pour servir de modèles
- La clé `service_role` ne doit jamais être utilisée côté client (frontend)
- La clé `anon` est sécurisée grâce aux policies RLS

## 🚀 Prochaines étapes

Une fois la migration appliquée :

1. Démarrer l'application : `npm start`
2. Tester l'inscription d'un parent : `/signup/parent`
3. Tester l'inscription d'un professeur : `/signup/prof`
4. Tester l'ajout de rôle à un compte existant

