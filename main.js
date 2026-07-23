"use strict";

const {
  Plugin,
  Modal,
  Notice,
  Setting,
  PluginSettingTab,
  MarkdownView,
  Menu,
  editorInfoField
} = require("obsidian");
const { Decoration, EditorView, WidgetType } = require("@codemirror/view");
const { StateField } = require("@codemirror/state");

// Keep the production entry point self-contained. Obsidian loads main.js in a
// plugin sandbox where relative CommonJS modules are not consistently resolved.
const COLORS = ["amber", "blue", "green", "red", "purple"];
const PLACEMENTS = ["auto", "top", "bottom", "left", "right"];
const ANNOTATION_SOURCE =
  '<span class="va-annotation va-color-(' +
  COLORS.join("|") +
  ') va-place-(' +
  PLACEMENTS.join("|") +
  ')" data-va-note="([^"]*)"(?: data-va-id="([^"]*)")?>([\\s\\S]*?)<\\/span>';

const DEFAULT_SETTINGS = { defaultColor: "blue" };

const COLOR_LABELS = {
  amber: "橙色",
  blue: "蓝色",
  green: "绿色",
  red: "红色",
  purple: "紫色"
};

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

function createAnnotationId() {
  return `va-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
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

function getAnnotationColor(element) {
  return COLORS.find((color) => element.classList.contains(`va-color-${color}`)) || "blue";
}

function getAnnotationPlacement(element) {
  return (
    PLACEMENTS.find((placement) => element.classList.contains(`va-place-${placement}`)) ||
    "auto"
  );
}

function identityFromElement(element) {
  return {
    id: element.getAttribute("data-va-id") || "",
    text: element.textContent || "",
    note: element.getAttribute("data-va-note") || "",
    color: getAnnotationColor(element),
    placement: getAnnotationPlacement(element)
  };
}

function visibleTextLength(value) {
  return String(value)
    .replace(/<[^>]*>/g, "")
    .replace(/[*_~`#>\[\]()]/g, "")
    .trim().length;
}

function annotationAnchorOnLine(source, line, annotation) {
  const lineSource = source.slice(line.from, line.to);
  const beforeSource = source.slice(line.from, annotation.start);
  const total = Math.max(visibleTextLength(lineSource), 1);
  const before = visibleTextLength(beforeSource);
  const target = Math.max(visibleTextLength(annotation.text), 1);
  return Math.max(0.02, Math.min(0.98, (before + target / 2) / total));
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

function getEditorSourcePath(viewOrState) {
  const state = viewOrState.state || viewOrState;
  const info = state.field(editorInfoField, false);
  return (info && info.file && info.file.path) || "";
}

class AnnotationRailWidget extends WidgetType {
  constructor(plugin, annotations, sourcePath, placement) {
    super();
    this.plugin = plugin;
    this.annotations = annotations;
    this.sourcePath = sourcePath;
    this.placement = placement;
    this.signature = `${placement}\u0003${annotations
      .map((annotation) =>
        [
          annotation.id,
          annotation.note,
          annotation.color,
          annotation.text,
          annotation.anchorRatio
        ].join("\u0001")
      )
      .join("\u0002")}`;
  }

  eq(other) {
    return other instanceof AnnotationRailWidget && other.signature === this.signature;
  }

  toDOM(view) {
    const doc = view.dom.ownerDocument;
    return this.plugin.createAnnotationRail(
      this.annotations,
      this.sourcePath || getEditorSourcePath(view),
      doc,
      "editor",
      this.placement
    );
  }

  ignoreEvent() {
    return true;
  }
}

function buildEditorRailDecorations(state, plugin) {
  const source = state.doc.toString();
  const grouped = new Map();
  const regex = annotationRegex();
  let match;
  while ((match = regex.exec(source)) !== null) {
    const annotation = annotationFromMatch(match);
    const line = state.doc.lineAt(annotation.start);
    annotation.anchorRatio = annotationAnchorOnLine(source, line, annotation);
    annotation.preferredSide = annotation.anchorRatio <= 0.5 ? "top" : "bottom";
    if (!grouped.has(line.from)) grouped.set(line.from, { line, annotations: [] });
    grouped.get(line.from).annotations.push(annotation);
  }

  const sourcePath = getEditorSourcePath(state);
  const decorations = [];
  for (const { line, annotations } of grouped.values()) {
    const distributed = distributeAnnotations(annotations);
    if (distributed.top.length) {
      decorations.push(
        Decoration.widget({
          widget: new AnnotationRailWidget(plugin, distributed.top, sourcePath, "top"),
          block: true,
          side: -100
        }).range(line.from)
      );
    }
    if (distributed.bottom.length) {
      decorations.push(
        Decoration.widget({
          widget: new AnnotationRailWidget(plugin, distributed.bottom, sourcePath, "bottom"),
          block: true,
          side: 100
        }).range(line.to)
      );
    }
  }
  return Decoration.set(decorations, true);
}

function createEditorRailExtension(plugin) {
  // Block widgets affect vertical layout. CodeMirror requires them to be
  // provided synchronously by a StateField, not by a ViewPlugin.
  const rails = StateField.define({
    create(state) {
      return buildEditorRailDecorations(state, plugin);
    },
    update(decorations, transaction) {
      if (!transaction.docChanged) return decorations;
      return buildEditorRailDecorations(transaction.state, plugin);
    },
    provide: (field) => EditorView.decorations.from(field)
  });

  const interactions = EditorView.domEventHandlers({
    click(event, view) {
      const annotation = event.target.closest && event.target.closest(".va-annotation");
      if (!annotation) return false;
      plugin.selectRenderedAnnotation(annotation, null);
      return false;
    },
    dblclick(event, view) {
      const annotation = event.target.closest && event.target.closest(".va-annotation");
      if (!annotation) return false;
      event.preventDefault();
      plugin.editRenderedAnnotation(
        getEditorSourcePath(view),
        identityFromElement(annotation),
        annotation.ownerDocument
      );
      return true;
    },
    contextmenu(event, view) {
      const annotation = event.target.closest && event.target.closest(".va-annotation");
      if (!annotation) return false;
      event.preventDefault();
      plugin.showRenderedAnnotationMenu(
        event,
        getEditorSourcePath(view),
        identityFromElement(annotation),
        annotation.ownerDocument
      );
      return true;
    }
  });

  return [rails, interactions];
}

class AnnotationModal extends Modal {
  constructor(app, initial, onSubmit) {
    super(app);
    this.state = { ...initial };
    this.onSubmit = onSubmit;
    this.colorButtons = new Map();
  }

  onOpen() {
    const { contentEl } = this;
    this.modalEl.addClass("va-modal-shell");
    contentEl.empty();
    contentEl.addClass("va-modal");
    contentEl.createEl("h2", {
      text: this.state.editing ? "编辑批注" : "添加批注"
    });

    const field = contentEl.createDiv({ cls: "va-note-field" });
    field.createEl("label", { text: "批注文字", attr: { for: "va-note-input" } });
    const input = field.createEl("textarea", {
      cls: "va-note-input",
      attr: {
        id: "va-note-input",
        rows: "3",
        placeholder: "输入批注，例如：核心结论",
        autocomplete: "off",
        spellcheck: "false"
      }
    });
    input.value = this.state.note || "";
    input.addEventListener("input", () => {
      this.state.note = input.value;
    });

    const colorSection = contentEl.createDiv({ cls: "va-color-section" });
    colorSection.createDiv({ cls: "va-field-label", text: "颜色" });
    const palette = colorSection.createDiv({ cls: "va-color-palette" });
    for (const color of COLORS) {
      const button = palette.createEl("button", {
        cls: `va-color-choice va-color-${color}`,
        attr: {
          type: "button",
          "aria-label": COLOR_LABELS[color],
          title: COLOR_LABELS[color]
        }
      });
      button.createSpan({ cls: "va-color-swatch" });
      button.addEventListener("click", () => {
        this.state.color = color;
        this.updateColorSelection();
      });
      this.colorButtons.set(color, button);
    }
    this.updateColorSelection();

    const selectedText = this.state.text || "";
    const excerpt = selectedText.length > 42 ? `${selectedText.slice(0, 42)}…` : selectedText;
    const target = contentEl.createDiv({ cls: "va-selected-text" });
    target.createSpan({ cls: "va-selected-text-label", text: "批注对象" });
    target.createSpan({ cls: "va-selected-text-value", text: excerpt });

    contentEl.createDiv({
      cls: "va-auto-position-hint",
      text: "批注会显示在正文上方的独立批注栏，不会遮住正文。"
    });

    const actions = contentEl.createDiv({ cls: "va-modal-actions" });
    const cancel = actions.createEl("button", {
      text: "取消",
      attr: { type: "button" }
    });
    cancel.addEventListener("click", () => this.close());
    const submit = actions.createEl("button", {
      cls: "mod-cta",
      text: this.state.editing ? "保存" : "添加",
      attr: { type: "button" }
    });
    const submitForm = () => {
      const note = (this.state.note || "").trim();
      if (!note) {
        new Notice("请输入批注文字");
        input.focus();
        return;
      }
      this.onSubmit({ ...this.state, note, placement: "auto" });
      this.close();
    };
    submit.addEventListener("click", submitForm);
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.isComposing) {
        event.preventDefault();
        submitForm();
      }
    });
    window.setTimeout(() => {
      input.focus();
      input.select();
    }, 20);
  }

  updateColorSelection() {
    for (const [color, button] of this.colorButtons) {
      const selected = color === this.state.color;
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-pressed", selected ? "true" : "false");
    }
  }

  onClose() {
    this.contentEl.empty();
  }
}

class VisualAnnotationsSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName("默认颜色")
      .setDesc("添加批注时预先选中的颜色")
      .addDropdown((dropdown) => {
        for (const color of COLORS) dropdown.addOption(color, COLOR_LABELS[color]);
        dropdown.setValue(this.plugin.settings.defaultColor).onChange(async (value) => {
          this.plugin.settings.defaultColor = value;
          await this.plugin.saveSettings();
        });
      });
  }
}

module.exports = class VisualAnnotationsPlugin extends Plugin {
  async onload() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    this.registerEditorExtension(createEditorRailExtension(this));

    this.addCommand({
      id: "add-visual-annotation",
      name: "为所选文字添加视觉批注",
      editorCheckCallback: (checking, editor) => {
        const selection = editor.getSelection();
        if (!selection || this.getActiveAnnotation(editor)) return false;
        if (!checking) this.addAnnotation(editor);
        return true;
      }
    });

    this.addCommand({
      id: "edit-visual-annotation",
      name: "编辑所选或光标处的视觉批注",
      editorCheckCallback: (checking, editor) => {
        const annotation = this.getActiveAnnotation(editor);
        if (!annotation) return false;
        if (!checking) this.editAnnotation(editor, annotation);
        return true;
      }
    });

    this.addCommand({
      id: "remove-visual-annotation",
      name: "删除所选或光标处的视觉批注（保留正文）",
      editorCheckCallback: (checking, editor) => {
        const annotation = this.getActiveAnnotation(editor);
        if (!annotation) return false;
        if (!checking) this.removeAnnotation(editor, annotation);
        return true;
      }
    });

    this.addRibbonIcon("message-square-plus", "添加视觉批注", () => {
      const view = this.app.workspace.getActiveViewOfType(MarkdownView);
      if (!view) {
        new Notice("请先打开 Markdown 文档");
        return;
      }
      if (!view.editor.getSelection()) {
        new Notice("请先选中要批注的文字");
        return;
      }
      if (this.getActiveAnnotation(view.editor)) {
        new Notice("所选文字已经有批注；请使用编辑或删除");
        return;
      }
      this.addAnnotation(view.editor);
    });

    this.registerEvent(
      this.app.workspace.on("editor-menu", (menu, editor) => {
        const annotation = this.getActiveAnnotation(editor);
        if (annotation) {
          menu.addItem((item) =>
            item
              .setTitle("编辑所选批注")
              .setIcon("pencil")
              .onClick(() => this.editAnnotation(editor, annotation))
          );
          menu.addItem((item) =>
            item
              .setTitle("删除所选批注（保留正文）")
              .setIcon("eraser")
              .onClick(() => this.removeAnnotation(editor, annotation))
          );
        } else if (editor.getSelection()) {
          menu.addItem((item) =>
            item
              .setTitle("添加视觉批注")
              .setIcon("message-square-plus")
              .onClick(() => this.addAnnotation(editor))
          );
        }
      })
    );

    this.registerMarkdownPostProcessor((element, context) => {
      this.renderAnnotations(element, context);
    });

    this.addSettingTab(new VisualAnnotationsSettingTab(this.app, this));
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  getActiveAnnotation(editor) {
    const source = editor.getValue();
    const from = editor.posToOffset(editor.getCursor("from"));
    const to = editor.posToOffset(editor.getCursor("to"));
    if (from !== to) return findAnnotationOverlappingRange(source, from, to);
    return findAnnotationAtOffset(source, from);
  }

  addAnnotation(editor) {
    const selected = editor.getSelection();
    if (!selected) {
      new Notice("请先选中要批注的文字");
      return;
    }
    if (/\r|\n/.test(selected)) {
      new Notice("目前仅支持单行文字批注");
      return;
    }
    if (selected.includes('<span class="va-annotation') || selected.includes("</span>")) {
      new Notice("选区已经包含批注或不兼容的 HTML");
      return;
    }

    const leading = selected.match(/^\s*/)[0];
    const trailing = selected.match(/\s*$/)[0];
    const text = selected.slice(leading.length, selected.length - trailing.length);
    if (!text) {
      new Notice("选区不能只包含空格");
      return;
    }

    new AnnotationModal(
      this.app,
      {
        editing: false,
        text,
        note: "",
        color: this.settings.defaultColor,
        placement: "auto"
      },
      ({ note, color }) => {
        const replacement =
          leading + buildAnnotation(text, note, color, "auto", createAnnotationId()) + trailing;
        editor.replaceSelection(replacement);
        new Notice("视觉批注已添加");
      }
    ).open();
  }

  editAnnotation(editor, annotation) {
    new AnnotationModal(
      this.app,
      {
        editing: true,
        text: annotation.text,
        note: annotation.note,
        color: annotation.color,
        placement: "auto"
      },
      ({ note, color }) => {
        const source = editor.getValue();
        const replacement = buildAnnotation(
          annotation.text,
          note,
          color,
          "auto",
          annotation.id || createAnnotationId()
        );
        const next =
          source.slice(0, annotation.start) + replacement + source.slice(annotation.end);
        editor.setValue(next);
        const start = editor.offsetToPos(annotation.start);
        const end = editor.offsetToPos(annotation.start + replacement.length);
        editor.setSelection(start, end);
        new Notice("视觉批注已更新");
      }
    ).open();
  }

  removeAnnotation(editor, annotation) {
    const source = editor.getValue();
    const next = source.slice(0, annotation.start) + annotation.text + source.slice(annotation.end);
    editor.setValue(next);
    const start = editor.offsetToPos(annotation.start);
    const end = editor.offsetToPos(annotation.start + annotation.text.length);
    editor.setSelection(start, end);
    new Notice("批注已删除，正文已保留");
  }

  renderAnnotations(element, context) {
    const annotations = Array.from(element.querySelectorAll(".va-annotation"));
    if (!annotations.length) return;

    const grouped = new Map();
    for (const annotation of annotations) {
      const container = annotation.closest("p, li, blockquote, td") || annotation.parentElement;
      if (!container) continue;
      if (!grouped.has(container)) grouped.set(container, []);
      grouped.get(container).push(annotation);
    }

    for (const [container, items] of grouped) {
      this.scheduleRenderedAnnotationRails(container, items, context.sourcePath);
      for (const annotation of items) {
        annotation.addClass("va-interactive");
        annotation.setAttribute("role", "button");
        annotation.setAttribute("tabindex", "0");
        const identity = identityFromElement(annotation);
        annotation.addEventListener("click", () => this.selectRenderedAnnotation(annotation, null));
        annotation.addEventListener("dblclick", (event) => {
          event.preventDefault();
          this.editRenderedAnnotation(context.sourcePath, identity, annotation.ownerDocument);
        });
        annotation.addEventListener("contextmenu", (event) => {
          event.preventDefault();
          this.showRenderedAnnotationMenu(
            event,
            context.sourcePath,
            identity,
            annotation.ownerDocument
          );
        });
      }
    }
  }

  scheduleRenderedAnnotationRails(container, items, sourcePath) {
    const doc = container.ownerDocument;
    const view = doc.defaultView;
    const render = () => {
      if (container.isConnected === false) return;
      Array.from(container.children || [])
        .filter((child) => child.classList.contains("va-reading-rail"))
        .forEach((rail) => rail.remove());

      const containerRect = container.getBoundingClientRect();
      const railItems = items.map((annotation) => ({
        ...identityFromElement(annotation),
        targetElement: annotation,
        ...this.measureRenderedTarget(annotation, containerRect)
      }));
      const distributed = distributeAnnotations(railItems);
      if (distributed.top.length) {
        container.prepend(
          this.createAnnotationRail(distributed.top, sourcePath, doc, "reading", "top")
        );
      }
      if (distributed.bottom.length) {
        container.append(
          this.createAnnotationRail(distributed.bottom, sourcePath, doc, "reading", "bottom")
        );
      }
    };

    if (view && typeof view.requestAnimationFrame === "function") {
      view.requestAnimationFrame(render);
    } else {
      setTimeout(render, 0);
    }
  }

  measureRenderedTarget(annotation, containerRect) {
    const rects = Array.from(annotation.getClientRects());
    const first = rects[0] || annotation.getBoundingClientRect();
    const last = rects[rects.length - 1] || first;
    const width = Math.max(containerRect.width, 1);
    const anchorRatio = Math.max(
      0.02,
      Math.min(0.98, (first.left + first.width / 2 - containerRect.left) / width)
    );
    const containerTop = Number(containerRect.top) || 0;
    const containerBottom =
      Number.isFinite(containerRect.bottom)
        ? containerRect.bottom
        : containerTop + (Number(containerRect.height) || 0);
    const firstTop = Number(first.top) || 0;
    const lastBottom =
      Number.isFinite(last.bottom) ? last.bottom : (Number(last.top) || 0) + (Number(last.height) || 0);
    const topDistance = Math.max(0, firstTop - containerTop);
    const bottomDistance = Math.max(0, containerBottom - lastBottom);
    return {
      anchorRatio,
      preferredSide: topDistance <= bottomDistance ? "top" : "bottom"
    };
  }

  createAnnotationRail(annotations, sourcePath, doc, mode, placement = "top") {
    const rail = doc.createElement("span");
    rail.className = `va-annotation-rail va-${mode}-rail va-side-${placement}`;
    rail.dataset.vaPlacement = placement;
    rail.setAttribute("contenteditable", "false");
    rail.setAttribute("aria-label", "视觉批注栏");

    annotations.forEach((annotation, index) => {
      const item = doc.createElement("span");
      item.className = `va-rail-item va-color-${annotation.color}`;
      item.style.setProperty("--va-rotate", `${[-4, 3, -2, 4, -3][index % 5]}deg`);
      item.dataset.vaId = annotation.id || "";
      item.dataset.vaNote = annotation.note;
      item.dataset.vaText = annotation.text;
      item.dataset.vaAnchorRatio = String(annotation.anchorRatio ?? 0.5);
      item.style.setProperty("--va-anchor-ratio", String(annotation.anchorRatio ?? 0.5));
      item._vaTargetElement = annotation.targetElement || null;

      const noteButton = doc.createElement("button");
      noteButton.className = "va-rail-note";
      noteButton.type = "button";
      noteButton.title = `批注对象：${annotation.text}`;

      const noteText = doc.createElement("span");
      noteText.className = "va-rail-note-text";
      noteText.textContent = annotation.note;

      const arrow = doc.createElement("span");
      arrow.className = "va-rail-arrow";
      arrow.setAttribute("aria-hidden", "true");
      noteButton.append(noteText, arrow);

      const actions = doc.createElement("span");
      actions.className = "va-rail-actions";
      const edit = doc.createElement("button");
      edit.className = "va-rail-action";
      edit.type = "button";
      edit.textContent = "编辑";
      const remove = doc.createElement("button");
      remove.className = "va-rail-action va-rail-delete";
      remove.type = "button";
      remove.textContent = "删除";
      actions.append(edit, remove);
      item.append(noteButton, actions);
      rail.append(item);

      const select = (event) => {
        event.stopPropagation();
        rail.querySelectorAll(".va-rail-item.is-selected").forEach((node) => {
          node.classList.remove("is-selected");
        });
        item.classList.add("is-selected");
        if (annotation.targetElement) {
          this.selectRenderedAnnotation(annotation.targetElement, null);
        }
      };
      noteButton.addEventListener("click", select);
      edit.addEventListener("click", (event) => {
        event.stopPropagation();
        this.editRenderedAnnotation(sourcePath, annotation, item.ownerDocument);
      });
      remove.addEventListener("click", (event) => {
        event.stopPropagation();
        this.removeRenderedAnnotation(sourcePath, annotation);
      });
    });
    this.scheduleAnnotationRailLayout(rail);
    return rail;
  }

  scheduleAnnotationRailLayout(rail) {
    const view = rail.ownerDocument.defaultView;
    const run = () => this.layoutAnnotationRail(rail);
    if (view && typeof view.requestAnimationFrame === "function") {
      view.requestAnimationFrame(run);
    } else {
      setTimeout(run, 0);
    }
    const fonts = rail.ownerDocument.fonts;
    if (fonts && fonts.ready && typeof fonts.ready.then === "function") {
      fonts.ready.then(run).catch(() => {});
    }
    const ResizeObserverClass = view && view.ResizeObserver;
    if (typeof ResizeObserverClass === "function") {
      let lastWidth = 0;
      const observer = new ResizeObserverClass((entries) => {
        if (!rail.isConnected) {
          observer.disconnect();
          return;
        }
        const width = entries[0] ? entries[0].contentRect.width : rail.getBoundingClientRect().width;
        if (Math.abs(width - lastWidth) < 0.5) return;
        lastWidth = width;
        run();
      });
      observer.observe(rail);
      rail._vaResizeObserver = observer;
    }
  }

  findRenderedTarget(item, railRect) {
    if (item._vaTargetElement && item._vaTargetElement.isConnected !== false) {
      return item._vaTargetElement;
    }
    const candidates = Array.from(item.ownerDocument.querySelectorAll(".va-annotation")).filter(
      (node) => {
        const idMatches = item.dataset.vaId && node.getAttribute("data-va-id") === item.dataset.vaId;
        const legacyMatches =
          !item.dataset.vaId &&
          node.getAttribute("data-va-note") === item.dataset.vaNote &&
          node.textContent === item.dataset.vaText;
        return idMatches || legacyMatches;
      }
    );
    if (!candidates.length) return null;
    const railCenter = railRect.top + railRect.height / 2;
    return candidates.sort((a, b) => {
      const aRect = a.getBoundingClientRect();
      const bRect = b.getBoundingClientRect();
      return (
        Math.abs(aRect.top + aRect.height / 2 - railCenter) -
        Math.abs(bRect.top + bRect.height / 2 - railCenter)
      );
    })[0];
  }

  layoutAnnotationRail(rail) {
    if (!rail.isConnected) return;
    const railRect = rail.getBoundingClientRect();
    if (!railRect.width) return;
    const isTop = rail.dataset.vaPlacement !== "bottom";
    const entries = Array.from(rail.querySelectorAll(".va-rail-item")).map((item) => {
      let ratio = Number(item.dataset.vaAnchorRatio || 0.5);
      const itemRect = item.getBoundingClientRect();
      const target = this.findRenderedTarget(item, railRect);
      let desiredX = ratio * itemRect.width;
      if (target) {
        const rects = Array.from(target.getClientRects());
        const targetRect =
          (isTop ? rects[0] : rects[rects.length - 1]) || target.getBoundingClientRect();
        desiredX = targetRect.left + targetRect.width / 2 - itemRect.left;
      }
      const marker = item.querySelector(".va-rail-note");
      const markerWidth = Math.min(
        marker ? marker.getBoundingClientRect().width : 0,
        itemRect.width
      );
      const markerHalf = markerWidth / 2;
      const markerX = Math.max(markerHalf, Math.min(itemRect.width - markerHalf, desiredX));
      return {
        item,
        markerX,
        arrowShift: desiredX - markerX,
        left: markerX - markerHalf,
        right: markerX + markerHalf,
        height: Math.max(itemRect.height, 68)
      };
    });

    entries.sort((a, b) => a.left - b.left);
    const laneEnds = [];
    const horizontalGap = 20;
    for (const entry of entries) {
      let lane = laneEnds.findIndex((right) => entry.left >= right + horizontalGap);
      if (lane === -1) lane = laneEnds.length;
      laneEnds[lane] = entry.right;
      entry.lane = lane;
    }

    const laneCount = Math.max(laneEnds.length, 1);
    const laneHeight = Math.max(72, ...entries.map((entry) => entry.height + 4));
    const railHeight = laneCount * laneHeight;
    rail.style.height = `${railHeight}px`;
    rail.style.minHeight = `${railHeight}px`;

    for (const entry of entries) {
      const displayLane = isTop ? laneCount - 1 - entry.lane : entry.lane;
      const connectorExtra = isTop
        ? (laneCount - 1 - displayLane) * laneHeight
        : displayLane * laneHeight;
      entry.item.dataset.vaLane = String(displayLane);
      entry.item.style.setProperty("--va-marker-x", `${entry.markerX}px`);
      entry.item.style.setProperty("--va-arrow-shift", `${entry.arrowShift}px`);
      entry.item.style.setProperty("--va-arrow-length", `${38 + connectorExtra}px`);
      entry.item.style.setProperty(
        "--va-connector-offset",
        `${isTop ? 0 : -connectorExtra}px`
      );
      entry.item.style.setProperty("--va-lane-y", `${displayLane * laneHeight}px`);
    }
  }

  selectRenderedAnnotation(annotation, callout) {
    const doc = annotation.ownerDocument;
    doc.querySelectorAll(".va-annotation.is-selected").forEach((node) => {
      node.removeClass("is-selected");
      node.setAttribute("aria-selected", "false");
    });
    doc.querySelectorAll(".va-rail-item.is-selected").forEach((node) => {
      node.classList.remove("is-selected");
    });
    annotation.addClass("is-selected");
    annotation.setAttribute("aria-selected", "true");
    const identity = identityFromElement(annotation);
    doc.querySelectorAll(".va-rail-item").forEach((item) => {
      const idMatches = identity.id && item.dataset.vaId === identity.id;
      const legacyMatches =
        !identity.id &&
        item.dataset.vaNote === identity.note &&
        item.dataset.vaText === identity.text;
      if (idMatches || legacyMatches) item.classList.add("is-selected");
    });
  }

  clearRenderedSelection(doc) {
    if (!doc || typeof doc.querySelectorAll !== "function") return;
    doc.querySelectorAll(".va-annotation.is-selected").forEach((node) => {
      node.classList.remove("is-selected");
      node.setAttribute("aria-selected", "false");
    });
    doc.querySelectorAll(".va-rail-item.is-selected").forEach((node) => {
      node.classList.remove("is-selected");
    });
  }

  showRenderedAnnotationMenu(event, sourcePath, identity, selectionDoc = null) {
    const menu = new Menu();
    menu.addItem((item) =>
      item
        .setTitle("编辑批注")
        .setIcon("pencil")
        .onClick(() => this.editRenderedAnnotation(sourcePath, identity, selectionDoc))
    );
    menu.addItem((item) =>
      item
        .setTitle("删除批注（保留正文）")
        .setIcon("eraser")
        .onClick(() => this.removeRenderedAnnotation(sourcePath, identity))
    );
    menu.showAtMouseEvent(event);
  }

  async editRenderedAnnotation(sourcePath, identity, selectionDoc = null) {
    const file = this.app.vault.getAbstractFileByPath(sourcePath);
    if (!file) {
      new Notice("找不到批注所在文档");
      return;
    }
    const source = await this.app.vault.read(file);
    const annotation = findAnnotationByIdentity(source, identity);
    if (!annotation) {
      new Notice("找不到所选批注，请重新打开文档后再试");
      return;
    }

    new AnnotationModal(
      this.app,
      {
        editing: true,
        text: annotation.text,
        note: annotation.note,
        color: annotation.color,
        placement: "auto"
      },
      async ({ note, color }) => {
        this.clearRenderedSelection(selectionDoc);
        let changed = false;
        await this.app.vault.process(file, (currentSource) => {
          const current = findAnnotationByIdentity(currentSource, identity);
          if (!current) return currentSource;
          const replacement = buildAnnotation(
            current.text,
            note,
            color,
            "auto",
            current.id || createAnnotationId()
          );
          changed = true;
          return (
            currentSource.slice(0, current.start) + replacement + currentSource.slice(current.end)
          );
        });
        new Notice(changed ? "视觉批注已更新" : "批注已发生变化，请重新选择");
      }
    ).open();
  }

  async removeRenderedAnnotation(sourcePath, identity) {
    const file = this.app.vault.getAbstractFileByPath(sourcePath);
    if (!file) {
      new Notice("找不到批注所在文档");
      return;
    }
    let changed = false;
    await this.app.vault.process(file, (source) => {
      const annotation = findAnnotationByIdentity(source, identity);
      if (!annotation) return source;
      changed = true;
      return source.slice(0, annotation.start) + annotation.text + source.slice(annotation.end);
    });
    new Notice(changed ? "批注已删除，正文已保留" : "批注已发生变化，请重新选择");
  }
};
