import { ExclusiveCanonicalization, C14nCanonicalization } from 'xml-crypto';
import type { Element } from '@xmldom/xmldom';

const exclusive = new ExclusiveCanonicalization();
// Inclusive Canonical XML (http://www.w3.org/TR/2001/REC-xml-c14n-20010315,
// omitting comments). ZATCA computes the invoice hash and the ds:Reference
// digest with *inclusive* C14N (C14N 1.1 semantics; output is identical to
// C14N 1.0 for generated UBL invoices).
const inclusive = new C14nCanonicalization();

/** Exclusive canonical XML (XMLDSig C14N) of an element subtree. */
export function canonicalizeElement(node: Element): string {
  return exclusive.process(node, {});
}

/** Inclusive canonical XML (Canonical XML, comments omitted). */
export function canonicalizeElementInclusive(node: Element): string {
  return inclusive.process(node, {});
}
