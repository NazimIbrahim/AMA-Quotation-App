import { query } from '../db/connection';

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
 * Synchronous backward-compatible fallback for mapping items:
 * Ensures deterministic 3-letter codes for items in memory.
 */
export function buildEncryptedProductMap(
  quotationKey: string | number,
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

/**
 * Asynchronously fetch existing encrypted codes from product_encrypted_codes table,
 * or generate new 3-letter codes ("LMP - AMA") and save them permanently to the database.
 * Once generated, the same code is guaranteed to be returned for that item name in the future.
 */
export async function getOrSaveEncryptedProductCodes(
  itemNames: string[],
  dbQuery: (sql: string, params?: any[]) => Promise<any> = query
): Promise<Map<string, string>> {
  const resultMap = new Map<string, string>();

  // Extract clean unique descriptions
  const uniqueNames = Array.from(
    new Set(
      itemNames
        .map((n) => String(n || '').trim())
        .filter((n) => n.length > 0)
    )
  );

  if (uniqueNames.length === 0) return resultMap;

  const normalizedList = uniqueNames.map((n) => n.toLowerCase());

  // 1. Fetch already registered codes from PostgreSQL
  try {
    const existingRows = await dbQuery(
      `SELECT normalized_name, encrypted_code 
       FROM product_encrypted_codes 
       WHERE normalized_name = ANY($1::text[])`,
      [normalizedList]
    );

    const existingMap = new Map<string, string>();
    for (const row of existingRows) {
      existingMap.set(row.normalized_name, row.encrypted_code);
    }

    const missingNames: string[] = [];
    for (const name of uniqueNames) {
      const norm = name.toLowerCase();
      if (existingMap.has(norm)) {
        resultMap.set(name, existingMap.get(norm)!);
      } else {
        missingNames.push(name);
      }
    }

    // 2. Generate and save missing item codes
    if (missingNames.length > 0) {
      // Query all existing codes to avoid collisions
      const allCodesRows = await dbQuery(`SELECT encrypted_code FROM product_encrypted_codes`);
      const registeredCodes = new Set<string>(allCodesRows.map((r: any) => r.encrypted_code));

      for (const name of missingNames) {
        const norm = name.toLowerCase();
        let salt = 0;
        let candidateCode = '';

        do {
          candidateCode = derive3LetterCode(name, salt);
          salt++;
        } while (registeredCodes.has(candidateCode));

        registeredCodes.add(candidateCode);

        // Persist to database
        try {
          const inserted = await dbQuery(
            `INSERT INTO product_encrypted_codes (item_name, normalized_name, encrypted_code)
             VALUES ($1, $2, $3)
             ON CONFLICT (normalized_name) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
             RETURNING encrypted_code`,
            [name, norm, candidateCode]
          );

          const finalCode = inserted[0]?.encrypted_code || candidateCode;
          resultMap.set(name, finalCode);
        } catch (insertErr) {
          resultMap.set(name, candidateCode);
        }
      }
    }
  } catch (err: any) {
    // In case table does not exist yet or connection issue, fallback to deterministic generator
    for (const name of uniqueNames) {
      if (!resultMap.has(name)) {
        resultMap.set(name, derive3LetterCode(name));
      }
    }
  }

  return resultMap;
}
