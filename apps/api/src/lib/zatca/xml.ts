import { DOMImplementation } from '@xmldom/xmldom';
import type { Document, Element, Node } from '@xmldom/xmldom';
import { XMLNS, XMLNS_XSI, CURRENCY, ZATCA_CUSTOMIZATION_ID_SIMPLIFIED, ZATCA_CUSTOMIZATION_ID_TAX, PROFILE_ID_REPORTING, PROFILE_ID_CLEARANCE, INVOICE_TYPE_CODE } from './const';

// ─────────────────────────────────────────────
// DOM helpers
// ─────────────────────────────────────────────

type Child = string | Node;

function nsFor(prefix: string): string {
  const ns = (XMLNS as Record<string, string>)[prefix];
  if (!ns) throw new Error(`Unknown namespace prefix "${prefix}"`);
  return ns;
}

export function el(doc: Document, localName: string, attrs: Record<string, string> = {}, children: Child[] = []): Element {
  const e = doc.createElementNS(nsFor(localName.split(':')[0]), localName);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  for (const c of children) {
    if (!c) continue;
    if (typeof c === 'string') e.appendChild(doc.createTextNode(c));
    else e.appendChild(c);
  }
  return e;
}

export function createXmlDocument(): { doc: Document; root: Element } {
  const impl = new DOMImplementation();
  const doc = impl.createDocument(XMLNS.ubl, 'Invoice', null) as unknown as Document;
  const root = doc.documentElement as unknown as Element;
  root.setAttributeNS('http://www.w3.org/2000/xmlns/', 'xmlns', XMLNS.ubl);
  for (const [prefix, uri] of Object.entries(XMLNS)) {
    if (prefix !== 'ubl') root.setAttributeNS('http://www.w3.org/2000/xmlns/', `xmlns:${prefix}`, uri);
  }
  return { doc, root };
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;')
    .replace(/\t/g, '&#x9;')
    .replace(/\n/g, '&#xA;')
    .replace(/\r/g, '&#xD;');
}

function escapeText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\r/g, '&#xD;');
}

/** Compact, deterministic XML serialization used for storage + submission. */
export function serializeXml(node: Node): string {
  if (node.nodeType === 1) {
    const e = node as Element;
    let s = `<${e.tagName}`;
    for (let i = 0; i < e.attributes.length; i++) {
      const a = e.attributes.item(i)!;
      s += ` ${a.name}="${escapeAttr(a.value)}"`;
    }
    s += '>';
    for (const child of Array.from(e.childNodes)) s += serializeXml(child);
    s += `</${e.tagName}>`;
    return s;
  }
  if (node.nodeType === 3) return escapeText(node.nodeValue || '');
  if (node.nodeType === 4) return `<![CDATA[${node.nodeValue || ''}]]>`;
  if (node.nodeType === 8) return `<!--${node.nodeValue || ''}-->`;
  return '';
}

// ─────────────────────────────────────────────
// Invoice model
// ─────────────────────────────────────────────

export interface ZatcaInvoiceLine {
  id: string;
  name: string;
  nameAr?: string;
  quantity: number;
  /** Unit price EXCLUDING tax. */
  unitPrice: number;
  /** VAT percentage for this line (e.g. 15). */
  taxPercent: number;
  /** Per-line discount amount (exclusive of tax). */
  discountAmount?: number;
}

export interface ZatcaParty {
  name: string;
  vatNumber: string;
  street?: string;
  city?: string;
}

export type ZatcaDocumentType = 'simplified' | 'tax' | 'credit' | 'debit';

export interface ZatcaInvoiceInput {
  uuid: string;
  invoiceNumber: string;
  issueDate: string;
  issueTime: string;
  /** simplified/tax = invoice (388), credit = credit note (381), debit = debit note (383). */
  type: ZatcaDocumentType;
  /**
   * For credit/debit notes: whether the underlying (originating) document is
   * a simplified or a standard (tax) invoice. Drives the customization ID.
   */
  baseType?: 'simplified' | 'tax';
  /** Reference to the originating invoice, required for credit/debit notes. */
  billingReference?: { uuid: string; invoiceNumber: string };
  currency?: string;
  seller: ZatcaParty;
  buyer?: ZatcaParty;
  lines: ZatcaInvoiceLine[];
  /** LineExtensionAmount (sum of line subtotals before order discount). */
  subtotal: number;
  /** AllowanceTotalAmount (order-level discount). */
  discountAmount: number;
  /** TaxExclusiveAmount = subtotal - discountAmount. */
  taxableAmount: number;
  taxAmount: number;
  total: number;
  notes?: string;
  /** Previous invoice hash (PIH) for tax invoices. */
  previousInvoiceHash?: string;
}

export function money(value: number): string {
  return value.toFixed(2);
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function taxCategory(doc: Document, percent: number, cur: string): Element {
  return el(doc, 'cac:TaxCategory', {}, [
    el(doc, 'cbc:ID', {}, ['S']),
    el(doc, 'cbc:Percent', {}, [String(percent)]),
    el(doc, 'cac:TaxScheme', {}, [el(doc, 'cbc:ID', {}, ['VAT'])]),
  ]);
}

function taxSubtotal(doc: Document, taxable: number, tax: number, percent: number, cur: string): Element {
  return el(doc, 'cac:TaxSubtotal', {}, [
    el(doc, 'cbc:TaxableAmount', { currencyID: cur }, [money(taxable)]),
    el(doc, 'cbc:TaxAmount', { currencyID: cur }, [money(tax)]),
    taxCategory(doc, percent, cur),
  ]);
}

/**
 * Build the UBL 2.1 invoice document WITHOUT the signature extension. The
 * unsigned document is canonicalized to compute the ds:Reference digest.
 */
export function buildUnsignedInvoice(input: ZatcaInvoiceInput): { doc: Document; root: Element } {
  const { doc, root } = createXmlDocument();
  const cur = input.currency || CURRENCY;

  const standard = input.type === 'tax' || input.baseType === 'tax';
  const customizationId = standard ? ZATCA_CUSTOMIZATION_ID_TAX : ZATCA_CUSTOMIZATION_ID_SIMPLIFIED;
  const profileId = standard ? PROFILE_ID_CLEARANCE : PROFILE_ID_REPORTING;
  const typeCode =
    input.type === 'credit'
      ? INVOICE_TYPE_CODE.CREDIT_NOTE
      : input.type === 'debit'
        ? INVOICE_TYPE_CODE.DEBIT_NOTE
        : INVOICE_TYPE_CODE.SIMPLIFIED;
  const typeName = standard ? '0100000' : '0200000';

  root.setAttributeNS(XMLNS_XSI, 'xsi:schemaLocation', `${XMLNS.ubl} ${XMLNS.ubl.replace(/Invoice-2$/, 'Invoice-2.xsd')}`);

  root.appendChild(el(doc, 'cbc:UBLVersionID', {}, ['2.1']));
  root.appendChild(el(doc, 'cbc:CustomizationID', {}, [customizationId]));
  root.appendChild(el(doc, 'cbc:ProfileID', {}, [profileId]));
  root.appendChild(el(doc, 'cbc:ID', {}, [input.invoiceNumber]));
  root.appendChild(el(doc, 'cbc:UUID', {}, [input.uuid]));
  root.appendChild(el(doc, 'cbc:IssueDate', {}, [input.issueDate]));
  root.appendChild(el(doc, 'cbc:IssueTime', {}, [input.issueTime]));
  root.appendChild(el(doc, 'cbc:InvoiceTypeCode', { name: typeName }, [typeCode]));
  root.appendChild(el(doc, 'cbc:Note', { languageID: 'ar' }, [input.notes || 'بضاعة مباعة']));
  root.appendChild(el(doc, 'cbc:DocumentCurrencyCode', {}, [cur]));

  // Reference to the originating invoice (mandatory for credit/debit notes).
  if (input.billingReference) {
    root.appendChild(
      el(doc, 'cac:BillingReference', {}, [
        el(doc, 'cac:InvoiceDocumentReference', {}, [
          el(doc, 'cbc:ID', {}, [input.billingReference.invoiceNumber]),
          el(doc, 'cbc:UUID', {}, [input.billingReference.uuid]),
        ]),
      ]),
    );
  }

  // Seller party
  root.appendChild(
    el(doc, 'cac:AccountingSupplierParty', {}, [
      el(doc, 'cac:Party', {}, [
        el(doc, 'cac:PartyIdentification', {}, [el(doc, 'cbc:ID', { schemeID: 'CRN' }, [input.seller.vatNumber])]),
        el(doc, 'cac:PostalAddress', {}, [
          el(doc, 'cbc:CityName', {}, [input.seller.city || 'Riyadh']),
          el(doc, 'cac:Country', {}, [el(doc, 'cbc:IdentificationCode', {}, ['SA'])]),
        ]),
        el(doc, 'cac:PartyTaxScheme', {}, [
          el(doc, 'cbc:CompanyID', {}, [input.seller.vatNumber]),
          el(doc, 'cac:TaxScheme', {}, [el(doc, 'cbc:ID', {}, ['VAT'])]),
        ]),
        el(doc, 'cac:PartyLegalEntity', {}, [
          el(doc, 'cbc:RegistrationName', {}, [input.seller.name]),
          el(doc, 'cbc:CompanyID', { schemeID: 'CRN', schemeAgencyID: '310' }, [input.seller.vatNumber]),
        ]),
      ]),
    ]),
  );

  // Buyer party (standard/tax documents only)
  if (standard && input.buyer) {
    root.appendChild(
      el(doc, 'cac:AccountingCustomerParty', {}, [
        el(doc, 'cac:Party', {}, [
          el(doc, 'cac:PartyTaxScheme', {}, [
            el(doc, 'cbc:CompanyID', {}, [input.buyer.vatNumber]),
            el(doc, 'cac:TaxScheme', {}, [el(doc, 'cbc:ID', {}, ['VAT'])]),
          ]),
          el(doc, 'cac:PartyLegalEntity', {}, [
            el(doc, 'cbc:RegistrationName', {}, [input.buyer.name]),
            el(doc, 'cbc:CompanyID', { schemeID: 'CRN' }, [input.buyer.vatNumber]),
          ]),
        ]),
      ]),
    );
  }

  // Tax total
  root.appendChild(
    el(doc, 'cac:TaxTotal', {}, [
      el(doc, 'cbc:TaxAmount', { currencyID: cur }, [money(input.taxAmount)]),
      taxSubtotal(doc, input.taxableAmount, input.taxAmount, 15, cur),
    ]),
  );

  // Legal monetary total
  root.appendChild(
    el(doc, 'cac:LegalMonetaryTotal', {}, [
      el(doc, 'cbc:LineExtensionAmount', { currencyID: cur }, [money(input.subtotal)]),
      el(doc, 'cbc:TaxExclusiveAmount', { currencyID: cur }, [money(input.taxableAmount)]),
      el(doc, 'cbc:TaxInclusiveAmount', { currencyID: cur }, [money(input.total)]),
      el(doc, 'cbc:AllowanceTotalAmount', { currencyID: cur }, [money(input.discountAmount)]),
      el(doc, 'cbc:PayableAmount', { currencyID: cur }, [money(input.total)]),
    ]),
  );

  // Invoice lines
  input.lines.forEach((line, idx) => {
    const lineSubtotal = round2(line.unitPrice * line.quantity);
    const lineDiscount = line.discountAmount || 0;
    const taxable = round2(lineSubtotal - lineDiscount);
    const lineTax = round2((taxable * line.taxPercent) / 100);
    const names: Child[] = [el(doc, 'cbc:Name', {}, [line.name])];
    if (line.nameAr) names.push(el(doc, 'cbc:Name', { languageID: 'ar' }, [line.nameAr]));

    root.appendChild(
      el(doc, 'cac:InvoiceLine', {}, [
        el(doc, 'cbc:ID', {}, [String(line.id || idx + 1)]),
        el(doc, 'cbc:InvoicedQuantity', { unitCode: 'PCE', unitCodeListID: 'UNECERec20' }, [String(line.quantity)]),
        el(doc, 'cbc:LineExtensionAmount', { currencyID: cur }, [money(lineSubtotal)]),
        el(doc, 'cac:Item', {}, names),
        el(doc, 'cac:TaxTotal', {}, [
          el(doc, 'cbc:TaxAmount', { currencyID: cur }, [money(lineTax)]),
          taxSubtotal(doc, taxable, lineTax, line.taxPercent, cur),
        ]),
        el(doc, 'cac:Price', {}, [el(doc, 'cbc:PriceAmount', { currencyID: cur }, [money(line.unitPrice)])]),
      ]),
    );
  });

  return { doc, root };
}

function findChildByName(parent: Element, localName: string): Element | null {
  for (const child of Array.from(parent.childNodes)) {
    if (child.nodeType === 1 && (child as Element).tagName === localName) return child as Element;
  }
  return null;
}

/**
 * Insert the Phase-2 QR code into the invoice as a UBL `AdditionalDocumentReference`
 * with `cbc:ID` = "QR". Placed before BillingReference / the supplier party to keep
 * the UBL sequence order valid. Returns the created element.
 */
export function attachQrReference(doc: Document, root: Element, qrBase64: string): Element {
  const ref = el(doc, 'cac:AdditionalDocumentReference', {}, [
    el(doc, 'cbc:ID', {}, ['QR']),
    el(doc, 'cac:Attachment', {}, [
      el(doc, 'cbc:EmbeddedDocumentBinaryObject', { mimeCode: 'text/plain' }, [qrBase64]),
    ]),
  ]);
  const billingReference = findChildByName(root, 'cac:BillingReference');
  if (billingReference) {
    root.insertBefore(ref, billingReference);
  } else {
    root.insertBefore(ref, findChildByName(root, 'cac:AccountingSupplierParty') || root.firstChild!);
  }
  return ref;
}

/**
 * Remove the QR `AdditionalDocumentReference` from an already-built invoice.
 * Used when re-verifying the reference digest (the QR is excluded from the hash).
 */
export function detachQrReference(root: Element): void {
  for (const child of Array.from(root.childNodes)) {
    if (child.nodeType !== 1) continue;
    const e = child as Element;
    if (e.tagName !== 'cac:AdditionalDocumentReference') continue;
    const id = findChildByName(e, 'cbc:ID');
    if (id?.textContent === 'QR') root.removeChild(e);
  }
}
