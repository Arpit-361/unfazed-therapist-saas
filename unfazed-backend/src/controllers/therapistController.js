const path = require('path');
const crypto = require('crypto');
const config = require('../config/env');
const Therapist = require('../models/Therapist');
const Package = require('../models/Package');
const Availability = require('../models/Availability');
const entitlementService = require('../services/entitlementService');
const leadDistributionService = require('../services/leadDistributionService');
const storageService = require('../services/storageService');
const slotService = require('../services/slotService');
const intakeFormService = require('../services/intakeFormService');
const { validateSlugFormat } = require('../utils/generateSlug');
const { serializeTherapistPrivate, serializeTherapistPublic, serializePackage } = require('../utils/serializers');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');

const PROFILE_FIELDS = [
  'name', 'title', 'bio', 'specializations', 'languages', 'qualifications', 'experience_years',
  'city', 'phone', 'timezone', 'gstin', 'accepting_clients', 'services',
];

exports.getMe = asyncHandler(async (req, res) => {
  const therapist = await Therapist.findById(req.user.id);
  res.json({ success: true, therapist: serializeTherapistPrivate(therapist) });
});

exports.updateMe = asyncHandler(async (req, res) => {
  const therapist = await Therapist.findById(req.user.id);
  for (const field of PROFILE_FIELDS) {
    if (req.body[field] !== undefined) therapist[field] = req.body[field];
  }

  if (req.body.slug !== undefined && req.body.slug !== therapist.slug) {
    const slug = String(req.body.slug).toLowerCase().trim();
    const formatError = validateSlugFormat(slug);
    if (formatError) throw ApiError.badRequest(formatError);
    if (await Therapist.exists({ slug, _id: { $ne: therapist._id } })) {
      throw ApiError.conflict('This profile link is already taken');
    }
    therapist.slug = slug;
  }

  if (!therapist.services.length) throw ApiError.badRequest('Add at least one service');
  await therapist.save();

  if (req.body.timezone) {
    await Availability.updateOne({ therapist_id: therapist._id }, { timezone: therapist.timezone });
  }
  res.json({ success: true, therapist: serializeTherapistPrivate(therapist) });
});

exports.checkSlug = asyncHandler(async (req, res) => {
  const slug = String(req.query.slug || '').toLowerCase().trim();
  const formatError = validateSlugFormat(slug);
  if (formatError) return res.json({ success: true, available: false, reason: formatError });
  const taken = await Therapist.exists({ slug, _id: { $ne: req.user.id } });
  return res.json({ success: true, available: !taken, reason: taken ? 'This link is already taken' : null });
});

exports.uploadPhoto = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('Please choose an image to upload');
  const ext = path.extname(req.file.originalname).toLowerCase() || '.jpg';
  const key = `public/avatars/${req.user.id}-${crypto.randomBytes(4).toString('hex')}${ext}`;
  await storageService.save(key, req.file.buffer, req.file.mimetype);
  const therapist = await Therapist.findByIdAndUpdate(
    req.user.id,
    { photo_url: storageService.publicUrl(key) },
    { returnDocument: 'after' }
  );
  res.json({ success: true, therapist: serializeTherapistPrivate(therapist) });
});

// ---------- Custom intake form builder ----------

const intakeFormResponse = (therapist) => {
  const fields = intakeFormService.serializeFields(therapist.intake_form?.fields);
  return {
    success: true,
    fields,
    json_schema: intakeFormService.toJsonSchema(fields),
    field_types: intakeFormService.fieldTypes(),
    max_fields: intakeFormService.MAX_FIELDS,
    updated_at: therapist.intake_form?.updated_at || null,
  };
};

exports.getIntakeForm = asyncHandler(async (req, res) => {
  const therapist = await Therapist.findById(req.user.id).select('intake_form').lean();
  res.json(intakeFormResponse(therapist));
});

exports.updateIntakeForm = asyncHandler(async (req, res) => {
  const fields = intakeFormService.normalizeFields(req.body.fields);
  const therapist = await Therapist.findByIdAndUpdate(
    req.user.id,
    { intake_form: { fields, updated_at: new Date() } },
    { returnDocument: 'after', runValidators: true }
  )
    .select('intake_form')
    .lean();
  res.json(intakeFormResponse(therapist));
});

// ---------- Public (unauthenticated) branded profile ----------

async function findPublicTherapist(slug) {
  const therapist = await Therapist.findOne({ slug: String(slug).toLowerCase() }).lean();
  if (!therapist) throw ApiError.notFound('We could not find a therapist at this link');
  return therapist;
}

exports.getPublicProfile = asyncHandler(async (req, res) => {
  const therapist = await findPublicTherapist(req.params.slug);
  const packagesAccess = await entitlementService.canAccess(therapist._id, entitlementService.FEATURES.PACKAGES);
  const packages = packagesAccess.allowed
    ? await Package.find({ therapist_id: therapist._id, active: true }).sort({ session_count: 1 }).lean()
    : [];
  res.json({
    success: true,
    therapist: serializeTherapistPublic(therapist),
    packages: packages.map(serializePackage),
  });
});

exports.getPublicSlots = asyncHandler(async (req, res) => {
  const therapist = await findPublicTherapist(req.params.slug);
  const availability = await Availability.findOne({ therapist_id: therapist._id }).lean();
  if (!availability) return res.json({ success: true, slots: [], timezone: therapist.timezone });

  const service = therapist.services.find((s) => String(s._id) === String(req.query.service_id)) || therapist.services[0];
  if (!service) return res.json({ success: true, slots: [] });

  const from = req.query.from ? new Date(req.query.from) : new Date();
  const to = req.query.to ? new Date(req.query.to) : new Date(from.getTime() + 7 * 24 * 3600 * 1000);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) throw ApiError.badRequest('Invalid date range');
  if (to - from > 62 * 24 * 3600 * 1000) throw ApiError.badRequest('Date range too large');

  const offered = availability.session_durations.includes(service.duration_minutes);
  const slots = offered
    ? await slotService.getAvailableSlots({
        therapistId: therapist._id,
        availability,
        from,
        to,
        durationMinutes: service.duration_minutes,
      })
    : [];
  res.json({ success: true, slots, service_id: String(service._id), therapist_timezone: availability.timezone });
});

exports.createEnquiry = asyncHandler(async (req, res) => {
  await leadDistributionService.createLeadForTherapist(req.params.slug, req.body);
  res.status(201).json({ success: true, message: 'Your enquiry has been sent. The therapist will get back to you soon.' });
});

exports.createDirectoryEnquiry = asyncHandler(async (req, res) => {
  await leadDistributionService.distributeLead(req.body);
  res.status(201).json({ success: true, message: 'Thanks! We have matched you with a therapist who will reach out soon.' });
});

const escapeHtml = (s) =>
  String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/**
 * Crawler-friendly share page: serves Open Graph tags (WhatsApp/LinkedIn previews don't run JS)
 * and redirects humans to the React profile page.
 */
exports.sharePage = asyncHandler(async (req, res) => {
  const therapist = await Therapist.findOne({ slug: String(req.params.slug).toLowerCase() }).lean();
  const target = `${config.clientUrl}/${therapist ? therapist.slug : ''}`;
  if (!therapist) return res.redirect(302, config.clientUrl);

  const title = `${therapist.name} - ${therapist.title || 'Therapist'} | Unfazed`;
  const description = (therapist.bio || `Book a session with ${therapist.name} on Unfazed.`).slice(0, 200);
  const imageTag = therapist.photo_url ? `\n<meta property="og:image" content="${escapeHtml(therapist.photo_url)}">` : '';

  res.set('Content-Type', 'text/html; charset=utf-8').send(`<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<meta property="og:type" content="profile">
<meta property="og:site_name" content="Unfazed">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">${imageTag}
<meta property="og:url" content="${escapeHtml(target)}">
<meta name="twitter:card" content="${therapist.photo_url ? 'summary_large_image' : 'summary'}">
<meta http-equiv="refresh" content="0; url=${escapeHtml(target)}">
</head><body><a href="${escapeHtml(target)}">Continue to ${escapeHtml(therapist.name)}'s profile</a></body></html>`);
});
