import { ExclusiveCanonicalization } from 'xml-crypto';
import type { Element } from '@xmldom/xmldom';

const c14n = new ExclusiveCanonicalization();

/** Exclusive canonical XML (XMLDSig C14N) of an element subtree. */
export function canonicalizeElement(node: Element): string {
  return c14n.process(node, {});
}
