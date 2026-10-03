const { CONSENT_VERSION } = require('../config/consent');

const id = (value) => (value && value._id ? String(value._id) : value ? String(value) : null);

function serializeService(service) {
  return {
    id: id(service),
    title: service.title,
    description: service.description,
    duration_minutes: service.duration_minutes,
    price: service.price,
  };
}

function serializeTherapistPrivate(t) {
  return {
    id: id(t),
    role: 'therapist',
    email: t.email,
    name: t.name,
    slug: t.slug,
    title: t.title,
    bio: t.bio,
    specializations: t.specializations,
    languages: t.languages,
    qualifications: t.qualifications,
    experience_years: t.experience_years,
    city: t.city,
    phone: t.phone,
    photo_url: t.photo_url,
    timezone: t.timezone,
    gstin: t.gstin,
    accepting_clients: t.accepting_clients,
    services: (t.services || []).map(serializeService),
    created_at: t.createdAt,
  };
}

// Public branded profile: no email, phone, GSTIN or billing data.
function serializeTherapistPublic(t) {
  return {
    id: id(t),
    name: t.name,
    slug: t.slug,
    title: t.title,
    bio: t.bio,
    specializations: t.specializations,
    languages: t.languages,
    qualifications: t.qualifications,
    experience_years: t.experience_years,
    city: t.city,
    photo_url: t.photo_url,
    timezone: t.timezone,
    accepting_clients: t.accepting_clients,
    services: (t.services || []).map(serializeService),
  };
}

function consentStatus(client) {
  const records = client.consent_records || [];
  const latest = records[records.length - 1];
  return {
    given: Boolean(latest && latest.version === CONSENT_VERSION),
    version: latest ? latest.version : null,
    accepted_at: latest ? latest.accepted_at : null,
  };
}

function serializeClientForTherapist(c, extras = {}) {
  return {
    id: id(c),
    therapist_id: id(c.therapist_id),
    name: c.name,
    email: c.email,
    phone: c.phone,
    status: c.status,
    tags: c.tags || [],
    timezone: c.timezone,
    source: c.source,
    portal_access: Boolean(c.password_hash) || c.has_password === true,
    intake: c.intake || null,
    intake_completed: Boolean(c.intake && c.intake.submitted_at),
    consent: consentStatus(c),
    consent_records: (c.consent_records || []).map((r) => ({
      version: r.version,
      accepted_at: r.accepted_at,
      ip_address: r.ip_address,
      user_agent: r.user_agent,
    })),
    created_at: c.createdAt,
    ...extras,
  };
}

function serializeClientSelf(c) {
  return {
    id: id(c),
    role: 'client',
    therapist_id: id(c.therapist_id),
    name: c.name,
    email: c.email,
    phone: c.phone,
    timezone: c.timezone,
    status: c.status,
    intake: c.intake || null,
    intake_completed: Boolean(c.intake && c.intake.submitted_at),
    consent: consentStatus(c),
  };
}

function serializeSession(s) {
  return {
    id: id(s),
    therapist_id: id(s.therapist_id),
    client_id: id(s.client_id),
    client: s.client_id && s.client_id.name ? { id: id(s.client_id), name: s.client_id.name, email: s.client_id.email } : undefined,
    service_title: s.service_title,
    start_time: s.start_time,
    end_time: s.end_time,
    duration_minutes: s.duration_minutes,
    status: s.status,
    payment_status: s.payment_status,
    price: s.price,
    payment_id: id(s.payment_id),
    client_package_id: id(s.client_package_id),
    hold_expires_at: s.hold_expires_at,
    client_timezone: s.client_timezone,
    booked_by: s.booked_by,
    meeting_link: s.meeting_link,
    created_at: s.createdAt,
  };
}

function serializeNoteForTherapist(n) {
  return {
    id: id(n),
    client_id: id(n.client_id),
    client: n.client_id && n.client_id.name ? { id: id(n.client_id), name: n.client_id.name } : undefined,
    session_id: id(n.session_id),
    type: n.type,
    format: n.format,
    title: n.title,
    content: n.content,
    structured: n.structured || {},
    created_at: n.createdAt,
    updated_at: n.updatedAt,
  };
}

/**
 * The ONLY serializer used by client-facing routes. It refuses to serialize anything that is not
 * a shared note, so a query mistake can never leak a private note to a client.
 */
function serializeNoteForClient(n) {
  if (!n || n.type !== 'shared') {
    throw new Error('Refusing to serialize a non-shared note for a client-facing response');
  }
  return {
    id: id(n),
    session_id: id(n.session_id),
    format: n.format,
    title: n.title,
    content: n.content,
    structured: n.structured || {},
    created_at: n.createdAt,
    updated_at: n.updatedAt,
  };
}

function serializePayment(p) {
  return {
    id: id(p),
    therapist_id: id(p.therapist_id),
    client_id: id(p.client_id),
    client: p.client_id && p.client_id.name ? { id: id(p.client_id), name: p.client_id.name } : undefined,
    session_id: id(p.session_id),
    client_package_id: id(p.client_package_id),
    package_id: id(p.package_id),
    purpose: p.purpose,
    description: p.description,
    currency: p.currency,
    base_amount: p.base_amount,
    tax_amount: p.tax_amount,
    amount: p.amount,
    platform_fee: p.platform_fee,
    net_amount: p.net_amount,
    status: p.status,
    gateway: p.gateway,
    gateway_order_id: p.gateway_order_id,
    gateway_transaction_id: p.gateway_transaction_id,
    webhook_confirmed: p.webhook_confirmed,
    invoice_number: p.invoice_number,
    paid_at: p.paid_at,
    created_at: p.createdAt,
  };
}

// Clients see what they paid, never the therapist's platform fee / net payout.
function serializePaymentForClient(p) {
  const full = serializePayment(p);
  delete full.platform_fee;
  delete full.net_amount;
  delete full.therapist_id;
  return full;
}

function serializePackage(p) {
  return {
    id: id(p),
    name: p.name,
    description: p.description,
    session_count: p.session_count,
    per_session_rate: p.per_session_rate,
    total_price: p.session_count * p.per_session_rate,
    duration_minutes: p.duration_minutes,
    validity_days: p.validity_days,
    active: p.active,
  };
}

function serializeClientPackage(cp) {
  return {
    id: id(cp),
    client_id: id(cp.client_id),
    client: cp.client_id && cp.client_id.name ? { id: id(cp.client_id), name: cp.client_id.name } : undefined,
    package_id: id(cp.package_id),
    name: cp.name,
    sessions_total: cp.sessions_total,
    sessions_used: cp.sessions_used,
    sessions_remaining: Math.max(0, cp.sessions_total - cp.sessions_used),
    per_session_rate: cp.per_session_rate,
    duration_minutes: cp.duration_minutes,
    purchased_at: cp.purchased_at,
    expires_at: cp.expires_at,
    status: cp.expires_at && cp.expires_at < new Date() && cp.status === 'active' ? 'expired' : cp.status,
  };
}

function serializeMessage(m) {
  return {
    id: id(m),
    therapist_id: id(m.therapist_id),
    client_id: id(m.client_id),
    sender_role: m.sender_role,
    body: m.body,
    read_at: m.read_at,
    created_at: m.createdAt,
  };
}

function serializeLead(l) {
  return {
    id: id(l),
    name: l.name,
    email: l.email,
    phone: l.phone,
    message: l.message,
    preferences: l.preferences || {},
    source: l.source,
    status: l.status,
    converted_client_id: id(l.converted_client_id),
    created_at: l.createdAt,
  };
}

function serializeNotification(n) {
  return {
    id: id(n),
    type: n.type,
    title: n.title,
    body: n.body,
    link: n.link,
    read: Boolean(n.read_at),
    channels: n.channels,
    created_at: n.createdAt,
  };
}

module.exports = {
  serializeTherapistPrivate,
  serializeTherapistPublic,
  serializeClientForTherapist,
  serializeClientSelf,
  serializeSession,
  serializeNoteForTherapist,
  serializeNoteForClient,
  serializePayment,
  serializePaymentForClient,
  serializePackage,
  serializeClientPackage,
  serializeMessage,
  serializeLead,
  serializeNotification,
  consentStatus,
};
