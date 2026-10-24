/**
 * Deterministic generation of masked product codes for quotations:
 * Combines 4-5 random uppercase alphabets followed by "-AMA" (e.g. "HSDS-AMA").
 *
 * Deterministic guarantee: The same quotation and product description will
 * consistently generate the exact same code without saving anything to the database.
 */

export function generateEncryptedProductCode(
  quotationKey: string | number,
  description: string,
  salt: number = 0
): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const str = `${quotationKey}_${description.trim().toUpperCase()}${salt ? `_${salt}` : ''}`;

  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }

  // 4 or 5 alphabetic characters
  const len = 4 + (Math.abs(hash) % 2);
  let code = '';
  let h = Math.abs(hash);
  for (let i = 0; i < len; i++) {
    code += alphabet[h % alphabet.length];
    h = Math.imul((h >> 3) ^ ((i + 1) * 37), 0x5bd1e995);
    h = Math.abs(h);
  }

  return `${code}-AMA`;
}

export function buildEncryptedProductMap(
  quotationKey: string | number,
  items: Array<{ description: string }>
): Map<string, string> {
  const map = new Map<string, string>();
  const usedCodes = new Set<string>();

  for (const item of items) {
    const desc = (item.description || '').trim();
    if (!desc || map.has(desc)) continue;

    let salt = 0;
    let code = '';
    do {
      code = generateEncryptedProductCode(quotationKey, desc, salt);
      salt++;
    } while (usedCodes.has(code));

    usedCodes.add(code);
    map.set(desc, code);
  }

  return map;
}
