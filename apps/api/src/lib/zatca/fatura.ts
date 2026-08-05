import { signDataBase64 } from './crypto';
import {
  FATURA_BASE_URLS,
  FATURA_API_VERSION,
  FATURA_CONTENT_TYPE,
  FATURA_ACCEPT_LANGUAGE,
  FATURA_ENDPOINTS,
} from './const';

export type FaturaEnvironment = 'sandbox' | 'production';
export type ZatcaInvoiceType = 'simplified' | 'standard';

export interface FaturaCsidRequest {
  /** PEM-encoded CSR, base64-encoded for transport. */
  csr: string;
  /** One-time password from the Fatoora portal (valid ~1 hour). */
  otp: string;
}

export interface FaturaCsidResponse {
  binarySecurityToken: string;
  secret: string;
  requestID: string;
  status: string;
  errors: unknown[];
}

export interface FaturaSubmitInvoiceInput {
  /** base64 of the signed invoice XML. */
  invoiceXmlBase64: string;
  invoiceHash: string;
  uuid: string;
  invoiceType: ZatcaInvoiceType;
  /** Compliance cert in base64 (the `binarySecurityToken` from issuance). */
  binarySecurityToken: string;
  /** Previous invoice hash (required for tax invoices, i.e. standard). */
  pih?: string;
}

export interface FaturaSubmissionResult {
  status: string;
  [key: string]: unknown;
}

export class FaturaError extends Error {
  constructor(message: string, public httpStatus: number, public body: unknown) {
    super(message);
    this.name = 'FaturaError';
  }
}

/**
 * Minimal FATURA (ZATCA gateway) Phase-2 client.
 *
 * Auth model (API V2):
 *  - compliance CSID: JSON body `{ csr }` (base64 of the PEM CSR) + `OTP` header.
 *  - production CSID: JSON body `{ compliance_request_id }` + Basic auth over
 *    base64(`<complianceBinarySecurityToken>:<secret>`) + `OTP` header.
 *  - invoice calls: Basic auth token + request-body signature
 *    (`signature` = base64 ECDSA-SHA256 over the SHA-256 of the body) +
 *    `serial-number` of the compliance certificate.
 */
export class FaturaClient {
  /** Network timeout for FATURA calls (ms). */
  private requestTimeoutMs = 30_000;

  constructor(private env: FaturaEnvironment) {}

  get baseUrl(): string {
    return FATURA_BASE_URLS[this.env];
  }

  /** Basic auth token from the CSID pair returned at issuance. */
  buildAuthToken(binarySecurityToken: string, secret: string): string {
    return Buffer.from(`${binarySecurityToken}:${secret}`).toString('base64');
  }

  /** Signature over the SHA-256 digest of the request body (ZATCA Phase-2). */
  buildRequestSignature(body: string, compliancePrivateKeyPem: string): string {
    return signDataBase64(body, compliancePrivateKeyPem);
  }

  /** POST /compliance — issue the compliance CSID (Phase-2 onboarding). */
  async requestComplianceCsid(req: FaturaCsidRequest): Promise<FaturaCsidResponse> {
    return this.request(FATURA_ENDPOINTS.complianceCsid, {
      body: { csr: Buffer.from(req.csr, 'utf8').toString('base64') },
      otp: req.otp,
    });
  }

  /** POST /production/csids — upgrade the compliance CSID to a production CSID. */
  async requestProductionCsid(input: {
    complianceRequestId: string;
    otp: string;
    token: string;
  }): Promise<FaturaCsidResponse> {
    return this.request(FATURA_ENDPOINTS.productionCsid, {
      body: { compliance_request_id: input.complianceRequestId },
      otp: input.otp,
      token: input.token,
    });
  }

  /**
   * Report or clear a single invoice.
   * - simplified invoices → reporting endpoint (200 on success).
   * - standard (tax) invoices → clearance endpoint (202 with a clearance status).
   */
  async submitInvoice(input: FaturaSubmitInvoiceInput, credentials: {
    token: string;
    compliancePrivateKeyPem: string;
    serialNumber: string;
  }): Promise<FaturaSubmissionResult> {
    const body = JSON.stringify({
      invoiceHash: input.invoiceHash,
      uuid: input.uuid,
      invoice: input.invoiceXmlBase64,
      invoiceType: input.invoiceType,
      binarySecurityToken: input.binarySecurityToken,
      securityTokenType: 'X509',
      ...(input.pih ? { pih: input.pih } : {}),
    });
    const endpoint = input.invoiceType === 'standard' ? FATURA_ENDPOINTS.clearInvoice : FATURA_ENDPOINTS.reportInvoice;
    return this.request(endpoint, {
      body,
      token: credentials.token,
      signature: this.buildRequestSignature(body, credentials.compliancePrivateKeyPem),
      serialNumber: credentials.serialNumber,
    });
  }

  /** GET invoice status. */
  async getInvoiceStatus(invoiceId: string, credentials: {
    token: string;
    compliancePrivateKeyPem: string;
    serialNumber: string;
  }): Promise<FaturaSubmissionResult> {
    const path = FATURA_ENDPOINTS.invoiceStatus.replace('{invoiceId}', invoiceId);
    return this.request(path, {
      method: 'GET',
      token: credentials.token,
      signature: credentials ? this.buildRequestSignature(invoiceId, credentials.compliancePrivateKeyPem) : undefined,
      serialNumber: credentials.serialNumber,
    });
  }

  private async request(
    path: string,
    opts: {
      method?: string;
      body?: string | Record<string, unknown>;
      token?: string;
      otp?: string;
      signature?: string;
      serialNumber?: string;
    },
  ): Promise<any> {
    const headers: Record<string, string> = {
      'Accept-Version': FATURA_API_VERSION,
      'Accept-Language': FATURA_ACCEPT_LANGUAGE,
    };
    const body = typeof opts.body === 'string' ? opts.body : opts.body === undefined ? undefined : JSON.stringify(opts.body);
    if (body) headers['Content-Type'] = FATURA_CONTENT_TYPE;
    if (opts.token) headers.Authorization = `Basic ${opts.token}`;
    if (opts.otp) headers.OTP = opts.otp;
    if (opts.signature) {
      headers['signature-version'] = '1.0';
      headers.signature = opts.signature;
    }
    if (opts.serialNumber) headers['serial-number'] = opts.serialNumber;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.requestTimeoutMs);
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}${path}`, { method: opts.method || 'POST', headers, body, signal: controller.signal });
    } catch (err) {
      clearTimeout(timer);
      throw new FaturaError(`FATURA ${path} request failed: ${(err as Error).message}`, 0, null);
    }
    clearTimeout(timer);
    const text = await res.text();
    let json: unknown = null;
    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        json = null;
      }
    }
    if (!res.ok) {
      throw new FaturaError(`FATURA ${path} responded ${res.status}: ${text.slice(0, 500)}`, res.status, json);
    }
    return json;
  }
}
