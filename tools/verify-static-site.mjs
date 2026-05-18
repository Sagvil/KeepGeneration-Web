import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");

assert.ok(existsSync(new URL("wrangler.jsonc", root)), "wrangler.jsonc must exist at repo root");
assert.ok(existsSync(new URL("public/index.html", root)), "public/index.html must exist");
assert.ok(existsSync(new URL("public/assets/maps/map4.png", root)), "SYSU Yingdong map asset map4.png must be deployed");

const wrangler = read("wrangler.jsonc");
assert.match(wrangler, /"directory"\s*:\s*"\.\/public"/, "wrangler must deploy ./public");
assert.match(wrangler, /keep\.sagvil\.cn/, "wrangler must target keep.sagvil.cn");

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

assert.match(html, /assets\/maps\/map4\.png/, "SYSU Yingdong map must be the default map");
assert.match(html, /downloadScreenshot/, "site must support downloading the generated screenshot");

console.log("static site checks passed");
