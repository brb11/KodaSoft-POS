// ZATCA validation helpers: VAT number format, invoice business rules.

export interface ValidationIssue {
  code: string;
  message: string;
}

/**
 * Saudi VAT registration numbers are 15 digits and start with "3".
 * Full checksum verification is performed by ZATCA on submission; this
 * enforces the format rules documented in the e-invoicing requirements.
 */
export function validateVatNumber(vat: string | null | undefined): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const value = (vat || '').trim();
  if (!value) {
    issues.push({ code: 'VAT_EMPTY', message: 'VAT number is required' });
    return issues;
  }
  if (!/^\d{15}$/.test(value)) {
    issues.push({ code: 'VAT_LENGTH', message: 'VAT number must be exactly 15 digits' });
  }
  if (!value.startsWith('3')) {
    issues.push({ code: 'VAT_PREFIX', message: 'Saudi VAT numbers must start with 3' });
  }
  return issues;
}

export function isValidVatNumber(vat: string | null | undefined): boolean {
  return validateVatNumber(vat).length === 0;
}

export interface ZatcaInvoiceValidationInput {
  sellerName: string;
  sellerVat: string;
  buyerVat?: string;
  invoiceNumber: string;
  subtotal: number;
  discountAmount: number;
  taxableAmount: number;
  taxAmount: number;
  total: number;
}

/** Basic invoice business-rule checks applied before signing/submission. */
export function validateInvoiceRules(input: ZatcaInvoiceValidationInput): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!input.sellerName.trim()) issues.push({ code: 'SELLER_NAME', message: 'Seller name is required' });
  issues.push(...validateVatNumber(input.sellerVat).map((i) => ({ code: `SELLER_${i.code}`, message: `Seller: ${i.message}` })));
  if (input.buyerVat) {
    issues.push(...validateVatNumber(input.buyerVat).map((i) => ({ code: `BUYER_${i.code}`, message: `Buyer: ${i.message}` })));
  }
  if (!input.invoiceNumber.trim()) issues.push({ code: 'INVOICE_NUMBER', message: 'Invoice number is required' });

  const eps = 0.011; // allow cent-level rounding differences
  if (Math.abs(input.taxableAmount - (input.subtotal - input.discountAmount)) > eps) {
    issues.push({
      code: 'AMOUNT_MISMATCH',
      message: `Taxable amount (${input.taxableAmount.toFixed(2)}) must equal subtotal minus discount (${(input.subtotal - input.discountAmount).toFixed(2)})`,
    });
  }
  if (input.taxAmount < 0 || input.total < 0 || input.subtotal < 0) {
    issues.push({ code: 'NEGATIVE_AMOUNT', message: 'Amounts cannot be negative' });
  }
  if (Math.abs(input.total - (input.taxableAmount + input.taxAmount)) > eps) {
    issues.push({
      code: 'TOTAL_MISMATCH',
      message: `Total (${input.total.toFixed(2)}) must equal taxable amount plus tax (${(input.taxableAmount + input.taxAmount).toFixed(2)})`,
    });
  }
  return issues;
}
