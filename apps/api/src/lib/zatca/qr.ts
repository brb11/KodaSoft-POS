// ZATCA TLV QR code generation — Phase 1 (5 tags) and Phase 2 (8/9 tags).

export interface ZatcaQrInput {
  sellerName: string;
  vatNumber: string;
  /** UTC timestamp, milliseconds are stripped. */
  timestamp: Date;
  total: number;
  vat: number;
  /** Phase 2: base64 invoice hash. */
  invoiceHash?: string;
  /** Phase 2: base64 ECDSA signature. */
  signature?: string;
  /** Phase 2: base64 EGS public key (SPKI DER). */
  publicKey?: string;
  /** Phase 2 (tax invoices): base64 previous invoice hash. */
  previousInvoiceHash?: string;
}

export function formatZatcaTimestamp(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function encodeTag(tag: number, value: string): Buffer {
  const bytes = Buffer.from(value, 'utf8');
  if (bytes.length > 255) throw new Error(`ZATCA TLV tag ${tag} value exceeds 255 bytes`);
  return Buffer.concat([Buffer.from([tag, bytes.length]), bytes]);
}

function tlvBytes(input: ZatcaQrInput): Buffer {
  const parts: Buffer[] = [
    encodeTag(1, input.sellerName),
    encodeTag(2, input.vatNumber),
    encodeTag(3, formatZatcaTimestamp(input.timestamp)),
    encodeTag(4, input.total.toFixed(2)),
    encodeTag(5, input.vat.toFixed(2)),
  ];
  if (input.invoiceHash !== undefined) {
    if (input.signature === undefined || input.publicKey === undefined) {
      throw new Error('Phase-2 QR requires invoiceHash, signature and publicKey');
    }
    parts.push(encodeTag(6, input.invoiceHash));
    parts.push(encodeTag(7, input.signature));
    parts.push(encodeTag(8, input.publicKey));
    if (input.previousInvoiceHash !== undefined) parts.push(encodeTag(9, input.previousInvoiceHash));
  }
  return Buffer.concat(parts);
}

export function zatcaQrBase64(input: ZatcaQrInput): string {
  return tlvBytes(input).toString('base64');
}

export function isPhase2(input: ZatcaQrInput): boolean {
  return input.invoiceHash !== undefined && input.signature !== undefined && input.publicKey !== undefined;
}
