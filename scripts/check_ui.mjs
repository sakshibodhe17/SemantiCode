// Automated UI check: serves the built webview (frontend/extension/webview)
// in a normal browser using the browser-preview host, clicks through every
// screen, saves screenshots and fails on any console error.
//
//   cd scripts && npm install && npx playwright install chromium
//   node check_ui.mjs
import { chromium } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.resolve(here, "../frontend/extension/webview");
const out = path.resolve(here, "../screenshots");
fs.mkdirSync(out, { recursive: true });
const html = `<!doctype html><html><head><meta charset="UTF-8"><link rel="stylesheet" href="main.css"></head><body><div id="root"></div><script type="module" src="main.js"></script></body></html>`;

const server = http
  .createServer((req, res) => {
    if (req.url === "/") return res.writeHead(200, { "Content-Type": "text/html" }), res.end(html);
    const f = path.join(dist, decodeURIComponent(req.url));
    fs.readFile(f, (e, d) => {
      if (e) return res.writeHead(404), res.end();
      res.writeHead(200, { "Content-Type": f.endsWith(".js") ? "text/javascript" : "text/css" });
      res.end(d);
    });
  })
  .listen(4317);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 380, height: 760 } });
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(e.message));
const shot = (n) => page.screenshot({ path: path.join(out, `${n}.png`) });

await page.goto("http://localhost:4317/");
await page.waitForSelector(".sc-app");
await shot("01-welcome");
await page.click('button:has-text("Index Workspace")');
await page.waitForSelector('button:has-text("Continue to Search")', { timeout: 5000 });
await shot("02-indexed");
await page.click('button:has-text("Continue to Search")');
await page.fill('input[type="search"]', "where is the jwt token verified");
await page.click('button[type="submit"]');
await page.waitForSelector(".sc-result", { timeout: 5000 });
await shot("03-results");
await page.click(".sc-result__main");
await page.waitForSelector(".sc-preview");
await shot("04-preview");
await page.click('button:has-text("Open in Editor")');
await page.click('button[title="History"]');
await page.waitForSelector(".sc-history__item");
await shot("05-history");
await page.click('button[title="Settings"]');
await page.waitForSelector("#engine-select");
await shot("06-settings");
await page.click('button[title="Workspace"]');
await shot("07-workspace");
await page.click('button:has-text("Clear Index")');
await page.click('button[title="Search"]');
await page.waitForSelector("text=Index this workspace first");

await browser.close();
server.close();
if (errors.length) {
  console.error("Console errors:\n" + errors.join("\n"));
  process.exit(1);
}
console.log("UI check passed — screenshots in /screenshots, no console errors.");
