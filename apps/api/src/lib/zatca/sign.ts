import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import type { Document, Element } from '@xmldom/xmldom';
import { buildUnsignedInvoice, serializeXml, el } from './xml';
import type { ZatcaInvoiceInput } from './xml';
import { sha256Base64, signDataBase64, verifyData, x509Info } from './crypto';
import type { ZatcaCertificateInfo } from './crypto';
import { canonicalizeElement } from './canonical';
import {
  CANONICALIZATION_METHOD_EXCLUSIVE,
  SIGNATURE_METHOD_ECDSA_SHA256,
  DIGEST_METHOD_SHA256,
  XPATH_TRANSFORM,
  UBL_SIGNATURE_ID,
} from './const';

export interface SignInvoiceResult {
  /** Full signed UBL 2.1 invoice XML (base64-encoded for FATURA). */
  xml: string;
  xmlBase64: string;
  /** base64 SHA-256 of the canonicalized signed invoice (ZATCA invoice hash). */
  invoiceHash: string;
  /** base64 DER ECDSA signature (also embedded in the XML). */
  signatureValue: string;
  /** base64 SHA-256 of the canonicalized unsigned invoice (ds:Reference digest). */
  invoiceDigest: string;
  cert: ZatcaCertificateInfo;
}

/**
 * Sign a ZATCA invoice and produce the final UBL document.
 *
 * Pipeline (matches the ZATCA Phase-2 requirements):
 *  1. build the unsigned invoice DOM;
 *  2. digest  = base64(sha256(exclusive-C14N(unsigned invoice)));
 *  3. digest of the SignedProperties element;
 *  4. build ds:SignedInfo, canonicalize and sign with ECDSA-SHA256;
 *  5. embed the signature in ext:UBLExtensions;
 *  6. invoiceHash = base64(sha256(exclusive-C14N(signed invoice))).
 */
export function signInvoice(
  input: ZatcaInvoiceInput,
  signingKey: { privateKeyPem: string; certPem: string },
): SignInvoiceResult {
  const { doc, root } = buildUnsignedInvoice(input);
  const cert = x509Info(signingKey.certPem);

  // 1. Digest of the unsigned invoice (the ds:Reference content).
  const invoiceDigest = sha256Base64(canonicalizeElement(root));

  // 2. Build the SignedProperties subtree and digest it.
  const signedProperties = buildSignedProperties(doc, input, cert);
  const signedPropertiesDigest = sha256Base64(canonicalizeElement(signedProperties));

  // 3. Build SignedInfo, canonicalize, sign.
  const signedInfo = buildSignedInfo(doc, invoiceDigest, signedPropertiesDigest);
  const signedInfoCanonical = canonicalizeElement(signedInfo);
  const signatureValue = signDataBase64(signedInfoCanonical, signingKey.privateKeyPem);

  // 4. Assemble the full signature + UBLExtensions and attach to the invoice.
  const signature = buildSignatureElement(doc, input, cert, invoiceDigest, signedPropertiesDigest, signatureValue);
  const extensions = buildUblExtensions(doc, input, signature);
  root.insertBefore(extensions, root.firstChild);

  const xml = serializeXml(root);
  const invoiceHash = sha256Base64(canonicalizeElement(root));

  // 5. Verify what we just produced before returning it.
  const canonicalSignedInfo = canonicalizeElement(signedInfo);
  const ok = verifyData(canonicalSignedInfo, Buffer.from(signatureValue, 'base64'), cert.publicKeyPem);
  if (!ok) throw new Error('ZATCA signature self-verification failed');

  return { xml, xmlBase64: Buffer.from(xml, 'utf8').toString('base64'), invoiceHash, signatureValue, invoiceDigest, cert };
}

/**
 * Re-parse a signed invoice and re-verify the embedded signature + hashes.
 * Used by the self-test and by the FATURA submitter to guarantee integrity.
 */
export function verifySignedInvoice(xml: string, certPem?: string): { digestOk: boolean; signatureOk: boolean; invoiceHash: string } {
  const doc = new DOMParser().parseFromString(xml, 'text/xml') as unknown as Document;
  const root = doc.documentElement;
  if (!root) throw new Error('Signed invoice is empty');
  const signature = findElement(root, 'ds:Signature');
  const signatureValue = findElement(signature, 'ds:SignatureValue')?.textContent || '';
  const x509 = findElement(signature, 'ds:X509Certificate')?.textContent || '';
  const signedInfo = findElement(signature, 'ds:SignedInfo');
  const certPemFromParam = certPem || derPemFromBase64(x509);
  const publicKeyPem = certPemFromParam ? x509Info(certPemFromParam).publicKeyPem : '';

  // Verify ECDSA over the canonicalized SignedInfo.
  const canonicalSignedInfo = canonicalizeElement(signedInfo!);
  const signatureOk = verifyData(canonicalSignedInfo, Buffer.from(signatureValue, 'base64'), publicKeyPem);

  // Recompute the reference digest over the doc minus UBLExtensions.
  const invoiceHash = sha256Base64(canonicalizeElement(root));
  const extensions = findElement(root, 'ext:UBLExtensions');
  if (extensions) root.removeChild(extensions);
  const digestOk = sha256Base64(canonicalizeElement(root)) === findElement(signedInfo, 'ds:DigestValue')?.textContent;

  return { digestOk, signatureOk, invoiceHash };
}

function findElement(parent: Element | null, tagName: string): Element | null {
  if (!parent) return null;
  if (parent.tagName === tagName) return parent;
  for (const child of Array.from(parent.childNodes)) {
    if (child.nodeType === 1) {
      const res = findElement(child as Element, tagName);
      if (res) return res;
    }
  }
  return null;
}

function derPemFromBase64(b64: string): string {
  const der = Buffer.from(b64, 'base64');
  const pem = der
    .toString('base64')
    .replace(/(.{64})/g, '$1\n');
  return `-----BEGIN CERTIFICATE-----\n${pem}\n-----END CERTIFICATE-----\n`;
}

function buildSignedInfo(
  doc: Document,
  invoiceDigest: string,
  signedPropertiesDigest: string,
): Element {
  return el(doc, 'ds:SignedInfo', { Id: 'signature-signedinfo' }, [
    el(doc, 'ds:CanonicalizationMethod', { Algorithm: CANONICALIZATION_METHOD_EXCLUSIVE }, []),
    el(doc, 'ds:SignatureMethod', { Algorithm: SIGNATURE_METHOD_ECDSA_SHA256 }, []),
    el(doc, 'ds:Reference', { Id: 'invoice', URI: '' }, [
      el(doc, 'ds:Transforms', {}, [
        el(doc, 'ds:Transform', { Algorithm: XPATH_TRANSFORM }, [
          el(doc, 'ds:XPath', {}, ['not(//ancestor-or-self::ext:UBLExtensions)']),
        ]),
      ]),
      el(doc, 'ds:DigestMethod', { Algorithm: DIGEST_METHOD_SHA256 }, []),
      el(doc, 'ds:DigestValue', {}, [invoiceDigest]),
    ]),
    el(doc, 'ds:Reference', { Id: 'signedproperties', Type: 'http://uri.etsi.org/01903#SignedProperties', URI: '#XADESSignature' }, [
      el(doc, 'ds:DigestMethod', { Algorithm: DIGEST_METHOD_SHA256 }, []),
      el(doc, 'ds:DigestValue', {}, [signedPropertiesDigest]),
    ]),
  ]);
}

function buildSignedProperties(doc: Document, input: ZatcaInvoiceInput, cert: ZatcaCertificateInfo): Element {
  return el(doc, 'xades:SignedProperties', { Id: 'XADESSignature' }, [
    el(doc, 'xades:SignedSignatureProperties', {}, [
      el(doc, 'xades:SigningTime', {}, [`${input.issueDate}T${input.issueTime}Z`]),
      el(doc, 'xades:SigningCertificate', {}, [
        el(doc, 'xades:Cert', {}, [
          el(doc, 'xades:CertDigest', {}, [
            el(doc, 'ds:DigestMethod', { Algorithm: DIGEST_METHOD_SHA256 }, []),
            el(doc, 'ds:DigestValue', {}, [cert.certDigestBase64]),
          ]),
          el(doc, 'xades:IssuerSerial', {}, [
            el(doc, 'ds:X509IssuerName', {}, [cert.issuer]),
            el(doc, 'ds:X509SerialNumber', {}, [cert.serialNumberHex]),
          ]),
        ]),
      ]),
    ]),
    el(doc, 'xades:SignedDataObjectProperties', {}, [
      el(doc, 'xades:DataObjectFormat', { ObjectReference: '#invoice' }, [
        el(doc, 'xades:Description', {}, ['ZATCA invoice']),
      ]),
    ]),
  ]);
}

function buildSignatureElement(
  doc: Document,
  input: ZatcaInvoiceInput,
  cert: ZatcaCertificateInfo,
  invoiceDigest: string,
  signedPropertiesDigest: string,
  signatureValue: string,
): Element {
  const signedInfo = buildSignedInfo(doc, invoiceDigest, signedPropertiesDigest);
  return el(doc, 'ds:Signature', { Id: 'signature' }, [
    signedInfo,
    el(doc, 'ds:SignatureValue', { Id: 'signature-value' }, [signatureValue]),
    el(doc, 'ds:KeyInfo', {}, [
      el(doc, 'ds:X509Data', {}, [
        el(doc, 'ds:X509IssuerSerial', {}, [
          el(doc, 'ds:X509IssuerName', {}, [cert.issuer]),
          el(doc, 'ds:X509SerialNumber', {}, [cert.serialNumberHex]),
        ]),
        el(doc, 'ds:X509Certificate', {}, [cert.der.toString('base64')]),
      ]),
    ]),
    el(doc, 'ds:Object', { Id: 'XADESObject' }, [
      el(doc, 'xades:QualifyingProperties', { Id: 'XADESQualifyingProperties', Target: '#signature' }, [
        buildSignedProperties(doc, input, cert),
      ]),
    ]),
  ]);
}

function buildUblExtensions(doc: Document, input: ZatcaInvoiceInput, signature: Element): Element {
  return el(doc, 'ext:UBLExtensions', {}, [
    el(doc, 'ext:UBLExtension', {}, [
      el(doc, 'ext:ExtensionContent', {}, [
        el(doc, 'sig:UBLDocumentSignatures', { Id: 'signature' }, [
          el(doc, 'sig:SignatureInformation', { Id: 'signature' }, [
            el(doc, 'cbc:ID', {}, [UBL_SIGNATURE_ID]),
            el(doc, 'cac:SignatureMethod', {}, [
              el(doc, 'cbc:ID', {}, ['urn:oasis:names:specification:ubl:dsig:enveloped:xades']),
            ]),
            el(doc, 'cac:SignatoryParty', {}, [
              el(doc, 'cac:PartyIdentification', {}, [el(doc, 'cbc:ID', {}, [input.seller.vatNumber])]),
              el(doc, 'cac:PartyName', {}, [el(doc, 'cbc:Name', {}, [input.seller.name])]),
            ]),
            el(doc, 'cac:DigitalSignatureAttachment', {}, [
              el(doc, 'cac:ExternalReference', {}, [el(doc, 'cbc:URI', {}, ['#signature'])]),
            ]),
            el(doc, 'cac:DocumentReference', {}, [el(doc, 'cbc:ID', {}, ['invoice'])]),
          ]),
        ]),
      ]),
    ]),
    el(doc, 'ext:UBLExtension', {}, [el(doc, 'ext:ExtensionContent', {}, [signature])]),
  ]);
}

/** Convenience serializer (for debugging / display). */
export function serializeSignedInvoice(xml: string): string {
  const doc = new DOMParser().parseFromString(xml, 'text/xml') as unknown as Document;
  return new XMLSerializer().serializeToString(doc);
}
