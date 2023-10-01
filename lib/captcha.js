"use strict";

const { chromium } = require("playwright");
const https = require("node:https");
const config = require("../config");
const { BASE_URL } = require("./enums");

module.exports = async () => {
  const browser = await chromium.launch({
    headless: false,
    args: [
      "--disable-blink-features=AutomationControlled",
      `--user-agent=${config.playwright.userAgent}`,
    ],
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(0);

  await page.route(`**/*`, (route) => {
    const url = route.request().url();

    if (url.includes("yandex")) {
      route.abort();

      return;
    }

    return !url.includes("google") &&
      ["image", "font"].includes(route.request().resourceType())
      ? route.abort()
      : route.continue();
  });

  await page.route("**/chunk-1189c00a.2341254e.js", async (route) => {
    const body = await new Promise((resolve, reject) =>
      https
        .get(route.request().url(), (response) => {
          response.setEncoding("utf8");

          let body = "";

          response.on("data", (chunk) => {
            body += chunk;
          });

          response.on("end", () => {
            resolve(body);
          });
        })
        .on("error", reject)
    );

    const patched = body.replace(
      "this.$socketActions.recaptchaSolution(e)",
      "document.body.insertAdjacentHTML('beforebegin', `<output>${e}</output>`);"
    );

    if (patched.length === body.length) {
      throw new Error("Patching js failed");
    }

    route.fulfill({
      body: patched,
    });
  });

  await page.goto(`${BASE_URL}/chat/#/searching`);

  const frame = await page.waitForSelector("iframe");
  const content = await frame.contentFrame();

  const checkbox = await content.waitForSelector("#recaptcha-anchor");
  await checkbox.click();

  const tokenSelector = "output";
  await page.waitForSelector(tokenSelector);
  const element = await page.$(tokenSelector);

  const token = await page.evaluate((el) => el.textContent, element);

  browser.close();

  return token;
};
