"use strict";

const Bot = require("./lib/bot");
const Heartbeat = require("./lib/heartbeat");

const bot1 = new Bot(new Heartbeat(), "playwright", "bot1");
const bot2 = new Bot(new Heartbeat(), "playwright", "bot2");

[
  [bot1, bot2],
  [bot2, bot1],
].forEach(([you, me]) => {
  you.on("typing", me.type);
  you.on("sending", (message, randomId) => {
    if (randomId.includes("_")) {
      return;
    }

    me.send(message);
  });
});
