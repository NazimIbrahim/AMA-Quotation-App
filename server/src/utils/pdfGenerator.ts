import PDFDocument from 'pdfkit';
import { numberToWordsIndian } from './numberToWords';
import { buildEncryptedProductMap } from './encryptedCode';

export interface QuotationPdfData {
  quotation: {
    quotation_number: string;
    quotation_date: string;
    customer_name: string;
    customer_phone: string;
    delivery_address: string;
    project_name?: string;
    sales_person_name: string;
    assisted_sales_person_name?: string;
    status: string;
    gross_total: number;
    discount_percent?: number;
    discount_amount: number;
    taxable_amount: number;
    tax_type: string;
    cgst_rate: number;
    cgst_amount: number;
    sgst_rate: number;
    sgst_amount: number;
    igst_rate: number;
    igst_amount: number;
    round_off: number;
    net_total: number;
    special_notes?: string;
  };
  areas: Array<{
    id: number;
    area_name: string;
    display_order: number;
    items: Array<{
      sl_no: number;
      description: string;
      size: string;
      brand: string;
      product_type?: string;
      coverage_area: number;
      quantity_sqft: number;
      rate_per_sqft: number;
      quantity_boxes: number;
      rate_per_box: number;
      total_amount: number;
    }>;
  }>;
  company: {
    company_name: string;
    tagline: string;
    address_line1: string;
    address_line2: string;
    phone: string;
    email: string;
    website: string;
    gstin: string;
    bank_name: string;
    account_name: string;
    account_number: string;
    ifsc_code: string;
    branch: string;
    store_manager_title: string;
    store_manager_name: string;
    sales_associate_title: string;
    terms_json: string[];
  };
  encrypted?: boolean;
}

export function generateQuotationPdf(data: QuotationPdfData): PDFKit.PDFDocument {
  const doc = new PDFDocument({
    size: 'A4',
    margin: 30,
    bufferPages: true,
  });

  const { quotation, areas = [] } = data;
  const company = data.company || {
    company_name: 'AMA Ceramics Pvt Ltd',
    tagline: 'Exclusive Architectural Tiles & Surfaces',
    address_line1: 'Survey No. 48, Near NH-48 Showroom Corridor',
    address_line2: 'Bengaluru, Karnataka 560068',
    phone: '+91 98450 12345',
    email: 'info@amaceramics.com',
    website: 'www.amaceramics.com',
    gstin: '29AABCA1234F1Z5',
    bank_name: 'ICICI Bank',
    account_name: 'AMA Ceramics Private Limited',
    account_number: '000205001234',
    ifsc_code: 'ICIC0000002',
    branch: 'Bengaluru Main Branch',
    store_manager_title: 'Store Manager',
    store_manager_name: 'Deepak Patel',
    sales_associate_title: 'Sales Associate',
    terms_json: [],
  };

  // Colors
  const primaryColor = '#1B365D'; // AMA Navy
  const secondaryColor = '#8A6D3B'; // Gold / Bronze accent
  const lightBg = '#F4F6F9';
  const tableBorder = '#D0D7DE';
  const textColor = '#24292F';

  // Helper for formatting Indian currency
  const formatCurrency = (val: number) => {
    return Number(val || 0).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  // Header
  doc
    .rect(30, 30, 535, 75)
    .fillAndStroke(lightBg, tableBorder);

  // Company Info (Left)
  doc
    .fontSize(16)
    .font('Helvetica-Bold')
    .fillColor(primaryColor)
    .text(company.company_name || 'AMA Ceramics Pvt Ltd', 45, 40);

  doc
    .fontSize(8)
    .font('Helvetica')
    .fillColor('#555555')
    .text(company.address_line1 + ', ' + company.address_line2, 45, 58)
    .text(`Phone: ${company.phone} | Web: ${company.website}`, 45, 70)
    .text(`GSTIN: ${company.gstin}`, 45, 82);

  // QUOTATION Title (Right)
  doc
    .fontSize(18)
    .font('Helvetica-Bold')
    .fillColor(primaryColor)
    .text('QUOTATION', 380, 42, { align: 'right', width: 170 });

  doc
    .fontSize(9)
    .font('Helvetica-Bold')
    .fillColor(textColor)
    .text(`Ref: ${quotation.quotation_number}`, 380, 64, { align: 'right', width: 170 })
    .text(`Date: ${new Date(quotation.quotation_date).toLocaleDateString('en-GB')}`, 380, 78, { align: 'right', width: 170 })
    .text(`Status: ${quotation.status.toUpperCase()}`, 380, 92, { align: 'right', width: 170 });

  // Customer & Salesperson Info Box
  const customerBoxY = 115;
  doc
    .rect(30, customerBoxY, 535, 55)
    .fillAndStroke('#FFFFFF', tableBorder);

  // Left: Customer Details
  doc
    .fontSize(9)
    .font('Helvetica-Bold')
    .fillColor(primaryColor)
    .text('Customer Details:', 40, customerBoxY + 6);

  doc
    .fontSize(8.5)
    .font('Helvetica')
    .fillColor(textColor)
    .text(`Name: ${quotation.customer_name}`, 40, customerBoxY + 18)
    .text(`Contact: ${quotation.customer_phone}`, 40, customerBoxY + 30)
    .text(`Site: ${quotation.delivery_address || 'As per order'}`, 40, customerBoxY + 42, { width: 270, ellipsis: true });

  // Right: Salesperson & Project
  doc
    .fontSize(9)
    .font('Helvetica-Bold')
    .fillColor(primaryColor)
    .text('Project & Sales Associate:', 320, customerBoxY + 6);

  const salesAssociateLabel = quotation.assisted_sales_person_name
    ? `Sales: ${quotation.sales_person_name} (Assisted: ${quotation.assisted_sales_person_name})`
    : `Sales Associate: ${quotation.sales_person_name}`;

  doc
    .fontSize(8.5)
    .font('Helvetica')
    .fillColor(textColor)
    .text(`Project: ${quotation.project_name || 'Standard Residential'}`, 320, customerBoxY + 18)
    .text(salesAssociateLabel, 320, customerBoxY + 30, { width: 240, ellipsis: true })
    .text(`Store Manager: ${company.store_manager_name}`, 320, customerBoxY + 42);

  // Table setup
  const isEncrypted = Boolean(data.encrypted);
  const allItems = areas.flatMap((a) => a.items || []);
  const encryptedMap = isEncrypted
    ? buildEncryptedProductMap(quotation.quotation_number || quotation.quotation_date || 'AMA', allItems)
    : new Map<string, string>();

  let currentY = 180;
  // Encrypted mode: Brand column omitted, Description gets 158 width
  // Standard mode: Brand column included (10 columns)
  const colX = isEncrypted
    ? [30, 52, 210, 260, 310, 355, 410, 455, 505]
    : [30, 50, 165, 235, 280, 322, 362, 410, 455, 505];
  const colW = isEncrypted
    ? [22, 158, 50, 50, 45, 55, 45, 50, 60]
    : [20, 115, 70, 45, 42, 40, 48, 45, 50, 60];

  function drawTableHeader(y: number) {
    doc.rect(30, y, 535, 20).fillAndStroke(primaryColor, primaryColor);
    doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#FFFFFF');

    if (isEncrypted) {
      doc.text('Sl.', colX[0], y + 6, { width: colW[0], align: 'center' });
      doc.text('Description', colX[1], y + 6, { width: colW[1] });
      doc.text('Size', colX[2], y + 6, { width: colW[2], align: 'center' });
      doc.text('Cov/Box', colX[3], y + 6, { width: colW[3], align: 'right' });
      doc.text('Sqft', colX[4], y + 6, { width: colW[4], align: 'right' });
      doc.text('Rate/Sqft', colX[5], y + 6, { width: colW[5], align: 'right' });
      doc.text('Boxes/Qty', colX[6], y + 6, { width: colW[6], align: 'right' });
      doc.text('Rate/Unit', colX[7], y + 6, { width: colW[7], align: 'right' });
      doc.text('Total', colX[8], y + 6, { width: colW[8], align: 'right' });
    } else {
      doc.text('Sl.', colX[0], y + 6, { width: colW[0], align: 'center' });
      doc.text('Description', colX[1], y + 6, { width: colW[1] });
      doc.text('Brand', colX[2], y + 6, { width: colW[2] });
      doc.text('Size', colX[3], y + 6, { width: colW[3], align: 'center' });
      doc.text('Cov/Box', colX[4], y + 6, { width: colW[4], align: 'right' });
      doc.text('Sqft', colX[5], y + 6, { width: colW[5], align: 'right' });
      doc.text('Rate/Sqft', colX[6], y + 6, { width: colW[6], align: 'right' });
      doc.text('Boxes/Qty', colX[7], y + 6, { width: colW[7], align: 'right' });
      doc.text('Rate/Unit', colX[8], y + 6, { width: colW[8], align: 'right' });
      doc.text('Total', colX[9], y + 6, { width: colW[9], align: 'right' });
    }
  }

  drawTableHeader(currentY);
  currentY += 20;

  const totalItemCount = areas.reduce((acc, a) => acc + (a.items?.length || 0), 0);
  if (totalItemCount === 0) {
    doc.rect(30, currentY, 535, 25).stroke(tableBorder);
    doc.fontSize(8).font('Helvetica-Oblique').fillColor('#666666');
    doc.text('No itemized materials or tiles recorded in this quotation.', 45, currentY + 8);
    currentY += 28;
  }

  // Render Areas and Items
  for (const area of areas) {
    if (!area.items || area.items.length === 0) continue;

    // Check page break
    if (currentY > 700) {
      doc.addPage();
      currentY = 40;
      drawTableHeader(currentY);
      currentY += 20;
    }

    // Area Header Bar
    doc.rect(30, currentY, 535, 16).fillAndStroke('#E8EEF5', tableBorder);
    doc.fontSize(8).font('Helvetica-Bold').fillColor(primaryColor);
    doc.text(`AREA: ${area.area_name.toUpperCase()}`, 38, currentY + 4);
    currentY += 16;

    for (const item of area.items) {
      if (currentY > 730) {
        doc.addPage();
        currentY = 40;
        drawTableHeader(currentY);
        currentY += 20;
      }

      const pType = (item.product_type || 'box').toLowerCase();
      let covText = Number(item.coverage_area).toFixed(1);
      let sqftText = Number(item.quantity_sqft).toFixed(0);
      let rateSqftText = formatCurrency(item.rate_per_sqft);
      let qtyUnitText = Number(item.quantity_boxes).toFixed(0);
      let rateUnitText = formatCurrency(item.rate_per_box);

      if (pType === 'sqft') {
        covText = '-';
        qtyUnitText = '-';
        rateUnitText = '-';
      } else if (['bags', 'pieces', 'nos'].includes(pType)) {
        covText = '-';
        sqftText = '-';
        rateSqftText = '-';
        const suffix = pType === 'bags' ? 'Bags' : pType === 'pieces' ? 'Pcs' : 'Nos';
        qtyUnitText = `${Number(item.quantity_boxes).toFixed(0)} ${suffix}`;
      }

      const descText = isEncrypted
        ? (encryptedMap.get((item.description || '').trim()) || `${item.description}-AMA`)
        : item.description;

      doc.rect(30, currentY, 535, 16).stroke(tableBorder);
      doc.fontSize(7.5).font('Helvetica').fillColor(textColor);

      if (isEncrypted) {
        doc.text(String(item.sl_no), colX[0], currentY + 4, { width: colW[0], align: 'center' });
        doc.text(descText, colX[1], currentY + 4, { width: colW[1], ellipsis: true });
        doc.text(item.size, colX[2], currentY + 4, { width: colW[2], align: 'center' });
        doc.text(covText, colX[3], currentY + 4, { width: colW[3], align: 'right' });
        doc.text(sqftText, colX[4], currentY + 4, { width: colW[4], align: 'right' });
        doc.text(rateSqftText, colX[5], currentY + 4, { width: colW[5], align: 'right' });
        doc.text(qtyUnitText, colX[6], currentY + 4, { width: colW[6], align: 'right' });
        doc.text(rateUnitText, colX[7], currentY + 4, { width: colW[7], align: 'right' });
        doc.text(formatCurrency(item.total_amount), colX[8], currentY + 4, { width: colW[8], align: 'right' });
      } else {
        doc.text(String(item.sl_no), colX[0], currentY + 4, { width: colW[0], align: 'center' });
        doc.text(descText, colX[1], currentY + 4, { width: colW[1], ellipsis: true });
        doc.text(item.brand || '-', colX[2], currentY + 4, { width: colW[2], ellipsis: true });
        doc.text(item.size, colX[3], currentY + 4, { width: colW[3], align: 'center' });
        doc.text(covText, colX[4], currentY + 4, { width: colW[4], align: 'right' });
        doc.text(sqftText, colX[5], currentY + 4, { width: colW[5], align: 'right' });
        doc.text(rateSqftText, colX[6], currentY + 4, { width: colW[6], align: 'right' });
        doc.text(qtyUnitText, colX[7], currentY + 4, { width: colW[7], align: 'right' });
        doc.text(rateUnitText, colX[8], currentY + 4, { width: colW[8], align: 'right' });
        doc.text(formatCurrency(item.total_amount), colX[9], currentY + 4, { width: colW[9], align: 'right' });
      }

      currentY += 16;
    }
  }

  // Summary & Totals Block
  if (currentY > 640) {
    doc.addPage();
    currentY = 40;
  } else {
    currentY += 10;
  }

  // Left Side: Amount in Words and Notes
  const wordsBoxY = currentY;
  doc
    .fontSize(8)
    .font('Helvetica-Bold')
    .fillColor(primaryColor)
    .text('AMOUNT IN WORDS:', 35, wordsBoxY);

  const words = numberToWordsIndian(quotation.net_total);
  doc
    .fontSize(8)
    .font('Helvetica-Oblique')
    .fillColor(textColor)
    .text(words, 35, wordsBoxY + 12, { width: 300 });

  if (quotation.special_notes) {
    doc
      .fontSize(7.5)
      .font('Helvetica-Bold')
      .fillColor(primaryColor)
      .text('Special Notes:', 35, wordsBoxY + 34);

    doc
      .fontSize(7.5)
      .font('Helvetica')
      .fillColor(textColor)
      .text(quotation.special_notes, 35, wordsBoxY + 44, { width: 300 });
  }

  // Right Side: Totals Table
  const totalsX = 350;
  const totalsW = 215;
  let totalsY = wordsBoxY;

  const renderTotalRow = (label: string, value: string, isBold: boolean = false) => {
    doc.rect(totalsX, totalsY, totalsW, 16).stroke(tableBorder);
    doc
      .fontSize(8)
      .font(isBold ? 'Helvetica-Bold' : 'Helvetica')
      .fillColor(isBold ? primaryColor : textColor);
    doc.text(label, totalsX + 8, totalsY + 4, { width: 110 });
    doc.text(value, totalsX + 115, totalsY + 4, { width: 90, align: 'right' });
    totalsY += 16;
  };

  const discAmt = Number(quotation.discount_amount || 0);
  if (discAmt > 0) {
    const listTotal = Number(quotation.gross_total || 0) + discAmt;
    const discPct = Number(quotation.discount_percent || 0);
    renderTotalRow('LIST TOTAL', formatCurrency(listTotal));
    renderTotalRow(
      discPct > 0 ? `DIRECT DISCOUNT (${discPct}%)` : 'DIRECT DISCOUNT',
      `-${formatCurrency(discAmt)}`
    );
    renderTotalRow('TAXABLE TOTAL', formatCurrency(quotation.gross_total), true);
  } else {
    renderTotalRow('GROSS TOTAL', formatCurrency(quotation.gross_total));
  }
  if (quotation.round_off !== 0) {
    renderTotalRow('ROUND OFF', formatCurrency(quotation.round_off));
  }
  if (quotation.tax_type === 'cgst_sgst' && quotation.cgst_amount > 0) {
    renderTotalRow(`CGST (${quotation.cgst_rate}%)`, formatCurrency(quotation.cgst_amount));
    renderTotalRow(`SGST (${quotation.sgst_rate}%)`, formatCurrency(quotation.sgst_amount));
  } else if (quotation.tax_type === 'igst' && quotation.igst_amount > 0) {
    renderTotalRow(`IGST (${quotation.igst_rate}%)`, formatCurrency(quotation.igst_amount));
  }

  // Highlighted NET TOTAL row
  doc.rect(totalsX, totalsY, totalsW, 18).fillAndStroke(primaryColor, primaryColor);
  doc.fontSize(9).font('Helvetica-Bold').fillColor('#FFFFFF');
  doc.text('NET TOTAL', totalsX + 8, totalsY + 4, { width: 110 });
  doc.text(`INR ${formatCurrency(quotation.net_total)}`, totalsX + 115, totalsY + 4, { width: 90, align: 'right' });
  totalsY += 26;

  currentY = Math.max(wordsBoxY + 70, totalsY);

  // Page break check for Terms and Bank details
  if (currentY > 620) {
    doc.addPage();
    currentY = 40;
  }

  // Bank Details & Signatures Box
  doc.rect(30, currentY, 535, 60).fillAndStroke(lightBg, tableBorder);
  doc.fontSize(8).font('Helvetica-Bold').fillColor(primaryColor);
  doc.text('BANK DETAILS FOR SETTLEMENT:', 40, currentY + 6);

  doc
    .fontSize(7.5)
    .font('Helvetica')
    .fillColor(textColor)
    .text(`Name: ${company.account_name}`, 40, currentY + 18)
    .text(`A/C: ${company.account_number}  |  Bank: ${company.bank_name}`, 40, currentY + 28)
    .text(`IFSC: ${company.ifsc_code}  |  Branch: ${company.branch}`, 40, currentY + 38)
    .text(`UPI / Cheques in favor of: "${company.account_name}"`, 40, currentY + 48);

  // Signature Blocks
  doc
    .fontSize(7.5)
    .font('Helvetica-Bold')
    .fillColor(textColor)
    .text(`${company.sales_associate_title}`, 320, currentY + 18)
    .text(
      quotation.assisted_sales_person_name
        ? `${quotation.sales_person_name} & ${quotation.assisted_sales_person_name}`
        : `${quotation.sales_person_name}`,
      320,
      currentY + 30,
      { width: 120, ellipsis: true }
    )
    .text(`Signature: ________________`, 320, currentY + 44);

  doc
    .fontSize(7.5)
    .font('Helvetica-Bold')
    .fillColor(textColor)
    .text(`${company.store_manager_title}`, 450, currentY + 18)
    .text(`${company.store_manager_name}`, 450, currentY + 30)
    .text(`Signature: ________________`, 450, currentY + 44);

  currentY += 68;

  // Terms and Conditions Section
  if (currentY > 700) {
    doc.addPage();
    currentY = 40;
  }

  doc.fontSize(8).font('Helvetica-Bold').fillColor(primaryColor).text('TERMS & CONDITIONS:', 30, currentY);
  currentY += 12;

  const termsList = Array.isArray(company.terms_json) ? company.terms_json : [];
  doc.fontSize(6.8).font('Helvetica').fillColor('#444444');
  termsList.forEach((term, idx) => {
    if (currentY > 780) {
      doc.addPage();
      currentY = 40;
    }
    doc.text(`${idx + 1}. ${term}`, 30, currentY, { width: 535 });
    currentY += 10;
  });

  // Footer on all pages
  const totalPages = doc.bufferedPageRange().count;
  for (let i = 0; i < totalPages; i++) {
    doc.switchToPage(i);
    doc
      .fontSize(7)
      .font('Helvetica')
      .fillColor('#888888')
      .text(
        `AMA Ceramics Pvt Ltd — Ref: ${quotation.quotation_number}${isEncrypted ? ' (Encrypted Export)' : ''} — Page ${i + 1} of ${totalPages}`,
        30,
        805,
        { align: 'center', width: 535 }
      );
  }

  return doc;
}
