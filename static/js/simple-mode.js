/* ============================================================
   MOD GEÇİŞ KÖPRÜSÜ — Basit Mod <-> Gelişmiş Mod
============================================================ */
function setAppMode(mode){
  document.body.classList.remove('mode-simple','mode-advanced');
  document.body.classList.add('mode-'+mode);
  document.getElementById('msBtnSimple').classList.toggle('active', mode==='simple');
  document.getElementById('msBtnAdvanced').classList.toggle('active', mode==='advanced');
}

/* ============================================================
   BASİT MOD (Sahne Kârlılık Hesaplayıcı)
============================================================ */

const STEPS = [
  {key:'maliyet', label:'Toplam Maliyet', unit:'₺', placeholder:'örn. 500000', hint:'Personel + sabit + prodüksiyon — tek toplam rakam yeterli.'},
  {key:'fiyat', label:'Bilet / Ürün Fiyatı', unit:'₺', placeholder:'örn. 1200', hint:'Kesintiler düşülmeden önceki brüt fiyat.'},
  {key:'kesinti', label:'Toplam Kesinti Oranı', unit:'%', placeholder:'örn. 25', hint:'KDV, komisyon, rusum vb. hepsi birlikte, tek yüzde.'},
  {key:'adet', label:'Beklenen Satış Adedi', unit:'adet', placeholder:'örn. 800', hint:'Bu etkinlikte satacağını tahmin ettiğin toplam adet.'},
  {key:'hedefMarj', label:'Hedef Kâr Marjı', unit:'%', placeholder:'örn. 30', hint:'Boş bırakırsan sadece "kârda mıyım?" kontrol edilir.', optional:true}
];

let values = {};
let current = 0; // aktif adım index'i
let finished = false;
values.adetMode = 'direct'; // 'direct' | 'formula'

const sFmt = n => (isFinite(n)?n:0).toLocaleString('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2});

/* ---------- Binlik ayraçlı canlı gösterim (100000 -> 100.000) ----------
   values[] içinde HER ZAMAN temiz, hesaplanabilir rakam (örn. "100000" ya
   da "1200.5") tutulur; kutucukta GÖRÜNEN metin ise noktalı/virgüllü halidir. */
function rawToDisplay(raw){
  if(raw===undefined || raw===null || raw==='') return '';
  let s = String(raw);
  const neg = s.startsWith('-');
  if(neg) s = s.slice(1);
  let [intPart, decPart] = s.split('.');
  intPart = (intPart||'').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return (neg?'-':'') + intPart + (decPart!==undefined ? ','+decPart : '');
}
function displayToRaw(display){
  if(!display) return '';
  const neg = display.trim().startsWith('-');
  const cleaned = display.replace(/[^\d,]/g,'');
  const parts = cleaned.split(',');
  const intPart = parts[0] || '';
  const decPart = parts.length>1 ? parts.slice(1).join('') : undefined;
  return (neg?'-':'') + intPart + (decPart!==undefined ? '.'+decPart : '');
}
function liveFormat(el, key){
  const raw = displayToRaw(el.value);
  values[key] = raw;
  el.value = rawToDisplay(raw);
  el.setSelectionRange(el.value.length, el.value.length);
}

function adetFormulaUrun(){
  return (+values.adetGun||0) * (+values.adetKisi||0) * (+values.adetSeans||0);
}
function setAdetMode(mode){
  values.adetMode = mode;
  render();
  setTimeout(()=>{
    const el = document.getElementById(mode==='direct' ? 'input-adet' : 'input-adetGun');
    if(el) el.focus();
  }, 50);
}
function onFormulaInput(el, key){
  values[key] = displayToRaw(el.value);
  el.value = rawToDisplay(values[key]);
  el.setSelectionRange(el.value.length, el.value.length);
  const urun = adetFormulaUrun();
  values.adet = String(urun);
  document.getElementById('input-adet').value = rawToDisplay(values.adet);
  document.getElementById('adetUrunGoster').textContent = sFmt(urun) + ' adet';
}

function sCalc(){
  const maliyet = +values.maliyet||0;
  const fiyat = +values.fiyat||0;
  const kesinti = +values.kesinti||0;
  const adet = +values.adet||0;
  const hedefMarj = values.hedefMarj!==undefined && values.hedefMarj!=='' ? +values.hedefMarj : null;

  const netFiyat = fiyat * (1 - kesinti/100);
  const toplamGelir = netFiyat * adet;
  const netKar = toplamGelir - maliyet;
  const karMarji = toplamGelir ? (netKar/toplamGelir*100) : 0;
  const esik = hedefMarj !== null ? hedefMarj : 0;
  const ok = hedefMarj !== null ? karMarji >= esik : netKar > 0;

  return {netFiyat, toplamGelir, netKar, karMarji, ok, hedefMarj};
}

/* ---------- Gelişmiş moda aktarım ----------
   Basit moddaki değerler (values) doğrudan importFromSahne()'e verilir. */
function goToAdvancedWithSahneData(){
  importFromSahne(values);
  renderAll();
  setAppMode('advanced');
}

/* Düzenleme modunda bir alandan ayrılınca (Enter'a basmadan) otomatik kaydet.
   goTo() tıklamasıyla aynı anda tetiklenirse (adım zaten değiştiyse) tekrar işlem yapma. */
function __onEditBlur(){
  const stepAtBlur = current;
  setTimeout(()=>{
    if(current !== stepAtBlur) return; // bu arada goTo() zaten halletti
    const active = document.activeElement;
    if(active && active.closest && active.closest('.step-body')) return; // aynı kutu içinde odak değişti (örn. formül alanları arası)
    advance();
  }, 120);
}

/* Para/adet alanları liveFormat/onFormulaInput tarafından zaten values[] içinde
   temiz (noktasız) tutuluyor — o alanlarda ekrandaki (noktalı) metni değil,
   values[]'daki güncel temiz değeri esas al. */
function readStepRaw(step){
  const isMoney = (step.unit==='₺' || step.unit==='adet');
  if(isMoney) return values[step.key] || '';
  const el = document.getElementById('input-'+step.key);
  return el ? el.value.trim().replace(',', '.') : ''; // "12,5" -> "12.5"
}

function commitActiveInput(){
  const step = STEPS[current];
  if(!step) return;
  const el = document.getElementById('input-'+step.key);
  if(el){
    const raw = readStepRaw(step);
    if(raw !== '' || step.optional) values[step.key] = raw;
  }
}

function goTo(i){
  commitActiveInput(); // düzenlediğin alandan Enter'a basmadan başka bir adıma tıklarsan bile veri kaybolmasın
  current = i;
  finished = false;
  render();
  setTimeout(()=>{
    const el = document.getElementById('input-'+STEPS[i].key);
    if(el) el.focus();
  }, 50);
}

function advance(){
  const step = STEPS[current];
  const el = document.getElementById('input-'+step.key);
  const raw = readStepRaw(step);
  if(raw === '' && !step.optional){ el.focus(); return; }
  values[step.key] = raw;
  if(current < STEPS.length - 1){
    current++;
    // Sonraki adımlar zaten doluysa (daha önce girilmiş bir değeri düzenleyip geri
    // dönüyorsan), onları tekrar tek tek "Devam"latmaya zorlamak yerine doğrudan
    // sonuca dön — girdiğin veriler asla silinmiyor, sadece akış konumu ilerliyor.
    const kalanlarDolu = STEPS.slice(current).every(s => s.optional || (values[s.key]!==undefined && values[s.key]!==''));
    if(kalanlarDolu){
      finished = true;
      render();
      return;
    }
    render();
    setTimeout(()=>{
      const nextEl = document.getElementById('input-'+STEPS[current].key);
      if(nextEl) nextEl.focus();
    }, 60);
  }else{
    finished = true;
    render();
  }
}

function skip(){
  values[STEPS[current].key] = '';
  if(current < STEPS.length - 1){
    current++;
    const kalanlarDolu = STEPS.slice(current).every(s => s.optional || (values[s.key]!==undefined && values[s.key]!==''));
    if(kalanlarDolu){ finished = true; render(); return; }
    render();
    setTimeout(()=>{ const n=document.getElementById('input-'+STEPS[current].key); if(n) n.focus(); },60);
  }
  else{ finished = true; render(); }
}

function restart(){
  values = {}; current = 0; finished = false; render();
  setTimeout(()=>{ const el=document.getElementById('input-'+STEPS[0].key); if(el) el.focus(); },50);
}

function stepHasValue(s){
  return values[s.key] !== undefined && values[s.key] !== '';
}

function stepBodyHtml(s, isEditing){
  const blurAttr = isEditing ? `onblur="__onEditBlur()"` : '';
  if(s.key !== 'adet'){
    const isMoney = (s.unit==='₺' || s.unit==='adet');
    const displayVal = isMoney ? rawToDisplay(values[s.key]||'') : (values[s.key]||'');
    const inputAttr = isMoney ? `oninput="liveFormat(this,'${s.key}')"` : '';
    return `
        <input id="input-${s.key}" type="text" inputmode="decimal" autocomplete="off"
          placeholder="${s.placeholder}" value="${displayVal}"
          onkeydown="if(event.key==='Enter'){advance();}" ${inputAttr} ${blurAttr}>
        <div class="step-hint">${isEditing ? 'Değişiklik yapıp Enter\'a bas ya da başka bir yere tıkla — otomatik kaydedilir.' : s.hint}</div>`;
  }
  const mode = values.adetMode || 'direct';
  const urun = adetFormulaUrun();
  return `
        <div class="radio-row">
          <label class="radio-opt ${mode==='direct'?'sel':''}">
            <input type="radio" name="adetMode" ${mode==='direct'?'checked':''} onchange="setAdetMode('direct')"> Direkt adet gir
          </label>
          <label class="radio-opt ${mode==='formula'?'sel':''}">
            <input type="radio" name="adetMode" ${mode==='formula'?'checked':''} onchange="setAdetMode('formula')"> Gün × Kişi Adedi × Seans
          </label>
        </div>
        <input id="input-adet" type="text" inputmode="decimal" autocomplete="off"
          style="${mode==='formula'?'display:none;':''}"
          placeholder="${s.placeholder}" value="${rawToDisplay(values.adet||'')}"
          onkeydown="if(event.key==='Enter'){advance();}" oninput="liveFormat(this,'adet')" ${blurAttr}>
        ${mode==='formula' ? `
        <div class="formula-grid">
          <div><label class="mini-label">Gün</label><input id="input-adetGun" type="text" inputmode="decimal" autocomplete="off" placeholder="22" value="${rawToDisplay(values.adetGun||'')}" oninput="onFormulaInput(this,'adetGun')" onkeydown="if(event.key==='Enter'){advance();}" ${blurAttr}></div>
          <div><label class="mini-label">Kişi Adedi</label><input id="input-adetKisi" type="text" inputmode="decimal" autocomplete="off" placeholder="40" value="${rawToDisplay(values.adetKisi||'')}" oninput="onFormulaInput(this,'adetKisi')" onkeydown="if(event.key==='Enter'){advance();}" ${blurAttr}></div>
          <div><label class="mini-label">Seans</label><input id="input-adetSeans" type="text" inputmode="decimal" autocomplete="off" placeholder="3" value="${rawToDisplay(values.adetSeans||'')}" oninput="onFormulaInput(this,'adetSeans')" onkeydown="if(event.key==='Enter'){advance();}" ${blurAttr}></div>
        </div>
        <div class="formula-result">= <span id="adetUrunGoster">${sFmt(urun)} adet</span></div>
        ` : ''}
        <div class="step-hint">${isEditing ? 'Değişiklik yapıp Enter\'a bas ya da başka bir yere tıkla — otomatik kaydedilir.' : s.hint}</div>`;
}

function render(){
  const stepsEl = document.getElementById('steps');
  stepsEl.innerHTML = STEPS.map((s,i)=>{
    let state = 'upcoming';
    if(i < current || (finished && i<=current)) state = 'done';
    if(i === current && !finished) state = 'active';
    const isMoneyUnit = (s.unit==='₺' || s.unit==='adet');
    const shownVal = isMoneyUnit ? rawToDisplay(values[s.key]) : values[s.key];
    const displayVal = values[s.key] !== undefined && values[s.key] !== '' ? shownVal+' '+s.unit : (values[s.key]==='' ? '—' : '');
    const isEditing = state==='active' && stepHasValue(s);

    return `
    <div class="step ${state}" ${state==='done' ? `onclick="goTo(${i})"` : ''}>
      <div class="step-row">
        <div style="display:flex; align-items:center; gap:10px; flex:1;">
          <div class="step-num">${state==='done' ? '✓' : i+1}</div>
          <div class="step-label">${s.label}${s.optional?' <span style=\"font-weight:400;color:var(--text-faint);\">(opsiyonel)</span>':''}</div>
        </div>
        ${state==='done' ? `<div class="step-value">${displayVal}</div>` : ''}
      </div>
      <div class="step-body">
        ${stepBodyHtml(s, isEditing)}
        ${isEditing ? '' : `
        <div class="step-actions">
          <button class="btn btn-primary" onclick="advance()">${i===STEPS.length-1?'Hesapla →':'Devam →'}</button>
          ${s.optional ? `<button class="btn btn-ghost" onclick="skip()">Atla</button>` : ''}
        </div>`}
      </div>
    </div>`;
  }).join('');

  const resultZone = document.getElementById('resultZone');
  if(finished){
    const r = sCalc();
    resultZone.innerHTML = `
      <div class="result">
        <div class="result-grid">
          <div class="result-stat"><div class="l">Net Birim Fiyat</div><div class="v">${sFmt(r.netFiyat)} ₺</div></div>
          <div class="result-stat"><div class="l">Toplam Gelir</div><div class="v">${sFmt(r.toplamGelir)} ₺</div></div>
          <div class="result-stat"><div class="l">Net Kâr</div><div class="v" style="color:${r.netKar>=0?'var(--success)':'var(--danger)'}">${sFmt(r.netKar)} ₺</div></div>
          <div class="result-stat"><div class="l">Kâr Marjı</div><div class="v">%${sFmt(r.karMarji)}</div></div>
        </div>
        <div class="verdict ${r.ok?'ok':'no'}">
          <div>
            <h2>${r.ok?'✅ Kârdasınız':'❌ Karda Değilsiniz'}</h2>
            <p>${r.hedefMarj!==null ? `Hedef marj: %${r.hedefMarj}` : 'Net kâr pozitif mi kontrol edildi'}</p>
          </div>
          <div class="big">%${sFmt(r.karMarji)}</div>
        </div>
        <a href="#" class="roi-cta" onclick="goToAdvancedWithSahneData(); return false;">Gelişmiş Modda Devam Et →</a>
        <div style="text-align:center; margin-top:12px;">
          <button class="btn btn-primary" onclick="sExportExcel()">⬇ Excel'e Aktar</button>
        </div>
      </div>
    `;
  }else{
    resultZone.innerHTML = '';
  }
}

/* ============================================================
   BASİT MOD — EXCEL'E AKTAR
   Ekran görüntüsündeki tabloyla aynı düzen: GİDER/GELİR satırları,
   Toplam Kâr ve KÂR ORANI kalın çerçeveli kutularda, negatifse kırmızı.
============================================================ */
async function sExportExcel(){
  const r = sCalc();
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Kârlılık Özeti', {views:[{showGridLines:false}]});
  ws.columns = [{width:4},{width:26},{width:20},{width:18},{width:20}];

  const thin = {style:'thin', color:{argb:'FF000000'}};
  const thinBorder = {top:thin, left:thin, bottom:thin, right:thin};
  const boldBorder = {top:{style:'medium',color:{argb:'FF000000'}}, left:{style:'medium',color:{argb:'FF000000'}}, bottom:{style:'medium',color:{argb:'FF000000'}}, right:{style:'medium',color:{argb:'FF000000'}}};
  const headFill = {type:'pattern', pattern:'solid', fgColor:{argb:'FFF2F2F2'}};
  const negRed = 'FFCC0000', posBlack = 'FF000000';

  ws.mergeCells('B2:E2');
  const title = ws.getCell('B2');
  title.value = 'Sahne Kârlılık Hesabı — ' + new Date().toLocaleDateString('tr-TR');
  title.font = {bold:true, size:14};

  ['B4','C4','D4'].forEach((addr,i)=>{
    const c = ws.getCell(addr);
    c.value = ['','TUTAR','AÇIKLAMA'][i];
    c.font = {bold:true}; c.border = thinBorder; c.fill = headFill; c.alignment = {horizontal:'center'};
  });

  const dataRow = (rowNum, label, value, note) => {
    const l = ws.getCell(`B${rowNum}`); l.value = label; l.font = {bold:true}; l.border = thinBorder;
    const v = ws.getCell(`C${rowNum}`); v.value = value; v.numFmt = '#,##0.00 "₺"'; v.border = thinBorder; v.alignment={horizontal:'right'};
    const n = ws.getCell(`D${rowNum}`); n.value = note||''; n.border = thinBorder; n.font={italic:true, size:10, color:{argb:'FF666666'}};
  };
  dataRow(5, 'GİDER (Toplam Maliyet)', +values.maliyet||0, '');
  dataRow(6, 'GELİR (Toplam)', r.toplamGelir, `Net birim fiyat: ${sFmt(r.netFiyat)} ₺`);

  ws.mergeCells('B9:C9');
  const karLabel = ws.getCell('B9'); karLabel.value = 'Toplam Kâr'; karLabel.font = {bold:true, size:12}; karLabel.border = boldBorder; karLabel.alignment={vertical:'middle'};
  const karVal = ws.getCell('D9'); karVal.value = r.netKar; karVal.numFmt = '#,##0.00 "₺"';
  karVal.font = {bold:true, size:12, color:{argb: r.netKar<0?negRed:posBlack}};
  karVal.border = boldBorder; karVal.alignment={horizontal:'right', vertical:'middle'};

  ws.mergeCells('B11:C11');
  const oranLabel = ws.getCell('B11'); oranLabel.value = 'KÂR ORANI'; oranLabel.font = {bold:true, size:12, color:{argb: r.karMarji<0?negRed:posBlack}}; oranLabel.border = boldBorder; oranLabel.alignment={vertical:'middle'};
  const oranVal = ws.getCell('D11'); oranVal.value = r.karMarji/100; oranVal.numFmt = '0.00%';
  oranVal.font = {bold:true, size:12, color:{argb: r.karMarji<0?negRed:posBlack}};
  oranVal.border = boldBorder; oranVal.alignment={horizontal:'right', vertical:'middle'};

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'sahne_karlilik_hesabi.xlsx';
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

render();
setTimeout(()=>{ const el=document.getElementById('input-'+STEPS[0].key); if(el) el.focus(); },100);
