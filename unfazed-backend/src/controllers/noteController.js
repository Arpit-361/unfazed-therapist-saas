const sanitizeHtml = require('sanitize-html');
const SessionNote = require('../models/SessionNote');
const Client = require('../models/Client');
const Session = require('../models/Session');
const entitlementService = require('../services/entitlementService');
const { serializeNoteForTherapist, serializeNoteForClient } = require('../utils/serializers');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');

const SANITIZE_OPTIONS = {
  allowedTags: ['p', 'br', 'strong', 'b', 'em', 'i', 's', 'u', 'code', 'pre', 'blockquote', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'hr'],
  allowedAttributes: {},
};
const STRUCTURED_FIELDS = ['subjective', 'objective', 'data', 'assessment', 'plan'];

function buildNoteFields(body) {
  const fields = {};
  if (body.type !== undefined) fields.type = body.type;
  if (body.format !== undefined) fields.format = body.format;
  if (body.title !== undefined) fields.title = body.title;
  if (body.content !== undefined) fields.content = sanitizeHtml(body.content, SANITIZE_OPTIONS);
  if (body.structured) {
    fields.structured = {};
    STRUCTURED_FIELDS.forEach((f) => {
      fields.structured[f] = sanitizeHtml(String(body.structured[f] || ''), { allowedTags: [], allowedAttributes: {} });
    });
  }
  return fields;
}

async function assertTemplateAccess(therapistId, format) {
  if (format && format !== 'freeform') {
    await entitlementService.assertAccess(therapistId, entitlementService.FEATURES.NOTE_TEMPLATES);
  }
}

// ---------- Therapist routes (see private + shared notes of their own clients) ----------

exports.listNotes = asyncHandler(async (req, res) => {
  const filter = { therapist_id: req.user.id };
  if (req.query.client_id) filter.client_id = req.query.client_id;
  if (req.query.type) filter.type = req.query.type;
  if (req.query.session_id) filter.session_id = req.query.session_id;
  const notes = await SessionNote.find(filter).populate('client_id', 'name').sort({ createdAt: -1 }).limit(500);
  res.json({ success: true, notes: notes.map(serializeNoteForTherapist) });
});

exports.getNote = asyncHandler(async (req, res) => {
  const note = await SessionNote.findOne({ _id: req.params.id, therapist_id: req.user.id }).populate('client_id', 'name');
  if (!note) throw ApiError.notFound('Note not found');
  res.json({ success: true, note: serializeNoteForTherapist(note) });
});

exports.createNote = asyncHandler(async (req, res) => {
  const client = await Client.findOne({ _id: req.body.client_id, therapist_id: req.user.id }).lean();
  if (!client) throw ApiError.notFound('Client not found');
  if (req.body.session_id) {
    const session = await Session.exists({ _id: req.body.session_id, therapist_id: req.user.id, client_id: client._id });
    if (!session) throw ApiError.badRequest('Session does not belong to this client');
  }
  await assertTemplateAccess(req.user.id, req.body.format);

  const note = await SessionNote.create({
    therapist_id: req.user.id,
    client_id: client._id,
    session_id: req.body.session_id || null,
    ...buildNoteFields(req.body),
  });
  await note.populate('client_id', 'name');
  res.status(201).json({ success: true, note: serializeNoteForTherapist(note) });
});

exports.updateNote = asyncHandler(async (req, res) => {
  const note = await SessionNote.findOne({ _id: req.params.id, therapist_id: req.user.id });
  if (!note) throw ApiError.notFound('Note not found');
  if (req.body.format && req.body.format !== note.format) await assertTemplateAccess(req.user.id, req.body.format);
  Object.assign(note, buildNoteFields(req.body));
  await note.save();
  await note.populate('client_id', 'name');
  res.json({ success: true, note: serializeNoteForTherapist(note) });
});

exports.deleteNote = asyncHandler(async (req, res) => {
  const result = await SessionNote.deleteOne({ _id: req.params.id, therapist_id: req.user.id });
  if (!result.deletedCount) throw ApiError.notFound('Note not found');
  res.json({ success: true });
});

// ---------- Client portal route: SHARED NOTES ONLY ----------
// Private notes are excluded twice: by the hard-coded `type: 'shared'` query in
// SessionNote.findSharedForClient and by serializeNoteForClient, which throws on non-shared notes.

exports.portalSharedNotes = asyncHandler(async (req, res) => {
  const notes = await SessionNote.findSharedForClient(req.user.therapistId, req.user.id);
  res.json({ success: true, notes: notes.map(serializeNoteForClient) });
});
