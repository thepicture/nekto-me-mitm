"use strict";

const Bot = require("./lib/bot");
const Heartbeat = require("./lib/heartbeat");

const bot1 = new Bot(new Heartbeat(), "selenium");
const bot2 = new Bot(new Heartbeat(), "selenium");

[
  [bot1, bot2],
  [bot2, bot1],
].forEach(([you, me]) => {
  you.on("typing", me.type);
  you.on("sending", me.send);
});
