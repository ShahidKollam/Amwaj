/** Normalize Indian mobile to digits with country code 91 (wa.me format). */
export function toWhatsAppNumber(mobile) {
  if (!mobile) return '';
  let digits = String(mobile).replace(/\D/g, '');
  if (digits.length === 10) digits = `91${digits}`;
  else if (digits.startsWith('0') && digits.length === 11) digits = `91${digits.slice(1)}`;
  else if (digits.startsWith('91') && digits.length >= 12) digits = digits.slice(0, 12);
  if (digits.length < 10) return '';
  return digits;
}

/** Format amount for WhatsApp: space after ₹ so WhatsApp does not linkify. */
function formatMoney(paise) {
  const rupees = (Number(paise) || 0) / 100;
  const num = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(rupees);
  return `₹ ${num}`;
}

function formatQty(it) {
  if (it.productType === 'PER_ML') return `${it.quantity} ml`;
  return String(it.quantity);
}

function paymentLabel(invoice) {
  const pays = Array.isArray(invoice.payments) ? invoice.payments : [];
  const paid = pays.reduce((s, p) => s + (Number(p.amountPaise) || 0), 0);
  const total = Number(invoice.totalPaise) || 0;
  const methods = pays
    .map((p) => String(p.method || '').toUpperCase())
    .filter(Boolean);
  const methodStr = methods.length ? methods.join(' + ') : '';

  let status = 'UNPAID';
  if (total <= 0 && paid <= 0) status = 'PAID';
  else if (paid >= total) status = 'PAID';
  else if (paid > 0) status = 'PARTIAL';

  if (methodStr) return `${status} · ${methodStr}`;
  return status;
}

/**
 * Premium plain-text invoice for WhatsApp (perfume-brand style).
 * - One line per item: Name · qty · price
 * - Space after ₹ (no linkification)
 * - No customer mobile in body
 * - Title: INVOICE (not Tax Invoice)
 * - Dynamic from invoice data only
 */
export function buildInvoiceWhatsAppText(invoice, shopName = 'Amwaj') {
  if (!invoice) return '';
  const lines = [];
  const shop = (shopName || 'Amwaj').toUpperCase();
  const DIV = '────────────────';

  // Branding
  lines.push(`*${shop}*`);
  lines.push('_PERFUMES & ATTARS_');
  lines.push(DIV);

  // Invoice header
  lines.push('*INVOICE*');
  if (invoice.invoiceNumber) {
    lines.push(`*${invoice.invoiceNumber}*`);
  }
  lines.push('');

  // Date & customer
  if (invoice.createdAt) {
    try {
      const d = new Date(invoice.createdAt).toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
      lines.push(`DATE  ${d}`);
    } catch (_) {}
  }
  const custName = invoice.customer?.name;
  if (custName) {
    lines.push(`CUSTOMER  ${custName}`);
  }
  lines.push('');
  lines.push(DIV);

  // Items — one line each: name · qty · price
  lines.push('*ITEM DETAILS*');
  lines.push('');
  const items = Array.isArray(invoice.items) ? invoice.items : [];
  items.forEach((it) => {
    const name = it.productName || 'Item';
    const qty = formatQty(it);
    const amount = formatMoney(it.lineTotalPaise);
    lines.push(`${name}  ·  ${qty}  ·  ${amount}`);
  });

  lines.push('');
  lines.push(DIV);

  // Totals
  if (invoice.subtotalPaise != null) {
    lines.push(`Subtotal          ${formatMoney(invoice.subtotalPaise)}`);
  }
  if (invoice.additionalPaise > 0) {
    lines.push(`Additional        ${formatMoney(invoice.additionalPaise)}`);
  }
  if (invoice.discountPaise > 0) {
    lines.push(`Discount         -${formatMoney(invoice.discountPaise)}`);
  }
  lines.push('');
  lines.push(`*GRAND TOTAL*     *${formatMoney(invoice.totalPaise)}*`);
  lines.push('');
  lines.push(`Payment  ·  ${paymentLabel(invoice)}`);
  lines.push(DIV);

  // Closing
  lines.push('');
  lines.push(`*Thank you for choosing ${shop}!*`);
  lines.push('_We appreciate your business._');
  lines.push('✨ Experience the fragrance of elegance.');

  return lines.join('\n');
}

/**
 * WhatsApp deep link.
 * With mobile → opens that chat with message pre-filled (user only taps Send).
 * Without mobile → share sheet / empty chat + text.
 */
export function getWhatsAppShareUrl(invoice, shopName = 'Amwaj') {
  const text = buildInvoiceWhatsAppText(invoice, shopName);
  const num = toWhatsAppNumber(invoice?.customer?.mobile);
  if (num) {
    return `https://wa.me/${num}?text=${encodeURIComponent(text)}`;
  }
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}