import * as THREE from 'three';

function makeCar() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(4.4, 1.3, 2),
    new THREE.MeshLambertMaterial({ color: 0xcc3322, flatShading: true })
  );
  body.position.y = 1;
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 1, 1.7),
    new THREE.MeshLambertMaterial({ color: 0x222831, flatShading: true })
  );
  cabin.position.set(-0.2, 2, 0);
  g.add(body, cabin);
  return g;
}

function makePerson() {
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: 0x2266aa, flatShading: true });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 1.3, 6), mat);
  body.position.y = 1;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 6), mat);
  head.position.y = 1.95;
  g.add(body, head);
  return g;
}

/** Two positioned-by-caller avatars in the scene. */
export function createAvatars(scene) {
  const car = makeCar();
  const person = makePerson();
  scene.add(car, person);

  const place = (obj, world, headingRad) => {
    obj.position.set(world.x, world.y, world.z);
    obj.rotation.y = -headingRad; // heading 0 = north (-z)
  };

  return {
    setCar: (world, headingRad) => place(car, world, headingRad),
    setPerson: (world, headingRad) => place(person, world, headingRad),
    showCar: (v) => (car.visible = v),
    showPerson: (v) => (person.visible = v),
  };
}
