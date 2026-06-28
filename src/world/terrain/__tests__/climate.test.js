import { describe, it, expect } from 'vitest';
import { classifyBiome, BIOME } from '../climate.js';

describe('climate / biomes', () => {
  it('reads the iconic regions right', () => {
    expect(classifyBiome(23, 13, 300)).toBe(BIOME.DESERT); // Sahara
    expect(classifyBiome(-3, -60, 100)).toBe(BIOME.TROPICAL_FOREST); // Amazon
    expect(classifyBiome(14, 0, 300)).toBe(BIOME.SAVANNA); // Sahel
    expect(classifyBiome(65, -110, 200)).toBe(BIOME.BOREAL_FOREST); // Canadian taiga
    expect(classifyBiome(78, -42, 100)).toBe(BIOME.TUNDRA); // high Arctic
  });

  it('puts snow above the snow line and ocean below sea level', () => {
    expect(classifyBiome(46, 8, 3500)).toBe(BIOME.SNOW); // Alps summit
    expect(classifyBiome(20, -40, -50)).toBe(BIOME.OCEAN); // open sea
  });

  it('distinguishes Sahara from Congo at similar longitudes', () => {
    const sahara = classifyBiome(25, 15, 300);
    const congo = classifyBiome(0, 20, 400);
    expect(sahara).toBe(BIOME.DESERT);
    expect(congo).toBe(BIOME.TROPICAL_FOREST);
    expect(sahara).not.toBe(congo);
  });

  it('gives conifer (boreal) forest on mid-elevation Alps', () => {
    expect(classifyBiome(46, 8, 1500)).toBe(BIOME.BOREAL_FOREST);
  });
});
