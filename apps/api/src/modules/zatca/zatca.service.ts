import { Prisma, ZatcaCredential } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/error.middleware';
import { encryptSecret, decryptSecret } from '../../lib/zatca/encrypt';
import {
  generateEccKeyPair,
  buildCsr,
  buildSelfSignedCertificate,
  x509Info,
  derToPem,
  formatSerialNumber,
} from '../../lib/zatca/crypto';
import { signInvoice } from '../../lib/zatca/sign';
import type { ZatcaInvoiceInput } from '../../lib/zatca/xml';
import { buildComplianceSamples } from '../../lib/zatca/compliance-samples';
import { FaturaClient, FaturaError } from '../../lib/zatca/fatura';
import type { ZatcaInvoiceType } from '../../lib/zatca/fatura';
import { zatcaQrBase64 } from '../../lib/zatca/qr';
import { isValidVatNumber, validateInvoiceRules } from '../../lib/zatca/validation';
import type {
  GenerateCredentialsDto,
  ComplianceCsidDto,
  ProductionCsidDto,
  SetEnabledDto,
} from './zatca.schema';

const DEFAULT_VAT = '300000000000003';

interface SettingsShape {
  storeName: string;
  vatNumber: string;
  receiptFooter: string;
}

async function readSettings(tenantId: string): Promise<SettingsShape> {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  const rows = await prisma.setting.findMany({
    where: { tenantId, branchId: null, key: { in: ['storeName', 'vatNumber', 'receiptFooter'] } },
  });
  const map = new Map(rows.map((r) => [r.key, String(r.value)]));
  return {
    storeName: map.get('storeName') || tenant?.name || 'KODASOFT',
    vatNumber: map.get('vatNumber') || DEFAULT_VAT,
    receiptFooter: map.get('receiptFooter') || '',
  };
}

function certPemFromBinaryToken(token: string | null | undefined): string | null {
  if (!token) return null;
  try {
    const der = Buffer.from(token, 'base64');
    return derToPem(der, 'CERTIFICATE');
  } catch {
    return null;
  }
}

function credentialSummary(cred: {
  id: string;
  mode: string;
  enabled: boolean;
  csrPem: string | null;
  selfSignedCertPem: string | null;
  complianceToken: string | null;
  complianceRequestId: string | null;
  complianceSerialNumber: string | null;
  complianceChecksStatus: string | null;
  complianceChecksResults: Prisma.JsonValue | null;
  complianceChecksAt: Date | null;
  productionToken: string | null;
  productionRequestId: string | null;
  productionSerialNumber: string | null;
  lastInvoiceHash: string | null;
  lastInvoiceNumber: string | null;
}) {
  const complianceCert = certPemFromBinaryToken(cred.complianceToken);
  const productionCert = certPemFromBinaryToken(cred.productionToken);
  return {
    id: cred.id,
    mode: cred.mode,
    enabled: cred.enabled,
    hasKeyPair: Boolean(cred.csrPem),
    csrPem: cred.csrPem ?? null,
    hasSelfSignedCert: Boolean(cred.selfSignedCertPem),
    hasComplianceCsid: Boolean(cred.complianceToken),
    complianceRequestId: cred.complianceRequestId ?? null,
    complianceSerialNumber: cred.complianceSerialNumber ?? null,
    complianceCert: complianceCert
      ? {
          subject: x509Info(complianceCert).subject,
          validFrom: x509Info(complianceCert).validFrom,
          validTo: x509Info(complianceCert).validTo,
        }
      : null,
    complianceChecksStatus: cred.complianceChecksStatus ?? null,
    complianceChecksResults: cred.complianceChecksResults ?? null,
    complianceChecksAt: cred.complianceChecksAt ?? null,
    hasProductionCsid: Boolean(cred.productionToken),
    productionRequestId: cred.productionRequestId ?? null,
    productionSerialNumber: cred.productionSerialNumber ?? null,
    productionCert: productionCert
      ? {
          subject: x509Info(productionCert).subject,
          validFrom: x509Info(productionCert).validFrom,
          validTo: x509Info(productionCert).validTo,
        }
      : null,
    lastInvoiceHash: cred.lastInvoiceHash ?? null,
    lastInvoiceNumber: cred.lastInvoiceNumber ?? null,
  };
}

// Secrets (private key, PEMs, CSID binary tokens/secrets) are stored
// AES-GCM encrypted at rest (enc:v1: prefix). This maps a DB row to a copy
// with every sensitive field decrypted; legacy plaintext rows pass through.
function decryptCred(cred: ZatcaCredential) {
  return {
    ...cred,
    privateKeyPem: decryptSecret(cred.privateKeyPem),
    csrPem: decryptSecret(cred.csrPem),
    selfSignedCertPem: decryptSecret(cred.selfSignedCertPem),
    complianceToken: decryptSecret(cred.complianceToken),
    complianceSecret: decryptSecret(cred.complianceSecret),
    productionToken: decryptSecret(cred.productionToken),
    productionSecret: decryptSecret(cred.productionSecret),
  };
}

export async function getStatus(tenantId: string) {
  const credentials = await prisma.zatcaCredential.findMany({ where: { tenantId }, orderBy: { mode: 'asc' } });
  const [submittedCount, clearedCount, reportedCount, failedCount] = await Promise.all([
    prisma.invoiceSubmission.count({ where: { tenantId, status: { in: ['SUBMITTED', 'SIGNED'] } } }),
    prisma.invoiceSubmission.count({ where: { tenantId, status: 'CLEARED' } }),
    prisma.invoiceSubmission.count({ where: { tenantId, status: 'REPORTED' } }),
    prisma.invoiceSubmission.count({ where: { tenantId, status: 'FAILED' } }),
  ]);
  const active = credentials.find((c) => c.enabled);
  return {
    enabled: Boolean(active),
    activeMode: active?.mode ?? null,
    credentials: credentials.map(decryptCred).map(credentialSummary),
    counts: { submitted: submittedCount, cleared: clearedCount, reported: reportedCount, failed: failedCount },
  };
}

export async function generateCredentials(tenantId: string, dto: GenerateCredentialsDto) {
  const settings = await readSettings(tenantId);
  const sellerName = settings.storeName;
  const vat = dto.vatNumber;

  const existing = await prisma.zatcaCredential.findFirst({ where: { tenantId, mode: dto.mode } });
  if (existing?.complianceToken) {
    throw new AppError(409, 'Credentials already issued for this environment; revoke first');
  }

  const keyPair = generateEccKeyPair();
  const branch = await prisma.branch.findFirst({ where: { tenantId }, orderBy: { createdAt: 'asc' } });
  const subject = {
    commonName: sellerName,
    organizationName: sellerName,
    organizationalUnitName: 'KodaSoft-POS',
    countryName: 'SA',
    localityName: 'Riyadh',
  };
  const csr = buildCsr(subject, keyPair, {
    vatNumber: vat,
    invoiceType: dto.invoiceType === 'TAX' ? 'standard' : 'simplified',
    environment: dto.mode,
    registeredAddress: branch?.address || undefined,
    solutionName: 'KodaSoft',
    model: 'KodaSoft-POS',
  });
  const selfSignedCert = dto.mode === 'sandbox' ? buildSelfSignedCertificate(subject, keyPair) : null;

  // Store secrets encrypted at rest.
  const cred = existing
    ? await prisma.zatcaCredential.update({
        where: { id: existing.id },
        data: {
          privateKeyPem: encryptSecret(keyPair.privateKeyPem),
          csrPem: encryptSecret(csr),
          selfSignedCertPem: encryptSecret(selfSignedCert),
        },
      })
    : await prisma.zatcaCredential.create({
        data: {
          tenantId,
          mode: dto.mode,
          privateKeyPem: encryptSecret(keyPair.privateKeyPem),
          csrPem: encryptSecret(csr),
          selfSignedCertPem: encryptSecret(selfSignedCert),
        },
      });

  const publicKey = x509Info(selfSignedCert ?? keyPair.publicKeyPem);
  return {
    ...credentialSummary(decryptCred(cred)),
    csr,
    selfSignedCert: selfSignedCert ? { pem: selfSignedCert, serialNumber: publicKey.serialNumberFormatted } : null,
  };
}

export async function issueComplianceCsid(tenantId: string, dto: ComplianceCsidDto) {
  const cred = await prisma.zatcaCredential.findFirst({ where: { tenantId, mode: dto.mode } });
  if (!cred) throw new AppError(404, 'Credentials not found');
  const c = decryptCred(cred);
  if (!c.csrPem || !c.privateKeyPem) {
    throw new AppError(400, 'Generate credentials first (POST /zatca/credentials)');
  }
  const client = new FaturaClient(dto.mode);
  let res: Awaited<ReturnType<FaturaClient['requestComplianceCsid']>>;
  try {
    res = await client.requestComplianceCsid({
      csr: c.csrPem,
      otp: dto.otp,
    });
  } catch (err) {
    if (err instanceof FaturaError) {
      throw new AppError(400, `ZATCA compliance request rejected: ${err.message}`);
    }
    throw err;
  }
  if (res.status !== 'OK') {
    throw new AppError(400, `ZATCA compliance request rejected: ${JSON.stringify(res.errors ?? res.status)}`);
  }
  const certPem = certPemFromBinaryToken(res.binarySecurityToken);
  const serial = certPem ? x509Info(certPem).serialNumberFormatted : null;

  const updated = await prisma.zatcaCredential.update({
    where: { id: cred.id },
    data: {
      complianceToken: encryptSecret(res.binarySecurityToken),
      complianceSecret: encryptSecret(res.secret),
      complianceRequestId: res.requestID,
      complianceSerialNumber: serial,
    },
  });
  return { ...credentialSummary(decryptCred(updated)), complianceRequestId: res.requestID };
}

function complianceDocStatus(res: { validationResults?: unknown[]; status?: string } | null | undefined): 'PASS' | 'ERROR' {
  const vrs = Array.isArray(res?.validationResults) ? res.validationResults : [];
  if (vrs.length === 0) {
    return String(res?.status || '').toUpperCase() === 'PASS' ? 'PASS' : 'ERROR';
  }
  const hasError = vrs.some((v) => {
    const vr = (v ?? {}) as { status?: string; errorMessages?: unknown[] };
    return String(vr.status || '').toUpperCase() === 'ERROR' || (Array.isArray(vr.errorMessages) && vr.errorMessages.length > 0);
  });
  return hasError ? 'ERROR' : 'PASS';
}

/**
 * Run the FATURA compliance-invoice checks: sign the six mandatory sample
 * documents (simplified + standard, each with invoice/credit/debit) using the
 * compliance CSID and submit each to POST /compliance/invoices. The result is
 * persisted on the credential; a PASS is required before a production CSID
 * can be issued.
 */
export async function runComplianceChecks(tenantId: string, dto: { mode: string }) {
  const cred = await prisma.zatcaCredential.findFirst({ where: { tenantId, mode: dto.mode } });
  if (!cred) throw new AppError(404, 'Credentials not found');
  const c = decryptCred(cred);
  if (!c.csrPem || !c.privateKeyPem) {
    throw new AppError(400, 'Generate credentials first (POST /zatca/credentials)');
  }
  if (!c.complianceToken || !c.complianceSecret) {
    throw new AppError(400, 'Compliance CSID required before running compliance checks');
  }
  const certPem = certPemFromBinaryToken(c.complianceToken);
  if (!certPem) {
    throw new AppError(400, 'Compliance certificate could not be parsed');
  }
  const privateKeyPem = c.privateKeyPem;

  const settings = await readSettings(tenantId);
  const samples = buildComplianceSamples(
    { name: settings.storeName, vatNumber: settings.vatNumber },
    { privateKeyPem: c.privateKeyPem, certPem },
  );

  const client = new FaturaClient(dto.mode as 'sandbox' | 'production');
  const token = client.buildAuthToken(c.complianceToken, c.complianceSecret);
  const serialNumber =
    c.complianceSerialNumber || formatSerialNumber(x509Info(certPem).serialNumberHex);

  const results = await Promise.all(
    samples.map(async (sample) => {
      try {
        const res = await client.submitComplianceInvoice(
          { invoiceXmlBase64: sample.invoiceBase64, invoiceHash: sample.invoiceHash, uuid: sample.uuid.replace(/^urn:uuid:/, '') },
          { token, compliancePrivateKeyPem: privateKeyPem, serialNumber },
        );
        return {
          name: sample.name,
          kind: sample.kind,
          documentType: sample.documentType,
          status: complianceDocStatus(res as { validationResults?: unknown[]; status?: string }),
          response: res,
        };
      } catch (err) {
        return {
          name: sample.name,
          kind: sample.kind,
          documentType: sample.documentType,
          status: 'ERROR',
          response: { error: err instanceof FaturaError ? err.message : String((err as Error).message) },
        };
      }
    }),
  );

  const allPass = results.every((r) => r.status === 'PASS');
  const checkStatus = allPass ? 'PASS' : 'FAIL';

  const updated = await prisma.zatcaCredential.update({
    where: { id: cred.id },
    data: {
      complianceChecksStatus: checkStatus,
      complianceChecksResults: results as unknown as Prisma.InputJsonValue,
      complianceChecksAt: new Date(),
    },
  });

  return { ...credentialSummary(decryptCred(updated)), complianceChecks: results, complianceChecksStatus: checkStatus };
}

export async function issueProductionCsid(tenantId: string, dto: ProductionCsidDto) {
  const cred = await prisma.zatcaCredential.findFirst({ where: { tenantId, mode: 'production' } });
  if (!cred) throw new AppError(404, 'Credentials not found');
  const c = decryptCred(cred);
  if (!c.csrPem || !c.privateKeyPem) {
    throw new AppError(400, 'Generate production credentials first (POST /zatca/credentials with mode=production)');
  }
  if (!c.complianceToken || !c.complianceSecret) {
    throw new AppError(400, 'Compliance CSID required before issuing a production CSID');
  }
  const client = new FaturaClient('production');
  const token = client.buildAuthToken(c.complianceToken, c.complianceSecret);
  const res = await client.requestProductionCsid({
    complianceRequestId: c.complianceRequestId || '',
    otp: dto.otp,
    token,
  });
  if (res.status !== 'OK') {
    throw new AppError(400, `ZATCA production request rejected: ${JSON.stringify(res.errors ?? res.status)}`);
  }
  const certPem = certPemFromBinaryToken(res.binarySecurityToken);
  const serial = certPem ? x509Info(certPem).serialNumberFormatted : null;

  const updated = await prisma.zatcaCredential.update({
    where: { id: cred.id },
    data: {
      productionToken: encryptSecret(res.binarySecurityToken),
      productionSecret: encryptSecret(res.secret),
      productionRequestId: res.requestID,
      productionSerialNumber: serial,
    },
  });
  return { ...credentialSummary(decryptCred(updated)), productionRequestId: res.requestID };
}

export async function setEnabled(tenantId: string, dto: SetEnabledDto) {
  if (dto.enabled) {
    const cred = await prisma.zatcaCredential.findFirst({ where: { tenantId, mode: dto.mode } });
    if (!cred?.csrPem) throw new AppError(400, 'Generate credentials first');
    if (dto.mode === 'production' && !cred.productionToken) {
      throw new AppError(400, 'Production CSID required before enabling production mode');
    }
    await prisma.zatcaCredential.updateMany({
      where: { tenantId },
      data: { enabled: false },
    });
    await prisma.zatcaCredential.update({
      where: { id: cred.id },
      data: { enabled: true },
    });
  } else {
    await prisma.zatcaCredential.updateMany({ where: { tenantId }, data: { enabled: false } });
  }
  return getStatus(tenantId);
}

export async function listSubmissions(tenantId: string, query: { limit?: number; status?: string }) {
  const rows = await prisma.invoiceSubmission.findMany({
    where: { tenantId, ...(query.status ? { status: query.status } : {}) },
    orderBy: { submittedAt: 'desc' },
    take: query.limit ?? 50,
  });
  return rows.map((s) => ({
    ...s,
    invoiceXml: undefined,
    faturaResponse: s.faturaResponse,
  }));
}

export async function getSubmission(tenantId: string, id: string) {
  const row = await prisma.invoiceSubmission.findFirst({ where: { id, tenantId } });
  if (!row) throw new AppError(404, 'Submission not found');
  return row;
}

export async function retrySubmission(tenantId: string, id: string) {
  const row = await prisma.invoiceSubmission.findFirst({ where: { id, tenantId } });
  if (!row) throw new AppError(404, 'Submission not found');
  if (!row.faturaResponse || row.status !== 'FAILED') {
    throw new AppError(409, 'Only failed submissions can be retried');
  }
  const active = await prisma.zatcaCredential.findFirst({ where: { tenantId, enabled: true } });
  if (!active) throw new AppError(400, 'ZATCA is not enabled');
  const a = decryptCred(active);

  const client = new FaturaClient(a.mode as 'sandbox' | 'production');
  const token = client.buildAuthToken(a.complianceToken || a.productionToken || '', a.complianceSecret || a.productionSecret || '');

  const result = await submitToFatura(client, {
    invoiceXmlBase64: Buffer.from(row.invoiceXml, 'utf8').toString('base64'),
    invoiceHash: row.invoiceHash,
    uuid: row.invoiceUuid.replace(/^urn:uuid:/, ''),
    invoiceType: row.invoiceType === 'TAX' ? 'standard' : 'simplified',
    binarySecurityToken: a.complianceToken || a.productionToken || '',
  }, {
    token,
    compliancePrivateKeyPem: a.privateKeyPem || '',
    serialNumber: a.complianceSerialNumber || a.productionSerialNumber || '',
  });

  const status = resultStatus(row.invoiceType === 'TAX', result);
  return prisma.invoiceSubmission.update({
    where: { id: row.id },
    data: {
      status,
      attemptCount: row.attemptCount + 1,
      faturaResponse: result as unknown as Prisma.InputJsonValue,
      clearedAt: status === 'CLEARED' ? new Date() : row.clearedAt,
    },
  });
}

// ─────────────────────────────────────────────
// Invoice signing + submission (used by orders)
// ─────────────────────────────────────────────

function invoiceTypeForFatura(type: string): ZatcaInvoiceType {
  return type === 'TAX' ? 'standard' : 'simplified';
}

function resultStatus(isTax: boolean, result: { status?: string; [k: string]: unknown }): string {
  const status = String(result.status || '').toUpperCase();
  if (status.includes('CLEARED')) return 'CLEARED';
  if (isTax) {
    // Clearance endpoint: any accepted response (202) means pending/cleared.
    return status.includes('SUBMITTED') || status.includes('PENDING') ? 'SUBMITTED' : 'REPORTED';
  }
  return 'REPORTED';
}

async function submitToFatura(
  client: FaturaClient,
  input: {
    invoiceXmlBase64: string;
    invoiceHash: string;
    uuid: string;
    invoiceType: ZatcaInvoiceType;
    binarySecurityToken: string;
    pih?: string;
  },
  credentials: { token: string; compliancePrivateKeyPem: string; serialNumber: string },
): Promise<{ status: string; [k: string]: unknown }> {
  return client.submitInvoice(input, credentials);
}

/**
 * Sign a completed order with the tenant's ZATCA credentials and (when a CSID
 * exists) submit it to FATURA. Used by the orders service after order commit.
 *
 * Returns null when ZATCA is disabled; otherwise the signing result. FATURA
 * submission failures are recorded on the submission row and do not block the
 * sale.
 */
export async function signAndSubmitOrder(
  tenantId: string,
  order: {
    id: string;
    orderNumber: string;
    invoiceType: string;
    subtotal: number;
    discountAmount: number;
    taxAmount: number;
    total: number;
    invoiceUuid: string;
    branchId: string;
    customerId?: string | null;
    notes?: string | null;
    createdAt: Date;
    items: Array<{
      name: string;
      sku: string | null;
      quantity: number;
      unitPrice: number;
      discountAmount: number;
      taxAmount: number;
      subtotal: number;
      taxRate: number;
    }>;
  },
): Promise<{ signed: boolean; status?: string; error?: string; invoiceHash?: string; invoiceSignature?: string; invoiceXml?: string }> {
  const cred = await prisma.zatcaCredential.findFirst({ where: { tenantId, enabled: true } });
  if (!cred?.privateKeyPem) return { signed: false };
  const c = decryptCred(cred);
  if (!c.privateKeyPem) return { signed: false };

  const settings = await readSettings(tenantId);
  const branch = await prisma.branch.findFirst({ where: { id: order.branchId, tenantId } });
  const customer = order.customerId
    ? await prisma.customer.findUnique({ where: { id: order.customerId } })
    : null;

  const sellerVat = settings.vatNumber;
  const sellerVatValid = isValidVatNumber(sellerVat);
  const invoiceType = order.invoiceType === 'TAX' ? 'tax' : 'simplified';

  const issues = validateInvoiceRules({
    sellerName: settings.storeName,
    sellerVat,
    buyerVat: customer?.vatNumber || undefined,
    invoiceNumber: order.orderNumber,
    subtotal: order.subtotal,
    discountAmount: order.discountAmount,
    taxableAmount: order.subtotal - order.discountAmount,
    taxAmount: order.taxAmount,
    total: order.total,
  });
  if (issues.length > 0) {
    return { signed: false, error: `Invoice validation failed: ${issues.map((i) => i.message).join('; ')}` };
  }

  // Signing certificate: production CSID > compliance CSID > self-signed (sandbox).
  const signingToken = c.productionToken || c.complianceToken;
  const signingCertPem = certPemFromBinaryToken(signingToken);
  const certPem = signingCertPem || c.selfSignedCertPem;
  const keyPem = c.privateKeyPem;
  if (!certPem) {
    return { signed: false, error: 'No signing certificate available' };
  }

  const issued = new Date(order.createdAt);
  const input: ZatcaInvoiceInput = {
    invoiceNumber: order.orderNumber,
    uuid: order.invoiceUuid,
    issueDate: issued.toISOString().slice(0, 10),
    issueTime: issued.toISOString().slice(11, 19),
    type: invoiceType,
    currency: 'SAR',
    seller: {
      name: settings.storeName,
      vatNumber: sellerVat,
      street: branch?.address || undefined,
      city: 'Riyadh',
    },
    buyer:
      invoiceType === 'tax' && customer
        ? {
            name: customer.name,
            vatNumber: customer.vatNumber || '300000000000000',
          }
        : undefined,
    lines: order.items.map((item, idx) => ({
      id: String(idx + 1),
      name: item.name,
      nameAr: undefined,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      taxPercent: item.taxRate,
      discountAmount: item.discountAmount,
    })),
    discountAmount: order.discountAmount,
    subtotal: order.subtotal,
    taxableAmount: order.subtotal - order.discountAmount,
    taxAmount: order.taxAmount,
    total: order.total,
  };

  const signed = signInvoice(input, { privateKeyPem: keyPem, certPem });

  let status = 'SIGNED';
  let faturaResponse: unknown = null;
  let clearedAt: Date | null = null;

  // Only submit when we hold a real CSID and the seller VAT is well-formed.
  if (signingToken && sellerVatValid) {
    const client = new FaturaClient(c.mode as 'sandbox' | 'production');
    const token = client.buildAuthToken(
      c.productionToken || c.complianceToken || '',
      c.productionSecret || c.complianceSecret || '',
    );
    try {
      const result = await submitToFatura(
        client,
        {
          invoiceXmlBase64: signed.xmlBase64,
          invoiceHash: signed.invoiceHash,
          uuid: order.invoiceUuid.replace(/^urn:uuid:/, ''),
          invoiceType: invoiceTypeForFatura(order.invoiceType),
          binarySecurityToken: signingToken,
          pih: invoiceType === 'tax' ? c.lastInvoiceHash || undefined : undefined,
        },
        {
          token,
          compliancePrivateKeyPem: keyPem,
          serialNumber: (c.productionSerialNumber || c.complianceSerialNumber || formatSerialNumber(x509Info(certPem).serialNumberHex)),
        },
      );
      status = resultStatus(order.invoiceType === 'TAX', result as { status?: string });
      faturaResponse = result;
      if (status === 'CLEARED') clearedAt = new Date();
    } catch (err) {
      status = 'FAILED';
      faturaResponse = { error: err instanceof FaturaError ? err.message : String((err as Error).message) };
    }
  }

  const submission = await prisma.invoiceSubmission.create({
    data: {
      tenantId,
      orderId: order.id,
      invoiceUuid: order.invoiceUuid,
      invoiceNumber: order.orderNumber,
      invoiceType: order.invoiceType,
      invoiceXml: signed.xml,
      invoiceHash: signed.invoiceHash,
      invoiceSignature: signed.signatureValue,
      status,
      faturaResponse: faturaResponse as Prisma.InputJsonValue | undefined,
      clearedAt,
    },
  });

  await prisma.order.update({
    where: { id: order.id },
    data: {
      invoiceHash: signed.invoiceHash,
      invoiceSignature: signed.signatureValue,
      zatcaStatus: status,
    },
  });

  await prisma.zatcaCredential.update({
    where: { id: cred.id },
    data: {
      lastInvoiceHash: signed.invoiceHash,
      lastInvoiceNumber: order.orderNumber,
    },
  });

  void submission;
  return { signed: true, status, invoiceHash: signed.invoiceHash, invoiceSignature: signed.signatureValue, invoiceXml: signed.xml };
}

export function buildPhase2Qr(input: {
  sellerName: string;
  vatNumber: string;
  timestamp: Date;
  total: number;
  vat: number;
  invoiceHash: string;
  signature: string;
  publicKeySpkiDerBase64: string;
  previousInvoiceHash?: string;
}): string {
  return zatcaQrBase64({
    sellerName: input.sellerName,
    vatNumber: input.vatNumber,
    timestamp: input.timestamp,
    total: input.total,
    vat: input.vat,
    invoiceHash: input.invoiceHash,
    signature: input.signature,
    publicKey: input.publicKeySpkiDerBase64,
    previousInvoiceHash: input.previousInvoiceHash,
  });
}

export async function revokeCredentials(tenantId: string, mode: string) {
  const cred = await prisma.zatcaCredential.findFirst({ where: { tenantId, mode } });
  if (!cred) throw new AppError(404, 'No credentials for this environment');
  await prisma.zatcaCredential.delete({ where: { id: cred.id } });
  return { id: cred.id };
}
