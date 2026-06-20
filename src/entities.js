export class EntityManager {
  #scene;
  #registry = new Map();

  constructor(scene) {
    this.#scene = scene;
  }

  add(name, object) {
    object.name = object.name || name;
    this.#scene.add(object);
    this.#registry.set(name, object);
    return object;
  }

  get(name) {
    return this.#registry.get(name);
  }

  getAll() {
    return this.#registry;
  }
}
