const express = require('express');
const { body, param } = require('express-validator');
const chat = require('../controllers/chatController');
const { protect, requireRole } = require('../middleware/authMiddleware');
const validate = require('../middleware/validate');

const router = express.Router();
router.use(protect, requireRole('therapist'));

router.get('/conversations', chat.listConversations);
router.get('/conversations/:clientId/messages', validate([param('clientId').isMongoId()]), chat.therapistMessages);
router.post(
  '/conversations/:clientId/messages',
  validate([param('clientId').isMongoId(), body('body').isString().trim().isLength({ min: 1, max: 2000 }).withMessage('Message must be 1-2000 characters')]),
  chat.therapistSend
);

module.exports = router;
