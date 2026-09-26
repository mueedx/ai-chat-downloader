// test/merge.test.js
// The walk reads the page once per step, so successive reads have to become one list. These
// are the shapes that actually occur, plus the shapes that must not corrupt anything.

import test from 'node:test';
import assert from 'node:assert/strict';

import { loadExtension } from './harness.js';

const NS = loadExtension();

const turn = (role, text) => ({ role: role, text: text, notes: [], incomplete: false });
const texts = (list) => list.map((t) => t.text);

test('a fresh read that contains everything we had replaces it', () => {
  const first = [turn('user', 'a'), turn('assistant', 'b')];
  const second = [turn('user', 'a'), turn('assistant', 'b'), turn('user', 'c')];

  const merged = NS.merge.mergeTurnLists(first, second);
  assert.deepEqual(texts(merged), ['a', 'b', 'c']);
  assert.notEqual(merged, first);
  assert.notEqual(merged, second, 'the result is never one of the inputs');
});

test('a shorter read of the same page does not shrink the capture', () => {
  const first = [turn('user', 'a'), turn('assistant', 'b'), turn('user', 'c')];
  const second = [turn('user', 'a'), turn('assistant', 'b')];

  assert.deepEqual(texts(NS.merge.mergeTurnLists(first, second)), ['a', 'b', 'c']);
});

test('older turns arriving at the head are prepended, not appended', () => {
  const first = [turn('user', 'c'), turn('assistant', 'd')];
  const second = [turn('user', 'a'), turn('assistant', 'b'), turn('user', 'c'), turn('assistant', 'd')];

  assert.deepEqual(texts(NS.merge.mergeTurnLists(first, second)), ['a', 'b', 'c', 'd']);
});

test('a scrolling window that overlaps in the middle merges into full order', () => {
  const first = [turn('user', 'a'), turn('assistant', 'b'), turn('user', 'c')];
  const second = [turn('assistant', 'b'), turn('user', 'c'), turn('assistant', 'd')];

  assert.deepEqual(texts(NS.merge.mergeTurnLists(first, second)), ['a', 'b', 'c', 'd']);
});

test('two disjoint windows keep the longer one rather than inventing an order', () => {
  const first = [turn('user', 'a'), turn('assistant', 'b')];
  const second = [turn('user', 'x'), turn('assistant', 'y'), turn('user', 'z')];

  assert.deepEqual(texts(NS.merge.mergeTurnLists(first, second)), ['x', 'y', 'z']);
});

test('a read of nothing does not erase what was already captured', () => {
  const first = [turn('user', 'a')];
  assert.deepEqual(texts(NS.merge.mergeTurnLists(first, [])), ['a']);
  assert.deepEqual(texts(NS.merge.mergeTurnLists([], first)), ['a']);
});

test('turns differing only by notes are not treated as the same turn', () => {
  const first = [{ role: 'user', text: '', notes: ['image'], incomplete: false }];
  const second = [{ role: 'user', text: '', notes: ['attachment'], incomplete: false }];

  assert.equal(NS.merge.sameTurn(first[0], second[0]), false);
});

test('repeated identical turns are not collapsed by a merge', () => {
  const first = [turn('user', 'ok'), turn('user', 'ok')];
  const second = [turn('user', 'ok'), turn('user', 'ok'), turn('user', 'ok')];

  assert.equal(NS.merge.mergeTurnLists(first, second).length, 3);
});

test('mergeAll folds a whole sequence of reads in page order', () => {
  const reads = [
    [turn('user', 'e'), turn('assistant', 'f')],
    [turn('user', 'c'), turn('assistant', 'd'), turn('user', 'e'), turn('assistant', 'f')],
    [turn('user', 'a'), turn('assistant', 'b'), turn('user', 'c'), turn('assistant', 'd'),
     turn('user', 'e'), turn('assistant', 'f')]
  ];

  assert.deepEqual(texts(NS.merge.mergeAll(reads)), ['a', 'b', 'c', 'd', 'e', 'f']);
});

test('an empty sequence merges to nothing', () => {
  assert.deepEqual(NS.merge.mergeAll([]), []);
  assert.deepEqual(NS.merge.mergeAll(undefined), []);
});
