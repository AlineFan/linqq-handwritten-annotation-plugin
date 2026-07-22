"use strict";

const assert = require("node:assert/strict");
const Module = require("node:module");

class Plugin {
  constructor(app) {
    this.app = app;
    this.commands = [];
    this.editorExtensions = [];
  }
  async loadData() { return {}; }
  async saveData() {}
  addCommand(command) { this.commands.push(command); }
  addRibbonIcon() {}
  registerEvent() {}
  registerDomEvent() {}
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
    global.window = {
      innerWidth: 1200,
      setTimeout() { return 1; },
      clearTimeout() {},
      requestAnimationFrame() {}
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
