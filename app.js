(() => {
  'use strict';

  const LOCAL_KEY = 'botanic-inventory-state-v1';
  const routes = ['dashboard','warehouse','history','receipt','issuance','pack-move','box-move'];
  let state = null;
  let busy = false;

  const $ = (s, r=document) => r.querySelector(s);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clone = v => JSON.parse(JSON.stringify(v));
  const grams = n => Math.round(Number(n) || 0);
  const fmtG = n => `${grams(n).toLocaleString('cs-CZ')} g`;
  const signedG = n => `${grams(n) > 0 ? '+' : ''}${grams(n).toLocaleString('cs-CZ')} g`;
  const material = id => state.materials.find(m => m.id === id);
  const pack = id => state.packs.find(p => p.id === id);
  const totalMaterial = id => state.packs.filter(p => p.materialId === id).reduce((a,p) => a + grams(p.qty), 0);
  const route = () => location.hash.replace(/^#\/?/, '') || 'dashboard';
  const go = r => { location.hash = r; };

  async function loadState() {
    const local = localStorage.getItem(LOCAL_KEY);
    if (local) { state = JSON.parse(local); return; }
    const r = await fetch('data.json', {cache:'no-store'});
    if (!r.ok) throw Error('Nelze načíst data.json');
    state = await r.json();
  }
  function persist() {
    state.updatedAt = new Date().toISOString();
    localStorage.setItem(LOCAL_KEY, JSON.stringify(state));
  }
  async function resetState() {
    const r = await fetch('data.seed.json', {cache:'no-store'});
    if (!r.ok) throw Error('Nelze načíst seed data');
    state = await r.json();
    persist();
  }
  function nextPackId() {
    const max = state.packs.reduce((n,p) => Math.max(n, Number(String(p.id).match(/^P-(\d+)$/)?.[1] || 0)), 0);
    return `P-${String(max + 1).padStart(4,'0')}`;
  }
  function addEvent(type, data={}) {
    state.history.unshift({id:`EV-${Date.now()}`, at:new Date().toISOString(), type, ...data});
    state.history = state.history.slice(0, 500);
  }
  function statusFor(p) {
    const m = material(p.materialId);
    if (grams(p.qty) <= 0) return ['Prázdný','empty'];
    if (m && totalMaterial(m.id) <= grams(m.min)) return ['Nízký stav','warning'];
    return ['OK','ok'];
  }
  function iconFor(r) {
    return ({receipt:'fa-arrow-down-to-bracket',issuance:'fa-arrow-up-from-bracket','pack-move':'fa-right-left','box-move':'fa-arrows-left-right-to-line'})[r] || 'fa-layer-group';
  }
  function setBusy(on, title='Pracuji…', sub='Probíhá operace') {
    busy = on;
    document.body.classList.toggle('is-busy', on);
    const o = $('[data-busy]');
    if (o) { $('[data-busy-title]').textContent = title; $('[data-busy-sub]').textContent = sub; o.classList.toggle('open', on); }
  }
  async function run(title, task) {
    setBusy(true, title, 'Ukládám změnu…');
    await new Promise(r => setTimeout(r, 260));
    try { await task(); persist(); render(); } finally { setBusy(false); }
  }

  function layout(title, subtitle='') {
    const r = route();
    document.querySelector('#app').innerHTML = `
      <div class="app-shell">
        <aside class="sidebar">
          <div class="brand"><div class="brand-mark">B</div><div><b>BOTANIC</b><small>Inventory</small></div></div>
          <div class="nav-label">HLAVNÍ</div>
          <nav>${navButton('dashboard','fa-chart-pie','Dashboard',r)}${navButton('warehouse','fa-boxes-stacked','Sklad',r)}${navButton('history','fa-clock-rotate-left','Historie',r)}</nav>
          <div class="nav-label">OPERACE</div>
          <nav>${navButton('receipt','fa-arrow-down-to-bracket','Příjem',r)}${navButton('issuance','fa-arrow-up-from-bracket','Výdej',r)}${navButton('pack-move','fa-right-left','Přesun packu',r)}${navButton('box-move','fa-arrows-left-right-to-line','Přesun boxu',r)}</nav>
          <div class="sidebar-bottom"><button class="nav-button subtle" data-reset><i class="fa-solid fa-rotate"></i>Obnovit demo data</button><div class="connection"><i class="fa-solid fa-circle"></i> Browser demo · JSON</div></div>
        </aside>
        <main class="main">
          <header class="topbar"><button class="icon-button" data-back aria-label="Zpět"><i class="fa-solid fa-arrow-left"></i></button><div><div class="top-title">${esc(title)}</div><div class="top-subtitle">${esc(subtitle)}</div></div><div class="top-actions"><button class="button secondary small" data-nav="warehouse"><i class="fa-solid fa-boxes-stacked"></i>Sklad</button><span class="user">DEMO</span></div></header>
          <div class="page" id="view"></div>
        </main>
        <nav class="mobile-nav">${navButton('dashboard','fa-chart-pie','Přehled',r)}${navButton('warehouse','fa-boxes-stacked','Sklad',r)}${navButton('receipt','fa-arrow-down-to-bracket','Příjem',r)}${navButton('history','fa-clock-rotate-left','Historie',r)}</nav>
      </div>
      <div class="overlay busy-overlay" data-busy><div class="busy-card"><span class="spinner"></span><div><b data-busy-title>Pracuji…</b><small data-busy-sub>Probíhá operace</small></div></div></div>
      <div class="overlay" data-modal><div class="modal"><div class="modal-head"><div><span class="eyebrow">FINÁLNÍ KONTROLA</span><h2 data-modal-title>Potvrzení</h2></div><button class="icon-button" data-modal-close><i class="fa-solid fa-xmark"></i></button></div><div data-modal-body></div><div class="modal-actions"><button class="button secondary" data-modal-cancel>Zrušit</button><button class="button primary" data-modal-ok><i class="fa-solid fa-check"></i>Potvrdit</button></div></div></div>`;
    document.querySelectorAll('[data-nav]').forEach(b => b.onclick = () => go(b.dataset.nav));
    $('[data-back]').onclick = () => history.length > 1 ? history.back() : go('dashboard');
    $('[data-reset]').onclick = confirmReset;
    $('[data-modal-close]').onclick = closeModal;
    $('[data-modal-cancel]').onclick = closeModal;
  }
  function navButton(id, icon, label, active) { return `<button class="nav-button ${id===active?'active':''}" data-nav="${id}"><i class="fa-solid ${icon}"></i><span>${label}</span></button>`; }
  function pageHead(kicker, title, sub, actions='') { return `<div class="page-head"><div><span class="eyebrow">${esc(kicker)}</span><h1>${esc(title)}</h1><p>${esc(sub)}</p></div><div class="toolbar">${actions}</div></div>`; }
  function amount(n, cls='') { return `<span class="amount ${cls}">${fmtG(n)}</span>`; }
  function stat(label, value, meta='') { return `<div class="stat"><span>${esc(label)}</span><strong>${esc(value)}</strong>${meta?`<small>${esc(meta)}</small>`:''}</div>`; }
  function packRow(p) { const m=material(p.materialId); const [s,sc]=statusFor(p); return `<button class="table-row" data-pack="${esc(p.id)}"><div><b class="mono">${esc(p.id)}</b><small>${esc(m?.name||'—')}</small></div><div class="right">${amount(p.qty)}</div><div class="chip mono">${esc(p.box)}</div><div>${esc(p.position||'—')}</div><div><span class="status ${sc}">${esc(s)}</span></div><i class="fa-solid fa-chevron-right row-chevron"></i></button>`; }

  function renderDashboard() {
    const total=state.packs.reduce((a,p)=>a+grams(p.qty),0), low=state.materials.filter(m=>totalMaterial(m.id)<=grams(m.min)).length;
    layout('Dashboard','Aktuální stav skladu');
    $('#view').innerHTML = `${pageHead('PŘEHLED','Sklad v kostce','Nejdůležitější stavová data na jednom místě',`<button class="button primary" data-nav="receipt"><i class="fa-solid fa-arrow-down-to-bracket"></i>Příjem</button><button class="button secondary" data-nav="issuance"><i class="fa-solid fa-arrow-up-from-bracket"></i>Výdej</button>`)}
      <section class="stats">${stat('CELKEM NA SKLADU',fmtG(total),'všechny packy')}${stat('AKTIVNÍ PACKY',state.packs.length,'evidované jednotky')}${stat('SUROVINY',state.materials.length,'katalog')}${stat('NÍZKÝ STAV',low,low?'vyžaduje pozornost':'bez upozornění')}</section>
      <div class="split"><section class="panel"><div class="panel-head"><div><span class="eyebrow">STAV SUROVIN</span><h2>Zásoba podle suroviny</h2></div><button class="text-button" data-nav="warehouse">Zobrazit sklad <i class="fa-solid fa-arrow-right"></i></button></div><div class="table compact">${state.materials.map(m=>{const q=totalMaterial(m.id), low=q<=grams(m.min);return `<button class="table-row" data-material="${esc(m.id)}"><div><b>${esc(m.name)}</b><small class="mono">${esc(m.id)}</small></div><div class="right">${amount(q,low?'low':'')}</div><div>${state.packs.filter(p=>p.materialId===m.id).length} pack</div><div><span class="status ${low?'warning':'ok'}">${low?'Nízký stav':'OK'}</span></div></button>`}).join('')}</div></section>
      <section class="panel"><div class="panel-head"><div><span class="eyebrow">POSLEDNÍ POHYBY</span><h2>Aktivita</h2></div><button class="text-button" data-nav="history">Historie <i class="fa-solid fa-arrow-right"></i></button></div><div class="activity">${state.history.slice(0,6).map(eventRow).join('')||empty('Žádné pohyby','Příjem vytvoří první záznam.')}</div></section></div>`;
    bindRows(); bindNav();
  }
  function eventRow(e) { const delta=e.delta?`<span class="${e.delta>0?'positive':'negative'}">${signedG(e.delta)}</span>`:'<span class="muted">Přesun</span>'; return `<div class="activity-row"><div class="event-icon"><i class="fa-solid ${iconFor(e.type==='Příjem'?'receipt':e.type==='Výdej'?'issuance':'pack-move')}"></i></div><div><b>${esc(e.type)}</b><small><span class="mono">${esc(e.packId||'—')}</span> · ${esc(e.material||'')}</small></div><div class="right">${delta}</div></div>`; }
  function empty(title, sub) { return `<div class="empty"><i class="fa-regular fa-folder-open"></i><b>${esc(title)}</b><span>${esc(sub)}</span></div>`; }
  function bindRows() { document.querySelectorAll('[data-pack]').forEach(b=>b.onclick=()=>detailPack(b.dataset.pack)); document.querySelectorAll('[data-material]').forEach(b=>b.onclick=()=>detailMaterial(b.dataset.material)); }
  function bindNav() { document.querySelectorAll('[data-nav]').forEach(b=>b.onclick=()=>go(b.dataset.nav)); }

  function renderWarehouse() {
    layout('Sklad','Packy, boxy a aktuální množství');
    $('#view').innerHTML=`${pageHead('INVENTURA','Sklad','Přehled všech packů s klíčovými identifikátory',`<button class="button primary" data-nav="receipt"><i class="fa-solid fa-plus"></i> Příjem</button>`)}<section class="panel flush"><div class="table-head"><span>PACK / SUROVINA</span><span class="right">HMOTNOST</span><span>BOX</span><span>POZICE</span><span>STAV</span><span></span></div><div class="table">${state.packs.map(packRow).join('')}</div></section>`;
    bindRows(); bindNav();
  }
  function detailPack(id) { const p=pack(id); if(!p)return; const m=material(p.materialId),[s,sc]=statusFor(p); layout(p.id, m?.name||'Detail packu'); $('#view').innerHTML=`${pageHead('PACK DETAIL',p.id,m?.name||'Surovina',`<button class="button primary" data-nav="issuance"><i class="fa-solid fa-arrow-up-from-bracket"></i>Výdej</button>`)}<div class="detail-grid"><section class="hero-panel"><span class="eyebrow">AKTUÁLNÍ HMOTNOST</span><strong class="hero-number">${fmtG(p.qty)}</strong><span class="status ${sc}">${s}</span><div class="hero-meta"><span>BOX <b class="chip mono">${esc(p.box)}</b></span><span>POZICE <b>${esc(p.position||'—')}</b></span></div></section><section class="panel"><div class="panel-head"><div><span class="eyebrow">IDENTIFIKACE</span><h2>Podrobnosti</h2></div></div><div class="meta-grid">${meta('Pack ID',p.id,true)}${meta('Surovina',m?.name)}${meta('Box',p.box,true)}${meta('Pozice',p.position)}${meta('LOT / Šarže',p.lot)}${meta('Expirace',p.expiry||'—')}</div></section></div><section class="panel"><div class="panel-head"><div><span class="eyebrow">HISTORIE</span><h2>Pohyby packu</h2></div></div><div class="activity">${state.history.filter(e=>e.packId===p.id).map(eventRow).join('')||empty('Bez historie','Pro tento pack zatím není pohyb.')}</div></section>`; bindNav(); }
  function meta(k,v,mono=false){return `<div class="meta"><span>${esc(k)}</span><b class="${mono?'mono':''}">${esc(v||'—')}</b></div>`;}
  function detailMaterial(id) { const m=material(id); if(!m)return; const ps=state.packs.filter(p=>p.materialId===id); layout(m.name,'Detail suroviny'); $('#view').innerHTML=`${pageHead('SUROVINA',m.name,`${m.id} · minimum ${fmtG(m.min)}`)}<section class="stats">${stat('CELKEM',fmtG(totalMaterial(id)),'sklad')}${stat('PACKY',ps.length,'jednotky')}${stat('MINIMUM',fmtG(m.min),'prahová hodnota')}</section><section class="panel flush"><div class="table-head"><span>PACK</span><span class="right">HMOTNOST</span><span>BOX</span><span>LOT</span><span>EXPIRACE</span><span>STAV</span></div><div class="table">${ps.map(p=>{const[s,sc]=statusFor(p);return `<button class="table-row" data-pack="${p.id}"><div><b class="mono">${p.id}</b></div><div class="right">${amount(p.qty)}</div><div><span class="chip mono">${p.box}</span></div><div class="mono">${esc(p.lot||'—')}</div><div>${esc(p.expiry||'—')}</div><div><span class="status ${sc}">${s}</span></div></button>`}).join('')}</div></section>`; bindRows(); }
  function renderHistory(){ layout('Historie','Auditní stopa všech pohybů'); $('#view').innerHTML=`${pageHead('AUDIT','Historie','Každá změna skladu zůstává dohledatelná',`<button class="button secondary" id="csv"><i class="fa-solid fa-file-csv"></i>CSV</button>`)}<section class="panel flush"><div class="table-head"><span>OPERACE</span><span>PACK</span><span>ZMĚNA</span><span>DATUM</span><span>TRASA</span></div><div class="table">${state.history.length?state.history.map(e=>`<div class="table-row"><div><b>${esc(e.type)}</b><small>${esc(e.material||'')}</small></div><div class="mono">${esc(e.packId||'—')}</div><div>${e.delta?`<span class="${e.delta>0?'positive':'negative'}">${signedG(e.delta)}</span>`:'<span class="muted">Přesun</span>'}</div><div>${new Date(e.at).toLocaleString('cs-CZ')}</div><div class="mono">${esc(e.from||'')} ${e.to?'→ '+esc(e.to):''}</div></div>`).join(''):empty('Žádná historie','Proveďte první operaci.')}</div></section>`; $('#csv').onclick=exportCsv; }
  function exportCsv(){ const rows=[['id','datum','typ','pack','material','delta_g','from','to'],...state.history.map(e=>[e.id,e.at,e.type,e.packId||'',e.material||'',e.delta??'',e.from||'',e.to||''])]; const csv=rows.map(r=>r.map(v=>`"${String(v).replaceAll('"','""')}"`).join(';')).join('\n'); const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv'}));a.download='botanic-history.csv';a.click();URL.revokeObjectURL(a.href); }

  function renderOperation(type){
    const cfg={receipt:['Příjem','Navýšit existující pack nebo založit nový pack','PŘÍJEM'],issuance:['Výdej','Odebrat množství z vybraného packu','VÝDEJ'],'pack-move':['Přesun packu','Přemístit celý pack do jiného boxu','PŘESUN PACKU'],'box-move':['Přesun boxu','Přemístit box a zachovat jeho obsah','PŘESUN BOXU']}[type];
    layout(cfg[0],cfg[1]);
    const packs=state.packs.filter(p=>type==='issuance'?grams(p.qty)>0:true);
    $('#view').innerHTML=`${pageHead('OPERACE',cfg[0],cfg[1])}<section class="operation-card"><div class="operation-title"><div class="operation-icon"><i class="fa-solid ${iconFor(type)}"></i></div><div><span class="eyebrow">${cfg[2]}</span><h2>${cfg[0]}</h2></div><span class="unit">Jednotka <b>g</b></span></div><form id="operation-form" class="operation-form">${type==='box-move'?boxMoveFields():packOperationFields(type,packs)}<div class="form-actions"><button type="button" class="button secondary" data-nav="dashboard">Zrušit</button><button class="button primary" type="submit"><i class="fa-solid ${iconFor(type)}"></i>${cfg[0]}</button></div></form></section>`;
    bindNav(); $('#operation-form').onsubmit=e=>{e.preventDefault();prepareOperation(type,e.currentTarget);}; updateSelection();
    $('#operation-form').querySelectorAll('select').forEach(s=>s.onchange=updateSelection);
  }
  function packOptions(){ return state.packs.map(p=>{const m=material(p.materialId);return `<option value="${p.id}">${p.id} · ${esc(m?.name||'—')} · ${fmtG(p.qty)}</option>`}).join(''); }
  function packOperationFields(type,packs){
    const selected=packs[0]?.id||'';
    return `<div class="operation-grid"><div class="primary-field"><span class="field-label">HLAVNÍ ÚDAJ</span><label for="qty">${type==='issuance'?'Vydávaná':'Přijímaná'} hmotnost</label><div class="big-input"><input id="qty" name="qty" type="number" min="1" step="1" value="1000" required inputmode="numeric"><b>g</b></div><small>Gramy jsou jediná používaná jednotka.</small></div><div class="field"><label>Pack</label><select name="pack" id="pack">${packOptions()}</select><div class="selection" data-selection></div></div></div>${type==='pack-move'?`<div class="field"><label>Cílový box</label><select name="toBox">${state.boxes.map(b=>`<option value="${b.id}">${b.id} · ${esc(b.name)}</option>`).join('')}</select></div>`:type==='receipt'?`<div class="subgrid"><div class="field"><label>Surovina pro nový pack</label><select name="material">${state.materials.map(m=>`<option value="${m.id}">${esc(m.name)}</option>`).join('')}</select></div><div class="field"><label>Box</label><select name="box">${state.boxes.map(b=>`<option value="${b.id}">${b.id}</option>`).join('')}</select></div><div class="field"><label>Šarže / LOT</label><input name="lot" placeholder="např. 26A-081"></div><div class="field"><label>Pozice</label><input name="position" value="A01-01"></div><div class="field"><label>Expirace</label><input name="expiry" type="date"></div><div class="field"><label>Nový Pack ID</label><div class="generated mono">${nextPackId()} <small>automaticky</small></div></div></div>`:''}`;
  }
  function boxMoveFields(){ return `<div class="field"><label>Box</label><select name="box">${state.boxes.map(b=>`<option value="${b.id}">${b.id} · ${esc(b.name)}</option>`).join('')}</select></div><div class="field"><label>Cílová pozice</label><input name="position" value="A01-01"></div><div class="box-preview" data-box-preview></div>`; }
  function updateSelection(){ const f=$('#operation-form'); if(!f)return; const s=f.querySelector('[data-selection]'); const p=pack(f.elements.pack?.value); if(s&&p){const m=material(p.materialId);s.innerHTML=`<div class="selection-main"><b class="mono">${p.id}</b><strong>${esc(m?.name||'—')}</strong><span>${fmtG(p.qty)}</span></div><div class="selection-meta"><span>BOX <b class="chip mono">${p.box}</b></span><span>LOT <b class="mono">${esc(p.lot||'—')}</b></span><span>${esc(p.position||'—')}</span></div>`;}}
  function prepareOperation(type,form){
    const data=Object.fromEntries(new FormData(form));
    if(type!=='box-move' && (!data.qty || grams(data.qty)<=0)) return error('Zadejte kladnou hmotnost.');
    if(type==='issuance' && grams(data.qty)>grams(pack(data.pack)?.qty)) return error('Nelze vydat více než aktuální zásoba packu.');
    const p=pack(data.pack);
    let summary=[];
    if(type==='receipt'){ const isNew=data.pack===''; if(!isNew && p){summary=[['Pack',p.id],['Surovina',material(p.materialId)?.name],['Změna',`${fmtG(p.qty)} → +${fmtG(data.qty)} → ${fmtG(p.qty+grams(data.qty))}`],['Box',p.box],['LOT',p.lot||'—']];} else {summary=[['Nový Pack',nextPackId()],['Surovina',material(data.material)?.name],['Hmotnost',fmtG(data.qty)],['Box',data.box],['LOT',data.lot||'—'],['Pozice',data.position||'—']];}}
    if(type==='issuance'&&p) summary=[['Pack',p.id],['Surovina',material(p.materialId)?.name],['Změna',`${fmtG(p.qty)} → −${fmtG(data.qty)} → ${fmtG(p.qty-grams(data.qty))}`],['Box',p.box],['LOT',p.lot||'—']];
    if(type==='pack-move'&&p) summary=[['Pack',p.id],['Box',`${p.box} → ${data.toBox}`],['Pozice',p.position||'—'],['Hmotnost',fmtG(p.qty)]];
    if(type==='box-move') summary=[['Box',data.box],['Nová pozice',data.position],['Obsah',`${state.packs.filter(p=>p.box===data.box).length} pack`]];
    confirmModal(type,summary,()=>commitOperation(type,data));
  }
  function error(msg){ const old=$('.form-error'); if(old)old.remove(); const f=$('#operation-form');const e=document.createElement('div');e.className='form-error';e.innerHTML=`<i class="fa-solid fa-circle-exclamation"></i>${esc(msg)}`;f.prepend(e); }
  function confirmModal(type,rows,action){ $('[data-modal-title]').textContent='Potvrdit operaci'; $('[data-modal-body]').innerHTML=`<div class="confirm-list">${rows.map(r=>`<div><span>${esc(r[0])}</span><b>${esc(r[1])}</b></div>`).join('')}</div>`; $('[data-modal-ok]').onclick=async()=>{closeModal();await run('Ukládám operaci…',action)}; $('[data-modal]').classList.add('open'); }
  function closeModal(){ $('[data-modal]')?.classList.remove('open'); }
  async function confirmReset(){ $('[data-modal-title]').textContent='Obnovit demo data'; $('[data-modal-body]').innerHTML='<div class="warning-box"><i class="fa-solid fa-triangle-exclamation"></i><div><b>Současné změny v tomto prohlížeči budou odstraněny.</b><span>Obnoví se data z data.seed.json.</span></div></div>'; $('[data-modal-ok]').textContent='Obnovit data'; $('[data-modal-ok]').onclick=async()=>{closeModal();await run('Obnovuji data…',resetState)}; $('[data-modal]').classList.add('open'); }
  async function commitOperation(type,d){
    if(type==='receipt'){
      let p=pack(d.pack);
      if(!p){p={id:nextPackId(),materialId:d.material,qty:0,box:d.box,position:d.position,lot:d.lot,expiry:d.expiry};state.packs.push(p);}
      p.qty+=grams(d.qty); addEvent('Příjem',{packId:p.id,material:material(p.materialId)?.name,delta:grams(d.qty),to:p.box});
    } else if(type==='issuance'){
      const p=pack(d.pack);p.qty-=grams(d.qty);addEvent('Výdej',{packId:p.id,material:material(p.materialId)?.name,delta:-grams(d.qty),from:p.box});
    } else if(type==='pack-move'){
      const p=pack(d.pack),from=p.box;p.box=d.toBox;addEvent('Přesun packu',{packId:p.id,material:material(p.materialId)?.name,delta:0,from,to:p.box});
    } else { const ps=state.packs.filter(p=>p.box===d.box);ps.forEach(p=>p.position=d.position);addEvent('Přesun boxu',{boxId:d.box,delta:0,to:d.position}); }
  }

  function render(){ const r=route(); if(r==='dashboard')return renderDashboard(); if(r==='warehouse')return renderWarehouse(); if(r==='history')return renderHistory(); if(['receipt','issuance','pack-move','box-move'].includes(r))return renderOperation(r); renderDashboard(); }
  window.addEventListener('hashchange',render);
  (async()=>{try{await loadState();render();}catch(e){document.querySelector('#app').innerHTML=`<main class="fatal"><i class="fa-solid fa-triangle-exclamation"></i><h1>Nelze načíst aplikaci</h1><p>${esc(e.message)}</p></main>`;}})();
})();
