"use strict";

const assert = require("node:assert/strict");
const Module = require("node:module");

class Plugin {
  constructor(app) {
    this.app = app;
    this.commands = [];
    this.domEvents = [];
    this.editorExtensions = [];
  }
  async loadData() { return {}; }
  async saveData() {}
  addCommand(command) { this.commands.push(command); }
  addRibbonIcon() {}
  registerEvent() {}
  registerDomEvent(target, type, handler) {
    this.domEvents.push({ target, type, handler });
  }
  registerEditorExtension(extension) { this.editorExtensions.push(extension); }
  registerMarkdownPostProcessor() {}
  addSettingTab() {}
}

class Modal {
  constructor(app) { this.app = app; }
  open() {}
  close() {}
}
class Notice {}
class Setting {}
class PluginSettingTab {
  constructor(app, plugin) {
    this.app = app;
    this.plugin = plugin;
  }
}
class MarkdownView {}
class Menu {}
const editorInfoField = {};

class WidgetType {}
const Decoration = {
  none: {},
  set(items) { return { items }; },
  widget(config) {
    return {
      range(position) { return { config, position }; }
    };
  }
};
const EditorView = {
  decorations: { from(field) { return field; } },
  domEventHandlers(handlers) { return handlers; }
};
const StateField = { define(spec) { return { spec }; } };

const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "obsidian") {
    return {
      Plugin,
      Modal,
      Notice,
      Setting,
      PluginSettingTab,
      MarkdownView,
      Menu,
      editorInfoField
    };
  }
  if (request === "@codemirror/view") {
    return { Decoration, EditorView, WidgetType };
  }
  if (request === "@codemirror/state") {
    return { StateField };
  }
  return originalLoad.call(this, request, parent, isMain);
};

async function run() {
  try {
    let interfaceLanguage = "en";
    global.window = {
      innerWidth: 1200,
      setTimeout() { return 1; },
      clearTimeout() {},
      requestAnimationFrame() {},
      localStorage: {
        getItem(key) {
          return key === "language" ? interfaceLanguage : null;
        }
      }
    };
    const PluginClass = require("../main.js");
    const app = {
      workspace: {
        on() { return {}; },
        onLayoutReady() {},
        getActiveViewOfType() { return null; },
        getLeavesOfType() { return []; }
      }
    };
    const plugin = new PluginClass(app);
    await plugin.onload();
    assert.equal(plugin.commands.length, 3);
    assert.equal(plugin.editorExtensions.length, 1);
    assert.deepEqual(
      plugin.commands.map(({ name }) => name),
      [
        "Add a handwritten annotation to selected text",
        "Edit the annotation at the selection or cursor",
        "Remove the annotation at the selection or cursor (keep text)"
      ]
    );
    assert.equal(plugin.t("modal.addTitle"), "Add annotation");
    assert.equal(plugin.t("colors.green"), "Green");

    interfaceLanguage = "zh-CN";
    const chinesePlugin = new PluginClass(app);
    await chinesePlugin.onload();
    assert.deepEqual(
      chinesePlugin.commands.map(({ name }) => name),
      ["为所选文字添加手写批注", "编辑所选或光标处的批注", "删除所选或光标处的批注（保留正文）"]
    );
    assert.equal(chinesePlugin.t("modal.addTitle"), "添加批注");
    assert.equal(chinesePlugin.t("colors.green"), "绿色");
    assert.equal(
      chinesePlugin.t("accessibility.target", { text: "测试正文" }),
      "批注对象：测试正文"
    );

    const containerRect = { left: 100, top: 200, right: 900, bottom: 260, width: 800, height: 60 };
    const firstLineMetrics = plugin.measureRenderedTarget(
      {
        getClientRects() {
          return [{ left: 180, top: 200, right: 300, bottom: 220, width: 120, height: 20 }];
        }
      },
      containerRect
    );
    assert.equal(firstLineMetrics.preferredSide, "top");
    assert.equal(firstLineMetrics.anchorRatio, 0.175);

    const finalLineMetrics = plugin.measureRenderedTarget(
      {
        getClientRects() {
          return [{ left: 620, top: 240, right: 780, bottom: 260, width: 160, height: 20 }];
        }
      },
      containerRect
    );
    assert.equal(finalLineMetrics.preferredSide, "bottom");
    assert.equal(finalLineMetrics.anchorRatio, 0.75);

    const stateFieldExtension = plugin.editorExtensions[0][0];
    const annotatedSource =
      '<span class="va-annotation va-color-blue va-place-auto" data-va-note="测试" data-va-id="va-test">正文</span>';
    const singleDecorations = stateFieldExtension.spec.create({
        doc: {
          toString() { return annotatedSource; },
          lineAt() { return { from: 0, to: annotatedSource.length }; }
        },
        field() { return { file: { path: "test.md" } }; }
      });
    assert.equal(singleDecorations.items.length, 1);

    const early =
      '<span class="va-annotation va-color-blue va-place-auto" data-va-note="前部" data-va-id="va-early">开头</span>';
    const late =
      '<span class="va-annotation va-color-green va-place-auto" data-va-note="后部" data-va-id="va-late">除这一梯</span>';
    const splitSource = `${early} 中间正文用于拉开位置 ${late}度。`;
    const splitDecorations = stateFieldExtension.spec.create({
      doc: {
        toString() { return splitSource; },
        lineAt() { return { from: 0, to: splitSource.length }; }
      },
      field() { return { file: { path: "test.md" } }; }
    });
    assert.equal(splitDecorations.items.length, 2);
    assert.equal(splitDecorations.items[0].position, 0);
    assert.equal(splitDecorations.items[0].config.widget.placement, "top");
    assert.equal(splitDecorations.items[0].config.widget.annotations[0].id, "va-early");
    assert.equal(splitDecorations.items[1].position, splitSource.length);
    assert.equal(splitDecorations.items[1].config.widget.placement, "bottom");
    assert.equal(splitDecorations.items[1].config.widget.annotations[0].id, "va-late");

    const firstLineOne =
      '<span class="va-annotation va-color-amber va-place-auto" data-va-note="注释1" data-va-id="va-first-1">The plugin places handwritten labels in</span>';
    const firstLineTwo =
      '<span class="va-annotation va-color-blue va-place-auto" data-va-note="注释2" data-va-id="va-first-2">dedicated layout rails above and</span>';
    const sameFirstLineSource =
      `${firstLineOne} ${firstLineTwo} below a paragraph with enough trailing text to wrap across several visual lines.`;
    const sameFirstLineDecorations = stateFieldExtension.spec.create({
      doc: {
        toString() { return sameFirstLineSource; },
        lineAt() { return { from: 0, to: sameFirstLineSource.length }; }
      },
      field() { return { file: { path: "test.md" } }; }
    });
    assert.equal(sameFirstLineDecorations.items.length, 1);
    assert.equal(sameFirstLineDecorations.items[0].config.widget.placement, "top");
    assert.deepEqual(
      sameFirstLineDecorations.items[0].config.widget.annotations.map(({ id }) => id),
      ["va-first-1", "va-first-2"]
    );

    const finalLineTarget =
      '<span class="va-annotation va-color-blue va-place-auto" data-va-note="末行" data-va-id="va-final-line">或者目标文本需要跨越多行显示时也是如此。</span>';
    const finalLineSource =
      `该插件会在段落上下方添加手写标签。这里有足够长的前置正文用于形成多行显示，${finalLineTarget}`;
    const finalLineDecorations = stateFieldExtension.spec.create({
      doc: {
        toString() { return finalLineSource; },
        lineAt() { return { from: 0, to: finalLineSource.length }; }
      },
      field() { return { file: { path: "test.md" } }; }
    });
    assert.equal(finalLineDecorations.items.length, 1);
    assert.equal(finalLineDecorations.items[0].config.widget.placement, "bottom");
    assert.equal(
      finalLineDecorations.items[0].config.widget.annotations[0].id,
      "va-final-line"
    );

    const positionedStyles = new Map();
    const target = {
      isConnected: true,
      getClientRects() { return [{ left: 680, width: 80 }]; },
      getBoundingClientRect() { return { left: 680, width: 80 }; }
    };
    const positionedItem = {
      dataset: { vaAnchorRatio: "0.5", vaId: "va-late" },
      _vaTargetElement: target,
      style: {
        setProperty(name, value) { positionedStyles.set(name, value); }
      },
      querySelector(selector) {
        return selector === ".va-rail-note"
          ? { getBoundingClientRect() { return { width: 100 }; } }
          : null;
      },
      getBoundingClientRect() { return { left: 100, width: 800, height: 68 }; }
    };
    const positionedRail = {
      isConnected: true,
      dataset: { vaPlacement: "top" },
      style: {},
      getBoundingClientRect() { return { left: 100, top: 0, width: 800, height: 72 }; },
      querySelectorAll(selector) {
        return selector === ".va-rail-item" ? [positionedItem] : [];
      }
    };
    plugin.layoutAnnotationRail(positionedRail);
    assert.equal(positionedStyles.get("--va-marker-x"), "620px");
    assert.equal(positionedStyles.get("--va-arrow-shift"), "0px");
    assert.equal(positionedStyles.get("--va-arrow-length"), "38px");
    assert.equal(positionedStyles.get("--va-connector-offset"), "0px");
    assert.equal(positionedStyles.has("--va-arrow-x"), false);
    assert.equal(positionedStyles.has("--va-label-x"), false);
    assert.equal(positionedStyles.get("--va-lane-y"), "0px");
    assert.equal(positionedRail.style.height, "72px");
    assert.equal(positionedRail.style.minHeight, "72px");

    const leftStyles = new Map();
    const leftTarget = {
      isConnected: true,
      getClientRects() { return [{ left: 180, width: 80 }]; },
      getBoundingClientRect() { return { left: 180, width: 80 }; }
    };
    const leftItem = {
      dataset: { vaAnchorRatio: "0.15", vaId: "va-early" },
      _vaTargetElement: leftTarget,
      style: { setProperty(name, value) { leftStyles.set(name, value); } },
      querySelector(selector) {
        return selector === ".va-rail-note"
          ? { getBoundingClientRect() { return { width: 100 }; } }
          : null;
      },
      getBoundingClientRect() { return { left: 100, width: 800, height: 68 }; }
    };
    positionedRail.querySelectorAll = (selector) =>
      selector === ".va-rail-item" ? [leftItem, positionedItem] : [];
    plugin.layoutAnnotationRail(positionedRail);
    assert.equal(leftItem.dataset.vaLane, "0");
    assert.equal(positionedItem.dataset.vaLane, "0");
    assert.equal(positionedRail.style.height, "72px");

    leftTarget.getClientRects = () => [{ left: 680, width: 80 }];
    plugin.layoutAnnotationRail(positionedRail);
    assert.deepEqual(
      [leftItem.dataset.vaLane, positionedItem.dataset.vaLane].sort(),
      ["0", "1"]
    );
    assert.equal(positionedRail.style.height, "144px");
    assert.equal(leftStyles.get("--va-arrow-length"), "38px");
    assert.equal(positionedStyles.get("--va-arrow-length"), "110px");

    positionedRail.dataset.vaPlacement = "bottom";
    plugin.layoutAnnotationRail(positionedRail);
    assert.equal(leftStyles.get("--va-arrow-length"), "38px");
    assert.equal(leftStyles.get("--va-connector-offset"), "0px");
    assert.equal(positionedStyles.get("--va-arrow-length"), "110px");
    assert.equal(positionedStyles.get("--va-connector-offset"), "-72px");

    target.getClientRects = () => [
      { left: 180, width: 80 },
      { left: 680, width: 80 }
    ];
    positionedRail.querySelectorAll = (selector) =>
      selector === ".va-rail-item" ? [positionedItem] : [];
    plugin.layoutAnnotationRail(positionedRail);
    assert.equal(positionedStyles.get("--va-marker-x"), "620px");
    assert.equal(positionedStyles.get("--va-arrow-shift"), "0px");

    positionedRail.dataset.vaPlacement = "top";
    target.getClientRects = () => [{ left: 860, width: 80 }];
    positionedItem.querySelector = (selector) =>
      selector === ".va-rail-note"
        ? { getBoundingClientRect() { return { width: 300 }; } }
        : null;
    positionedRail.querySelectorAll = (selector) =>
      selector === ".va-rail-item" ? [positionedItem] : [];
    plugin.layoutAnnotationRail(positionedRail);
    assert.equal(positionedStyles.get("--va-marker-x"), "650px");
    assert.equal(positionedStyles.get("--va-arrow-shift"), "150px");

    const scheduledFrames = [];
    const insertedRails = [];
    const readingView = {
      requestAnimationFrame(callback) {
        scheduledFrames.push(callback);
      }
    };
    const readingContainer = {
      isConnected: false,
      children: [],
      ownerDocument: { defaultView: readingView },
      getBoundingClientRect() {
        return { left: 100, top: 200, right: 900, bottom: 240, width: 800, height: 40 };
      },
      prepend(rail) {
        insertedRails.push(["top", rail]);
      },
      append(rail) {
        insertedRails.push(["bottom", rail]);
      }
    };
    const readingAnnotation = {
      textContent: "正文",
      classList: {
        contains(value) {
          return value === "va-color-blue" || value === "va-place-auto";
        }
      },
      getAttribute(name) {
        return {
          "data-va-id": "va-reading-test",
          "data-va-note": "阅读批注"
        }[name] || "";
      }
    };
    plugin.measureRenderedTarget = () => ({
      anchorRatio: 0.4,
      preferredSide: "top"
    });
    plugin.createAnnotationRail = (annotations, sourcePath, doc, mode, placement) => ({
      annotations,
      sourcePath,
      doc,
      mode,
      placement
    });
    plugin.scheduleRenderedAnnotationRails(
      readingContainer,
      [readingAnnotation],
      "reading.md"
    );
    assert.equal(scheduledFrames.length, 1);
    scheduledFrames.shift()();
    assert.equal(insertedRails.length, 0);
    assert.equal(
      scheduledFrames.length,
      1,
      "detached reading containers should be retried instead of abandoned"
    );
    readingContainer.isConnected = true;
    scheduledFrames.shift()();
    assert.equal(insertedRails.length, 1);
    assert.equal(insertedRails[0][0], "top");
    assert.equal(insertedRails[0][1].annotations[0].note, "阅读批注");
    assert.equal(insertedRails[0][1].mode, "reading");

    assert.deepEqual(
      plugin.commands.map((command) => command.id),
      [
        "add-visual-annotation",
        "edit-visual-annotation",
        "remove-visual-annotation"
      ]
    );

    const removed = [];
    const aria = [];
    const annotationNode = {
      classList: { remove(value) { removed.push(`annotation:${value}`); } },
      setAttribute(name, value) { aria.push([name, value]); }
    };
    const railNode = {
      classList: { remove(value) { removed.push(`rail:${value}`); } }
    };
    plugin.clearRenderedSelection({
      querySelectorAll(selector) {
        if (selector === ".va-annotation.is-selected") return [annotationNode];
        if (selector === ".va-rail-item.is-selected") return [railNode];
        return [];
      }
    });
    assert.deepEqual(removed, ["annotation:is-selected", "rail:is-selected"]);
    assert.deepEqual(aria, [["aria-selected", "false"]]);

    let dismissalCount = 0;
    const dismissalDoc = {
      addEventListener() {},
      querySelectorAll(selector) {
        if (
          selector === ".va-annotation.is-selected" ||
          selector === ".va-rail-item.is-selected"
        ) {
          return [
            {
              classList: {
                remove() {
                  dismissalCount += 1;
                }
              },
              setAttribute() {}
            }
          ];
        }
        return [];
      }
    };
    plugin.ensureSelectionDismissalHandlers(dismissalDoc);
    plugin.ensureSelectionDismissalHandlers(dismissalDoc);
    const dismissalEvents = plugin.domEvents.filter(({ target }) => target === dismissalDoc);
    assert.deepEqual(
      dismissalEvents.map(({ type }) => type),
      ["click", "keydown"],
      "each document should receive one dismissal handler pair"
    );

    const clickDismissal = dismissalEvents.find(({ type }) => type === "click").handler;
    const keyDismissal = dismissalEvents.find(({ type }) => type === "keydown").handler;
    clickDismissal({
      target: {
        closest(selector) {
          assert.equal(selector, ".va-annotation, .va-rail-item");
          return {};
        }
      }
    });
    assert.equal(dismissalCount, 0, "annotation controls should keep the selection open");

    clickDismissal({ target: { closest() { return null; } } });
    assert.equal(dismissalCount, 2, "clicking outside should clear target and rail selection");

    keyDismissal({ key: "Enter" });
    assert.equal(dismissalCount, 2, "unrelated keys should keep the selection open");
    keyDismissal({ key: "Escape" });
    assert.equal(dismissalCount, 4, "Escape should clear target and rail selection");

    console.log("PASS bundled plugin runtime load test");
  } finally {
    delete global.window;
    Module._load = originalLoad;
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
