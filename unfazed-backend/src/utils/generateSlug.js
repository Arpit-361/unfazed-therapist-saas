const RESERVED_SLUGS = new Set([
  'api', 'admin', 'login', 'register', 'signup', 'dashboard', 'portal', 'share', 'uploads',
  'settings', 'about', 'pricing', 'help', 'support', 'static', 'assets', 'app', 'unfazed',
]);

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/^(dr|mr|mrs|ms)\.?\s+/, 'dr-')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}

function validateSlugFormat(slug) {
  if (!slug || slug.length < 3 || slug.length > 40) return 'Slug must be 3-40 characters long';
  if (!SLUG_PATTERN.test(slug)) return 'Slug may contain only lowercase letters, numbers and single hyphens';
  if (RESERVED_SLUGS.has(slug)) return 'This slug is reserved';
  return null;
}

/**
 * Generates a unique slug for a therapist. `isTaken(slug)` must resolve to true when the slug exists.
 */
async function generateUniqueSlug(base, isTaken) {
  let root = slugify(base);
  if (!root || root.length < 3) root = `therapist-${root || 'profile'}`.replace(/-$/, '');
  if (RESERVED_SLUGS.has(root)) root = `${root}-practice`;

  let candidate = root;
  let suffix = 1;
  while (await isTaken(candidate)) {
    suffix += 1;
    candidate = `${root}-${suffix}`;
  }
  return candidate;
}

module.exports = { slugify, generateUniqueSlug, validateSlugFormat, RESERVED_SLUGS };
