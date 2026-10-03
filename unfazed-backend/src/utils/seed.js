/**
 * Demo data for the single demo therapist (Arpit Shukla, a software-demo profile with no
 * professional credentials): clients with intake/consent, six months of sessions, payments,
 * packages, notes, chat, leads and notifications. All people and records are fictional.
 */
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const { fromZonedTime, formatInTimeZone } = require('date-fns-tz');
const config = require('../config/env');
const { CONSENT_TEXT, CONSENT_VERSION } = require('../config/consent');
const entitlementService = require('../services/entitlementService');
const { buildSlotKeys } = require('../services/slotService');
const Therapist = require('../models/Therapist');
const Client = require('../models/Client');
const Availability = require('../models/Availability');
const Session = require('../models/Session');
const SessionNote = require('../models/SessionNote');
const Payment = require('../models/Payment');
const Package = require('../models/Package');
const ClientPackage = require('../models/ClientPackage');
const Lead = require('../models/Lead');
const Message = require('../models/Message');
const Notification = require('../models/Notification');
const Waitlist = require('../models/Waitlist');
const { toPaise } = require('./money');

const TZ = 'Asia/Kolkata';
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

// Deterministic pseudo-random generator so the demo looks the same on every start.
function rng(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const istDate = (offsetDays, time) => {
  const day = formatInTimeZone(new Date(Date.now() + offsetDays * DAY), TZ, 'yyyy-MM-dd');
  return fromZonedTime(`${day}T${time}:00`, TZ);
};

const consentRecord = (date) => ({
  version: CONSENT_VERSION,
  statement: CONSENT_TEXT,
  accepted: true,
  accepted_at: date,
  ip_address: '203.0.113.10',
  user_agent: 'Seed script',
});

const intake = (concern, date, extra = {}) => ({
  demographics: { gender: extra.gender || '', occupation: extra.occupation || '', city: extra.city || '', date_of_birth: extra.dob || '' },
  presenting_concern: concern,
  history: { previous_therapy: extra.previous || 'None', medications: 'None', medical_conditions: 'None', family_history: '' },
  goals: extra.goals || '',
  custom_responses: extra.custom_responses || [],
  submitted_at: date,
});

const DEMO_INTAKE_FIELDS = [
  { id: 'f_sleep01', label: 'How would you rate your sleep over the last two weeks?', type: 'select', required: true, help: '', options: ['Good', 'Fair', 'Poor'] },
  { id: 'f_lang01', label: 'Preferred session language', type: 'select', required: false, help: '', options: ['English', 'Hindi', 'Marathi'] },
  { id: 'f_selfharm01', label: 'Have you had thoughts of harming yourself in the last month?', type: 'yes_no', required: true, help: 'If you are in immediate danger, call 112 or Tele-MANAS at 14416.', options: [] },
  { id: 'f_referral01', label: 'How did you hear about this practice?', type: 'short_text', required: false, help: '', options: [] },
];

function breakdown(base, feePercent) {
  const tax = Math.round((base * config.pricing.gstRatePercent) / 100);
  const fee = Math.round((base * feePercent) / 100);
  return {
    base_amount: base,
    tax_rate_percent: config.pricing.gstRatePercent,
    tax_amount: tax,
    amount: base + tax,
    platform_fee_percent: feePercent,
    platform_fee: fee,
    net_amount: base - fee,
  };
}

const invoiceNumber = (id, paidAt) => `UNF-${formatInTimeZone(paidAt, TZ, 'yyyyMMdd')}-${String(id).slice(-6).toUpperCase()}`;

async function clearDatabase() {
  await Promise.all(
    [Therapist, Client, Availability, Session, SessionNote, Payment, Package, ClientPackage, Lead, Message, Notification, Waitlist].map((m) =>
      m.deleteMany({})
    )
  );
}

async function seedDatabase({ reset = true } = {}) {
  if (reset) await clearDatabase();
  await entitlementService.ensureTierConfigs();
  const random = rng(42);
  const passwordHash = await bcrypt.hash(config.demoPassword, 10);
  const now = new Date();

  // ---------- Therapists ----------
  const arpit = await Therapist.create({
    email: 'arpit@unfazed.demo',
    password_hash: passwordHash,
    name: 'Arpit Shukla',
    slug: 'arpit-shukla',
    title: 'Demo therapist profile',
    bio: 'Unfazed demo therapist profile showcasing online scheduling, client management, secure notes, payments and practice analytics. All data on this profile is sample data for demonstration purposes.',
    specializations: ['Anxiety', 'Depression', 'Relationships', 'Workplace stress', 'Life transitions'],
    languages: ['English', 'Hindi', 'Marathi'],
    qualifications: '',
    experience_years: 0,
    intake_form: { fields: DEMO_INTAKE_FIELDS, updated_at: now },
    city: 'Mumbai',
    phone: '+919800000001',
    gstin: '27ABCDE1234F1Z5',
    subscription_tier: 'pro',
    services: [
      { title: 'Initial Consultation', description: 'A first conversation to understand your concerns and goals.', duration_minutes: 30, price: toPaise(900) },
      { title: 'Individual Therapy', description: 'One-on-one online session using evidence-based approaches.', duration_minutes: 60, price: toPaise(1800) },
      { title: 'Follow-up Session', description: 'Shorter check-in for ongoing clients.', duration_minutes: 45, price: toPaise(1400) },
      { title: 'Couples Therapy', description: 'Extended session for partners working on their relationship.', duration_minutes: 90, price: toPaise(2800) },
    ],
  });

  await Availability.create([
    {
      therapist_id: arpit._id,
      timezone: TZ,
      weekly: [
        ...[1, 2, 3, 4, 5].flatMap((d) => [
          { day_of_week: d, start: '10:00', end: '13:00' },
          { day_of_week: d, start: '14:00', end: '19:00' },
        ]),
        { day_of_week: 6, start: '10:00', end: '14:00' },
      ],
      overrides: [
        { date: formatInTimeZone(new Date(now.getTime() + 10 * DAY), TZ, 'yyyy-MM-dd'), unavailable: true, note: 'Conference' },
      ],
      buffer_minutes: 10,
      session_durations: [30, 45, 60, 90],
      min_notice_hours: 4,
      booking_window_days: 45,
    },
  ]);

  // ---------- Packages ----------
  const [pkg3, pkg6] = await Package.create([
    { therapist_id: arpit._id, name: 'Starter Pack', description: 'Three sessions to get started.', session_count: 3, per_session_rate: toPaise(1700), duration_minutes: 60, validity_days: 60 },
    { therapist_id: arpit._id, name: 'Growth Pack', description: 'Six sessions for steady progress.', session_count: 6, per_session_rate: toPaise(1600), duration_minutes: 60, validity_days: 120 },
    { therapist_id: arpit._id, name: 'Commitment Pack', description: 'Twelve sessions at the best rate.', session_count: 12, per_session_rate: toPaise(1500), duration_minutes: 60, validity_days: 240 },
  ]);

  // ---------- Clients ----------
  const arpitClientsData = [
    { name: 'Aarav Mehta', email: 'aarav@client.demo', phone: '+919811111111', tags: ['anxiety', 'work-stress'], password: true, months: 6, concern: 'Constant worry about work performance and trouble sleeping before presentations.', extra: {
        gender: 'Male',
        occupation: 'Product manager',
        city: 'Mumbai',
        custom_responses: [
          { field_id: 'f_sleep01', label: DEMO_INTAKE_FIELDS[0].label, type: 'select', value: 'Poor' },
          { field_id: 'f_lang01', label: DEMO_INTAKE_FIELDS[1].label, type: 'select', value: 'English' },
          { field_id: 'f_selfharm01', label: DEMO_INTAKE_FIELDS[2].label, type: 'yes_no', value: false },
          { field_id: 'f_referral01', label: DEMO_INTAKE_FIELDS[3].label, type: 'short_text', value: 'A colleague shared the booking link' },
        ],
      } },
    { name: 'Priya Nair', email: 'priya@client.demo', phone: '+919811111112', tags: ['depression'], password: true, months: 5, concern: 'Low mood and loss of interest in hobbies since moving cities.' },
    { name: 'Kabir Singh', email: 'kabir@client.demo', phone: '+919811111113', tags: ['relationships'], months: 5, concern: 'Frequent conflicts with partner and difficulty communicating.' },
    { name: 'Meera Joshi', email: 'meera@client.demo', phone: '+919811111114', tags: ['anxiety'], months: 4, concern: 'Panic attacks while commuting.' },
    { name: 'Rahul Verma', email: 'rahul@client.demo', phone: '+919811111115', tags: ['work-stress', 'burnout'], months: 4, concern: 'Burnout and irritability after long work hours.' },
    { name: 'Sneha Reddy', email: 'sneha@client.demo', phone: '+919811111116', tags: ['life-transitions'], months: 3, concern: 'Adjusting to new parenthood and identity changes.' },
    { name: 'Arjun Kapoor', email: 'arjun@client.demo', phone: '+919811111117', tags: ['grief'], months: 3, concern: 'Grief after the loss of a parent.' },
    { name: 'Ishita Das', email: 'ishita@client.demo', phone: '+919811111118', tags: ['anxiety', 'students'], months: 2, concern: 'Exam anxiety and perfectionism.' },
    { name: 'Vikram Rao', email: 'vikram@client.demo', phone: '+919811111119', tags: ['relationships'], months: 6, status: 'inactive', concern: 'Pre-marital counselling.' },
    { name: 'Kavya Menon', email: 'kavya@client.demo', phone: '+919811111121', tags: ['students'], password: true, months: 2, concern: 'Academic stress and difficulty focusing.' },
  ];

  const arpitClients = [];
  for (const c of arpitClientsData) {
    const joined = new Date(now.getTime() - c.months * 30 * DAY);
    arpitClients.push(
      await Client.create({
        therapist_id: arpit._id,
        name: c.name,
        email: c.email,
        phone: c.phone,
        tags: c.tags,
        password_hash: c.password ? passwordHash : undefined,
        status: c.status || 'active',
        source: 'therapist',
        intake: intake(c.concern, joined, c.extra),
        consent_records: [consentRecord(joined)],
        createdAt: joined,
      })
    );
  }
  // An invited client who has not yet onboarded (no intake/consent yet).
  arpitClients.push(
    await Client.create({ therapist_id: arpit._id, name: 'Neha Kapoor', email: 'neha@client.demo', phone: '+919811111120', status: 'invited', tags: ['new'] })
  );

  // ---------- Sessions & payments ----------
  const sessions = [];
  const payments = [];
  const services = Object.fromEntries(arpit.services.map((s) => [s.duration_minutes, s]));
  const sessionTimes = ['10:00', '11:30', '14:00', '15:30', '17:00'];
  const used = new Set();

  function addSession({ therapist, client, start, service, status, buffer, paymentStatus, feePercent, packageRef }) {
    const slotKeys = buildSlotKeys(therapist._id, start, service.duration_minutes, buffer);
    if (slotKeys.some((k) => used.has(k))) return null;
    if (status !== 'cancelled') slotKeys.forEach((k) => used.add(k));
    const end = new Date(start.getTime() + service.duration_minutes * 60000);
    const session = {
      _id: new mongoose.Types.ObjectId(),
      therapist_id: therapist._id,
      client_id: client._id,
      service_title: service.title,
      start_time: start,
      end_time: end,
      duration_minutes: service.duration_minutes,
      buffer_minutes: buffer,
      status,
      slot_active: status !== 'cancelled',
      slot_keys: slotKeys,
      payment_status: paymentStatus,
      price: service.price,
      client_package_id: packageRef || undefined,
      client_timezone: TZ,
      booked_by: random() > 0.3 ? 'client' : 'therapist',
      reminder_sent_at: start < now ? new Date(start.getTime() - DAY) : null,
      followup_sent_at: status === 'completed' ? end : null,
      cancelled_at: status === 'cancelled' ? new Date(start.getTime() - 2 * DAY) : undefined,
      cancel_reason: status === 'cancelled' ? 'Cancelled by client' : '',
      createdAt: new Date(Math.min(start.getTime() - 5 * DAY, now.getTime() - 2 * HOUR)),
    };
    if (paymentStatus === 'paid') {
      const paymentId = new mongoose.Types.ObjectId();
      // Booked and paid in the past, even for upcoming sessions.
      const paidAt = new Date(Math.max(session.createdAt.getTime(), Math.min(start.getTime() - 3 * DAY, now.getTime() - HOUR)));
      session.payment_id = paymentId;
      payments.push({
        _id: paymentId,
        therapist_id: therapist._id,
        client_id: client._id,
        purpose: 'session',
        session_id: session._id,
        description: `${service.title} (${service.duration_minutes} min) on ${formatInTimeZone(start, TZ, 'dd MMM yyyy, h:mm a')}`,
        currency: 'INR',
        ...breakdown(service.price, feePercent),
        status: status === 'cancelled' ? 'refund_pending' : 'paid',
        gateway: 'demo',
        gateway_order_id: `order_demo_seed${String(paymentId).slice(-8)}`,
        gateway_transaction_id: `pay_demo_seed${String(paymentId).slice(-8)}`,
        confirmed_via: 'demo',
        invoice_number: invoiceNumber(paymentId, paidAt),
        paid_at: paidAt,
        createdAt: paidAt,
      });
    }
    sessions.push(session);
    return session;
  }

  // Aarav's 6-session package (2 used in the past + 1 upcoming)
  const aarav = arpitClients[0];
  const pkgPaymentId = new mongoose.Types.ObjectId();
  const pkgPaidAt = new Date(now.getTime() - 21 * DAY);
  const aaravPackage = await ClientPackage.create({
    therapist_id: arpit._id,
    client_id: aarav._id,
    package_id: pkg6._id,
    payment_id: pkgPaymentId,
    name: pkg6.name,
    sessions_total: 6,
    sessions_used: 3,
    per_session_rate: pkg6.per_session_rate,
    duration_minutes: 60,
    purchased_at: pkgPaidAt,
    expires_at: new Date(pkgPaidAt.getTime() + pkg6.validity_days * DAY),
  });
  payments.push({
    _id: pkgPaymentId,
    therapist_id: arpit._id,
    client_id: aarav._id,
    purpose: 'package',
    package_id: pkg6._id,
    client_package_id: aaravPackage._id,
    description: 'Growth Pack - 6 x 60 min sessions',
    currency: 'INR',
    ...breakdown(6 * pkg6.per_session_rate, 3),
    status: 'paid',
    gateway: 'demo',
    gateway_order_id: 'order_demo_seedpkg0001',
    gateway_transaction_id: 'pay_demo_seedpkg0001',
    confirmed_via: 'demo',
    invoice_number: invoiceNumber(pkgPaymentId, pkgPaidAt),
    paid_at: pkgPaidAt,
    createdAt: pkgPaidAt,
  });

  // Priya bought a 3-pack that is fully used
  const priyaPkgPaymentId = new mongoose.Types.ObjectId();
  const priyaPaidAt = new Date(now.getTime() - 70 * DAY);
  await ClientPackage.create({
    therapist_id: arpit._id,
    client_id: arpitClients[1]._id,
    package_id: pkg3._id,
    payment_id: priyaPkgPaymentId,
    name: pkg3.name,
    sessions_total: 3,
    sessions_used: 3,
    per_session_rate: pkg3.per_session_rate,
    duration_minutes: 60,
    purchased_at: priyaPaidAt,
    expires_at: new Date(priyaPaidAt.getTime() + pkg3.validity_days * DAY),
    status: 'exhausted',
  });
  payments.push({
    _id: priyaPkgPaymentId,
    therapist_id: arpit._id,
    client_id: arpitClients[1]._id,
    purpose: 'package',
    package_id: pkg3._id,
    description: 'Starter Pack - 3 x 60 min sessions',
    currency: 'INR',
    ...breakdown(3 * pkg3.per_session_rate, 3),
    status: 'paid',
    gateway: 'demo',
    gateway_order_id: 'order_demo_seedpkg0002',
    gateway_transaction_id: 'pay_demo_seedpkg0002',
    confirmed_via: 'demo',
    invoice_number: invoiceNumber(priyaPkgPaymentId, priyaPaidAt),
    paid_at: priyaPaidAt,
    createdAt: priyaPaidAt,
  });

  // Past sessions over ~6 months for Arpit Shukla
  const activeArpitClients = arpitClients.filter((c) => c.status !== 'invited');
  for (let daysAgo = 175; daysAgo >= 1; daysAgo -= 1) {
    const dayDate = new Date(now.getTime() - daysAgo * DAY);
    const dow = Number(formatInTimeZone(dayDate, TZ, 'i')) % 7; // ISO 1-7 => 0 = Sunday
    if (dow === 0) continue;
    const count = Math.floor(random() * 3) + (daysAgo < 60 ? 1 : 0);
    for (let i = 0; i < count; i += 1) {
      const client = activeArpitClients[Math.floor(random() * activeArpitClients.length)];
      const clientAgeDays = (now - client.createdAt) / DAY;
      if (daysAgo > clientAgeDays) continue;
      const time = sessionTimes[Math.floor(random() * (dow === 6 ? 2 : sessionTimes.length))];
      const roll = random();
      const status = roll < 0.84 ? 'completed' : roll < 0.93 ? 'no_show' : 'cancelled';
      const service = random() < 0.8 ? services[60] : random() < 0.5 ? services[45] : services[90];
      addSession({
        therapist: arpit,
        client,
        start: istDate(-daysAgo, time),
        service,
        status,
        buffer: 10,
        paymentStatus: 'paid',
        feePercent: 3,
      });
    }
  }

  // Aarav: package sessions (past) + upcoming sessions
  [-14, -7].forEach((offset) =>
    addSession({ therapist: arpit, client: aarav, start: istDate(offset, '18:00'), service: services[60], status: 'completed', buffer: 10, paymentStatus: 'package', packageRef: aaravPackage._id })
  );
  const upcomingAarav = addSession({ therapist: arpit, client: aarav, start: istDate(2, '11:30'), service: services[60], status: 'confirmed', buffer: 10, paymentStatus: 'package', packageRef: aaravPackage._id });

  // Upcoming week for Arpit Shukla
  const upcomingPlan = [
    [1, '10:00', 1], [1, '15:30', 2], [3, '14:00', 3], [4, '17:00', 4], [5, '10:00', 5], [6, '15:30', 6],
  ];
  for (const [offset, time, idx] of upcomingPlan) {
    const start = istDate(offset, time);
    const dow = Number(formatInTimeZone(start, TZ, 'i')) % 7;
    if (dow === 0 || (dow === 6 && time > '13:00')) continue;
    addSession({ therapist: arpit, client: arpitClients[idx], start, service: services[60], status: 'confirmed', buffer: 10, paymentStatus: 'paid', feePercent: 3 });
  }

  await Session.insertMany(sessions);
  await Payment.insertMany(payments);

  // ---------- Notes ----------
  const lastAaravSession = sessions.filter((s) => String(s.client_id) === String(aarav._id) && s.status === 'completed').pop();
  await SessionNote.create([
    {
      therapist_id: arpit._id,
      client_id: aarav._id,
      session_id: lastAaravSession?._id,
      type: 'private',
      format: 'soap',
      title: 'Session 3 - SOAP',
      structured: {
        subjective: 'Reports improved sleep (6h avg). Still anxious before Monday stand-ups. Mentions conflict with manager.',
        objective: 'Calm affect, good eye contact. GAD-7 score 9 (down from 14).',
        assessment: 'Generalised anxiety improving with CBT. Core belief: "I must never make mistakes." Monitor manager-related stressors.',
        plan: 'Continue cognitive restructuring. Introduce behavioural experiment for presentations. Re-assess GAD-7 in 2 sessions.',
      },
    },
    {
      therapist_id: arpit._id,
      client_id: aarav._id,
      session_id: lastAaravSession?._id,
      type: 'shared',
      format: 'freeform',
      title: 'Your practice plan for this week',
      content:
        '<p>Great work this week, Aarav! Here is what we agreed to practise:</p><ul><li><strong>Box breathing</strong> - 4 rounds before each meeting.</li><li>Fill the <em>thought record</em> whenever you notice "I will mess this up".</li><li>Wind-down routine: screens off by 11 pm.</li></ul><p>See you next session.</p>',
    },
    {
      therapist_id: arpit._id,
      client_id: aarav._id,
      type: 'private',
      format: 'freeform',
      title: 'Risk screen',
      content: '<p>No current suicidal ideation. Protective factors: supportive sister, regular exercise. Re-screen monthly.</p>',
    },
    {
      therapist_id: arpit._id,
      client_id: arpitClients[1]._id,
      type: 'private',
      format: 'dap',
      title: 'Session notes',
      structured: {
        data: 'Mood 4/10. Isolating on weekends. Started journaling.',
        assessment: 'Mild-moderate depressive symptoms, adjustment-related.',
        plan: 'Behavioural activation: schedule 2 social activities. PHQ-9 next session.',
      },
    },
    {
      therapist_id: arpit._id,
      client_id: arpitClients[1]._id,
      type: 'shared',
      format: 'freeform',
      title: 'Activities to try',
      content: '<p>Pick two activities from your list and schedule them this week. Notice how you feel before and after.</p>',
    },
  ]);

  // ---------- Chat ----------
  const chat = [
    ['client', 'Hi Arpit, can I share my thought record before our next session?', 50],
    ['therapist', 'Of course, Aarav. Bring it along and we will go through it together.', 48],
    ['client', 'Thanks! The breathing exercise really helped before my presentation today.', 26],
    ['therapist', "That's wonderful to hear - well done for practising it!", 25],
  ];
  await Message.insertMany(
    chat.map(([role, body, hoursAgo]) => ({
      therapist_id: arpit._id,
      client_id: aarav._id,
      sender_role: role,
      body,
      read_at: new Date(now.getTime() - (hoursAgo - 1) * 3600000),
      createdAt: new Date(now.getTime() - hoursAgo * 3600000),
    }))
  );
  await Message.create({ therapist_id: arpit._id, client_id: arpitClients[1]._id, sender_role: 'client', body: 'Could we move Thursday to the evening if possible?', createdAt: new Date(now.getTime() - 2 * 3600000) });

  // ---------- Leads ----------
  await Lead.create([
    { therapist_id: arpit._id, name: 'Tanvi Shah', email: 'tanvi@lead.demo', phone: '+919822222221', message: 'Looking for help with anxiety around a career change. Do you offer evening sessions?', status: 'new' },
    { therapist_id: arpit._id, name: 'Rohit Malhotra', email: 'rohit@lead.demo', message: 'My partner and I want couples counselling in Hindi.', status: 'contacted', createdAt: new Date(now.getTime() - 3 * DAY) },
    { therapist_id: arpit._id, name: 'Ayesha Khan', email: 'ayesha@lead.demo', message: 'Interested in sessions for burnout.', status: 'new', source: 'directory', createdAt: new Date(now.getTime() - DAY) },
    { therapist_id: arpit._id, name: 'Sameer Joshi', email: 'sameer@lead.demo', message: 'Need help with exam stress.', status: 'closed', createdAt: new Date(now.getTime() - 6 * DAY) },
  ]);

  // ---------- Notifications ----------
  await Notification.create([
    { recipient_role: 'therapist', recipient_id: arpit._id, therapist_id: arpit._id, type: 'lead.received', title: 'New enquiry', body: 'Tanvi Shah sent an enquiry about evening sessions.', link: '/dashboard/leads', channels: [{ channel: 'in_app', status: 'sent' }] },
    { recipient_role: 'therapist', recipient_id: arpit._id, therapist_id: arpit._id, type: 'booking.confirmed', title: 'New booking', body: `Aarav Mehta booked Individual Therapy on ${formatInTimeZone(upcomingAarav.start_time, TZ, 'EEE, d MMM h:mm a')}.`, link: '/dashboard/schedule', channels: [{ channel: 'in_app', status: 'sent' }] },
    { recipient_role: 'client', recipient_id: aarav._id, therapist_id: arpit._id, type: 'booking.confirmed', title: 'Session confirmed', body: `Your session with Arpit Shukla is confirmed for ${formatInTimeZone(upcomingAarav.start_time, TZ, 'EEE, d MMM h:mm a')}.`, link: '/portal', channels: [{ channel: 'in_app', status: 'sent' }, { channel: 'whatsapp', status: 'queued' }] },
  ]);

  console.log(
    `[seed] Seeded demo therapist Arpit Shukla with ${arpitClients.length} clients, ${sessions.length} sessions, ${payments.length} payments. Demo password: ${config.demoPassword}`
  );
  return { arpit };
}

module.exports = { seedDatabase, clearDatabase };
