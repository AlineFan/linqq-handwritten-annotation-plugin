"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const css = fs.readFileSync(path.join(__dirname, "..", "styles.css"), "utf8");
const main = fs.readFileSync(path.join(__dirname, "..", "main.js"), "utf8");
const manifest = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "manifest.json"), "utf8")
);

assert.equal(manifest.name, "linqq-handwritten annotation");
assert.equal(manifest.id, "visual-annotations");
assert.equal(manifest.version, "0.6.11");
assert.equal(manifest.description, "Add colorful handwritten-style annotations.");
assert.doesNotMatch(main, /linqq-handwritten annotation 设置/);
assert.doesNotMatch(main, /containerEl\.createEl\("h[1-6]"/);

assert.match(css, /\.modal\.va-modal-shell\s*\{[^}]*width:\s*min\(52rem,/s);
assert.match(css, /\.va-note-input\s*\{[^}]*box-sizing:\s*border-box;/s);
assert.match(
  css,
  /\.va-annotation-rail button\.va-rail-note\s*\{[^}]*white-space:\s*normal;/s
);
assert.match(css, /\.va-rail-note-text\s*\{[^}]*overflow-wrap:\s*anywhere;/s);
assert.match(css, /\.va-rail-note-text\s*\{[^}]*VA LXGW WenKai Lite/s);
assert.match(css, /font-family:\s*"VA Shantell Sans"/);
assert.match(css, /font-family:\s*"VA LXGW WenKai Lite"/);
assert.match(css, /data:font\/woff2;base64,/);
assert.match(css, /\.va-rail-note-text\s*\{[^}]*font-synthesis:\s*none;/s);
assert.doesNotMatch(
  css.match(/\.va-rail-note-text\s*\{[^}]*\}/s)?.[0] || "",
  /text-overflow:\s*ellipsis|white-space:\s*nowrap/
);
assert.match(
  main,
  /async \(\{ note, color \}\) => \{\s*this\.clearRenderedSelection\(selectionDoc\);/s
);
assert.doesNotMatch(main, /installBundledFont|LXGWWenKaiLite-Light\.woff2/);
assert.match(main, /target\.getClientRects\(\)/);
assert.match(main, /node\.getAttribute\("data-va-id"\) === item\.dataset\.vaId/);
assert.match(main, /noteButton\.append\(noteText, arrow\)/);
assert.match(main, /--va-marker-x/);
assert.match(main, /--va-arrow-shift/);
assert.doesNotMatch(main, /--va-arrow-x|--va-label-x/);
assert.match(
  css,
  /span\.va-annotation-rail\.va-editor-rail,[\s\S]*span\.va-annotation-rail\.va-reading-rail\s*\{[^}]*display:\s*block;/s
);
assert.doesNotMatch(css, /(?:-webkit-)?box-decoration-break\s*:/);
assert.doesNotMatch(css, /text-decoration(?:-[a-z-]+)?\s*:/);
assert.doesNotMatch(css, /!important/);
assert.doesNotMatch(css, /\.va-annotation-rail\s*\{[^}]*flex-direction:\s*column;/s);
assert.match(css, /\.va-rail-item\s*\{[^}]*position:\s*absolute;/s);
assert.match(css, /\.va-rail-item\s*\{[^}]*top:\s*var\(--va-lane-y,/s);
assert.match(
  css,
  /\.va-annotation-rail\.va-side-bottom \.va-rail-arrow\s*\{[^}]*rotate\(180deg\)/s
);
assert.match(main, /distributeAnnotations\(annotations\)/);
assert.match(main, /container\.append\(/);
assert.match(main, /rail\.style\.height = `\$\{railHeight\}px`/);
assert.match(main, /--va-lane-y/);
assert.match(main, /const horizontalGap = 20;/);
assert.match(main, /annotation\.preferredSide === "top"/);
assert.match(main, /preferredSide: topDistance <= bottomDistance \? "top" : "bottom"/);
assert.match(main, /scheduleRenderedAnnotationRails\(container, items, context\.sourcePath\)/);
assert.match(main, /view\.requestAnimationFrame\(render\)/);
assert.match(main, /--va-arrow-length/);
assert.match(main, /rects\[rects\.length - 1\]/);
assert.doesNotMatch(css, /\.va-bottom-rail/);
assert.match(css, /M23 4 C22 13 22 24 23 35/);
assert.match(css, /M17 29 L23 36 L29 29/);
assert.doesNotMatch(css, /C18\.5 11 27\.5 20/);
assert.match(css, /height:\s*var\(--va-arrow-length, 38px\)/);
assert.match(css, /mask-size:\s*100% 100%/);
assert.match(
  css,
  /\.va-annotation-rail\.va-side-top\s*\{[^}]*margin-bottom:\s*0\.2rem;/s
);
assert.match(
  css,
  /\.va-annotation-rail\.va-side-bottom\s*\{[^}]*margin-top:\s*0\.2rem;/s
);

console.log("PASS visual annotation UI regression tests");
