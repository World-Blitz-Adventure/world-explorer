import * as THREE from 'three';

const bodyMat = new THREE.MeshLambertMaterial({ color: 0xcc3322, flatShading: true });
const cabinMat = new THREE.MeshLambertMaterial({ color: 0x20262e, flatShading: true });
const wheelMat = new THREE.MeshLambertMaterial({ color: 0x101216, flatShading: true });
const lightMat = new THREE.MeshBasicMaterial({ color: 0xffe7a8 });
const personMat = new THREE.MeshLambertMaterial({ color: 0x2266aa, flatShading: true });

const WHEEL_R = 0.45;

function makeWheel() {
  const g = new THREE.CylinderGeometry(WHEEL_R, WHEEL_R, 0.34, 14);
  g.rotateZ(Math.PI / 2); // axle along X → rolls around X
  return new THREE.Mesh(g, wheelMat);
}

// Car points toward local -z (forward = north at heading 0); length along Z.
function makeCar() {
  const group = new THREE.Group();

  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.6, 4.4), bodyMat);
  body.position.y = 0.78;
  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.45, 1.6), bodyMat);
  hood.position.set(0, 1.05, -1.1);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.62, 2.0), cabinMat);
  cabin.position.set(0, 1.32, 0.25);
  group.add(body, hood, cabin);

  // head- and tail-lights
  for (const x of [-0.7, 0.7]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.18, 0.1), lightMat);
    hl.position.set(x, 0.85, -2.18);
    group.add(hl);
  }

  const wheels = [];
  const steerers = [];
  // [x, z, isFront]
  const spec = [
    [-1.02, -1.35, true],
    [1.02, -1.35, true],
    [-1.02, 1.45, false],
    [1.02, 1.45, false],
  ];
  for (const [x, z, isFront] of spec) {
    const pivot = new THREE.Group(); // steer pivot
    pivot.position.set(x, WHEEL_R, z);
    const wheel = makeWheel();
    pivot.add(wheel);
    group.add(pivot);
    wheels.push(wheel);
    if (isFront) steerers.push(pivot);
  }

  return { group, body, wheels, steerers };
}

function makePerson() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.42, 1.25, 7), personMat);
  body.position.y = 1;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), personMat);
  head.position.y = 1.9;
  g.add(body, head);
  return g;
}

/** Avatars: an animated low-poly car (rolling/steering wheels, lean) and a person. */
export function createAvatars(scene) {
  const car = makeCar();
  const person = makePerson();
  scene.add(car.group, person);

  let roll = 0; // accumulated wheel rotation
  let lean = 0; // smoothed body lean
  let bob = 0; // walk bob phase

  const place = (obj, world, headingRad) => {
    obj.position.set(world.x, world.y, world.z);
    obj.rotation.y = -headingRad;
  };

  return {
    setCar: (world, headingRad) => place(car.group, world, headingRad),
    setPerson: (world, headingRad) => place(person, world, headingRad),
    showCar: (v) => (car.group.visible = v),
    showPerson: (v) => (person.visible = v),

    animateCar({ speed, steer, dt }) {
      roll += (speed * dt) / WHEEL_R;
      for (const w of car.wheels) w.rotation.x = roll;
      const steerAngle = Math.max(-0.5, Math.min(0.5, steer)) * 0.6;
      for (const s of car.steerers) s.rotation.y = steerAngle;
      // body leans into turns, proportional to speed
      const targetLean = -steerAngle * Math.min(1, Math.abs(speed) / 14) * 0.25;
      lean += (targetLean - lean) * Math.min(1, dt * 6);
      car.body.rotation.z = lean;
    },

    animatePerson({ speed, dt }) {
      if (speed > 0.1) {
        bob += dt * speed * 1.6;
        person.position.y += Math.abs(Math.sin(bob)) * 0.08;
      }
    },
  };
}
