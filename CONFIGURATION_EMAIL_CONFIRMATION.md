# 📧 Configuration de la confirmation d'email avec Supabase

## 🔗 URLs de redirection

### Pour le développement local :
```
http://localhost:4200/auth/confirm
```

### Pour la production :
```
https://votre-domaine.com/auth/confirm
```

## ⚙️ Configuration dans Supabase Dashboard

### Étape 1 : Configurer les URLs autorisées

1. Allez sur **https://supabase.com/dashboard**
2. Sélectionnez votre projet : **piaahwlfyvezdfnzoxeb**
3. Dans le menu de gauche, allez dans **"Authentication"** → **"URL Configuration"**
4. Dans la section **"Redirect URLs"**, ajoutez :
   - `http://localhost:4200/auth/confirm` (pour le développement)
   - `http://localhost:4200/**` (pour accepter toutes les routes locales)
   - Votre URL de production (ex: `https://votre-domaine.com/auth/confirm`)

### Étape 2 : Configurer le template d'email

1. Toujours dans **"Authentication"** → **"Email Templates"**
2. Sélectionnez le template **"Confirm signup"**
3. Vous pouvez personnaliser le message, mais gardez le lien de confirmation :
   ```
   {{ .ConfirmationURL }}
   ```

### Étape 3 : Vérifier les paramètres d'authentification

1. Dans **"Authentication"** → **"Settings"**
2. Vérifiez que **"Enable email confirmations"** est activé
3. Pour le développement, vous pouvez désactiver temporairement la confirmation d'email en activant **"Enable email confirmations"** → **OFF** (mais ce n'est pas recommandé pour la production)

## 🔧 Configuration dans le code Angular

L'URL de redirection est déjà configurée dans le service `AuthService` :

```typescript
await this.supabaseService.client.auth.signUp({
  email,
  password,
  options: {
    emailRedirectTo: `${window.location.origin}/auth/confirm`
  }
});
```

## 📄 Page de confirmation

Une page de confirmation a été créée à `/auth/confirm` qui :
- Récupère le token de confirmation depuis l'URL
- Confirme automatiquement l'email
- Redirige vers la page de connexion avec un message de succès

## 🧪 Test de la confirmation d'email

### En développement :

1. **Option 1 : Désactiver temporairement la confirmation** (pour tester rapidement)
   - Dans Supabase Dashboard → Authentication → Settings
   - Désactivez "Enable email confirmations"
   - Les utilisateurs seront automatiquement confirmés

2. **Option 2 : Utiliser le lien de confirmation** (recommandé)
   - Inscrivez-vous avec un email valide
   - Vérifiez votre boîte email
   - Cliquez sur le lien de confirmation
   - Vous serez redirigé vers `/auth/confirm` puis vers `/login`

### En production :

- Les utilisateurs recevront toujours un email de confirmation
- Le lien dans l'email redirigera vers votre domaine de production

## 📝 Notes importantes

- ⚠️ **Les URLs doivent être exactement identiques** dans Supabase et dans votre code
- 🔒 **Pour la production**, utilisez toujours HTTPS
- 📧 **Le lien de confirmation expire** après 24h par défaut (configurable dans Supabase)
- 🧪 **Pour les tests**, vous pouvez utiliser des services comme Mailtrap ou désactiver temporairement la confirmation

## 🔍 Vérification

Pour vérifier que tout fonctionne :

1. Inscrivez-vous avec un email valide
2. Vérifiez votre boîte email (et les spams)
3. Cliquez sur le lien de confirmation
4. Vous devriez être redirigé vers `/auth/confirm` puis `/login`
5. Connectez-vous avec vos identifiants

---

**Besoin d'aide ?** Consultez la documentation Supabase : https://supabase.com/docs/guides/auth/auth-email-templates

