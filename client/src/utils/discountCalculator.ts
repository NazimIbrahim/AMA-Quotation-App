/**
 * Discount Calculator for Quotations:
 * Directly reduces rates per sq.ft (for box/sqft items) or rate per unit (for pieces/bags/nos)
 * while strictly EXCLUDING CERA brand items from discounts.
 *
 * Formula:
 * 1. nonCeraBaseTotal = sum of all items where brand !== 'cera' (using base list rates)
 * 2. discountPercent = (discountAmount / nonCeraBaseTotal) * 100
 * 3. For each non-Cera item:
 *    - rate_per_sqft or rate_per_unit is deducted by discountPercent
 *    - item total_amount is recomputed from the discounted rate
 * 4. Cera items remain completely untouched at original rates
 */

export function isCeraBrand(brand?: string): boolean {
  if (!brand) return false;
  const b = brand.trim().toLowerCase();
  return b === 'cera' || b.startsWith('cera ') || b.startsWith('cera-') || b.startsWith('cera_');
}

export interface DiscountCalculationResult {
  ceraBaseTotal: number;
  nonCeraBaseTotal: number;
  totalBaseQuote: number;
  discountAmount: number;
  discountPercent: number;
  grossTotal: number;
  taxableAmount: number;
  cgstRate: number;
  cgstAmount: number;
  sgstRate: number;
  sgstAmount: number;
  igstRate: number;
  igstAmount: number;
  roundOff: number;
  netTotal: number;
}

export function calculateQuotationDiscountAndTotals(
  items: any[],
  discountAmountInput: number,
  discountPercentInput: number,
  taxType: string = 'cgst_sgst'
): DiscountCalculationResult {
  let ceraBaseTotal = 0;
  let nonCeraBaseTotal = 0;

  // 1. Calculate base totals for all items
  for (const it of items) {
    const pType = String(it.product_type || 'box').toLowerCase();

    // Ensure base rates are initialized
    const rSqft = parseFloat(it.rate_per_sqft) || 0;
    const rBox = parseFloat(it.rate_per_box) || 0;

    const cov = parseFloat(it.coverage_area) || 0;
    if (it.base_rate_per_sqft === undefined || it.base_rate_per_sqft === null || Number(it.base_rate_per_sqft) === 0) {
      it.base_rate_per_sqft = rSqft;
    } else {
      it.base_rate_per_sqft = parseFloat(it.base_rate_per_sqft) || 0;
    }

    if (it.base_rate_per_box === undefined || it.base_rate_per_box === null || Number(it.base_rate_per_box) === 0) {
      it.base_rate_per_box = rBox > 0 ? rBox : (cov > 0 ? parseFloat((it.base_rate_per_sqft * cov).toFixed(2)) : 0);
    } else {
      it.base_rate_per_box = parseFloat(it.base_rate_per_box) || 0;
    }

    let itemBaseTotal = 0;
    if (['bags', 'pieces', 'nos'].includes(pType)) {
      const qty = parseFloat(it.quantity_boxes) || 0;
      itemBaseTotal = parseFloat((qty * it.base_rate_per_box).toFixed(2));
    } else {
      const qtySqft = parseFloat(it.quantity_sqft) || 0;
      itemBaseTotal = parseFloat((qtySqft * it.base_rate_per_sqft).toFixed(2));
    }

    it._itemBaseTotal = itemBaseTotal;

    if (isCeraBrand(it.brand)) {
      ceraBaseTotal += itemBaseTotal;
    } else {
      nonCeraBaseTotal += itemBaseTotal;
    }
  }

  ceraBaseTotal = parseFloat(ceraBaseTotal.toFixed(2));
  nonCeraBaseTotal = parseFloat(nonCeraBaseTotal.toFixed(2));
  const totalBaseQuote = parseFloat((ceraBaseTotal + nonCeraBaseTotal).toFixed(2));

  // 2. Determine discount percentage on non-CERA items
  let discountAmount = typeof discountAmountInput === 'number' ? discountAmountInput : (parseFloat(discountAmountInput) || 0);
  let discountPercent = typeof discountPercentInput === 'number' ? discountPercentInput : (parseFloat(discountPercentInput) || 0);

  if (discountAmount > 0 && nonCeraBaseTotal > 0) {
    if (discountAmount > nonCeraBaseTotal) {
      discountAmount = nonCeraBaseTotal;
    }
    // Exact user requirement: (discountAmount / nonCeraBaseTotal) * 100
    discountPercent = (discountAmount / nonCeraBaseTotal) * 100;
  } else if (discountPercent > 0 && !discountAmount) {
    if (discountPercent > 100) discountPercent = 100;
    discountAmount = parseFloat(((nonCeraBaseTotal * discountPercent) / 100).toFixed(2));
  } else if (nonCeraBaseTotal <= 0) {
    discountAmount = 0;
    discountPercent = 0;
  }

  // 3. Apply discount directly to eligible non-CERA item rates
  let discountedGrossTotal = 0;
  for (const it of items) {
    const pType = String(it.product_type || 'box').toLowerCase();
    const isCera = isCeraBrand(it.brand);

    if (isCera || discountPercent <= 0) {
      // Excluded: rate remains at base rate
      it.discount_percent = 0;
      it.discount_amount = 0;
      it.rate_per_sqft = it.base_rate_per_sqft;
      it.rate_per_box = it.base_rate_per_box;
      it.total_amount = it._itemBaseTotal;
    } else {
      // Deduct discount percentage from rate
      it.discount_percent = parseFloat(discountPercent.toFixed(2));
      const multiplier = Math.max(0, 1 - discountPercent / 100);

      if (pType === 'box') {
        it.rate_per_sqft = parseFloat((it.base_rate_per_sqft * multiplier).toFixed(2));
        const cov = parseFloat(it.coverage_area) || 0;
        it.rate_per_box = parseFloat((it.rate_per_sqft * cov).toFixed(2));
        const qtySqft = parseFloat(it.quantity_sqft) || 0;
        it.total_amount = parseFloat((qtySqft * it.rate_per_sqft).toFixed(2));
      } else if (pType === 'sqft') {
        it.rate_per_sqft = parseFloat((it.base_rate_per_sqft * multiplier).toFixed(2));
        it.rate_per_box = 0;
        const qtySqft = parseFloat(it.quantity_sqft) || 0;
        it.total_amount = parseFloat((qtySqft * it.rate_per_sqft).toFixed(2));
      } else {
        // 'bags', 'pieces', 'nos'
        it.rate_per_sqft = 0;
        it.rate_per_box = parseFloat((it.base_rate_per_box * multiplier).toFixed(2));
        const qty = parseFloat(it.quantity_boxes) || 0;
        it.total_amount = parseFloat((qty * it.rate_per_box).toFixed(2));
      }

      it.discount_amount = parseFloat((it._itemBaseTotal - it.total_amount).toFixed(2));
    }

    discountedGrossTotal += it.total_amount;
  }

  discountedGrossTotal = parseFloat(discountedGrossTotal.toFixed(2));

  // 4. Since the discount is ALREADY deducted from each item directly,
  // the taxable amount equals the discounted gross total!
  const taxableAmount = discountedGrossTotal;

  let cgstRate = 0, cgstAmount = 0, sgstRate = 0, sgstAmount = 0, igstRate = 0, igstAmount = 0;
  if (taxType === 'cgst_sgst') {
    cgstRate = 9.0;
    sgstRate = 9.0;
    cgstAmount = parseFloat(((taxableAmount * cgstRate) / 100).toFixed(2));
    sgstAmount = parseFloat(((taxableAmount * sgstRate) / 100).toFixed(2));
  } else if (taxType === 'igst') {
    igstRate = 18.0;
    igstAmount = parseFloat(((taxableAmount * igstRate) / 100).toFixed(2));
  }

  const subTotalWithTax = taxableAmount + cgstAmount + sgstAmount + igstAmount;
  const roundedNet = Math.round(subTotalWithTax);
  const roundOff = parseFloat((roundedNet - subTotalWithTax).toFixed(2));

  return {
    ceraBaseTotal,
    nonCeraBaseTotal,
    totalBaseQuote,
    discountAmount: parseFloat(discountAmount.toFixed(2)),
    discountPercent: parseFloat(discountPercent.toFixed(2)),
    grossTotal: discountedGrossTotal,
    taxableAmount,
    cgstRate,
    cgstAmount,
    sgstRate,
    sgstAmount,
    igstRate,
    igstAmount,
    roundOff,
    netTotal: roundedNet,
  };
}
