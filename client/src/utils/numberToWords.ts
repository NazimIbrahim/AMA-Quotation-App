// Number to Words for Indian Currency / Quotations

const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
];

const TENS = [
  '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'
];

function convertBelowThousand(n: number): string {
  let str = '';
  if (n >= 100) {
    str += ONES[Math.floor(n / 100)] + ' Hundred ';
    n %= 100;
  }
  if (n >= 20) {
    str += TENS[Math.floor(n / 10)] + ' ';
    n %= 10;
  }
  if (n > 0) {
    str += ONES[n] + ' ';
  }
  return str.trim();
}

export function numberToWordsIndian(amount: number): string {
  if (amount === 0) return 'Rupees Zero Only';

  const isNegative = amount < 0;
  amount = Math.abs(amount);

  const rupees = Math.floor(amount);
  const paise = Math.round((amount - rupees) * 100);

  let num = rupees;
  let words = '';

  const crores = Math.floor(num / 10000000);
  num %= 10000000;

  const lakhs = Math.floor(num / 100000);
  num %= 100000;

  const thousands = Math.floor(num / 1000);
  num %= 1000;

  const hundredsAndBelow = num;

  if (crores > 0) {
    words += convertBelowThousand(crores) + ' Crore ';
  }
  if (lakhs > 0) {
    words += convertBelowThousand(lakhs) + ' Lakh ';
  }
  if (thousands > 0) {
    words += convertBelowThousand(thousands) + ' Thousand ';
  }
  if (hundredsAndBelow > 0) {
    words += convertBelowThousand(hundredsAndBelow) + ' ';
  }

  words = words.trim();
  let result = words ? `Rupees ${words}` : 'Rupees Zero';

  if (paise > 0) {
    result += ` and ${convertBelowThousand(paise)} Paise`;
  }

  result += ' Only';

  return isNegative ? `Minus ${result}` : result;
}
