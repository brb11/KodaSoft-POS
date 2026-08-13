import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../config/env', () => ({
  env: { ZATCA_ENC_KEY: 'test-zatca-encryption-key', JWT_SECRET: 'test-jwt-secret-fallback' },
}));

import { env } from '../../config/env';
import { encryptSecret, decryptSecret } from './encrypt';

const PLAINTEXT = 'MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDsecret';

describe('encryptSecret / decryptSecret', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (env as any).ZATCA_ENC_KEY = 'test-zatca-encryption-key';
  });

  it('returns null for null/undefined/empty input', () => {
    expect(encryptSecret(null)).toBeNull();
    expect(encryptSecret(undefined)).toBeNull();
    expect(encryptSecret('')).toBeNull();
    expect(decryptSecret(null)).toBeNull();
    expect(decryptSecret(undefined)).toBeNull();
    expect(decryptSecret('')).toBeNull();
  });

  it('never leaks the plaintext into the stored value', () => {
    const enc = encryptSecret(PLAINTEXT)!;
    expect(enc.startsWith('enc:v1:')).toBe(true);
    expect(enc).not.toContain(PLAINTEXT);
  });

  it('produces a unique ciphertext per call (random IV)', () => {
    expect(encryptSecret(PLAINTEXT)).not.toBe(encryptSecret(PLAINTEXT));
  });

  it('round-trips a value', () => {
    expect(decryptSecret(encryptSecret(PLAINTEXT))).toBe(PLAINTEXT);
  });

  it('passes legacy plaintext rows through as-is', () => {
    expect(decryptSecret(PLAINTEXT)).toBe(PLAINTEXT);
  });

  it('is idempotent (does not double-encrypt)', () => {
    const once = encryptSecret(PLAINTEXT)!;
    expect(encryptSecret(once)).toBe(once);
  });

  it('handles multi-line PEM and non-ASCII input', () => {
    const v = '-----BEGIN PRIVATE KEY-----\nعربي mixed 漢字\n-----END PRIVATE KEY-----';
    expect(decryptSecret(encryptSecret(v))).toBe(v);
  });

  it('fails open (returns ciphertext) when the master key changed', () => {
    const enc = encryptSecret(PLAINTEXT)!;
    (env as any).ZATCA_ENC_KEY = 'a-different-encryption-key';
    expect(decryptSecret(enc)).toBe(enc);
  });
});
