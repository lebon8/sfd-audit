'use strict';
const Ajv = require('ajv');
const addFormats = require('ajv-formats');
const schema = require('./event-schema.json');

const ajv = new Ajv({ allErrors: true });
addFormats(ajv);
const validate = ajv.compile(schema);

function validateEvent(event) {
  const valid = validate(event);
  return { valid, errors: valid ? [] : (validate.errors || []).map((e) => `${e.instancePath || '/'} ${e.message}`) };
}

module.exports = { validateEvent };