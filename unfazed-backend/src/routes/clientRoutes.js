const express = require('express');
const { body, param } = require('express-validator');
const clients = require('../controllers/clientController');
const { protect, requireRole } = require('../middleware/authMiddleware');
const validate = require('../middleware/validate');

const router = express.Router();
router.use(protect, requireRole('therapist'));

const tags = body('tags')
  .optional()
  .isArray({ max: 15 })
  .withMessage('Tags must be a list')
  .customSanitizer((list) => (list || []).map((t) => String(t).trim().toLowerCase().slice(0, 30)).filter(Boolean));

router.get('/', clients.listClients);
router.post(
  '/',
  validate([
    body('name').trim().isLength({ min: 2, max: 80 }).withMessage('Client name is required'),
    body('email').trim().isEmail().withMessage('Enter a valid email address').normalizeEmail({ gmail_remove_dots: false }),
    body('phone').optional().trim().isLength({ max: 20 }),
    body('timezone').optional().isString().isLength({ max: 64 }),
    tags,
  ]),
  clients.createClient
);
router.get('/:id', validate([param('id').isMongoId().withMessage('Invalid client id')]), clients.getClient);
router.put(
  '/:id',
  validate([
    param('id').isMongoId(),
    body('name').optional().trim().isLength({ min: 2, max: 80 }),
    body('phone').optional().trim().isLength({ max: 20 }),
    body('status').optional().isIn(['active', 'inactive', 'archived']).withMessage('Invalid status'),
    body('timezone').optional().isString().isLength({ max: 64 }),
    tags,
  ]),
  clients.updateClient
);
router.post('/:id/invite', validate([param('id').isMongoId()]), clients.resendInvite);

module.exports = router;
