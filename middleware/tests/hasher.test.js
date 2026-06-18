'use strict';
const { canonicalStringify, sha256Hex, hashObject } = require('../engine/hasher');

describe('Hasher canonique (principe T5)', () => {
  test('ordre des cles indifferent -> meme canonique', () => {
    const a = { b: 1, a: 2, c: { y: 1, x: 2 } };
    const b = { c: { x: 2, y: 1 }, a: 2, b: 1 };
    expect(canonicalStringify(a)).toBe(canonicalStringify(b));
    expect(hashObject(a)).toBe(hashObject(b));
  });

  test('une modification change le hash (avalanche)', () => {
    expect(hashObject({ amount: 50000 })).not.toBe(hashObject({ amount: 50001 }));
  });

  test('dates serialisees en ISO stable', () => {
    expect(canonicalStringify({ t: new Date('2026-03-15T10:00:00Z') }))
      .toBe('{"t":"2026-03-15T10:00:00.000Z"}');
  });

  test('sha256Hex deterministe et longueur 64', () => {
    expect(sha256Hex('abc')).toBe(sha256Hex('abc'));
    expect(sha256Hex('abc')).toHaveLength(64);
  });
});