const config = require('../config/env');
const entitlementService = require('../services/entitlementService');
const asyncHandler = require('../utils/asyncHandler');

exports.getMyEntitlements = asyncHandler(async (req, res) => {
  res.json({ success: true, ...(await entitlementService.getEntitlementSummary(req.user.id)) });
});

exports.listTiers = asyncHandler(async (req, res) => {
  res.json({ success: true, tiers: await entitlementService.listTiers() });
});

/** Plan change. Recurring SaaS billing is simulated; plans switch immediately (documented in README). */
exports.changeTier = asyncHandler(async (req, res) => {
  const summary = await entitlementService.changeTier(req.user.id, req.body.tier);
  res.json({ success: true, simulated_billing: true, demo_mode: config.demoMode, ...summary });
});
