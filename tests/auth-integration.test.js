const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

test('loads the migration helper before Firebase application code', () => {
  const helperAt = html.indexOf('<script src="auth-migration.js"></script>');
  const firebaseAt = html.indexOf('firebase-app-compat.js');
  assert.notEqual(helperAt, -1);
  assert.notEqual(firebaseAt, -1);
  assert.ok(helperAt < firebaseAt);
});

test('uses an atomic Firebase transaction and verifies the merged account data', () => {
  assert.match(html, /googleRef\.transaction\(function\(currentData\)/);
  assert.match(html, /verifyGuestMerge\(expectedData, savedData, guestId\)/);
});

test('does not delete the original guest record after migration', () => {
  assert.doesNotMatch(html, /guestRef\.remove\s*\(/);
  assert.match(html, /Keep the original guest record/);
});

test('captures guest progress before both Google sign-in entry points', () => {
  const calls = html.match(/captureGuestAuthSnapshot\(\);/g) || [];
  assert.equal(calls.length, 2);
});

test('shows actionable Firebase auth errors and supports redirect fallback', () => {
  assert.match(html, /auth\/unauthorized-domain/);
  assert.match(html, /auth\/operation-not-allowed/);
  assert.match(html, /signInWithRedirect\(provider\)/);
});
