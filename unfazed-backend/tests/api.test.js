/**
 * End-to-end API tests against an in-memory MongoDB seeded with demo data.
 * Run: npm test
 */
process.env.DEMO_MODE = 'true';
process.env.MONGO_URI = '';
process.env.RAZORPAY_KEY_ID = '';
process.env.RAZORPAY_KEY_SECRET = '';
process.env.RAZORPAY_WEBHOOK_SECRET = 'test_webhook_secret';
process.env.SCHEDULER_INTERVAL_SECONDS = '3600';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const crypto = require('crypto');
const mongoose = require('mongoose');
const { connectDB, disconnectDB } = require('../src/config/db');
const { app } = require('../src/app');
const entitlementService = require('../src/services/entitlementService');
const { seedDatabase } = require('../src/utils/seed');
const config = require('../src/config/env');

let server;
let baseUrl;
const tokens = {};
const ids = {};

async function api(method, path, { token, body, raw = false, headers = {} } = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  });
  if (raw) return res;
  const json = await res.json().catch(() => ({}));
  return { status: res.status, body: json };
}

const login = async (email, role = 'therapist') => {
  const path = role === 'therapist' ? '/api/auth/login' : '/api/auth/client/login';
  const res = await api('POST', path, { body: { email, password: config.demoPassword } });
  assert.equal(res.status, 200, `login failed for ${email}: ${JSON.stringify(res.body)}`);
  return res.body;
};

before(async () => {
  await connectDB();
  await mongoose.connection.syncIndexes();
  await entitlementService.ensureTierConfigs();
  await seedDatabase();
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  const arpit = await login('arpit.shukla@unfazed.demo');
  const iyer = await login('dr.iyer@unfazed.demo');
  const aarav = await login('aarav@client.demo', 'client');
  const kavya = await login('kavya@client.demo', 'client');
  tokens.arpit = arpit.token;
  tokens.iyer = iyer.token;
  tokens.aarav = aarav.token;
  tokens.kavya = kavya.token;
  ids.aarav = aarav.user.id;
  ids.kavya = kavya.user.id;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await disconnectDB();
});

test('health check reports ok and demo integrations', async () => {
  const res = await api('GET', '/api/health');
  assert.equal(res.status, 200);
  assert.equal(res.body.status, 'ok');
  assert.equal(res.body.database, 'connected');
  assert.equal(res.body.integrations.payments, 'demo');
});

test('registration validates input and creates unique slugs', async () => {
  const bad = await api('POST', '/api/auth/register', { body: { name: 'A', email: 'nope', password: '123' } });
  assert.equal(bad.status, 400);

  const a = await api('POST', '/api/auth/register', { body: { name: 'Dr. Test Person', email: 'test1@x.demo', password: 'Password1' } });
  const b = await api('POST', '/api/auth/register', { body: { name: 'Dr. Test Person', email: 'test2@x.demo', password: 'Password1' } });
  assert.equal(a.status, 201);
  assert.equal(b.status, 201);
  assert.notEqual(a.body.user.slug, b.body.user.slug);

  const dup = await api('POST', '/api/auth/register', { body: { name: 'Someone', email: 'test1@x.demo', password: 'Password1' } });
  assert.equal(dup.status, 409);

  const profile = await api('GET', `/api/public/therapists/${a.body.user.slug}`);
  assert.equal(profile.status, 200);
  assert.equal(profile.body.therapist.email, undefined, 'public profile must not expose email');
});

test('PRIVATE NOTES are never returned to clients', async () => {
  const therapistView = await api('GET', `/api/notes?client_id=${ids.aarav}`, { token: tokens.arpit });
  assert.equal(therapistView.status, 200);
  const privateTitles = therapistView.body.notes.filter((n) => n.type === 'private').map((n) => n.title);
  assert.ok(privateTitles.length >= 2, 'seed should include private notes');

  const portal = await api('GET', '/api/portal/notes', { token: tokens.aarav });
  assert.equal(portal.status, 200);
  assert.ok(portal.body.notes.length >= 1);
  for (const note of portal.body.notes) {
    assert.ok(!privateTitles.includes(note.title), `private note leaked: ${note.title}`);
    assert.equal(note.type, undefined);
  }

  // A brand new private note must not appear either.
  const created = await api('POST', '/api/notes', {
    token: tokens.arpit,
    body: { client_id: ids.aarav, type: 'private', format: 'freeform', title: 'TOP SECRET', content: '<p>secret</p>' },
  });
  assert.equal(created.status, 201);
  const portalAgain = await api('GET', '/api/portal/notes', { token: tokens.aarav });
  assert.ok(!portalAgain.body.notes.some((n) => n.title === 'TOP SECRET'));

  // Clients cannot reach therapist note routes at all.
  const direct = await api('GET', `/api/notes/${created.body.note.id}`, { token: tokens.aarav });
  assert.equal(direct.status, 403);
});

test('rich-text notes are sanitized', async () => {
  const res = await api('POST', '/api/notes', {
    token: tokens.arpit,
    body: { client_id: ids.aarav, type: 'shared', title: 'xss', content: '<p>hi</p><script>alert(1)</script><img src=x onerror=alert(1)>' },
  });
  assert.equal(res.status, 201);
  assert.equal(res.body.note.content, '<p>hi</p>');
});

test('therapist and client roles are strictly separated', async () => {
  assert.equal((await api('GET', '/api/clients', { token: tokens.aarav })).status, 403);
  assert.equal((await api('GET', '/api/analytics/overview', { token: tokens.aarav })).status, 403);
  assert.equal((await api('GET', '/api/portal/me', { token: tokens.arpit })).status, 403);
  assert.equal((await api('GET', '/api/clients')).status, 401);
  assert.equal((await api('GET', '/api/clients', { token: 'garbage' })).status, 401);
});

test('therapist data is isolated between therapists', async () => {
  const foreignClient = await api('GET', `/api/clients/${ids.aarav}`, { token: tokens.iyer });
  assert.equal(foreignClient.status, 404);

  const foreignNotes = await api('GET', `/api/notes?client_id=${ids.aarav}`, { token: tokens.iyer });
  assert.equal(foreignNotes.body.notes.length, 0);

  const foreignNoteCreate = await api('POST', '/api/notes', {
    token: tokens.iyer,
    body: { client_id: ids.aarav, type: 'private', content: 'x' },
  });
  assert.equal(foreignNoteCreate.status, 404);

  const foreignChat = await api('GET', `/api/chat/conversations/${ids.aarav}/messages`, { token: tokens.iyer });
  assert.equal(foreignChat.status, 404);

  const list = await api('GET', '/api/clients', { token: tokens.iyer });
  assert.ok(list.body.clients.every((c) => c.id !== ids.aarav));

  const kavyaSessions = await api('GET', '/api/portal/sessions', { token: tokens.kavya });
  assert.ok(kavyaSessions.body.sessions.every((s) => s.client_id === ids.kavya));
});

test('entitlements: active-client cap, note templates, packages and analytics depth', async () => {
  // Free tier: 5 active clients => cap reached
  const cap = await api('POST', '/api/clients', { token: tokens.iyer, body: { name: 'New Person', email: 'new@client.demo' } });
  assert.equal(cap.status, 403);
  assert.equal(cap.body.code, 'UPGRADE_REQUIRED');
  assert.equal(cap.body.details.upgradeTo.key, 'pro');

  const soapFree = await api('POST', '/api/notes', {
    token: tokens.iyer,
    body: { client_id: ids.kavya, type: 'private', format: 'soap', structured: { subjective: 'x' } },
  });
  assert.equal(soapFree.status, 403);
  assert.equal(soapFree.body.code, 'UPGRADE_REQUIRED');

  const soapPro = await api('POST', '/api/notes', {
    token: tokens.arpit,
    body: { client_id: ids.aarav, type: 'private', format: 'soap', structured: { subjective: 'x' } },
  });
  assert.equal(soapPro.status, 201);

  const pkgFree = await api('POST', '/api/payments/packages', {
    token: tokens.iyer,
    body: { name: 'Pack', session_count: 3, per_session_rate: 100000, duration_minutes: 60, validity_days: 30 },
  });
  assert.equal(pkgFree.status, 403);

  assert.equal((await api('GET', '/api/analytics/advanced', { token: tokens.arpit })).status, 403);
  const overview = await api('GET', '/api/analytics/overview', { token: tokens.arpit });
  assert.equal(overview.status, 200);
  assert.equal(overview.body.revenue_trend.length, 6);
  assert.ok(overview.body.stats.active_clients > 0);
  assert.ok(overview.body.revenue_trend.some((m) => m.gross > 0));

  // Upgrading flips access everywhere through the same service
  const upgrade = await api('POST', '/api/entitlements/change-tier', { token: tokens.iyer, body: { tier: 'premium' } });
  assert.equal(upgrade.status, 200);
  const adv = await api('GET', '/api/analytics/advanced', { token: tokens.iyer });
  assert.equal(adv.status, 200);
  assert.equal(adv.body.revenue_by_purpose.length, 12);
  await api('POST', '/api/entitlements/change-tier', { token: tokens.iyer, body: { tier: 'free' } });
});

test('intake form builder: gated by plan, validated, exposed as JSON schema', async () => {
  const fields = [
    { label: 'Preferred session time', type: 'select', required: true, options: ['Morning', 'Evening'] },
    { label: 'Anything else we should know?', type: 'long_text' },
  ];
  const free = await api('PUT', '/api/therapists/me/intake-form', { token: tokens.iyer, body: { fields } });
  assert.equal(free.status, 403);
  assert.equal(free.body.code, 'UPGRADE_REQUIRED');

  // Free-plan clients never see custom questions, even if some were stored earlier
  assert.deepEqual((await api('GET', '/api/portal/me', { token: tokens.kavya })).body.intake_fields, []);

  const current = await api('GET', '/api/therapists/me/intake-form', { token: tokens.arpit });
  assert.equal(current.status, 200);
  assert.equal(current.body.fields.length, 4);
  assert.deepEqual(current.body.json_schema.required, ['f_sleep01', 'f_selfharm01']);
  assert.deepEqual(current.body.json_schema.properties.f_sleep01.enum, ['Good', 'Fair', 'Poor']);

  const invalid = await api('PUT', '/api/therapists/me/intake-form', {
    token: tokens.arpit,
    body: { fields: [{ label: 'Pick one', type: 'select', options: ['Only'] }] },
  });
  assert.equal(invalid.status, 400);
  const badType = await api('PUT', '/api/therapists/me/intake-form', {
    token: tokens.arpit,
    body: { fields: [{ label: 'Upload', type: 'file' }] },
  });
  assert.equal(badType.status, 400);

  // Reordering keeps existing ids so stored answers stay linked
  const reordered = [...current.body.fields].reverse();
  const saved = await api('PUT', '/api/therapists/me/intake-form', { token: tokens.arpit, body: { fields: reordered } });
  assert.equal(saved.status, 200);
  assert.deepEqual(saved.body.json_schema['x-order'], ['f_referral01', 'f_selfharm01', 'f_lang01', 'f_sleep01']);
  const restored = await api('PUT', '/api/therapists/me/intake-form', { token: tokens.arpit, body: { fields: current.body.fields } });
  assert.equal(restored.status, 200);

  // Clients cannot edit the form
  assert.equal((await api('PUT', '/api/therapists/me/intake-form', { token: tokens.aarav, body: { fields } })).status, 403);
});

async function firstSlots(token) {
  const me = await api('GET', '/api/portal/me', { token });
  const service = me.body.therapist.services.find((s) => s.duration_minutes === 60);
  const from = new Date(Date.now() + 2 * 24 * 3600 * 1000).toISOString();
  const to = new Date(Date.now() + 9 * 24 * 3600 * 1000).toISOString();
  const res = await api('GET', `/api/portal/slots?service_id=${service.id}&from=${from}&to=${to}`, { token });
  assert.equal(res.status, 200);
  assert.ok(res.body.slots.length > 0, 'expected open slots');
  return { service, slots: res.body.slots };
}

test('double-booking is prevented under concurrency and slots disappear', async () => {
  const { service, slots } = await firstSlots(tokens.aarav);
  const slot = slots[0];
  const book = () =>
    api('POST', '/api/portal/sessions', { token: tokens.aarav, body: { service_id: service.id, start_time: slot.start, payment_mode: 'pay_now' } });

  const results = await Promise.all([book(), book(), book()]);
  const statuses = results.map((r) => r.status).sort();
  assert.deepEqual(statuses, [201, 409, 409]);

  const after = await firstSlots(tokens.aarav);
  assert.ok(!after.slots.some((s) => s.start === slot.start), 'booked slot must disappear');

  // Overlapping slot (30 minutes later) is also blocked because of duration + buffer.
  const overlapping = new Date(new Date(slot.start).getTime() + 30 * 60000).toISOString();
  const overlap = await api('POST', '/api/portal/sessions', {
    token: tokens.aarav,
    body: { service_id: service.id, start_time: overlapping, payment_mode: 'pay_now' },
  });
  assert.equal(overlap.status, 409);
});

test('demo payment confirms booking and generates a GST invoice PDF', async () => {
  const { service, slots } = await firstSlots(tokens.aarav);
  const booked = await api('POST', '/api/portal/sessions', {
    token: tokens.aarav,
    body: { service_id: service.id, start_time: slots[slots.length - 1].start, payment_mode: 'pay_now' },
  });
  assert.equal(booked.status, 201);
  assert.equal(booked.body.session.status, 'pending_payment');
  assert.equal(booked.body.checkout.gateway, 'demo');
  const gstBase = service.price;
  assert.equal(booked.body.checkout.amount, gstBase + Math.round((gstBase * config.pricing.gstRatePercent) / 100));

  const paid = await api('POST', `/api/portal/payments/${booked.body.checkout.payment_id}/demo-complete`, {
    token: tokens.aarav,
    body: { outcome: 'success' },
  });
  assert.equal(paid.status, 200);
  assert.equal(paid.body.payment.status, 'paid');
  assert.equal(paid.body.signature_verified, true);
  assert.ok(paid.body.payment.invoice_number.startsWith('UNF-'));
  assert.equal(paid.body.payment.platform_fee, undefined, 'clients must not see platform fee');

  const sessions = await api('GET', '/api/portal/sessions', { token: tokens.aarav });
  const session = sessions.body.sessions.find((s) => s.id === booked.body.session.id);
  assert.equal(session.status, 'confirmed');
  assert.equal(session.payment_status, 'paid');

  const pdf = await api('GET', `/api/portal/payments/${booked.body.checkout.payment_id}/invoice`, { token: tokens.aarav, raw: true });
  assert.equal(pdf.status, 200);
  assert.equal(pdf.headers.get('content-type'), 'application/pdf');
  const bytes = Buffer.from(await pdf.arrayBuffer());
  assert.equal(bytes.subarray(0, 4).toString(), '%PDF');

  // Another client cannot download this invoice.
  const foreign = await api('GET', `/api/portal/payments/${booked.body.checkout.payment_id}/invoice`, { token: tokens.kavya });
  assert.equal(foreign.status, 404);
});

test('package credits can be used to book', async () => {
  const { service, slots } = await firstSlots(tokens.aarav);
  const res = await api('POST', '/api/portal/sessions', {
    token: tokens.aarav,
    body: { service_id: service.id, start_time: slots[1].start, payment_mode: 'package' },
  });
  assert.equal(res.status, 201);
  assert.equal(res.body.session.status, 'confirmed');
  assert.equal(res.body.session.payment_status, 'package');
});

test('package purchase via demo gateway creates client package credits', async () => {
  const pkgs = await api('GET', '/api/portal/packages', { token: tokens.aarav });
  assert.ok(pkgs.body.enabled);
  const before = pkgs.body.my_packages.length;
  const purchase = await api('POST', `/api/portal/packages/${pkgs.body.packages[0].id}/purchase`, { token: tokens.aarav });
  assert.equal(purchase.status, 201);
  await api('POST', `/api/portal/payments/${purchase.body.checkout.payment_id}/demo-complete`, { token: tokens.aarav, body: { outcome: 'success' } });
  const afterPkgs = await api('GET', '/api/portal/packages', { token: tokens.aarav });
  assert.equal(afterPkgs.body.my_packages.length, before + 1);
});

test('invited clients must complete intake and consent before first session', async () => {
  const created = await api('POST', '/api/clients', {
    token: tokens.arpit,
    body: { name: 'Fresh Client', email: 'fresh@client.demo', tags: ['new'] },
  });
  assert.equal(created.status, 201);
  const token = created.body.invite_url.split('/').pop();

  const invite = await api('GET', `/api/auth/invite/${token}`);
  assert.equal(invite.status, 200);
  const accepted = await api('POST', `/api/auth/invite/${token}/accept`, { body: { password: 'Password1' } });
  assert.equal(accepted.status, 200);
  const clientToken = accepted.body.token;

  const { service, slots } = await firstSlots(clientToken);
  const blocked = await api('POST', '/api/portal/sessions', {
    token: clientToken,
    body: { service_id: service.id, start_time: slots[0].start, payment_mode: 'pay_now' },
  });
  assert.equal(blocked.status, 400);
  assert.equal(blocked.body.code, 'INTAKE_REQUIRED');

  const me = await api('GET', '/api/portal/me', { token: clientToken });
  const fieldIds = me.body.intake_fields.map((f) => f.id);
  assert.deepEqual(fieldIds, ['f_sleep01', 'f_lang01', 'f_selfharm01', 'f_referral01']);

  const intakeBody = { presenting_concern: 'Feeling overwhelmed at work lately.', demographics: { gender: 'Female' } };
  const missingCustom = await api('PUT', '/api/portal/intake', { token: clientToken, body: intakeBody });
  assert.equal(missingCustom.status, 400);
  assert.match(missingCustom.body.message, /sleep/);

  const badOption = await api('PUT', '/api/portal/intake', {
    token: clientToken,
    body: { ...intakeBody, custom_answers: { f_sleep01: 'Excellent', f_selfharm01: false } },
  });
  assert.equal(badOption.status, 400);

  const intake = await api('PUT', '/api/portal/intake', {
    token: clientToken,
    body: { ...intakeBody, custom_answers: { f_sleep01: 'Fair', f_selfharm01: 'no', f_referral01: '  Instagram  ', unknown_key: 'ignored' } },
  });
  assert.equal(intake.status, 200);
  assert.deepEqual(
    intake.body.client.intake.custom_responses.map((r) => [r.field_id, r.value]),
    [['f_sleep01', 'Fair'], ['f_selfharm01', false], ['f_referral01', 'Instagram']]
  );
  const therapistView = await api('GET', `/api/clients/${created.body.client.id}`, { token: tokens.arpit });
  assert.equal(therapistView.body.client.intake.custom_responses[0].label, 'How would you rate your sleep over the last two weeks?');
  const noConsent = await api('POST', '/api/portal/sessions', {
    token: clientToken,
    body: { service_id: service.id, start_time: slots[0].start, payment_mode: 'pay_now' },
  });
  assert.equal(noConsent.body.code, 'CONSENT_REQUIRED');

  const consentText = await api('GET', '/api/portal/consent', { token: clientToken });
  const consent = await api('POST', '/api/portal/consent', { token: clientToken, body: { accepted: true, version: consentText.body.version } });
  assert.equal(consent.status, 201);
  assert.ok(consent.body.client.consent.accepted_at);

  const ok = await api('POST', '/api/portal/sessions', {
    token: clientToken,
    body: { service_id: service.id, start_time: slots[0].start, payment_mode: 'pay_now' },
  });
  assert.equal(ok.status, 201);

  // Invite token is single-use
  const reuse = await api('POST', `/api/auth/invite/${token}/accept`, { body: { password: 'Password1' } });
  assert.equal(reuse.status, 404);
});

test('razorpay webhook rejects invalid signatures and accepts valid ones', async () => {
  const payload = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_x', order_id: 'order_unknown' } } } });
  const bad = await api('POST', '/api/payments/webhook', { body: payload, headers: { 'X-Razorpay-Signature': 'bad' } });
  assert.equal(bad.status, 400);

  const signature = crypto.createHmac('sha256', 'test_webhook_secret').update(payload).digest('hex');
  const good = await api('POST', '/api/payments/webhook', { body: payload, headers: { 'X-Razorpay-Signature': signature } });
  assert.equal(good.status, 200);
});

test('leads: public enquiry, distribution and conversion respect entitlements', async () => {
  const enquiry = await api('POST', '/api/public/therapists/arpit-shukla/enquiries', {
    body: { name: 'Curious Person', email: 'curious@lead.demo', message: 'Hello' },
  });
  assert.equal(enquiry.status, 201);

  const directory = await api('POST', '/api/public/leads', {
    body: { name: 'Directory Person', email: 'dir@lead.demo', preferences: { language: 'Tamil' } },
  });
  assert.equal(directory.status, 201);

  const leads = await api('GET', '/api/leads', { token: tokens.arpit });
  const lead = leads.body.leads.find((l) => l.email === 'curious@lead.demo');
  assert.ok(lead);
  const converted = await api('POST', `/api/leads/${lead.id}/convert`, { token: tokens.arpit });
  assert.equal(converted.status, 200);
  assert.equal(converted.body.lead.status, 'converted');

  const iyerLeads = await api('GET', '/api/leads', { token: tokens.iyer });
  const tamilLead = iyerLeads.body.leads.find((l) => l.email === 'dir@lead.demo');
  assert.ok(tamilLead, 'Tamil-speaking directory lead should route to Dr. Iyer');
  const blocked = await api('POST', `/api/leads/${tamilLead.id}/convert`, { token: tokens.iyer });
  assert.equal(blocked.status, 403);
});

test('availability validation rejects overlapping windows', async () => {
  const res = await api('PUT', '/api/scheduling/availability', {
    token: tokens.arpit,
    body: {
      weekly: [
        { day_of_week: 1, start: '10:00', end: '12:00' },
        { day_of_week: 1, start: '11:00', end: '13:00' },
      ],
    },
  });
  assert.equal(res.status, 400);
});
