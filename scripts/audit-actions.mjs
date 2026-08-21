import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const roots = ['app', 'components'];
const strict = process.argv.includes('--strict');
const findings = [];

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return entry.isFile() && /\.(tsx|jsx)$/.test(entry.name) ? [full] : [];
  });
}
function attr(node, name) {return node.attributes?.properties?.find((p) => ts.isJsxAttribute(p) && p.name.text === name)}
function textOf(node) {let out='';function visit(n){if(ts.isJsxText(n))out+=` ${n.getText()}`;else if(ts.isStringLiteral(n))out+=` ${n.text}`;else if(ts.isJsxExpression(n)&&n.expression&&ts.isStringLiteral(n.expression))out+=` ${n.expression.text}`;ts.forEachChild(n,visit)}visit(node);return out.replace(/\s+/g,' ').trim()}
function isImplicitSubmit(node,sf){let current=node.parent;while(current){if(ts.isJsxElement(current)){const tag=current.openingElement.tagName.getText(sf);if(tag==='form')return !!attr(current.openingElement,'onSubmit')}current=current.parent}return false}

for(const file of roots.flatMap(walk)){
 const source=fs.readFileSync(file,'utf8');
 const sf=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 function visit(node){
  if(ts.isJsxElement(node)&&node.openingElement.tagName.getText(sf)==='button'){
   const hasOnClick=!!attr(node.openingElement,'onClick');
   const type=attr(node.openingElement,'type');
   const explicitSubmit=!!type&&type.initializer&&ts.isStringLiteral(type.initializer)&&type.initializer.text==='submit';
   const formSubmit=isImplicitSubmit(node,sf);
   if(!hasOnClick&&!explicitSubmit&&!formSubmit){const pos=sf.getLineAndCharacterOfPosition(node.getStart(sf));const label=textOf(node)||'(unlabelled)';findings.push(`${file}:${pos.line+1} button "${label.slice(0,90)}" has no executable handler`)}
  }
  ts.forEachChild(node,visit)
 }
 visit(sf)
}
console.log(`VEMS UI button audit: ${findings.length} decorative/non-executable button(s).`);
for(const item of findings)console.log(`ACTION_AUDIT: ${item}`);
if(strict&&findings.length)process.exit(1);
