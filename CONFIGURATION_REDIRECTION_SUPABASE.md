# 🔧 Configuration de la redirection Supabase pour production

## ⚠️ Problème identifié

Supabase redirige vers `https://www.jardin-iris.be/appv2#access_token=...` mais l'application Angular attend `/auth/confirm`.

## ✅ Solution

### 1. Configuration dans Supabase Dashboard

1. Allez sur **https://supabase.com/dashboard**
2. Sélectionnez votre projet : **piaahwlfyvezdfnzoxeb**
3. Allez dans **"Authentication"** → **"URL Configuration"**

### 2. Site URL

Configurez le **Site URL** avec :
```
https://www.jardin-iris.be/appv2
```

### 3. Redirect URLs

Ajoutez ces URLs dans **"Redirect URLs"** :
```
https://www.jardin-iris.be/appv2/auth/confirm
https://www.jardin-iris.be/appv2/**
http://localhost:4200/auth/confirm
http://localhost:4200/**
```

**Important** : Utilisez `**` pour accepter toutes les routes sous `/appv2/`

### 4. Code Angular mis à jour

Le composant `auth-confirm` a été mis à jour pour :
- ✅ Gérer les fragments (`#access_token=...`) au lieu des query params
- ✅ Utiliser `setSession()` pour établir la session avec les tokens Supabase
- ✅ Nettoyer l'URL après confirmation
- ✅ Gérer les deux méthodes : fragments et query params

## 🔍 Comment ça fonctionne maintenant

1. **Inscription** : L'utilisateur s'inscrit avec un rôle
2. **Email de confirmation** : Supabase envoie un email avec un lien
3. **Clic sur le lien** : Redirection vers `https://www.jardin-iris.be/appv2/auth/confirm#access_token=...`
4. **Composant auth-confirm** :
   - Extrait `access_token` et `refresh_token` des fragments
   - Appelle `setSession()` pour établir la session
   - Crée le profil avec les rôles stockés dans `user_metadata`
   - Redirige vers `/login`

## 📝 Notes importantes

- ⚠️ **L'URL doit correspondre exactement** à celle configurée dans Supabase
- 🔒 **Utilisez HTTPS** en production
- 📧 **Les fragments (#)** sont utilisés par Supabase pour éviter que les tokens apparaissent dans les logs serveur
- 🧹 **L'URL est nettoyée** après confirmation pour éviter que les tokens restent dans l'historique

## 🧪 Test

1. Inscrivez-vous avec un email valide
2. Vérifiez votre email
3. Cliquez sur le lien de confirmation
4. Vous devriez être redirigé vers `/auth/confirm` puis `/login`
5. Les tokens dans l'URL seront automatiquement traités

---

**Besoin d'aide ?** Vérifiez que l'URL de redirection dans Supabase correspond exactement à `https://www.jardin-iris.be/appv2/auth/confirm`

