import { randomUUID } from 'crypto';
import { signInvoice } from './sign';
import type { ZatcaInvoiceInput, ZatcaDocumentType, ZatcaParty } from './xml';

export type ComplianceDocumentKind = 'simplified' | 'standard';

export interface ComplianceSampleDoc {
  /** Human-readable label, e.g. "Simplified invoice". */
  name: string;
  kind: ComplianceDocumentKind;
  documentType: ZatcaDocumentType;
  uuid: string;
  invoiceNumber: string;
  invoiceHash: string;
  invoiceBase64: string;
  xml: string;
}

export interface ComplianceSeller {
  name: string;
  vatNumber: string;
}

const SAMPLE_BUYER_VAT = '311111111100003';
const SAMPLE_ITEM_PRICE = 100;

function todayParts(): { date: string; time: string } {
  const now = new Date();
  return {
    date: now.toISOString().slice(0, 10),
    time: now.toISOString().slice(11, 19),
  };
}

/**
 * Build a single compliance sample. Credit/debit notes reference an
 * originating invoice and carry negative amounts, matching the ZATCA samples.
 */
function makeSample(
  seller: ComplianceSeller,
  signingKey: { privateKeyPem: string; certPem: string },
  documentType: ZatcaDocumentType,
  baseType: 'simplified' | 'tax',
  invoiceNumber: string,
  billingReference: { uuid: string; invoiceNumber: string } | undefined,
  previousInvoiceHash: string | undefined,
): ComplianceSampleDoc {
  const negative = documentType === 'credit' || documentType === 'debit';
  const sign = negative ? -1 : 1;
  const { date, time } = todayParts();
  const uuid = `urn:uuid:${randomUUID()}`;
  const buyer: ZatcaParty | undefined =
    baseType === 'tax' ? { name: 'Sample Buyer Co.', vatNumber: SAMPLE_BUYER_VAT } : undefined;

  const input: ZatcaInvoiceInput = {
    uuid,
    invoiceNumber,
    issueDate: date,
    issueTime: time,
    type: documentType,
    baseType,
    billingReference,
    currency: 'SAR',
    seller: { name: seller.name, vatNumber: seller.vatNumber, city: 'Riyadh' },
    buyer,
    lines: [
      {
        id: '1',
        name: 'Sample Item',
        quantity: 1,
        unitPrice: sign * SAMPLE_ITEM_PRICE,
        taxPercent: 15,
        discountAmount: 0,
      },
    ],
    discountAmount: 0,
    subtotal: sign * SAMPLE_ITEM_PRICE,
    taxableAmount: sign * SAMPLE_ITEM_PRICE,
    taxAmount: sign * (SAMPLE_ITEM_PRICE * 0.15),
    total: sign * (SAMPLE_ITEM_PRICE * 1.15),
    notes: negative ? 'مستند إلكتروني للامتثال' : 'فاتورة إلكترونية للامتثال',
    previousInvoiceHash,
  };

  const signed = signInvoice(input, signingKey);
  return {
    name: '',
    kind: 'simplified',
    documentType,
    uuid,
    invoiceNumber,
    invoiceHash: signed.invoiceHash,
    invoiceBase64: signed.xmlBase64,
    xml: signed.xml,
  };
}

/**
 * Generate the six mandatory compliance samples ZATCA requires before a
 * production CSID can be issued:
 *   simplified: invoice, credit note, debit note
 *   standard:   invoice, credit note, debit note
 * Standard documents are chained via the previous-invoice-hash (PIH).
 */
export function buildComplianceSamples(
  seller: ComplianceSeller,
  signingKey: { privateKeyPem: string; certPem: string },
): ComplianceSampleDoc[] {
  const serial = () => String(Math.floor(1_000_000_000 + Math.random() * 8_999_999_999));
  const simplifiedInvoice = makeSample(seller, signingKey, 'simplified', 'simplified', `SIM-${serial()}`, undefined, undefined);
  const simplifiedCredit = makeSample(
    seller,
    signingKey,
    'credit',
    'simplified',
    `SIC-${serial()}`,
    { uuid: simplifiedInvoice.uuid, invoiceNumber: simplifiedInvoice.invoiceNumber },
    undefined,
  );
  const simplifiedDebit = makeSample(
    seller,
    signingKey,
    'debit',
    'simplified',
    `SID-${serial()}`,
    { uuid: simplifiedInvoice.uuid, invoiceNumber: simplifiedInvoice.invoiceNumber },
    undefined,
  );

  const standardInvoice = makeSample(seller, signingKey, 'tax', 'tax', `STI-${serial()}`, undefined, undefined);
  const standardCredit = makeSample(
    seller,
    signingKey,
    'credit',
    'tax',
    `STC-${serial()}`,
    { uuid: standardInvoice.uuid, invoiceNumber: standardInvoice.invoiceNumber },
    standardInvoice.invoiceHash,
  );
  const standardDebit = makeSample(
    seller,
    signingKey,
    'debit',
    'tax',
    `STD-${serial()}`,
    { uuid: standardInvoice.uuid, invoiceNumber: standardInvoice.invoiceNumber },
    standardCredit.invoiceHash,
  );

  return [
    { ...simplifiedInvoice, name: 'Simplified invoice', kind: 'simplified' },
    { ...simplifiedCredit, name: 'Simplified credit note', kind: 'simplified' },
    { ...simplifiedDebit, name: 'Simplified debit note', kind: 'simplified' },
    { ...standardInvoice, name: 'Standard invoice', kind: 'standard' },
    { ...standardCredit, name: 'Standard credit note', kind: 'standard' },
    { ...standardDebit, name: 'Standard debit note', kind: 'standard' },
  ];
}
