import { describe, it, expect } from 'vitest';
import { createTileCache } from '../tileCache.js';

describe('LRU tile cache', () => {
  it('stores and retrieves values', () => {
    const c = createTileCache(2);
    c.set('a', 1);
    expect(c.has('a')).toBe(true);
    expect(c.get('a')).toBe(1);
    expect(c.size).toBe(1);
  });

  it('evicts the least-recently-used entry past capacity', () => {
    const c = createTileCache(2);
    c.set('a', 1);
    c.set('b', 2);
    c.set('c', 3); // evicts 'a'
    expect(c.has('a')).toBe(false);
    expect(c.has('b')).toBe(true);
    expect(c.has('c')).toBe(true);
    expect(c.size).toBe(2);
  });

  it('get() bumps recency so the entry survives eviction', () => {
    const c = createTileCache(2);
    c.set('a', 1);
    c.set('b', 2);
    c.get('a'); // 'a' is now most recent
    c.set('c', 3); // evicts 'b', not 'a'
    expect(c.has('a')).toBe(true);
    expect(c.has('b')).toBe(false);
  });

  it('re-setting an existing key updates value and recency', () => {
    const c = createTileCache(2);
    c.set('a', 1);
    c.set('b', 2);
    c.set('a', 9); // 'a' most recent, value updated
    c.set('c', 3); // evicts 'b'
    expect(c.get('a')).toBe(9);
    expect(c.has('b')).toBe(false);
  });
});
