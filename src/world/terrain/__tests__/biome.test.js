import { describe, it, expect } from 'vitest';
import { biomeColor } from '../biome.js';

describe('biome palette', () => {
  it('colors water below sea level (bluish)', () => {
    const [r, g, b] = biomeColor(-5, 0, 0);
    expect(b).toBeGreaterThan(r); // blue dominant
  });

  it('colors low flat land green-ish, not blue', () => {
    const [r, g, b] = biomeColor(200, 0, 0);
    expect(g).toBeGreaterThan(b); // green dominant
  });

  it('caps high elevation toward snow (bright) at high latitude', () => {
    const [r, g, b] = biomeColor(2500, 0, 75);
    expect(Math.min(r, g, b)).toBeGreaterThan(0.8); // near-white
  });

  it('does not snow at the same elevation near the equator', () => {
    const cold = biomeColor(2500, 0, 75);
    const warm = biomeColor(2500, 0, 0);
    expect(Math.min(...warm)).toBeLessThan(Math.min(...cold));
  });

  it('pulls steep slopes toward rock (desaturated/darker than flat grass)', () => {
    const flat = biomeColor(200, 0, 0);
    const steep = biomeColor(200, 1, 0);
    expect(steep).not.toEqual(flat);
  });
});
