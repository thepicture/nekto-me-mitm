"use strict";

class Heartbeat {
  #life;

  live = (callback, millisecondsInterval) => {
    this.#life = setInterval(callback, millisecondsInterval);
  };

  die = () => {
    clearInterval(this.#life);
  };
}

module.exports = Heartbeat;
