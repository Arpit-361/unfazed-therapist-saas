const express = require('express');
const { body, param, query } = require('express-validator');
const config = require('../config/env');
const scheduling = require('../controllers/schedulingController');
const { protect, requireRole } = require('../middleware/authMiddleware');
const validate = require('../middleware/validate');

const router = express.Router();
router.use(protect, requireRole('therapist'));

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

router.get('/availability', scheduling.getAvailability);
router.put(
  '/availability',
  validate([
    body('timezone').optional().isString().isLength({ max: 64 }),
    body('weekly').optional().isArray({ max: 50 }),
    body('weekly.*.day_of_week').optional().isInt({ min: 0, max: 6 }).toInt(),
    body('weekly.*.start').optional().matches(TIME).withMessage('Times must be HH:mm'),
    body('weekly.*.end').optional().matches(TIME).withMessage('Times must be HH:mm'),
    body('overrides').optional().isArray({ max: 120 }),
    body('overrides.*.date').optional().matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('Override date must be YYYY-MM-DD'),
    body('overrides.*.unavailable').optional().isBoolean().toBoolean(),
    body('overrides.*.windows').optional().isArray({ max: 10 }),
    body('overrides.*.windows.*.start').optional().matches(TIME),
    body('overrides.*.windows.*.end').optional().matches(TIME),
    body('buffer_minutes').optional().isInt({ min: 0, max: 60 }).toInt(),
    body('session_durations')
      .optional()
      .isArray({ min: 1 })
      .withMessage('Select at least one session duration'),
    body('session_durations.*')
      .optional()
      .isIn(config.scheduling.sessionDurations)
      .withMessage(`Durations must be ${config.scheduling.sessionDurations.join('/')} minutes`)
      .toInt(),
    body('min_notice_hours').optional().isInt({ min: 0, max: 168 }).toInt(),
    body('booking_window_days').optional().isInt({ min: 1, max: 180 }).toInt(),
  ]),
  scheduling.updateAvailability
);
router.post(
  '/availability/blocked',
  validate([body('start').isISO8601().withMessage('Invalid start'), body('end').isISO8601().withMessage('Invalid end'), body('reason').optional().trim().isLength({ max: 200 })]),
  scheduling.addBlockedSlot
);
router.delete('/availability/blocked/:blockId', validate([param('blockId').isMongoId()]), scheduling.removeBlockedSlot);
router.get('/slots', validate([query('from').optional().isISO8601(), query('to').optional().isISO8601()]), scheduling.previewSlots);

router.get('/sessions', scheduling.listSessions);
router.post(
  '/sessions',
  validate([
    body('client_id').isMongoId().withMessage('Select a client'),
    body('service_id').isMongoId().withMessage('Select a service'),
    body('start_time').isISO8601().withMessage('Select a time slot'),
    body('payment_mode').optional().isIn(['unpaid', 'waived', 'package']).withMessage('Invalid payment option'),
  ]),
  scheduling.createSessionForClient
);
router.patch(
  '/sessions/:id/status',
  validate([
    param('id').isMongoId(),
    body('status').isIn(['completed', 'no_show', 'cancelled']).withMessage('Invalid status'),
    body('reason').optional().trim().isLength({ max: 200 }),
  ]),
  scheduling.updateSessionStatus
);
router.get('/waitlist', scheduling.listWaitlist);

module.exports = router;
