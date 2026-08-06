// ZATCA e-invoicing: XML namespaces, identifiers and FATURA endpoint defaults.

export const XMLNS = {
  ubl: 'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2',
  ccts: 'urn:un:unece:uncefact:documentation:2',
  cac: 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2',
  cbc: 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2',
  ext: 'urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2',
  qdt: 'urn:oasis:names:specification:ubl:schema:xsd:QualifiedDatatypes-2',
  udt: 'urn:un:unece:uncefact:data:specification:UnqualifiedDataTypesSchemaModule:2',
  sig: 'urn:oasis:names:specification:ubl:schema:xsd:CommonSignatureComponents-2',
  ds: 'http://www.w3.org/2000/09/xmldsig#',
  xades: 'http://uri.etsi.org/01903/v1.3.2#',
  xsi: 'http://www.w3.org/2001/XMLSchema-instance',
} as const;

export const XMLNS_XSI = XMLNS.xsi;

export const ZATCA_CUSTOMIZATION_ID_SIMPLIFIED = 'urn:cen.eu:en16931:2017#compliant#urn:zatca:egs:simplified';
export const ZATCA_CUSTOMIZATION_ID_TAX = 'urn:cen.eu:en16931:2017#compliant#urn:zatca:egs:full';
// Reporting vs clearance profiles (ZATCA Phase 2).
export const PROFILE_ID_REPORTING = 'reporting:1.0';
export const PROFILE_ID_CLEARANCE = 'clearance:1.0';

export const INVOICE_TYPE_CODE = {
  SIMPLIFIED: '388', // simplified invoice
  TAX: '388', // 388 = commercial invoice; tax invoices cleared by ZATCA use 388
  CREDIT_NOTE: '381', // credit note
  DEBIT_NOTE: '383', // debit note
} as const;

export const CURRENCY = 'SAR';

export const CANONICALIZATION_METHOD_EXCLUSIVE = 'http://www.w3.org/2001/10/xml-exc-c14n#';
export const CANONICALIZATION_METHOD_C14N = 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315';
export const SIGNATURE_METHOD_ECDSA_SHA256 = 'http://www.w3.org/2001/04/xmldsig-more#ecdsa-sha256';
export const DIGEST_METHOD_SHA256 = 'http://www.w3.org/2001/04/xmlenc#sha256';
export const XPATH_TRANSFORM = 'http://www.w3.org/TR/1999/REC-xpath-19991116';
export const UBL_SIGNATURE_ID = 'urn:oasis:names:specification:ubl:signature:1';

// FATURA environments (current ZATCA API structure).
// Sandbox/Simulation and Production share the same gateway host; the path
// segment selects the environment (`simulation` vs `core`).
export const FATURA_BASE_URLS = {
  sandbox: 'https://gw-fatoora.zatca.gov.sa/e-invoicing/simulation',
  production: 'https://gw-fatoora.zatca.gov.sa/e-invoicing/core',
} as const;

export const FATURA_API_VERSION = 'V2';
export const FATURA_CONTENT_TYPE = 'application/json';
export const FATURA_CONTENT_TYPE_XML = 'application/xml';
export const FATURA_ACCEPT_LANGUAGE = 'en';

export const FATURA_ENDPOINTS = {
  complianceCsid: '/compliance',
  complianceInvoices: '/compliance/invoices',
  productionCsid: '/production/csids',
  productionCsidStatus: '/production/csids/{requestId}',
  reportInvoice: '/invoices/reporting/single',
  clearInvoice: '/invoices/clearance/single',
  invoiceStatus: '/invoices/status/{invoiceId}',
  reportBatch: '/invoices/reporting/batch',
  clearBatch: '/invoices/clearance/batch',
  batchStatus: '/invoices/status/{batchId}',
} as const;
