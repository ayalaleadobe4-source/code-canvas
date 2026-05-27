import path from "node:path";
import type { Plugin, ResolvedConfig } from "vite";
import ts from "typescript";

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
};

type Insertion = {
  pos: number;
  text: string;
};

const DATA_ATTR = "data-kvs-source";

export default function kvsVisualEditorPlugin(): Plugin {
  let config: ResolvedConfig | undefined;

  return {
    name: "kvs-visual-editor",
    apply: "serve",
    enforce: "pre",
    configResolved(resolved) {
      config = resolved;
    },
    transform(code, id) {
      const cleanId = id.split("?", 1)[0];
      if (!/\.[jt]sx$/.test(cleanId) || isIgnoredFile(cleanId)) return null;

      const root = config?.root || process.cwd();
      const file = normalizePath(path.relative(root, cleanId));
      const scriptKind = cleanId.endsWith(".jsx") ? ts.ScriptKind.JSX : ts.ScriptKind.TSX;
      const result = instrumentJsx(code, file, scriptKind);

      return result.changed ? { code: result.code, map: null } : null;
    },
    configureServer(server) {
      server.middlewares.use("/__kvs/health", (_req, res) => {
        res.statusCode = 200;
        res.setHeader("content-type", "application/json; charset=utf-8");
        res.end(JSON.stringify({ ok: true, plugin: "kvs-visual-editor" }));
      });
    },
  };
}

function instrumentJsx(code: string, file: string, scriptKind: ts.ScriptKind) {
  const sourceFile = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true, scriptKind);
  const inserts: Insertion[] = [];

  function visit(node: ts.Node) {
    if (ts.isJsxElement(node)) {
      maybeAddSource(code, sourceFile, file, node, node.openingElement, inserts);
    } else if (ts.isJsxSelfClosingElement(node)) {
      maybeAddSource(code, sourceFile, file, node, node, inserts);
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  if (!inserts.length) return { changed: false, code };

  let next = code;
  for (const insertion of inserts.sort((a, b) => b.pos - a.pos)) {
    next = `${next.slice(0, insertion.pos)}${insertion.text}${next.slice(insertion.pos)}`;
  }

  return { changed: true, code: next };
}

function maybeAddSource(
  code: string,
  sourceFile: ts.SourceFile,
  file: string,
  element: ts.JsxElement | ts.JsxSelfClosingElement,
  opening: ts.JsxOpeningElement | ts.JsxSelfClosingElement,
  inserts: Insertion[],
) {
  const tag = opening.tagName.getText(sourceFile);
  if (!isDomTag(tag) || hasAttribute(sourceFile, opening, DATA_ATTR)) return;

  const meta = buildSourceMeta(code, sourceFile, file, element, opening, tag);
  const jsonLiteral = JSON.stringify(JSON.stringify(meta));
  inserts.push({
    pos: attributeInsertionPoint(code, opening),
    text: ` ${DATA_ATTR}={${jsonLiteral}}`,
  });
}

function buildSourceMeta(
  code: string,
  sourceFile: ts.SourceFile,
  file: string,
  element: ts.JsxElement | ts.JsxSelfClosingElement,
  opening: ts.JsxOpeningElement | ts.JsxSelfClosingElement,
  tag: string,
): KvsSource {
  const elementStart = element.getStart(sourceFile);
  const elementEnd = element.end;
  const openingStart = opening.getStart(sourceFile);
  const openingEnd = opening.end;
  const meta: KvsSource = {
    id: `${file}:${elementStart}:${elementEnd}:${tag}`,
    file,
    tag,
    element: { start: elementStart, end: elementEnd },
    opening: { start: openingStart, end: openingEnd },
  };

  const className = stringAttributeRange(sourceFile, opening, "className");
  if (className) meta.className = className;

  const src = stringAttributeRange(sourceFile, opening, "src");
  if (src) meta.src = src;

  if (ts.isJsxElement(element)) {
    const text = directTextRange(code, element);
    if (text) meta.text = text;
  }

  return meta;
}

function directTextRange(code: string, element: ts.JsxElement): KvsRange | undefined {
  const meaningful = element.children.filter((child) => {
    if (ts.isJsxText(child)) return child.getText().trim().length > 0;
    if (ts.isJsxExpression(child) && !child.expression) return false;
    return true;
  });

  if (meaningful.length !== 1 || !ts.isJsxText(meaningful[0])) return undefined;

  const child = meaningful[0];
  const raw = code.slice(child.pos, child.end);
  const leading = raw.match(/^\s*/)?.[0].length || 0;
  const trailing = raw.match(/\s*$/)?.[0].length || 0;
  const start = child.pos + leading;
  const end = child.end - trailing;
  if (start >= end) return undefined;

  return { start, end, expected: code.slice(start, end) };
}

function stringAttributeRange(
  sourceFile: ts.SourceFile,
  opening: ts.JsxOpeningElement | ts.JsxSelfClosingElement,
  name: string,
): KvsRange | undefined {
  const attr = opening.attributes.properties.find(
    (prop): prop is ts.JsxAttribute => ts.isJsxAttribute(prop) && prop.name.getText(sourceFile) === name,
  );
  if (!attr?.initializer) return undefined;

  if (ts.isStringLiteral(attr.initializer)) return literalInnerRange(sourceFile, attr.initializer);
  if (ts.isJsxExpression(attr.initializer) && attr.initializer.expression) {
    const expr = attr.initializer.expression;
    if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) {
      return literalInnerRange(sourceFile, expr);
    }
  }

  return undefined;
}

function literalInnerRange(sourceFile: ts.SourceFile, literal: ts.StringLiteral | ts.NoSubstitutionTemplateLiteral): KvsRange {
  const start = literal.getStart(sourceFile) + 1;
  const end = literal.end - 1;
  return { start, end, expected: literal.text };
}

function attributeInsertionPoint(code: string, opening: ts.JsxOpeningElement | ts.JsxSelfClosingElement) {
  const start = opening.getStart();
  const end = opening.end;
  const close = code.lastIndexOf(">", end);
  if (close >= start) return code[close - 1] === "/" ? close - 1 : close;
  return end - 1;
}

function hasAttribute(sourceFile: ts.SourceFile, opening: ts.JsxOpeningElement | ts.JsxSelfClosingElement, name: string) {
  return opening.attributes.properties.some(
    (prop) => ts.isJsxAttribute(prop) && prop.name.getText(sourceFile) === name,
  );
}

function isDomTag(tag: string) {
  return /^[a-z][a-z0-9:-]*$/.test(tag);
}

function isIgnoredFile(file: string) {
  const normalized = normalizePath(file);
  return normalized.includes("/node_modules/") || normalized.includes("/.kvs/") || normalized.includes("/.vite/");
}

function normalizePath(value: string) {
  return value.replace(/\\/g, "/");
}
