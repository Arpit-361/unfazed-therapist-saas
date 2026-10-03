const Razorpay = require('razorpay');
const config = require('./env');

const isRazorpayConfigured = Boolean(config.razorpay.keyId && config.razorpay.keySecret);

const razorpayClient = isRazorpayConfigured
  ? new Razorpay({ key_id: config.razorpay.keyId, key_secret: config.razorpay.keySecret })
  : null;

module.exports = { razorpayClient, isRazorpayConfigured };
