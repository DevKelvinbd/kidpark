/**
 * Image compression utility using Canvas API.
 * Resizes and compresses images before upload to keep payloads small.
 */

/**
 * Compress an image file by resizing and reducing quality.
 * @param {File} file - The image file to compress
 * @param {object} options
 * @param {number} [options.maxWidth=800] - Maximum width in pixels
 * @param {number} [options.maxHeight=800] - Maximum height in pixels  
 * @param {number} [options.quality=0.8] - JPEG quality (0-1)
 * @param {string} [options.outputType='image/jpeg'] - Output MIME type
 * @returns {Promise<{blob: Blob, dataUrl: string, width: number, height: number}>}
 */
export async function compressImage(file, options = {}) {
  const {
    maxWidth = 800,
    maxHeight = 800,
    quality = 0.8,
    outputType = 'image/jpeg',
  } = options;

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let { width, height } = img;

      // Calculate new dimensions maintaining aspect ratio
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      // Draw to canvas
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      // Convert to blob
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Falha ao comprimir imagem'));
            return;
          }
          const dataUrl = canvas.toDataURL(outputType, quality);
          resolve({ blob, dataUrl, width, height });
        },
        outputType,
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Falha ao carregar imagem'));
    };

    img.src = url;
  });
}

/**
 * Compress specifically for item thumbnails (smaller size)
 */
export function compressItemImage(file) {
  return compressImage(file, { maxWidth: 800, maxHeight: 800, quality: 0.8 });
}

/**
 * Compress for gallery images (larger size allowed)
 */
export function compressGalleryImage(file) {
  return compressImage(file, { maxWidth: 1200, maxHeight: 1200, quality: 0.85 });
}

/**
 * Compress for icons (small size)
 */
export function compressIconImage(file) {
  return compressImage(file, { maxWidth: 256, maxHeight: 256, quality: 0.9 });
}

/**
 * Compress for QR Code (keep quality high, moderate size)
 */
export function compressQRImage(file) {
  return compressImage(file, { maxWidth: 512, maxHeight: 512, quality: 0.95, outputType: 'image/png' });
}
