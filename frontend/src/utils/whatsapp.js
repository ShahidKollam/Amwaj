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

/** Format amount for WhatsApp: space after ₹ so WhatsApp does not linkify. */
function formatMoney(paise) {
  const rupees = (Number(paise) || 0) / 100;
  const num = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(rupees);
  return `₹ ${num}`;
}

/**
 * Beautiful, professional plain-text invoice for WhatsApp.
 * - No customer mobile in the body (privacy / clean look)
 * - Space after ₹ so amounts are not treated as links
 * - Title is simply "Invoice" (not Tax Invoice)
 */
export function buildInvoiceWhatsAppText(invoice, shopName = 'Amwaj') {
  if (!invoice) return '';
  const lines = [];
  const shop = (shopName || 'Amwaj').toUpperCase();

  lines.push(`*${shop}*`);
  lines.push('────────────────');
  lines.push('*INVOICE*');
  if (invoice.invoiceNumber) lines.push(invoice.invoiceNumber);
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
  if (cust?.name) {
    lines.push(`Customer: ${cust.name}`);
    lines.push('');
  }

  lines.push('*Items*');
  const items = Array.isArray(invoice.items) ? invoice.items : [];
  items.forEach((it, i) => {
    const name = it.productName || 'Item';
    const qtyPart =
      it.productType === 'PER_ML'
        ? `${it.quantity} ml`
        : `${it.quantity}`;
    lines.push(`${i + 1}. ${name}`);
    lines.push(`   ${qtyPart}  ·  ${formatMoney(it.lineTotalPaise)}`);
  });

  lines.push('');
  lines.push('────────────────');
  if (invoice.subtotalPaise != null) {
    lines.push(`Subtotal     ${formatMoney(invoice.subtotalPaise)}`);
  }
  if (invoice.additionalPaise > 0) {
    lines.push(`Additional   ${formatMoney(invoice.additionalPaise)}`);
  }
  if (invoice.discountPaise > 0) {
    lines.push(`Discount    -${formatMoney(invoice.discountPaise)}`);
  }
  lines.push(`*Total       ${formatMoney(invoice.totalPaise)}*`);

  const pays = Array.isArray(invoice.payments) ? invoice.payments : [];
  if (pays.length) {
    lines.push(
      `Paid: ${pays.map((p) => `${p.method} ${formatMoney(p.amountPaise)}`).join(' + ')}`
    );
  }

  lines.push('');
  lines.push(`Thank you for shopping with ${shopName || 'Amwaj'}.`);
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
