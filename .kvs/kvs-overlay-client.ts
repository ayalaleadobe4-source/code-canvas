type KvsRange = {
  start: number;
  end: number;
  expected?: string;
};

type KvsSource = {
  id: string;
  file: string;
  tag: string;
  element: KvsRange;
  opening: KvsRange;
  text?: KvsRange;
  className?: KvsRange;
  src?: KvsRange;
  style?: KvsRange;
};

type KvsEdit = {
  kind: string;
  [key: string]: unknown;
};

type KvsAppliedEditResult = {
  file: string;
  start: number;
  end: number;
  replacedLength: number;
  insertedLength: number;
  previousValue?: string;
  nextValue?: string;
};

type KvsEditResponse = {
  ok?: boolean;
  results?: KvsAppliedEditResult[];
  error?: string;
};

type KvsTab = "edit" | "style" | "classes" | "image" | "insert" | "layers" | "theme" | "history";

type StyleField = {
  group: string;
  label: string;
  property: string;
  placeholder?: string;
  tokens?: readonly { label: string; value: string }[];
};

type InsertSnippet = {
  label: string;
  jsx: string;
};

type HistoryEntry = {
  label: string;
  undo: KvsEdit;
  redo: KvsEdit;
  createdAt: number;
};

type ImageAsset = {
  label: string;
  src: string;
};

const BRIDGE_URL = "http://127.0.0.1:39073/edit";
const SOURCE_ATTR = "data-kvs-source";
const ROOT_ID = "kvs-visual-editor-sidebar";
const SELECTED_CLASS = "kvs-visual-editor-selected";
const HOVER_CLASS = "kvs-visual-editor-hover";
const STORAGE_KEY = "kvs-visual-editor-panel";

const TABS: readonly { id: KvsTab; label: string }[] = [
  { id: "edit", label: "Edit" },
  { id: "style", label: "Style" },
  { id: "classes", label: "Classes" },
  { id: "image", label: "Image" },
  { id: "insert", label: "Add" },
  { id: "layers", label: "Layers" },
  { id: "theme", label: "Theme" },
  { id: "history", label: "History" },
];

const ATTRIBUTE_FIELDS = [
  "alt",
  "title",
  "href",
  "aria-label",
  "placeholder",
  "type",
  "name",
  "id",
] as const;

const CLASS_TOKENS = [
  "flex",
  "grid",
  "hidden",
  "block",
  "inline-flex",
  "items-center",
  "justify-center",
  "gap-2",
  "gap-4",
  "p-2",
  "p-4",
  "px-4",
  "py-2",
  "rounded-md",
  "rounded-lg",
  "shadow-md",
  "text-center",
  "font-bold",
  "w-full",
] as const;

const COLOR_TOKENS = [
  { label: "Black", value: "#0f172a" },
  { label: "White", value: "#ffffff" },
  { label: "Blue", value: "#2563eb" },
  { label: "Pink", value: "#db2777" },
  { label: "Green", value: "#16a34a" },
  { label: "Amber", value: "#f59e0b" },
  { label: "Slate", value: "#64748b" },
] as const;

const STYLE_FIELDS: readonly StyleField[] = [
  {
    group: "Typography",
    label: "Text color",
    property: "color",
    placeholder: "#111827 or hsl(var(--foreground))",
    tokens: COLOR_TOKENS,
  },
  {
    group: "Typography",
    label: "Font size",
    property: "fontSize",
    placeholder: "16px",
    tokens: [
      { label: "12", value: "12px" },
      { label: "14", value: "14px" },
      { label: "16", value: "16px" },
      { label: "20", value: "20px" },
      { label: "32", value: "32px" },
      { label: "48", value: "48px" },
    ],
  },
  {
    group: "Typography",
    label: "Weight",
    property: "fontWeight",
    placeholder: "400",
    tokens: [
      { label: "400", value: "400" },
      { label: "500", value: "500" },
      { label: "600", value: "600" },
      { label: "700", value: "700" },
      { label: "900", value: "900" },
    ],
  },
  {
    group: "Typography",
    label: "Align",
    property: "textAlign",
    placeholder: "left",
    tokens: [
      { label: "Left", value: "left" },
      { label: "Center", value: "center" },
      { label: "Right", value: "right" },
    ],
  },
  { group: "Typography", label: "Line height", property: "lineHeight", placeholder: "1.5" },
  { group: "Typography", label: "Letter spacing", property: "letterSpacing", placeholder: "0.02em" },
  { group: "Typography", label: "Font family", property: "fontFamily", placeholder: "Inter, sans-serif" },
  {
    group: "Color",
    label: "Background",
    property: "backgroundColor",
    placeholder: "#ffffff",
    tokens: COLOR_TOKENS,
  },
  {
    group: "Layout",
    label: "Display",
    property: "display",
    placeholder: "flex",
    tokens: [
      { label: "Block", value: "block" },
      { label: "Flex", value: "flex" },
      { label: "Grid", value: "grid" },
      { label: "None", value: "none" },
    ],
  },
  {
    group: "Layout",
    label: "Direction",
    property: "flexDirection",
    placeholder: "row",
    tokens: [
      { label: "Row", value: "row" },
      { label: "Column", value: "column" },
    ],
  },
  {
    group: "Layout",
    label: "Align items",
    property: "alignItems",
    placeholder: "center",
    tokens: [
      { label: "Start", value: "flex-start" },
      { label: "Center", value: "center" },
      { label: "End", value: "flex-end" },
      { label: "Stretch", value: "stretch" },
    ],
  },
  {
    group: "Layout",
    label: "Justify",
    property: "justifyContent",
    placeholder: "center",
    tokens: [
      { label: "Start", value: "flex-start" },
      { label: "Center", value: "center" },
      { label: "Between", value: "space-between" },
      { label: "End", value: "flex-end" },
    ],
  },
  {
    group: "Spacing",
    label: "Gap",
    property: "gap",
    placeholder: "16px",
    tokens: [
      { label: "0", value: "0px" },
      { label: "4", value: "4px" },
      { label: "8", value: "8px" },
      { label: "16", value: "16px" },
      { label: "24", value: "24px" },
      { label: "32", value: "32px" },
    ],
  },
  { group: "Spacing", label: "Padding", property: "padding", placeholder: "16px" },
  { group: "Spacing", label: "Margin", property: "margin", placeholder: "16px auto" },
  { group: "Size", label: "Width", property: "width", placeholder: "100%" },
  { group: "Size", label: "Height", property: "height", placeholder: "auto" },
  { group: "Size", label: "Max width", property: "maxWidth", placeholder: "960px" },
  { group: "Size", label: "Min height", property: "minHeight", placeholder: "320px" },
  {
    group: "Border",
    label: "Radius",
    property: "borderRadius",
    placeholder: "8px",
    tokens: [
      { label: "0", value: "0px" },
      { label: "4", value: "4px" },
      { label: "8", value: "8px" },
      { label: "16", value: "16px" },
      { label: "Full", value: "9999px" },
    ],
  },
  { group: "Border", label: "Border", property: "border", placeholder: "1px solid #e5e7eb" },
  {
    group: "Effects",
    label: "Shadow",
    property: "boxShadow",
    placeholder: "0 10px 30px rgb(0 0 0 / 0.15)",
    tokens: [
      { label: "None", value: "none" },
      { label: "Soft", value: "0 8px 24px rgb(15 23 42 / 0.12)" },
      { label: "Large", value: "0 18px 48px rgb(15 23 42 / 0.22)" },
    ],
  },
  { group: "Effects", label: "Opacity", property: "opacity", placeholder: "1" },
  { group: "Effects", label: "Filter", property: "filter", placeholder: "blur(2px)" },
  { group: "Transform", label: "Transform", property: "transform", placeholder: "translateY(-4px) scale(1.02)" },
  { group: "Motion", label: "Transition", property: "transition", placeholder: "all 200ms ease" },
];

const INSERT_SNIPPETS: readonly InsertSnippet[] = [
  { label: "Section", jsx: '<section className="py-12 px-6"><div className="mx-auto max-w-5xl">New section</div></section>' },
  { label: "Heading", jsx: '<h2 className="text-3xl font-bold">New heading</h2>' },
  { label: "Text", jsx: '<p className="text-base leading-7">New paragraph text</p>' },
  { label: "Button", jsx: '<button type="button" className="rounded-md px-4 py-2 font-semibold">Button</button>' },
  { label: "Image", jsx: '<img src="/placeholder.svg" alt="Placeholder" className="w-full rounded-md" />' },
  { label: "Card", jsx: '<div className="rounded-md border p-4 shadow-sm">New card</div>' },
  { label: "Grid", jsx: '<div className="grid gap-4 md:grid-cols-2"><div>Item</div><div>Item</div></div>' },
];

export function initKvsOverlayClient() {
  const globalWindow = window as Window & { __kvsOverlayClient?: boolean };
  if (globalWindow.__kvsOverlayClient) return;
  globalWindow.__kvsOverlayClient = true;

  let enabled = true;
  let activeTab: KvsTab = "edit";
  let selectedElement: HTMLElement | SVGElement | null = null;
  let selectedSource: KvsSource | null = null;
  let hoveredElement: HTMLElement | SVGElement | null = null;
  let moveSource: KvsSource | null = null;
  let busy = false;
  let status = "Click an element on the page to edit the source.";
  let history: HistoryEntry[] = [];
  let redoStack: HistoryEntry[] = [];

  injectStyle();

  const root = document.createElement("div");
  root.id = ROOT_ID;
  root.setAttribute("data-kvs-sidebar", "true");
  document.body.appendChild(root);
  restorePanelPosition(root);

  root.addEventListener("click", (event) => {
    const button = (event.target as Element | null)?.closest<HTMLButtonElement>("button[data-action]");
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    void runAction(button);
  });

  root.addEventListener("pointerdown", (event) => {
    const target = event.target as Element | null;
    if (!target) return;
    if (target.closest("button, input, textarea, select")) return;
    if (target.closest("[data-resize-handle]")) {
      beginResize(event, root);
      return;
    }
    if (target.closest("[data-drag-handle]")) beginDrag(event, root);
  });

  document.addEventListener(
    "click",
    (event) => {
      if (!enabled || busy || root.contains(event.target as Node)) return;
      const element = findSourceElement(event.target);
      if (!element) {
        setStatus("No source data on this element. Try Prepare and reload.");
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      select(element);
    },
    true,
  );

  document.addEventListener(
    "mouseover",
    (event) => {
      if (!enabled || root.contains(event.target as Node)) return;
      const element = findSourceElement(event.target);
      if (element === hoveredElement) return;
      hoveredElement?.classList.remove(HOVER_CLASS);
      hoveredElement = element;
      hoveredElement?.classList.add(HOVER_CLASS);
    },
    true,
  );

  document.addEventListener(
    "mouseout",
    (event) => {
      if (!hoveredElement || root.contains(event.target as Node)) return;
      hoveredElement.classList.remove(HOVER_CLASS);
      hoveredElement = null;
    },
    true,
  );

  document.addEventListener("keydown", (event) => {
    if (!root.isConnected) return;
    const isMod = event.metaKey || event.ctrlKey;
    if (!isMod) return;
    if (event.key.toLowerCase() === "z" && !event.shiftKey) {
      event.preventDefault();
      void undoLast();
    }
    if ((event.key.toLowerCase() === "z" && event.shiftKey) || event.key.toLowerCase() === "y") {
      event.preventDefault();
      void redoLast();
    }
  });

  render();

  function render() {
    root.classList.toggle("kvs-busy", busy);
    root.innerHTML = `
      <div class="kvs-panel">
        <div class="kvs-header" data-drag-handle>
          <div class="kvs-brand">
            <div class="kvs-title">KVS Visual Editor</div>
            <div class="kvs-subtitle">Source edit mode</div>
          </div>
          <div class="kvs-head-actions">
            <button type="button" data-action="toggle" data-primary="${enabled ? "true" : "false"}">${enabled ? "Inspect" : "Paused"}</button>
            <button type="button" data-action="refresh">Reload</button>
          </div>
        </div>
        <div class="kvs-current">
          ${renderSelectionSummary()}
        </div>
        <div class="kvs-tabs">
          ${TABS.map((tab) => `<button type="button" data-action="tab" data-tab="${tab.id}" data-active="${activeTab === tab.id}">${tab.label}</button>`).join("")}
        </div>
        <div class="kvs-body">
          ${renderActiveTab()}
        </div>
        <div class="kvs-status">${escapeHtml(status)}</div>
        <div class="kvs-resize" data-resize-handle></div>
      </div>
    `;
  }

  function renderSelectionSummary() {
    if (!selectedSource || !selectedElement) {
      return `
        <div class="kvs-empty-title">Nothing selected</div>
        <div class="kvs-help">Click any outlined page element. Edits are written to the repo through <code>/edit</code>.</div>
      `;
    }

    return `
      <div class="kvs-breadcrumb">${escapeHtml(elementPath(selectedElement))}</div>
      <div class="kvs-file">${escapeHtml(selectedSource.file)} <span>&lt;${escapeHtml(selectedSource.tag)}&gt;</span></div>
      <div class="kvs-badges">
        <span>${escapeHtml(classifyElement(selectedElement))}</span>
        ${selectedSource.text ? "<span>text</span>" : ""}
        ${selectedSource.src || selectedElement.getAttribute("src") ? "<span>image</span>" : ""}
      </div>
    `;
  }

  function renderActiveTab() {
    if (activeTab === "layers") return renderLayersTab();
    if (activeTab === "theme") return renderThemeTab();
    if (activeTab === "history") return renderHistoryTab();
    if (!selectedSource || !selectedElement) return `<div class="kvs-help">Select an element first.</div>`;
    if (activeTab === "edit") return renderEditTab();
    if (activeTab === "style") return renderStyleTab();
    if (activeTab === "classes") return renderClassesTab();
    if (activeTab === "image") return renderImageTab();
    return renderInsertTab();
  }

  function renderEditTab() {
    const textValue = selectedElement?.textContent?.trim() || "";
    return `
      <div class="kvs-section">
        <div class="kvs-section-title">Text</div>
        <textarea data-field="textValue" ${selectedSource?.text ? "" : "disabled"}>${escapeHtml(textValue)}</textarea>
        <div class="kvs-row-actions">
          <button type="button" data-action="apply-text" data-primary="true" ${selectedSource?.text ? "" : "disabled"}>Apply text</button>
          <button type="button" data-action="duplicate">Duplicate</button>
          <button type="button" data-action="remove" data-danger="true">Remove</button>
        </div>
        ${selectedSource?.text ? "" : '<div class="kvs-note">This element has children or dynamic text, so direct text replacement is disabled.</div>'}
      </div>
      <div class="kvs-section">
        <div class="kvs-section-title">Attributes</div>
        ${ATTRIBUTE_FIELDS.map((name) => renderAttributeRow(name)).join("")}
      </div>
    `;
  }

  function renderAttributeRow(name: string) {
    const value = selectedElement?.getAttribute(name) || "";
    return `
      <div class="kvs-compact-row">
        <label>${escapeHtml(name)}</label>
        <input data-attribute-input="${escapeHtml(name)}" value="${escapeAttr(value)}" placeholder="${escapeAttr(name)}" />
        <button type="button" data-action="apply-attribute" data-attribute="${escapeAttr(name)}">Set</button>
        <button type="button" data-action="remove-attribute" data-attribute="${escapeAttr(name)}">Clear</button>
      </div>
    `;
  }

  function renderClassesTab() {
    const classes = selectedElement?.getAttribute("class") || "";
    return `
      <div class="kvs-section">
        <div class="kvs-section-title">className</div>
        <textarea data-field="classValue">${escapeHtml(classes)}</textarea>
        <button type="button" data-action="apply-classes" data-primary="true">Apply className</button>
      </div>
      <div class="kvs-section">
        <div class="kvs-section-title">Toggle token</div>
        <div class="kvs-inline">
          <input data-field="classToken" placeholder="bg-blue-600" />
          <button type="button" data-action="toggle-token" data-primary="true">Toggle</button>
        </div>
        <div class="kvs-chip-grid">
          ${CLASS_TOKENS.map((token) => {
            const active = selectedElement?.classList.contains(token);
            return `<button type="button" data-action="toggle-token" data-token="${escapeAttr(token)}" data-active="${active ? "true" : "false"}">${escapeHtml(token)}</button>`;
          }).join("")}
        </div>
      </div>
    `;
  }

  function renderStyleTab() {
    const groups = unique(STYLE_FIELDS.map((field) => field.group));
    return groups
      .map((group) => {
        const fields = STYLE_FIELDS.filter((field) => field.group === group);
        return `
          <div class="kvs-section">
            <div class="kvs-section-title">${escapeHtml(group)}</div>
            ${fields.map(renderStyleField).join("")}
          </div>
        `;
      })
      .join("");
  }

  function renderStyleField(field: StyleField) {
    const current = selectedElement ? styleValue(selectedElement, field.property) : "";
    return `
      <div class="kvs-style-field">
        <label>${escapeHtml(field.label)}</label>
        <div class="kvs-inline">
          <input data-style-input="${escapeAttr(field.property)}" value="${escapeAttr(current)}" placeholder="${escapeAttr(field.placeholder || "")}" />
          <button type="button" data-action="apply-style" data-style="${escapeAttr(field.property)}" data-primary="true">Set</button>
          <button type="button" data-action="clear-style" data-style="${escapeAttr(field.property)}">Clear</button>
        </div>
        ${field.tokens ? `<div class="kvs-token-row">${field.tokens.map((token) => renderStyleToken(field.property, token.label, token.value)).join("")}</div>` : ""}
      </div>
    `;
  }

  function renderStyleToken(property: string, label: string, value: string) {
    const preview = isColorLike(value) ? `<span class="kvs-swatch" style="background:${escapeAttr(cssPreviewValue(value))}"></span>` : "";
    return `<button type="button" data-action="apply-style-value" data-style="${escapeAttr(property)}" data-value="${escapeAttr(value)}">${preview}${escapeHtml(label)}</button>`;
  }

  function renderImageTab() {
    const src = selectedElement?.getAttribute("src") || "";
    const assets = collectImageAssets();
    return `
      <div class="kvs-section">
        <div class="kvs-section-title">Image source</div>
        <div class="kvs-inline">
          <input data-field="imageSrc" value="${escapeAttr(src)}" placeholder="/image.png" />
          <button type="button" data-action="apply-image" data-primary="true">Set src</button>
        </div>
        <button type="button" data-action="apply-background-image">Use as background</button>
      </div>
      <div class="kvs-section">
        <div class="kvs-section-title">Images found on page</div>
        <div class="kvs-asset-grid">
          ${assets.length ? assets.map(renderImageAsset).join("") : '<div class="kvs-note">No image URLs found yet.</div>'}
        </div>
      </div>
    `;
  }

  function renderImageAsset(asset: ImageAsset) {
    return `
      <button type="button" class="kvs-asset" data-action="use-image-asset" data-src="${escapeAttr(asset.src)}">
        <span style="background-image:url('${escapeAttr(escapeCssUrl(asset.src))}')"></span>
        <strong>${escapeHtml(asset.label)}</strong>
      </button>
    `;
  }

  function renderInsertTab() {
    return `
      <div class="kvs-section">
        <div class="kvs-section-title">Insert JSX</div>
        <select data-field="insertPosition">
          <option value="after">After selected</option>
          <option value="before">Before selected</option>
          <option value="inside-end">Inside at end</option>
          <option value="inside-start">Inside at start</option>
        </select>
        <textarea data-field="insertJsx"><div className="rounded-md border p-4">New element</div></textarea>
        <button type="button" data-action="apply-insert" data-primary="true">Insert into source</button>
      </div>
      <div class="kvs-section">
        <div class="kvs-section-title">Blocks</div>
        <div class="kvs-chip-grid">
          ${INSERT_SNIPPETS.map((snippet, index) => `<button type="button" data-action="load-snippet" data-snippet-index="${index}">${escapeHtml(snippet.label)}</button>`).join("")}
        </div>
      </div>
      <div class="kvs-section">
        <div class="kvs-section-title">Move</div>
        <div class="kvs-note">${moveSource ? `Move source: ${escapeHtml(moveSource.tag)} from ${escapeHtml(moveSource.file)}` : "Mark an element, select a target, then choose a position."}</div>
        <button type="button" data-action="mark-move-source">Mark selected as move source</button>
        <div class="kvs-row-actions">
          <button type="button" data-action="apply-move" data-position="before" ${moveSource ? "" : "disabled"}>Move before</button>
          <button type="button" data-action="apply-move" data-position="after" ${moveSource ? "" : "disabled"}>Move after</button>
          <button type="button" data-action="apply-move" data-position="inside-end" ${moveSource ? "" : "disabled"}>Move inside</button>
        </div>
      </div>
    `;
  }

  function renderLayersTab() {
    const elements = sourceElements().slice(0, 180);
    return `
      <div class="kvs-section">
        <div class="kvs-section-title">Layers</div>
        <div class="kvs-note">${elements.length} source elements on this page.</div>
        <div class="kvs-layers">
          ${elements.map(renderLayerRow).join("")}
        </div>
      </div>
    `;
  }

  function renderLayerRow(element: HTMLElement | SVGElement) {
    const source = parseSource(element);
    if (!source) return "";
    const selected = selectedSource?.id === source.id;
    const depth = Math.min(sourceDepth(element), 8);
    return `
      <button type="button" data-action="select-layer" data-source-id="${escapeAttr(source.id)}" data-active="${selected ? "true" : "false"}" style="padding-left:${8 + depth * 12}px !important">
        <span>&lt;${escapeHtml(source.tag)}&gt;</span>
        <small>${escapeHtml(layerLabel(element))}</small>
      </button>
    `;
  }

  function renderThemeTab() {
    const vars = collectCssVariables();
    return `
      <div class="kvs-section">
        <div class="kvs-section-title">CSS variable</div>
        <div class="kvs-compact-row">
          <label>File</label>
          <input data-field="cssFile" value="src/index.css" />
        </div>
        <div class="kvs-compact-row">
          <label>Name</label>
          <input data-field="cssVarName" placeholder="--primary" />
        </div>
        <div class="kvs-compact-row">
          <label>Value</label>
          <input data-field="cssVarValue" placeholder="#2563eb" />
        </div>
        <button type="button" data-action="apply-css-var" data-primary="true">Save variable</button>
      </div>
      <div class="kvs-section">
        <div class="kvs-section-title">Variables on page</div>
        <div class="kvs-var-grid">
          ${vars.length ? vars.map(renderCssVariableButton).join("") : '<div class="kvs-note">No CSS variables found on :root.</div>'}
        </div>
      </div>
    `;
  }

  function renderCssVariableButton(item: { name: string; value: string }) {
    const preview = cssPreviewValue(item.value);
    return `
      <button type="button" data-action="load-css-var" data-var="${escapeAttr(item.name)}" data-value="${escapeAttr(item.value)}">
        <span class="kvs-swatch" style="background:${escapeAttr(preview)}"></span>
        <strong>${escapeHtml(item.name)}</strong>
        <small>${escapeHtml(item.value)}</small>
      </button>
    `;
  }

  function renderHistoryTab() {
    return `
      <div class="kvs-section">
        <div class="kvs-section-title">Undo / Redo</div>
        <div class="kvs-row-actions">
          <button type="button" data-action="undo" ${history.length ? "" : "disabled"}>Undo</button>
          <button type="button" data-action="redo" ${redoStack.length ? "" : "disabled"}>Redo</button>
        </div>
        <div class="kvs-note">Undo uses source ranges returned by the bridge. If the file changed outside the editor, reload first.</div>
      </div>
      <div class="kvs-section">
        <div class="kvs-section-title">Recent edits</div>
        <div class="kvs-history-list">
          ${history.length ? history.slice(-12).reverse().map((item) => `<div><strong>${escapeHtml(item.label)}</strong><small>${new Date(item.createdAt).toLocaleTimeString()}</small></div>`).join("") : '<div class="kvs-note">No edits yet.</div>'}
        </div>
      </div>
    `;
  }

  async function runAction(button: HTMLButtonElement) {
    const action = button.dataset.action || "";
    if (action === "tab") {
      activeTab = (button.dataset.tab as KvsTab) || "edit";
      render();
      return;
    }
    if (action === "toggle") {
      enabled = !enabled;
      setStatus(enabled ? "Inspect mode on. Click an element." : "Inspect mode paused.");
      render();
      return;
    }
    if (action === "refresh") {
      window.location.reload();
      return;
    }
    if (action === "select-layer") {
      const element = findElementBySourceId(button.dataset.sourceId || "");
      if (element) select(element);
      return;
    }
    if (action === "undo") return undoLast();
    if (action === "redo") return redoLast();
    if (action === "apply-css-var") return applyCssVariable();
    if (action === "load-css-var") {
      setInput("cssVarName", button.dataset.var || "");
      setInput("cssVarValue", button.dataset.value || "");
      return;
    }
    if (!selectedElement || !selectedSource) {
      setStatus("Select an element first.");
      render();
      return;
    }

    if (action === "apply-text") return applyText();
    if (action === "apply-classes") return applyClasses();
    if (action === "toggle-token") return toggleClassToken(button.dataset.token || readInput("classToken"));
    if (action === "apply-style") return applyStyle(button.dataset.style || "", readStyleInput(button.dataset.style || ""));
    if (action === "clear-style") return applyStyle(button.dataset.style || "", "", false);
    if (action === "apply-style-value") return applyStyle(button.dataset.style || "", button.dataset.value || "");
    if (action === "apply-image") return applyImageSrc(readInput("imageSrc"));
    if (action === "apply-background-image") return applyStyle("backgroundImage", `url("${readInput("imageSrc")}")`);
    if (action === "use-image-asset") {
      setInput("imageSrc", button.dataset.src || "");
      return applyImageSrc(button.dataset.src || "");
    }
    if (action === "apply-attribute") return applyAttribute(button.dataset.attribute || "", readAttributeInput(button.dataset.attribute || ""), true);
    if (action === "remove-attribute") return applyAttribute(button.dataset.attribute || "", "", false);
    if (action === "load-snippet") {
      const snippet = INSERT_SNIPPETS[Number(button.dataset.snippetIndex || 0)];
      if (snippet) setTextArea("insertJsx", snippet.jsx);
      return;
    }
    if (action === "apply-insert") return insertJsx();
    if (action === "duplicate") return duplicateElement();
    if (action === "remove") return removeElement();
    if (action === "mark-move-source") {
      moveSource = cloneSource(selectedSource);
      setStatus("Move source marked. Select a target and choose a move position.");
      activeTab = "insert";
      render();
      return;
    }
    if (action === "apply-move") return moveElement((button.dataset.position || "after") as "before" | "after" | "inside-start" | "inside-end");
  }

  function select(element: HTMLElement | SVGElement) {
    selectedElement?.classList.remove(SELECTED_CLASS);
    selectedElement = element;
    selectedElement.classList.add(SELECTED_CLASS);
    selectedSource = parseSource(element);
    setStatus(selectedSource ? `Selected <${selectedSource.tag}> from ${selectedSource.file}` : "Invalid source metadata.");
    render();
  }

  async function applyText() {
    if (!selectedSource?.text) {
      setStatus("This element has no safe direct JSX text range.");
      render();
      return;
    }
    const value = readTextArea("textValue");
    await commitEdit("Text", { kind: "set-jsx-text", source: selectedSource, value });
    if (selectedElement) selectedElement.textContent = value;
  }

  async function applyClasses() {
    if (!selectedSource) return;
    const value = readTextArea("classValue");
    await commitEdit("className", { kind: "set-class-name", source: selectedSource, value });
    selectedElement?.setAttribute("class", value);
  }

  async function toggleClassToken(token: string) {
    if (!selectedSource) return;
    const clean = token.trim();
    if (!clean) {
      setStatus("Class token is empty.");
      render();
      return;
    }
    const enabledToken = !selectedElement?.classList.contains(clean);
    await commitEdit(`${enabledToken ? "Add" : "Remove"} class ${clean}`, {
      kind: "set-class-token",
      source: selectedSource,
      token: clean,
      enabled: enabledToken,
    });
    selectedElement?.classList.toggle(clean, enabledToken);
  }

  async function applyStyle(property: string, value: string, enabledValue = true) {
    if (!selectedSource || !property.trim()) return;
    await commitEdit(`${enabledValue ? "Set" : "Clear"} ${property}`, {
      kind: "set-style-prop",
      source: selectedSource,
      property,
      value,
      enabled: enabledValue,
    });
    if (selectedElement instanceof HTMLElement || selectedElement instanceof SVGElement) {
      selectedElement.style.setProperty(toCssProperty(property), enabledValue ? value : "");
    }
  }

  async function applyImageSrc(value: string) {
    if (!selectedSource) return;
    const src = value.trim();
    if (!src) {
      setStatus("Image src is empty.");
      render();
      return;
    }
    await commitEdit("Image src", { kind: "set-image-src", source: selectedSource, value: src });
    selectedElement?.setAttribute("src", src);
  }

  async function applyAttribute(name: string, value: string, enabledValue: boolean) {
    if (!selectedSource) return;
    const cleanName = name.trim();
    if (!cleanName) return;
    await commitEdit(`${enabledValue ? "Set" : "Clear"} ${cleanName}`, {
      kind: "set-jsx-attribute",
      source: selectedSource,
      name: cleanName,
      value,
      enabled: enabledValue,
    });
    if (enabledValue) selectedElement?.setAttribute(cleanName, value);
    else selectedElement?.removeAttribute(cleanName);
  }

  async function insertJsx() {
    if (!selectedSource) return;
    const jsx = readTextArea("insertJsx");
    const position = (readInput("insertPosition") || "after") as "before" | "after" | "inside-start" | "inside-end";
    await commitEdit("Insert JSX", { kind: "insert-jsx-element", anchor: selectedSource, position, jsx });
    setStatus("Inserted into source. Reload to select the new element.");
    render();
  }

  async function duplicateElement() {
    if (!selectedSource) return;
    await commitEdit("Duplicate element", { kind: "duplicate-jsx-element", source: selectedSource });
    setStatus("Duplicated in source. Reload to see source markers on the copy.");
    render();
  }

  async function removeElement() {
    if (!selectedSource) return;
    await commitEdit("Remove element", { kind: "remove-jsx-element", source: selectedSource });
    selectedElement?.remove();
    selectedElement = null;
    selectedSource = null;
    setStatus("Removed from source.");
    render();
  }

  async function moveElement(position: "before" | "after" | "inside-start" | "inside-end") {
    if (!moveSource || !selectedSource) return;
    await commitEdit("Move element", { kind: "move-jsx-element", source: moveSource, target: selectedSource, position });
    moveSource = null;
    setStatus("Moved in source. Reload the preview to resync markers.");
    render();
  }

  async function applyCssVariable() {
    const file = readInput("cssFile") || "src/index.css";
    const name = readInput("cssVarName");
    const value = readInput("cssVarValue");
    if (!name.trim() || !value.trim()) {
      setStatus("CSS variable name and value are required.");
      render();
      return;
    }
    await commitEdit(`CSS variable ${name}`, { kind: "set-css-variable", file, selector: ":root", name, value });
    document.documentElement.style.setProperty(name.startsWith("--") ? name : `--${name}`, value);
  }

  async function commitEdit(label: string, edit: KvsEdit, addToHistory = true) {
    const response = await sendEdit(edit);
    const results = response.results || [];
    updateSelectedSourceFromResults(results);
    const entry = addToHistory ? historyEntryFromResults(label, results) : undefined;
    if (entry) {
      history.push(entry);
      if (history.length > 80) history.shift();
      redoStack = [];
    }
    setStatus(`${label} saved to source.`);
    render();
    return response;
  }

  async function undoLast() {
    const entry = history.pop();
    if (!entry) {
      setStatus("Nothing to undo.");
      render();
      return;
    }
    await sendEdit(entry.undo);
    redoStack.push(entry);
    setStatus(`Undid ${entry.label}.`);
    render();
  }

  async function redoLast() {
    const entry = redoStack.pop();
    if (!entry) {
      setStatus("Nothing to redo.");
      render();
      return;
    }
    await sendEdit(entry.redo);
    history.push(entry);
    setStatus(`Redid ${entry.label}.`);
    render();
  }

  async function sendEdit(edit: KvsEdit): Promise<KvsEditResponse> {
    busy = true;
    setStatus("Saving to source...");
    render();
    try {
      const res = await fetch(BRIDGE_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(edit),
      });
      const json = (await res.json().catch(() => ({}))) as KvsEditResponse;
      if (!res.ok || !json.ok) throw new Error(json.error || `HTTP ${res.status}`);
      return json;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatus(`Save failed: ${message}`);
      render();
      throw error;
    } finally {
      busy = false;
      render();
    }
  }

  function setStatus(value: string) {
    status = value;
  }

  function updateSelectedSourceFromResults(results: KvsAppliedEditResult[]) {
    if (!selectedSource || !results.length) return;
    let next = cloneSource(selectedSource);
    for (const result of results) {
      if (result.file !== next.file || result.nextValue === undefined) continue;
      next = shiftSourceRanges(next, result);
    }
    selectedSource = next;
    selectedElement?.setAttribute(SOURCE_ATTR, JSON.stringify(next));
  }
}

function injectStyle() {
  if (document.getElementById(`${ROOT_ID}-style`)) return;
  const style = document.createElement("style");
  style.id = `${ROOT_ID}-style`;
  style.textContent = `
    .${SELECTED_CLASS} {
      outline: 2px solid #7c8cff !important;
      outline-offset: 2px !important;
    }
    .${HOVER_CLASS}:not(.${SELECTED_CLASS}) {
      outline: 1px dashed #ec4899 !important;
      outline-offset: 2px !important;
    }
    #${ROOT_ID}, #${ROOT_ID} * {
      box-sizing: border-box !important;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
      letter-spacing: 0 !important;
    }
    #${ROOT_ID} {
      position: fixed !important;
      right: 16px !important;
      top: 72px !important;
      z-index: 2147483647 !important;
      width: min(390px, calc(100vw - 24px)) !important;
      height: min(760px, calc(100vh - 88px)) !important;
      min-width: 300px !important;
      min-height: 420px !important;
      color: #e5e7eb !important;
      direction: ltr !important;
      text-align: left !important;
    }
    #${ROOT_ID} .kvs-panel {
      position: relative !important;
      width: 100% !important;
      height: 100% !important;
      overflow: hidden !important;
      display: grid !important;
      grid-template-rows: auto auto auto 1fr auto !important;
      background: linear-gradient(180deg, rgba(14, 18, 28, 0.98), rgba(8, 10, 17, 0.96)) !important;
      border: 1px solid rgba(148, 163, 184, 0.35) !important;
      border-radius: 8px !important;
      box-shadow: 0 22px 70px rgba(0, 0, 0, 0.42) !important;
      backdrop-filter: blur(12px) !important;
    }
    #${ROOT_ID}.kvs-busy .kvs-panel {
      cursor: wait !important;
    }
    #${ROOT_ID} .kvs-header {
      display: flex !important;
      align-items: center !important;
      justify-content: space-between !important;
      gap: 12px !important;
      padding: 12px !important;
      border-bottom: 1px solid rgba(148, 163, 184, 0.18) !important;
      cursor: grab !important;
      user-select: none !important;
    }
    #${ROOT_ID} .kvs-title {
      color: #ffffff !important;
      font-size: 14px !important;
      font-weight: 800 !important;
      line-height: 1.2 !important;
    }
    #${ROOT_ID} .kvs-subtitle {
      color: #93a4bd !important;
      font-size: 11px !important;
      margin-top: 2px !important;
    }
    #${ROOT_ID} .kvs-head-actions,
    #${ROOT_ID} .kvs-row-actions,
    #${ROOT_ID} .kvs-inline {
      display: flex !important;
      align-items: center !important;
      gap: 6px !important;
    }
    #${ROOT_ID} .kvs-head-actions {
      flex-shrink: 0 !important;
    }
    #${ROOT_ID} .kvs-current {
      padding: 10px 12px !important;
      border-bottom: 1px solid rgba(148, 163, 184, 0.16) !important;
      background: rgba(255, 255, 255, 0.035) !important;
    }
    #${ROOT_ID} .kvs-empty-title,
    #${ROOT_ID} .kvs-section-title {
      color: #f8fafc !important;
      font-size: 12px !important;
      font-weight: 800 !important;
      text-transform: uppercase !important;
    }
    #${ROOT_ID} .kvs-help,
    #${ROOT_ID} .kvs-note,
    #${ROOT_ID} .kvs-file,
    #${ROOT_ID} .kvs-status {
      color: #aab7ca !important;
      font-size: 12px !important;
      line-height: 1.45 !important;
      overflow-wrap: anywhere !important;
    }
    #${ROOT_ID} .kvs-breadcrumb {
      color: #ffffff !important;
      font-size: 13px !important;
      font-weight: 750 !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
      white-space: nowrap !important;
    }
    #${ROOT_ID} .kvs-file span {
      color: #8ba4ff !important;
    }
    #${ROOT_ID} .kvs-badges {
      display: flex !important;
      flex-wrap: wrap !important;
      gap: 5px !important;
      margin-top: 7px !important;
    }
    #${ROOT_ID} .kvs-badges span {
      border: 1px solid rgba(124, 140, 255, 0.35) !important;
      background: rgba(124, 140, 255, 0.12) !important;
      color: #cdd5ff !important;
      border-radius: 999px !important;
      padding: 3px 7px !important;
      font-size: 11px !important;
    }
    #${ROOT_ID} .kvs-tabs {
      display: flex !important;
      gap: 4px !important;
      overflow-x: auto !important;
      padding: 8px !important;
      border-bottom: 1px solid rgba(148, 163, 184, 0.16) !important;
    }
    #${ROOT_ID} .kvs-body {
      overflow: auto !important;
      padding: 10px !important;
    }
    #${ROOT_ID} .kvs-section {
      display: grid !important;
      gap: 8px !important;
      padding: 10px !important;
      border: 1px solid rgba(148, 163, 184, 0.16) !important;
      border-radius: 8px !important;
      background: rgba(255, 255, 255, 0.035) !important;
      margin-bottom: 10px !important;
    }
    #${ROOT_ID} .kvs-style-field {
      display: grid !important;
      gap: 6px !important;
      padding: 8px 0 !important;
      border-top: 1px solid rgba(148, 163, 184, 0.12) !important;
    }
    #${ROOT_ID} .kvs-style-field:first-of-type {
      border-top: 0 !important;
      padding-top: 0 !important;
    }
    #${ROOT_ID} label {
      color: #cbd5e1 !important;
      font-size: 11px !important;
      font-weight: 750 !important;
    }
    #${ROOT_ID} input,
    #${ROOT_ID} textarea,
    #${ROOT_ID} select {
      width: 100% !important;
      min-width: 0 !important;
      color: #f8fafc !important;
      background: rgba(2, 6, 23, 0.68) !important;
      border: 1px solid rgba(148, 163, 184, 0.28) !important;
      border-radius: 6px !important;
      padding: 8px !important;
      font-size: 12px !important;
      line-height: 1.35 !important;
      outline: none !important;
    }
    #${ROOT_ID} textarea {
      min-height: 74px !important;
      resize: vertical !important;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace !important;
    }
    #${ROOT_ID} input:focus,
    #${ROOT_ID} textarea:focus,
    #${ROOT_ID} select:focus {
      border-color: rgba(124, 140, 255, 0.78) !important;
      box-shadow: 0 0 0 2px rgba(124, 140, 255, 0.16) !important;
    }
    #${ROOT_ID} button {
      appearance: none !important;
      border: 1px solid rgba(148, 163, 184, 0.18) !important;
      border-radius: 6px !important;
      padding: 7px 9px !important;
      color: #e5e7eb !important;
      background: rgba(51, 65, 85, 0.72) !important;
      font-size: 12px !important;
      line-height: 1.1 !important;
      font-weight: 750 !important;
      cursor: pointer !important;
      white-space: nowrap !important;
    }
    #${ROOT_ID} button:hover:not(:disabled) {
      background: rgba(71, 85, 105, 0.9) !important;
      border-color: rgba(148, 163, 184, 0.36) !important;
    }
    #${ROOT_ID} button[data-primary="true"],
    #${ROOT_ID} .kvs-tabs button[data-active="true"] {
      color: #ffffff !important;
      background: linear-gradient(135deg, #5165ff, #a855f7) !important;
      border-color: rgba(167, 139, 250, 0.6) !important;
    }
    #${ROOT_ID} button[data-danger="true"] {
      color: #fff !important;
      background: rgba(220, 38, 38, 0.82) !important;
      border-color: rgba(248, 113, 113, 0.5) !important;
    }
    #${ROOT_ID} button:disabled {
      opacity: 0.45 !important;
      cursor: not-allowed !important;
    }
    #${ROOT_ID} .kvs-compact-row {
      display: grid !important;
      grid-template-columns: 74px minmax(0, 1fr) auto auto !important;
      gap: 6px !important;
      align-items: center !important;
    }
    #${ROOT_ID} .kvs-chip-grid,
    #${ROOT_ID} .kvs-token-row {
      display: flex !important;
      flex-wrap: wrap !important;
      gap: 6px !important;
    }
    #${ROOT_ID} .kvs-chip-grid button[data-active="true"] {
      background: rgba(124, 140, 255, 0.28) !important;
      border-color: rgba(124, 140, 255, 0.7) !important;
    }
    #${ROOT_ID} .kvs-token-row button {
      display: inline-flex !important;
      align-items: center !important;
      gap: 5px !important;
      padding: 5px 7px !important;
      font-size: 11px !important;
    }
    #${ROOT_ID} .kvs-swatch {
      display: inline-block !important;
      width: 13px !important;
      height: 13px !important;
      border-radius: 4px !important;
      border: 1px solid rgba(255, 255, 255, 0.42) !important;
      flex-shrink: 0 !important;
    }
    #${ROOT_ID} .kvs-asset-grid {
      display: grid !important;
      grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
      gap: 8px !important;
    }
    #${ROOT_ID} .kvs-asset {
      display: grid !important;
      gap: 6px !important;
      text-align: left !important;
      white-space: normal !important;
    }
    #${ROOT_ID} .kvs-asset span:first-child {
      display: block !important;
      aspect-ratio: 16 / 9 !important;
      border-radius: 6px !important;
      background-size: cover !important;
      background-position: center !important;
      background-color: rgba(15, 23, 42, 0.8) !important;
      border: 1px solid rgba(148, 163, 184, 0.16) !important;
    }
    #${ROOT_ID} .kvs-asset strong,
    #${ROOT_ID} .kvs-var-grid strong {
      overflow: hidden !important;
      text-overflow: ellipsis !important;
      white-space: nowrap !important;
    }
    #${ROOT_ID} .kvs-layers {
      display: grid !important;
      gap: 4px !important;
      max-height: 430px !important;
      overflow: auto !important;
    }
    #${ROOT_ID} .kvs-layers button {
      display: grid !important;
      grid-template-columns: auto minmax(0, 1fr) !important;
      gap: 8px !important;
      text-align: left !important;
      width: 100% !important;
    }
    #${ROOT_ID} .kvs-layers small,
    #${ROOT_ID} .kvs-history-list small,
    #${ROOT_ID} .kvs-var-grid small {
      color: #94a3b8 !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
      white-space: nowrap !important;
    }
    #${ROOT_ID} .kvs-var-grid {
      display: grid !important;
      gap: 6px !important;
    }
    #${ROOT_ID} .kvs-var-grid button {
      display: grid !important;
      grid-template-columns: auto minmax(0, 1fr) !important;
      gap: 4px 8px !important;
      text-align: left !important;
    }
    #${ROOT_ID} .kvs-var-grid small {
      grid-column: 2 !important;
    }
    #${ROOT_ID} .kvs-history-list {
      display: grid !important;
      gap: 6px !important;
    }
    #${ROOT_ID} .kvs-history-list div {
      display: flex !important;
      justify-content: space-between !important;
      gap: 8px !important;
      padding: 7px !important;
      border-radius: 6px !important;
      background: rgba(255, 255, 255, 0.04) !important;
    }
    #${ROOT_ID} .kvs-status {
      padding: 9px 12px !important;
      border-top: 1px solid rgba(148, 163, 184, 0.16) !important;
      background: rgba(2, 6, 23, 0.38) !important;
    }
    #${ROOT_ID} .kvs-resize {
      position: absolute !important;
      right: 0 !important;
      bottom: 0 !important;
      width: 18px !important;
      height: 18px !important;
      cursor: nwse-resize !important;
    }
    #${ROOT_ID} code {
      color: #c4b5fd !important;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace !important;
    }
    @media (max-width: 720px) {
      #${ROOT_ID} {
        left: 8px !important;
        right: 8px !important;
        top: 64px !important;
        width: auto !important;
        height: min(680px, calc(100vh - 72px)) !important;
      }
      #${ROOT_ID} .kvs-compact-row {
        grid-template-columns: 1fr !important;
      }
      #${ROOT_ID} .kvs-asset-grid {
        grid-template-columns: 1fr !important;
      }
    }
  `;
  document.head.appendChild(style);
}

function findSourceElement(target: EventTarget | null) {
  let element = target instanceof Element ? target : null;
  while (element && element !== document.documentElement) {
    if (element.hasAttribute(SOURCE_ATTR)) return element as HTMLElement | SVGElement;
    element = element.parentElement;
  }
  return null;
}

function parseSource(element: Element): KvsSource | null {
  try {
    const raw = element.getAttribute(SOURCE_ATTR);
    return raw ? (JSON.parse(raw) as KvsSource) : null;
  } catch {
    return null;
  }
}

function cloneSource(source: KvsSource): KvsSource {
  return JSON.parse(JSON.stringify(source)) as KvsSource;
}

function sourceElements() {
  return Array.from(document.querySelectorAll<HTMLElement | SVGElement>(`[${SOURCE_ATTR}]`)).filter(
    (element) => !element.closest(`#${ROOT_ID}`),
  );
}

function findElementBySourceId(id: string) {
  return sourceElements().find((element) => parseSource(element)?.id === id) || null;
}

function sourceDepth(element: Element) {
  let depth = 0;
  let parent = element.parentElement;
  while (parent && parent !== document.body) {
    if (parent.hasAttribute(SOURCE_ATTR)) depth += 1;
    parent = parent.parentElement;
  }
  return depth;
}

function elementPath(element: Element) {
  const parts: string[] = [];
  let current: Element | null = element;
  while (current && current !== document.body && parts.length < 4) {
    const source = parseSource(current);
    if (source) parts.unshift(labelForElement(current, source.tag));
    current = current.parentElement;
  }
  return parts.join(" > ");
}

function labelForElement(element: Element, tag: string) {
  const id = element.id ? `#${element.id}` : "";
  const className = (element.getAttribute("class") || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((item) => `.${item}`)
    .join("");
  return `${tag}${id}${className}`;
}

function layerLabel(element: Element) {
  const text = (element.textContent || "").trim().replace(/\s+/g, " ");
  const className = (element.getAttribute("class") || "").split(/\s+/).filter(Boolean).slice(0, 3).join(".");
  return text ? text.slice(0, 54) : className ? `.${className}` : classifyElement(element);
}

function classifyElement(element: Element) {
  const tag = element.tagName.toLowerCase();
  if (/^h[1-6]$/.test(tag)) return "Heading";
  if (tag === "p" || tag === "span" || tag === "label") return "Text";
  if (tag === "img" || tag === "picture" || tag === "video") return "Media";
  if (tag === "button" || element.getAttribute("role") === "button") return "Button";
  if (tag === "input" || tag === "textarea" || tag === "select") return "Input";
  if (tag === "section" || tag === "main" || tag === "header" || tag === "footer") return "Section";
  const style = window.getComputedStyle(element);
  if (style.display.includes("grid")) return "Grid";
  if (style.display.includes("flex")) return "Flex";
  return "Element";
}

function styleValue(element: Element, property: string) {
  const cssProperty = toCssProperty(property);
  const inline = (element as HTMLElement | SVGElement).style.getPropertyValue(cssProperty);
  if (inline) return inline.trim();
  const computed = window.getComputedStyle(element).getPropertyValue(cssProperty);
  return computed.trim();
}

function toCssProperty(property: string) {
  if (property.startsWith("--")) return property;
  return property.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

function collectImageAssets(): ImageAsset[] {
  const urls = new Set<string>();
  urls.add("/placeholder.svg");
  document.querySelectorAll<HTMLImageElement>("img[src]").forEach((img) => {
    const src = img.getAttribute("src") || img.currentSrc || img.src;
    if (src && !src.startsWith("data:")) urls.add(src);
  });
  document.querySelectorAll<HTMLSourceElement>("source[srcset]").forEach((source) => {
    const first = (source.getAttribute("srcset") || "").split(",")[0]?.trim().split(/\s+/)[0];
    if (first && !first.startsWith("data:")) urls.add(first);
  });
  document.querySelectorAll<HTMLElement>("*").forEach((element) => {
    if (element.closest(`#${ROOT_ID}`)) return;
    const bg = window.getComputedStyle(element).backgroundImage;
    for (const match of bg.matchAll(/url\(["']?([^"')]+)["']?\)/g)) {
      if (match[1] && !match[1].startsWith("data:")) urls.add(match[1]);
    }
  });
  return Array.from(urls)
    .filter((src) => /\.(png|jpe?g|webp|gif|svg|avif|ico)([?#].*)?$/i.test(src) || src.startsWith("/"))
    .slice(0, 40)
    .map((src) => ({ src, label: fileName(src) }));
}

function collectCssVariables() {
  const style = window.getComputedStyle(document.documentElement);
  const vars: { name: string; value: string }[] = [];
  for (let index = 0; index < style.length; index += 1) {
    const name = style.item(index);
    if (!name.startsWith("--")) continue;
    const value = style.getPropertyValue(name).trim();
    if (!value) continue;
    vars.push({ name, value });
  }
  return vars
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, 80);
}

function historyEntryFromResults(label: string, results: KvsAppliedEditResult[]): HistoryEntry | undefined {
  const usable = results.filter((result) => result.previousValue !== undefined && result.nextValue !== undefined);
  if (!usable.length || usable.length !== results.length) return undefined;

  const undoEdits = usable
    .slice()
    .reverse()
    .map((result) => ({
      kind: "replace-range",
      target: {
        file: result.file,
        start: result.start,
        end: result.start + (result.nextValue || "").length,
        expected: result.nextValue,
      },
      value: result.previousValue || "",
    }));
  const redoEdits = usable.map((result) => ({
    kind: "replace-range",
    target: {
      file: result.file,
      start: result.start,
      end: result.start + (result.previousValue || "").length,
      expected: result.previousValue,
    },
    value: result.nextValue || "",
  }));

  return {
    label,
    undo: undoEdits.length === 1 ? undoEdits[0] : { kind: "batch", edits: undoEdits },
    redo: redoEdits.length === 1 ? redoEdits[0] : { kind: "batch", edits: redoEdits },
    createdAt: Date.now(),
  };
}

function shiftSourceRanges(source: KvsSource, result: KvsAppliedEditResult): KvsSource {
  const delta = (result.nextValue || "").length - (result.end - result.start);
  const next = cloneSource(source);
  const shift = (range: KvsRange | undefined) => {
    if (!range) return;
    if (range.start === result.start && range.end === result.end) {
      range.end = range.start + (result.nextValue || "").length;
      range.expected = result.nextValue;
      return;
    }
    if (range.start >= result.end) {
      range.start += delta;
      range.end += delta;
      return;
    }
    if (range.end >= result.end && range.start <= result.start) {
      range.end += delta;
      range.expected = undefined;
    }
  };
  shift(next.element);
  shift(next.opening);
  shift(next.text);
  shift(next.className);
  shift(next.src);
  shift(next.style);
  next.id = `${next.file}:${next.element.start}:${next.element.end}:${next.tag}`;
  return next;
}

function readInput(name: string) {
  return document.getElementById(ROOT_ID)?.querySelector<HTMLInputElement | HTMLSelectElement>(`[data-field="${name}"]`)?.value || "";
}

function setInput(name: string, value: string) {
  const input = document.getElementById(ROOT_ID)?.querySelector<HTMLInputElement | HTMLSelectElement>(`[data-field="${name}"]`);
  if (input) input.value = value;
}

function readTextArea(name: string) {
  return document.getElementById(ROOT_ID)?.querySelector<HTMLTextAreaElement>(`textarea[data-field="${name}"]`)?.value || "";
}

function setTextArea(name: string, value: string) {
  const textarea = document.getElementById(ROOT_ID)?.querySelector<HTMLTextAreaElement>(`textarea[data-field="${name}"]`);
  if (textarea) textarea.value = value;
}

function readStyleInput(property: string) {
  const root = document.getElementById(ROOT_ID);
  const input = Array.from(root?.querySelectorAll<HTMLInputElement>("[data-style-input]") || []).find(
    (item) => item.dataset.styleInput === property,
  );
  return input?.value || "";
}

function readAttributeInput(name: string) {
  const root = document.getElementById(ROOT_ID);
  const input = Array.from(root?.querySelectorAll<HTMLInputElement>("[data-attribute-input]") || []).find(
    (item) => item.dataset.attributeInput === name,
  );
  return input?.value || "";
}

function restorePanelPosition(root: HTMLElement) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw) as Partial<Record<"left" | "top" | "width" | "height", number>>;
    if (typeof saved.left === "number") {
      root.style.left = `${Math.max(0, saved.left)}px`;
      root.style.right = "auto";
    }
    if (typeof saved.top === "number") root.style.top = `${Math.max(0, saved.top)}px`;
    if (typeof saved.width === "number") root.style.width = `${Math.max(300, saved.width)}px`;
    if (typeof saved.height === "number") root.style.height = `${Math.max(420, saved.height)}px`;
  } catch {
    // Ignore invalid local storage.
  }
}

function savePanelPosition(root: HTMLElement) {
  const rect = root.getBoundingClientRect();
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
    }),
  );
}

function beginDrag(event: PointerEvent, root: HTMLElement) {
  const rect = root.getBoundingClientRect();
  const offsetX = event.clientX - rect.left;
  const offsetY = event.clientY - rect.top;
  const move = (next: PointerEvent) => {
    root.style.left = `${clamp(next.clientX - offsetX, 4, window.innerWidth - rect.width - 4)}px`;
    root.style.top = `${clamp(next.clientY - offsetY, 4, window.innerHeight - 80)}px`;
    root.style.right = "auto";
  };
  const up = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    savePanelPosition(root);
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
}

function beginResize(event: PointerEvent, root: HTMLElement) {
  event.preventDefault();
  const rect = root.getBoundingClientRect();
  const startX = event.clientX;
  const startY = event.clientY;
  const move = (next: PointerEvent) => {
    root.style.width = `${clamp(rect.width + next.clientX - startX, 300, window.innerWidth - rect.left - 8)}px`;
    root.style.height = `${clamp(rect.height + next.clientY - startY, 420, window.innerHeight - rect.top - 8)}px`;
  };
  const up = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    savePanelPosition(root);
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function unique(values: readonly string[]) {
  return Array.from(new Set(values));
}

function fileName(path: string) {
  return path.split(/[\\/]/).filter(Boolean).pop()?.split(/[?#]/)[0] || path;
}

function isColorLike(value: string) {
  return /^(#|rgb|hsl|oklch|lab|color\(|var\()/i.test(value);
}

function cssPreviewValue(raw: string) {
  const value = raw.trim();
  if (!value) return "transparent";
  if (/^-?\d+(\.\d+)?\s+\d+(\.\d+)?%\s+\d+(\.\d+)?%/.test(value)) return `hsl(${value})`;
  return value;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(value: string) {
  return escapeHtml(value);
}

function escapeCssUrl(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}
