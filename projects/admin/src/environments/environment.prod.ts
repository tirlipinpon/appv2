export const environment = {
  production: true,
  supabaseUrl: 'https://piaahwlfyvezdfnzoxeb.supabase.co',
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBpYWFod2xmeXZlemRmbnpveGViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI3MDI0ODQsImV4cCI6MjA3ODI3ODQ4NH0.gJN6bc3hPQfKX5STwqQOaV_BzZ_CNKBEf9zpxO4pIqc',
  deepseek: {
    model: 'deepseek-chat',
    // Note: apiKey et baseUrl ne sont plus utilisés côté frontend
    // La clé API est maintenant stockée comme secret Supabase (DEEPSEEK_API_KEY)
  },
  deepseekProxy: {
    url: 'https://piaahwlfyvezdfnzoxeb.supabase.co/functions/v1/deepseek-proxy'
  }
};
