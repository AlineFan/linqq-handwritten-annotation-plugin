"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

for (const file of ["main.js", "manifest.json", "styles.css", "README.md", "LICENSE"]) {
  assert.ok(fs.existsSync(file), `Missing required repository file: ${file}`);
}

const manifest = JSON.parse(fs.readFileSync("manifest.json", "utf8"));
const versions = JSON.parse(fs.readFileSync("versions.json", "utf8"));
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const styles = fs.readFileSync("styles.css", "utf8");
const main = fs.readFileSync("main.js", "utf8");

assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
assert.equal(pkg.version, manifest.version);
assert.equal(versions[manifest.version], manifest.minAppVersion);
assert.match(manifest.description, /^[A-Z].*\.$/);
assert.ok(manifest.description.length <= 250);
assert.match(styles, /font-family: "VA Shantell Sans"/);
assert.match(styles, /font-family: "VA LXGW WenKai Lite"/);
assert.equal((styles.match(/data:font\/woff2;base64,/g) || []).length, 2);
assert.doesNotMatch(main, /installBundledFont/);

console.log(`PASS release verification for ${manifest.id} ${manifest.version}`);
