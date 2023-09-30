"use strict";

const { chromium } = require("playwright");
const config = require("../config");
const { BASE_URL } = require("./enums");

module.exports = async (publicKey) => {
  const browser = await chromium.launch({
    headless: false,
    args: [
      "--disable-blink-features=AutomationControlled",
      `--user-agent=${config.playwright.userAgent}`,
    ],
  });
  const page = await browser.newPage();

  await page.route(BASE_URL, (route) =>
    route.fulfill({
      body: `
  <html>
    <head>
      <script>
        var render = (token) => document.body.insertAdjacentHTML('afterend', '<output>' + token + '</output>');
      </script>
    </head>
    <body>
        <div class="g-recaptcha" data-sitekey="${publicKey}" data-callback="render"></div>
        <script src="https://www.google.com/recaptcha/api.js" ></script>
    </body>
  </html>
  `,
    })
  );

  await page.goto(BASE_URL);

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
