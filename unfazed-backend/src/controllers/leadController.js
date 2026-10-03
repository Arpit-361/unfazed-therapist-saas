const Lead = require('../models/Lead');
const leadDistributionService = require('../services/leadDistributionService');
const { serializeLead, serializeClientForTherapist } = require('../utils/serializers');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');

exports.listLeads = asyncHandler(async (req, res) => {
  const filter = { therapist_id: req.user.id };
  if (req.query.status) filter.status = { $in: String(req.query.status).split(',') };
  const leads = await Lead.find(filter).sort({ createdAt: -1 }).limit(500);
  res.json({ success: true, leads: leads.map(serializeLead) });
});

exports.updateLead = asyncHandler(async (req, res) => {
  const lead = await Lead.findOne({ _id: req.params.id, therapist_id: req.user.id });
  if (!lead) throw ApiError.notFound('Lead not found');
  if (lead.status === 'converted') throw ApiError.badRequest('Converted leads cannot be changed');
  if (req.body.status === 'converted') throw ApiError.badRequest('Use the convert action to convert a lead');
  lead.status = req.body.status;
  await lead.save();
  res.json({ success: true, lead: serializeLead(lead) });
});

exports.convertLead = asyncHandler(async (req, res) => {
  const { lead, client, inviteUrl } = await leadDistributionService.convertLeadToClient(req.user.id, req.params.id);
  res.json({ success: true, lead: serializeLead(lead), client: serializeClientForTherapist(client), invite_url: inviteUrl });
});
