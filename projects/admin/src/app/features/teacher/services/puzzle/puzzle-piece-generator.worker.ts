// Web Worker pour générer les PNG des pièces de puzzle avec OffscreenCanvas
// Cela évite de bloquer l'UI pendant la génération

self.onmessage = async (event: MessageEvent<{
  imageUrl: string;
  polygonPoints: Array<{ x: number; y: number }>;
  imageWidth: number;
  imageHeight: number;
}>) => {
  try {
    const { imageUrl, polygonPoints, imageWidth, imageHeight } = event.data;

    // Charger l'image
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        // Créer un canvas offscreen
        const canvas = new OffscreenCanvas(imageWidth, imageHeight);
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          self.postMessage({ error: 'Impossible de créer un contexte canvas' });
          return;
        }

        // Créer le chemin du polygone
        ctx.beginPath();
        polygonPoints.forEach((p, i) => {
          const x = p.x * imageWidth;
          const y = p.y * imageHeight;
          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        });
        ctx.closePath();

        // Clipper avec le polygone
        ctx.clip();

        // Dessiner l'image
        ctx.drawImage(img, 0, 0, imageWidth, imageHeight);

        // Convertir en Blob PNG
        canvas.convertToBlob({ type: 'image/png' }).then((blob) => {
          // Convertir le Blob en ArrayBuffer pour le transfert
          blob.arrayBuffer().then((arrayBuffer) => {
            self.postMessage({ blob: arrayBuffer }, { transfer: [arrayBuffer] });
          }).catch((error) => {
            self.postMessage({ error: error.message || 'Erreur lors de la conversion en ArrayBuffer' });
          });
        }).catch((error) => {
          self.postMessage({ error: error.message || 'Erreur lors de la conversion en Blob' });
        });
      } catch (error) {
        self.postMessage({ error: error instanceof Error ? error.message : 'Erreur lors du traitement' });
      }
    };

    img.onerror = () => {
      self.postMessage({ error: 'Erreur lors du chargement de l\'image' });
    };

    img.src = imageUrl;
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : 'Erreur inconnue' });
  }
};
