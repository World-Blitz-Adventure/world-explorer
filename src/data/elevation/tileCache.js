/**
 * A small Map-backed LRU cache. Insertion order in a Map tracks recency:
 * deleting then re-setting a key moves it to the most-recent position.
 * @param {number} capacity max resident entries
 */
export function createTileCache(capacity) {
  const map = new Map();
  return {
    get capacity() {
      return capacity;
    },
    get size() {
      return map.size;
    },
    has(key) {
      return map.has(key);
    },
    get(key) {
      if (!map.has(key)) return undefined;
      const value = map.get(key);
      map.delete(key);
      map.set(key, value); // bump to most-recent
      return value;
    },
    set(key, value) {
      if (map.has(key)) map.delete(key);
      map.set(key, value);
      while (map.size > capacity) {
        map.delete(map.keys().next().value); // drop least-recent
      }
    },
    keys() {
      return [...map.keys()];
    },
  };
}
