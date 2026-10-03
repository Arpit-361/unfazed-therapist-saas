const express = require('express');
const { body, param } = require('express-validator');
const leads = require('../controllers/leadController');
const { protect, requireRole } = require('../middleware/authMiddleware');
const validate = require('../middleware/validate');

const router = express.Router();
router.use(protect, requireRole('therapist'));

router.get('/', leads.listLeads);
router.patch(
  '/:id',
  validate([param('id').isMongoId(), body('status').isIn(['new', 'contacted', 'closed']).withMessage('Invalid status')]),
  leads.updateLead
);
router.post('/:id/convert', validate([param('id').isMongoId()]), leads.convertLead);

module.exports = router;
