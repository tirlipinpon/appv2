# 🚀 Guide d'exécution de la migration SQL sur Supabase

## ⚡ Méthode rapide (recommandée)

### Étape 1 : Ouvrir l'éditeur SQL Supabase

1. Allez sur **https://supabase.com/dashboard**
2. Connectez-vous à votre compte
3. Sélectionnez le projet : **piaahwlfyvezdfnzoxeb**
4. Dans le menu de gauche, cliquez sur **"SQL Editor"**
5. Cliquez sur **"New query"** (ou le bouton "+")

### Étape 2 : Copier le script SQL complet

1. Ouvrez le fichier : **`supabase/migrations/001_initial_schema_COMPLETE.sql`**
2. **Sélectionnez TOUT le contenu** (Ctrl+A / Cmd+A)
3. **Copiez** (Ctrl+C / Cmd+C)

### Étape 3 : Coller et exécuter

1. **Collez** le contenu dans l'éditeur SQL de Supabase (Ctrl+V / Cmd+V)
2. Cliquez sur le bouton **"Run"** (ou appuyez sur `Ctrl+Enter` / `Cmd+Enter`)
3. Attendez quelques secondes que l'exécution se termine

### Étape 4 : Vérifier le succès

Vous devriez voir un message de succès. Pour vérifier que tout fonctionne, exécutez ces requêtes de vérification :

```sql
-- Vérifier que la table profiles existe
SELECT * FROM public.profiles LIMIT 1;

-- Vérifier les fonctions RPC
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN ('create_profile_after_signup', 'add_role_to_profile');

-- Vérifier les policies RLS
SELECT * FROM pg_policies WHERE tablename = 'profiles';
```

## ✅ Résultat attendu

Après l'exécution réussie, vous devriez avoir :

- ✅ Table `profiles` créée avec RLS activé
- ✅ 3 policies RLS configurées
- ✅ 2 fonctions RPC créées : `create_profile_after_signup` et `add_role_to_profile`
- ✅ 2 triggers créés : `on_auth_user_created` et `set_updated_at`

## 🐛 En cas d'erreur

### Erreur "relation already exists"
- La table existe déjà, c'est normal
- Le script utilise `IF NOT EXISTS` donc cette erreur peut être ignorée

### Erreur "permission denied"
- Vérifiez que vous êtes connecté avec un compte administrateur
- Contactez l'administrateur du projet Supabase

### Erreur sur les triggers
- Les triggers peuvent déjà exister
- Le script les supprime et les recrée automatiquement

## 🎯 Après la migration

Une fois la migration appliquée avec succès :

1. **Testez l'application** :
   ```bash
   npm start
   ```

2. **Testez l'inscription** :
   - Allez sur `http://localhost:4200/signup`
   - Choisissez "Je suis parent" ou "Je suis professeur"
   - Remplissez le formulaire
   - Vérifiez votre email pour confirmer le compte

3. **Testez la connexion** :
   - Allez sur `http://localhost:4200/login`
   - Connectez-vous avec vos identifiants

## 📝 Notes importantes

- ⚠️ **Ne supprimez jamais** la table `profiles` une fois créée (sauf si vous voulez tout réinitialiser)
- Les triggers créent automatiquement un profil vide pour chaque nouvel utilisateur
- Les fonctions RPC sont sécurisées avec `SECURITY DEFINER` pour contourner les policies RLS quand nécessaire

---

**Besoin d'aide ?** Consultez `GUIDE_IMPLEMENTATION.md` pour plus de détails.

