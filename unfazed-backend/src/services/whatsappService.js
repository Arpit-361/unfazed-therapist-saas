/**
 * WhatsApp channel. The WhatsApp Business API requires business approval, so this is a stub
 * provider that queues messages in memory and logs them. Replace `stubProvider` with a real
 * provider (e.g. Meta Cloud API / Gupshup / Twilio) exposing the same send() signature.
 */
const config = require('../config/env');

const MAX_QUEUE = 200;
const queue = [];

const stubProvider = {
  name: 'stub',
  async send({ to, message }) {
    queue.unshift({ to, message, queued_at: new Date().toISOString() });
    if (queue.length > MAX_QUEUE) queue.pop();
    console.log(`[whatsapp:stub] to=${to} message="${message.slice(0, 80)}${message.length > 80 ? '...' : ''}"`);
    return { status: 'queued', detail: 'WhatsApp stub - message queued and logged' };
  },
};

const providers = { stub: stubProvider };
const provider = providers[config.whatsapp.provider] || stubProvider;

async function sendWhatsApp({ to, message }) {
  if (!to) return { status: 'skipped', detail: 'No phone number' };
  try {
    return await provider.send({ to, message });
  } catch (err) {
    return { status: 'failed', detail: err.message };
  }
}

const getQueuedMessages = () => queue.slice(0, 50);

module.exports = { sendWhatsApp, getQueuedMessages, providerName: provider.name };
