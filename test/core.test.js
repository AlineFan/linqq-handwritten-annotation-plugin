"use strict";

const assert = require("node:assert/strict");
const {
  buildAnnotation,
  distributeAnnotations,
  findAnnotationAtOffset,
  findAnnotationByIdentity,
  findAnnotationOverlappingRange
} = require("../annotation-core");

const threeAutomatic = distributeAnnotations([
  { id: "purple", placement: "auto", anchorRatio: 0.12 },
  { id: "amber", placement: "auto", anchorRatio: 0.38 },
  { id: "blue", placement: "auto", anchorRatio: 0.78 }
]);
assert.deepEqual(threeAutomatic.top.map(({ id }) => id), ["purple", "amber"]);
assert.deepEqual(threeAutomatic.bottom.map(({ id }) => id), ["blue"]);

const explicitPlacement = distributeAnnotations([
  { id: "forced-bottom", placement: "bottom", anchorRatio: 0.05 },
  { id: "early-auto", placement: "auto", anchorRatio: 0.2 },
  { id: "late-auto", placement: "auto", anchorRatio: 0.8 }
]);
assert.deepEqual(explicitPlacement.top.map(({ id }) => id), ["early-auto"]);
assert.deepEqual(explicitPlacement.bottom.map(({ id }) => id), ["forced-bottom", "late-auto"]);

const sameFirstLine = distributeAnnotations([
  { id: "note-1", placement: "auto", preferredSide: "top", anchorRatio: 0.25 },
  { id: "note-2", placement: "auto", preferredSide: "top", anchorRatio: 0.72 }
]);
assert.deepEqual(sameFirstLine.top.map(({ id }) => id), ["note-1", "note-2"]);
assert.deepEqual(sameFirstLine.bottom.map(({ id }) => id), []);

const finalLine = distributeAnnotations([
  { id: "final-line-note", placement: "auto", preferredSide: "bottom", anchorRatio: 0.76 }
]);
assert.deepEqual(finalLine.top.map(({ id }) => id), []);
assert.deepEqual(finalLine.bottom.map(({ id }) => id), ["final-line-note"]);

const wrapped = buildAnnotation("13 条高价值内容", '最终筛选 "A"', "blue", "top");
assert.equal(
  wrapped,
  '<span class="va-annotation va-color-blue va-place-top" data-va-note="最终筛选 &quot;A&quot;">13 条高价值内容</span>'
);

const source = `前文 ${wrapped} 后文`;
const inside = source.indexOf("高价值");
const found = findAnnotationAtOffset(source, inside);
assert.ok(found);
assert.equal(found.text, "13 条高价值内容");
assert.equal(found.note, '最终筛选 "A"');
assert.equal(found.color, "blue");
assert.equal(found.placement, "top");

const overlap = findAnnotationOverlappingRange(
  source,
  source.indexOf("13 条"),
  source.indexOf("内容") + 2
);
assert.ok(overlap);
assert.equal(overlap.full, wrapped);

assert.equal(findAnnotationAtOffset(source, 0), null);
assert.throws(() => buildAnnotation("x", "n", "pink", "top"), /Unsupported color/);
assert.throws(() => buildAnnotation("x", "n", "blue", "center"), /Unsupported placement/);

const automatic = buildAnnotation("正文", "自动位置", "green", "auto", "va-test-1");
assert.equal(
  automatic,
  '<span class="va-annotation va-color-green va-place-auto" data-va-note="自动位置" data-va-id="va-test-1">正文</span>'
);
const automaticFound = findAnnotationByIdentity(`前 ${automatic} 后`, {
  id: "va-test-1",
  text: "正文",
  note: "自动位置",
  color: "green"
});
assert.ok(automaticFound);
assert.equal(automaticFound.id, "va-test-1");
assert.equal(automaticFound.placement, "auto");

const legacyFound = findAnnotationByIdentity(source, {
  id: "",
  text: "13 条高价值内容",
  note: '最终筛选 "A"',
  color: "blue"
});
assert.ok(legacyFound);
assert.equal(legacyFound.id, "");

console.log("PASS annotation-core tests");
