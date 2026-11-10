
export function buildInvoiceWhatsAppText(invoice, shopName = 'Amwaj') {
  if (!invoice) return '';

  const shop = (shopName || 'Amwaj').toUpperCase();
  const lines = [];
  const DIV = '────────────────────────────────────';

  const items = Array.isArray(invoice.items) ? invoice.items : [];

  // Branding and invoice number
  const invoiceNo = invoice.invoiceNumber
    ? `INVOICE # ${invoice.invoiceNumber}`
    : 'INVOICE';

  lines.push(`✨ *${shop} PERFUMES*  |  *${invoiceNo}*`);
  lines.push('');

  // Customer and date
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

  // Item table (monospace for alignment)
  const pad = (value, width) =>
    String(value).length > width
      ? String(value).slice(0, width - 1) + '…'
      : String(value).padEnd(width);

  const money = (paise) =>
    formatMoney(paise);

  const tableWidth = 36;

  lines.push('```');
  lines.push(
    `${pad('ITEM', 20)}${pad('QTY', 7)}${'AMOUNT'.padStart(9)}`
  );
  lines.push('─'.repeat(tableWidth));

  items.forEach((it) => {
    const name = pad(it.productName || 'Item', 20);
    const qty = pad(formatQty(it), 7);
    const amount = money(it.lineTotalPaise);

    lines.push(`${name}${qty}${amount.padStart(9)}`);
  });

  lines.push('─'.repeat(tableWidth));

  // Totals
  const addTotal = (label, amount) => {
    lines.push(
      `${label.padEnd(20)}${money(amount).padStart(16)}`
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

  lines.push('─'.repeat(tableWidth));
  addTotal('GRAND TOTAL', invoice.totalPaise);
  lines.push('```');

  // Payment
  lines.push('');
  lines.push(`💳 *Payment: ${paymentLabel(invoice)}*`);

  // Closing
  lines.push('');
  lines.push(`✨ *Thank you for choosing ${shop}!*`);
  lines.push('We look forward to your next visit.');

  return lines.join('\n');
}
