/**
 * Event-driven notification service. Domain code calls notify(EVENT, context); this service
 * decides recipients/templates and fans out to channels: in-app (DB + Socket.io), email
 * (Nodemailer) and WhatsApp (stub). Failures never break the calling business flow.
 */
const { formatInTimeZone } = require('date-fns-tz');
const config = require('../config/env');
const Notification = require('../models/Notification');
const Therapist = require('../models/Therapist');
const Client = require('../models/Client');
const { sendEmail } = require('./emailService');
const { sendWhatsApp } = require('./whatsappService');
const { formatInr } = require('../utils/money');

const EVENTS = Object.freeze({
  BOOKING_CONFIRMED: 'booking.confirmed',
  SESSION_CANCELLED: 'session.cancelled',
  PAYMENT_RECEIVED: 'payment.received',
  SESSION_REMINDER: 'session.reminder_24h',
  SESSION_FOLLOWUP: 'session.followup',
  WAITLIST_SLOT_OPEN: 'waitlist.slot_available',
  LEAD_RECEIVED: 'lead.received',
  CLIENT_INVITED: 'client.invited',
});

let socketEmitter = null;
const setSocketEmitter = (fn) => {
  socketEmitter = fn;
};

const fmt = (date, tz) => formatInTimeZone(date, tz || 'Asia/Kolkata', "EEE, d MMM yyyy 'at' h:mm a (zzz)");

/** Returns [{ role, recipient, title, body, link, email, whatsapp }] for an event. */
function buildMessages(event, ctx) {
  const { therapist, client, session, payment, lead } = ctx;
  const portal = `${config.clientUrl}/portal`;
  const dash = `${config.clientUrl}/dashboard`;

  switch (event) {
    case EVENTS.BOOKING_CONFIRMED:
      return [
        {
          role: 'client',
          recipient: client,
          title: 'Session confirmed',
          body: `Your session with ${therapist.name} is confirmed for ${fmt(session.start_time, client.timezone)}.`,
          link: `${portal}`,
          email: true,
          whatsapp: true,
        },
        {
          role: 'therapist',
          recipient: therapist,
          title: 'New booking',
          body: `${client.name} booked ${session.service_title} on ${fmt(session.start_time, therapist.timezone)}.`,
          link: `${dash}/schedule`,
          email: true,
        },
      ];
    case EVENTS.SESSION_CANCELLED:
      return [
        {
          role: 'client',
          recipient: client,
          title: 'Session cancelled',
          body: `Your session on ${fmt(session.start_time, client.timezone)} was cancelled.`,
          link: portal,
          email: true,
          whatsapp: true,
        },
        {
          role: 'therapist',
          recipient: therapist,
          title: 'Session cancelled',
          body: `${client.name}'s session on ${fmt(session.start_time, therapist.timezone)} was cancelled.`,
          link: `${dash}/schedule`,
        },
      ];
    case EVENTS.PAYMENT_RECEIVED:
      return [
        {
          role: 'client',
          recipient: client,
          title: 'Payment received',
          body: `We received ${formatInr(payment.amount)} for ${payment.description}. Your invoice ${payment.invoice_number} is ready.`,
          link: `${portal}/payments`,
          email: true,
        },
        {
          role: 'therapist',
          recipient: therapist,
          title: 'Payment received',
          body: `${client.name} paid ${formatInr(payment.amount)} (${payment.description}).`,
          link: `${dash}/payments`,
        },
      ];
    case EVENTS.SESSION_REMINDER:
      return [
        {
          role: 'client',
          recipient: client,
          title: 'Reminder: session tomorrow',
          body: `Reminder: your session with ${therapist.name} is on ${fmt(session.start_time, client.timezone)}.`,
          link: portal,
          email: true,
          whatsapp: true,
        },
        {
          role: 'therapist',
          recipient: therapist,
          title: 'Upcoming session',
          body: `Session with ${client.name} on ${fmt(session.start_time, therapist.timezone)}.`,
          link: `${dash}/schedule`,
        },
      ];
    case EVENTS.SESSION_FOLLOWUP:
      return [
        {
          role: 'client',
          recipient: client,
          title: 'Thank you for your session',
          body: `Thanks for meeting ${therapist.name} today. Book your next session or check shared notes in your portal.`,
          link: portal,
          email: true,
          whatsapp: true,
        },
      ];
    case EVENTS.WAITLIST_SLOT_OPEN:
      return [
        {
          role: 'client',
          recipient: client,
          title: 'A slot opened up',
          body: `A slot just opened with ${therapist.name} on ${ctx.date}. Book it before it's gone!`,
          link: `${portal}/book`,
          email: true,
          whatsapp: true,
        },
      ];
    case EVENTS.LEAD_RECEIVED:
      return [
        {
          role: 'therapist',
          recipient: therapist,
          title: 'New enquiry',
          body: `${lead.name} sent an enquiry${lead.message ? `: "${lead.message.slice(0, 120)}"` : '.'}`,
          link: `${dash}/leads`,
          email: true,
        },
      ];
    case EVENTS.CLIENT_INVITED:
      return [
        {
          role: 'client',
          recipient: client,
          title: `${therapist.name} invited you to Unfazed`,
          body: `Set up your client portal to complete intake, book sessions and chat securely: ${ctx.inviteUrl}`,
          link: ctx.inviteUrl,
          email: true,
          inApp: false,
        },
      ];
    default:
      return [];
  }
}

async function deliver(event, message, therapistId) {
  const { role, recipient } = message;
  const channels = [];

  if (message.email) {
    const result = await sendEmail({
      to: recipient.email,
      subject: message.title,
      text: `${message.body}\n\n${message.link || ''}`,
    });
    channels.push({ channel: 'email', ...result });
  }
  if (message.whatsapp) {
    const result = await sendWhatsApp({ to: recipient.phone, message: `${message.title}: ${message.body}` });
    channels.push({ channel: 'whatsapp', ...result });
  }

  if (message.inApp === false) return;

  channels.unshift({ channel: 'in_app', status: 'sent', detail: '' });
  const notification = await Notification.create({
    recipient_role: role,
    recipient_id: recipient._id,
    therapist_id: therapistId,
    type: event,
    title: message.title,
    body: message.body,
    link: message.link,
    channels,
  });

  if (socketEmitter) {
    socketEmitter(role, String(recipient._id), 'notification:new', {
      id: String(notification._id),
      type: event,
      title: notification.title,
      body: notification.body,
      link: notification.link,
      read: false,
      created_at: notification.createdAt,
    });
  }
}

async function hydrate(ctx) {
  const out = { ...ctx };
  if (out.therapistId && !out.therapist) out.therapist = await Therapist.findById(out.therapistId).lean();
  if (out.clientId && !out.client) out.client = await Client.findById(out.clientId).lean();
  return out;
}

/** Fire-and-forget: never throws into business logic. */
function notify(event, context) {
  return (async () => {
    const ctx = await hydrate(context);
    if (!ctx.therapist) return;
    const messages = buildMessages(event, ctx).filter((m) => m.recipient);
    await Promise.all(messages.map((m) => deliver(event, m, ctx.therapist._id)));
  })().catch((err) => console.error(`[notifications] ${event} failed:`, err.message));
}

module.exports = { EVENTS, notify, setSocketEmitter };
