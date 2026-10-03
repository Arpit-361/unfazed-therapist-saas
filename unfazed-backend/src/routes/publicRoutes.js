const express = require('express');
const { body, query } = require('express-validator');
const therapist = require('../controllers/therapistController');
const payment = require('../controllers/paymentController');
const validate = require('../middleware/validate');

const router = express.Router();

const enquiryRules = [
  body('name').trim().isLength({ min: 2, max: 80 }).withMessage('Please enter your name'),
  body('email').trim().isEmail().withMessage('Enter a valid email address').normalizeEmail({ gmail_remove_dots: false }),
  body('phone').optional().trim().isLength({ max: 20 }),
  body('message').optional().trim().isLength({ max: 2000 }),
  body('preferences.language').optional().trim().isLength({ max: 40 }),
  body('preferences.specialization').optional().trim().isLength({ max: 60 }),
];

router.get('/payments/config', payment.gatewayInfo);
router.post('/leads', validate(enquiryRules), therapist.createDirectoryEnquiry);
router.get('/therapists/:slug', therapist.getPublicProfile);
router.get(
  '/therapists/:slug/slots',
  validate([query('from').optional().isISO8601(), query('to').optional().isISO8601(), query('service_id').optional().isMongoId()]),
  therapist.getPublicSlots
);
router.post('/therapists/:slug/enquiries', validate(enquiryRules), therapist.createEnquiry);

module.exports = router;
