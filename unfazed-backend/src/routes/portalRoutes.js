/**
 * Client-facing API. Every route here requires a CLIENT token and is scoped to
 * req.user.id (the client) and req.user.therapistId (their therapist's practice).
 * No handler mounted here may return private clinical notes, platform fees or other clients' data.
 */
const express = require('express');
const { body, param, query } = require('express-validator');
const clients = require('../controllers/clientController');
const scheduling = require('../controllers/schedulingController');
const payments = require('../controllers/paymentController');
const notes = require('../controllers/noteController');
const chat = require('../controllers/chatController');
const { protect, requireRole } = require('../middleware/authMiddleware');
const { requireFeature } = require('../middleware/entitlementMiddleware');
const { FEATURES } = require('../services/entitlementService');
const validate = require('../middleware/validate');

const router = express.Router();
router.use(protect, requireRole('client'));

const optionalText = (field, max = 1000) => body(field).optional().isString().trim().isLength({ max });

// Profile, intake & consent
router.get('/me', clients.portalMe);
router.put(
  '/me',
  validate([
    body('name').optional().trim().isLength({ min: 2, max: 80 }),
    body('phone').optional().trim().isLength({ max: 20 }),
    body('timezone').optional().isString().isLength({ max: 64 }),
  ]),
  clients.portalUpdateProfile
);
router.put(
  '/intake',
  validate([
    body('presenting_concern').isString().trim().isLength({ min: 10, max: 3000 }).withMessage('Please describe what brings you to therapy (at least 10 characters)'),
    optionalText('demographics.date_of_birth', 20),
    optionalText('demographics.gender', 40),
    optionalText('demographics.occupation', 80),
    optionalText('demographics.city', 60),
    optionalText('demographics.emergency_contact_name', 80),
    optionalText('demographics.emergency_contact_phone', 20),
    optionalText('history.previous_therapy'),
    optionalText('history.medications'),
    optionalText('history.medical_conditions'),
    optionalText('history.family_history'),
    optionalText('goals', 2000),
  ]),
  clients.portalSubmitIntake
);
router.get('/consent', clients.portalConsentText);
router.post(
  '/consent',
  validate([body('accepted').isBoolean().toBoolean(), body('version').isString().notEmpty()]),
  clients.portalGiveConsent
);

// Scheduling
router.get(
  '/slots',
  validate([query('from').optional().isISO8601(), query('to').optional().isISO8601(), query('service_id').optional().isMongoId()]),
  scheduling.portalSlots
);
router.get('/sessions', scheduling.portalSessions);
router.post(
  '/sessions',
  validate([
    body('service_id').isMongoId().withMessage('Select a service'),
    body('start_time').isISO8601().withMessage('Select a time slot'),
    body('payment_mode').optional().isIn(['pay_now', 'package']).withMessage('Invalid payment option'),
    body('client_timezone').optional().isString().isLength({ max: 64 }),
  ]),
  scheduling.portalBook
);
router.post('/sessions/:id/cancel', validate([param('id').isMongoId()]), scheduling.portalCancel);
router.post(
  '/waitlist',
  requireFeature(FEATURES.WAITLIST),
  validate([body('date').matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('Invalid date')]),
  scheduling.portalJoinWaitlist
);

// Payments & packages
router.get('/packages', payments.portalPackages);
router.post('/packages/:id/purchase', requireFeature(FEATURES.PACKAGES), validate([param('id').isMongoId()]), payments.portalPurchasePackage);
router.get('/payments', payments.portalPayments);
router.post('/payments/:id/checkout', validate([param('id').isMongoId()]), payments.portalRetryCheckout);
router.post(
  '/payments/verify',
  validate([
    body('razorpay_order_id').isString().notEmpty(),
    body('razorpay_payment_id').isString().notEmpty(),
    body('razorpay_signature').isString().notEmpty(),
  ]),
  payments.portalVerifyPayment
);
router.post(
  '/payments/:id/demo-complete',
  validate([param('id').isMongoId(), body('outcome').isIn(['success', 'failure'])]),
  payments.portalDemoComplete
);
router.get('/payments/:id/invoice', validate([param('id').isMongoId()]), payments.portalInvoice);

// Clinical notes - SHARED ONLY
router.get('/notes', notes.portalSharedNotes);

// Chat
router.get('/messages', chat.portalMessages);
router.post(
  '/messages',
  validate([body('body').isString().trim().isLength({ min: 1, max: 2000 }).withMessage('Message must be 1-2000 characters')]),
  chat.portalSend
);

module.exports = router;
