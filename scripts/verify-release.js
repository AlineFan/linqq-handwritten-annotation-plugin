"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

for (const file of ["main.js", "manifest.json", "styles.css", "README.md", "LICENSE", "package-lock.json"]) {
  assert.ok(fs.existsSync(file), `Missing required repository file: ${file}`);
}

const maxSyncStandardFileSize = 5_000_000;

const manifest = JSON.parse(fs.readFileSync("manifest.json", "utf8"));
const versions = JSON.parse(fs.readFileSync("versions.json", "utf8"));
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const lock = JSON.parse(fs.readFileSync("package-lock.json", "utf8"));
const styles = fs.readFileSync("styles.css", "utf8");
const main = fs.readFileSync("main.js", "utf8");

assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
assert.equal(pkg.version, manifest.version);
assert.equal(lock.version, manifest.version);
assert.equal(lock.packages[""].version, manifest.version);
assert.equal(versions[manifest.version], manifest.minAppVersion);
assert.match(manifest.description, /^[A-Z].*\.$/);
assert.ok(manifest.description.length <= 250);
assert.match(styles, /font-family: "VA Shantell Sans"/);
assert.match(styles, /font-family: "VA LXGW WenKai Lite"/);
assert.equal((styles.match(/data:font\/woff2;base64,/g) || []).length, 2);
assert.doesNotMatch(styles, /(?:-webkit-)?box-decoration-break\s*:/);
assert.doesNotMatch(styles, /text-decoration(?:-[a-z-]+)?\s*:/);
assert.doesNotMatch(styles, /!important/);
assert.ok(
  fs.statSync("styles.css").size < maxSyncStandardFileSize,
  `styles.css must stay below the Obsidian Sync Standard 5 MB limit; got ${fs.statSync("styles.css").size} bytes`
);
assert.doesNotMatch(main, /installBundledFont/);

console.log(`PASS release verification for ${manifest.id} ${manifest.version}`);
