const Notification = require('../models/Notification');
const { serializeNotification } = require('../utils/serializers');
const asyncHandler = require('../utils/asyncHandler');

const scope = (req) => ({ recipient_role: req.user.role, recipient_id: req.user.id });

exports.listNotifications = asyncHandler(async (req, res) => {
  const [items, unread] = await Promise.all([
    Notification.find(scope(req)).sort({ createdAt: -1 }).limit(50),
    Notification.countDocuments({ ...scope(req), read_at: null }),
  ]);
  res.json({ success: true, notifications: items.map(serializeNotification), unread });
});

exports.markAllRead = asyncHandler(async (req, res) => {
  await Notification.updateMany({ ...scope(req), read_at: null }, { read_at: new Date() });
  res.json({ success: true });
});

exports.markRead = asyncHandler(async (req, res) => {
  await Notification.updateOne({ _id: req.params.id, ...scope(req) }, { read_at: new Date() });
  res.json({ success: true });
});
