/**
 * Entitlement Service - the single source of truth for feature access.
 *
 * Every gated route, socket handler or UI hint resolves access through canAccess(therapistId, featureKey).
 * Tier definitions (caps, flags, prices) live in the SubscriptionTierConfig collection, seeded from
 * config/subscriptionTiers.json. Nothing else in the codebase may read Therapist.subscription_tier.
 */
const SubscriptionTierConfig = require('../models/SubscriptionTierConfig');
const Therapist = require('../models/Therapist');
const Client = require('../models/Client');
const ApiError = require('../utils/ApiError');
const defaultTiers = require('../config/subscriptionTiers.json');

const FEATURES = Object.freeze({
  ACTIVE_CLIENTS: 'clients.active',
  CHAT: 'communication.chat',
  NOTE_TEMPLATES: 'notes.templates',
  PACKAGES: 'payments.packages',
  WAITLIST: 'scheduling.waitlist',
  ANALYTICS_ADVANCED: 'analytics.advanced',
});

const FEATURE_LABELS = {
  [FEATURES.ACTIVE_CLIENTS]: 'Adding more active clients',
  [FEATURES.CHAT]: 'Client chat',
  [FEATURES.NOTE_TEMPLATES]: 'SOAP & DAP note templates',
  [FEATURES.PACKAGES]: 'Session packages',
  [FEATURES.WAITLIST]: 'Waitlist',
  [FEATURES.ANALYTICS_ADVANCED]: 'Advanced analytics',
};

// Limit-based features: allowed while usage < tier limit (missing/null limit => unlimited).
const LIMIT_FEATURES = {
  [FEATURES.ACTIVE_CLIENTS]: {
    limitKey: 'max_active_clients',
    usage: (therapistId) =>
      Client.countDocuments({ therapist_id: therapistId, status: { $in: Client.ACTIVE_CLIENT_STATUSES } }),
  },
};

const CACHE_TTL_MS = 30 * 1000;
let tierCache = { loadedAt: 0, tiers: [] };

async function ensureTierConfigs() {
  const count = await SubscriptionTierConfig.estimatedDocumentCount();
  if (count === 0) {
    await SubscriptionTierConfig.insertMany(defaultTiers);
    console.log(`[entitlements] Seeded ${defaultTiers.length} subscription tiers from config`);
  }
  invalidateCache();
}

function invalidateCache() {
  tierCache = { loadedAt: 0, tiers: [] };
}

async function getAllTiers() {
  if (Date.now() - tierCache.loadedAt < CACHE_TTL_MS && tierCache.tiers.length) return tierCache.tiers;
  const tiers = await SubscriptionTierConfig.find().sort({ sort_order: 1 }).lean();
  tierCache = { loadedAt: Date.now(), tiers };
  return tiers;
}

const readMap = (map, key) => {
  if (!map) return undefined;
  return map instanceof Map ? map.get(key) : map[key];
};

async function getDefaultTier() {
  const tiers = await getAllTiers();
  return tiers.find((t) => t.is_default) || tiers[0];
}

async function getTierConfig(therapistId) {
  const therapist = await Therapist.findById(therapistId).select('subscription_tier').lean();
  if (!therapist) throw ApiError.notFound('Therapist not found');
  const tiers = await getAllTiers();
  return tiers.find((t) => t.key === therapist.subscription_tier) || (await getDefaultTier());
}

function evaluate(tier, featureKey, usage) {
  const limitFeature = LIMIT_FEATURES[featureKey];
  if (limitFeature) {
    const limit = readMap(tier.limits, limitFeature.limitKey);
    const unlimited = limit === null || limit === undefined;
    return { allowed: unlimited || usage < limit, limit: unlimited ? null : limit };
  }
  return { allowed: (tier.features || []).includes(featureKey), limit: null };
}

async function findUpgradeTier(currentTier, featureKey, usage) {
  const tiers = await getAllTiers();
  return (
    tiers.find((t) => t.sort_order > currentTier.sort_order && evaluate(t, featureKey, usage).allowed) || null
  );
}

/**
 * canAccess(therapistId, featureKey) -> { allowed, featureKey, tier, limit, usage, upgradeTo, message }
 */
async function canAccess(therapistId, featureKey) {
  if (!Object.values(FEATURES).includes(featureKey)) {
    throw new Error(`Unknown entitlement feature: ${featureKey}`);
  }
  const tier = await getTierConfig(therapistId);
  const limitFeature = LIMIT_FEATURES[featureKey];
  const usage = limitFeature ? await limitFeature.usage(therapistId) : null;
  const { allowed, limit } = evaluate(tier, featureKey, usage);

  let upgradeTo = null;
  let message = null;
  if (!allowed) {
    const upgrade = await findUpgradeTier(tier, featureKey, usage);
    upgradeTo = upgrade ? { key: upgrade.key, name: upgrade.name } : null;
    const label = FEATURE_LABELS[featureKey] || featureKey;
    message = limitFeature
      ? `Your ${tier.name} plan allows ${limit} active clients. Upgrade${upgrade ? ` to ${upgrade.name}` : ''} to add more.`
      : `${label} is not included in your ${tier.name} plan.${upgrade ? ` Upgrade to ${upgrade.name} to unlock it.` : ''}`;
  }

  return {
    allowed,
    featureKey,
    label: FEATURE_LABELS[featureKey],
    tier: { key: tier.key, name: tier.name },
    limit,
    usage,
    upgradeTo,
    message,
  };
}

async function assertAccess(therapistId, featureKey) {
  const result = await canAccess(therapistId, featureKey);
  if (!result.allowed) {
    throw new ApiError(403, result.message, { code: 'UPGRADE_REQUIRED', details: result });
  }
  return result;
}

async function getEntitlementSummary(therapistId) {
  const tier = await getTierConfig(therapistId);
  const features = {};
  for (const key of Object.values(FEATURES)) {
    features[key] = await canAccess(therapistId, key);
  }
  return {
    tier: serializeTier(tier),
    features,
  };
}

function serializeTier(t) {
  const toObj = (m) => (m instanceof Map ? Object.fromEntries(m) : { ...(m || {}) });
  return {
    key: t.key,
    name: t.name,
    description: t.description,
    monthly_price: t.monthly_price,
    platform_fee_percent: t.platform_fee_percent,
    limits: toObj(t.limits),
    features: [...(t.features || [])],
    highlights: t.highlights || [],
    sort_order: t.sort_order,
  };
}

async function listTiers() {
  return (await getAllTiers()).map(serializeTier);
}

async function getPlatformFeePercent(therapistId) {
  return (await getTierConfig(therapistId)).platform_fee_percent;
}

async function getDefaultTierKey() {
  return (await getDefaultTier()).key;
}

/** Changes a therapist's plan. SaaS subscription billing itself is simulated (see README). */
async function changeTier(therapistId, tierKey) {
  const tiers = await getAllTiers();
  const tier = tiers.find((t) => t.key === tierKey);
  if (!tier) throw ApiError.badRequest('Unknown subscription tier');
  await Therapist.updateOne({ _id: therapistId }, { subscription_tier: tier.key });
  return getEntitlementSummary(therapistId);
}

module.exports = {
  FEATURES,
  canAccess,
  assertAccess,
  getEntitlementSummary,
  listTiers,
  getPlatformFeePercent,
  getDefaultTierKey,
  changeTier,
  ensureTierConfigs,
  invalidateCache,
};
