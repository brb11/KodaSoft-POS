import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { env } from '../../config/env';

/**
 * At-rest encryption for ZATCA private keys, CSID binary security tokens and
 * secrets. AES-256-GCM with a 256-bit key derived from `ZATCA_ENC_KEY`
 * (falls back to `JWT_SECRET` so existing deployments keep working after the
 * migration). Values are stored as `enc:v1:<iv>:<tag>:<ciphertext>`; legacy
 * plaintext rows are read as-is (decryptSecret falls through), so enabling
 * encryption never bricks existing credentials.
 */
const ALGORITHM = 'aes-256-gcm';
const PREFIX = 'enc:v1:';

function masterKey(): Buffer {
  const secret = env.ZATCA_ENC_KEY || env.JWT_SECRET;
  return createHash('sha256').update(secret).digest();
}

export function encryptSecret(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.startsWith(PREFIX)) return value; // already encrypted
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, masterKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${ciphertext.toString('base64')}`;
}

export function decryptSecret(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!value.startsWith(PREFIX)) return value; // legacy plaintext
  try {
    const body = value.slice(PREFIX.length);
    const [ivB64, tagB64, ctB64] = body.split(':');
    if (!ivB64 || !tagB64 || !ctB64) return value;
    const decipher = createDecipheriv(ALGORITHM, masterKey(), Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    const plaintext = Buffer.concat([decipher.update(Buffer.from(ctB64, 'base64')), decipher.final()]);
    return plaintext.toString('utf8');
  } catch {
    // Wrong key / corrupted row — leave as-is so callers surface a clear error.
    return value;
  }
}
