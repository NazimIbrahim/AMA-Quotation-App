import { PoolClient } from 'pg';

export async function generateNextQuotationNumber(client: PoolClient): Promise<string> {
  const now = new Date();
  const yearStr = String(now.getFullYear());

  // 1. Ensure the sequence record exists for this year
  await client.query(
    `INSERT INTO quotation_sequences (year_prefix, last_seq)
     VALUES ($1, 0)
     ON CONFLICT (year_prefix) DO NOTHING`,
    [yearStr]
  );

  // 2. Lock the sequence row for update
  const seqRes = await client.query(
    `SELECT last_seq FROM quotation_sequences
     WHERE year_prefix = $1 FOR UPDATE`,
    [yearStr]
  );

  let currentSeq = parseInt(seqRes.rows[0].last_seq, 10) || 0;

  // 3. Find the maximum sequence currently existing in quotations table for this year
  const maxRes = await client.query(
    `SELECT COALESCE(MAX(
       CAST(NULLIF(regexp_replace(quotation_number, '^AMA-[0-9]{4}-', ''), '') AS INTEGER)
     ), 0) as max_seq
     FROM quotations
     WHERE quotation_number LIKE 'AMA-' || $1 || '-%'`,
    [yearStr]
  );

  const maxExisting = parseInt(maxRes.rows[0].max_seq, 10) || 0;
  if (currentSeq < maxExisting) {
    currentSeq = maxExisting;
  }

  // 4. Ensure collision-free increment
  let nextSeq = currentSeq + 1;
  let candidateNumber = `AMA-${yearStr}-${String(nextSeq).padStart(4, '0')}`;

  while (true) {
    const existsRes = await client.query(
      `SELECT 1 FROM quotations WHERE quotation_number = $1`,
      [candidateNumber]
    );
    if (existsRes.rows.length === 0) {
      break;
    }
    nextSeq++;
    candidateNumber = `AMA-${yearStr}-${String(nextSeq).padStart(4, '0')}`;
  }

  await client.query(
    `UPDATE quotation_sequences SET last_seq = $1 WHERE year_prefix = $2`,
    [nextSeq, yearStr]
  );

  return candidateNumber;
}

export async function generateNextPaymentNumber(client: PoolClient): Promise<string> {
  const now = new Date();
  const yearStr = String(now.getFullYear());

  await client.query(
    `INSERT INTO payment_sequences (year_prefix, last_seq)
     VALUES ($1, 0)
     ON CONFLICT (year_prefix) DO NOTHING`,
    [yearStr]
  );

  const seqRes = await client.query(
    `SELECT last_seq FROM payment_sequences
     WHERE year_prefix = $1 FOR UPDATE`,
    [yearStr]
  );

  let currentSeq = parseInt(seqRes.rows[0].last_seq, 10) || 0;

  const maxRes = await client.query(
    `SELECT COALESCE(MAX(
       CAST(NULLIF(regexp_replace(payment_number, '^REC-[0-9]{4}-', ''), '') AS INTEGER)
     ), 0) as max_seq
     FROM payments
     WHERE payment_number LIKE 'REC-' || $1 || '-%'`,
    [yearStr]
  );

  const maxExisting = parseInt(maxRes.rows[0].max_seq, 10) || 0;
  if (currentSeq < maxExisting) {
    currentSeq = maxExisting;
  }

  let nextSeq = currentSeq + 1;
  let candidateNumber = `REC-${yearStr}-${String(nextSeq).padStart(4, '0')}`;

  while (true) {
    const existsRes = await client.query(
      `SELECT 1 FROM payments WHERE payment_number = $1`,
      [candidateNumber]
    );
    if (existsRes.rows.length === 0) {
      break;
    }
    nextSeq++;
    candidateNumber = `REC-${yearStr}-${String(nextSeq).padStart(4, '0')}`;
  }

  await client.query(
    `UPDATE payment_sequences SET last_seq = $1 WHERE year_prefix = $2`,
    [nextSeq, yearStr]
  );

  return candidateNumber;
}
