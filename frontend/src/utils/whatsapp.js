
/** Normalize Indian mobile to digits with country code 91 (wa.me format). */
export function toWhatsAppNumber(mobile) {
  if (!mobile) return '';

  let digits = String(mobile).replace(/\D/g, '');

  if (digits.length === 10) {
    digits = `91${digits}`;
  } else if (digits.startsWith('0') && digits.length === 11) {
    digits = `91${digits.slice(1)}`;
  } else if (digits.startsWith('91') && digits.length >= 12) {
    digits = digits.slice(0, 12);
  }

  if (digits.length < 10) return '';

  return digits;
}

/** Format amount in Indian currency. */
function formatMoney(paise) {
  const rupees = (Number(paise) || 0) / 100;

  const num = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(rupees);

  return `₹ ${num}`;
}

/** Format item quantity. */
function formatQty(it) {
  if (it.productType === 'PER_ML') {
    return `${it.quantity} ml`;
  }

  return String(it.quantity);
}

/** Get payment status and methods. */
function paymentLabel(invoice) {
  const pays = Array.isArray(invoice.payments)
    ? invoice.payments
    : [];

  const paid = pays.reduce(
    (s, p) => s + (Number(p.amountPaise) || 0),
    0
  );

  const total = Number(invoice.totalPaise) || 0;

  const methods = pays
    .map((p) => String(p.method || '').toUpperCase())
    .filter(Boolean);

  const methodStr = methods.length
    ? methods.join(' + ')
    : '';

  let status = 'UNPAID';

  if (total <= 0 || paid >= total) {
    status = 'PAID';
  } else if (paid > 0) {
    status = 'PARTIAL';
  }

  return methodStr
    ? `${status} · ${methodStr}`
    : status;
}

/**
 * Premium compact WhatsApp invoice.
 * Uses WhatsApp monospace formatting for aligned columns.
 */
export function buildInvoiceWhatsAppText(invoice, shopName = 'Amwaj') {
  if (!invoice) return '';

  const shop = (shopName || 'Amwaj').toUpperCase();
  const lines = [];

  const items = Array.isArray(invoice.items)
    ? invoice.items
    : [];

  const DIV = '────────────────────────────────────';

  // Format table columns.
  const pad = (value, width) => {
    const str = String(value ?? '');

    return str.length > width
      ? str.slice(0, width - 1) + '…'
      : str.padEnd(width);
  };

  // Branding and invoice number.
  const invoiceNo = invoice.invoiceNumber
    ? `INVOICE # ${invoice.invoiceNumber}`
    : 'INVOICE';

  lines.push(`✨ *${shop} PERFUMES*  |  *${invoiceNo}*`);
  lines.push('');

  // Customer and date.
  if (invoice.customer?.name) {
    lines.push(`Customer: ${invoice.customer.name}`);
  }

  if (invoice.createdAt) {
    const date = new Date(invoice.createdAt).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

    lines.push(`Date: ${date}`);
  }

  lines.push('');

  // Item table.
  lines.push('```');

  lines.push(
    `${pad('ITEM', 20)}${pad('QTY', 7)}${'AMOUNT'.padStart(9)}`
  );

  lines.push(DIV);

  items.forEach((it) => {
    const name = pad(it.productName || 'Item', 20);
    const qty = pad(formatQty(it), 7);
    const amount = formatMoney(it.lineTotalPaise);

    lines.push(`${name}${qty}${amount.padStart(9)}`);
  });

  lines.push(DIV);

  // Financial summary.
  const addTotal = (label, amount) => {
    const formatted = formatMoney(Math.abs(Number(amount) || 0));

    const value = Number(amount) < 0
      ? `- ${formatted}`
      : formatted;

    lines.push(
      `${label.padEnd(20)}${value.padStart(16)}`
    );
  };

  if (invoice.subtotalPaise != null) {
    addTotal('Subtotal', invoice.subtotalPaise);
  }

  if (Number(invoice.additionalPaise) > 0) {
    addTotal('Additional', invoice.additionalPaise);
  }

  if (Number(invoice.discountPaise) > 0) {
    addTotal('Discount', -invoice.discountPaise);
  }

  lines.push(DIV);

  addTotal('GRAND TOTAL', invoice.totalPaise);

  lines.push('```');

  // Payment information.
  lines.push('');
  lines.push(`💳 *Payment: ${paymentLabel(invoice)}*`);

  // Closing message.
  lines.push('');
  lines.push(`✨ *Thank you for choosing ${shop}!*`);
  lines.push('We look forward to your next visit.');

  return lines.join('\n');
}

/**
 * WhatsApp deep link.
 * With mobile → opens that customer's chat.
 * Without mobile → opens WhatsApp with the message.
 */
export function getWhatsAppShareUrl(invoice, shopName = 'Amwaj') {
  const text = buildInvoiceWhatsAppText(invoice, shopName);

  const num = toWhatsAppNumber(invoice?.customer?.mobile);

  if (num) {
    return `https://wa.me/${num}?text=${encodeURIComponent(text)}`;
  }

  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
