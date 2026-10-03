const express = require('express');
const { body, param } = require('express-validator');
const notes = require('../controllers/noteController');
const { protect, requireRole } = require('../middleware/authMiddleware');
const validate = require('../middleware/validate');

// Therapist-only. Clients read notes exclusively via GET /api/portal/notes (shared only).
const router = express.Router();
router.use(protect, requireRole('therapist'));

const noteRules = [
  body('type').optional().isIn(['private', 'shared']).withMessage('Note type must be private or shared'),
  body('format').optional().isIn(['freeform', 'soap', 'dap']).withMessage('Invalid note format'),
  body('title').optional().trim().isLength({ max: 140 }),
  body('content').optional().isString().isLength({ max: 50000 }),
  body('structured').optional().isObject(),
];

router.get('/', notes.listNotes);
router.post(
  '/',
  validate([
    body('client_id').isMongoId().withMessage('Select a client'),
    body('session_id').optional({ values: 'falsy' }).isMongoId(),
    body('type').isIn(['private', 'shared']).withMessage('Choose whether the note is private or shared'),
    ...noteRules,
  ]),
  notes.createNote
);
router.get('/:id', validate([param('id').isMongoId()]), notes.getNote);
router.put('/:id', validate([param('id').isMongoId(), ...noteRules]), notes.updateNote);
router.delete('/:id', validate([param('id').isMongoId()]), notes.deleteNote);

module.exports = router;
