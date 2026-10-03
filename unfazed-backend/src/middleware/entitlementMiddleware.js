const entitlementService = require('../services/entitlementService');

/**
 * Route-level gate. Delegates entirely to entitlementService.canAccess so no route ever inspects
 * a subscription tier directly. Works for therapist and client tokens: the therapist that owns
 * the practice (req.user.therapistId) is always the subject of the entitlement check.
 */
const requireFeature = (featureKey) => async (req, res, next) => {
  try {
    await entitlementService.assertAccess(req.user.therapistId, featureKey);
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = { requireFeature };
