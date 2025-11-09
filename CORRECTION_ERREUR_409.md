# 🔧 Correction de l'erreur 409 Conflict

## Problème

L'erreur `409 Conflict` avec le message `"Key (id)=(...) is not present in table \"users\""` se produit quand :
- Un utilisateur déjà inscrit essaie de s'inscrire avec un autre rôle
- La fonction `create_profile_after_signup` est appelée avant que l'utilisateur soit confirmé dans `auth.users`

## Solution

### 1. Appliquer la migration SQL de correction

Exécutez le fichier `supabase/migrations/002_fix_create_profile_function.sql` dans l'éditeur SQL de Supabase.

Cette migration :
- ✅ Vérifie que l'utilisateur existe dans `auth.users` avant de créer le profil
- ✅ Gère le cas où le profil existe déjà (fusionne les rôles au lieu de les remplacer)
- ✅ Évite les erreurs de contrainte de clé étrangère

### 2. Code Angular mis à jour

Le code Angular a été amélioré pour :
- ✅ Vérifier si le profil existe avant d'appeler `create_profile_after_signup`
- ✅ Utiliser `add_role_to_profile` si le profil existe déjà
- ✅ Gérer les erreurs de manière plus robuste

## 📋 Étapes pour appliquer la correction

### Étape 1 : Appliquer la migration SQL

1. Allez sur **https://supabase.com/dashboard**
2. Sélectionnez votre projet : **piaahwlfyvezdfnzoxeb**
3. Allez dans **"SQL Editor"** → **"New query"**
4. Ouvrez le fichier `supabase/migrations/002_fix_create_profile_function.sql`
5. Copiez tout le contenu et collez-le dans l'éditeur SQL
6. Cliquez sur **"Run"**

### Étape 2 : Vérifier la correction

Exécutez cette requête pour vérifier que la fonction a été mise à jour :

```sql
SELECT routine_name, routine_definition 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name = 'create_profile_after_signup';
```

Vous devriez voir la nouvelle définition avec la vérification `IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = user_id)`.

## ✅ Test après correction

1. **Test avec un utilisateur existant** :
   - Connectez-vous avec un compte existant (ex: parent)
   - Déconnectez-vous
   - Essayez de vous inscrire avec le même email mais comme "prof"
   - Le système devrait proposer d'ajouter le rôle
   - Après connexion, le rôle devrait être ajouté sans erreur

2. **Test avec un nouvel utilisateur** :
   - Inscrivez-vous avec un nouvel email
   - Confirmez votre email
   - Le profil devrait être créé avec les rôles corrects

## 🔍 Explication technique

### Avant la correction :
- La fonction `create_profile_after_signup` essayait de créer un profil même si l'utilisateur n'existait pas encore dans `auth.users`
- Cela causait une violation de contrainte de clé étrangère

### Après la correction :
- La fonction vérifie d'abord que l'utilisateur existe dans `auth.users`
- Si le profil existe déjà, elle fusionne les rôles au lieu de les remplacer
- Le code Angular vérifie aussi l'existence du profil avant d'appeler la fonction

## 📝 Notes importantes

- ⚠️ **Appliquez la migration SQL** avant de tester à nouveau
- 🔄 **Redémarrez l'application** après avoir appliqué la migration
- 🧪 **Testez les deux scénarios** : nouvel utilisateur et utilisateur existant

---

**Besoin d'aide ?** Consultez `GUIDE_IMPLEMENTATION.md` pour plus de détails.

