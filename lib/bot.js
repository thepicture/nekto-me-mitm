"use strict";

const randomUseragent = require("random-useragent");
const W3CWebSocket = require("websocket").w3cwebsocket;
const { HttpsProxyAgent } = require("https-proxy-agent");
const { spawn } = require("node:child_process");
const { EventEmitter } = require("node:events");
const config = require("../config");
const solveCaptcha = require("./captcha");
const { generateRandomId } = require("./generators");
const {
  DESKTOP,
  BASE_URL,
  PROTOCOLS,
  REQUEST_OPTIONS,
  HEARTBEAT_INTERVAL,
} = require("./enums");
const dotenv = require("dotenv");

dotenv.config();

class Bot extends EventEmitter {
  #name;
  #client;
  #tactic;

  #yourId;
  #dialogId;

  #heartbeat;
  #authToken;

  constructor(heartbeat, tactic, name) {
    super();

    this.#name = name;
    this.#tactic = tactic;
    this.#heartbeat = heartbeat;

    const client = new W3CWebSocket(
      "wss://im.nekto.me/socket.io/?EIO=3&transport=websocket",
      PROTOCOLS,
      BASE_URL,
      {
        "user-agent":
          config.websocket.userAgent === "random"
            ? randomUseragent.getRandom()
            : config.websocket.userAgent,
      },
      REQUEST_OPTIONS,
      {
        tlsOptions: {
          agent: new HttpsProxyAgent(process.env.PROXY),
        },
      }
    );

    this.#client = client;

    client.onerror = () => {
      throw "Dead proxy";
    };

    client.onopen = () => {
      this.#behave({
        action: "auth.getToken",
        deviceType: DESKTOP,
      });

      this.#heartbeat.live(() => client.send("2"), HEARTBEAT_INTERVAL);
    };
    client.onclose = this.#heartbeat.die;
    client.onmessage = ({ data }) => {
      const isMessageWithBody = data?.startsWith("42");

      if (isMessageWithBody) {
        const [, { data: body, notice }] = JSON.parse(data.slice(2));

        this[notice]?.(body);
      }
    };
  }

  type = () => {
    if (!this.#dialogId) {
      return;
    }

    console.log(`[${this.#name}] CLIENT TYPING`);

    this.#behave({
      action: "dialog.setTyping",
      dialogId: this.#dialogId,
      typing: true,
      voice: false,
    });
  };

  send = (message) => {
    if (!this.#dialogId) {
      return;
    }

    console.log(`[${this.#name}] CLIENT:`, message);

    this.#behave({
      action: "anon.message",
      dialogId: this.#dialogId,
      message,
      randomId: generateRandomId(this.#yourId),
      fileId: null,
    });
  };

  #behave = (body) => {
    this.#client.send(`42${JSON.stringify(["action", body])}`);
  };

  "auth.successToken" = ({ tokenInfo: { authToken }, id }) => {
    this.#yourId = id;
    this.#authToken = authToken;

    this.#behave({
      action: "auth.setFpt",
      token: this.#authToken,
      fpt: authToken,
    });
    this.#behave({ action: "search.run" });
  };

  "error.code" = async (body) => {
    if ("additional" in body) {
      switch (this.#tactic) {
        case "selenium":
          spawn("python3", [
            "bin/captcha.py",
            body.additional.publicKey,
            config.selenium.userAgent,
          ]).stdout.on("data", (binary) => {
            this.#behave({
              action: "captcha.verify",
              solution: binary.toString("utf8"),
              hard: false,
            });
          });

          break;
        case "playwright":
          this.#behave({
            action: "captcha.verify",
            solution: await solveCaptcha(),
            hard: false,
          });

          break;
      }
    }
  };

  "captcha.verify" = ({ solution }) => {
    if (solution) {
      this.#behave({ action: "search.run" });
    }
  };

  "dialog.opened" = async ({ id }) => {
    console.log(`[${this.#name}] DIALOG OPENED`);

    this.#dialogId = id;
  };

  "dialog.closed" = () => {
    console.log(`[${this.#name}] DIALOG CLOSED`);

    this.#behave({ action: "search.run" });
  };

  "messages.new" = ({ message, randomId }) => {
    this.emit("sending", message, randomId);
  };

  "dialog.typing" = () => {
    this.emit("typing");
  };
}

module.exports = Bot;
