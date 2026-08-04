export interface ZatcaQrInput {
  sellerName: string;
  vatNumber: string;
  timestamp: Date;
  total: number;
  vat: number;
}

function tlv(tag: number, value: string): number[] {
  const bytes = new TextEncoder().encode(value);
  return [tag, bytes.length, ...Array.from(bytes)];
}

export function formatZatcaTimestamp(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

// ZATCA Phase-1 QR payload: base64 of the TLV-encoded fields
// (1) seller name, (2) VAT number, (3) timestamp, (4) total, (5) VAT amount.
export function zatcaQrBase64(input: ZatcaQrInput): string {
  const bytes = new Uint8Array(
    [
      tlv(1, input.sellerName),
      tlv(2, input.vatNumber),
      tlv(3, formatZatcaTimestamp(input.timestamp)),
      tlv(4, input.total.toFixed(2)),
      tlv(5, input.vat.toFixed(2)),
    ].flat(),
  );
  let binary = '';
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
}
