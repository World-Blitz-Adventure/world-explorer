import { describe, it, expect } from 'vitest';
import { tileUrl, DEFAULT_URL_TEMPLATE } from '../tileUrl.js';

describe('tile url', () => {
  it('points at the verified terrarium endpoint', () => {
    expect(DEFAULT_URL_TEMPLATE).toContain('elevation-tiles-prod/terrarium');
    expect(DEFAULT_URL_TEMPLATE).toContain('{z}/{x}/{y}');
  });

  it('substitutes z/x/y', () => {
    expect(tileUrl(DEFAULT_URL_TEMPLATE, 10, 535, 400)).toBe(
      'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/10/535/400.png'
    );
  });

  it('works with a custom template', () => {
    expect(tileUrl('/tiles/{z}-{x}-{y}', 3, 1, 2)).toBe('/tiles/3-1-2');
  });
});
