/**
 * compressor.js
 *
 * Image compression helper used before storing image clipboard items in
 * IndexedDB. Accepts a base64 data URL, downscales/encodes via OffscreenCanvas
 * (works in service worker AND popup), and returns a compressed data URL
 * targeting the requested max byte size.
 *
 * If anything goes sideways (CORS, missing canvas APIs in older runtimes),
 * the original data URL is returned unchanged — never throw, never lose data.
 */

const LOG = '[SCM:compress]';

/**
 * Compress an image data URL until it fits below `maxBytes`.
 * @param {string} dataUrl  Base64 image data URL.
 * @param {number} maxBytes Target maximum byte size.
 * @returns {Promise<string>} Compressed (or original) data URL.
 */
export async function compressImageDataUrl(dataUrl, maxBytes = 200 * 1024) {
  if (!dataUrl || !dataUrl.startsWith('data:image')) return dataUrl;
  if (estimateBytes(dataUrl) <= maxBytes) return dataUrl;

  try {
    const blob = await (await fetch(dataUrl)).blob();
    const bitmap = await createImageBitmap(blob);

    // Step down quality and resolution until we hit the target.
    let width = bitmap.width;
    let height = bitmap.height;
    let quality = 0.85;
    let out = dataUrl;

    for (let attempt = 0; attempt < 8; attempt++) {
      const canvas = new OffscreenCanvas(width, height);
      const ctx = canvas.getContext('2d');
      if (!ctx) break;
      ctx.drawImage(bitmap, 0, 0, width, height);
      const compressedBlob = await canvas.convertToBlob({ type: 'image/jpeg', quality });
      out = await blobToDataURL(compressedBlob);
      if (estimateBytes(out) <= maxBytes) return out;

      // Aggressively shrink: drop quality first, then dims.
      if (quality > 0.4) quality -= 0.15;
      else { width = Math.round(width * 0.8); height = Math.round(height * 0.8); }
      if (width < 64 || height < 64) break;
    }
    return out;
  } catch (err) {
    console.warn(LOG, 'compress failed, returning original', err);
    return dataUrl;
  }
}

function estimateBytes(dataUrl) {
  const i = dataUrl.indexOf(',');
  const b64 = i >= 0 ? dataUrl.slice(i + 1) : dataUrl;
  // base64 -> bytes: roughly len * 3/4 minus padding.
  return Math.ceil(b64.length * 0.75);
}

function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
