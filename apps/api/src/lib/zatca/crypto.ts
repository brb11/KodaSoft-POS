import { generateKeyPairSync, createHash, createSign, createVerify, createPrivateKey, createPublicKey, X509Certificate, randomFillSync, randomUUID } from 'crypto';
import type { KeyObject } from 'crypto';

// ─────────────────────────────────────────────
// DER primitives
// ─────────────────────────────────────────────

function derLength(len: number): Buffer {
  if (len < 0x80) return Buffer.from([len]);
  const bytes: number[] = [];
  let l = len;
  while (l > 0) {
    bytes.unshift(l & 0xff);
    l >>>= 8;
  }
  return Buffer.from([0x80 | bytes.length, ...bytes]);
}

function tlv(tag: number, content: Buffer): Buffer {
  return Buffer.concat([Buffer.from([tag]), derLength(content.length), content]);
}

function derSeq(...parts: Buffer[]): Buffer {
  return tlv(0x30, Buffer.concat(parts));
}

function derSet(...parts: Buffer[]): Buffer {
  return tlv(0x31, Buffer.concat(parts));
}

function derInteger(value: number | bigint): Buffer {
  let hex = (typeof value === 'bigint' ? value : BigInt(value)).toString(16);
  if (hex.length % 2) hex = `0${hex}`;
  if (parseInt(hex.slice(0, 2), 16) >= 0x80) hex = `00${hex}`;
  return tlv(0x02, Buffer.from(hex, 'hex'));
}

function encodeBase128(value: number): number[] {
  const bytes: number[] = [value & 0x7f];
  let v = value >>> 7;
  while (v > 0) {
    bytes.unshift((v & 0x7f) | 0x80);
    v >>>= 7;
  }
  return bytes;
}

function oidBody(oid: string): number[] {
  const parts = oid.split('.').map(Number);
  const out: number[] = [parts[0] * 40 + parts[1]];
  for (let i = 2; i < parts.length; i++) out.push(...encodeBase128(parts[i]));
  return out;
}

function derOid(oid: string): Buffer {
  return tlv(0x06, Buffer.from(oidBody(oid)));
}

function derUtf8(value: string): Buffer {
  return tlv(0x0c, Buffer.from(value, 'utf8'));
}

function derPrintable(value: string): Buffer {
  return tlv(0x13, Buffer.from(value, 'ascii'));
}

function derBitString(value: Buffer, unused = 0): Buffer {
  return tlv(0x03, Buffer.concat([Buffer.from([unused]), value]));
}

// X.520 name OIDs
export const NAME_OIDS: Record<string, string> = {
  countryName: '2.5.4.6',
  stateOrProvinceName: '2.5.4.8',
  localityName: '2.5.4.7',
  organizationName: '2.5.4.10',
  organizationalUnitName: '2.5.4.11',
  commonName: '2.5.4.3',
};

export const ECDSA_SHA256_OID = '1.2.840.10045.4.3.2';
const ID_EC_PUBLIC_KEY_OID = '1.2.840.10045.2.1';
const PRIME256V1_OID = '1.2.840.10045.3.1.7';

// ─────────────────────────────────────────────
// Key pairs
// ─────────────────────────────────────────────

export interface ZatcaKeyPair {
  publicKeyPem: string;
  privateKeyPem: string;
  /** DER SPKI bytes of the public key */
  publicKeySpkiDer: Buffer;
}

export function generateEccKeyPair(): ZatcaKeyPair {
  const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  return {
    publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
    privateKeyPem: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
    publicKeySpkiDer: publicKey.export({ type: 'spki', format: 'der' }),
  };
}

export function buildEcPublicKeySpki(publicKeyPem: string): Buffer {
  const key = importPublicKey(publicKeyPem);
  return key.export({ type: 'spki', format: 'der' });
}

export function importPrivateKey(pem: string): KeyObject {
  return createPrivateKey(pem);
}

export function importPublicKey(pem: string): KeyObject {
  return createPublicKey(pem);
}

// ─────────────────────────────────────────────
// PEM helpers
// ─────────────────────────────────────────────

export function derToPem(der: Buffer, label: string): string {
  const b64 = der.toString('base64').replace(/(.{64})/g, '$1\n');
  return `-----BEGIN ${label}-----\n${b64}\n-----END ${label}-----\n`;
}

export function pemToDer(pem: string): Buffer {
  const body = pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  return Buffer.from(body, 'base64');
}

// ─────────────────────────────────────────────
// Hashing & signing
// ─────────────────────────────────────────────

export function sha256(data: Buffer | string): Buffer {
  return createHash('sha256').update(data).digest();
}

export function sha256Base64(data: Buffer | string): string {
  return sha256(data).toString('base64');
}

export function sha256Hex(data: Buffer | string): string {
  return sha256(data).toString('hex');
}

export function signData(data: Buffer | string, privateKeyPem: string): Buffer {
  return createSign('sha256').update(data).sign(privateKeyPem);
}

export function signDataBase64(data: Buffer | string, privateKeyPem: string): string {
  return signData(data, privateKeyPem).toString('base64');
}

export function verifyData(data: Buffer | string, signature: Buffer | string, publicKeyPem: string): boolean {
  const sig = Buffer.isBuffer(signature) ? signature : Buffer.from(signature, 'base64');
  return createVerify('sha256').update(data).verify(publicKeyPem, sig);
}

// ─────────────────────────────────────────────
// CSR generation (RFC 2986) — EC P-256
// ─────────────────────────────────────────────

export interface CsrSubject {
  commonName: string;
  organizationName?: string;
  organizationalUnitName?: string;
  countryName?: string;
  localityName?: string;
  stateOrProvinceName?: string;
}

/** ZATCA CSR profile (from the e-invoicing onboarding requirements). */
export interface ZatcaCsrOptions {
  /** Taxpayer's VAT number — emitted as the `UID` directory-name attribute. */
  vatNumber: string;
  /** simplified | standard — drives the `title` attribute + EGS serial type. */
  invoiceType: 'simplified' | 'standard';
  /** sandbox (simulation) | production — selects the certificate template. */
  environment: 'sandbox' | 'production';
  /** Registered address of the EGS (falls back to the subject locality). */
  registeredAddress?: string;
  /** Business category (defaults to "None"). */
  businessCategory?: string;
  /** Solution provider name — component `1-` of the EGS serial number. */
  solutionName?: string;
  /** Solution model/version — component `2-` of the EGS serial number. */
  model?: string;
}

const CERTIFICATE_TEMPLATE_NAME = {
  sandbox: 'PREZATCA-Code-Signing',
  production: 'ZATCA-Code-Signing',
} as const;

// Functionality map ("TSCZ"): Standard | Simplified | Buyer-QR | Self-billing.
// Our solution issues both standard and simplified invoices.
const FUNCTIONALITY_MAP_TITLE = '1100';

// PKCS#10 + ZATCA extension OIDs
const EXTENSION_REQUEST_OID = '1.2.840.113549.1.9.14';
const SUBJECT_ALT_NAME_OID = '2.5.29.17';
const KEY_USAGE_OID = '2.5.29.15';
const BASIC_CONSTRAINTS_OID = '2.5.29.19';
const CERTIFICATE_TEMPLATE_NAME_OID = '1.3.6.1.4.1.311.20.2';
const SERIAL_NUMBER_OID = '2.5.4.5';
const UID_OID = '0.9.2342.19200300.100.1.1';
const TITLE_OID = '2.5.4.12';
const REGISTERED_ADDRESS_OID = '2.5.4.26';
const BUSINESS_CATEGORY_OID = '2.5.4.15';

function derRdn(oid: string, value: string, kind: 'printable' | 'utf8'): Buffer {
  const encoded = kind === 'printable' ? derPrintable(value) : derUtf8(value);
  return derSet(derSeq(derOid(oid), encoded));
}

/**
 * Build a PKCS#10 certification request (PEM) for the given EC key. The CSR is
 * used during ZATCA onboarding to obtain a Compliance CSID.
 *
 * Emits the ZATCA-required extensions via a PKCS#10 `extensionRequest`
 * attribute: `subjectAltName` (directoryName with SN/UID/title/registered
 * address/business category), `certificateTemplateName`
 * (PREZATCA-Code-Signing for simulation, ZATCA-Code-Signing for production),
 * `keyUsage` and `basicConstraints`.
 */
export function buildCsr(subject: CsrSubject, keyPair: ZatcaKeyPair, opts: ZatcaCsrOptions): string {
  const privateKey = importPrivateKey(keyPair.privateKeyPem);

  const rdns: Buffer[] = [];
  for (const [name, oid] of Object.entries(NAME_OIDS)) {
    const value = subject[name as keyof CsrSubject];
    if (!value) continue;
    const encoded = name === 'countryName' ? derPrintable(value) : derUtf8(value);
    rdns.push(derSet(derSeq(derOid(oid), encoded)));
  }
  if (rdns.length === 0) throw new Error('CSR subject must contain at least one attribute');

  const name = derSeq(...rdns);
  const spki = keyPair.publicKeySpkiDer;

  const egsSerial = randomUUID();
  const solutionName = opts.solutionName || 'KodaSoft';
  const model = opts.model || 'POS';
  // EGS Serial Number per the ZATCA spec:
  //   1-<Manufacturer or Solution Provider Name>|2-<Model or Version>|3-<SerialNumber>
  // NOTE: the pipe separators make PrintableString invalid, so this RDN must be
  // encoded as UTF8String — a PrintableString here is rejected as "Invalid-CSR".
  const serialString = `1-${solutionName}|2-${model}|3-${egsSerial}`;
  const registeredAddress = opts.registeredAddress || subject.localityName || '';
  const title = FUNCTIONALITY_MAP_TITLE;

  // subjectAltName = one directoryName general name holding the ZATCA alt_names.
  const altNames = derSeq(
    tlv(
      0xa4,
      derSeq(
        derRdn(SERIAL_NUMBER_OID, serialString, 'utf8'),
        derRdn(UID_OID, opts.vatNumber, 'printable'),
        derRdn(TITLE_OID, title, 'printable'),
        derRdn(REGISTERED_ADDRESS_OID, registeredAddress, 'utf8'),
        derRdn(BUSINESS_CATEGORY_OID, opts.businessCategory || 'None', 'utf8'),
      ),
    ),
  );

  // PKCS#10 extensionRequest attribute (1.2.840.113549.1.9.14).
  const extensions = derSeq(
    derSeq(derOid(BASIC_CONSTRAINTS_OID), derOctet(derSeq(Buffer.from([0x01, 0x01, 0x00])))),
    // digitalSignature | nonRepudiation | keyEncipherment
    derSeq(derOid(KEY_USAGE_OID), derOctet(derBitString(Buffer.from([0xe0]), 5))),
    derSeq(derOid(SUBJECT_ALT_NAME_OID), derOctet(altNames)),
    derSeq(derOid(CERTIFICATE_TEMPLATE_NAME_OID), derOctet(derPrintable(CERTIFICATE_TEMPLATE_NAME[opts.environment]))),
  );
  const extRequest = derSeq(derOid(EXTENSION_REQUEST_OID), derSet(extensions));
  // [0] IMPLICIT SET OF Attribute
  const attributes = tlv(0xa0, extRequest);

  const certificationRequestInfo = derSeq(derInteger(0), name, spki, attributes);
  const signatureAlgorithm = derSeq(derOid(ECDSA_SHA256_OID));
  const signature = createSign('sha256').update(certificationRequestInfo).sign(privateKey);

  const certificationRequest = derSeq(certificationRequestInfo, signatureAlgorithm, derBitString(signature));
  return derToPem(certificationRequest, 'CERTIFICATE REQUEST');
}

// ─────────────────────────────────────────────
// X.509 certificate introspection
// ─────────────────────────────────────────────

export interface ZatcaCertificateInfo {
  serialNumberHex: string;
  serialNumberFormatted: string;
  subject: string;
  issuer: string;
  validFrom: Date;
  validTo: Date;
  publicKeyPem: string;
  /** DER bytes of the certificate (used for XML ds:X509Certificate). */
  der: Buffer;
  certDigestBase64: string;
}

/**
 * Parse an X.509 certificate (PEM or DER) and return the fields needed for
 * invoice signing, the signed properties and the Phase-2 QR code.
 */
export function x509Info(certPemOrDer: Buffer | string): ZatcaCertificateInfo {
  // Node's X509Certificate on some builds only decodes DER reliably; always
  // normalize to DER before parsing.
  const der = normalizeDer(certPemOrDer);
  const cert = new X509Certificate(der);
  return {
    serialNumberHex: cert.serialNumber,
    serialNumberFormatted: formatSerialNumber(cert.serialNumber),
    subject: cert.subject,
    issuer: cert.issuer,
    validFrom: new Date(cert.validFrom),
    validTo: new Date(cert.validTo),
    publicKeyPem: cert.publicKey.export({ type: 'spki', format: 'pem' }).toString(),
    der: cert.raw,
    certDigestBase64: sha256Base64(cert.raw),
  };
}

function normalizeDer(certPemOrDer: Buffer | string): Buffer {
  if (typeof certPemOrDer === 'string') {
    if (certPemOrDer.includes('-----BEGIN')) return pemToDer(certPemOrDer);
    return Buffer.from(certPemOrDer, 'base64');
  }
  return certPemOrDer;
}

/**
 * ZATCA renders the certificate serial number as space-separated 2-hex-digit
 * groups (e.g. `11 22 33 ... 40`). Node exposes it as a plain hex string.
 */
export function formatSerialNumber(serialHex: string): string {
  const cleaned = serialHex.replace(/[^0-9a-fA-F]/g, '');
  return (cleaned.match(/.{1,2}/g) || []).join(' ');
}

/** The ECDSA public key OID + curve parameters, for a self-signed cert used in sandbox testing. */
export function ecPublicKeyAlgorithm(): Buffer {
  return derSeq(derOid(ID_EC_PUBLIC_KEY_OID), derOid(PRIME256V1_OID));
}

// ─────────────────────────────────────────────
// Self-signed X.509 test certificate (sandbox)
// ─────────────────────────────────────────────

function derUtcTime(date: Date): Buffer {
  const s = date
    .toISOString()
    .replace(/[^\d]/g, '')
    .slice(2, 14) + 'Z';
  return tlv(0x17, Buffer.from(s, 'ascii'));
}

function derName(subject: CsrSubject): Buffer {
  const rdns: Buffer[] = [];
  for (const [name, oid] of Object.entries(NAME_OIDS)) {
    const value = subject[name as keyof CsrSubject];
    if (!value) continue;
    const encoded = name === 'countryName' ? derPrintable(value) : derUtf8(value);
    rdns.push(derSet(derSeq(derOid(oid), encoded)));
  }
  return derSeq(...rdns);
}

/**
 * Build a self-signed EC P-256 X.509 test certificate. Used in sandbox mode to
 * exercise the full signing + verification pipeline without a real CSID.
 * The returned certificate is only ever stored in the tenant's sandbox
 * credential and is never sent to FATURA.
 */
export function buildSelfSignedCertificate(subject: CsrSubject, keyPair: ZatcaKeyPair, validDays = 365): string {
  const privateKey = importPrivateKey(keyPair.privateKeyPem);

  const serialNumber = cryptoRandomInt(16);
  const notBefore = new Date(Date.now() - 60 * 60 * 1000);
  const notAfter = new Date(notBefore.getTime() + validDays * 24 * 60 * 60 * 1000);

  const tbs = derSeq(
    Buffer.from([0xa0, 0x03, 0x02, 0x01, 0x02]), // version v3 [0] EXPLICIT INTEGER 2
    derInteger(serialNumber),
    derSeq(derOid(ECDSA_SHA256_OID)),
    derName(subject),
    derSeq(derUtcTime(notBefore), derUtcTime(notAfter)),
    derName(subject),
    keyPair.publicKeySpkiDer,
    // extensions [3] EXPLICIT Extensions
    tlv(
      0xa3,
      derSeq(
        derSeq(derOid('2.5.29.15'), derOctet(derBitString(Buffer.from([0xc0]), 6))), // keyUsage: digitalSignature|nonRepudiation
        derSeq(derOid('2.5.29.19'), derOctet(derSeq(Buffer.from([0x01, 0x01, 0x00])))), // basicConstraints CA:false
      ),
    ),
  );

  const signature = createSign('sha256').update(tbs).sign(privateKey);
  const certDer = derSeq(tbs, derSeq(derOid(ECDSA_SHA256_OID)), derBitString(signature));
  return derToPem(certDer, 'CERTIFICATE');
}

function derOctet(content: Buffer): Buffer {
  return tlv(0x04, content);
}

function cryptoRandomInt(bytes: number): bigint {
  const buf = Buffer.alloc(bytes);
  randomFillSync(buf);
  // Ensure a positive serial (clear the high bit) and a non-zero value.
  buf[0] &= 0x7f;
  if (buf.every((b) => b === 0)) buf[bytes - 1] = 1;
  return BigInt('0x' + buf.toString('hex'));
}
