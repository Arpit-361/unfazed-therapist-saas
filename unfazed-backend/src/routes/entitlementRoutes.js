const express = require('express');
const { body } = require('express-validator');
const entitlements = require('../controllers/entitlementController');
const { protect, requireRole } = require('../middleware/authMiddleware');
const validate = require('../middleware/validate');

const router = express.Router();

router.get('/tiers', entitlements.listTiers);

router.use(protect, requireRole('therapist'));
router.get('/', entitlements.getMyEntitlements);
router.post('/change-tier', validate([body('tier').isString().trim().notEmpty().withMessage('Choose a plan')]), entitlements.changeTier);

module.exports = router;
