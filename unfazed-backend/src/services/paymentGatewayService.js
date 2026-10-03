/**
 * Payment gateway interface: createOrder / verifyPaymentSignature / verifyWebhookSignature.
 *  - razorpay: used whenever RAZORPAY_KEY_ID + RAZORPAY_KEY_SECRET are set (test mode keys)
 *  - demo:     simulated gateway, only available when DEMO_MODE=true and keys are missing
 */
const crypto = require('crypto');
const config = require('../config/env');
const { razorpayClient, isRazorpayConfigured } = require('../config/razorpay');
const ApiError = require('../utils/ApiError');

const hmac = (secret, payload) => crypto.createHmac('sha256', secret).update(payload).digest('hex');

function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

const razorpayGateway = {
  name: 'razorpay',
  keyId: config.razorpay.keyId,
  async createOrder({ amount, currency, receipt, notes }) {
    try {
      const order = await razorpayClient.orders.create({ amount, currency, receipt, notes });
      return { id: order.id, amount: order.amount, currency: order.currency };
    } catch (err) {
      const reason = err?.error?.description || err.message || 'Unknown error';
      throw new ApiError(502, `Razorpay order creation failed: ${reason}`, { code: 'GATEWAY_ERROR' });
    }
  },
  verifyPaymentSignature({ orderId, paymentId, signature }) {
    return safeEqual(hmac(config.razorpay.keySecret, `${orderId}|${paymentId}`), signature);
  },
};

// Per-process secret: demo signatures are only valid for the lifetime of this server.
const DEMO_SECRET = crypto.randomBytes(32).toString('hex');

/** Simulated gateway that signs payments exactly like Razorpay Checkout (HMAC of "orderId|paymentId"). */
const demoGateway = {
  name: 'demo',
  keyId: null,
  async createOrder({ amount, currency }) {
    return { id: `order_demo_${crypto.randomBytes(8).toString('hex')}`, amount, currency };
  },
  simulateCheckout(orderId) {
    const paymentId = `pay_demo_${crypto.randomBytes(7).toString('hex')}`;
    return {
      razorpay_order_id: orderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: hmac(DEMO_SECRET, `${orderId}|${paymentId}`),
    };
  },
  verifyPaymentSignature({ orderId, paymentId, signature }) {
    return safeEqual(hmac(DEMO_SECRET, `${orderId}|${paymentId}`), signature);
  },
};

function getGateway() {
  if (isRazorpayConfigured) return razorpayGateway;
  if (config.demoMode) return demoGateway;
  throw new ApiError(503, 'Online payments are not configured on this server', { code: 'PAYMENTS_UNAVAILABLE' });
}

function getGatewayByName(name) {
  return name === 'razorpay' ? razorpayGateway : demoGateway;
}

/** Razorpay webhook signature: HMAC-SHA256 of the raw request body with the webhook secret. */
function verifyWebhookSignature(rawBody, signature) {
  if (!config.razorpay.webhookSecret || !rawBody || !signature) return false;
  return safeEqual(hmac(config.razorpay.webhookSecret, rawBody), signature);
}

function describeGateway() {
  if (isRazorpayConfigured) return { gateway: 'razorpay', key_id: config.razorpay.keyId, mode: 'test' };
  if (config.demoMode) return { gateway: 'demo', key_id: null, mode: 'simulated' };
  return { gateway: 'unavailable', key_id: null, mode: 'disabled' };
}

module.exports = { getGateway, getGatewayByName, verifyWebhookSignature, describeGateway, hmac };
