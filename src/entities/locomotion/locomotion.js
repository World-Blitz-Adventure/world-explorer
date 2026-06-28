import { makeProjection } from '../../core/geo/projection.js';
import { haversine } from '../../core/geo/geodesy.js';

const SPEED = { WALKING: 2.5, RUNNING: 6, DRIVING: 28 }; // m/s top speed
// On foot: snappy (high accel + friction). Driving: builds up and coasts (inertia).
const ACCEL = { WALKING: 14, RUNNING: 14, DRIVING: 7 };
const FRICTION = { WALKING: 18, RUNNING: 18, DRIVING: 3.5 };
const TURN_ON_FOOT = 2.4; // rad/s
const TURN_DRIVING = 1.2;
const ENTER_DISTANCE_M = 12;

/** Land locomotion: walk / run / drive with inertia, leave and recall the car. */
export function createLocomotion({ start, isBlocked }) {
  const blocked = isBlocked || (() => false);
  const state = {
    mode: 'WALKING',
    position: { ...start },
    heading: 0, // radians, 0 = north
    speed: 0, // current m/s, signed
    inCar: false,
    car: { ...start, heading: 0 },
  };

  function step(dt, input) {
    const turnRate = state.mode === 'DRIVING' ? TURN_DRIVING : TURN_ON_FOOT;
    state.heading += (input.turn || 0) * turnRate * dt;

    // Ramp speed toward the input target with acceleration; coast on friction.
    const target = (input.forward || 0) * SPEED[state.mode];
    const rate = (input.forward ? ACCEL : FRICTION)[state.mode] * dt;
    if (state.speed < target) state.speed = Math.min(target, state.speed + rate);
    else if (state.speed > target) state.speed = Math.max(target, state.speed - rate);

    if (Math.abs(state.speed) > 1e-4) {
      const dist = state.speed * dt;
      const east = Math.sin(state.heading) * dist;
      const north = Math.cos(state.heading) * dist;
      const next = makeProjection(state.position).toLatLon(east, north);
      if (blocked(next.lat, next.lon)) {
        state.speed *= 0.15; // hit a wall — stop dead
      } else {
        state.position.lat = next.lat;
        state.position.lon = next.lon;
        if (state.inCar) {
          state.car.lat = next.lat;
          state.car.lon = next.lon; // the car carries you while driving
          state.car.heading = state.heading;
        }
      }
    }
  }

  return {
    get mode() { return state.mode; },
    get position() { return state.position; },
    get heading() { return state.heading; },
    get speed() { return state.speed; },
    get inCar() { return state.inCar; },
    get car() { return state.car; },
    update: step,
    toggleRun() {
      if (state.mode === 'WALKING') state.mode = 'RUNNING';
      else if (state.mode === 'RUNNING') state.mode = 'WALKING';
    },
    enterCar() {
      if (state.inCar) return;
      if (haversine(state.position, state.car) <= ENTER_DISTANCE_M) {
        state.inCar = true;
        state.mode = 'DRIVING';
        state.speed = 0; // start from a stop
      }
    },
    exitCar() {
      if (!state.inCar) return;
      state.inCar = false;
      state.mode = 'WALKING';
      state.speed = 0; // step out at rest
      state.car = { lat: state.position.lat, lon: state.position.lon, heading: state.heading };
    },
    recallCar() {
      state.car = { lat: state.position.lat, lon: state.position.lon, heading: state.heading };
    },
  };
}
