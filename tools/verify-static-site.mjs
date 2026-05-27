import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");

assert.ok(existsSync(new URL("wrangler.jsonc", root)), "wrangler.jsonc must exist at repo root");
assert.ok(existsSync(new URL("public/index.html", root)), "public/index.html must exist");
assert.ok(existsSync(new URL("public/assets/maps/map4.png", root)), "SYSU Yingdong map asset map4.png must be deployed");
assert.ok(existsSync(new URL("public/assets/status-icons.png", root)), "cropped phone status icons asset must be deployed");
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
  "stride",
]) {
  assert.match(html, new RegExp(`name="${field}"`), `missing editable field: ${field}`);
}

const mapFiles = readdirSync(new URL("public/assets/maps/", root)).filter((name) => name.endsWith(".png"));
for (const mapName of ["default.png", ...Array.from({ length: 20 }, (_, index) => `map${index + 1}.png`)]) {
  assert.ok(mapFiles.includes(mapName), `missing map asset: ${mapName}`);
}

assert.match(html, /value="keep"/, "default username must be keep");
assert.doesNotMatch(html, /23343093/, "personal username must not be present");
assert.match(html, /assets\/maps\/map4\.png/, "SYSU Yingdong map must be the default map");
assert.match(html, /localStorage\.getItem\("keepFormState"\)/, "site must restore previous form state");
assert.match(html, /localStorage\.setItem\("keepFormState"/, "site must persist form state");
assert.match(html, /\/api\/weather/, "site must request weather through Worker API");
assert.match(html, /downloadScreenshot/, "site must support downloading the generated screenshot");
assert.doesNotMatch(html, /a17678cff5cfc28837bc3604d001ad3c/, "OpenWeather key must not be committed");
assert.doesNotMatch(html, /WiFi|93%/, "generated screenshot must not draw the top status bar");
assert.doesNotMatch(html, /全屏|视频/, "page must not draw a second map control overlay");
assert.doesNotMatch(html, /text\("慢"/, "page must not draw a duplicate slow label over the map");
assert.doesNotMatch(html, /text\("快"/, "page must not draw a duplicate fast label over the map");
assert.doesNotMatch(html, /获得了 1 个跑步路线成绩/, "route achievement row must be removed");
assert.match(html, /async function refreshPreview/, "refresh button must trigger weather and render");
assert.match(html, /查询成功|查询失败/, "weather status must show success or failure");
assert.match(html, /function deriveRunData/, "site must derive dependent run metrics from authoritative inputs");
assert.match(html, /function buildSplitRows/, "site must build segment rows from total distance and sport time");
assert.match(html, /calculateStartTime/, "site must derive start time from end time and total duration");
assert.match(html, /function calculateStatusTime/, "site must derive the phone status bar time from the run end time");
assert.match(html, /function drawStatusBar/, "site must draw a phone status bar in the generated screenshot");
assert.match(html, /assets\/status-icons\.png/, "site must draw the original right-side phone status icons from an asset");
assert.match(html, /ctx\.drawImage\(statusIcons,\s*500,\s*0,\s*560,\s*92\)/, "status icon asset must be drawn uncropped at the top right");
assert.match(html, /roundedRect\(635,\s*92,\s*145,\s*72/, "top privacy control must sit below the status bar");
assert.doesNotMatch(html, /function drawBattery/, "site must not hand-draw the right-side phone status icons");
assert.doesNotMatch(html, /function drawWifi/, "site must not hand-draw the right-side phone status icons");
assert.match(html, /toBlob/, "download must use canvas.toBlob for mobile compatibility");
assert.match(html, /navigator\.share/, "download must use native sharing when mobile browsers support file sharing");
assert.match(html, /URL\.createObjectURL/, "download must fallback to an object URL when native sharing is unavailable");
assert.match(html, /function isMobileSaveHost/, "download must detect mobile browsers that block synthetic downloads");
assert.match(html, /function isIosSafari/, "download must detect iOS Safari explicitly");
assert.match(html, /if \(isIosSafari\(\)\)/, "iOS Safari must bypass synthetic downloads and use the save page");
assert.match(html, /Quark/, "download must explicitly handle Quark browser save fallback");
assert.match(html, /function prepareSavePage/, "download must pre-open a save page before async image generation");
assert.match(html, /FileReader/, "download fallback must convert the generated blob into an image page for long-press saving");
assert.match(html, /长按图片保存/, "download fallback must give mobile users a long-press save page");
assert.doesNotMatch(html, /"power",\s*"stride"/, "manual stride edits must not be overwritten during render sync");
for (const mapName of ["default", ...Array.from({ length: 20 }, (_, index) => `map${index + 1}`)]) {
  assert.match(html, new RegExp(`/assets/maps/${mapName}\\.png`), `missing map option path: ${mapName}`);
}

const scriptMatch = html.match(/<script>([\s\S]*)<\/script>/);
assert.ok(scriptMatch, "page must include inline app script");
new Function(scriptMatch[1]);

const helperBlock = scriptMatch[1].match(/function clamp[\s\S]*?async function fetchWeather/)?.[0].replace(/\s*async function fetchWeather$/, "");
assert.ok(helperBlock, "helper functions must be testable as a block");
const helpers = new Function(`${helperBlock}; return { calculateStartTime, calculateStatusTime, deriveRunData, buildSplitRows, parseClockTime, parseHms };`)();
assert.equal(helpers.calculateStartTime("21:37", "00:24:04"), "21:12", "start time must be end time minus total duration");
const statusDelta = helpers.parseClockTime(helpers.calculateStatusTime("21:37", "2026-05-15")) - helpers.parseClockTime("21:37");
assert.ok([180, 240, 300].includes(statusDelta), "status time must be 3-5 minutes after end time");
const wrappedStatusDelta = helpers.parseClockTime(helpers.calculateStatusTime("23:58", "2026-05-15")) - helpers.parseClockTime("23:58");
assert.ok([180, 240, 300, -86220, -86160, -86100].includes(wrappedStatusDelta), "status time must be 3-5 minutes after end time with midnight wrap");

const derivedRun = helpers.deriveRunData({
  totalKm: "3.50",
  sportTime: "00:24:04",
  totalTime: "00:24:04",
  endTime: "21:37",
  stride: "1.23",
});
assert.equal(derivedRun.pace, "06'53''", "pace must be derived from sport time and total distance");
assert.equal(derivedRun.stride, "1.23", "manual stride input must be preserved");
assert.equal(derivedRun.splitRows.length, 4, "3.5 km must render 4 segment rows");
assert.equal(derivedRun.splitRows.at(-1).distance, 0.5, "last segment for 3.5 km must be 0.5 km");
assert.equal(
  Number(derivedRun.splitRows.reduce((sum, row) => sum + row.distance, 0).toFixed(2)),
  3.5,
  "segment distances must add up to total distance",
);
assert.equal(
  derivedRun.splitRows.reduce((sum, row) => sum + helpers.parseHms(row.time), 0),
  helpers.parseHms(derivedRun.sportTime),
  "segment times must add up to sport time",
);

const worker = read("src/index.js");
assert.match(worker, /OPENWEATHER_API_KEY/, "Worker must read OpenWeather key from secret");
assert.match(worker, /onecall\/timemachine/, "Worker must use One Call timemachine endpoint");
assert.match(worker, /env\.ASSETS\.fetch\(request\)/, "Worker must serve static assets");
assert.doesNotMatch(worker, /api\.open-meteo\.com\/v1\/forecast/, "Worker must not query forecast weather");
assert.match(worker, /archive-api\.open-meteo\.com/, "Worker must query only Open-Meteo archive data");
assert.match(worker, /23\.096/, "Worker must include Yingdong Sports Center latitude data");
assert.match(worker, /113\.29/, "Worker must include Yingdong Sports Center longitude data");
assert.doesNotMatch(worker, /a17678cff5cfc28837bc3604d001ad3c/, "OpenWeather key must not be committed");

const originalFetch = globalThis.fetch;
let requestedWeatherUrl = "";
function openMeteoMock() {
  return Response.json({
    hourly: {
      time: ["2026-05-13T21:00"],
      temperature_2m: [28.4],
      weather_code: [3],
      precipitation_probability: [0],
      precipitation: [0],
    },
  });
}
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
assert.deepEqual(await workerResponse.json(), { weather: "多云", temperature: "30°C", source: "openweather" });
assert.match(requestedWeatherUrl, /onecall\/timemachine/, "weather route should call timemachine endpoint");
assert.match(requestedWeatherUrl, /appid=test-secret/, "weather route should pass the secret to OpenWeather");

requestedWeatherUrl = "";
globalThis.fetch = async (url) => {
  requestedWeatherUrl = String(url);
  return openMeteoMock();
};
const missingSecretResponse = await workerModule.default.fetch(
  new Request("https://keep.sagvil.cn/api/weather?map=map4&date=2026-05-13&time=21:37"),
  {
    ASSETS: { fetch: () => new Response("asset") },
  },
);
assert.equal(missingSecretResponse.status, 200, "weather route should use archive without OpenWeather secret");
assert.equal((await missingSecretResponse.json()).source, "open-meteo-archive");
assert.match(String(requestedWeatherUrl), /archive-api\.open-meteo\.com/, "missing-secret route should query Open-Meteo archive");
assert.doesNotMatch(String(requestedWeatherUrl), /api\.open-meteo\.com\/v1\/forecast/, "missing-secret route must not query Open-Meteo forecast");
assert.match(String(requestedWeatherUrl), /precipitation_probability/, "Open-Meteo fallback must request precipitation probability");
assert.match(String(requestedWeatherUrl), /precipitation/, "Open-Meteo fallback must request precipitation amount");

globalThis.fetch = async () => Response.json({
  hourly: {
    time: ["2026-05-27T21:00"],
    temperature_2m: [29.3],
    weather_code: [95],
    precipitation_probability: [7],
    precipitation: [0],
  },
});
const lowRainThunderstormResponse = await workerModule.default.fetch(
  new Request("https://keep.sagvil.cn/api/weather?map=map4&date=2026-05-27&time=21:37"),
  {
    ASSETS: { fetch: () => new Response("asset") },
  },
);
assert.equal(lowRainThunderstormResponse.status, 200, "low-rain thunderstorm forecast should still return weather");
assert.deepEqual(
  await lowRainThunderstormResponse.json(),
  { weather: "多云", temperature: "29°C", source: "open-meteo-archive", openWeatherStatus: "missing_secret" },
  "Open-Meteo thunderstorm code with near-zero precipitation must not be shown as thunderstorm",
);

let openWeatherFallbackCalls = [];
globalThis.fetch = async (url) => {
  openWeatherFallbackCalls.push(String(url));
  if (openWeatherFallbackCalls.length === 1) {
    return Response.json({ code: 401, message: "Invalid API key" }, { status: 401 });
  }
  return openMeteoMock();
};
const fallbackResponse = await workerModule.default.fetch(
  new Request("https://keep.sagvil.cn/api/weather?map=map4&date=2026-05-13&time=21:37"),
  {
    OPENWEATHER_API_KEY: "bad-one-call-key",
    ASSETS: { fetch: () => new Response("asset") },
  },
);
assert.equal(fallbackResponse.status, 200, "weather route should fallback when OpenWeather rejects the key");
assert.deepEqual(await fallbackResponse.json(), { weather: "多云", temperature: "28°C", source: "open-meteo-archive", openWeatherStatus: 401 });
assert.equal(openWeatherFallbackCalls.length, 2, "OpenWeather rejection should call only OpenWeather and Open-Meteo archive");
assert.match(openWeatherFallbackCalls[1], /archive-api\.open-meteo\.com/, "OpenWeather rejection should fallback to Open-Meteo archive");
assert.doesNotMatch(openWeatherFallbackCalls.join("\n"), /api\.open-meteo\.com\/v1\/forecast/, "OpenWeather rejection must not query forecast");
globalThis.fetch = originalFetch;

console.log("static site checks passed");
