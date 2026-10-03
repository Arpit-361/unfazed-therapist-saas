const mongoose = require('mongoose');

const subscriptionTierConfigSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true },
    description: { type: String, default: '' },
    monthly_price: { type: Number, required: true, min: 0 }, // paise
    platform_fee_percent: { type: Number, required: true, min: 0, max: 100 },
    sort_order: { type: Number, default: 0 },
    is_default: { type: Boolean, default: false },
    // null / missing limit => unlimited
    limits: { type: Map, of: Number, default: {} },
    // Feature keys enabled on this tier, e.g. "notes.templates"
    features: { type: [String], default: [] },
    highlights: [String],
  },
  { timestamps: true }
);

module.exports = mongoose.model('SubscriptionTierConfig', subscriptionTierConfigSchema);
