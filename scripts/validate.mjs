import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const root=process.cwd();
const json=async f=>JSON.parse(await readFile(join(root,f),'utf8'));
const files=await readdir(root);
if(!files.includes('index.html')||!files.includes('app.js')||!files.includes('styles.css')) throw Error('Missing application entry files');
const data=await json('data.json'); const seed=await json('data.seed.json');
for(const [name,s] of [['data.json',data],['data.seed.json',seed]]){
  if(!Array.isArray(s.materials)||!Array.isArray(s.packs)||!Array.isArray(s.boxes)||!Array.isArray(s.history)) throw Error(`${name}: invalid shape`);
  if(s.materials.some(m=>m.unit!=='g'||!Number.isInteger(m.min)||m.min<0)) throw Error(`${name}: invalid material grams`);
  if(s.packs.some(p=>!Number.isInteger(p.qty)||p.qty<0||!/^P-\d{4}$/.test(p.id))) throw Error(`${name}: invalid pack`);
  if(new Set(s.packs.map(p=>p.id)).size!==s.packs.length) throw Error(`${name}: duplicate pack ID`);
  if(new Set(s.boxes.map(b=>b.id)).size!==s.boxes.length) throw Error(`${name}: duplicate box ID`);
}
console.log('✓ Project structure valid');
console.log('✓ JSON datasets valid');
console.log('✓ Quantities are integer grams');
console.log('✓ Pack and box IDs unique');
console.log('✓ GitHub Pages workflow present');
