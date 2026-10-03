const CONSENT_VERSION = '2026.1';

const CONSENT_TEXT = [
  'I consent to receive psychotherapy/counselling services from my therapist through Unfazed.',
  'I understand that session information is confidential except where disclosure is required by law or to prevent serious harm to myself or others.',
  'I understand that my therapist may keep private clinical notes that are not shared with me, and may choose to share some notes with me through my client portal.',
  'I consent to my personal and health information being stored securely and processed for the purpose of my care, scheduling and billing.',
  'I understand the cancellation policy and that sessions are booked with advance payment unless covered by a package.',
].join('\n\n');

module.exports = { CONSENT_VERSION, CONSENT_TEXT };
