const test = require('node:test');
const assert = require('node:assert/strict');
const migration = require('../auth-migration.js');

test('keeps the highest account and guest counters', () => {
  const merged = migration.mergeGuestData(
    { xp: 120, gems: 8, hearts: 3, streak: 4, level: 2 },
    { xp: 90, gems: 12, hearts: 5, streak: 2, level: 3 },
    'DEV-ABC'
  );
  assert.deepEqual(
    [merged.xp, merged.gems, merged.hearts, merged.streak, merged.level],
    [120, 12, 5, 4, 3]
  );
});

test('unions completed lessons without discarding either course', () => {
  const merged = migration.mergeGuestData(
    { completed: { python: { lesson1: true }, javascript: { lesson2: true } } },
    { completed: { python: { lesson3: true } } },
    'DEV-ABC'
  );
  assert.deepEqual(merged.completed, {
    python: { lesson1: true, lesson3: true },
    javascript: { lesson2: true }
  });
});

test('merges achievements without duplicating entries', () => {
  const merged = migration.mergeGuestData(
    { achievements: ['first', 'builder'] },
    { achievements: ['builder', 'streak'] },
    'DEV-ABC'
  );
  assert.deepEqual(merged.achievements, ['first', 'builder', 'streak']);
});

test('preserves Google account metadata and prefers its existing user name', () => {
  const merged = migration.mergeGuestData(
    { userName: 'Guest name', email: 'guest@example.com', xp: 50 },
    { userName: 'Google name', email: 'google@example.com', xp: 10 },
    'DEV-ABC'
  );
  assert.equal(merged.userName, 'Google name');
  assert.equal(merged.email, 'google@example.com');
  assert.equal(merged.xp, 50);
});

test('records the guest source for idempotent retries', () => {
  const merged = migration.mergeGuestData(
    { xp: 30 },
    { xp: 20, guestMigrations: { 'DEV-OLD': true } },
    'DEV-NEW'
  );
  assert.deepEqual(merged.guestMigrations, { 'DEV-OLD': true, 'DEV-NEW': true });
});

test('verifies the merged record and rejects missing migration markers', () => {
  const merged = migration.mergeGuestData(
    { xp: 40, completed: { python: { lesson1: true } } },
    { xp: 20 },
    'DEV-ABC'
  );
  assert.equal(migration.verifyGuestMerge(merged, merged, 'DEV-ABC'), true);
  const incomplete = { ...merged, guestMigrations: {} };
  assert.equal(migration.verifyGuestMerge(merged, incomplete, 'DEV-ABC'), false);
});

test('only migrates generated guest device identifiers', () => {
  assert.equal(migration.shouldMigrateGuestId('DEV-ABC123'), true);
  assert.equal(migration.shouldMigrateGuestId('google-user-123'), false);
  assert.equal(migration.shouldMigrateGuestId(null), false);
});
