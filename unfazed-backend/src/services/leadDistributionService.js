/**
 * Lead intake and distribution.
 *  - Profile enquiries (unfazed.in/:slug) go straight to that therapist.
 *  - Directory enquiries (no therapist chosen) are matched on language/specialization and
 *    distributed round-robin to the matching therapist who least recently received a lead.
 */
const Lead = require('../models/Lead');
const Therapist = require('../models/Therapist');
const clientService = require('./clientService');
const { notify, EVENTS } = require('./notificationService');
const ApiError = require('../utils/ApiError');

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function assignLead(therapist, data, source) {
  const lead = await Lead.create({
    therapist_id: therapist._id,
    name: data.name,
    email: data.email,
    phone: data.phone || '',
    message: data.message || '',
    preferences: data.preferences || {},
    source,
  });
  await Therapist.updateOne({ _id: therapist._id }, { last_lead_assigned_at: new Date() });
  notify(EVENTS.LEAD_RECEIVED, { therapist, lead });
  return lead;
}

async function createLeadForTherapist(slug, data) {
  const therapist = await Therapist.findOne({ slug }).lean();
  if (!therapist) throw ApiError.notFound('Therapist not found');
  return assignLead(therapist, data, 'profile');
}

async function distributeLead(data) {
  const filter = { accepting_clients: true };
  const { language, specialization } = data.preferences || {};
  if (language) filter.languages = { $regex: `^${escapeRegex(language)}$`, $options: 'i' };
  if (specialization) filter.specializations = { $regex: escapeRegex(specialization), $options: 'i' };

  let candidates = await Therapist.find(filter).sort({ last_lead_assigned_at: 1, createdAt: 1 }).limit(1).lean();
  if (!candidates.length) {
    candidates = await Therapist.find({ accepting_clients: true }).sort({ last_lead_assigned_at: 1 }).limit(1).lean();
  }
  if (!candidates.length) throw ApiError.badRequest('No therapists are accepting new clients right now');
  return assignLead(candidates[0], data, 'directory');
}

async function convertLeadToClient(therapistId, leadId) {
  const lead = await Lead.findOne({ _id: leadId, therapist_id: therapistId });
  if (!lead) throw ApiError.notFound('Lead not found');
  if (lead.status === 'converted') throw ApiError.badRequest('Lead has already been converted');

  const { client, inviteUrl } = await clientService.createClientWithInvite(
    therapistId,
    { name: lead.name, email: lead.email, phone: lead.phone, tags: ['from-enquiry'] },
    'lead'
  );
  lead.status = 'converted';
  lead.converted_client_id = client._id;
  await lead.save();
  return { lead, client, inviteUrl };
}

module.exports = { createLeadForTherapist, distributeLead, convertLeadToClient };
