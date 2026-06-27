import { describe, it, expect } from 'vitest';
import { haversine } from '../../../core/geo/geodesy.js';
import { createLocomotion } from '../locomotion.js';

const START = { lat: 45.9, lon: 6.8 };

describe('locomotion', () => {
  it('starts on foot with the car at the start point', () => {
    const loco = createLocomotion({ start: START });
    expect(loco.mode).toBe('WALKING');
    expect(loco.inCar).toBe(false);
    expect(haversine(loco.position, START)).toBeCloseTo(0, 6);
    expect(haversine(loco.car, START)).toBeCloseTo(0, 6);
  });

  it('moves forward and leaves the car behind', () => {
    const loco = createLocomotion({ start: START });
    for (let i = 0; i < 60; i++) loco.update(0.1, { forward: 1, turn: 0 });
    expect(haversine(loco.position, START)).toBeGreaterThan(10); // walked away
    expect(haversine(loco.car, START)).toBeCloseTo(0, 6); // car stayed
  });

  it('runs faster than it walks', () => {
    const walk = createLocomotion({ start: START });
    walk.update(1, { forward: 1, turn: 0 });
    const run = createLocomotion({ start: START });
    run.toggleRun();
    run.update(1, { forward: 1, turn: 0 });
    expect(haversine(run.position, START)).toBeGreaterThan(haversine(walk.position, START));
  });

  it('enters the car only when close, then drives much farther than walking', () => {
    const loco = createLocomotion({ start: START });
    loco.update(0.5, { forward: 1, turn: 0 }); // walk ~1 m away (< 12 m)
    loco.enterCar();
    expect(loco.mode).toBe('DRIVING');
    expect(loco.inCar).toBe(true);
    const before = haversine(loco.position, START);
    for (let i = 0; i < 40; i++) loco.update(0.1, { forward: 1, turn: 0 }); // drive 4 s
    expect(haversine(loco.position, START) - before).toBeGreaterThan(40); // far beyond walking
  });

  it('builds speed gradually (inertia) instead of snapping to top speed', () => {
    const loco = createLocomotion({ start: START });
    loco.enterCar();
    loco.update(0.1, { forward: 1, turn: 0 });
    const early = loco.speed;
    for (let i = 0; i < 50; i++) loco.update(0.1, { forward: 1, turn: 0 });
    const late = loco.speed;
    expect(early).toBeGreaterThan(0);
    expect(early).toBeLessThan(late); // still accelerating early on
    expect(late).toBeGreaterThan(20); // approaches drive top speed
  });

  it('coasts to a stop when input is released while driving', () => {
    const loco = createLocomotion({ start: START });
    loco.enterCar();
    for (let i = 0; i < 50; i++) loco.update(0.1, { forward: 1, turn: 0 });
    const moving = loco.speed;
    for (let i = 0; i < 80; i++) loco.update(0.1, { forward: 0, turn: 0 });
    expect(moving).toBeGreaterThan(5);
    expect(loco.speed).toBeLessThan(moving); // decelerated on its own
    expect(loco.speed).toBeCloseTo(0, 1); // came to rest
  });

  it('cannot enter the car from far away', () => {
    const loco = createLocomotion({ start: START });
    for (let i = 0; i < 100; i++) loco.update(0.1, { forward: 1, turn: 0 }); // far
    loco.enterCar();
    expect(loco.mode).toBe('WALKING');
    expect(loco.inCar).toBe(false);
  });

  it('drops the car where you exit, and recall brings it back to you', () => {
    const loco = createLocomotion({ start: START });
    loco.enterCar(); // at start, distance 0
    for (let i = 0; i < 40; i++) loco.update(0.1, { forward: 1, turn: 0 }); // drive off
    loco.exitCar();
    expect(loco.mode).toBe('WALKING');
    expect(haversine(loco.car, START)).toBeGreaterThan(20); // car left here
    for (let i = 0; i < 40; i++) loco.update(0.1, { forward: 1, turn: 0 }); // walk further
    expect(haversine(loco.car, loco.position)).toBeGreaterThan(5);
    loco.recallCar();
    expect(haversine(loco.car, loco.position)).toBeCloseTo(0, 6); // car comes to you
  });

  it('turns the heading', () => {
    const loco = createLocomotion({ start: START });
    const h0 = loco.heading;
    loco.update(1, { forward: 0, turn: 1 });
    expect(loco.heading).not.toBeCloseTo(h0, 6);
  });
});
