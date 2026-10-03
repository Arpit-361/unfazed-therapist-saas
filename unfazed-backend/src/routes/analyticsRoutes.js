const express = require('express');
const analytics = require('../controllers/analyticsController');
const { protect, requireRole } = require('../middleware/authMiddleware');
const { requireFeature } = require('../middleware/entitlementMiddleware');
const { FEATURES } = require('../services/entitlementService');

const router = express.Router();
router.use(protect, requireRole('therapist'));

router.get('/overview', analytics.overview);
router.get('/advanced', requireFeature(FEATURES.ANALYTICS_ADVANCED), analytics.advanced);

module.exports = router;
