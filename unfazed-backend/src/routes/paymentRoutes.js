const express = require('express');
const { body, param } = require('express-validator');
const config = require('../config/env');
const payments = require('../controllers/paymentController');
const { protect, requireRole } = require('../middleware/authMiddleware');
const { requireFeature } = require('../middleware/entitlementMiddleware');
const { FEATURES } = require('../services/entitlementService');
const validate = require('../middleware/validate');

const router = express.Router();

// Razorpay server-to-server webhook: authenticated by HMAC signature, not JWT.
router.post('/webhook', payments.razorpayWebhook);

router.use(protect, requireRole('therapist'));

const packageRules = (optional) => {
  const f = (chain) => (optional ? chain.optional() : chain);
  return [
    f(body('name')).trim().isLength({ min: 2, max: 80 }).withMessage('Package name is required'),
    body('description').optional().trim().isLength({ max: 400 }),
    f(body('session_count'))
      .isIn(config.pricing.packageSizes)
      .withMessage(`Packages must contain ${config.pricing.packageSizes.join('/')} sessions`)
      .toInt(),
    f(body('per_session_rate')).isInt({ min: 0, max: 10000000 }).withMessage('Invalid per-session rate').toInt(),
    f(body('duration_minutes'))
      .isIn(config.scheduling.sessionDurations)
      .withMessage('Invalid session duration')
      .toInt(),
    f(body('validity_days')).isInt({ min: 7, max: 730 }).withMessage('Validity must be 7-730 days').toInt(),
    body('active').optional().isBoolean().toBoolean(),
  ];
};

router.get('/', payments.listPayments);
router.get('/summary', payments.paymentSummary);
router.get('/packages', payments.listPackages);
router.post('/packages', requireFeature(FEATURES.PACKAGES), validate(packageRules(false)), payments.createPackage);
router.put(
  '/packages/:id',
  requireFeature(FEATURES.PACKAGES),
  validate([param('id').isMongoId(), ...packageRules(true)]),
  payments.updatePackage
);
router.get('/client-packages', payments.listClientPackages);
router.get('/:id/invoice', validate([param('id').isMongoId()]), payments.therapistInvoice);

module.exports = router;
