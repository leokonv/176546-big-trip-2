import Observable from '../framework/observable.js';
import { UpdateType } from '../const.js';

export default class DestinationModel extends Observable {
  #destinationsApiService = null;
  #destinations = [];

  constructor({ destinationsApiService }) {
    super();
    this.#destinationsApiService = destinationsApiService;
  }

  async init() {
    try {
      this.#destinations = await this.#destinationsApiService.destinations;
      this._notify(UpdateType.INIT, this.#destinations);
      return this.#destinations;
    } catch(error) {
      this.#destinations = [];
      this._notify(UpdateType.INIT, this.#destinations);
      return this.#destinations;
    }
  }

  get destinations() {
    return this.#destinations;
  }

  getDestinationById(id) {
    return this.#destinations.find((destination) => destination.id === id);
  }
}
