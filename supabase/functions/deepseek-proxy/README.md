# DeepSeek Proxy - Supabase Edge Function

## Description

Cette Edge Function fait office de proxy pour l'API DeepSeek afin de résoudre les problèmes CORS. L'API DeepSeek a modifié sa politique CORS et bloque maintenant les appels directs depuis le navigateur.

## Déploiement

### Prérequis

- Supabase CLI installé : `npm install -g supabase`
- Connexion à Supabase : `supabase login`
- Clé API DeepSeek valide

### Commandes de déploiement

1. **Déployer la fonction** :
```bash
supabase functions deploy deepseek-proxy --project-ref piaahwlfyvezdfnzoxeb
```

2. **Configurer la clé API DeepSeek** (à faire une seule fois) :
```bash
supabase secrets set DEEPSEEK_API_KEY=VOTRE_CLE_API_DEEPSEEK --project-ref piaahwlfyvezdfnzoxeb
```

3. **Vérifier les secrets** :
```bash
supabase secrets list --project-ref piaahwlfyvezdfnzoxeb
```

### URL de la fonction

Une fois déployée, la fonction sera accessible à :
```
https://piaahwlfyvezdfnzoxeb.supabase.co/functions/v1/deepseek-proxy
```

## Test

### Test avec curl

```bash
curl -X POST "https://piaahwlfyvezdfnzoxeb.supabase.co/functions/v1/deepseek-proxy" \
  -H "Content-Type: application/json" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBpYWFod2xmeXZlemRmbnpveGViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI3MDI0ODQsImV4cCI6MjA3ODI3ODQ4NH0.gJN6bc3hPQfKX5STwqQOaV_BzZ_CNKBEf9zpxO4pIqc" \
  -d '{
    "model": "deepseek-chat",
    "messages": [
      {"role": "user", "content": "Hello, test message"}
    ],
    "temperature": 0.7
  }'
```

### Test depuis la console du navigateur

```javascript
fetch("https://piaahwlfyvezdfnzoxeb.supabase.co/functions/v1/deepseek-proxy", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBpYWFod2xmeXZlemRmbnpveGViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI3MDI0ODQsImV4cCI6MjA3ODI3ODQ4NH0.gJN6bc3hPQfKX5STwqQOaV_BzZ_CNKBEf9zpxO4pIqc"
  },
  body: JSON.stringify({
    model: "deepseek-chat",
    messages: [{ role: "user", content: "Hello, test message" }],
    temperature: 0.7
  })
})
  .then(r => r.json())
  .then(console.log)
  .catch(console.error);
```

## Logs

Pour voir les logs en temps réel :
```bash
supabase functions logs deepseek-proxy --project-ref piaahwlfyvezdfnzoxeb
```

## Sécurité

- La clé API DeepSeek est stockée comme secret Supabase (jamais exposée dans le code frontend)
- Les headers CORS sont configurés pour autoriser les appels depuis le frontend
- L'authentification Supabase peut être ajoutée si nécessaire (actuellement optionnelle)

## Utilisation dans le code Angular

Le service `AIGameGeneratorService` utilise automatiquement ce proxy. Pas besoin de configuration supplémentaire côté frontend.

## Dépannage

### Erreur "DeepSeek API key not configured"
- Vérifier que le secret `DEEPSEEK_API_KEY` est bien configuré
- Relancer la commande `supabase secrets set`

### Erreur 401 Unauthorized
- Vérifier que la clé API DeepSeek est valide
- Vérifier que la clé n'a pas expiré

### Erreur CORS
- Vérifier que les headers CORS sont bien présents dans la réponse
- S'assurer que la fonction est bien déployée

## Ressources

- [Documentation Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [API DeepSeek](https://api.deepseek.com)
- [Dashboard Supabase](https://supabase.com/dashboard/project/piaahwlfyvezdfnzoxeb)

