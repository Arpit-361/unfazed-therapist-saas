const mongoose = require('mongoose');

const channelResultSchema = new mongoose.Schema(
  {
    channel: { type: String, enum: ['in_app', 'email', 'whatsapp'], required: true },
    status: { type: String, enum: ['sent', 'queued', 'logged', 'failed', 'skipped'], required: true },
    detail: { type: String, default: '' },
  },
  { _id: false }
);

const notificationSchema = new mongoose.Schema(
  {
    recipient_role: { type: String, enum: ['therapist', 'client'], required: true },
    recipient_id: { type: mongoose.Schema.Types.ObjectId, required: true },
    therapist_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Therapist', required: true },
    type: { type: String, required: true },
    title: { type: String, required: true },
    body: { type: String, default: '' },
    link: { type: String, default: '' },
    channels: [channelResultSchema],
    read_at: { type: Date, default: null },
  },
  { timestamps: true }
);

notificationSchema.index({ recipient_role: 1, recipient_id: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
