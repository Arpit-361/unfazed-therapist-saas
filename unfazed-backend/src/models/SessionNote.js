const mongoose = require('mongoose');

const sessionNoteSchema = new mongoose.Schema(
  {
    therapist_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Therapist', required: true, index: true },
    client_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true, index: true },
    session_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Session', default: null },
    // private => therapist-only clinical record; shared => visible in the client portal
    type: { type: String, enum: ['private', 'shared'], required: true, default: 'private' },
    format: { type: String, enum: ['freeform', 'soap', 'dap'], default: 'freeform' },
    title: { type: String, trim: true, maxlength: 140, default: '' },
    content: { type: String, default: '', maxlength: 50000 }, // sanitized rich-text HTML
    structured: {
      subjective: { type: String, default: '' },
      objective: { type: String, default: '' },
      data: { type: String, default: '' },
      assessment: { type: String, default: '' },
      plan: { type: String, default: '' },
    },
  },
  { timestamps: true }
);

/**
 * The only query client-facing code may use. The `type: 'shared'` filter is hard-coded here so
 * private notes are excluded at the database query itself.
 */
sessionNoteSchema.statics.findSharedForClient = function findSharedForClient(therapistId, clientId) {
  return this.find({ therapist_id: therapistId, client_id: clientId, type: 'shared' }).sort({ createdAt: -1 });
};

module.exports = mongoose.model('SessionNote', sessionNoteSchema);
