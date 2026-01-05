/**
 * Utilitaires pour valider et convertir les URLs vidéo
 */

/**
 * Valide si une URL est un lien vidéo valide (YouTube, Vimeo, etc.)
 */
export function isValidVideoUrl(url: string): boolean {
  if (!url || typeof url !== 'string' || url.trim().length === 0) {
    return false;
  }

  const trimmedUrl = url.trim();
  
  // Patterns pour différentes plateformes vidéo
  const videoPatterns = [
    // YouTube
    /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\/.+/i,
    // Vimeo
    /^https?:\/\/(www\.)?vimeo\.com\/.+/i,
    // Dailymotion
    /^https?:\/\/(www\.)?dailymotion\.com\/.+/i,
    // Autres plateformes courantes
    /^https?:\/\/(www\.)?(twitch\.tv|facebook\.com|instagram\.com|tiktok\.com)\/.+/i,
  ];

  return videoPatterns.some(pattern => pattern.test(trimmedUrl));
}

/**
 * Extrait l'ID vidéo d'une URL YouTube
 */
export function extractYouTubeVideoId(url: string): string | null {
  if (!url) return null;

  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/i,
    /youtube\.com\/.*[?&]v=([^&\n?#]+)/i,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}

/**
 * Extrait l'ID vidéo d'une URL Vimeo
 */
export function extractVimeoVideoId(url: string): string | null {
  if (!url) return null;

  const patterns = [
    /(?:vimeo\.com\/)(\d+)/i,
    /(?:vimeo\.com\/embed\/)(\d+)/i,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}

/**
 * Extrait l'ID vidéo selon la plateforme
 */
export function extractVideoId(url: string, platform: 'youtube' | 'vimeo'): string | null {
  if (platform === 'youtube') {
    return extractYouTubeVideoId(url);
  } else if (platform === 'vimeo') {
    return extractVimeoVideoId(url);
  }
  return null;
}

/**
 * Convertit une URL vidéo en URL embed pour iframe
 * Retourne null si l'URL n'est pas valide ou non supportée
 */
export function getEmbedUrl(url: string): string | null {
  if (!url || typeof url !== 'string') {
    return null;
  }

  const trimmedUrl = url.trim();

  // YouTube
  const youtubeId = extractYouTubeVideoId(trimmedUrl);
  if (youtubeId) {
    return `https://www.youtube.com/embed/${youtubeId}`;
  }

  // Vimeo
  const vimeoId = extractVimeoVideoId(trimmedUrl);
  if (vimeoId) {
    return `https://player.vimeo.com/video/${vimeoId}`;
  }

  // Dailymotion
  const dailymotionMatch = trimmedUrl.match(/dailymotion\.com\/(?:video|embed)\/([^/?]+)/i);
  if (dailymotionMatch && dailymotionMatch[1]) {
    return `https://www.dailymotion.com/embed/video/${dailymotionMatch[1]}`;
  }

  // Si l'URL est valide mais non supportée pour embed, retourner l'URL originale
  if (isValidVideoUrl(trimmedUrl)) {
    return trimmedUrl;
  }

  return null;
}

/**
 * Détecte la plateforme vidéo depuis une URL
 */
export function detectVideoPlatform(url: string): 'youtube' | 'vimeo' | 'dailymotion' | 'other' | null {
  if (!url || typeof url !== 'string') {
    return null;
  }

  const trimmedUrl = url.trim();

  if (extractYouTubeVideoId(trimmedUrl)) {
    return 'youtube';
  }

  if (extractVimeoVideoId(trimmedUrl)) {
    return 'vimeo';
  }

  if (trimmedUrl.includes('dailymotion.com')) {
    return 'dailymotion';
  }

  if (isValidVideoUrl(trimmedUrl)) {
    return 'other';
  }

  return null;
}
