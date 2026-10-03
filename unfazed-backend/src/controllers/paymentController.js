const mongoose = require('mongoose');
const config = require('../config/env');
const Payment = require('../models/Payment');
const Package = require('../models/Package');
const ClientPackage = require('../models/ClientPackage');
const Session = require('../models/Session');
const paymentService = require('../services/paymentService');
const invoiceService = require('../services/invoiceService');
const entitlementService = require('../services/entitlementService');
const { getGatewayByName, verifyWebhookSignature, describeGateway } = require('../services/paymentGatewayService');
const {
  serializePayment,
  serializePaymentForClient,
  serializePackage,
  serializeClientPackage,
} = require('../utils/serializers');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');

exports.gatewayInfo = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    ...describeGateway(),
    currency: config.pricing.currency,
    gst_rate_percent: config.pricing.gstRatePercent,
    package_sizes: config.pricing.packageSizes,
    session_durations: config.scheduling.sessionDurations,
  });
});

// ---------- Therapist: payments dashboard ----------

exports.listPayments = asyncHandler(async (req, res) => {
  const filter = { therapist_id: req.user.id };
  if (req.query.status) filter.status = { $in: String(req.query.status).split(',') };
  if (req.query.client_id) filter.client_id = req.query.client_id;
  const payments = await Payment.find(filter).populate('client_id', 'name').sort({ createdAt: -1 }).limit(500);
  res.json({ success: true, payments: payments.map(serializePayment) });
});

exports.paymentSummary = asyncHandler(async (req, res) => {
  const therapistId = new mongoose.Types.ObjectId(req.user.id);
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const [totals] = await Payment.aggregate([
    { $match: { therapist_id: therapistId } },
    {
      $facet: {
        lifetime: [
          { $match: { status: 'paid' } },
          { $group: { _id: null, gross: { $sum: '$amount' }, net: { $sum: '$net_amount' }, fees: { $sum: '$platform_fee' }, tax: { $sum: '$tax_amount' }, count: { $sum: 1 } } },
        ],
        thisMonth: [
          { $match: { status: 'paid', paid_at: { $gte: monthStart } } },
          { $group: { _id: null, gross: { $sum: '$amount' }, net: { $sum: '$net_amount' }, count: { $sum: 1 } } },
        ],
        byStatus: [{ $group: { _id: '$status', count: { $sum: 1 }, amount: { $sum: '$amount' } } }],
      },
    },
  ]);

  const pick = (arr) => arr[0] || { gross: 0, net: 0, fees: 0, tax: 0, count: 0 };
  res.json({
    success: true,
    summary: {
      lifetime: pick(totals.lifetime),
      this_month: pick(totals.thisMonth),
      by_status: Object.fromEntries(totals.byStatus.map((s) => [s._id, { count: s.count, amount: s.amount }])),
    },
  });
});

exports.therapistInvoice = asyncHandler(async (req, res) => {
  const payment = await Payment.findOne({ _id: req.params.id, therapist_id: req.user.id });
  if (!payment) throw ApiError.notFound('Payment not found');
  await sendInvoice(res, payment);
});

async function sendInvoice(res, payment) {
  const pdf = await invoiceService.getInvoicePdf(payment);
  if (!pdf) throw ApiError.badRequest('Invoices are available only for successful payments');
  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="${payment.invoice_number}.pdf"`,
  });
  res.send(pdf);
}

// ---------- Therapist: packages ----------

exports.listPackages = asyncHandler(async (req, res) => {
  const packages = await Package.find({ therapist_id: req.user.id }).sort({ session_count: 1 });
  res.json({ success: true, packages: packages.map(serializePackage) });
});

const PACKAGE_FIELDS = ['name', 'description', 'session_count', 'per_session_rate', 'duration_minutes', 'validity_days', 'active'];

exports.createPackage = asyncHandler(async (req, res) => {
  const data = { therapist_id: req.user.id };
  PACKAGE_FIELDS.forEach((f) => {
    if (req.body[f] !== undefined) data[f] = req.body[f];
  });
  const pkg = await Package.create(data);
  res.status(201).json({ success: true, package: serializePackage(pkg) });
});

exports.updatePackage = asyncHandler(async (req, res) => {
  const pkg = await Package.findOne({ _id: req.params.id, therapist_id: req.user.id });
  if (!pkg) throw ApiError.notFound('Package not found');
  PACKAGE_FIELDS.forEach((f) => {
    if (req.body[f] !== undefined) pkg[f] = req.body[f];
  });
  await pkg.save();
  res.json({ success: true, package: serializePackage(pkg) });
});

exports.listClientPackages = asyncHandler(async (req, res) => {
  const items = await ClientPackage.find({ therapist_id: req.user.id }).populate('client_id', 'name').sort({ createdAt: -1 });
  res.json({ success: true, client_packages: items.map(serializeClientPackage) });
});

// ---------- Client portal: packages & checkout ----------

exports.portalPackages = asyncHandler(async (req, res) => {
  const access = await entitlementService.canAccess(req.user.therapistId, entitlementService.FEATURES.PACKAGES);
  const [available, mine] = await Promise.all([
    access.allowed ? Package.find({ therapist_id: req.user.therapistId, active: true }).sort({ session_count: 1 }) : [],
    ClientPackage.find({ therapist_id: req.user.therapistId, client_id: req.user.id }).sort({ createdAt: -1 }),
  ]);
  res.json({
    success: true,
    enabled: access.allowed,
    packages: available.map(serializePackage),
    my_packages: mine.map(serializeClientPackage),
  });
});

exports.portalPurchasePackage = asyncHandler(async (req, res) => {
  const pkg = await Package.findOne({ _id: req.params.id, therapist_id: req.user.therapistId, active: true });
  if (!pkg) throw ApiError.notFound('Package not found');
  const { payment, checkout } = await paymentService.createPaymentOrder({
    therapistId: req.user.therapistId,
    clientId: req.user.id,
    purpose: 'package',
    baseAmount: pkg.session_count * pkg.per_session_rate,
    description: `${pkg.name} - ${pkg.session_count} x ${pkg.duration_minutes} min sessions`,
    packageId: pkg._id,
  });
  res.status(201).json({ success: true, payment: serializePaymentForClient(payment), checkout });
});

exports.portalRetryCheckout = asyncHandler(async (req, res) => {
  const payment = await paymentService.getClientPayment(req.params.id, req.user);
  if (payment.status !== 'created' && payment.status !== 'failed') throw ApiError.badRequest('This payment is already completed');
  if (payment.session_id) {
    const session = await Session.findById(payment.session_id).lean();
    if (!session || session.status !== 'pending_payment') {
      throw ApiError.badRequest('This booking hold has expired. Please book a new slot.');
    }
  }
  res.json({ success: true, checkout: await paymentService.buildCheckout(payment) });
});

/** Verifies a gateway checkout response ("orderId|paymentId" HMAC) before marking the payment paid. */
async function verifyAndCapture(payment, { orderId, paymentId, signature }, via) {
  if (payment.gateway_order_id !== orderId) throw ApiError.badRequest('Order mismatch');
  const valid = getGatewayByName(payment.gateway).verifyPaymentSignature({ orderId, paymentId, signature });
  if (!valid) throw ApiError.badRequest('Payment signature verification failed');
  return paymentService.markPaid(payment._id, { transactionId: paymentId, signature, via });
}

/** Razorpay Checkout success callback: verify the signature server-side before trusting it. */
exports.portalVerifyPayment = asyncHandler(async (req, res) => {
  const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = req.body;
  const payment = await Payment.findOne({
    gateway_order_id: orderId,
    client_id: req.user.id,
    therapist_id: req.user.therapistId,
  });
  if (!payment) throw ApiError.notFound('Payment not found');
  if (payment.gateway !== 'razorpay') throw ApiError.badRequest('Not a Razorpay payment');

  const updated = await verifyAndCapture(payment, { orderId, paymentId, signature }, 'client_callback');
  res.json({ success: true, payment: serializePaymentForClient(updated) });
});

/**
 * DEMO_MODE only: the demo gateway simulates Razorpay Checkout, producing a signed
 * {order_id, payment_id, signature} response that goes through the same verification as real payments.
 */
exports.portalDemoComplete = asyncHandler(async (req, res) => {
  const payment = await paymentService.getClientPayment(req.params.id, req.user);
  if (payment.gateway !== 'demo' || !config.demoMode) {
    throw ApiError.forbidden('Simulated payments are only available in demo mode');
  }
  if (req.body.outcome === 'failure') {
    await paymentService.markFailed(payment._id, 'Simulated payment failure', { releaseHold: true });
    return res.json({ success: true, payment: serializePaymentForClient(await Payment.findById(payment._id)) });
  }
  const response = getGatewayByName('demo').simulateCheckout(payment.gateway_order_id);
  const updated = await verifyAndCapture(
    payment,
    { orderId: response.razorpay_order_id, paymentId: response.razorpay_payment_id, signature: response.razorpay_signature },
    'demo'
  );
  return res.json({ success: true, payment: serializePaymentForClient(updated), signature_verified: true });
});

exports.portalPayments = asyncHandler(async (req, res) => {
  const payments = await Payment.find({ client_id: req.user.id, therapist_id: req.user.therapistId }).sort({ createdAt: -1 });
  res.json({ success: true, payments: payments.map(serializePaymentForClient) });
});

exports.portalInvoice = asyncHandler(async (req, res) => {
  const payment = await paymentService.getClientPayment(req.params.id, req.user);
  await sendInvoice(res, payment);
});

// ---------- Razorpay webhook (server-to-server) ----------

exports.razorpayWebhook = asyncHandler(async (req, res) => {
  const signature = req.headers['x-razorpay-signature'];
  if (!verifyWebhookSignature(req.rawBody, signature)) {
    throw ApiError.badRequest('Invalid webhook signature');
  }

  const { event, payload } = req.body || {};
  const paymentEntity = payload?.payment?.entity;
  const orderId = paymentEntity?.order_id || payload?.order?.entity?.id;
  const payment = orderId ? await Payment.findOne({ gateway_order_id: orderId }) : null;

  if (!payment) return res.json({ success: true, ignored: true });

  if (event === 'payment.captured' || event === 'order.paid') {
    await paymentService.markPaid(payment._id, { transactionId: paymentEntity?.id || '', via: 'webhook' });
  } else if (event === 'payment.failed') {
    await paymentService.markFailed(payment._id, paymentEntity?.error_description || 'Payment failed');
  }
  return res.json({ success: true });
});
