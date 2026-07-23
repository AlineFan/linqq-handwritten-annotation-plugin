"use strict";

const COLORS = ["amber", "blue", "green", "red", "purple"];
const PLACEMENTS = ["auto", "top", "bottom", "left", "right"];

const ANNOTATION_SOURCE =
  '<span class="va-annotation va-color-(' +
  COLORS.join("|") +
  ') va-place-(' +
  PLACEMENTS.join("|") +
  ')" data-va-note="([^"]*)"(?: data-va-id="([^"]*)")?>([\\s\\S]*?)<\\/span>';

function annotationRegex() {
  return new RegExp(ANNOTATION_SOURCE, "g");
}

function escapeAttribute(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function decodeAttribute(value) {
  return String(value)
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function buildAnnotation(text, note, color, placement = "auto", id = "") {
  if (!COLORS.includes(color)) throw new Error(`Unsupported color: ${color}`);
  if (!PLACEMENTS.includes(placement)) {
    throw new Error(`Unsupported placement: ${placement}`);
  }
  const idAttribute = id ? ` data-va-id="${escapeAttribute(id)}"` : "";
  return `<span class="va-annotation va-color-${color} va-place-${placement}" data-va-note="${escapeAttribute(note)}"${idAttribute}>${text}</span>`;
}

function annotationFromMatch(match) {
  return {
    start: match.index,
    end: match.index + match[0].length,
    full: match[0],
    color: match[1],
    placement: match[2],
    note: decodeAttribute(match[3]),
    id: decodeAttribute(match[4] || ""),
    text: match[5]
  };
}

function findAnnotationAtOffset(source, offset) {
  const regex = annotationRegex();
  let match;
  while ((match = regex.exec(source)) !== null) {
    const annotation = annotationFromMatch(match);
    if (offset >= annotation.start && offset <= annotation.end) return annotation;
  }
  return null;
}

function findAnnotationOverlappingRange(source, startOffset, endOffset) {
  const regex = annotationRegex();
  let match;
  while ((match = regex.exec(source)) !== null) {
    const annotation = annotationFromMatch(match);
    if (startOffset < annotation.end && endOffset > annotation.start) return annotation;
  }
  return null;
}

function findAnnotationByIdentity(source, identity) {
  const regex = annotationRegex();
  let match;
  let fallback = null;
  while ((match = regex.exec(source)) !== null) {
    const annotation = annotationFromMatch(match);
    if (identity.id && annotation.id === identity.id) return annotation;
    if (
      !fallback &&
      annotation.text === identity.text &&
      annotation.note === identity.note &&
      annotation.color === identity.color
    ) {
      fallback = annotation;
    }
  }
  return fallback;
}

function distributeAnnotations(annotations) {
  const distributed = { top: [], bottom: [] };
  const ordered = [...annotations].sort(
    (a, b) =>
      Number(a.anchorRatio ?? 0.5) - Number(b.anchorRatio ?? 0.5) ||
      Number(a.start ?? 0) - Number(b.start ?? 0)
  );
  const unmeasuredAutomatic = ordered.filter(
    (annotation) =>
      annotation.placement !== "top" &&
      annotation.placement !== "left" &&
      annotation.placement !== "bottom" &&
      annotation.placement !== "right" &&
      annotation.preferredSide !== "top" &&
      annotation.preferredSide !== "bottom"
  );
  const topUnmeasuredCount = Math.ceil(unmeasuredAutomatic.length / 2);
  let unmeasuredIndex = 0;

  for (const annotation of ordered) {
    let side;
    if (annotation.placement === "top" || annotation.placement === "left") {
      side = "top";
    } else if (annotation.placement === "bottom" || annotation.placement === "right") {
      side = "bottom";
    } else if (annotation.preferredSide === "top" || annotation.preferredSide === "bottom") {
      side = annotation.preferredSide;
    } else {
      side = unmeasuredIndex < topUnmeasuredCount ? "top" : "bottom";
      unmeasuredIndex += 1;
    }
    distributed[side].push(annotation);
  }
  return distributed;
}

module.exports = {
  COLORS,
  PLACEMENTS,
  annotationRegex,
  buildAnnotation,
  decodeAttribute,
  distributeAnnotations,
  escapeAttribute,
  findAnnotationAtOffset,
  findAnnotationByIdentity,
  findAnnotationOverlappingRange
};
