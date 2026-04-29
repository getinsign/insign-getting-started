// Unit tests for pure helpers. Runs with `node --test`.
// These are the only tests that run without network access.
const test = require('node:test');
const assert = require('node:assert/strict');

const { mergeAdditionalFields } = require('../dist/nodes/Insign/GenericFunctions');

test('mergeAdditionalFields: returns base when no extras', () => {
  const base = { a: 1 };
  assert.deepEqual(mergeAdditionalFields(base), { a: 1 });
  assert.deepEqual(mergeAdditionalFields(base, ''), { a: 1 });
  assert.deepEqual(mergeAdditionalFields(base, '{}'), { a: 1 });
});

test('mergeAdditionalFields: parses JSON string and merges', () => {
  const base = { a: 1 };
  const res = mergeAdditionalFields(base, '{"b":2,"a":99}');
  assert.deepEqual(res, { a: 99, b: 2 });
});

test('mergeAdditionalFields: accepts object', () => {
  const base = { a: 1 };
  const res = mergeAdditionalFields(base, { b: 2 });
  assert.deepEqual(res, { a: 1, b: 2 });
});

test('mergeAdditionalFields: throws on invalid JSON', () => {
  assert.throws(() => mergeAdditionalFields({}, '{not json'), /not valid JSON/);
});
