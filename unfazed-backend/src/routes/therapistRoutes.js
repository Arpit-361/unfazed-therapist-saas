const express = require('express');
const multer = require('multer');
const { body } = require('express-validator');
const config = require('../config/env');
const therapist = require('../controllers/therapistController');
const { protect, requireRole } = require('../middleware/authMiddleware');
const validate = require('../middleware/validate');
const { requireFeature } = require('../middleware/entitlementMiddleware');
const { FEATURES } = require('../services/entitlementService');
const ApiError = require('../utils/ApiError');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      return cb(ApiError.badRequest('Only JPG, PNG or WEBP images are allowed'));
    }
    return cb(null, true);
  },
});

const stringList = (field, max) =>
  body(field).optional().isArray({ max }).withMessage(`${field} must be a list`).customSanitizer((list) =>
    [...new Set((list || []).map((v) => String(v).trim()).filter(Boolean))]
  );

router.use(protect, requireRole('therapist'));

router.get('/me', therapist.getMe);
router.put(
  '/me',
  validate([
    body('name').optional().trim().isLength({ min: 2, max: 80 }),
    body('slug').optional().trim().toLowerCase(),
    body('title').optional().trim().isLength({ max: 80 }),
    body('bio').optional().trim().isLength({ max: 3000 }),
    body('qualifications').optional().trim().isLength({ max: 300 }),
    body('experience_years').optional().isInt({ min: 0, max: 70 }).toInt(),
    body('city').optional().trim().isLength({ max: 60 }),
    body('phone').optional().trim().isLength({ max: 20 }),
    body('gstin').optional().trim().isLength({ max: 20 }),
    body('timezone').optional().isString().isLength({ max: 64 }),
    body('accepting_clients').optional().isBoolean().toBoolean(),
    stringList('specializations', 15),
    stringList('languages', 10),
    body('services').optional().isArray({ min: 1, max: 10 }).withMessage('Provide 1-10 services'),
    body('services.*.title').optional().trim().isLength({ min: 2, max: 80 }).withMessage('Service title is required'),
    body('services.*.duration_minutes')
      .optional()
      .isIn(config.scheduling.sessionDurations)
      .withMessage(`Session duration must be one of ${config.scheduling.sessionDurations.join('/')} minutes`)
      .toInt(),
    body('services.*.price').optional().isInt({ min: 0, max: 10000000 }).withMessage('Invalid price').toInt(),
  ]),
  therapist.updateMe
);
router.get('/slug-available', therapist.checkSlug);
router.get('/me/intake-form', therapist.getIntakeForm);
router.put(
  '/me/intake-form',
  requireFeature(FEATURES.INTAKE_FORM_BUILDER),
  validate([body('fields').isArray().withMessage('Form fields must be a list')]),
  therapist.updateIntakeForm
);
router.post('/me/photo', upload.single('photo'), therapist.uploadPhoto);

module.exports = router;
