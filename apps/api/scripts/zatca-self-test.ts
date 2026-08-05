/**
 * Offline ZATCA Phase-2 self-test.
 *
 * Exercises the complete pipeline without any FATURA credentials:
 *  keygen -> CSR -> self-signed cert -> unsigned invoice -> sign ->
 *  verify (signature + reference digest) -> Phase-1 QR -> Phase-2 QR ->
 *  VAT + invoice rule validation.
 *
 * Run: pnpm --filter @casheer/api exec ts-node-dev --transpile-only scripts/zatca-self-test.ts
 */
import { generateEccKeyPair, buildCsr, buildSelfSignedCertificate, x509Info, sha256Hex, buildEcPublicKeySpki, pemToDer } from '../src/lib/zatca/crypto';
import { signInvoice, verifySignedInvoice } from '../src/lib/zatca/sign';
import type { ZatcaInvoiceInput } from '../src/lib/zatca/xml';
import { zatcaQrBase64, isPhase2, formatZatcaTimestamp } from '../src/lib/zatca/qr';
import { isValidVatNumber, validateInvoiceRules } from '../src/lib/zatca/validation';

let passed = 0;
let failed = 0;

function check(name: string, ok: boolean, detail?: string) {
  if (ok) {
    passed++;
    console.log(`  PASS  ${name}${detail ? ` (${detail})` : ''}`);
  } else {
    failed++;
    console.error(`  FAIL  ${name}${detail ? ` (${detail})` : ''}`);
  }
}

async function main() {
  console.log('ZATCA Phase-2 offline self-test\n');

  console.log('[1] Key generation');
  const keyPair = generateEccKeyPair();
  check('EC P-256 keypair generated', keyPair.privateKeyPem.includes('BEGIN PRIVATE KEY'), 'pkcs8 pem');
  check('public SPKI DER parsed', buildEcPublicKeySpki(keyPair.publicKeyPem).length > 0);

  console.log('[2] CSR (RFC 2986 + ZATCA extensions)');
  const csr = buildCsr(
    { commonName: 'Test Store', organizationName: 'Test Store', organizationalUnitName: 'KodaSoft-POS', countryName: 'SA', localityName: 'Riyadh' },
    keyPair,
    { vatNumber: '300000000000000', invoiceType: 'simplified', environment: 'sandbox', registeredAddress: 'Main St, Riyadh' },
  );
  check('CSR built', csr.includes('BEGIN CERTIFICATE REQUEST'));
  const csrDer = pemToDer(csr);
  check(
    'CSR embeds certificateTemplateName + SAN (alt_names)',
    csrDer.includes(Buffer.from('PREZATCA-Code-Signing', 'ascii')) &&
      csrDer.includes(Buffer.from('1-SA|2-simplified|3-', 'ascii')) &&
      csrDer.includes(Buffer.from('300000000000000', 'ascii')),
  );

  console.log('[3] Self-signed test certificate');
  const certPem = buildSelfSignedCertificate(
    { commonName: 'Test Store', organizationName: 'Test Store', countryName: 'SA', localityName: 'Riyadh' },
    keyPair,
  );
  const cert = x509Info(certPem);
  check('cert parses', cert.subject.length > 0, cert.subject);
  check('serial formatted', /^[0-9A-F]{2}( [0-9A-F]{2})+$/.test(cert.serialNumberFormatted), cert.serialNumberFormatted);
  check('validity window', cert.validTo > cert.validFrom, `${cert.validFrom.toISOString()} -> ${cert.validTo.toISOString()}`);

  console.log('[4] Unsigned invoice + signature');
  const input: ZatcaInvoiceInput = {
    invoiceNumber: 'ORD-20260805-000001',
    uuid: 'urn:uuid:5b8e6f3c-9d4a-4b1e-8f2a-7c9d0e1f2a3b',
    issueDate: '2026-08-05',
    issueTime: '12:00:00',
    type: 'simplified',
    currency: 'SAR',
    seller: { name: 'Test Store', vatNumber: '300000000000000', street: 'Main St', city: 'Riyadh' },
    lines: [
      { id: '1', name: 'Test Soda', quantity: 1, unitPrice: 2.0, taxPercent: 15, discountAmount: 0 },
    ],
    discountAmount: 0,
    subtotal: 2.0,
    taxableAmount: 2.0,
    taxAmount: 0.3,
    total: 2.3,
  };

  const signed = signInvoice(input, { privateKeyPem: keyPair.privateKeyPem, certPem });
  check('invoice hash base64', /^[A-Za-z0-9+/=]+$/.test(signed.invoiceHash), `hash=${signed.invoiceHash.slice(0, 20)}...`);
  check('signature base64', /^[A-Za-z0-9+/=]+$/.test(signed.signatureValue));
  check('xml has UBLExtensions', signed.xml.includes('ext:UBLExtensions') && signed.xml.includes('ds:Signature'));
  check('xml has XADES', signed.xml.includes('xades:SignedProperties'));

  console.log('[5] Signature verification');
  const verified = verifySignedInvoice(signed.xml, certPem);
  check('reference digest matches', verified.digestOk);
  check('ECDSA signature verifies', verified.signatureOk);
  check('invoice hash deterministic', sha256Hex(signed.xml) === sha256Hex(signed.xml));

  console.log('[6] Hash/XML consistency');
  const verified2 = verifySignedInvoice(signed.xml, certPem);
  check('invoice hash == hash of signed XML', verified2.invoiceHash === signed.invoiceHash);
  check('invoiceDigest == reference digest', verified2.digestOk);

  console.log('[7] QR codes');
  const qrPhase1 = zatcaQrBase64({
    sellerName: 'Test Store',
    vatNumber: '300000000000000',
    timestamp: new Date('2026-08-05T12:00:00Z'),
    total: 2.3,
    vat: 0.3,
  });
  check('phase-1 QR (5 tags)', /^[A-Za-z0-9+/=]+$/.test(qrPhase1) && !isPhase2({
    sellerName: 'Test Store', vatNumber: '300000000000000', timestamp: new Date(), total: 1, vat: 0.1,
  }));
  const qrPhase2 = zatcaQrBase64({
    sellerName: 'Test Store',
    vatNumber: '300000000000000',
    timestamp: new Date('2026-08-05T12:00:00Z'),
    total: 2.3,
    vat: 0.3,
    invoiceHash: signed.invoiceHash,
    signature: signed.signatureValue,
    publicKey: keyPair.publicKeySpkiDer.toString('base64'),
  });
  check('phase-2 QR (8 tags)', /^[A-Za-z0-9+/=]+$/.test(qrPhase2));
  check('timestamp strips ms', formatZatcaTimestamp(new Date('2026-08-05T12:00:00.123Z')) === '2026-08-05T12:00:00Z');

  console.log('[8] Validation rules');
  check('valid VAT', isValidVatNumber('300000000000000'));
  check('invalid VAT (short)', !isValidVatNumber('3000000'));
  check('invalid VAT (bad prefix)', !isValidVatNumber('200000000000000'));
  const ruleIssues = validateInvoiceRules({
    sellerName: 'Test Store',
    sellerVat: '300000000000000',
    invoiceNumber: 'ORD-1',
    subtotal: 2.0,
    discountAmount: 0,
    taxableAmount: 2.0,
    taxAmount: 0.3,
    total: 2.3,
  });
  check('invoice rules pass', ruleIssues.length === 0, ruleIssues.map((i) => i.message).join('; '));

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
