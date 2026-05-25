import { parse } from "@babel/parser";
import _traverse from "@babel/traverse";

// @babel/traverse default-export interop
const traverse: typeof _traverse =
  (_traverse as unknown as { default?: typeof _traverse }).default ?? _traverse;

export type EditableText = {
  id: string;
  kind: "jsx-text" | "jsx-attr";
  attrName?: string;
  value: string;
  start: number;
  end: number;
  line: number;
};

// Attributes worth surfacing as user-visible copy.
const EDITABLE_ATTRS = new Set([
  "alt",
  "title",
  "placeholder",
  "aria-label",
  "label",
]);

export function extractEditableTexts(source: string): EditableText[] {
  let ast;
  try {
    ast = parse(source, {
      sourceType: "module",
      plugins: ["jsx", "typescript"],
      ranges: true,
      errorRecovery: true,
    });
  } catch {
    return [];
  }

  const out: EditableText[] = [];
  let counter = 0;

  traverse(ast, {
    JSXText(path) {
      const node = path.node;
      const raw = node.value;
      if (!raw.trim()) return;
      const lead = raw.match(/^\s*/)?.[0].length ?? 0;
      const trail = raw.match(/\s*$/)?.[0].length ?? 0;
      const start = (node.start ?? 0) + lead;
      const end = (node.end ?? 0) - trail;
      out.push({
        id: `t${counter++}`,
        kind: "jsx-text",
        value: source.slice(start, end),
        start,
        end,
        line: node.loc?.start.line ?? 0,
      });
    },
    JSXAttribute(path) {
      const name = path.node.name;
      if (name.type !== "JSXIdentifier") return;
      if (!EDITABLE_ATTRS.has(name.name)) return;
      const v = path.node.value;
      if (!v || v.type !== "StringLiteral") return;
      // Skip surrounding quotes
      const start = (v.start ?? 0) + 1;
      const end = (v.end ?? 0) - 1;
      out.push({
        id: `t${counter++}`,
        kind: "jsx-attr",
        attrName: name.name,
        value: source.slice(start, end),
        start,
        end,
        line: v.loc?.start.line ?? 0,
      });
    },
  });

  return out;
}

export function applyTextEdits(
  source: string,
  edits: { start: number; end: number; value: string }[],
): string {
  // Apply from end to start so offsets stay valid.
  const sorted = [...edits].sort((a, b) => b.start - a.start);
  let out = source;
  for (const e of sorted) {
    out = out.slice(0, e.start) + e.value + out.slice(e.end);
  }
  return out;
}
