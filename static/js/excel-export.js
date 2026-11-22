/* ============================================================
   EXCEL EXPORT — Encore "BÜTÇE TEKLİFİ" şablonu
   örnek bir prodüksiyon bütçe teklifi baz alınarak hazırlanmıştır: başlık +
   PROJE ADI / TARİH / GENEL TOPLAM (KDV Hariç–Dahil) bloğu, EKİP, her
   prodüksiyon kategorisi kendi ADET/BİRİM FİYAT/GÜN/TUTAR tablosuyla,
   sabit giderler ve en altta şirketin standart ANLAŞMA KOŞULLARI metni.
   Bilet/kesinti/gelir/kâr gibi müşteriye gösterilmeyecek dahili veriler
   ayrı bir sekmede tutulur — bir bütçe teklifinde müşteriye kâr marjınız
   gösterilmez, sadece maliyet kalemleri gösterilir.
============================================================ */
const ANLASMA_KOSULLARI = [
  'Teklifimiz verildiği tarihten itibaren 7 gün geçerlidir.',
  'Encore Prodüksiyon, aşağıdaki şartlarda ENCORE olarak temsil edilecektir.',
  'Bu teklifin / sözleşmenin gizliliği esastır.',
  'İşin onayında %50 ön ödeme, iş bitimini takip eden 30 iş günü içersinde geri kalan meblağ tahsil edilecektir.',
  'Fatura tarihindeki Merkez Bankası Efektif satış kuru baz alınır.',
  'İş tarihinden 3 gün önce iptal edilen sözleşmelerde ENCORE sözleşme tutarının %50 sini fatura eder.',
  'İş tarihinde veya 3 güne kadar olan sözleşme iptallerinde ENCORE sözleşme tutarının tamamını fatura eder.',
  'Hizmeti kesintiye uğratacak, mücbir sebeplerden doğan zararlardan ENCORE sorumlu değildir.',
  'Ödeme Şekli: %50 siparişte, %30 malzeme gümrüğe varışında, bakiye %20 montajdan sonra.',
  'Fiyatlara KDV dahil değildir.',
  'Doğal afet, yangın, su basması, deprem, toplumsal hareketler, halk ayaklanması ve benzeri olaylar mücbir (zorlayıcı) sebep olarak kabul edilir.',
  'Doğacak olan ihtilaflarda İstanbul Mahkemeleri ve İcra Daireleri yetkilidir.',
  'Gerektiğinde cihazların gece emniyetini MÜŞTERİ sağlayacaktır.'
];

/* ============================================================
   LOGO GÖMME — "Bütçe Teklifi" sekmesine Encore logosu
   SheetJS'in ücretsiz sürümü resim YAZAMIYOR (bilinen kısıt). Bu yüzden
   SheetJS'in ürettiği .xlsx dosyasını JSZip ile açıp OOXML'e uygun
   drawing/media parçalarını elle ekliyoruz. Bu yöntem Python/openpyxl ile
   ayrıca üretilip doğrulandı: well-formed XML, resim byte'ları birebir
   aynı, bağımsız bir xlsx okuyucu (openpyxl) sorunsuz geri okudu.
   Herhangi bir adım başarısız olursa (try/catch) sessizce logosuz ama
   ÇALIŞAN dosyaya geri dönülür — bir daha bozuk dosya inmesin diye.
============================================================ */
/* Logo PNG'si dışarıdan dosya yerine export anında canvas'ta çiziliyor:
   solda perde + spot ışığı (index.html'deki SVG ile aynı katmanlar: [path, opaklık, dolgu kuralı]), sağda "ENCORE". */
const BRAND_MARK_LAYERS = [
  ['M425 250H475L640 740H260Z', 0.28, 'nonzero'],
  ['M260 742A190 26 0 1 0 640 742A190 26 0 1 0 260 742Z', 0.55, 'nonzero'],
  ['M120 130H780V205Q725 265 670 205Q615 265 560 205Q505 265 450 205Q395 265 340 205Q285 265 230 205Q175 265 120 205Z M130 245H405C392 380 305 480 228 538C290 600 305 690 305 770H130Z M770 245H495C508 380 595 480 672 538C610 600 595 690 595 770H770Z M200 262C206 370 192 455 168 515L182 521C208 458 222 370 216 262Z M700 262C694 370 708 455 732 515L718 521C692 458 678 370 684 262Z M110 790H790V830H110Z', 1, 'evenodd']
];
function brandPng(w, h){
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = '#000000';
  g.save(); g.scale(h/900, h/900); for(const [d, alpha, rule] of BRAND_MARK_LAYERS){ g.globalAlpha = alpha; g.fill(new Path2D(d), rule); } g.restore();
  g.font = `700 ${Math.round(h*0.42)}px Inter, Arial, sans-serif`;
  g.textBaseline = 'middle';
  g.fillText('ENCORE', h*1.05, h/2);
  return c.toDataURL('image/png').split(',')[1];
}

async function embedLogo(zip, sheetName, footerAnchor){
  const wbXmlStr = await zip.file('xl/workbook.xml').async('string');
  const wbDoc = new DOMParser().parseFromString(wbXmlStr, 'application/xml');
  const sheetEl = Array.from(wbDoc.getElementsByTagName('sheet')).find(s => s.getAttribute('name') === sheetName);
  if(!sheetEl) return false;
  const rId = sheetEl.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id')
           || sheetEl.getAttribute('r:id');
  if(!rId) return false;

  const relsXmlStr = await zip.file('xl/_rels/workbook.xml.rels').async('string');
  const relsDoc = new DOMParser().parseFromString(relsXmlStr, 'application/xml');
  const relEl = Array.from(relsDoc.getElementsByTagName('Relationship')).find(r => r.getAttribute('Id') === rId);
  if(!relEl) return false;

  let target = relEl.getAttribute('Target').replace(/^\/?xl\//,'');
  const sheetPath = 'xl/' + target;
  const sheetFileName = target.split('/').pop();
  const sheetFile = zip.file(sheetPath);
  if(!sheetFile) return false;

  let sheetXml = await sheetFile.async('string');
  if(!sheetXml.includes('</worksheet>')) return false;
  sheetXml = sheetXml.replace('</worksheet>',
    '<drawing xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="rId1"/></worksheet>');
  zip.file(sheetPath, sheetXml);

  zip.file(`xl/worksheets/_rels/${sheetFileName}.rels`,
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/>' +
    '</Relationships>');

  const footerPic = footerAnchor ?
    '<oneCellAnchor><from><col>' + footerAnchor.col + '</col><colOff>0</colOff><row>' + footerAnchor.row + '</row><rowOff>0</rowOff></from>' +
    '<ext cx="3333750" cy="410150"/>' +
    '<pic><nvPicPr><cNvPr id="2" name="Footer Banner" descr="Encore Footer Banner"/><cNvPicPr/></nvPicPr>' +
    '<blipFill><a:blip cstate="print" r:embed="rId2"/><a:stretch><a:fillRect/></a:stretch></blipFill>' +
    '<spPr><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></spPr></pic>' +
    '<clientData/></oneCellAnchor>' : '';

  zip.file('xl/drawings/drawing1.xml',
    '<wsDr xmlns="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" ' +
    'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    '<oneCellAnchor><from><col>4</col><colOff>0</colOff><row>0</row><rowOff>0</rowOff></from>' +
    '<ext cx="2352675" cy="685800"/>' +
    '<pic><nvPicPr><cNvPr id="1" name="Logo" descr="Encore Logo"/><cNvPicPr/></nvPicPr>' +
    '<blipFill><a:blip cstate="print" r:embed="rId1"/><a:stretch><a:fillRect/></a:stretch></blipFill>' +
    '<spPr><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></spPr></pic>' +
    '<clientData/></oneCellAnchor>' +
    footerPic +
    '</wsDr>');

  const footerRel = footerAnchor ?
    '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/logo2.png"/>' : '';
  zip.file('xl/drawings/_rels/drawing1.xml.rels',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/logo1.png"/>' +
    footerRel +
    '</Relationships>');
  zip.file('xl/media/logo1.png', brandPng(686, 200), {base64:true});
  if(footerAnchor) zip.file('xl/media/logo2.png', brandPng(1050, 130), {base64:true});

  let ct = await zip.file('[Content_Types].xml').async('string');
  if(!ct.includes('Extension="png"'))
    ct = ct.replace('</Types>', '<Default Extension="png" ContentType="image/png"/></Types>');
  if(!ct.includes('/xl/drawings/drawing1.xml'))
    ct = ct.replace('</Types>', '<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/></Types>');
  zip.file('[Content_Types].xml', ct);
  return true;
}

/* ============================================================
   HÜCRE STİLİ — siyah şerit başlıklar, gri alt başlık satırları, kalın
   toplamlar, ₺ para birimi formatı.
   SheetJS'in ücretsiz sürümü stil YAZAMIYOR (renk/font/fill), o yüzden
   burada da logoyla aynı yöntem kullanılıyor: SheetJS'in ürettiği
   styles.xml'e yeni font/fill/numFmt/cellXfs kayıtları elle ekleniyor,
   sonra ilgili hücrelere s="N" attribute'u enjekte ediliyor. Bu tam
   mantık Python/openpyxl ile ayrıca üretilip doğrulandı: renkler, kalın
   yazı ve ₺ formatı bağımsız bir xlsx okuyucusunda (openpyxl) doğru
   okundu, XML well-formed çıktı. ₺ formatında tırnak işareti kullanan
   klasik "₺"#,##0.00 yazımı YERİNE köşeli parantezli [$₺-41F]#,##0.00
   yazımı tercih edildi — tırnak escape sorunu ihtimalini tamamen ortadan
   kaldırmak için (önceki kırılmanın kök nedeni buydu). */
async function applyStyles(zip, sheetName, styleOps){
  if(!styleOps || !styleOps.length) return false;

  const wbXmlStr = await zip.file('xl/workbook.xml').async('string');
  const wbDoc = new DOMParser().parseFromString(wbXmlStr, 'application/xml');
  const sheetEl = Array.from(wbDoc.getElementsByTagName('sheet')).find(s => s.getAttribute('name') === sheetName);
  if(!sheetEl) return false;
  const rId = sheetEl.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id')
           || sheetEl.getAttribute('r:id');
  if(!rId) return false;
  const relsXmlStr = await zip.file('xl/_rels/workbook.xml.rels').async('string');
  const relsDoc = new DOMParser().parseFromString(relsXmlStr, 'application/xml');
  const relEl = Array.from(relsDoc.getElementsByTagName('Relationship')).find(r => r.getAttribute('Id') === rId);
  if(!relEl) return false;
  let target = relEl.getAttribute('Target').replace(/^\/?xl\//,'');
  const sheetPath = 'xl/' + target;
  const sheetFile = zip.file(sheetPath);
  const stylesFile = zip.file('xl/styles.xml');
  if(!sheetFile || !stylesFile) return false;

  let styles = await stylesFile.async('string');
  const getCount = (tag) => { const m = styles.match(new RegExp(`<${tag} count="(\\d+)"`)); return m ? parseInt(m[1],10) : 0; };
  const fontsN = getCount('fonts'), fillsN = getCount('fills'), cellXfsN = getCount('cellXfs'), numFmtsN = getCount('numFmts');
  const NUMFMT_ID = 201; // 163 üzerinde herhangi bir custom id; standart formatlarla çakışmaz

  const FONT_TITLE = fontsN, FONT_WHITE_BOLD = fontsN+1, FONT_DARK_BOLD_SM = fontsN+2, FONT_BOLD = fontsN+3;
  const newFonts =
    `<font><b/><sz val="20"/><color rgb="FF7F7F7F"/><name val="Calibri"/></font>` +
    `<font><b/><sz val="12"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>` +
    `<font><b/><sz val="10.5"/><color rgb="FF000000"/><name val="Calibri"/></font>` +
    `<font><b/><sz val="11"/><color theme="1"/><name val="Calibri"/></font>`;

  const FILL_BLACK = fillsN, FILL_GRAY = fillsN+1;
  const newFills =
    `<fill><patternFill patternType="solid"><fgColor rgb="FF000000"/><bgColor indexed="64"/></patternFill></fill>` +
    `<fill><patternFill patternType="solid"><fgColor rgb="FFBFBFBF"/><bgColor indexed="64"/></patternFill></fill>`;

  // Excel'deki tüm tutarlar TL olduğundan sembol her zaman ₺ (XML-güvenli yazım).
  const newNumFmt = `<numFmt numFmtId="${NUMFMT_ID}" formatCode="[$&#8378;-41F]#,##0.00"/>`;

  const S_TITLE = cellXfsN, S_BAR = cellXfsN+1, S_SUBHEAD = cellXfsN+2, S_BOLD = cellXfsN+3, S_MONEY = cellXfsN+4, S_MONEYBOLD = cellXfsN+5;
  const newCellXfs =
    `<xf numFmtId="0" fontId="${FONT_TITLE}" fillId="0" borderId="0" xfId="0" applyFont="1"/>` +
    `<xf numFmtId="0" fontId="${FONT_WHITE_BOLD}" fillId="${FILL_BLACK}" borderId="0" xfId="0" applyFont="1" applyFill="1"/>` +
    `<xf numFmtId="0" fontId="${FONT_DARK_BOLD_SM}" fillId="${FILL_GRAY}" borderId="0" xfId="0" applyFont="1" applyFill="1"/>` +
    `<xf numFmtId="0" fontId="${FONT_BOLD}" fillId="0" borderId="0" xfId="0" applyFont="1"/>` +
    `<xf numFmtId="${NUMFMT_ID}" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>` +
    `<xf numFmtId="${NUMFMT_ID}" fontId="${FONT_BOLD}" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>`;

  const STYLE_IDX = { title:S_TITLE, bar:S_BAR, subHead:S_SUBHEAD, bold:S_BOLD, money:S_MONEY, moneyBold:S_MONEYBOLD };

  /* ÖNEMLİ: newNumFmt içindeki "[$₺-41F]" yazımı bir $ karakteri barındırıyor. JS'in
     String.replace(str, replacement) fonksiyonu, replacement bir STRING olduğunda "$&",
     "$1" gibi özel kalıpları String bulunsa bile yorumluyor (arama deseni regex olmasa
     bile!) — "$&" tam da bu numFmt'teki "[$&#8378;...]" içinde var, ve önceki bir denemede
     bu yüzden format kodu sessizce bozulmuştu. Bunu tamamen bertaraf etmek için index/slice
     tabanlı, "özel kalıp" yorumlaması YAPMAYAN kendi ekleme fonksiyonlarımızı kullanıyoruz. */
  const insertBefore = (str, marker, insertion) => {
    const idx = str.indexOf(marker);
    return idx === -1 ? str : str.slice(0, idx) + insertion + str.slice(idx);
  };
  const replaceOnce = (str, target, replacement) => {
    const idx = str.indexOf(target);
    return idx === -1 ? str : str.slice(0, idx) + replacement + str.slice(idx + target.length);
  };

  if(!/<numFmts[ >]/.test(styles)){
    // numFmts elemanı hiç yoksa (çoğu dosyada custom format olmadığı için olmaz) — şema
    // sırasına göre <fonts>'tan hemen önce yeni bir tane oluştur.
    styles = insertBefore(styles, '<fonts', `<numFmts count="1">${newNumFmt}</numFmts>`);
  }else if(styles.includes('<numFmts count="0"/>')){
    styles = replaceOnce(styles, '<numFmts count="0"/>', `<numFmts count="1">${newNumFmt}</numFmts>`);
  }else{
    styles = styles.replace(/(<numFmts count=")(\d+)(">)/, (m,a,b,c)=>`${a}${parseInt(b,10)+1}${c}`);
    styles = insertBefore(styles, '</numFmts>', newNumFmt);
  }
  styles = styles.replace(/(<fonts count=")(\d+)(">)/, (m,a,b,c)=>`${a}${parseInt(b,10)+4}${c}`);
  styles = insertBefore(styles, '</fonts>', newFonts);
  styles = styles.replace(/(<fills count=")(\d+)(">)/, (m,a,b,c)=>`${a}${parseInt(b,10)+2}${c}`);
  styles = insertBefore(styles, '</fills>', newFills);
  styles = styles.replace(/(<cellXfs count=")(\d+)(">)/, (m,a,b,c)=>`${a}${parseInt(b,10)+6}${c}`);
  styles = insertBefore(styles, '</cellXfs>', newCellXfs);
  zip.file('xl/styles.xml', styles);

  let sheetXml = await sheetFile.async('string');
  const colLetter = c => String.fromCharCode(65+c);
  styleOps.forEach(({r,c,style})=>{
    const sIdx = STYLE_IDX[style];
    if(sIdx===undefined) return;
    const ref = colLetter(c) + (r+1);
    const marker = `<c r="${ref}"`;
    const idx = sheetXml.indexOf(marker);
    if(idx !== -1 && !/[\w-]/.test(sheetXml[idx+marker.length])){
      sheetXml = sheetXml.slice(0, idx) + `<c r="${ref}" s="${sIdx}"` + sheetXml.slice(idx+marker.length);
    }
  });
  zip.file(sheetPath, sheetXml);
  return true;
}

async function exportExcel(){
  const wb = XLSX.utils.book_new();
  const maliyet = +toplamMaliyet();
  const tarihStr = state.tarih ? new Date(state.tarih+'T00:00:00').toLocaleDateString('tr-TR') : '';

  const teklif = [];
  const merges = [];
  const styleOps = [];
  const full8 = (arr) => { const r = arr.slice(0,8); while(r.length<8) r.push(''); return r; };
  const fullMerge = () => merges.push({ s:{r:teklif.length-1,c:0}, e:{r:teklif.length-1,c:7} });
  const styleCell = (r,c,style) => styleOps.push({r,c,style});
  const styleRow = (r,style) => { for(let c=0;c<=7;c++) styleCell(r,c,style); };
  const addBar = (text) => { teklif.push(full8([text])); fullMerge(); styleRow(teklif.length-1,'bar'); };
  const addSubHead = (cols) => { teklif.push(full8(cols)); styleRow(teklif.length-1,'subHead'); };
  const addTotalRow = (label, value) => {
    teklif.push(full8(['', label, '', '', '', '', '', value]));
    styleCell(teklif.length-1, 1, 'bold');
    styleCell(teklif.length-1, 7, 'moneyBold');
  };
  const moneyAt = (colIdx) => styleCell(teklif.length-1, colIdx, 'money');

  teklif.push(full8(['BÜTÇE TEKLİFİ']));
  merges.push({ s:{r:0,c:0}, e:{r:0,c:3} });
  styleCell(0, 0, 'title');
  teklif.push([]);
  teklif.push([]);

    teklif.push(full8(['PROJE ADI', '', 'MARKA / ŞİRKET', '', 'TEKLİF TARİHİ', '', 'TOPLAM MALİYET', '']));
  [0,2,4,6].forEach(c=>styleCell(teklif.length-1,c,'bold'));
    teklif.push(full8([state.name||'', '', '', '', tarihStr, '', maliyet, 'KDV Hariç']));
  teklif.push(full8(['', '', '', '', '', '', maliyet*0.20, 'KDV %20']));
  moneyAt(6);
  teklif.push(full8(['', '', '', '', '', '', maliyet*1.20, 'KDV Dahil']));
  moneyAt(6); styleCell(teklif.length-1,7,'bold');
  teklif.push([]);
  teklif.push(full8(['', '', 'PROJE TARİHLERİ', '', 'SÜRE', '', '', '']));
  [2,4].forEach(c=>styleCell(teklif.length-1,c,'bold'));
  teklif.push(full8(['', '', sureMetni(), '', sureAy()+' ay', '', '', '']));
  teklif.push([]);

  addBar('EKİP');
  addSubHead(['#', 'UNVAN', 'AÇIKLAMA', 'KİŞİ', 'AY', 'BRÜT', '', 'TUTAR (TL)']);
  state.personnel.forEach((r,i)=>{
    const tutar = ((+r.brut||0)+(+r.yemek||0)+(+r.yol||0)+(+r.digerYanHak||0))*(+r.kisi||0)*(+r.ay||0);
    const parcalar = [r.not||'', `${r.kisi||0} kişi × ${r.ay||0} ay`];
    if(r.dahil===false) parcalar.push('(toplama dahil değil)');
    teklif.push(full8([i+1, r.unvan||'', parcalar.filter(Boolean).join(' — '), r.kisi||'', r.ay||'', r.brut||'', '', +(r.dahil===false?0:tutar)]));
    moneyAt(7);
  });
  addTotalRow('EKİP TOPLAM', +personelToplam());
  teklif.push([]);

    prodKategoriler().forEach(cat=>{
    const items = state.production[cat];
    addBar(cat.toUpperCase());
          addSubHead(['#', 'KALEM', 'AÇIKLAMA', 'ADET', 'GÜN', 'BİRİM FİYAT (TL)', 'NOT', 'TUTAR (TL)']);
    items.forEach((r,i)=>{
      const tutar = prodSatirTutar(r);
            teklif.push(full8([i+1, r.kalem||'', '', r.adet||'', r.gun||'', r.fiyat||'', r.kalemNot||'', +tutar]));
      moneyAt(7);
    });
    addTotalRow(cat.toUpperCase()+' TOPLAM', +prodKategoriToplam(cat));
    teklif.push([]);
  });

  addBar('SABİT AYLIK GİDERLER');
  addSubHead(['GİDER KALEMİ', 'AYLIK TUTAR (TL)', 'PROJE SÜRESİ (AY)', 'NOT', '', '', '', 'TOPLAM (TL)']);
  state.fixedCosts.forEach(r=>{
        teklif.push(full8([r.kalem||'', +(r.tutar||0), sureAy(), r.kalemNot||'', '', '', '', +(+r.tutar||0)*sureAy()]));
    moneyAt(1); moneyAt(7);
  });
  addTotalRow('SABİT GİDER TOPLAM', +sabitToplam());

  addTotalRow('GENEL TOPLAM MALİYET (KDV Hariç)', maliyet);
  teklif.push([]);
  teklif.push([]);
    addBar('NOTLAR / AÇIKLAMALAR');
  const notSatirlari = String(state.notlar || '')
    .split(/\r?\n/)
    .flatMap(satir => satir.match(/.{1,110}(\s|$)/g) || ['']);
  notSatirlari.forEach(satir => {
    teklif.push(full8([satir.trim()]));
    fullMerge();
  });
  teklif.push([]);

  addBar('ANLAŞMA KOŞULLARI');
  ANLASMA_KOSULLARI.forEach(t=>{ teklif.push(full8([t])); fullMerge(); });
  teklif.push([]);
  const footerLogoRow = teklif.length;
  for(let i=0;i<3;i++){ teklif.push(full8([''])); styleRow(teklif.length-1, 'bar'); }
  addBar('');
  teklif.push([]);

  const wsTeklif = XLSX.utils.aoa_to_sheet(teklif);
  wsTeklif['!cols'] = [
    {wch: 4},
    {wch: 20},
    {wch: 28},
    {wch: 10},
    {wch: 8},
    {wch: 14},
    {wch: 2},
    {wch: 16}
  ];
  wsTeklif['!rows'] = [{hpt: 25}]; // SheetJS dizi bekler
  wsTeklif['!merges'] = merges;
  XLSX.utils.book_append_sheet(wb, wsTeklif, 'Bütçe Teklifi');

  const gelirSayfa = [];
  gelirSayfa.push(['BİLET FİYATI VE KESİNTİLER (Dahili)']);
  gelirSayfa.push(['Brüt Bilet Fiyatı', +state.biletFiyati]);
  gelirSayfa.push([]);
  gelirSayfa.push(['Kesinti Kalemi','Oran %','Dahil mi']);
  state.kesintiler.forEach(k=> gelirSayfa.push([k.ad, k.oran, k.dahil?'Evet':'Hayır']));
  gelirSayfa.push([]);
  gelirSayfa.push(['', 'NET BİLET FİYATI', +netBiletFiyati()]);
  gelirSayfa.push([]);
  gelirSayfa.push([]);
  gelirSayfa.push(['GELİR PROJEKSİYONU']);
  gelirSayfa.push(['Ay','Çalışma Günü','Seans/Gün','Kapasite/Seans','Doluluk %','Satılan Bilet','Bilet Fiyatı','Aylık Gelir']);
  state.gelirAylar.forEach(r=>{
    const satilan = (+r.calismaGunu||0)*(+r.seansGun||0)*(+r.kapasiteSeans||0)*((+r.doluluk||0)/100);
    gelirSayfa.push([r.ay, r.calismaGunu, r.seansGun, r.kapasiteSeans, r.doluluk, Math.round(satilan), +netBiletFiyati(), +(satilan*netBiletFiyati())]);
  });
  gelirSayfa.push(['', 'TOPLAM BİLET GELİRİ','','','','','', +gelirBiletToplam()]);
  gelirSayfa.push([]);
  gelirSayfa.push(['Diğer Gelir Kalemi','Tutar']);
  state.digerGelirler.forEach(r=> gelirSayfa.push([r.ad, +(r.tutar||0)]));
  gelirSayfa.push(['Toplam Diğer Gelir','', +digerGelirToplam()]);
  gelirSayfa.push([]);
  gelirSayfa.push(['', 'GENEL TOPLAM GELİR','','','','','', +gelirToplam()]);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(gelirSayfa), 'Bilet & Gelir (Dahili)');

  const ozet = [
    ['ÖZET P&L (Dahili)', state.name || 'İsimsiz Proje'],
    ['Kategori', state.kategori],
        ['Proje Tarih Aralığı', sureMetni()],
    ['Proje Süresi (Ay)', sureAy()],
    [],
    ['Toplam Personel Gideri', +personelToplam()],
    ['Toplam Sabit Gider', +sabitToplam()],
    ['Toplam Prodüksiyon Gideri', +prodToplam()],
    ['TOPLAM MALİYET', maliyet],
    [],
    ['Genel Toplam Gelir (projeksiyon)', +gelirToplam()],
    ['Proje Bedeli (kullanılan)', +projeBedeli()],
    ['Hedef Kazancınız', +state.hedefKazanc],
    [],
    ['Projeden Kârınız', +kar()],
    ['Kâr Marjı %', karMarji()],
    ['Minimum Kâr Marjı Eşiği %', state.minMarj],
    ['SONUÇ', karMarji()>=state.minMarj ? 'KÂRDASINIZ' : 'KÂRDA DEĞİLSİNİZ'],
    ['Yatırım Tutarı', +state.yatirimTutari],
    ['Geri Ödeme Süresi (Ay)', geriOdemeAy() ?? '—'],
    ['Para Birimi', state.displayCurrency || 'TL']
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ozet), 'Özet P&L (Dahili)');

  const filename = (state.name || 'proje').replace(/[^\wşŞçÇğĞıİöÖüÜ -]/g,'').trim() + '_butce_teklifi.xlsx';
  try{
    const arrBuf = XLSX.write(wb, {bookType:'xlsx', type:'array'});
    const zip = await JSZip.loadAsync(arrBuf);
    await applyStyles(zip, 'Bütçe Teklifi', styleOps);
    await embedLogo(zip, 'Bütçe Teklifi', {row: footerLogoRow, col: 3});
    const blob = await zip.generateAsync({type:'blob', mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(()=>URL.revokeObjectURL(a.href), 4000);
  }catch(err){
    console.error('Logo gömme başarısız oldu, logosuz (ama çalışan) dosya indiriliyor:', err);
    XLSX.writeFile(wb, filename);
  }
}
