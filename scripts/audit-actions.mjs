import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const roots = ['app', 'components'];
const strict = process.argv.includes('--strict');
const actionWords = /\b(save|create|update|delete|remove|submit|approve|reject|cancel|complete|settle|allocate|issue|block|unblock|assign|upload|confirm|release|hold|reconcile|convert|add|edit|send|execute|record|apply|schedule|mark|close|reopen|transfer|receive|dispatch|move|adjust)\b/i;
const findings = [];

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return entry.isFile() && /\.(tsx|jsx)$/.test(entry.name) ? [full] : [];
  });
}

function attr(node, name) {
  return node.attributes?.properties?.find((p) => ts.isJsxAttribute(p) && p.name.text === name);
}

function textOf(node) {
  let out = '';
  function visit(n) {
    if (ts.isJsxText(n)) out += ` ${n.getText()}`;
    else if (ts.isStringLiteral(n)) out += ` ${n.text}`;
    else if (ts.isJsxExpression(n) && n.expression && ts.isStringLiteral(n.expression)) out += ` ${n.expression.text}`;
    ts.forEachChild(n, visit);
  }
  visit(node);
  return out.replace(/\s+/g, ' ').trim();
}

for (const file of roots.flatMap(walk)) {
  const source = fs.readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  function visit(node) {
    if (ts.isJsxElement(node)) {
      const tag = node.openingElement.tagName.getText(sf);
      if (tag === 'button') {
        const label = textOf(node);
        if (label && actionWords.test(label)) {
          const hasOnClick = !!attr(node.openingElement, 'onClick');
          const type = attr(node.openingElement, 'type');
          const isSubmit = !!type && type.initializer && ts.isStringLiteral(type.initializer) && type.initializer.text === 'submit';
          if (!hasOnClick && !isSubmit) {
            const pos = sf.getLineAndCharacterOfPosition(node.getStart(sf));
            findings.push(`${file}:${pos.line + 1} action button "${label.slice(0, 90)}" has no onClick and is not type=submit`);
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sf);
}

console.log(`VEMS UI action audit: ${findings.length} potential decorative action button(s).`);
for (const item of findings) console.log(`ACTION_AUDIT: ${item}`);
if (strict && findings.length) process.exit(1);
