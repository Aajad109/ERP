import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export const UPLOADS_DIR = path.join(__dirname, '../../public/uploads');

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

/**
 * Safely save base64 image data to local disk with sanitized filename
 */
export function saveBase64Image(base64Str: string, prefix = 'campus'): string | null {
  try {
    if (!base64Str) return null;

    const matches = base64Str.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      // If it's already a regular HTTP(S) URL or safe /uploads/ path, return as is
      if (base64Str.startsWith('http://') || base64Str.startsWith('https://')) {
        return base64Str;
      }
      if (base64Str.startsWith('/uploads/') && !base64Str.includes('..')) {
        return base64Str;
      }
      return null;
    }

    const mimeType = matches[1];
    const dataBuffer = Buffer.from(matches[2], 'base64');

    // MIME type check (images only)
    const allowedMime = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];
    if (!allowedMime.includes(mimeType)) {
      return null;
    }

    // Max 10MB size limit
    if (dataBuffer.length > 10 * 1024 * 1024) {
      return null;
    }

    const sub = mimeType.split('/')[1] || 'png';
    const ext = sub === 'jpeg' || sub === 'jpg' ? 'jpg' : sub === 'svg+xml' ? 'svg' : sub;
    const filename = `${prefix}_${Date.now()}_${crypto.randomBytes(6).toString('hex')}.${ext}`;
    const filePath = path.join(UPLOADS_DIR, filename);

    fs.writeFileSync(filePath, dataBuffer);
    return `/uploads/${filename}`;
  } catch (err) {
    console.error('Image upload failed:', err);
    return null;
  }
}
