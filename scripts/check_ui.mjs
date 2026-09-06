import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs";

const OUT_DIR = "/home/claude/semanticode/screenshots";
fs.mkdirSync(OUT_DIR, { recursive: true });

const BASE_URL = "http://localhost:4173/";
const errors = [];

const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const page = await browser.newPage({ viewport: { width: 380, height: 720 } });

page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(`[console] ${msg.text()}`);
});
page.on("pageerror", (err) => errors.push(`[pageerror] ${err.message}`));

await page.goto(BASE_URL, { waitUntil: "networkidle" });
await page.waitForSelector(".sc-app");

async function shot(name) {
  await page.screenshot({ path: path.join(OUT_DIR, `${name}.png`) });
  console.log(`captured ${name}`);
}

// 1. Welcome screen (initial, not-indexed)
await shot("01-welcome-not-indexed");

// 2. Index Workspace -> indexing screen, wait for animation to progress then complete
await page.click('button:has-text("Index Workspace")');
await page.waitForTimeout(400);
await shot("02-indexing-in-progress");
await page.waitForSelector(".sc-status--success", { timeout: 8000 });
await shot("03-indexing-complete");

// 3. Continue to Search
await page.click('button:has-text("Continue to Search")');
await page.waitForSelector(".sc-search-form");
await shot("04-search-empty");

// 4. Type a query and search
await page.fill('input[type="search"]', "Where is JWT authentication implemented?");
await page.click(".sc-search-submit");
await page.waitForSelector(".sc-results__list", { timeout: 4000 });
await shot("05-search-results");

// 5. Open a result -> code preview
await page.click(".sc-result__main >> nth=0");
await page.waitForSelector(".sc-preview");
await shot("06-code-preview");

// 6. Click Open in Editor (toast)
await page.click('button:has-text("Open in Editor")');
await page.waitForSelector(".sc-toast");
await shot("07-open-in-editor-toast");
await page.click('button[aria-label="Close preview"]');

// 7. Workspace screen
await page.click('button[title="Workspace"]');
await page.waitForSelector(".sc-workspace-card");
await shot("08-workspace");

// 8. History screen
await page.click('button[title="History"]');
await page.waitForSelector(".sc-history");
await shot("09-history");

// 9. Search Again from history
await page.click('button:has-text("Search Again") >> nth=0');
await page.waitForSelector(".sc-results__list", { timeout: 4000 });
await shot("10-history-search-again");

// 10. Settings screen
await page.click('button[title="Settings"]');
await page.waitForSelector(".sc-settings");
await shot("11-settings");

// change topK and toggle a language checkbox to exercise inputs
await page.fill("#topk-input", "15");
await page.click('label:has-text("Go") input[type="checkbox"]');
await shot("12-settings-edited");

// 11. Empty query validation state
await page.click('button[title="Search"]');
await page.waitForSelector(".sc-search-form");
await page.fill('input[type="search"]', "ab");
await shot("13-search-validation-error");

// 12. Clear Index from workspace screen
await page.click('button[title="Workspace"]');
await page.click('button:has-text("Clear Index")');
await shot("14-workspace-cleared");

await browser.close();

const report = {
  consoleErrors: errors,
  screenshotCount: fs.readdirSync(OUT_DIR).length,
};
fs.writeFileSync(path.join(OUT_DIR, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));

if (errors.length > 0) {
  console.error("CONSOLE ERRORS DETECTED");
  process.exit(1);
}
