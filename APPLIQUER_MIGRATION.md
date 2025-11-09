# 🔧 Instructions pour appliquer la migration SQL

## ⚠️ IMPORTANT : Migration à appliquer manuellement

Vous devez appliquer la migration SQL manuellement dans l'interface Supabase car les outils automatisés nécessitent des permissions spéciales.

## 📋 Étapes détaillées

### 1. Accéder à l'éditeur SQL Supabase

1. Ouvrez votre navigateur et allez sur https://supabase.com
2. Connectez-vous à votre compte
3. Sélectionnez votre projet : **piaahwlfyvezdfnzoxeb**
4. Dans le menu de gauche, cliquez sur **"SQL Editor"**
5. Cliquez sur **"New query"** pour créer une nouvelle requête

### 2. Copier la migration

Ouvrez le fichier `supabase/migrations/001_initial_schema.sql` et copiez **TOUT** le contenu.

### 3. Coller et exécuter

1. Collez le contenu dans l'éditeur SQL de Supabase
2. Cliquez sur le bouton **"Run"** (ou appuyez sur `Ctrl+Enter` / `Cmd+Enter`)
3. Attendez que l'exécution se termine

### 4. Vérifier le succès

Vous devriez voir un message de succès. Ensuite, vérifiez que tout est créé :

#### Vérifier la table profiles

Dans l'éditeur SQL, exécutez :
```sql
SELECT * FROM public.profiles LIMIT 1;
```

Si la requête s'exécute sans erreur, la table existe.

#### Vérifier les fonctions RPC

Dans l'éditeur SQL, exécutez :
```sql
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN ('create_profile_after_signup', 'add_role_to_profile');
```

Vous devriez voir les deux fonctions listées.

#### Vérifier les policies RLS

Dans l'éditeur SQL, exécutez :
```sql
SELECT * FROM pg_policies WHERE tablename = 'profiles';
```

Vous devriez voir 3 policies :
- `Users can view own profile`
- `Users can update own profile`
- `Users can insert own profile`

## ✅ Une fois la migration appliquée

1. **Démarrer l'application** :
   ```bash
   npm start
   ```

2. **Tester l'inscription** :
   - Aller sur `http://localhost:4200/signup`
   - Choisir "Je suis parent" ou "Je suis professeur"
   - Remplir le formulaire
   - Vérifier l'email de confirmation

3. **Tester la connexion** :
   - Aller sur `http://localhost:4200/login`
   - Se connecter avec les identifiants créés

## 🐛 En cas d'erreur

Si vous rencontrez une erreur lors de l'exécution de la migration :

1. **Erreur "relation already exists"** :
   - La table existe déjà, c'est normal
   - Vous pouvez ignorer cette erreur ou supprimer la table et réessayer

2. **Erreur de permissions** :
   - Vérifiez que vous êtes connecté avec un compte ayant les droits d'administration
   - Contactez l'administrateur du projet Supabase si nécessaire

3. **Erreur sur les triggers** :
   - Les triggers peuvent déjà exister
   - Vous pouvez les supprimer d'abord avec :
     ```sql
     DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
     DROP TRIGGER IF EXISTS set_updated_at ON public.profiles;
     ```

## 📞 Support

Si vous rencontrez des problèmes, vérifiez :
- Les logs dans la console Supabase
- Les erreurs dans la console du navigateur
- Le fichier `GUIDE_IMPLEMENTATION.md` pour plus de détails

