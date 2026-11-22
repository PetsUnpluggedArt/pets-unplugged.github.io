// Week logic of /assets/js/rotation.js. Run from the repo root: node --test _tests/rotation.test.js
// (_tests/ starts with "_", so Jekyll never publishes it.)
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const rot = require('../assets/js/rotation.js');

const ROT = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'rotation.json'), 'utf8'));
const PRODUCTS = new Set();   // every Payhip code the site sells (singles, bundles, book) + the free Pompom
ROT.weeks.forEach(w => { PRODUCTS.add(w.paid_code); PRODUCTS.add(w.bundle.code); PRODUCTS.add(w.book_code); });
PRODUCTS.add('WMkrK');

const at = s => new Date(s);
const idx = s => { const p = rot.pick(ROT, at(s)); return p ? p.index : null; };
const until = s => rot.pick(ROT, at(s)).until.toISOString().slice(0, 16);   // wall-clock date of the next switch
// A copy where every week has a (made-up) free code, to test the switch without Payhip codes.
const ALL = JSON.parse(JSON.stringify(ROT));
ALL.weeks.forEach((w, i) => { if (!rot.hasCode(w.free_code)) w.free_code = 'TEST' + (i + 1); });

test('rotation.json: 10 weeks, anchor Mon 2026-11-23 06:00 New York, week 1 = Pompom with WMkrK', () => {
  assert.equal(ROT.weeks.length, 10);
  assert.equal(ROT.anchor, '2026-11-23T06:00');
  assert.equal(ROT.timezone, 'America/New_York');
  assert.equal(ROT.weeks[0].title, 'Pompom');
  assert.equal(ROT.weeks[0].free_code, 'WMkrK');
  ROT.weeks.forEach((w, i) => {
    assert.equal(w.week, i + 1);
    const d = new Date(w.start + 'T12:00:00Z');
    assert.equal(d.getUTCDay(), 1, w.start + ' is a Monday');
    assert.equal(rot.pick(ROT, at(w.start + 'T12:00:00-05:00')).index, i, 'week ' + (i + 1) + ' starts on its date');
    assert.ok(w.bundle.pals.length === 2 && w.bundle.code && w.paid_code && w.book_code === 'zhxGf');
  });
});

test('before the anchor: nothing changes (null)', () => {
  assert.equal(rot.pick(ROT, at('2026-11-22T12:00:00-05:00')), null);
  assert.equal(rot.pick(ROT, at('2026-11-23T05:59:59-05:00')), null);
  assert.equal(rot.resolve(ROT, at('2026-11-23T05:59:59-05:00')), null);
  assert.equal(idx('2026-11-23T06:00:00-05:00'), 0);
});

test('Sunday 23:59 / Monday 05:59 stay in the old week, Monday 06:00 New York switches', () => {
  assert.equal(idx('2026-11-29T23:59:00-05:00'), 0);
  assert.equal(idx('2026-11-30T05:59:59-05:00'), 0);
  assert.equal(idx('2026-11-30T06:00:00-05:00'), 1);
  assert.equal(until('2026-11-24T12:00:00-05:00'), '2026-11-30T06:00');
  // the visitor's own zone doesn't matter: 06:00 New York = 11:00 UTC = 12:00 Berlin
  assert.equal(idx('2026-11-30T10:59:59Z'), 0);
  assert.equal(idx('2026-11-30T11:00:00Z'), 1);
  assert.equal(idx('2026-11-30T12:00:00+01:00'), 1);
});

test('DST starts Sun Mar 14 2027: the switch stays at 06:00 (EDT) on Mon Mar 15', () => {
  // Mar 15 2027 is week 17 from the anchor -> index 16 % 10 = 6
  assert.equal(idx('2027-03-14T03:30:00-04:00'), 5);
  assert.equal(idx('2027-03-15T05:59:59-04:00'), 5);
  assert.equal(idx('2027-03-15T06:00:00-04:00'), 6);   // = 10:00 UTC; a plain UTC count would switch at 11:00
  assert.equal(until('2027-03-10T12:00:00-05:00'), '2027-03-15T06:00');
});

test('DST ends Sun Nov 7 2027: the switch stays at 06:00 (EST) on Mon Nov 8', () => {
  // Nov 8 2027 is 50 weeks after the anchor -> index 0 (week 1 again)
  assert.equal(idx('2027-11-07T01:30:00-04:00'), 9);   // the first 01:30 (EDT)
  assert.equal(idx('2027-11-07T01:30:00-05:00'), 9);   // the repeated 01:30 (EST)
  assert.equal(idx('2027-11-08T05:59:59-05:00'), 9);
  assert.equal(idx('2027-11-08T06:00:00-05:00'), 0);
  assert.equal(idx('2027-07-05T06:00:00-04:00'), 2);   // summer Monday (EDT): 32 weeks -> index 2
  assert.equal(idx('2027-07-05T05:59:00-04:00'), 1);
});

test('week 10 -> week 1 on Mon 2027-02-01 06:00', () => {
  assert.equal(idx('2027-01-25T06:00:00-05:00'), 9);
  assert.equal(idx('2027-02-01T05:59:59-05:00'), 9);
  assert.equal(idx('2027-02-01T06:00:00-05:00'), 0);
  const p = rot.pick(ROT, at('2027-01-27T12:00:00-05:00'));
  assert.equal(p.cur.title, 'Send Help. And a Lawyer');
  assert.equal(p.next.title, 'Pompom');
  assert.equal(p.until.toISOString().slice(0, 16), '2027-02-01T06:00');
  const r = rot.resolve(ALL, at('2027-01-27T12:00:00-05:00'));
  assert.equal(r.next.title, 'Pompom');
  assert.equal(r.nextUrl, 'https://payhip.com/b/WMkrK');
});

test('a week with a free code: that dog is free, links only to its free code + its bundle + the book', () => {
  const r = rot.resolve(ALL, at('2026-12-08T12:00:00-05:00'));
  assert.equal(r.mode, 'free');
  assert.equal(r.dog.title, 'The Secret Agent');
  assert.equal(r.url, 'https://payhip.com/b/TEST3');
  assert.equal(r.next.title, 'Sweetness Delivery');
});

test('missing free code ("TO MAKE" or empty): dog stays paid, falls back to Pompom WMkrK, no dead link', () => {
  for (const bad of ['TO MAKE', '', null, undefined, 'to make']) {
    const R = JSON.parse(JSON.stringify(ROT));
    R.weeks[1].free_code = bad;
    const r = rot.resolve(R, at('2026-12-01T12:00:00-05:00'));
    assert.equal(r.mode, 'fallback', String(bad));
    assert.equal(r.dog.title, 'Pompom');
    assert.equal(r.url, 'https://payhip.com/b/WMkrK');
    // and the week before doesn't advertise it as next Monday's free page
    const r1 = rot.resolve(R, at('2026-11-24T12:00:00-05:00'));
    assert.equal(r1.mode, 'free');
    assert.equal(r1.next, null);
    assert.equal(r1.nextUrl, null);
  }
  // the real file: week 2 has no code yet -> fallback
  assert.equal(rot.resolve(ROT, at('2026-12-01T12:00:00-05:00')).mode, 'fallback');
  // no fallback code either -> change nothing
  const N = JSON.parse(JSON.stringify(ROT));
  N.weeks[0].free_code = 'TO MAKE';
  assert.equal(rot.resolve(N, at('2026-12-01T12:00:00-05:00')), null);
});

test('every link the script can build in each of the 10 weeks is a real product code, WMkrK or that week\'s own free code', () => {
  for (const R of [ROT, ALL]) {
    for (let i = 0; i < 10; i++) {
      const t = new Date(Date.parse('2026-11-24T17:00:00Z') + i * 7 * 864e5);
      const r = rot.resolve(R, t);
      assert.equal(r.index, i);
      const codes = [r.url, r.nextUrl, rot.PAYHIP + r.dog.bundle.code, rot.PAYHIP + r.dog.book_code].filter(Boolean)
        .map(u => u.replace(rot.PAYHIP, ''));
      const own = new Set([R.weeks[i].free_code, R.weeks[(i + 1) % 10].free_code, 'WMkrK']);
      codes.forEach(c => assert.ok(PRODUCTS.has(c) || own.has(c), 'week ' + (i + 1) + ': ' + c));
      assert.ok(!codes.some(c => / /.test(c)));
    }
  }
});

test('fetch failure, HTTP error, bad JSON or a broken clock: apply() is never called (page stays paid)', async () => {
  let called = 0;
  const apply = () => { called++; };
  const now = at('2026-11-24T12:00:00-05:00');
  await rot.run(() => Promise.reject(new Error('offline')), '/rotation.json', now, apply);
  await rot.run(() => { throw new Error('no fetch'); }, '/rotation.json', now, apply);
  await rot.run(() => Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve(ROT) }), '/rotation.json', now, apply);
  await rot.run(() => Promise.resolve({ ok: true, json: () => Promise.reject(new SyntaxError('bad json')) }), '/rotation.json', now, apply);
  await rot.run(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }), '/rotation.json', now, apply);
  await rot.run(() => Promise.resolve({ ok: true, json: () => Promise.resolve(Object.assign({}, ROT, { timezone: 'Not/AZone' })) }), '/rotation.json', now, apply);
  await rot.run(() => Promise.resolve({ ok: true, json: () => Promise.resolve(ROT) }), '/rotation.json', new Date(NaN), apply);
  assert.equal(called, 0);
  // and the happy path does call it
  const r = await rot.run(() => Promise.resolve({ ok: true, json: () => Promise.resolve(ROT) }), '/rotation.json', now, apply);
  assert.equal(called, 1);
  assert.equal(r.dog.title, 'Pompom');
});
