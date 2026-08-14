/**
 * Upload service for images — Supabase Storage with compressed base64 fallback.
 * 
 * Strategy:
 * 1. Try to upload to Supabase Storage bucket 'kidpark-images'
 * 2. If Storage is not available, fall back to compressed base64 (much smaller than raw)
 */
import { supabase } from './supabase';
import {
  compressItemImage,
  compressGalleryImage,
  compressIconImage,
  compressQRImage,
} from './imageUtils';

const BUCKET_NAME = 'kidpark-images';

/**
 * Generate a unique filename for storage
 */
function generateFilename(folder, originalName) {
  const ext = originalName.split('.').pop() || 'jpg';
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);
  return `${folder}/${timestamp}-${random}.${ext}`;
}

/**
 * Upload an image file to Supabase Storage or fall back to compressed base64.
 * @param {File} file - The image file
 * @param {'items'|'gallery'|'icons'|'pix'} folder - Storage folder name
 * @returns {Promise<string>} - The URL of the uploaded image (or compressed base64 data URL)
 */
export async function uploadImage(file, folder = 'items') {
  // First, compress the image based on type
  let compressed;
  switch (folder) {
    case 'gallery':
      compressed = await compressGalleryImage(file);
      break;
    case 'icons':
      compressed = await compressIconImage(file);
      break;
    case 'pix':
      compressed = await compressQRImage(file);
      break;
    default:
      compressed = await compressItemImage(file);
  }

  // Try Supabase Storage first
  if (supabase) {
    try {
      const filePath = generateFilename(folder, file.name);
      
      const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(filePath, compressed.blob, {
          contentType: compressed.blob.type || 'image/jpeg',
          upsert: false,
        });

      if (error) {
        console.warn('Supabase Storage upload failed, using compressed base64:', error.message);
        // Fall back to compressed base64
        return compressed.dataUrl;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(data.path);

      if (urlData?.publicUrl) {
        return urlData.publicUrl;
      }

      // If we can't get public URL, fall back to compressed base64
      console.warn('Could not get public URL, using compressed base64');
      return compressed.dataUrl;
    } catch (err) {
      console.warn('Storage upload error, using compressed base64:', err);
      return compressed.dataUrl;
    }
  }

  // No Supabase — return compressed base64 (much smaller than raw)
  return compressed.dataUrl;
}

/**
 * Remove an image from Supabase Storage by its URL.
 * Only attempts removal for Supabase Storage URLs.
 */
export async function removeImage(url) {
  if (!supabase || !url) return;
  
  // Only try to remove if it's a Supabase Storage URL
  try {
    const storageUrlPattern = /\/storage\/v1\/object\/public\//;
    if (!storageUrlPattern.test(url)) return;
    
    // Extract path from URL
    const parts = url.split(`/storage/v1/object/public/${BUCKET_NAME}/`);
    if (parts.length < 2) return;
    
    const filePath = parts[1];
    await supabase.storage.from(BUCKET_NAME).remove([filePath]);
  } catch (err) {
    console.warn('Failed to remove image from storage:', err);
  }
}
