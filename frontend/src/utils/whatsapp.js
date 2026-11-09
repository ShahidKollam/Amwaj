import { formatINR } from '../services/api';

/** Normalize Indian mobile to digits with country code 91 (wa.me format). */
export function toWhatsAppNumber(mobile) {
  if (!mobile) return '';
  let digits = String(mobile).replace(/\D/g, '');
  if (digits.length === 10) digits = `91${digits}`;
  else if (digits.startsWith('0') && digits.length === 11) digits = `91${digits.slice(1)}`;
  else if (digits.startsWith('91') && digits.length >= 12) digits = digits.slice(0, 12);
  // Already has country code or other length — use as-is if looks usable
  if (digits.length < 10) return '';
  return digits;
}

/** Build a clear plain-text invoice for WhatsApp (items on this bill only). */
export function buildInvoiceWhatsAppText(invoice, shopName = 'Amwaj') {
  if (!invoice) return '';
  const lines = [];
  lines.push(`*${shopName} — Invoice*`);
  lines.push(`${invoice.invoiceNumber || ''}`);
  if (invoice.createdAt) {
    try {
      lines.push(
        new Date(invoice.createdAt).toLocaleString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      );
    } catch (_) {}
  }
  lines.push('');

  const cust = invoice.customer;
  if (cust?.name || cust?.mobile) {
    lines.push(`*Customer*`);
    if (cust.name) lines.push(cust.name);
    if (cust.mobile) lines.push(cust.mobile);
    lines.push('');
  }

  lines.push(`*Items*`);
  const items = Array.isArray(invoice.items) ? invoice.items : [];
  items.forEach((it, i) => {
    const qty =
      it.productType === 'PER_ML'
        ? `${it.quantity} ml`
        : `${it.quantity}`;
    const name = it.productName || 'Item';
    lines.push(`${i + 1}. ${name} (${qty})`);
    lines.push(`   ${formatINR(it.lineTotalPaise)}`);
  });

  lines.push('');
  if (invoice.subtotalPaise != null) {
    lines.push(`Subtotal: ${formatINR(invoice.subtotalPaise)}`);
  }
  if (invoice.additionalPaise > 0) {
    lines.push(`Additional: ${formatINR(invoice.additionalPaise)}`);
  }
  if (invoice.discountPaise > 0) {
    lines.push(`Discount: -${formatINR(invoice.discountPaise)}`);
  }
  lines.push(`*Total: ${formatINR(invoice.totalPaise)}*`);

  const pays = Array.isArray(invoice.payments) ? invoice.payments : [];
  if (pays.length) {
    lines.push(
      `Paid: ${pays.map((p) => `${p.method} ${formatINR(p.amountPaise)}`).join(' + ')}`
    );
  }

  lines.push('');
  lines.push('Thank you for shopping with us.');
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
