import { makeProjection } from '../../core/geo/projection.js';
import { haversine } from '../../core/geo/geodesy.js';

const SPEED = { WALKING: 2.5, RUNNING: 6, DRIVING: 28 }; // m/s
const TURN_ON_FOOT = 2.4; // rad/s
const TURN_DRIVING = 1.2;
const ENTER_DISTANCE_M = 12;

/** Land locomotion: walk / run / drive, leave and recall the car. */
export function createLocomotion({ start }) {
  const state = {
    mode: 'WALKING',
    position: { ...start },
    heading: 0, // radians, 0 = north
    inCar: false,
    car: { ...start },
  };

  function step(dt, input) {
    const turnRate = state.mode === 'DRIVING' ? TURN_DRIVING : TURN_ON_FOOT;
    state.heading += (input.turn || 0) * turnRate * dt;
    const fwd = input.forward || 0;
    if (fwd !== 0) {
      const dist = fwd * SPEED[state.mode] * dt;
      const east = Math.sin(state.heading) * dist;
      const north = Math.cos(state.heading) * dist;
      const next = makeProjection(state.position).toLatLon(east, north);
      state.position.lat = next.lat;
      state.position.lon = next.lon;
      if (state.inCar) {
        state.car.lat = next.lat;
        state.car.lon = next.lon; // the car carries you while driving
      }
    }
  }

  return {
    get mode() { return state.mode; },
    get position() { return state.position; },
    get heading() { return state.heading; },
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
      }
    },
    exitCar() {
      if (!state.inCar) return;
      state.inCar = false;
      state.mode = 'WALKING';
      state.car = { ...state.position };
    },
    recallCar() {
      state.car = { ...state.position };
    },
  };
}
