const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    therapist_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Therapist', required: true, index: true },
    client_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true, index: true },
    purpose: { type: String, enum: ['session', 'package'], required: true },
    session_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Session', default: null },
    package_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Package', default: null },
    client_package_id: { type: mongoose.Schema.Types.ObjectId, ref: 'ClientPackage', default: null },
    description: { type: String, default: '' },
    currency: { type: String, default: 'INR' },
    // All amounts are integer paise.
    base_amount: { type: Number, required: true, min: 0 },
    tax_rate_percent: { type: Number, default: 0 },
    tax_amount: { type: Number, default: 0 },
    amount: { type: Number, required: true, min: 0 }, // total charged to client
    platform_fee_percent: { type: Number, default: 0 },
    platform_fee: { type: Number, default: 0 },
    net_amount: { type: Number, default: 0 }, // therapist payout
    status: {
      type: String,
      enum: ['created', 'paid', 'failed', 'refund_pending', 'refunded'],
      default: 'created',
    },
    gateway: { type: String, enum: ['razorpay', 'demo'], required: true },
    gateway_order_id: { type: String, index: true },
    gateway_transaction_id: { type: String, default: '' },
    gateway_signature: { type: String, default: '' },
    webhook_confirmed: { type: Boolean, default: false },
    confirmed_via: { type: String, enum: ['', 'client_callback', 'webhook', 'demo'], default: '' },
    failure_reason: { type: String, default: '' },
    invoice_number: { type: String, default: '' },
    invoice_key: { type: String, default: '' },
    paid_at: Date,
  },
  { timestamps: true }
);

paymentSchema.index({ therapist_id: 1, status: 1, paid_at: 1 });

module.exports = mongoose.model('Payment', paymentSchema);
