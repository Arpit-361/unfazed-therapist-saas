import { formatInTimeZone } from 'date-fns-tz';
import { formatDistanceToNow } from 'date-fns';

const TZ_ALIASES = { 'Asia/Calcutta': 'Asia/Kolkata', 'Asia/Saigon': 'Asia/Ho_Chi_Minh', 'Asia/Katmandu': 'Asia/Kathmandu' };

export const browserTimeZone = () => {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
  return TZ_ALIASES[tz] || tz;
};

export function formatINR(paise, { decimals } = {}) {
  const rupees = (Number(paise) || 0) / 100;
  const fraction = decimals ?? (Number.isInteger(rupees) ? 0 : 2);
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: fraction,
    maximumFractionDigits: fraction,
  }).format(rupees);
}

export const formatCompactINR = (paise) =>
  `₹${new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 }).format((Number(paise) || 0) / 100)}`;

const safe = (fn) => (value, ...args) => {
  if (!value) return '—';
  try {
    return fn(new Date(value), ...args);
  } catch {
    return '—';
  }
};

const tzOr = (tz) => tz || browserTimeZone();

export const fmtDateTime = safe((d, tz) => formatInTimeZone(d, tzOr(tz), 'EEE, d MMM yyyy · h:mm a'));
export const fmtDate = safe((d, tz) => formatInTimeZone(d, tzOr(tz), 'd MMM yyyy'));
export const fmtShortDate = safe((d, tz) => formatInTimeZone(d, tzOr(tz), 'd MMM'));
export const fmtTime = safe((d, tz) => formatInTimeZone(d, tzOr(tz), 'h:mm a'));
export const fmtDayLabel = safe((d, tz) => formatInTimeZone(d, tzOr(tz), 'EEE d MMM'));
export const fmtRelative = safe((d) => formatDistanceToNow(d, { addSuffix: true }));
export const tzAbbrev = (tz) => {
  try {
    return formatInTimeZone(new Date(), tzOr(tz), 'zzz');
  } catch {
    return tz;
  }
};

export const fmtMonth = (key) => {
  if (!key) return '';
  const [y, m] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 15)).toLocaleString('en-IN', { month: 'short', year: '2-digit', timeZone: 'UTC' });
};

export const initials = (name = '') =>
  name
    .replace(/^(dr|mr|mrs|ms)\.?\s+/i, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');

export const firstName = (name = '') => name.replace(/^(dr|mr|mrs|ms)\.?\s+/i, '').split(/\s+/)[0] || name;

export const titleCase = (s = '') => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export const TIMEZONES = [
  'Asia/Kolkata',
  'Asia/Dubai',
  'Asia/Singapore',
  'Europe/London',
  'Europe/Berlin',
  'America/New_York',
  'America/Los_Angeles',
  'Australia/Sydney',
];

export const timezoneOptions = (current) => [...new Set([current, browserTimeZone(), ...TIMEZONES].filter(Boolean))];
