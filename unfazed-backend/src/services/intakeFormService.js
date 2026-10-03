/**
 * Custom intake form builder.
 *
 * A therapist's form is an ordered list of field definitions stored on Therapist.intake_form.fields
 * and exposed to clients as a JSON Schema. Client answers are validated here against that schema
 * and saved with the question text captured at submission time, so later edits to the form never
 * change what a client originally answered.
 */
const crypto = require('crypto');
const ApiError = require('../utils/ApiError');

const FIELD_TYPES = Object.freeze({
  short_text: { label: 'Short answer', schema: { type: 'string', maxLength: 300 } },
  long_text: { label: 'Paragraph', schema: { type: 'string', maxLength: 3000 } },
  number: { label: 'Number', schema: { type: 'number' } },
  date: { label: 'Date', schema: { type: 'string', format: 'date' } },
  select: { label: 'Dropdown', schema: { type: 'string' } },
  yes_no: { label: 'Yes / No', schema: { type: 'boolean' } },
});

const MAX_FIELDS = 20;
const MAX_OPTIONS = 20;
const ID_PATTERN = /^f_[a-z0-9]{6,16}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const newFieldId = () => `f_${crypto.randomBytes(5).toString('hex')}`;
const clean = (value, max) => String(value ?? '').trim().slice(0, max);

/** Validates and normalizes a therapist-submitted field list. Throws 400 with per-field details. */
function normalizeFields(rawFields) {
  if (!Array.isArray(rawFields)) throw ApiError.badRequest('Form fields must be a list');
  if (rawFields.length > MAX_FIELDS) throw ApiError.badRequest(`A form can have at most ${MAX_FIELDS} questions`);

  const errors = [];
  const seenIds = new Set();
  const fields = rawFields.map((raw, index) => {
    const n = index + 1;
    const label = clean(raw?.label, 160);
    const type = String(raw?.type || '');
    if (label.length < 2) errors.push({ field: `fields[${index}].label`, message: `Question ${n} needs a label` });
    if (!FIELD_TYPES[type]) errors.push({ field: `fields[${index}].type`, message: `Question ${n} has an unsupported type` });

    let options = [];
    if (type === 'select') {
      options = [...new Set((Array.isArray(raw.options) ? raw.options : []).map((o) => clean(o, 80)).filter(Boolean))];
      if (options.length < 2) errors.push({ field: `fields[${index}].options`, message: `Question ${n} needs at least 2 options` });
      if (options.length > MAX_OPTIONS) errors.push({ field: `fields[${index}].options`, message: `Question ${n} can have at most ${MAX_OPTIONS} options` });
    }

    let id = typeof raw?.id === 'string' && ID_PATTERN.test(raw.id) ? raw.id : newFieldId();
    if (seenIds.has(id)) id = newFieldId();
    seenIds.add(id);

    return { id, label, type, required: raw?.required === true, help: clean(raw?.help, 240), options };
  });

  if (errors.length) throw ApiError.badRequest(errors[0].message, errors);
  return fields;
}

/** JSON Schema (draft 2020-12 subset) describing the custom part of the intake form. */
function toJsonSchema(fields = []) {
  const properties = {};
  for (const f of fields) {
    properties[f.id] = {
      ...FIELD_TYPES[f.type].schema,
      title: f.label,
      ...(f.help ? { description: f.help } : {}),
      ...(f.type === 'select' ? { enum: f.options } : {}),
      'x-field-type': f.type,
    };
  }
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type: 'object',
    properties,
    required: fields.filter((f) => f.required).map((f) => f.id),
    'x-order': fields.map((f) => f.id),
    additionalProperties: false,
  };
}

function coerceAnswer(field, raw) {
  if (raw === undefined || raw === null || raw === '') return { empty: true };
  switch (field.type) {
    case 'short_text':
    case 'long_text': {
      const value = clean(raw, FIELD_TYPES[field.type].schema.maxLength);
      return value ? { value } : { empty: true };
    }
    case 'number': {
      const value = Number(raw);
      return Number.isFinite(value) ? { value } : { error: 'must be a number' };
    }
    case 'date': {
      const value = String(raw);
      return DATE_PATTERN.test(value) && !Number.isNaN(Date.parse(value)) ? { value } : { error: 'must be a valid date' };
    }
    case 'select': {
      const value = String(raw);
      return field.options.includes(value) ? { value } : { error: 'must be one of the listed options' };
    }
    case 'yes_no':
      if (raw === true || raw === 'true' || raw === 'yes') return { value: true };
      if (raw === false || raw === 'false' || raw === 'no') return { value: false };
      return { error: 'must be yes or no' };
    default:
      return { empty: true };
  }
}

/**
 * Validates client answers ({ [fieldId]: value }) against the therapist's fields.
 * Unknown keys are ignored. Returns custom_responses ready to store on the client's intake.
 */
function buildResponses(fields = [], answers = {}) {
  const source = answers && typeof answers === 'object' && !Array.isArray(answers) ? answers : {};
  const errors = [];
  const responses = [];
  for (const field of fields) {
    const result = coerceAnswer(field, source[field.id]);
    if (result.error) {
      errors.push({ field: `custom_answers.${field.id}`, message: `"${field.label}" ${result.error}` });
    } else if (result.empty) {
      if (field.required) errors.push({ field: `custom_answers.${field.id}`, message: `Please answer "${field.label}"` });
    } else {
      responses.push({ field_id: field.id, label: field.label, type: field.type, value: result.value });
    }
  }
  if (errors.length) throw ApiError.badRequest(errors[0].message, errors);
  return responses;
}

const serializeFields = (fields = []) =>
  fields.map((f) => ({ id: f.id, label: f.label, type: f.type, required: Boolean(f.required), help: f.help || '', options: [...(f.options || [])] }));

const fieldTypes = () => Object.entries(FIELD_TYPES).map(([key, t]) => ({ key, label: t.label }));

module.exports = { MAX_FIELDS, normalizeFields, toJsonSchema, buildResponses, serializeFields, fieldTypes };
