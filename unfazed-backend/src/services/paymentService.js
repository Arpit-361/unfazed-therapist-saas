/**
 * Payment domain logic, independent of which gateway is active.
 * Confirmation is idempotent so the client callback and the Razorpay webhook can both arrive.
 */
const config = require('../config/env');
const Payment = require('../models/Payment');
const Session = require('../models/Session');
const Package = require('../models/Package');
const ClientPackage = require('../models/ClientPackage');
const Client = require('../models/Client');
const entitlementService = require('./entitlementService');
const invoiceService = require('./invoiceService');
const { getGateway, getGatewayByName } = require('./paymentGatewayService');
const { notify, EVENTS } = require('./notificationService');
const ApiError = require('../utils/ApiError');

async function computeBreakdown(therapistId, baseAmount) {
  const taxRate = config.pricing.gstRatePercent;
  const feePercent = await entitlementService.getPlatformFeePercent(therapistId);
  const taxAmount = Math.round((baseAmount * taxRate) / 100);
  const platformFee = Math.round((baseAmount * feePercent) / 100);
  return {
    base_amount: baseAmount,
    tax_rate_percent: taxRate,
    tax_amount: taxAmount,
    amount: baseAmount + taxAmount,
    platform_fee_percent: feePercent,
    platform_fee: platformFee,
    net_amount: baseAmount - platformFee,
  };
}

async function buildCheckout(payment) {
  const client = await Client.findById(payment.client_id).lean();
  const gateway = getGatewayByName(payment.gateway);
  return {
    gateway: payment.gateway,
    key_id: gateway.keyId,
    payment_id: String(payment._id),
    order_id: payment.gateway_order_id,
    amount: payment.amount,
    currency: payment.currency,
    description: payment.description,
    breakdown: {
      base_amount: payment.base_amount,
      tax_rate_percent: payment.tax_rate_percent,
      tax_amount: payment.tax_amount,
    },
    prefill: { name: client?.name, email: client?.email, contact: client?.phone },
  };
}

async function createPaymentOrder({ therapistId, clientId, purpose, baseAmount, description, sessionId, packageId }) {
  const gateway = getGateway();
  const breakdown = await computeBreakdown(therapistId, baseAmount);
  const payment = await Payment.create({
    therapist_id: therapistId,
    client_id: clientId,
    purpose,
    session_id: sessionId || null,
    package_id: packageId || null,
    description,
    currency: config.pricing.currency,
    gateway: gateway.name,
    ...breakdown,
  });

  try {
    const order = await gateway.createOrder({
      amount: payment.amount,
      currency: payment.currency,
      receipt: String(payment._id),
      notes: { payment_id: String(payment._id), therapist_id: String(therapistId), purpose },
    });
    payment.gateway_order_id = order.id;
    await payment.save();
  } catch (err) {
    payment.status = 'failed';
    payment.failure_reason = err.message;
    await payment.save();
    throw err;
  }

  return { payment, checkout: await buildCheckout(payment) };
}

async function fulfil(payment) {
  if (payment.purpose === 'session' && payment.session_id) {
    let session = await Session.findOneAndUpdate(
      { _id: payment.session_id, status: 'pending_payment' },
      { status: 'confirmed', payment_status: 'paid', payment_id: payment._id, hold_expires_at: null },
      { returnDocument: 'after' }
    );
    if (!session) {
      // The hold expired before payment arrived: try to re-claim the slot.
      try {
        session = await Session.findOneAndUpdate(
          { _id: payment.session_id, status: 'cancelled' },
          {
            status: 'confirmed',
            slot_active: true,
            payment_status: 'paid',
            payment_id: payment._id,
            hold_expires_at: null,
            cancel_reason: '',
            cancelled_at: null,
          },
          { returnDocument: 'after' }
        );
      } catch (err) {
        if (err.code !== 11000) throw err;
        payment.status = 'refund_pending';
        payment.failure_reason = 'Slot was released before payment completed; refund required';
        await payment.save();
        return;
      }
    }
    if (session) {
      notify(EVENTS.BOOKING_CONFIRMED, { therapistId: payment.therapist_id, clientId: payment.client_id, session });
    }
  }

  if (payment.purpose === 'package' && payment.package_id && !payment.client_package_id) {
    const pkg = await Package.findById(payment.package_id).lean();
    const now = new Date();
    const clientPackage = await ClientPackage.create({
      therapist_id: payment.therapist_id,
      client_id: payment.client_id,
      package_id: pkg._id,
      payment_id: payment._id,
      name: pkg.name,
      sessions_total: pkg.session_count,
      per_session_rate: pkg.per_session_rate,
      duration_minutes: pkg.duration_minutes,
      purchased_at: now,
      expires_at: new Date(now.getTime() + pkg.validity_days * 24 * 60 * 60 * 1000),
    });
    payment.client_package_id = clientPackage._id;
    await payment.save();
  }

  await invoiceService.generateAndStore(payment);
  notify(EVENTS.PAYMENT_RECEIVED, { therapistId: payment.therapist_id, clientId: payment.client_id, payment });
}

/**
 * Idempotently marks a payment as paid. via: 'client_callback' | 'webhook' | 'demo'
 */
async function markPaid(paymentId, { transactionId, signature = '', via }) {
  const updated = await Payment.findOneAndUpdate(
    { _id: paymentId, status: { $in: ['created', 'failed'] } },
    {
      status: 'paid',
      paid_at: new Date(),
      gateway_transaction_id: transactionId,
      gateway_signature: signature,
      confirmed_via: via,
      webhook_confirmed: via === 'webhook',
      failure_reason: '',
    },
    { returnDocument: 'after' }
  );

  if (!updated) {
    if (via === 'webhook') await Payment.updateOne({ _id: paymentId }, { webhook_confirmed: true });
    return Payment.findById(paymentId);
  }

  await fulfil(updated);
  return Payment.findById(paymentId);
}

async function markFailed(paymentId, reason, { releaseHold = false } = {}) {
  const payment = await Payment.findOneAndUpdate(
    { _id: paymentId, status: 'created' },
    { status: 'failed', failure_reason: reason || 'Payment failed' },
    { returnDocument: 'after' }
  );
  if (payment && releaseHold && payment.session_id) {
    await Session.updateOne(
      { _id: payment.session_id, status: 'pending_payment' },
      { status: 'cancelled', slot_active: false, cancelled_at: new Date(), cancel_reason: 'Payment failed' }
    );
  }
  return payment;
}

async function getClientPayment(paymentId, client) {
  const payment = await Payment.findOne({ _id: paymentId, client_id: client.id, therapist_id: client.therapistId });
  if (!payment) throw ApiError.notFound('Payment not found');
  return payment;
}

module.exports = { computeBreakdown, createPaymentOrder, buildCheckout, markPaid, markFailed, getClientPayment };
