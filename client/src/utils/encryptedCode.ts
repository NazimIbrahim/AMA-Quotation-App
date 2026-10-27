/**
 * Clean descriptive words from an item name:
 * Strips dimensions (e.g. 600x1200, 60x120, 2x4) and pure numbers if other words exist.
 */
export function cleanItemWords(name: string): string[] {
  if (!name || typeof name !== 'string') return [];
  const rawWords = name
    .replace(/[^a-zA-Z0-9]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  const isDimension = (w: string) => /^\d+x\d+$/i.test(w);
  const isPureNumber = (w: string) => /^\d+$/.test(w);

  const filtered = rawWords.filter((w) => !isDimension(w) && !isPureNumber(w));
  return filtered.length > 0 ? filtered : rawWords;
}

/**
 * Derives a 3-letter uppercase encrypted abbreviation from an item name:
 * e.g. "legacy marfil polish" -> "LMP - AMA"
 * e.g. "Royal Statuario"      -> "RST - AMA"
 * e.g. "Armani Grey"          -> "AGR - AMA"
 * e.g. "Crema"                -> "CRE - AMA"
 * e.g. "Onyx"                 -> "ONY - AMA"
 */
export function derive3LetterCode(name: string, salt: number = 0): string {
  const words = cleanItemWords(name);
  if (words.length === 0) return 'AMA - AMA';

  let letters = '';
  if (words.length >= 3) {
    letters = words[0][0] + words[1][0] + words[2][0];
  } else if (words.length === 2) {
    if (words[1].length >= 2) {
      letters = words[0][0] + words[1][0] + words[1][1];
    } else if (words[0].length >= 2) {
      letters = words[0][0] + words[0][1] + words[1][0];
    } else {
      letters = words[0][0] + words[1][0] + 'X';
    }
  } else {
    // 1 word
    letters = words[0].substring(0, 3);
  }

  letters = letters.toUpperCase().padEnd(3, 'X');
  if (salt > 0) {
    return `${letters}-${salt} - AMA`;
  }
  return `${letters} - AMA`;
}

/**
 * Builds encrypted code map for quotation items:
 * If an item already has a saved encrypted_code from the server, that is preserved.
 * Otherwise, generates the standard 3-letter abbreviation (e.g. "LMP - AMA").
 */
export function buildEncryptedProductMap(
  _quotationKey: string | number,
  items: Array<{ description?: string; item_description?: string; encrypted_code?: string }>
): Map<string, string> {
  const map = new Map<string, string>();
  const usedCodes = new Set<string>();

  for (const item of items) {
    const desc = (item.description || item.item_description || '').trim();
    if (!desc || map.has(desc)) continue;

    if (item.encrypted_code) {
      map.set(desc, item.encrypted_code);
      usedCodes.add(item.encrypted_code);
      continue;
    }

    let salt = 0;
    let code = '';
    do {
      code = derive3LetterCode(desc, salt);
      salt++;
    } while (usedCodes.has(code));

    usedCodes.add(code);
    map.set(desc, code);
  }

  return map;
}
