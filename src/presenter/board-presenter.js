import { render, remove, RenderPosition } from '../framework/render.js';
import SortView from '../view/sort-view.js';
import EventListView from '../view/event-list-view.js';
import ListEmptyView from '../view/list-empty-view.js';
import LoadingView from '../view/loading-view.js';
import EventPresenter from './event-presenter.js';
import { FilterType, SortType, UpdateType, UserAction } from '../const.js';
import { sortEventDay, sortEventprice, sortEventTime } from '../util/sort.js';
import { filter } from '../util/filter.js';
import NewEventPresenter from './new-event-presenter.js';
import NewEventButtonView from '../view/new-event-button-view.js';

export default class BoardPresenter {
  #eventListComponent = null;
  #sortComponent = null;
  #boardContainer = null;
  #eventsModel = null;
  #destinationModel = null;
  #offersModel = null;
  #offers = null;
  #destinations = null;
  #eventPresenter = new Map();
  #currentSortType = SortType.DAY;
  #filterModel = null;
  #emptyComponent = null;
  #loadingComponent = null;
  #newEventPresenter = null;
  #newEventButtonView = null;
  #buttonContainer = null;
  #isLoading = true;

  constructor({
    boardContainer,
    eventsModel,
    destinationModel,
    offersModel,
    filterModel,
    buttonContainer
  }) {
    this.#boardContainer = boardContainer;
    this.#eventsModel = eventsModel;
    this.#destinationModel = destinationModel;
    this.#offersModel = offersModel;
    this.#filterModel = filterModel;
    this.#buttonContainer = buttonContainer;

    this.#eventsModel.addObserver(this.#handleModelEvent);
    this.#filterModel.addObserver(this.#handleModelEvent);
    this.#offersModel.addObserver(this.#handleModelEvent);
    this.#destinationModel.addObserver(this.#handleModelEvent);
  }

  init() {
    this.#offers = this.#offersModel.offers;
    this.#destinations = this.#destinationModel.destinations;
    this.#isLoading = true;

    this.#renderNewEventButton();
    this.#renderBoard();
  }

  #renderLoading() {
    this.#loadingComponent = new LoadingView();
    render(this.#loadingComponent, this.#boardContainer);
  }

  #removeLoading() {
    if (this.#loadingComponent) {
      remove(this.#loadingComponent);
      this.#loadingComponent = null;
    }
  }

  #renderNewEventButton() {
    if (this.#newEventButtonView) {
      return;
    }

    this.#newEventButtonView = new NewEventButtonView({
      onClick: () => {
        this.#createNewEvent();
      }
    });

    render(
      this.#newEventButtonView,
      this.#buttonContainer,
      RenderPosition.AFTEREND
    );
  }

  #getOrCreateEventListContainer() {
    if (this.#eventListComponent && this.#eventListComponent.element) {
      return this.#eventListComponent.element;
    }

    if (this.#emptyComponent) {
      remove(this.#emptyComponent);
      this.#emptyComponent = null;
    }

    this.#eventListComponent = new EventListView();
    render(this.#eventListComponent, this.#boardContainer);

    return this.#eventListComponent.element;
  }

  #resetFiltersAndSorting = () => {
    this.#filterModel.setFilter(UpdateType.MAJOR, FilterType.EVERYTHING);
    this.#currentSortType = SortType.DAY;
  };

  #createNewEvent() {
    this.#eventPresenter.forEach((presenter) => presenter.resetView());

    if (this.#newEventPresenter) {
      return;
    }

    if (this.#newEventButtonView) {
      this.#newEventButtonView.setDisabled(true);
    }

    this.#resetFiltersAndSorting();

    const container = this.#getOrCreateEventListContainer();

    this.#newEventPresenter = new NewEventPresenter({
      eventListContainer: container,
      offers: this.#offers,
      destinations: this.#destinations,
      onDataChange: this.#handleViewAction,
      onDestroy: this.#handleNewEventDestroy,
      onEscape: () => {
        this.#newEventPresenter?.destroy();
      }
    });

    this.#newEventPresenter.init();
  }

  #handleNewEventDestroy = () => {
    this.#newEventPresenter = null;

    if (this.#newEventButtonView) {
      this.#newEventButtonView.setDisabled(false);
    }
  };

  #handleModeChange = () => {
    this.#eventPresenter.forEach((presenter) => presenter.resetView());
  };

  get events() {
    const filterType = this.#filterModel.filter;
    const events = this.#eventsModel.events;

    return filter[filterType](events);
  }

  #handleViewAction = async (actionType, updateType, update) => {
    const actions = {
      [UserAction.UPDATE_EVENT]: () => this.#eventsModel.updateEvent(update),
      [UserAction.ADD_EVENT]: () => this.#eventsModel.addEvent(update),
      [UserAction.DELETE_EVENT]: () => this.#eventsModel.deleteEvent(update.id),
    };

    await actions[actionType]?.();
  };

  #handlePatchUpdate = (data) => {
    const presenter = this.#eventPresenter.get(data.id);

    if (presenter) {
      const destination = this.#destinationModel.getDestinationById(data.destination);
      const offers = this.#offersModel.offers;
      const destinations = this.#destinationModel.destinations;

      presenter.update(data, offers, destination, destinations);
    }
  };

  #handleMinorUpdate = () => {
    this.#currentSortType = SortType.DAY;
    this.#renderBoard();
  };

  #handleMajorUpdate = () => {
    this.#currentSortType = SortType.DAY;
    this.#renderBoard();
  };

  #handleInitUpdate = () => {
    this.#isLoading = false;
    this.#offers = this.#offersModel.offers;
    this.#destinations = this.#destinationModel.destinations;
    this.#renderBoard();
  };

  #handleModelEvent = (updateType, data) => {
    switch (updateType) {
      case UpdateType.PATCH:
        this.#handlePatchUpdate(data);
        break;
      case UpdateType.MINOR:
        this.#handleMinorUpdate();
        break;
      case UpdateType.MAJOR:
        this.#handleMajorUpdate();
        break;
      case UpdateType.INIT:
        this.#handleInitUpdate();
        break;
    }
  };

  #renderSort() {
    this.#sortComponent = new SortView({
      onSortTypeChange: this.#handleSortTypeChange,
      currentSortType: this.#currentSortType
    });

    render(this.#sortComponent, this.#boardContainer);
  }

  #handleSortTypeChange = (sortType) => {
    this.#currentSortType = sortType;
    this.#renderBoard();
  };

  #renderEvent(event, container) {
    const eventPresenter = new EventPresenter({
      eventListContainer: container,
      onDataChange: this.#handleViewAction,
      onModeChange: this.#handleModeChange,
    });

    const destination = this.#destinationModel.getDestinationById(event.destination);
    const offers = this.#offersModel.offers;
    const destinations = this.#destinationModel.destinations;

    eventPresenter.init({
      event,
      offers: offers,
      destination: destination,
      destinations: destinations
    });

    this.#eventPresenter.set(event.id, eventPresenter);
  }

  #renderEventList() {
    this.#offers = this.#offersModel.offers;
    this.#destinations = this.#destinationModel.destinations;

    const sortedEvents = this.#getSortedEvents(this.#currentSortType);

    sortedEvents.forEach((event) => {
      this.#renderEvent(event, this.#eventListComponent.element);
    });
  }

  #clearEventList() {
    this.#eventPresenter.forEach((presenter) => presenter.destroy());
    this.#eventPresenter.clear();

    if (this.#newEventPresenter) {
      this.#newEventPresenter.destroy();
      this.#newEventPresenter = null;
    }

    if (this.#sortComponent) {
      remove(this.#sortComponent);
      this.#sortComponent = null;
    }

    if (this.#eventListComponent) {
      remove(this.#eventListComponent);
      this.#eventListComponent = null;
    }

    if (this.#emptyComponent) {
      remove(this.#emptyComponent);
      this.#emptyComponent = null;
    }

    if (this.#loadingComponent) {
      remove(this.#loadingComponent);
      this.#loadingComponent = null;
    }
  }

  #renderBoard = () => {
    this.#offers = this.#offersModel.offers;
    this.#destinations = this.#destinationModel.destinations;

    this.#clearEventList();

    if (this.#isLoading) {
      this.#renderLoading();
      return;
    }

    this.#removeLoading();

    if (this.events.length === 0) {
      this.#emptyComponent = new ListEmptyView(this.#filterModel.filter);
      render(this.#emptyComponent, this.#boardContainer);
      return;
    }

    this.#renderSort();

    this.#eventListComponent = new EventListView();
    render(this.#eventListComponent, this.#boardContainer);

    this.#renderEventList();
  };

  #getSortedEvents(sortType) {
    const sortFunctions = {
      [SortType.price]: sortEventprice,
      [SortType.TIME]: sortEventTime,
      [SortType.DAY]: sortEventDay,
    };

    const sortFunction = sortFunctions[sortType] || sortEventDay;
    return [...this.events].sort(sortFunction);
  }

  destroy() {
    if (this.#newEventButtonView) {
      remove(this.#newEventButtonView);
      this.#newEventButtonView = null;
    }
    this.#clearEventList();
  }
}
