import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");

assert.ok(existsSync(new URL("wrangler.jsonc", root)), "wrangler.jsonc must exist at repo root");
assert.ok(existsSync(new URL("public/index.html", root)), "public/index.html must exist");
assert.ok(existsSync(new URL("public/assets/maps/map4.png", root)), "SYSU Yingdong map asset map4.png must be deployed");
assert.ok(existsSync(new URL("src/index.js", root)), "Worker entry src/index.js must exist");

const wrangler = read("wrangler.jsonc");
assert.match(wrangler, /"directory"\s*:\s*"\.\/public"/, "wrangler must deploy ./public");
assert.match(wrangler, /"main"\s*:\s*"src\/index\.js"/, "wrangler must use Worker entry");
assert.match(wrangler, /"binding"\s*:\s*"ASSETS"/, "wrangler must bind static assets to ASSETS");
assert.match(wrangler, /keep\.sagvil\.cn/, "wrangler must target keep.sagvil.cn");
assert.doesNotMatch(wrangler, /a17678cff5cfc28837bc3604d001ad3c/, "OpenWeather key must not be committed");

const html = read("public/index.html");
for (const field of [
  "username",
  "totalKm",
  "sportTime",
  "totalTime",
  "cumulativeClimb",
  "averageCadence",
  "exerciseLoad",
]) {
  assert.match(html, new RegExp(`name="${field}"`), `missing editable field: ${field}`);
}

const mapFiles = readdirSync(new URL("public/assets/maps/", root)).filter((name) => name.endsWith(".png"));
for (const mapName of ["default.png", ...Array.from({ length: 20 }, (_, index) => `map${index + 1}.png`)]) {
  assert.ok(mapFiles.includes(mapName), `missing map asset: ${mapName}`);
}

assert.match(html, /value="keep"/, "default username must be keep");
assert.doesNotMatch(html, /郑竣仁|23343093/, "personal username must not be present");
assert.match(html, /assets\/maps\/map4\.png/, "SYSU Yingdong map must be the default map");
assert.match(html, /localStorage\.getItem\("keepFormState"\)/, "site must restore previous form state");
assert.match(html, /localStorage\.setItem\("keepFormState"/, "site must persist form state");
assert.match(html, /\/api\/weather/, "site must request weather through Worker API");
assert.match(html, /downloadScreenshot/, "site must support downloading the generated screenshot");
assert.doesNotMatch(html, /a17678cff5cfc28837bc3604d001ad3c/, "OpenWeather key must not be committed");
assert.doesNotMatch(html, /WiFi|93%/, "generated screenshot must not draw the top status bar");
assert.doesNotMatch(html, /全屏|视频/, "page must not draw a second map control overlay");
assert.doesNotMatch(html, /获得了 1 个跑步路线成绩/, "route achievement row must be removed");
assert.match(html, /async function refreshPreview/, "refresh button must trigger weather and render");
assert.match(html, /查询成功|查询失败/, "weather status must show success or failure");
for (const mapName of ["default", ...Array.from({ length: 20 }, (_, index) => `map${index + 1}`)]) {
  assert.match(html, new RegExp(`/assets/maps/${mapName}\\.png`), `missing map option path: ${mapName}`);
}

const scriptMatch = html.match(/<script>([\s\S]*)<\/script>/);
assert.ok(scriptMatch, "page must include inline app script");
new Function(scriptMatch[1]);

const worker = read("src/index.js");
assert.match(worker, /OPENWEATHER_API_KEY/, "Worker must read OpenWeather key from secret");
assert.match(worker, /onecall\/timemachine/, "Worker must use One Call timemachine endpoint");
assert.match(worker, /env\.ASSETS\.fetch\(request\)/, "Worker must serve static assets");
assert.doesNotMatch(worker, /a17678cff5cfc28837bc3604d001ad3c/, "OpenWeather key must not be committed");

const originalFetch = globalThis.fetch;
let requestedWeatherUrl = "";
globalThis.fetch = async (url) => {
  requestedWeatherUrl = String(url);
  return Response.json({
    data: [
      {
        temp: 29.6,
        weather: [{ description: "多云" }],
      },
    ],
  });
};

const workerModule = await import(new URL("src/index.js", root));
const workerResponse = await workerModule.default.fetch(
  new Request("https://keep.sagvil.cn/api/weather?map=map4&date=2026-05-13&time=21:37"),
  {
    OPENWEATHER_API_KEY: "test-secret",
    ASSETS: { fetch: () => new Response("asset") },
  },
);
assert.equal(workerResponse.status, 200, "weather route should return 200 with a secret");
assert.deepEqual(await workerResponse.json(), { weather: "多云", temperature: "30°C" });
assert.match(requestedWeatherUrl, /onecall\/timemachine/, "weather route should call timemachine endpoint");
assert.match(requestedWeatherUrl, /appid=test-secret/, "weather route should pass the secret to OpenWeather");

const missingSecretResponse = await workerModule.default.fetch(
  new Request("https://keep.sagvil.cn/api/weather?map=map4&date=2026-05-13&time=21:37"),
  {
    ASSETS: { fetch: () => new Response("asset") },
  },
);
assert.equal(missingSecretResponse.status, 500, "weather route should fail clearly without secret");
globalThis.fetch = originalFetch;

console.log("static site checks passed");
