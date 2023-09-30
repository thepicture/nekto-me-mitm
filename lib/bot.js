"use strict";

const W3CWebSocket = require("websocket").w3cwebsocket;
const { spawn } = require("node:child_process");
const { EventEmitter } = require("node:events");
const {
  DESKTOP,
  BASE_URL,
  PROTOCOLS,
  USER_AGENT,
  HEARTBEAT_INTERVAL,
} = require("./enums");
const solveCaptcha = require("./captcha");
const { generateFingerprint, generateRandomId } = require("./generators");

class Bot extends EventEmitter {
  #client;
  #tactic;

  #yourId;
  #dialogId;

  #heartbeat;
  #authToken;

  constructor(heartbeat, tactic) {
    super();

    this.#tactic = tactic;
    this.#heartbeat = heartbeat;

    const client = new W3CWebSocket(
      "wss://im.nekto.me/socket.io/?EIO=3&transport=websocket",
      PROTOCOLS,
      BASE_URL,
      {
        "user-agent": USER_AGENT,
      }
    );

    this.#client = client;

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

        console.log("SERVER:", body);

        this[notice]?.(body);
      }
    };
  }

  type = () => {
    this.#behave({
      action: "dialog.setTyping",
      dialogId: this.#dialogId,
      typing: true,
      voice: false,
    });
  };

  send = (message) => {
    this.#behave({
      action: "anon.message",
      dialogId: this.#dialogId,
      message,
      randomId: generateRandomId(this.#yourId),
      fileId: null,
    });
  };

  #behave = (body) => {
    console.log("CLIENT:", body);

    this.#client.send(`42${JSON.stringify(["action", body])}`);
  };

  "auth.successToken" = ({ tokenInfo: { authToken } }) => {
    this.#authToken = authToken;

    this.#behave({
      action: "auth.setFpt",
      token: this.#authToken,
      fpt: generateFingerprint,
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
          ]).stdout.on("data", (binary) => {
            this.#behave({
              action: "captcha.verify",
              solution: Buffer.from(binary, "utf-8"),
              hard: false,
            });
          });

          break;
        case "playwright":
          this.#behave({
            action: "captcha.verify",
            solution: await solveCaptcha(body.additional.publicKey),
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
    this.#dialogId = id;
  };

  "dialog.closed" = () => {
    this.#behave({ action: "search.run" });
  };

  "messages.new" = ({ message }) => {
    this.emit("sending", message);
  };

  "dialog.typing" = () => {
    this.emit("typing");
  };
}

module.exports = Bot;
