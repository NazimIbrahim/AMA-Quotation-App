import { query, withTransaction, pool } from '../db/connection';

async function seedMissingItems() {
  console.log('--- Seeding Item Details for Quotations without Areas ---');

  // Find all quotations without areas
  const emptyQuotes = await query<{
    id: number;
    quotation_number: string;
  }>(`
    SELECT q.id, q.quotation_number
    FROM quotations q
    LEFT JOIN quotation_areas a ON a.quotation_id = q.id
    WHERE a.id IS NULL
    ORDER BY q.id ASC
  `);

  console.log(`Found ${emptyQuotes.length} quotations without itemized areas.`);

  if (emptyQuotes.length === 0) {
    console.log('All quotations already have areas and items.');
    await pool.end();
    return;
  }

  const sampleProducts = [
    { desc: 'OMBRA EMERALD ULTRA - SS', size: '1200X1800', brand: 'Simpolo Ceramics', cov: 46.5, rateSqft: 145 },
    { desc: 'HARMONY ONYX - KAJ', size: '1200X1800', brand: 'Kajaria Eternity', cov: 46.5, rateSqft: 125 },
    { desc: 'CORSICA SAND MATT - SS', size: '1200X1800', brand: 'Simpolo Ceramics', cov: 46.5, rateSqft: 145 },
    { desc: 'VITERBO IVORY MATT - GRIFINE', size: '600X1200', brand: 'Grifine Ceramics', cov: 15.5, rateSqft: 90 },
    { desc: 'ELEGENCE BLACK - SIMERO', size: '1200X1800', brand: 'Simero Vitrified', cov: 46.5, rateSqft: 160 },
    { desc: 'AMELIA GIRGIO MATT - QUTONE', size: '1200X1800', brand: 'Qutone Ceramics', cov: 46.5, rateSqft: 140 },
    { desc: 'PIETRA GREY LAPPATO - NEXION', size: '1200X1800', brand: 'Nexion Surfaces', cov: 46.5, rateSqft: 390 },
    { desc: 'X-WOOD TEAK - KAJ', size: '200X1200', brand: 'Kajaria Eternity', cov: 15.5, rateSqft: 90 },
  ];

  const batchSize = 250;
  let count = 0;

  for (let b = 0; b < emptyQuotes.length; b += batchSize) {
    const chunk = emptyQuotes.slice(b, b + batchSize);

    await withTransaction(async (client) => {
      for (const quote of chunk) {
        // Area 1: Ground Floor / Living
        const area1Res = await client.query(
          `INSERT INTO quotation_areas (quotation_id, area_name, display_order)
           VALUES ($1, 'GROUND FLOOR / LIVING', 1) RETURNING id`,
          [quote.id]
        );
        const area1Id = area1Res.rows[0].id;

        // Area 2: Master Bathroom
        const area2Res = await client.query(
          `INSERT INTO quotation_areas (quotation_id, area_name, display_order)
           VALUES ($1, 'MASTER BATHROOM', 2) RETURNING id`,
          [quote.id]
        );
        const area2Id = area2Res.rows[0].id;

        // Select 2 items for Area 1
        const p1 = sampleProducts[(quote.id * 2) % sampleProducts.length];
        const p2 = sampleProducts[(quote.id * 3 + 1) % sampleProducts.length];
        // Select 2 items for Area 2
        const p3 = sampleProducts[(quote.id * 5 + 2) % sampleProducts.length];
        const p4 = sampleProducts[(quote.id * 7 + 3) % sampleProducts.length];

        const sqft1 = (3 + (quote.id % 5)) * p1.cov;
        const boxes1 = Math.round(sqft1 / p1.cov);
        const rateBox1 = parseFloat((p1.rateSqft * p1.cov).toFixed(2));
        const total1 = parseFloat((sqft1 * p1.rateSqft).toFixed(2));

        const sqft2 = (2 + ((quote.id + 1) % 4)) * p2.cov;
        const boxes2 = Math.round(sqft2 / p2.cov);
        const rateBox2 = parseFloat((p2.rateSqft * p2.cov).toFixed(2));
        const total2 = parseFloat((sqft2 * p2.rateSqft).toFixed(2));

        const sqft3 = (2 + ((quote.id + 2) % 3)) * p3.cov;
        const boxes3 = Math.round(sqft3 / p3.cov);
        const rateBox3 = parseFloat((p3.rateSqft * p3.cov).toFixed(2));
        const total3 = parseFloat((sqft3 * p3.rateSqft).toFixed(2));

        const sqft4 = (1 + ((quote.id + 3) % 4)) * p4.cov;
        const boxes4 = Math.round(sqft4 / p4.cov);
        const rateBox4 = parseFloat((p4.rateSqft * p4.cov).toFixed(2));
        const total4 = parseFloat((sqft4 * p4.rateSqft).toFixed(2));

        // Insert items
        await client.query(`
          INSERT INTO quotation_items (
            quotation_id, area_id, sl_no, description, size, brand,
            coverage_area, quantity_sqft, rate_per_sqft, quantity_boxes, rate_per_box, total_amount
          ) VALUES
          ($1, $2, 1, '${p1.desc}', '${p1.size}', '${p1.brand}', ${p1.cov}, ${sqft1}, ${p1.rateSqft}, ${boxes1}, ${rateBox1}, ${total1}),
          ($1, $2, 2, '${p2.desc}', '${p2.size}', '${p2.brand}', ${p2.cov}, ${sqft2}, ${p2.rateSqft}, ${boxes2}, ${rateBox2}, ${total2}),
          ($1, $3, 3, '${p3.desc}', '${p3.size}', '${p3.brand}', ${p3.cov}, ${sqft3}, ${p3.rateSqft}, ${boxes3}, ${rateBox3}, ${total3}),
          ($1, $3, 4, '${p4.desc}', '${p4.size}', '${p4.brand}', ${p4.cov}, ${sqft4}, ${p4.rateSqft}, ${boxes4}, ${rateBox4}, ${total4})
        `, [quote.id, area1Id, area2Id]);

        const grossTotal = total1 + total2 + total3 + total4;
        const discountAmount = parseFloat((grossTotal * 0.05).toFixed(2));
        const taxableAmount = grossTotal - discountAmount;
        const cgstAmount = parseFloat((taxableAmount * 0.09).toFixed(2));
        const sgstAmount = parseFloat((taxableAmount * 0.09).toFixed(2));
        const netTotal = Math.round(taxableAmount + cgstAmount + sgstAmount);
        const roundOff = parseFloat((netTotal - (taxableAmount + cgstAmount + sgstAmount)).toFixed(2));

        // Update quotation financial totals to match items exactly
        await client.query(`
          UPDATE quotations
          SET gross_total = $1,
              discount_percent = 5.0,
              discount_amount = $2,
              taxable_amount = $3,
              cgst_rate = 9.0,
              cgst_amount = $4,
              sgst_rate = 9.0,
              sgst_amount = $5,
              round_off = $6,
              net_total = $7
          WHERE id = $8
        `, [grossTotal, discountAmount, taxableAmount, cgstAmount, sgstAmount, roundOff, netTotal, quote.id]);
      }
    });

    count += chunk.length;
    process.stdout.write(`  Populated items for ${count} / ${emptyQuotes.length} quotations...\r`);
  }

  // Update sequences
  await query(`
    INSERT INTO quotation_sequences (year_prefix, last_seq)
    VALUES ('2026', 10000)
    ON CONFLICT (year_prefix) DO UPDATE SET last_seq = 10000;
  `);

  console.log(`\nSuccessfully populated itemized areas for all ${count} quotations.`);
  await pool.end();
}

seedMissingItems().catch(console.error);
