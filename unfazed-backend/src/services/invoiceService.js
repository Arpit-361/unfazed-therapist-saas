/**
 * GST-style invoice PDF generation (pdfkit). Invoices are generated automatically when a payment
 * is confirmed and stored privately through storageService.
 */
const PDFDocument = require('pdfkit');
const { formatInTimeZone } = require('date-fns-tz');
const Therapist = require('../models/Therapist');
const Client = require('../models/Client');
const storageService = require('./storageService');
const { toRupees } = require('../utils/money');

const money = (paise) =>
  `Rs. ${toRupees(paise).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function buildInvoiceNumber(payment) {
  const date = formatInTimeZone(payment.paid_at || new Date(), 'Asia/Kolkata', 'yyyyMMdd');
  return `UNF-${date}-${String(payment._id).slice(-6).toUpperCase()}`;
}

function renderPdf({ payment, therapist, client }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const brand = '#0f766e';
    const muted = '#64748b';
    const tz = therapist.timezone || 'Asia/Kolkata';

    doc.fillColor(brand).fontSize(22).font('Helvetica-Bold').text('Unfazed', 50, 50);
    doc.fillColor(muted).fontSize(9).font('Helvetica').text('Practice management for therapists', 50, 76);
    doc.fillColor('#0f172a').fontSize(16).font('Helvetica-Bold').text('TAX INVOICE', 350, 50, { align: 'right' });
    doc.fontSize(9).font('Helvetica').fillColor(muted)
      .text(`Invoice No: ${payment.invoice_number}`, 350, 72, { align: 'right' })
      .text(`Date: ${formatInTimeZone(payment.paid_at || new Date(), tz, 'dd MMM yyyy')}`, { align: 'right' })
      .text(`Payment Ref: ${payment.gateway_transaction_id || '-'}`, { align: 'right' });

    doc.moveTo(50, 120).lineTo(545, 120).strokeColor('#e2e8f0').stroke();

    doc.fillColor(muted).fontSize(9).text('BILLED BY', 50, 135);
    doc.fillColor('#0f172a').fontSize(11).font('Helvetica-Bold').text(therapist.name, 50, 149);
    doc.font('Helvetica').fontSize(9).fillColor('#334155')
      .text(therapist.title || 'Therapist')
      .text(therapist.city || '')
      .text(therapist.gstin ? `GSTIN: ${therapist.gstin}` : 'GSTIN: Not registered');

    doc.fillColor(muted).fontSize(9).text('BILLED TO', 320, 135);
    doc.fillColor('#0f172a').fontSize(11).font('Helvetica-Bold').text(client.name, 320, 149);
    doc.font('Helvetica').fontSize(9).fillColor('#334155').text(client.email).text(client.phone || '');

    const tableTop = 235;
    doc.rect(50, tableTop, 495, 22).fill('#f1f5f9');
    doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(9)
      .text('Description', 60, tableTop + 7)
      .text('SAC', 300, tableTop + 7)
      .text('Qty', 360, tableTop + 7)
      .text('Amount', 450, tableTop + 7, { width: 85, align: 'right' });

    const rowY = tableTop + 32;
    doc.font('Helvetica').fillColor('#334155')
      .text(payment.description, 60, rowY, { width: 230 })
      .text('999312', 300, rowY)
      .text('1', 360, rowY)
      .text(money(payment.base_amount), 450, rowY, { width: 85, align: 'right' });

    const halfRate = payment.tax_rate_percent / 2;
    const halfTax = Math.floor(payment.tax_amount / 2);
    let y = rowY + 45;
    const line = (label, value, bold = false) => {
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fillColor(bold ? '#0f172a' : '#334155')
        .text(label, 320, y).text(value, 450, y, { width: 85, align: 'right' });
      y += 18;
    };
    doc.moveTo(320, y - 8).lineTo(545, y - 8).strokeColor('#e2e8f0').stroke();
    line('Taxable value', money(payment.base_amount));
    line(`CGST @ ${halfRate}%`, money(halfTax));
    line(`SGST @ ${halfRate}%`, money(payment.tax_amount - halfTax));
    doc.moveTo(320, y).lineTo(545, y).strokeColor('#e2e8f0').stroke();
    y += 8;
    line('Total paid', money(payment.amount), true);

    doc.fillColor(muted).fontSize(8)
      .text(
        `Paid via ${payment.gateway === 'demo' ? 'Demo gateway (simulated payment)' : 'Razorpay'} on ${formatInTimeZone(payment.paid_at || new Date(), tz, "dd MMM yyyy, h:mm a")}.`,
        50, 720
      )
      .text('This is a computer-generated invoice and does not require a signature.', 50, 734);

    doc.end();
  });
}

async function generateInvoicePdf(payment) {
  const [therapist, client] = await Promise.all([
    Therapist.findById(payment.therapist_id).lean(),
    Client.findById(payment.client_id).lean(),
  ]);
  return renderPdf({ payment, therapist, client });
}

/** Assigns an invoice number, renders the PDF and stores it. Mutates and saves the payment. */
async function generateAndStore(payment) {
  if (!payment.invoice_number) payment.invoice_number = buildInvoiceNumber(payment);
  const buffer = await generateInvoicePdf(payment);
  const key = `private/invoices/${payment.invoice_number}.pdf`;
  await storageService.save(key, buffer, 'application/pdf');
  payment.invoice_key = key;
  await payment.save();
  return buffer;
}

/** Returns the stored invoice PDF, regenerating it if the stored file is unavailable. */
async function getInvoicePdf(payment) {
  if (payment.status !== 'paid' && payment.status !== 'refund_pending') return null;
  if (payment.invoice_key) {
    try {
      return await storageService.read(payment.invoice_key);
    } catch {
      // fall through to regeneration
    }
  }
  return generateAndStore(payment);
}

module.exports = { generateAndStore, getInvoicePdf, generateInvoicePdf };
