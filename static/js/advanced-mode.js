/* ============================================================
   GELİŞMİŞ MOD (Encore ROI Calculator)
============================================================ */
/* ============================================================
   STATE — projeler Flask API üzerinden SQLite'ta saklanır.
============================================================ */
let jobs = [];
let state = null;
/* Eski kayıtlarda "tarih" alanı yoktu — aniden kilitlenmesinler diye
   oluşturulma tarihinden türetiyoruz. */
function ensureTarih(s){
  if(!s.tarih) s.tarih = (s.createdAt || new Date().toISOString()).slice(0,10);
  return s;
}
function initState(){
  if(jobs.length>0) return ensureTarih(JSON.parse(JSON.stringify(jobs[0])));
  const fresh = blankState();
  jobs = [fresh];
  sunucuyaKaydet(fresh);
  return fresh;
}

/* ============================================================
   KAYITLI PROJELER (sunucu — sol panel)
============================================================ */
async function sunucuyaKaydet(proje){
  try{
    await fetch('/api/projeler', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(proje)
    });
  }catch(err){
    console.error('Sunucuya kaydedilemedi:', err);
  }
}

async function sunucudanSil(id){
  try{
    await fetch('/api/projeler/' + encodeURIComponent(id), {method: 'DELETE'});
  }catch(err){
    console.error('Sunucudan silinemedi:', err);
  }
}
/* Her tuş vuruşunda istek atmamak (ve sırası karışan isteklerin eski veriyi
   son yazmasını önlemek) için kayıt 400ms bekletilir. */
let __saveTimer = null, __bekleyen = null;
function autosave(){
  if(!state) return;
  const idx = jobs.findIndex(j=>j.id===state.id);
  if(idx>=0) jobs[idx]=state; else jobs.unshift(state);
  // Bekleyen kayıt başka bir projeye aitse iptal etme, hemen gönder.
  if(__bekleyen && __bekleyen.id !== state.id) sunucuyaKaydet(__bekleyen);
  __bekleyen = state;
  clearTimeout(__saveTimer);
  __saveTimer = setTimeout(()=>{ sunucuyaKaydet(__bekleyen); __bekleyen = null; }, 400);
  renderSidebar();
}
function newJob(){
  state = blankState();
  jobs.unshift(state);
  sunucuyaKaydet(state);
  renderAll();
  closeMobileSidebar();
}
function loadJob(id){
  const found = jobs.find(j=>j.id===id);
  if(!found) return;
  state = ensureTarih(JSON.parse(JSON.stringify(found)));
  renderAll();
  closeMobileSidebar();
}

/* ---------- Mobil hamburger menü (Kayıtlı Projeler) ---------- */
function toggleMobileSidebar(){
  const sb = document.getElementById('sidebar');
  const bd = document.getElementById('sidebarBackdrop');
  if(!sb) return;
  const isOpen = sb.classList.toggle('mobile-open');
  if(bd) bd.classList.toggle('show', isOpen);
}
function closeMobileSidebar(){
  const sb = document.getElementById('sidebar');
  const bd = document.getElementById('sidebarBackdrop');
  if(sb) sb.classList.remove('mobile-open');
  if(bd) bd.classList.remove('show');
}
function deleteJob(id, ev){
  ev.stopPropagation();
  if(!confirm('Bu projeyi silmek istediğinize emin misiniz?')) return;
  // Silinen projenin bekleyen kaydı DELETE'ten sonra gidip onu geri getirmesin.
  if(__bekleyen && __bekleyen.id===id){ clearTimeout(__saveTimer); __bekleyen = null; }
  jobs = jobs.filter(j=>j.id!==id);
  if(jobs.length===0){ jobs=[blankState()]; sunucuyaKaydet(jobs[0]); }
  sunucudanSil(id);
  if(state && state.id===id){ state = ensureTarih(JSON.parse(JSON.stringify(jobs[0]))); }
  renderAll();
}

function renderSidebar(){
  const list = document.getElementById('jobList');
  if(!list) return;
  if(jobs.length===0){ list.innerHTML = '<div class="empty-jobs">Henüz proje yok. Aşağıdaki + ile ilk projeni oluştur.</div>'; return; }
  list.innerHTML = jobs.map(j=>{
    const d = new Date(j.createdAt || Date.now());
    const ds = d.toLocaleDateString('tr-TR');
    return `<div class="job-item ${state && j.id===state.id?'active':''}" data-id="${escAttr(j.id)}" onclick="loadJob(this.dataset.id)" style="display:flex; align-items:center; justify-content:space-between; gap:6px;">
      <div style="min-width:0;">
        <div class="jn">${escAttr(j.name) || 'İsimsiz proje'}</div>
        <div class="jd">${ds}</div>
      </div>
      <button class="icon-btn" style="flex-shrink:0;" onclick="deleteJob(this.closest('.job-item').dataset.id, event)">✕</button>
    </div>`;
  }).join('');
}

function blankState(){
  return {
    id: 'job_' + Date.now() + '_' + Math.random().toString(36).slice(2,7),
    createdAt: new Date().toISOString(),
    name: '', kategori: 'Etkinlik / Tur', tarih: '',
    projeBaslangic: '',
    projeBitis: '',
    personnel: [
      {unvan:'Creative Director', brut:0, yemek:0, yol:0, digerYanHak:0, kisi:1, ay:1, dahil:true, not:''}
    ],
    sgkDahil: true,
    fixedCosts: [
      {kalem:'Kira / Mekan Bedeli', tutar:0},
      {kalem:'Elektrik', tutar:0},
      {kalem:'Sigorta', tutar:0}
    ],
    kurUSD: 50.68, kurEUR: 55.65, // TCMB efektif satış, 23.11.2026
    displayCurrency: 'TL', // 'TL' | 'USD' | 'EUR'
    notlar: '',
    production: {
      'Animasyon / İçerik Üretimi': [{kalem:'', adet:1, gun:1, fiyat:0}],
      'Teknik Ekipman': [{kalem:'', adet:1, gun:1, fiyat:0}],
      'Ses & Görsel Tasarım': [{kalem:'', adet:1, gun:1, fiyat:0}],
      'Dekor & Sahne': [{kalem:'', adet:1, gun:1, fiyat:0}],
      'Freelance Ekip': [{kalem:'', adet:1, gun:1, fiyat:0}],
      'İzin, Telif & Gümrük': [{kalem:'', adet:1, gun:1, fiyat:0}],
      'Diğer Giderler': [{kalem:'', adet:1, gun:1, fiyat:0}]
    },
    biletFiyati: 1400,
    kesintiler: [
      {ad:'KDV', oran:20, dahil:true},
      {ad:'Rusum', oran:1, dahil:true},
      {ad:'Telif', oran:15, dahil:false},
      {ad:'KK Komisyonu', oran:2.68, dahil:true},
      {ad:'Biletleme Komisyonu', oran:5, dahil:true},
      {ad:'İndirim / Masraf', oran:2, dahil:false},
      {ad:'Stopaj', oran:20, dahil:true}
    ],
    gelirAylar: [
      {ay:'Ay 1', calismaGunu:22, seansGun:10, kapasiteSeans:40, doluluk:80}
    ],
    digerGelirler: [
      {ad:'Ürün Satışı Geliri', tutar:0},
      {ad:'F&B Gelirleri', tutar:0},
      {ad:'Fotoğraf Gelirleri', tutar:0},
      {ad:'Sponsorluk Geliri', tutar:0}
    ],
    projeBedeliManuel: null,
    hedefKazanc: 0,
    minMarj: 50,
    yatirimTutari: 0
  };
}

/* ============================================================
   BASİT MODDAN İÇE AKTARIM
   Basit moddaki değerler (maliyet, fiyat, kesinti, adet, hedefMarj,
   adetMode, adetGun, adetKisi, adetSeans) yeni bir proje olarak
   önceden doldurulur — Job Name / Kategori / Tarih / Proje Süresi zorunlu
   alanları dahil, çünkü onlar dolmadan uygulama diğer sekmeleri açmıyor.

   Eşleme mantığı — her değer, uygulamada zaten var olan uygun alana gider;
   yapay/markalı bir gider kartı UYDURULMAZ:
   - maliyet   -> "Prodüksiyon Maliyetleri" sekmesindeki mevcut "Diğer
                  Giderler" kategorisinin (zaten boş duran) ilk satırına tek
                  kalem olarak yazılır (adet:1, gün:1, fiyat:maliyet). Bu,
                  proje süresi tahminine bağlı olmadığı için toplam maliyeti
                  birebir korur.
   - fiyat     -> state.biletFiyati (brüt bilet fiyatı, "Bilet & Kesintiler")
   - kesinti   -> "Bilet & Kesintiler" sekmesindeki kesinti tablosuna tek
                  satır (sahnedeki "tek toplam yüzde" ile aynı netFiyat
                  formülünü verir)
   - adet      -> "Gelir Projeksiyonu" sekmesinde tek satır; formül modunda
                  (Gün × Kişi × Seans) aynı üç bileşenle satılan adedi
                  birebir yeniden kurar, direkt modda kapasite=adet olur
   - hedefMarj -> state.minMarj (verilmişse)
   - maliyet   -> ayrıca state.yatirimTutari olarak da atanır, böylece
                  "Özet P&L" sekmesindeki Geri Ödeme Süresi otomatik
                  hesaplanır (bu alan boşken hesaplama hiç çalışmıyordu).

   Proje adı çakışmasın diye "Sahne projesi N" otomatik numaralanır.
============================================================ */
function nextSahneProjeAdi(){
  let maxN = 0;
  jobs.forEach(j=>{
    const m = /^Sahne projesi (\d+)$/i.exec((j.name||'').trim());
    if(m){ const n = parseInt(m[1],10); if(n>maxN) maxN = n; }
  });
  return 'Sahne projesi ' + (maxN + 1);
}

function importFromSahne(v){
  const maliyet = +v.maliyet || 0;
  const fiyat = +v.fiyat || 0;
  const kesinti = +v.kesinti || 0;
  const adet = +v.adet || 0;
  const hedefMarj = (v.hedefMarj !== undefined && v.hedefMarj !== '') ? +v.hedefMarj : null;
  const mode = v.adetMode || 'direct';
  const gun = +v.adetGun || 0;
  const kisi = +v.adetKisi || 0;
  const seans = +v.adetSeans || 0;

  // Proje Süresi (Ay): formül modunda girilen "Gün" değerinden (22 iş
  // günü/ay kabulüyle) extrapole edilir; direkt adet modunda 1 ay varsayılır.
  let projeSuresiAy = 1;
  if(mode === 'formula' && gun > 0){
    projeSuresiAy = Math.max(1, Math.round(gun / 22));
  }

  const job = blankState();
  job.name = nextSahneProjeAdi();
  job.kategori = 'Sahne Gösterisi';
  job.tarih = new Date().toISOString().slice(0,10);
  const bugun = new Date();
  const bitis = new Date(bugun.getTime() + (projeSuresiAy*30.44*86400000));
  job.projeBaslangic = bugun.toISOString().slice(0,10);
  job.projeBitis = bitis.toISOString().slice(0,10);

  // Toplam maliyet, mevcut "Diğer Giderler" kategorisinin ilk (zaten boş)
  // satırına yazılır — yeni/markalı bir gider kartı oluşturulmaz.
  job.production['Diğer Giderler'] = [{kalem:'Toplam Maliyet', adet:1, gun:1, fiyat:maliyet}];

  job.biletFiyati = fiyat;
  job.kesintiler = [{ad:'Toplam Kesinti', oran: kesinti, dahil:true}];

  if(mode === 'formula' && (gun>0 || kisi>0 || seans>0)){
    job.gelirAylar = [{ay:'Ay 1', calismaGunu: gun||1, seansGun: seans||1, kapasiteSeans: kisi||0, doluluk: 100}];
  }else{
    job.gelirAylar = [{ay:'Ay 1', calismaGunu: 1, seansGun: 1, kapasiteSeans: adet, doluluk: 100}];
  }

  if(hedefMarj !== null) job.minMarj = hedefMarj;

  // Geri Ödeme Süresi hesaplanabilsin diye toplam maliyet, yatırım tutarı
  // olarak da aktarılır.
  job.yatirimTutari = maliyet;

  jobs.unshift(job);
  state = job;
  sunucuyaKaydet(job);
  activeTab = 'sonuc';
}

/* ============================================================
   CALCULATIONS
============================================================ */
const kurFor = pb => pb==='USD' ? +(state.kurUSD||1) : pb==='EUR' ? +(state.kurEUR||1) : 1;

function personelToplam(){
  let toplam = 0, brutToplam = 0;
  state.personnel.forEach(r=>{
    if(r.dahil===false) return; // "dahil" işaretsizse bu kalem toplamlara girmez
    const birim = (+r.brut||0)+(+r.yemek||0)+(+r.yol||0)+(+r.digerYanHak||0);
    toplam += birim * (+r.kisi||0) * (+r.ay||0);
    brutToplam += (+r.brut||0) * (+r.kisi||0) * (+r.ay||0);
  });
  if(state.sgkDahil) toplam += brutToplam * 0.205;
  return toplam;
}
function sabitAylikToplam(){ return state.fixedCosts.reduce((s,r)=>s+(+r.tutar||0),0); }
function sureGun(){
  if(!state.projeBaslangic || !state.projeBitis) return 0;
  const b = new Date(state.projeBaslangic), s = new Date(state.projeBitis);
  if(isNaN(b) || isNaN(s) || s < b) return 0;
  return Math.round((s - b) / 86400000) + 1;
}
function sureAy(){
  const g = sureGun();
  if(!g) return 0;
  return Math.max(1, Math.round((g / 30.44) * 100) / 100);
}
function sureMetni(){
  if(!state.projeBaslangic || !state.projeBitis) return '—';
  const f = d => new Date(d+'T00:00:00').toLocaleDateString('tr-TR');
  return f(state.projeBaslangic) + ' – ' + f(state.projeBitis) + ' (' + sureGun() + ' gün)';
}
function sabitToplam(){ return sabitAylikToplam() * sureAy(); }
/* r.pb sadece eski kayıtlarda olabilir; yeni satırlar hep TL. */
const prodSatirTutar = r => (+r.adet||0)*(+r.gun||0)*(+r.fiyat||0)*kurFor(r.pb);
function prodKategoriToplam(cat){
  return state.production[cat].reduce((s,r)=> s + prodSatirTutar(r), 0);
}
/* Veriden gelen kategori adları nesne anahtarı olur; __proto__ vb. prototipi bozar. */
const guvenliKategoriler = o => Object.keys(o||{}).filter(k => !['__proto__','constructor','prototype'].includes(k) && Array.isArray(o[k]));
function prodKategoriler(){
  if(!state.production || typeof state.production !== 'object') return [];
  if(state.production.notlar !== undefined){
    if(!state.notlar) state.notlar = state.production.notlar;
    delete state.production.notlar;
  }
  return guvenliKategoriler(state.production);
}
const P = ci => state.production[prodKategoriler()[ci]];
function prodToplam(){
  return prodKategoriler().reduce((s,c)=>s+prodKategoriToplam(c),0);
}
function toplamMaliyet(){ return personelToplam() + sabitToplam() + prodToplam(); }

function netBiletFiyati(){
  let f = +state.biletFiyati||0;
  state.kesintiler.forEach(k=>{ if(k.dahil) f -= (+state.biletFiyati||0)*(+k.oran||0)/100; });
  return Math.max(f,0);
}
function gelirBiletToplam(){
  const net = netBiletFiyati();
  return state.gelirAylar.reduce((s,r)=>{
    const satilan = (+r.calismaGunu||0)*(+r.seansGun||0)*(+r.kapasiteSeans||0)*((+r.doluluk||0)/100);
    return s + satilan*net;
  },0);
}
function digerGelirToplam(){ return state.digerGelirler.reduce((s,r)=>s+(+r.tutar||0),0); }
function gelirToplam(){ return gelirBiletToplam() + digerGelirToplam(); }
function projeBedeli(){ return state.projeBedeliManuel!==null && state.projeBedeliManuel!=='' ? +state.projeBedeliManuel : gelirToplam(); }
function kar(){ return projeBedeli() - toplamMaliyet(); }
function karMarji(){ const pb=projeBedeli(); return pb ? (kar()/pb*100) : 0; }
function geriOdemeAy(){
    const aylikNet = kar() / (sureAy()||1);
  if(!state.yatirimTutari || aylikNet<=0) return null;
  return state.yatirimTutari/aylikNet;
}

/* ============================================================
   FORMAT
============================================================ */
function fmtAySure(ay){
  if(ay===null || ay===undefined || !isFinite(ay)) return '—';
  const toplamGun = Math.round(ay*30);
  const tamAy = Math.floor(toplamGun/30);
  const gun = toplamGun - tamAy*30;
  if(tamAy<=0) return gun + ' gün';
  if(gun<=0) return tamAy + ' ay';
  return tamAy + ' ay ' + gun + ' gün';
}
/* Tüm tutarlar TL olarak saklanır; ekranda seçili para birimine çevrilir. */
const fmt = n => {
  const cur = state.displayCurrency || 'TL';
  const num = (isFinite(+n) ? +n : 0) / kurFor(cur);
  const symbol = cur === 'USD' ? '$' : cur === 'EUR' ? '€' : '₺';
  return num.toLocaleString('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2}) + ' ' + symbol;
};


const fmtPct = n => (isFinite(n)?n:0).toLocaleString('tr-TR',{maximumFractionDigits:1}) + ' %';
/* Her panelin en üstünde: "buradaki değişiklik hangi sekmeyi/sonucu etkiliyor" ipucu. */
const depHint = (html, color) => `<div class="dep-hint c-${color||'red'}">🔗 ${html}</div>`;
/* Bir cümle içinde başka bir sekmenin adı geçtiğinde, kutunun kendi rengi ne olursa
   olsun, o sekmenin adı HER ZAMAN kendi rengiyle (Özet P&L = kırmızı, Bilet & Kesintiler
   = turuncu vb.) gösterilsin diye. */
const TAB_COLOR_HEX = {blue:'#7fb1f7', green:'#5fdba3', purple:'#c3a6f7', orange:'#f4b578', teal:'#6bdcd2', red:'#f0837c'};
const TAB_NAME_COLOR = {'Personel Gideri':'blue','Sabit Aylık Giderler':'green','Prodüksiyon Maliyetleri':'purple','Bilet & Kesintiler':'orange','Gelir Projeksiyonu':'teal','Özet P&L':'red'};
const refTab = label => `<b style="color:${TAB_COLOR_HEX[TAB_NAME_COLOR[label]]}">${label}</b>`;

/* ============================================================
   ÖRNEK KALEM ÖNERİLERİ (datalist)
   Örnek prodüksiyon bütçe tekliflerinden derlenmiştir. Kullanıcı yeni bir satır eklerken bu isimler öneri olarak
   çıkar (datalist — serbest metin girişini engellemez, sadece hızlandırır).
============================================================ */
const SUGGESTED_PERSONEL = ['Creative Director','Content Director','Project Coordinator','Project Assistant','3D Modeler','3D Animation Artist','2D Artist','Technical Manager','Light Designer','Mocap Operator','Prodüksiyon Direktörü','Sahne Direktörü','Runner'];
const SUGGESTED_SABIT = ['Kira / Mekan Bedeli','Elektrik','Su','Sigorta','Muhasebe','Depo Kirası','İnternet & Telefon'];
const SUGGESTED_PROD = {
  'Animasyon / İçerik Üretimi': ['Show Prodüksiyon','Animasyon Yeniden Ölçeklendirme','Mapping Animasyon','Interaktif Animasyon Loop','3D Modeling','Rendering','Konsept Tasarımı'],
  'Teknik Ekipman': ['Robe Tetra 2','Robe Tetra X','Robe Forte','Grand MA3 Full Size Lighting Console','Lacoustics A15 Linearray Speakers','Yamaha CL5 Digital Console','Led Ekran','Watchout Server System','18K/20K Full HD Projeksiyon','Jeneratör'],
  'Ses & Görsel Tasarım': ['Müzik & Ses Tasarımı','Konsept Tasarımı','FX Tasarımı','Ses Tasarımı','Görsel Tasarım'],
  'Dekor & Sahne': ['Scaffold Kiralama ve Kurulum','Sahne Podyumu Kiralama ve Kurulum','Dekor','Truss'],
  'Freelance Ekip': ['Watchout Operatör','Aquilon Operatör','Teknisyen','Rigger','Lighting Technician','Sound Technician','Truss Technician','Sahne Direktörü','Prodüksiyon Direktörü','Runner','Performer','Çocuk Korosu','Sunucu'],
  'İzin, Telif & Gümrük': ['Telif Bedeli','Gümrük Vergisi','İzin / Ruhsat Bedeli'],
  'Diğer Giderler': ['Nakliye','Ekip Konaklama','Ekip Ulaşım','Ekip İaşe','Intercom Kulaklık Sistemi','Öngörülmeyen Giderler']
};
const SUGGESTED_KESINTI = ['KDV','Rusum','Telif','KK Komisyonu','Biletleme Komisyonu','İndirim / Masraf','Stopaj'];
const datalistHtml = (id, items) => `<datalist id="${id}">${items.map(x=>`<option value="${escAttr(x)}">`).join('')}</datalist>`;

/* ============================================================
   ŞABLON KÜTÜPHANESİ (Ayarlar sekmesi + tüm datalist önerileri
   buradan besleniyor)
   SUGGESTED_* dizileri artık sadece "fabrika varsayılanı". Gerçek/canlı
   kütüphane burada, tarayıcının localStorage'ında tutuluyor; checkbox ile
   açılıp kapanabiliyor (silinmiyor, sadece önerilerden gizleniyor) ve
   yeni kalem eklenebiliyor. Proje bazlı değil — tüm projelerde ortak.
============================================================ */
const TEMPLATE_LIB_KEY = 'encore_template_library';
const OLD_TEMPLATE_LIB_KEYS = ['kulis_template_library', 'illusionist_template_library']; // eski isimle kaydedilmiş kütüphaneyi kaybetmemek için

function defaultTemplateLibrary(){
  /* price:0 -> "fiyat girilmemiş" demek. Var olan (fabrika) kalemlere burada
     asla gerçek bir fiyat uydurulmuyor — kullanıcı Ayarlar'dan kendisi
     girmediği sürece 0 kalır ve hiçbir yere otomatik yansımaz. */
  const wrap = arr => arr.map(name => ({name, enabled:true, price:0, currency:'TL'}));
  return {
    personel: wrap(SUGGESTED_PERSONEL),
    sabit: wrap(SUGGESTED_SABIT),
    prod: Object.fromEntries(Object.entries(SUGGESTED_PROD).map(([cat,items])=>[cat, wrap(items)])),
    kesinti: wrap(SUGGESTED_KESINTI),
    digerGelir: wrap(['Sponsorluk Geliri','Merchandise Satışı','Yayın / Prodüksiyon Hakkı','Devlet Teşviki','Bağış / Fon'])
  };
}
function loadTemplateLibrary(){
  try{
    const raw = [TEMPLATE_LIB_KEY, ...OLD_TEMPLATE_LIB_KEYS].map(k => localStorage.getItem(k)).find(Boolean);
    if(!raw) return defaultTemplateLibrary();
    const parsed = JSON.parse(raw);
    if(!parsed || typeof parsed !== 'object' || !parsed.personel || !parsed.prod) return defaultTemplateLibrary();
    return parsed;
  }catch(e){ return defaultTemplateLibrary(); }
}
function saveTemplateLibrary(){ localStorage.setItem(TEMPLATE_LIB_KEY, JSON.stringify(templateLibrary)); }
let templateLibrary = loadTemplateLibrary();

/* groupPath: 'personel' | 'sabit' | 'kesinti' | 'digerGelir' | 'prod:<Kategori Adı>' */
function resolveTemplateGroup(groupPath){
  if(groupPath.startsWith('prod:')) return templateLibrary.prod[groupPath.slice(5)];
  return templateLibrary[groupPath];
}
function enabledNames(groupPath){
  const g = resolveTemplateGroup(groupPath) || [];
  return g.filter(x=>x.enabled).map(x=>x.name);
}
/* Bir satırın isim alanına (unvan/kalem/ad) yazılan/seçilen değer, Ayarlar'da
   fiyatı girilmiş bir şablon kalemiyle birebir (büyük/küçük harf duyarsız)
   eşleşirse, o satırın ilgili sayısal alanını (varsa zaten dolu değilse)
   otomatik doldurur. true dönerse çağıran taraf tam re-render (calc()) yapmalı,
   false dönerse mevcut hafif autosave() yeterli — her tuş vuruşunda tüm
   paneli yeniden çizmemek için. */
function applyTemplateAutofill(groupPath, typedName, row, priceField){
  if(+row[priceField]) return false;
  const g = resolveTemplateGroup(groupPath) || [];
  const typed = String(typedName||'').trim().toLowerCase();
  if(!typed) return false;
  const match = g.find(x=>x.enabled && (+x.price) && x.name.toLowerCase()===typed);
  if(!match) return false;
  row[priceField] = sablonFiyatTL(match);
  return true;
}
/* Şablon fiyatı USD/EUR olabilir; proje satırları hep TL. Kesintilerde currency yok -> kur 1. */
const sablonFiyatTL = it => (+it.price||0) * kurFor(it.currency);
function templateMismatchWarning(groupPath, name, price){
  const g = resolveTemplateGroup(groupPath) || [];
  const key = String(name||'').trim().toLowerCase();
  if(!key) return '';
  const match = g.find(x => String(x.name||'').trim().toLowerCase() === key);
  if(!match || !+match.price) return '';
  if(Math.abs(sablonFiyatTL(match) - (+price||0)) < 0.005) return '';
  const msg = `Şablonda kayıtlı fiyat: ${match.price} ${match.currency||'TL'} — burada: ${price||0} TL yazıyor.`;
  return `<span class="tpl-mismatch" title="${escAttr(msg)}">!</span>`;
}
function toggleTemplateItem(groupPath, idx){
  const g = resolveTemplateGroup(groupPath);
  if(!g || !g[idx]) return;
  g[idx].enabled = !g[idx].enabled;
  saveTemplateLibrary(); renderPanels();
}
function addTemplateItem(groupPath, name){
  name = (name||'').trim();
  if(!name) return;
  const g = resolveTemplateGroup(groupPath);
  if(!g) return;
  if(g.some(x=>x.name.toLowerCase()===name.toLowerCase())){ alert('Bu kalem zaten listede.'); return; }
  g.push({name, enabled:true, price:0});
  saveTemplateLibrary(); renderPanels();
}

/* Bir satırın isim alanına yazılan değer, şablon kütüphanesinde (aktif ya da
   pasif fark etmez) hiç yoksa "bu kalemi şablona ekle" ipucu gösterilir —
   böylece bir projede yazılan yeni bir kalem, tek tıkla diğer projelerde de
   önerilebilir hâle gelir. */
function isKnownTemplateName(groupPath, name){
  name = String(name||'').trim().toLowerCase();
  if(!name) return true;
  const g = resolveTemplateGroup(groupPath) || [];
  return g.some(x=>x.name.toLowerCase()===name);
}

/* ---------- Başka bir projeden kalem çekme ----------
   Her panelin altında (kalem ekle butonunun yanında) bir "başka projeden
   kalem çek" seçici var — mevcut kayıtlı projelerden birini seçip, o
   projenin (personel/sabit/prodüksiyon/kesinti/diğer gelir) kalemlerini
   aynen (fiyatlarıyla birlikte) mevcut projeye kopyalar. Şablon kütüphanesi
   sadece isim+fiyat önerisi verirken, bu özellik doğrudan bir projeyi
   başka bir projenin kalemleriyle hızlıca doldurmayı sağlar. */
const PROJE_KATEGORILERI = ['Etkinlik / Tur','Sahne Gösterisi','Kurumsal Aktivite','Festival','Diğer'];

function pullFromProjectControlHtml(kind, selectId){
  return `
    <span class="pull-from-project">
      <select data-key="${K()}" id="${selectId}">
        <option value="">Kategoriden kalem çek…</option>
        ${PROJE_KATEGORILERI.map(c=>`<option value="${escAttr(c)}">${escAttr(c)}</option>`).join('')}
      </select>
      <button type="button" class="add-row-btn" onclick="pullItemsFromCategory(document.getElementById('${selectId}').value, '${kind}')">⇩ Çek</button>
    </span>`;
}

/* Seçilen kategoriyle (üstteki "Kategori" alanıyla aynı liste) etiketlenmiş
   TÜM diğer projelerdeki kalemleri tarar, mevcut projede aynı isimde
   (büyük/küçük harf duyarsız) bir kalem yoksa ekler — aynı ismin birden
   fazla projede tekrarlanmasından doğacak satır kalabalığını böyle önlüyoruz. */
function pullItemsFromCategory(kategori, kind){
  if(!kategori) return;
  const matching = jobs.filter(j=>j.kategori===kategori && j.id!==state.id);
  if(matching.length===0){ alert(`"${kategori}" kategorisinde başka kayıtlı proje bulunamadı.`); return; }
  let added = 0;
  const clone = r => JSON.parse(JSON.stringify(r));
  const nameSet = (arr, field) => new Set((arr||[]).map(x=>String(x[field]||'').trim().toLowerCase()).filter(Boolean));
  const pullInto = (targetArr, field, sourceArr, have) => {
    (sourceArr||[]).forEach(r=>{
      const key = String(r[field]||'').trim().toLowerCase();
      if(!key || have.has(key)) return;
      have.add(key); targetArr.push(clone(r)); added++;
    });
  };
  if(kind === 'personel'){
    const have = nameSet(state.personnel, 'unvan');
    matching.forEach(j=>pullInto(state.personnel, 'unvan', j.personnel, have));
  } else if(kind === 'sabit'){
    const have = nameSet(state.fixedCosts, 'kalem');
    matching.forEach(j=>pullInto(state.fixedCosts, 'kalem', j.fixedCosts, have));
  } else if(kind === 'prod'){
    matching.forEach(j=>{
      guvenliKategoriler(j.production).forEach(cat=>{
        if(!state.production[cat]) state.production[cat] = [];
        const have = nameSet(state.production[cat], 'kalem');
        pullInto(state.production[cat], 'kalem', j.production[cat], have);
      });
    });
  } else if(kind === 'kesinti'){
    const have = nameSet(state.kesintiler, 'ad');
    matching.forEach(j=>pullInto(state.kesintiler, 'ad', j.kesintiler, have));
  } else if(kind === 'digerGelir'){
    const have = nameSet(state.digerGelirler, 'ad');
    matching.forEach(j=>pullInto(state.digerGelirler, 'ad', j.digerGelirler, have));
  }
  calc();
  alert(added>0 ? `${added} benzersiz kalem "${kategori}" kategorisindeki projelerden eklendi.` : 'O kategorideki projelerde yeni/farklı bir kalem bulunamadı.');
}
function autoFillFromTemplate(kategori){
  if(!kategori) return;
  const uygun = it => it.enabled && it.kategori && it.kategori===kategori;
  const nameSet = (arr, field) => new Set((arr||[]).map(x=>String(x[field]||'').trim().toLowerCase()).filter(Boolean));
  let total = 0;

  const have1 = nameSet(state.personnel, 'unvan');
  (templateLibrary.personel||[]).filter(uygun).forEach(it=>{
    const key = it.name.trim().toLowerCase();
    if(have1.has(key)) return;
    have1.add(key);
    state.personnel.push({unvan:it.name, brut:sablonFiyatTL(it), yemek:0, yol:0, digerYanHak:0, kisi:1, ay:1, dahil:true, not:''});
    total++;
  });

  const have2 = nameSet(state.fixedCosts, 'kalem');
  (templateLibrary.sabit||[]).filter(uygun).forEach(it=>{
    const key = it.name.trim().toLowerCase();
    if(have2.has(key)) return;
    have2.add(key);
    state.fixedCosts.push({kalem:it.name, tutar:sablonFiyatTL(it)});
    total++;
  });

  guvenliKategoriler(templateLibrary.prod).forEach(cat=>{
    if(!state.production[cat]) state.production[cat] = [];
    const have3 = nameSet(state.production[cat], 'kalem');
    (templateLibrary.prod[cat]||[]).filter(uygun).forEach(it=>{
      const key = it.name.trim().toLowerCase();
      if(have3.has(key)) return;
      have3.add(key);
      state.production[cat].push({kalem:it.name, adet:1, gun:1, fiyat:sablonFiyatTL(it)});
      total++;
    });
  });

  if(total>0) calc();
}

/* Zaten kayıtlı tüm projelerde (geçmişte) yazılmış ama şablonda olmayan
   kalemleri tek seferde şablona aktarır — "Maliyet Ayarları" sekmesindeki
   butondan tetiklenir. */
function syncAllProjectItemsToLibrary(){
  let added = 0;
  const addIfNew = (groupPath, name) => {
    name = (name||'').trim();
    if(!name) return;
    const g = resolveTemplateGroup(groupPath);
    if(!g) return;
    if(g.some(x=>x.name.toLowerCase()===name.toLowerCase())) return;
    g.push({name, enabled:true, price:0});
    added++;
  };
  jobs.forEach(job=>{
    (job.personnel||[]).forEach(r=>addIfNew('personel', r.unvan));
    (job.fixedCosts||[]).forEach(r=>addIfNew('sabit', r.kalem));
    guvenliKategoriler(job.production).forEach(cat=>{
      if(!templateLibrary.prod[cat]) templateLibrary.prod[cat] = [];
      (job.production[cat]||[]).forEach(r=>addIfNew('prod:'+cat, r.kalem));
    });
    (job.kesintiler||[]).forEach(r=>addIfNew('kesinti', r.ad));
    (job.digerGelirler||[]).forEach(r=>addIfNew('digerGelir', r.ad));
  });
  saveTemplateLibrary();
  renderPanels();
  alert(added>0 ? `${added} yeni kalem şablona eklendi.` : 'Şablonda olmayan yeni bir kalem bulunamadı — hepsi zaten ekliydi.');
}
const safeId = s => String(s).replace(/[^a-zA-Z0-9]/g, '_');
function saveTemplateItemRow(groupPath, idx, btn){
  const g = resolveTemplateGroup(groupPath);
  if(!g || !g[idx]) return;
  const priceEl = document.getElementById('tplPrice_'+safeId(groupPath)+'_'+idx);
  const curEl = document.getElementById('tplCur_'+safeId(groupPath)+'_'+idx);
  const katEl = document.getElementById('tplKat_'+safeId(groupPath)+'_'+idx);
  if(priceEl) g[idx].price = priceEl.value;
  if(curEl) g[idx].currency = curEl.value;
  if(katEl) g[idx].kategori = katEl.value;
  saveTemplateLibrary();
  renderPanels();
  if(btn){
    btn.classList.add('saved');
    setTimeout(()=>btn.classList.remove('saved'), 1200);
  }
}
function deleteTemplateItem(groupPath, idx){
  const g = resolveTemplateGroup(groupPath);
  if(!g || !g[idx]) return;
  if(!confirm(`"${g[idx].name}" kalıcı olarak silinsin mi?`)) return;
  g.splice(idx,1);
  saveTemplateLibrary(); renderPanels();
}
function resetTemplateGroup(groupPath){
  if(!confirm('Bu grubu fabrika varsayılanlarına döndürmek istiyor musun? Eklediğin özel kalemler silinecek.')) return;
  const defaults = defaultTemplateLibrary();
  if(groupPath.startsWith('prod:')){
    const cat = groupPath.slice(5);
    templateLibrary.prod[cat] = defaults.prod[cat] || [];
  } else {
    templateLibrary[groupPath] = defaults[groupPath] || [];
  }
  saveTemplateLibrary(); renderPanels();
}

/* ============================================================
   FOCUS-SAFE KEYS
   Every live input/select gets a stable data-key (same field = same
   key across re-renders, since row order doesn't change while typing).
   This lets us restore focus + cursor position after every re-render.
============================================================ */
let __keySeed = 0;
const K = () => 'k' + (__keySeed++);

/* ============================================================
   RENDER: TABS
============================================================ */

const TABS = [
  {id:'personel', label:'Personel Gideri', color:'blue'},
  {id:'sabit', label:'Sabit Aylık Giderler', color:'green'},
  {id:'prod', label:'Prodüksiyon Maliyetleri', color:'purple'},
  {id:'bilet', label:'Bilet & Kesintiler', color:'orange'},
  {id:'gelir', label:'Gelir Projeksiyonu', color:'teal'},
  {id:'sonuc', label:'Özet P&L', color:'red'},
  {id:'ayarlar', label:'⚙ Maliyet Ayarları', color:'gray'}
];
let activeTab = 'personel';

/* Proje Adı + Tarih + Proje Süresi doldurulmadan hesaplama alanı kilitli kalır. */
function projectReady(){
    return !!(state.name && state.name.trim()) && !!state.tarih && sureAy() > 0;
}

function renderTabs(){
  const el = document.getElementById('tabs');
  if(!projectReady()){ el.style.display='none'; return; }
  el.style.display='flex';
  el.innerHTML = TABS.map(t=>
    `<div class="tab tab-c-${t.color} ${activeTab===t.id?'active':''}" onclick="switchTab('${t.id}')">${t.label}</div>`
  ).join('');
}
function switchTab(id){ activeTab=id; justSwitched=true; renderPanels(); renderTabs(); }

/* ============================================================
   RENDER: PANELS
   justSwitched=true  -> gerçek bir sekme değişimi: giriş animasyonu oynar
   justSwitched=false -> sadece yazarken yeniden hesaplama: animasyon oynamaz (titreşim olmasın)
============================================================ */
let justSwitched = true;
function renderPanels(){
  __keySeed = 0; // deterministic: same field gets the same key every render
  const el = document.getElementById('panels');
  el.classList.toggle('no-anim', !justSwitched);
  try{
    if(!projectReady()){
      el.innerHTML = `<div class="panel active">${gateScreen()}</div>`;
      return;
    }
    el.innerHTML = `
      <div class="panel ${activeTab==='personel'?'active':''}">${panelPersonel()}</div>
      <div class="panel ${activeTab==='sabit'?'active':''}">${panelSabit()}</div>
      <div class="panel ${activeTab==='prod'?'active':''}">${panelProd()}</div>
      <div class="panel ${activeTab==='bilet'?'active':''}">${panelBilet()}</div>
      <div class="panel ${activeTab==='gelir'?'active':''}">${panelGelir()}</div>
      <div class="panel ${activeTab==='sonuc'?'active':''}">${panelSonuc()}</div>
      <div class="panel ${activeTab==='ayarlar'?'active':''}">${panelAyarlar()}</div>
    `;
  }catch(err){
    // A bad render must never freeze the app or trap the user on one tab.
    console.error('renderPanels error:', err);
  }finally{
    justSwitched = false;
  }
}
function renderGate(){ renderTabs(); renderPanels(); }

/* ---------- Kilit / Başlangıç ekranı ---------- */
function gateScreen(){
  const checks = [
    {ok: !!(state.name && state.name.trim()), label:'Proje Adı'},
    {ok: !!state.tarih, label:'Tarih'},
              {ok: sureAy() > 0, label: (state.projeBaslangic && state.projeBitis && sureAy()===0) ? 'Proje Tarih Aralığı (bitiş, başlangıçtan önce olamaz)' : 'Proje Tarih Aralığı'}
  ];
  const items = checks.map(c=>`
    <div style="display:flex; align-items:center; gap:10px; padding:10px 0; border-bottom:1px solid var(--border-soft);">
      <span style="width:22px; height:22px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:12px; flex-shrink:0;
        background:${c.ok?'var(--success-bg)':'var(--bg-card-2)'}; color:${c.ok?'var(--success)':'var(--text-faint)'}; border:1px solid ${c.ok?'rgba(63,191,133,.4)':'var(--border)'};">
        ${c.ok?'✓':'○'}
      </span>
      <span style="font-size:13.5px; color:${c.ok?'var(--text)':'var(--text-faint)'}; font-weight:${c.ok?'600':'400'};">${c.label}</span>
    </div>`).join('');
  return `
    <div style="max-width:420px; margin:60px auto 0; text-align:center;">
      <div style="width:56px; height:56px; margin:0 auto 20px; color:var(--gold-bright);">
        <svg viewBox="0 0 900 900" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
          <path d="M425 250H475L640 740H260Z" opacity="0.28"/>
          <path d="M260 742A190 26 0 1 0 640 742A190 26 0 1 0 260 742Z" opacity="0.55"/>
          <path d="M120 130H780V205Q725 265 670 205Q615 265 560 205Q505 265 450 205Q395 265 340 205Q285 265 230 205Q175 265 120 205Z M130 245H405C392 380 305 480 228 538C290 600 305 690 305 770H130Z M770 245H495C508 380 595 480 672 538C610 600 595 690 595 770H770Z M200 262C206 370 192 455 168 515L182 521C208 458 222 370 216 262Z M700 262C694 370 708 455 732 515L718 521C692 458 678 370 684 262Z M110 790H790V830H110Z" fill-rule="evenodd"/>
        </svg>
      </div>
      <h3 style="font-size:19px; margin:0 0 8px;">Projeye Başlamadan Önce</h3>
      <p class="hint" style="margin:0 0 20px;">Hesaplama sekmelerini açmak için yukarıdaki üç alanı doldur. Doldurdukça buradaki liste otomatik güncellenir.</p>
      <div style="text-align:left; background:var(--bg-panel); border:1px solid var(--border-soft); border-radius:var(--radius); padding:6px 18px;">
        ${items}
      </div>
    </div>`;
}

/* ---------- Personel ---------- */
function panelPersonel(){
  const rows = state.personnel.map((r,i)=>`
    <tr style="${r.dahil===false?'opacity:.45;':''}">
      <td style="text-align:center;"><input data-key="${K()}" type="checkbox" ${r.dahil===false?'':'checked'} title="Toplama dahil et" onchange="state.personnel[${i}].dahil=this.checked; calc();"></td>
      <td><input data-key="${K()}" value="${escAttr(r.unvan)}" placeholder="Ünvan" list="dlPersonel" oninput="state.personnel[${i}].unvan=this.value; if(applyTemplateAutofill('personel',this.value,state.personnel[${i}],'brut')) calc(); else autosave();">${!isKnownTemplateName('personel', r.unvan) ? `<button type="button" class="tpl-add-hint" onclick="addTemplateItem('personel', state.personnel[${i}].unvan)">＋ şablona ekle</button>` : ''}</td>
      <td><input data-key="${K()}" type="text" inputmode="decimal" autocomplete="off" onfocus="this.select()" value="${escAttr(r.brut)}" oninput="state.personnel[${i}].brut   =this.value; calc();">${templateMismatchWarning('personel', r.unvan, r.brut)}</td>
      <td><input data-key="${K()}" type="text" inputmode="decimal" autocomplete="off" onfocus="this.select()" value="${escAttr(r.yemek)}" oninput="state.personnel[${i}].yemek   =this.value; calc();"></td>
      <td><input data-key="${K()}" type="text" inputmode="decimal" autocomplete="off" onfocus="this.select()" value="${escAttr(r.yol)}" oninput="state.personnel[${i}].yol   =this.value; calc();"></td>
      <td><input data-key="${K()}" type="text" inputmode="decimal" autocomplete="off" onfocus="this.select()" value="${escAttr(r.digerYanHak)}" oninput="state.personnel[${i}].digerYanHak   =this.value; calc();"></td>
      <td><input data-key="${K()}" type="text" inputmode="decimal" autocomplete="off" onfocus="this.select()" value="${escAttr(r.kisi)}" style="width:60px" oninput="state.personnel[${i}].kisi   =this.value; calc();"></td>
      <td><input data-key="${K()}" type="text" inputmode="decimal" autocomplete="off" onfocus="this.select()" value="${escAttr(r.ay)}" style="width:60px" oninput="state.personnel[${i}].ay   =this.value; calc();"></td>
      <td class="num">${fmt(((+r.brut||0)+(+r.yemek||0)+(+r.yol||0)+(+r.digerYanHak||0))*(+r.kisi||0)*(+r.ay||0))}</td>
      <td style="min-width:160px;"><input data-key="${K()}" value="${escAttr(r.not||'')}" placeholder="Not..." oninput="state.personnel[${i}].not=this.value; autosave();"></td>
      <td class="col-del"><button class="icon-btn" onclick="state.personnel.splice(${i},1); calc();">✕</button></td>
    </tr>`).join('');
  return `
    <div class="section-title"><h3>Personel Maliyet Tablosu</h3></div>
    <p class="hint">Ünvan, brüt maaş ve yan haklar × kişi sayısı × ay sayısı olarak hesaplanır. "Dahil" kutusunu kaldırırsan o kişi toplamdan çıkar ama satır silinmez — senaryo denemek için kullanışlı.</p>
    ${depHint(`Bu sekmedeki toplam, ${refTab('Özet P&L')} sekmesindeki Toplam Maliyet'e eklenir.`, 'blue')}
    <div class="table-scroll"><table>
      <thead><tr><th>Dahil</th><th style="min-width:190px">Ünvan</th><th style="width:90px">Brüt Maaş</th><th style="width:90px">Yemek</th><th style="width:90px">Yol</th><th style="width:100px">Diğer Yan Hak</th><th style="width:56px">Kişi</th><th style="width:56px">Ay</th><th style="text-align:right">Toplam</th><th>Not</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr><td colspan="8">TOPLAM PERSONEL GİDERİ ${state.sgkDahil?'(SGK işveren payı %20,5 dahil)':''}</td><td class="num">${fmt(personelToplam())}</td><td colspan="2"></td></tr></tfoot>
    </table></div>
    <button class="add-row-btn" onclick="state.personnel.push({unvan:'',brut:0,yemek:0,yol:0,digerYanHak:0,kisi:1,ay:1,dahil:true,not:''}); calc();">＋ personel satırı ekle</button>
<div style="margin-top:14px; padding-top:14px; border-top:1px solid var(--border-soft);">
  <p class="hint" style="margin:0 0 8px;">Ya da aynı kategorideki başka bir projeden hazır kalemleri çek:</p>
  ${pullFromProjectControlHtml('personel','pullSrcPersonel')}
</div>
<div class="toggle-row" style="margin-top:16px;">
      <input data-key="${K()}" type="checkbox" id="sgkChk" ${state.sgkDahil?'checked':''} onchange="state.sgkDahil=this.checked; calc();">
      <label for="sgkChk">SGK işveren payını (%20,5) brüt maaş üzerine otomatik ekle</label>
    </div>
    ${datalistHtml('dlPersonel', enabledNames('personel'))}`;
}

/* ---------- Sabit Giderler ---------- */
function panelSabit(){
  const cards = state.fixedCosts.map((r,i)=>`
    <div class="sabit-card" style="animation-delay:${i*45}ms">
      <button class="icon-btn sc-del" onclick="state.fixedCosts.splice(${i},1); calc();">✕</button>
      <div class="sc-icon">${escAttr((r.kalem||'?').trim().charAt(0).toUpperCase() || '?')}</div>
      <input data-key="${K()}" class="sc-name" value="${escAttr(r.kalem)}" placeholder="Gider kalemi" list="dlSabit" oninput="state.fixedCosts[${i}].kalem=this.value; if(applyTemplateAutofill('sabit',this.value,state.fixedCosts[${i}],'tutar')) calc(); else autosave();">
      ${!isKnownTemplateName('sabit', r.kalem) ? `<button type="button" class="tpl-add-hint" onclick="addTemplateItem('sabit', state.fixedCosts[${i}].kalem)">＋ şablona ekle</button>` : ''}
      <div class="sc-amount-row">
        <input data-key="${K()}" type="text" inputmode="decimal" autocomplete="off" onfocus="this.select()" value="${escAttr(r.tutar)}" oninput="state.fixedCosts[${i}].tutar=this.value; calc();">
        <span>TL/ay</span>
      </div>
      <div class="sc-note-row">
        <input data-key="${K()}" type="text" placeholder="Not..." value="${escAttr(r.kalemNot||'')}" oninput="state.fixedCosts[${i}].kalemNot=this.value; autosave();">
      </div>
    </div>`).join('');
  return `
    <div class="section-title"><h3>Aylık Sabit Gider Kalemleri</h3></div>
    <p class="hint">Kira, sigorta, muhasebe gibi her ay tekrar eden giderler. Proje süresi (üstteki alan) ile çarpılır.</p>
    ${depHint(`Bu sekmedeki toplam (× proje süresi), ${refTab('Özet P&L')} sekmesindeki Toplam Maliyet'e eklenir.`, 'green')}
    <div class="sabit-grid">
      ${cards}
      <div class="sabit-card-add" style="animation-delay:${state.fixedCosts.length*45}ms" onclick="state.fixedCosts.push({kalem:'',tutar:0}); calc();">＋ yeni gider kartı</div>
    </div>
    ${pullFromProjectControlHtml('sabit','pullSrcSabit')}
    <div class="result-grid" style="grid-template-columns:1fr 1fr; margin-top:20px;">
      <div class="stat-card"><div class="label">Toplam Aylık Sabit Gider</div><div class="value">${fmt(sabitAylikToplam())}</div></div>
            <div class="stat-card"><div class="label">TOPLAM SABİT GİDER (× ${sureAy()} ay)</div><div class="value">${fmt(sabitToplam())}</div></div>
    </div>
    ${datalistHtml('dlSabit', enabledNames('sabit'))}`;
}

/* ---------- Prodüksiyon ---------- */
function panelProd(){
      const groups = prodKategoriler().map((cat,ci)=>{
    const suggestions = enabledNames('prod:'+cat);
    const dlId = `dlProd${ci}`;
    const kalemPlaceholder = suggestions.length ? `örn. ${suggestions[0]}` : 'Kalem';
    const rows = state.production[cat].map((r,i)=>`
      <tr>
        <td><input data-key="${K()}" value="${escAttr(r.kalem)}" placeholder="${escAttr(kalemPlaceholder)}" list="${dlId}" oninput="P(${ci})[${i}].kalem=this.value; if(applyTemplateAutofill('prod:'+prodKategoriler()[${ci}],this.value,P(${ci})[${i}],'fiyat')) calc(); else autosave();">${!isKnownTemplateName('prod:'+cat, r.kalem) ? `<button type="button" class="tpl-add-hint" onclick="addTemplateItem('prod:'+prodKategoriler()[${ci}], P(${ci})[${i}].kalem)">＋ şablona ekle</button>` : ''}</td>
        <td style="width:70px"><input data-key="${K()}" type="text" inputmode="decimal" autocomplete="off" onfocus="this.select()" value="${escAttr(r.adet)}" oninput="P(${ci})[${i}].adet   =this.value; calc();"></td>
        <td style="width:70px"><input data-key="${K()}" type="text" inputmode="decimal" autocomplete="off" onfocus="this.select()" value="${escAttr(r.gun)}" oninput="P(${ci})[${i}].gun   =this.value; calc();"></td>
        <td style="width:110px"><input data-key="${K()}" type="text" inputmode="decimal" autocomplete="off" onfocus="this.select()" value="${escAttr(r.fiyat)}" oninput="P(${ci})[${i}].fiyat   =this.value; calc();"></td>
        <td style="min-width:160px;"><input data-key="${K()}" value="${escAttr(r.kalemNot||'')}" placeholder="Not..." oninput="P(${ci})[${i}].kalemNot=this.value; autosave();"></td>
        <td class="num">${fmt(prodSatirTutar(r))}</td>
        <td class="col-del"><button class="icon-btn" onclick="P(${ci}).splice(${i},1); calc();">✕</button></td>
      </tr>`).join('');
    return `
      <div class="prod-group">
        <h4>${escAttr(cat)} <span class="sub">${fmt(prodKategoriToplam(cat))}</span></h4>
        <div class="table-scroll"><table>
         <thead><tr><th style="min-width:220px">Kalem</th><th>Adet</th><th>Gün</th><th>Birim Fiyat (TL)</th><th>Not</th><th style="text-align:right">Toplam (TL)</th><th></th></tr></thead>
          <tbody>${rows}</tbody>
        </table></div>
        <button class="add-row-btn" onclick="P(${ci}).push({kalem:'',adet:1,gun:1,fiyat:0}); calc();">＋ kalem ekle</button>
        ${datalistHtml(dlId, suggestions)}
      </div>`;
  }).join('');
  return `
    <div class="section-title"><h3>Prodüksiyon ve Kurulum Maliyetleri</h3></div>
    ${depHint(`Bu sekmedeki toplam, ${refTab('Özet P&L')} sekmesindeki Toplam Maliyet'e eklenir.`, 'purple')}
    ${pullFromProjectControlHtml('prod','pullSrcProd')}
    <div style="display:flex; gap:16px; margin-bottom:18px; margin-top:12px;">
      <div class="field"><label>USD/TL Kuru</label><input data-key="${K()}" type="text" inputmode="decimal" autocomplete="off" onfocus="this.select()" style="width:110px" value="${escAttr(state.kurUSD)}" oninput="state.kurUSD   =this.value; calc();"></div>
      <div class="field"><label>EUR/TL Kuru</label><input data-key="${K()}" type="text" inputmode="decimal" autocomplete="off" onfocus="this.select()" style="width:110px" value="${escAttr(state.kurEUR)}" oninput="state.kurEUR   =this.value; calc();"></div>
    </div>
    ${groups}
    <div class="section-title"><h3 style="color:var(--text)">TOPLAM PRODÜKSİYON GİDERİ: <span style="color:var(--gold-bright)">${fmt(prodToplam())}</span></h3></div>`;
}

/* ---------- Bilet & Kesintiler ---------- */
function panelBilet(){
  const rows = state.kesintiler.map((k,i)=>`
    <div class="kesinti-row">
      <input data-key="${K()}" type="checkbox" ${k.dahil?'checked':''} onchange="state.kesintiler[${i}].dahil=this.checked; calc();">
      <div>
        <input data-key="${K()}" value="${escAttr(k.ad)}" placeholder="örn. KDV" list="dlKesinti" oninput="state.kesintiler[${i}].ad=this.value; if(applyTemplateAutofill('kesinti',this.value,state.kesintiler[${i}],'oran')) calc(); else autosave();">
        ${!isKnownTemplateName('kesinti', k.ad) ? `<button type="button" class="tpl-add-hint" onclick="addTemplateItem('kesinti', state.kesintiler[${i}].ad)">＋ şablona ekle</button>` : ''}
      </div>
      <input data-key="${K()}" type="text" inputmode="decimal" autocomplete="off" onfocus="this.select()" value="${escAttr(k.oran)}" oninput="state.kesintiler[${i}].oran   =this.value; calc();">
      <div class="kv">%${(+k.oran||0).toLocaleString('tr-TR')}</div>
      <button class="icon-btn" onclick="state.kesintiler.splice(${i},1); calc();">✕</button>
    </div>`).join('');
  return `
    <div class="section-title"><h3>Bilet Fiyatı ve Kesintiler (Advanced Options)</h3></div>
    ${depHint(`Buradaki <b>net bilet fiyatı</b>, ${refTab('Gelir Projeksiyonu')} sekmesindeki bilet gelirini belirler.`, 'orange')}
    <div class="field" style="margin-bottom:18px;">
      <label>Brüt Bilet Fiyatı (TL)</label>
      <input data-key="${K()}" type="text" inputmode="decimal" autocomplete="off" onfocus="this.select()" style="width:160px" value="${escAttr(state.biletFiyati)}" oninput="state.biletFiyati   =this.value; calc();">
    </div>
    <p class="hint">İşaretli kesintiler brüt fiyattan düşülerek net bilet fiyatı hesaplanır. Kullanmadığın kesintinin kutusunu boş bırak.</p>
    ${rows}
    <button class="add-row-btn" onclick="state.kesintiler.push({ad:'',oran:0,dahil:true}); calc();">＋ bu alana eklemek istediğiniz kalemi yazın</button>
    ${pullFromProjectControlHtml('kesinti','pullSrcKesinti')}
    <div class="result-grid" style="grid-template-columns:1fr 1fr; margin-top:22px;">
      <div class="stat-card"><div class="label">Brüt Bilet Fiyatı</div><div class="value">${fmt(state.biletFiyati)}</div></div>
      <div class="stat-card"><div class="label">Net Bilet Fiyatı (kesintiler sonrası)</div><div class="value">${fmt(netBiletFiyati())}</div></div>
    </div>
    ${datalistHtml('dlKesinti', enabledNames('kesinti'))}`;
}

/* ---------- Gelir Projeksiyonu ---------- */
function panelGelir(){
  const ayRows = state.gelirAylar.map((r,i)=>{
    const satilan = (+r.calismaGunu||0)*(+r.seansGun||0)*(+r.kapasiteSeans||0)*((+r.doluluk||0)/100);
    return `<tr>
      <td><input data-key="${K()}" value="${escAttr(r.ay)}" style="width:80px" oninput="state.gelirAylar[${i}].ay=this.value; autosave();"></td>
      <td><input data-key="${K()}" type="text" inputmode="decimal" autocomplete="off" onfocus="this.select()" value="${escAttr(r.calismaGunu)}" style="width:70px" oninput="state.gelirAylar[${i}].calismaGunu   =this.value; calc();"></td>
      <td><input data-key="${K()}" type="text" inputmode="decimal" autocomplete="off" onfocus="this.select()" value="${escAttr(r.seansGun)}" style="width:70px" oninput="state.gelirAylar[${i}].seansGun   =this.value; calc();"></td>
      <td><input data-key="${K()}" type="text" inputmode="decimal" autocomplete="off" onfocus="this.select()" value="${escAttr(r.kapasiteSeans)}" style="width:80px" oninput="state.gelirAylar[${i}].kapasiteSeans   =this.value; calc();"></td>
      <td><input data-key="${K()}" type="text" inputmode="decimal" autocomplete="off" onfocus="this.select()" value="${escAttr(r.doluluk)}" style="width:70px" oninput="state.gelirAylar[${i}].doluluk   =this.value; calc();"></td>
      <td class="num">${Math.round(satilan)}</td>
      <td class="num" style="color:var(--text-faint);" title="Bilet & Kesintiler sekmesinden gelir, burada değiştirilemez">${fmt(netBiletFiyati())} 🔒</td>
      <td class="num">${fmt(satilan*netBiletFiyati())}</td>
      <td class="col-del"><button class="icon-btn" onclick="state.gelirAylar.splice(${i},1); calc();">✕</button></td>
    </tr>`;
  }).join('');
  const digerRows = state.digerGelirler.map((r,i)=>`
    <tr>
      <td><input data-key="${K()}" value="${escAttr(r.ad)}" list="dlDigerGelir" oninput="state.digerGelirler[${i}].ad=this.value; if(applyTemplateAutofill('digerGelir',this.value,state.digerGelirler[${i}],'tutar')) calc(); else autosave();">${!isKnownTemplateName('digerGelir', r.ad) ? `<button type="button" class="tpl-add-hint" onclick="addTemplateItem('digerGelir', state.digerGelirler[${i}].ad)">＋ şablona ekle</button>` : ''}</td>
      <td style="width:160px"><input data-key="${K()}" type="text" inputmode="decimal" autocomplete="off" onfocus="this.select()" value="${escAttr(r.tutar)}" oninput="state.digerGelirler[${i}].tutar   =this.value; calc();"></td>
      <td class="col-del"><button class="icon-btn" onclick="state.digerGelirler.splice(${i},1); calc();">✕</button></td>
    </tr>`).join('');
  return `
    <div class="section-title"><h3>Aylık Bilet Geliri (Kapasite / Doluluk Bazlı)</h3></div>
    ${depHint(`Buradaki genel toplam gelir, ${refTab('Özet P&L')} sekmesindeki Proje Bedeli olarak kullanılır (elle değiştirilmediyse). Bilet fiyatı, ${refTab('Bilet & Kesintiler')} sekmesinden gelir, burada değiştirilemez.`, 'teal')}
    <div class="table-scroll"><table>
      <thead><tr><th>Ay</th><th>Çalışma Günü</th><th>Seans/Gün</th><th>Kapasite/Seans</th><th>Doluluk %</th><th style="text-align:right">Satılan Bilet</th><th style="text-align:right">Bilet Fiyatı 🔒</th><th style="text-align:right">Aylık Gelir</th><th></th></tr></thead>
      <tbody>${ayRows}</tbody>
      <tfoot><tr><td colspan="7">TOPLAM BİLET GELİRİ</td><td class="num">${fmt(gelirBiletToplam())}</td><td></td></tr></tfoot>
    </table></div>
    <button class="add-row-btn" onclick="state.gelirAylar.push({ay:'Ay '+(state.gelirAylar.length+1), calismaGunu:22, seansGun:10, kapasiteSeans:40, doluluk:80}); calc();">＋ ay ekle</button>

    <div class="section-title"><h3>Diğer Gelir Kalemleri</h3></div>
    <div class="table-scroll"><table>
      <thead><tr><th>Kalem</th><th>Tutar (TL)</th><th></th></tr></thead>
      <tbody>${digerRows}</tbody>
      <tfoot><tr><td>Toplam Diğer Gelir</td><td class="num">${fmt(digerGelirToplam())}</td><td></td></tr></tfoot>
    </table></div>
    <button class="add-row-btn" onclick="state.digerGelirler.push({ad:'',tutar:0}); calc();">＋ gelir kalemi ekle</button>
    ${pullFromProjectControlHtml('digerGelir','pullSrcDigerGelir')}
    ${datalistHtml('dlDigerGelir', enabledNames('digerGelir'))}

    <div class="section-title"><h3 style="color:var(--text)">GENEL TOPLAM GELİR: <span style="color:var(--gold-bright)">${fmt(gelirToplam())}</span></h3></div>`;
}

/* ---------- Sonuç ---------- */
function panelSonuc(){
  const ok = karMarji() >= (+state.minMarj||0);
  const geri = geriOdemeAy();
  return `
    <div class="section-title"><h3>Özet P&L</h3></div>
    ${depHint(`Diğer tüm sekmelerin sonucu burada birleşir: Toplam Maliyet = ${refTab('Personel Gideri')} + ${refTab('Sabit Aylık Giderler')} + ${refTab('Prodüksiyon Maliyetleri')}; Proje Bedeli = ${refTab('Gelir Projeksiyonu')} (veya elle girilen).`)}
    <div class="result-grid">
      <div class="stat-card"><div class="label">Toplam Maliyet</div><div class="value">${fmt(toplamMaliyet())}</div></div>
      <div class="stat-card editable">
        <div class="label">Proje Bedeli ${state.projeBedeliManuel!==null && state.projeBedeliManuel!=='' ? '(elle girildi)' : '(gelir projeksiyonundan)'}</div>
        <input data-key="${K()}" type="text" inputmode="decimal" autocomplete="off" onfocus="this.select()" placeholder="otomatik: ${Math.round(gelirToplam())}" value="${escAttr(state.projeBedeliManuel===null?'':state.projeBedeliManuel)}"
          oninput="state.projeBedeliManuel = this.value===''?null:+this.value; calc();">
      </div>
      <div class="stat-card editable">
        <div class="label">Hedef Kazancınız</div>
        <input data-key="${K()}" type="text" inputmode="decimal" autocomplete="off" onfocus="this.select()" value="${escAttr(state.hedefKazanc)}" oninput="state.hedefKazanc   =this.value; autosave();">
      </div>
    </div>

    <div class="result-grid" style="margin-top:14px;">
      <div class="stat-card"><div class="label">Projeden Kârınız</div><div class="value" style="color:${kar()>=0?'var(--success)':'var(--danger)'}">${fmt(kar())}</div></div>
      <div class="stat-card"><div class="label">Kâr Marjı</div><div class="value">${fmtPct(karMarji())}</div></div>
      <div class="stat-card editable">
        <div class="label">Minimum Kâr Marjı Eşiği</div>
        <input data-key="${K()}" type="text" inputmode="decimal" autocomplete="off" onfocus="this.select()" value="${escAttr(state.minMarj)}" oninput="state.minMarj   =this.value; calc();">
      </div>
    </div>

    <div class="result-grid" style="margin-top:14px;">
      <div class="stat-card editable"><div class="label">Yatırım Tutarı (opsiyonel)</div><input data-key="${K()}" type="text" inputmode="decimal" autocomplete="off" onfocus="this.select()" value="${escAttr(state.yatirimTutari)}" oninput="state.yatirimTutari   =this.value; calc();"></div>
            <div class="stat-card"><div class="label">Aylık Net Kâr</div><div class="value">${fmt(kar()/(sureAy()||1))}</div></div>
      <div class="stat-card"><div class="label">Geri Ödeme Süresi</div><div class="value">${fmtAySure(geri)}</div></div>
    </div>

    <div class="verdict ${ok?'ok':'no'}">
      <div class="vtext">
        <h2>${ok?'✅ KÂRDASINIZ':'❌ KÂRDA DEĞİLSİNİZ'}</h2>
        <p>Kâr marjınız %${escAttr(state.minMarj)} eşiğine göre ${ok?'sağlanıyor':'sağlanamıyor'}. (Kâr marjı = Kâr / Proje Bedeli)</p>
      </div>
      <div class="vnum">%${(isFinite(karMarji())?karMarji():0).toFixed(1)}</div>
    </div>
    <div style="margin-top:20px; padding:15px; background:var(--bg-panel); border:1px solid var(--border-soft); border-radius:var(--radius);">
      <label style="display:block; margin-bottom:8px; font-weight:600; font-size:13px; color:var(--text);">Notlar / Açıklamalar</label>
      <textarea data-key="${K()}" placeholder="Excel raporuna eklenecek notları yazınız..."
        oninput="state.notlar=this.value; autosave();"
        style="width:100%; height:80px; padding:10px; background:var(--bg-card); color:var(--text); border:1px solid var(--border); border-radius:var(--radius-sm); font-family:var(--font-sans); font-size:12px; resize:vertical;">${escAttr(state.notlar)}</textarea>
    </div>

    <div class="actions">
      <button class="btn btn-primary" onclick="exportExcel()">⬇ Download as Excel</button>
    </div>`;
}

/* ---------- Ayarlar (Şablon Kütüphanesi) ---------- */
let ayarlarOpen = {};
let ayarlarDraft = {};
/* Inline handler'lara isim değil index yazılır; isim veriden geldiği için JS'e enjekte edilemez. */
const GP = gi => ayarlarGroupList()[gi].path;
function ayarlarGroupList(){
  return [
    {path:'personel', title:'Personel Unvanları', unit:'currency', priceLabel:'Brüt Maaş'},
    {path:'sabit', title:'Sabit Gider Kalemleri', unit:'currency', priceLabel:'Aylık Tutar'},
    ...guvenliKategoriler(templateLibrary.prod).map(cat => ({path:'prod:'+cat, title:'Prodüksiyon — '+cat, unit:'currency', priceLabel:'Birim Fiyat'})),
    {path:'kesinti', title:'Kesinti Kalemleri', unit:'%', priceLabel:'Oran'},
    {path:'digerGelir', title:'Diğer Gelir Kalemleri', unit:'currency', priceLabel:'Tutar'}
  ];
}
function panelAyarlar(){
  const groups = ayarlarGroupList().map((g, gi) => {
    const items = resolveTemplateGroup(g.path) || [];
    const isOpen = ayarlarOpen[g.path] !== false;
    const rows = items.map((it,i) => `
      <div class="ayarlar-item${it.enabled?'':' off'}">
        <label class="ayarlar-check">
          <input data-key="${K()}" type="checkbox" ${it.enabled?'checked':''} onchange="toggleTemplateItem(GP(${gi}), ${i})">
          <span>${escAttr(it.name)}</span>
        </label>
        <div class="ayarlar-price" title="Fiyatı/para birimini ayarlayıp Kaydet'e bas — otomatik kaydolmaz.">
          <input id="tplPrice_${safeId(g.path)}_${i}" data-key="${K()}" type="text" inputmode="decimal" autocomplete="off" onfocus="this.select()" value="${escAttr(it.price||0)}">
          ${g.unit === '%' ? `<span>%</span>` : `
          <select id="tplCur_${safeId(g.path)}_${i}" data-key="${K()}">
            <option value="TL" ${it.currency==='TL'||!it.currency?'selected':''}>TL</option>
            <option value="USD" ${it.currency==='USD'?'selected':''}>USD</option>
            <option value="EUR" ${it.currency==='EUR'?'selected':''}>EUR</option>
          </select>`}
               </div>
        <select id="tplKat_${safeId(g.path)}_${i}" data-key="${K()}" style="width:130px; font-size:11px;" title="Bu kalem hangi proje kategorisinde önerilsin?">
          <option value="Tümü" ${!it.kategori||it.kategori==='Tümü'?'selected':''}>Tümü</option>
          ${PROJE_KATEGORILERI.map(c=>`<option value="${escAttr(c)}" ${it.kategori===c?'selected':''}>${escAttr(c)}</option>`).join('')}
        </select>
                <button class="icon-btn tpl-save-btn" title="Kaydet" onclick="saveTemplateItemRow(GP(${gi}), ${i}, this)">✓</button>
        <button class="icon-btn" title="İptal — değişikliği atar" onclick="renderPanels()">↺</button>
        <button class="icon-btn" title="Kalıcı olarak sil" onclick="deleteTemplateItem(GP(${gi}), ${i})">✕</button>
      </div>`).join('');
    return `
      <div class="ayarlar-group">
        <div class="ayarlar-group-head" onclick="ayarlarOpen[GP(${gi})]=${isOpen}?false:true; renderPanels();">
          <span class="ayarlar-caret">${isOpen?'▾':'▸'}</span>
          <h4>${escAttr(g.title)}</h4>
          <span class="sub">${items.filter(x=>x.enabled).length}/${items.length} aktif</span>
        </div>
        ${isOpen ? `
        <div class="ayarlar-body">
          ${rows || '<p class="hint" style="margin:8px 0 0;">Henüz kalem yok.</p>'}
          <div class="ayarlar-add">
            <input data-key="${K()}" type="text" placeholder="+ yeni kalem adı..." value="${escAttr(ayarlarDraft[g.path]||'')}"
              oninput="ayarlarDraft[GP(${gi})]=this.value;"
              onkeydown="if(event.key==='Enter'){ addTemplateItem(GP(${gi}), this.value); ayarlarDraft[GP(${gi})]=''; }">
            <button onclick="const inp=this.previousElementSibling; addTemplateItem(GP(${gi}), inp.value); ayarlarDraft[GP(${gi})]='';">Ekle</button>
          </div>
          <button class="ayarlar-reset" onclick="resetTemplateGroup(GP(${gi}))">↺ Varsayılanlara Dön</button>
        </div>` : ''}
      </div>`;
  }).join('');
  return `
    <div class="section-title"><h3>⚙ Maliyet Ayarları — Şablon Kütüphanesi</h3></div>
    <p class="hint">Buradaki kalemler diğer sekmelerdeki öneri kutularında görünür. Kutucuğu kaldırırsan o kalem önerilerden gizlenir (silinmez). Bir kaleme fiyat/oran girersen, o ismi bir projede yazdığında ilgili alan (varsa boşsa) otomatik dolar — <b>mevcut kalemlerin fiyatı sen girmeden asla değişmez</b>. Bu liste tüm projeler için ortaktır, proje bazında değişmez.</p>
    <button class="add-row-btn" onclick="syncAllProjectItemsToLibrary()" title="Kayıtlı tüm projelerde şimdiye kadar yazılmış, henüz şablonda olmayan kalemleri tek seferde buraya ekler">⟳ Tüm projelerdeki kalemleri şablona aktar</button>
    <div class="ayarlar-groups">${groups}</div>`;
}

/* ============================================================
   CALC — re-render totals live, without losing where you were typing
============================================================ */
function calc(){
  const active = document.activeElement;
  let saved = null;
  if(active && active.dataset && active.dataset.key){
    saved = {
      key: active.dataset.key,
      start: (typeof active.selectionStart === 'number') ? active.selectionStart : null,
      end: (typeof active.selectionEnd === 'number') ? active.selectionEnd : null
    };
  }
  renderPanels();
  if(saved){
    const el = document.querySelector(`[data-key="${saved.key}"]`);
    if(el){
      el.focus();
      if(saved.start !== null && el.setSelectionRange){
        try{ el.setSelectionRange(saved.start, saved.end); }catch(e){ /* not all input types support this */ }
      }
    }
  }
  autosave();
}
function renderAll(){
  document.getElementById('jobName').value = state.name || '';
  document.getElementById('jobKategori').value = state.kategori || 'Etkinlik / Tur';
  document.getElementById('jobTarih').value = state.tarih || '';
   document.getElementById('projeBaslangic').value = state.projeBaslangic || '';
  document.getElementById('projeBitis').value = state.projeBitis || '';
  document.getElementById('jobParaBirimi').value = state.displayCurrency || 'TL';
  renderKurNotu();
  renderSidebar(); renderTabs(); renderPanels();
}

function renderKurNotu(){
  const sel = document.getElementById('jobParaBirimi');
  if(!sel) return;
  const cur = state.displayCurrency || 'TL';
  if(cur === 'TL'){ sel.title = ''; return; }
  const kur = cur === 'USD' ? state.kurUSD : state.kurEUR;
  sel.title = `1 ${cur} = ${kur} ₺ (Prodüksiyon sekmesinden değiştirilir)`;
}



/* Türkçe klavyede ondalık virgülle yazılır ("12,5"); hesaplar nokta bekliyor.
   Capture fazında, satırın kendi oninput'undan ÖNCE çalışır. */
document.getElementById('modeAdvanced').addEventListener('input', e=>{
  const t = e.target;
  if(t.inputMode==='decimal' && t.value.includes(',')) t.value = t.value.replace(/,/g,'.');
}, true);

/* ============================================================
   INIT
============================================================ */
async function baslat(){
  try{
    const cevap = await fetch('/api/projeler');
    jobs = await cevap.json();
  }catch(err){
    console.error('Projeler yüklenemedi:', err);
    jobs = [];
  }
  state = initState();
  renderAll();
}
baslat();
