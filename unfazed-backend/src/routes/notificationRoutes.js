const express = require('express');
const { param } = require('express-validator');
const notifications = require('../controllers/notificationController');
const { protect } = require('../middleware/authMiddleware');
const validate = require('../middleware/validate');

// Shared by therapists and clients; every query is scoped to the caller's own notifications.
const router = express.Router();
router.use(protect);

router.get('/', notifications.listNotifications);
router.patch('/read-all', notifications.markAllRead);
router.patch('/:id/read', validate([param('id').isMongoId()]), notifications.markRead);

module.exports = router;
