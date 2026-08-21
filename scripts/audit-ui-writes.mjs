import fs from 'node:fs';
import path from 'node:path';

const roots=['app','components'];
const strict=process.argv.includes('--strict');
const findings=[];
function walk(dir){if(!fs.existsSync(dir))return[];return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>{const p=path.join(dir,e.name);if(e.isDirectory())return walk(p);return e.isFile()&&/\.(tsx|jsx)$/.test(e.name)?[p]:[]})}
for(const file of roots.flatMap(walk)){
 const src=fs.readFileSync(file,'utf8');
 const lines=src.split(/\r?\n/);
 lines.forEach((line,i)=>{
  if(/\.from\([^\n]+\)\.(insert|update|delete|upsert)\s*\(/.test(line))findings.push(`${file}:${i+1} direct table mutation in UI; route writes through a verified data layer/RPC`)
 })
}
console.log(`VEMS UI write audit: ${findings.length} direct database mutation(s) in UI files.`);
for(const f of findings)console.log(`WRITE_AUDIT: ${f}`);
if(strict&&findings.length)process.exit(1);
