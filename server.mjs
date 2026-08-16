import { join, normalize, extname } from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';

const root = import.meta.dir;
const dataFile = join(root, 'data.json');
const seedFile = join(root, 'data.seed.json');
const port = Number(process.env.PORT || 8080);
const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8'};
const json = (body,status=200) => new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
const readJson = f => readFile(f,'utf8').then(JSON.parse);
const valid = s => {
  if(!s || !Array.isArray(s.materials) || !Array.isArray(s.packs) || !Array.isArray(s.boxes) || !Array.isArray(s.history)) throw Error('Invalid state');
  const mids=new Set(s.materials.map(x=>x.id)), bids=new Set(s.boxes.map(x=>x.id)), pids=new Set(s.packs.map(x=>x.id));
  if(mids.size!==s.materials.length || bids.size!==s.boxes.length || pids.size!==s.packs.length) throw Error('Duplicate ID');
  for(const m of s.materials) if(m.unit!=='g'||!Number.isInteger(m.min)||m.min<0) throw Error(`Invalid material ${m.id}`);
  for(const p of s.packs) if(!mids.has(p.materialId)||!bids.has(p.box)||!Number.isInteger(p.qty)||p.qty<0) throw Error(`Invalid pack ${p.id}`);
  return s;
};
function safe(pathname){const rel=pathname==='/'?'index.html':decodeURIComponent(pathname).replace(/^\/+/,''), full=normalize(join(root,rel));return full===root||full.startsWith(root+'/')||full.startsWith(root+'\\')?full:null;}
Bun.serve({port,async fetch(req){try{const u=new URL(req.url);
  if(u.pathname==='/api/state'){
    if(req.method==='GET') return json(await readJson(dataFile));
    if(req.method==='PUT'){const next=valid(await req.json());next.updatedAt=new Date().toISOString();await writeFile(dataFile,JSON.stringify(next,null,2)+'\n');return json(next);}
  }
  if(u.pathname==='/api/reset'&&req.method==='POST'){const seed=valid(await readJson(seedFile));seed.updatedAt=new Date().toISOString();await writeFile(dataFile,JSON.stringify(seed,null,2)+'\n');return json(seed);}
  const full=safe(u.pathname);if(!full)return new Response('Forbidden',{status:403});const f=Bun.file(full);if(!(await f.exists()))return new Response('Not found',{status:404});return new Response(f,{headers:{'Content-Type':mime[extname(full)]||'text/plain; charset=utf-8'}});
}catch(e){return json({error:e.message||'Server error'},500)}}});
console.log(`Botanic Inventory · http://localhost:${port}`);
