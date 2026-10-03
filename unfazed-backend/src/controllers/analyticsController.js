/**
 * Analytics computed entirely with MongoDB aggregation pipelines.
 * Basic metrics are available on every plan; /advanced is gated by the
 * "analytics.advanced" entitlement at the route layer.
 */
const mongoose = require('mongoose');
const { formatInTimeZone } = require('date-fns-tz');
const Payment = require('../models/Payment');
const Session = require('../models/Session');
const Client = require('../models/Client');
const Therapist = require('../models/Therapist');
const Lead = require('../models/Lead');
const ClientPackage = require('../models/ClientPackage');
const asyncHandler = require('../utils/asyncHandler');

const DAY = 24 * 60 * 60 * 1000;

function monthsBack(n, tz) {
  const keys = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 15));
    keys.push(formatInTimeZone(d, tz, 'yyyy-MM'));
  }
  return keys;
}

function startOfMonthsBack(n) {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (n - 1), 1) - DAY);
}

async function getContext(req) {
  const therapist = await Therapist.findById(req.user.id).select('timezone').lean();
  return { therapistId: new mongoose.Types.ObjectId(req.user.id), tz: therapist.timezone || 'Asia/Kolkata' };
}

function revenueTrendPipeline(therapistId, tz, from, groupByPurpose = false) {
  return [
    { $match: { therapist_id: therapistId, status: 'paid', paid_at: { $gte: from } } },
    {
      $group: {
        _id: {
          month: { $dateToString: { format: '%Y-%m', date: '$paid_at', timezone: tz } },
          ...(groupByPurpose ? { purpose: '$purpose' } : {}),
        },
        gross: { $sum: '$amount' },
        net: { $sum: '$net_amount' },
        count: { $sum: 1 },
      },
    },
    { $sort: { '_id.month': 1 } },
  ];
}

function noShowPipeline(therapistId, from, tz, byMonth = false) {
  return [
    { $match: { therapist_id: therapistId, start_time: { $gte: from, $lte: new Date() }, status: { $in: ['completed', 'no_show'] } } },
    {
      $group: {
        _id: byMonth ? { $dateToString: { format: '%Y-%m', date: '$start_time', timezone: tz } } : null,
        total: { $sum: 1 },
        no_shows: { $sum: { $cond: [{ $eq: ['$status', 'no_show'] }, 1, 0] } },
      },
    },
    {
      $project: {
        total: 1,
        no_shows: 1,
        rate: { $cond: [{ $eq: ['$total', 0] }, 0, { $round: [{ $multiply: [{ $divide: ['$no_shows', '$total'] }, 100] }, 1] }] },
      },
    },
    { $sort: { _id: 1 } },
  ];
}

exports.overview = asyncHandler(async (req, res) => {
  const { therapistId, tz } = await getContext(req);
  const now = new Date();
  const months = 6;
  const trendFrom = startOfMonthsBack(months);
  const monthKey = formatInTimeZone(now, tz, 'yyyy-MM');

  const [revenue, clientStats, recentlyActive, noShow, sessionStats, upcoming, newLeads] = await Promise.all([
    Payment.aggregate(revenueTrendPipeline(therapistId, tz, trendFrom)),
    Client.aggregate([
      { $match: { therapist_id: therapistId } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    Session.aggregate([
      { $match: { therapist_id: therapistId, start_time: { $gte: new Date(now - 30 * DAY), $lte: now }, status: { $in: ['completed', 'confirmed'] } } },
      { $group: { _id: '$client_id' } },
      { $count: 'count' },
    ]),
    Session.aggregate(noShowPipeline(therapistId, new Date(now - 90 * DAY), tz)),
    Session.aggregate([
      { $match: { therapist_id: therapistId, start_time: { $gte: new Date(now - 30 * DAY), $lte: now } } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    Session.aggregate([
      { $match: { therapist_id: therapistId, start_time: { $gt: now, $lte: new Date(now.getTime() + 7 * DAY) }, status: 'confirmed' } },
      { $count: 'count' },
    ]),
    Lead.aggregate([{ $match: { therapist_id: therapistId, status: 'new' } }, { $count: 'count' }]),
  ]);

  const byMonth = Object.fromEntries(revenue.map((r) => [r._id.month, r]));
  const trend = monthsBack(months, tz).map((m) => ({
    month: m,
    gross: byMonth[m]?.gross || 0,
    net: byMonth[m]?.net || 0,
    payments: byMonth[m]?.count || 0,
  }));
  const clientsByStatus = Object.fromEntries(clientStats.map((c) => [c._id, c.count]));

  res.json({
    success: true,
    timezone: tz,
    stats: {
      active_clients: (clientsByStatus.active || 0) + (clientsByStatus.invited || 0),
      recently_active_clients: recentlyActive[0]?.count || 0,
      revenue_this_month: byMonth[monthKey]?.gross || 0,
      net_this_month: byMonth[monthKey]?.net || 0,
      no_show_rate: noShow[0]?.rate || 0,
      no_show_sample: noShow[0]?.total || 0,
      upcoming_sessions_7d: upcoming[0]?.count || 0,
      new_leads: newLeads[0]?.count || 0,
    },
    clients_by_status: clientsByStatus,
    sessions_last_30d: Object.fromEntries(sessionStats.map((s) => [s._id, s.count])),
    revenue_trend: trend,
  });
});

exports.advanced = asyncHandler(async (req, res) => {
  const { therapistId, tz } = await getContext(req);
  const months = 12;
  const from = startOfMonthsBack(months);

  const [revenueByPurpose, noShowTrend, newClients, topClients, busiestSlots, packageUtilisation] = await Promise.all([
    Payment.aggregate(revenueTrendPipeline(therapistId, tz, from, true)),
    Session.aggregate(noShowPipeline(therapistId, from, tz, true)),
    Client.aggregate([
      { $match: { therapist_id: therapistId, createdAt: { $gte: from } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt', timezone: tz } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    Payment.aggregate([
      { $match: { therapist_id: therapistId, status: 'paid' } },
      { $group: { _id: '$client_id', revenue: { $sum: '$amount' }, payments: { $sum: 1 } } },
      { $sort: { revenue: -1 } },
      { $limit: 5 },
      { $lookup: { from: 'clients', localField: '_id', foreignField: '_id', as: 'client' } },
      { $unwind: '$client' },
      { $project: { _id: 0, client_id: '$_id', name: '$client.name', revenue: 1, payments: 1 } },
    ]),
    Session.aggregate([
      { $match: { therapist_id: therapistId, status: { $in: ['completed', 'confirmed', 'no_show'] } } },
      {
        $group: {
          _id: {
            day: { $dayOfWeek: { date: '$start_time', timezone: tz } },
            hour: { $hour: { date: '$start_time', timezone: tz } },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 24 },
    ]),
    ClientPackage.aggregate([
      { $match: { therapist_id: therapistId } },
      {
        $group: {
          _id: '$name',
          sold: { $sum: 1 },
          sessions_total: { $sum: '$sessions_total' },
          sessions_used: { $sum: '$sessions_used' },
        },
      },
      {
        $project: {
          _id: 0,
          name: '$_id',
          sold: 1,
          sessions_total: 1,
          sessions_used: 1,
          utilisation: { $round: [{ $multiply: [{ $divide: ['$sessions_used', '$sessions_total'] }, 100] }, 1] },
        },
      },
      { $sort: { sold: -1 } },
    ]),
  ]);

  const monthKeys = monthsBack(months, tz);
  const revenue = monthKeys.map((m) => {
    const rows = revenueByPurpose.filter((r) => r._id.month === m);
    const pick = (purpose) => rows.find((r) => r._id.purpose === purpose)?.gross || 0;
    return { month: m, session: pick('session'), package: pick('package') };
  });
  const noShowByMonth = Object.fromEntries(noShowTrend.map((r) => [r._id, r]));
  const newClientsByMonth = Object.fromEntries(newClients.map((r) => [r._id, r.count]));

  res.json({
    success: true,
    timezone: tz,
    revenue_by_purpose: revenue,
    no_show_trend: monthKeys.map((m) => ({
      month: m,
      rate: noShowByMonth[m]?.rate || 0,
      sessions: noShowByMonth[m]?.total || 0,
      no_shows: noShowByMonth[m]?.no_shows || 0,
    })),
    new_clients: monthKeys.map((m) => ({ month: m, count: newClientsByMonth[m] || 0 })),
    top_clients: topClients,
    busiest_slots: busiestSlots.map((b) => ({ day_of_week: b._id.day - 1, hour: b._id.hour, count: b.count })),
    package_utilisation: packageUtilisation,
  });
});
