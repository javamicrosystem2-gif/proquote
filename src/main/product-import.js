// ============================================================
// ProQuote — استيراد المنتجات من CSV/Excel
// يدعم: CSV (نصي) و XLSX (عبر sheetjs إن توفر، وإلا CSV فقط)
// الأعمدة المتوقعة: code, name, description, price, unit, url
// ============================================================

const { ipcMain } = require('electron');
const fs = require('fs');
const db = require('./db');

// تحليل CSV بسيط (يدعم فواصل ، و ; و \t وعلامات اقتباس)
function parseCSV(text) {
  // كشف الفاصل: ، (عربية) أو ; أو \t أو ,
  let delim = ',';
  const sample = text.split('\n').slice(0, 5).join('\n');
  const counts = {
    ',': (sample.match(/,/g) || []).length,
    ';': (sample.match(/;/g) || []).length,
    '\t': (sample.match(/\t/g) || []).length,
    '،': (sample.match(/،/g) || []).length
  };
  delim = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];

  const lines = text.split(/\r?\n/).filter(l => l.trim());
  const rows = [];
  let current = '';
  let inQuotes = false;

  // دمج الأسطر المكسورة داخل علامات اقتباس
  const merged = [];
  for (const line of lines) {
    if (inQuotes) {
      current += '\n' + line;
      if ((line.match(/"/g) || []).length % 2 === 1) {
        inQuotes = false;
        merged.push(current);
        current = '';
      }
    } else {
      if ((line.match(/"/g) || []).length % 2 === 1) {
        inQuotes = true;
        current = line;
      } else {
        merged.push(line);
      }
    }
  }
  if (current) merged.push(current);

  for (const line of merged) {
    const cells = [];
    let cell = '';
    let q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (q && line[i + 1] === '"') { cell += '"'; i++; }
        else q = !q;
      } else if (ch === delim && !q) {
        cells.push(cell);
        cell = '';
      } else {
        cell += ch;
      }
    }
    cells.push(cell);
    rows.push(cells.map(c => c.trim()));
  }
  return rows;
}

// تحويل صفوف CSV إلى مصفوفة منتجات
// headerRow: الصف الأول (أسماء الأعمدة)
function rowsToProducts(rows) {
  if (rows.length < 2) return { products: [], error: 'الملف فارغ أو لا يحوي بيانات' };

  const header = rows[0].map(h => h.toLowerCase().trim());
  // خريطة الأعمدة: ندعم أسماء عربية وإنجليزية
  const colMap = {
    code: header.findIndex(h => /^(code|الكود|رمز|باركود|barcode)$/i.test(h)),
    name: header.findIndex(h => /^(name|الاسم|اسم المنتج|product|الصنف|description|الوصف)$/i.test(h)),
    description: header.findIndex(h => /^(desc|description|الوصف|تفاصيل|details)$/i.test(h)),
    price: header.findIndex(h => /^(price|السعر|سعر|cost|التكلفة|amount)$/i.test(h)),
    unit: header.findIndex(h => /^(unit|الوحدة|وحدة)$/i.test(h)),
    url: header.findIndex(h => /^(url|link|الرابط|رابط|qr)$/i.test(h)),
    hsCode: header.findIndex(h => /^(hs|hscode|hs_code|رمز\s*الجمرك|الجمركي)$/i.test(h)),
    egsCode: header.findIndex(h => /^(egs|egscode|egs_code|الصنف\s*المصرية|تكويد)$/i.test(h))
  };

  // إن لم يُعثر على رأس، اعتبر الصف الأول بيانات (الأعمدة بالترتيب الافتراضي)
  const hasHeader = Object.values(colMap).some(i => i >= 0);
  const dataRows = hasHeader ? rows.slice(1) : rows;
  if (!hasHeader) {
    // افتراض ترتيب: code, name, price, unit, description, url
    colMap.code = 0; colMap.name = 1; colMap.price = 2; colMap.unit = 3; colMap.description = 4; colMap.url = 5;
  }

  const products = [];
  let skipped = 0;
  for (const row of dataRows) {
    const name = colMap.name >= 0 ? (row[colMap.name] || '').trim() : '';
    if (!name) { skipped++; continue; }
    const price = colMap.price >= 0 ? parseFloat(String(row[colMap.price]).replace(/[^\d.-]/g, '')) || 0 : 0;
    const product = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 6),
      code: colMap.code >= 0 ? (row[colMap.code] || '').trim() : '',
      name,
      description: colMap.description >= 0 ? (row[colMap.description] || '').trim() : '',
      price,
      unit: (colMap.unit >= 0 ? (row[colMap.unit] || '').trim() : 'قطعة') || 'قطعة',
      url: colMap.url >= 0 ? (row[colMap.url] || '').trim() : ''
    };
    // حقول إضافية للفاتورة المصرية (تُحفظ في كائن منفصل)
    if (colMap.hsCode >= 0 || colMap.egsCode >= 0) {
      product.eta = {};
      if (colMap.hsCode >= 0) product.eta.hsCode = (row[colMap.hsCode] || '').trim();
      if (colMap.egsCode >= 0) product.eta.egsCode = (row[colMap.egsCode] || '').trim();
    }
    products.push(product);
  }
  return { products, skipped, hasHeader, colMap };
}

// كشف الترميز التلقائي: UTF-8 صالح → استخدمه، وإلا جرّب cp1256 (Excel عربي)، وإلا UTF-16LE
function readCsvSmart(filePath) {
  const buf = fs.readFileSync(filePath);
  // BOM检测
  if (buf.length >= 2 && buf[0] === 0xFF && buf[1] === 0xFE) {
    return buf.toString('utf16le'); // UTF-16LE BOM
  }
  if (buf.length >= 3 && buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) {
    return buf.toString('utf8'); // UTF-8 BOM
  }
  const utf8 = buf.toString('utf8');
  // إن احتوى محارف استبدال Unicode (U+FFFD) فهو ليس UTF-8 صالحاً → cp1256
  if (utf8.includes('\uFFFD')) {
    const cp1256 = buf.toString('latin1');
    // فك ترميز cp1256 يدوياً إلى نص عربي صحيح (بدون اعتماديات خارجية)
    try { return decodeCp1256(cp1256); } catch { return utf8; }
  }
  return utf8;
}
// جدول cp1256 (128-255) — الحروف العربية والرموز
const CP1256_HI = '\u20ac\u060c\u201a\u0192\u201e\u2026\u2020\u2021\u02c6\u2030\u0679\u2039\u0152\u0686\u0698\u0688\u06af\u201c\u201d\u2018\u2019\u2013\u2014\u06c1\u067e\u0686\u06c2\u2018\u06d3\u2014\u06a9\u2122\u0691\u061b\u201c\u06f2\u06f3\u06f4\u06f5\u06f6\u06f7\u06f8\u06f9\u06fb\u06fc\u06fd\u06fe\u06ff\u06cc\u06d5\u200c\u200d\u25a0';
function decodeCp1256(latin) {
  let out = '';
  for (let i = 0; i < latin.length; i++) {
    const c = latin.charCodeAt(i);
    if (c < 128) out += latin[i];
    else {
      const mapped = CP1256_HI[c - 128];
      out += mapped || '?';
    }
  }
  return out;
}

// استيراد ملف CSV إلى قاعدة البيانات
// mode: 'replace' (استبدال الكل) أو 'merge' (دمج مع الموجود)
function importFromFile(filePath, mode = 'merge') {
  try {
    const ext = filePath.toLowerCase().split('.').pop();
    if (ext !== 'csv' && ext !== 'txt') {
      return { success: false, error: 'صيغة غير مدعومة. استخدم CSV. (دعم Excel XLSX قريباً)' };
    }
    const text = readCsvSmart(filePath);
    // إزالة BOM إن وُجد
    const clean = text.replace(/^\uFEFF/, '');
    const rows = parseCSV(clean);
    const result = rowsToProducts(rows);
    if (result.error) return { success: false, error: result.error };

    // قراءة المنتجات الحالية
    const pq5_p = db.getItem('pq5_p');
    let existing = [];
    try { existing = pq5_p ? JSON.parse(pq5_p) : []; } catch {}

    let finalProducts;
    if (mode === 'replace') {
      finalProducts = result.products;
    } else {
      // دمج: تجنّب التكرار بالكود إن وُجد
      const byCode = {};
      existing.forEach(p => { if (p.code) byCode[p.code] = p; });
      const merged = [...existing];
      let added = 0, updated = 0;
      for (const p of result.products) {
        if (p.code && byCode[p.code]) {
          // تحديث الموجود
          const idx = merged.findIndex(x => x.code === p.code);
          if (idx >= 0) { merged[idx] = { ...merged[idx], ...p, id: merged[idx].id }; updated++; }
        } else {
          merged.push(p); added++;
        }
      }
      finalProducts = merged;
      result.added = added;
      result.updated = updated;
    }

    db.setItem('pq5_p', JSON.stringify(finalProducts));
    db.forceFlush();
    result.totalAfter = finalProducts.length;
    result.finalList = finalProducts;
    result.success = true;
    return result;
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// تصدير المنتجات إلى CSV
function exportToCSV(destPath) {
  try {
    const pq5_p = db.getItem('pq5_p');
    const products = pq5_p ? JSON.parse(pq5_p) : [];
    const header = ['الكود', 'الاسم', 'الوصف', 'السعر', 'الوحدة', 'الرابط'];
    const lines = [header.join(',')];
    for (const p of products) {
      const esc = (s) => '"' + String(s || '').replace(/"/g, '""') + '"';
      lines.push([esc(p.code), esc(p.name), esc(p.description), esc(p.price), esc(p.unit), esc(p.url)].join(','));
    }
    fs.writeFileSync(destPath, '\uFEFF' + lines.join('\r\n'), 'utf8'); // BOM للعربية
    return { success: true, count: products.length, path: destPath };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ============================================================
// ===== العملاء: استيراد/تصدير CSV (بنفس أنماط المنتجات) =====
// ============================================================
function rowsToClients(rows) {
  if (rows.length < 2) return { clients: [], error: 'الملف فارغ أو لا يحتوي بيانات' };
  const header = rows[0].map(h => h.toLowerCase().trim());
  const colMap = {
    code: header.findIndex(h => /^(code|الكود)$/i.test(h)),
    name: header.findIndex(h => /^(name|الاسم|اسم العميل|العميل)$/i.test(h)),
    phone: header.findIndex(h => /^(phone|الهاتف|هاتف|الموبايل|موبايل)$/i.test(h)),
    email: header.findIndex(h => /^(email|البريد|الايميل)$/i.test(h)),
    address: header.findIndex(h => /^(address|العنوان|عنوان)$/i.test(h)),
    location: header.findIndex(h => /^(location|اللوكيشن|لوكيشن|الموقع)$/i.test(h)),
    taxNumber: header.findIndex(h => /^(tax|الرقم\s*الضريبي|الضريبي)$/i.test(h)),
    commercialRegister: header.findIndex(h => /^(cr|السجل\s*التجاري|سجل\s*تجاري)$/i.test(h))
  };
  const hasHeader = Object.values(colMap).some(i => i >= 0);
  const dataRows = hasHeader ? rows.slice(1) : rows;
  if (!hasHeader) { colMap.name = 0; colMap.phone = 1; colMap.email = 2; colMap.address = 3; colMap.location = 4; colMap.taxNumber = 5; colMap.commercialRegister = 6; colMap.code = -1; }
  const clients = []; let skipped = 0;
  for (const row of dataRows) {
    const get = (i) => (i >= 0 && row[i] !== undefined) ? String(row[i]).trim() : '';
    const name = get(colMap.name);
    if (!name) { skipped++; continue; }
    clients.push({ name, phone: get(colMap.phone), email: get(colMap.email), address: get(colMap.address), location: get(colMap.location), taxNumber: get(colMap.taxNumber), commercialRegister: get(colMap.commercialRegister), _code: get(colMap.code) });
  }
  return { clients, skipped, hasHeader };
}

function importClientsFromFile(filePath, mode = 'merge') {
  try {
    const text = readCsvSmart(filePath);
    const clean = text.replace(/^\uFEFF/, '');
    const rows = parseCSV(clean);
    const result = rowsToClients(rows);
    if (result.error) return { success: false, error: result.error };
    const raw = db.getItem('pq5_c');
    let existing = [];
    try { existing = raw ? JSON.parse(raw) : []; } catch {}
    let final, added = 0, updated = 0, ignoredDup = 0;
    if (mode === 'replace') {
      final = result.clients.map((c, i) => ({ id: Date.now().toString(36) + Math.random().toString(36).substr(2, 6) + i, code: c._code || '', name: c.name, phone: c.phone, email: c.email, address: c.address, location: c.location, taxNumber: c.taxNumber, commercialRegister: c.commercialRegister, at: Date.now() }));
      added = final.length;
    } else {
      final = [...existing];
      // الدمج: التكرار بالهاتف يُتجاهل، وبالاسم يُحدّث
      for (const c of result.clients) {
        const phDigits = (c.phone || '').replace(/[^0-9]/g, '');
        const byPhone = phDigits ? final.find(x => ((x.phone || '').replace(/[^0-9]/g, '') === phDigits)) : null;
        if (byPhone) { ignoredDup++; continue; }
        const byName = final.find(x => (x.name || '').trim() === c.name);
        if (byName) {
          Object.assign(byName, { phone: byName.phone || c.phone, email: byName.email || c.email, address: byName.address || c.address, location: byName.location || c.location, taxNumber: byName.taxNumber || c.taxNumber, commercialRegister: byName.commercialRegister || c.commercialRegister });
          updated++;
        } else {
          final.push({ id: Date.now().toString(36) + Math.random().toString(36).substr(2, 6), code: c._code || '', name: c.name, phone: c.phone, email: c.email, address: c.address, location: c.location, taxNumber: c.taxNumber, commercialRegister: c.commercialRegister, at: Date.now() });
          added++;
        }
      }
    }
    db.setItem('pq5_c', JSON.stringify(final));
    db.forceFlush();
    return { success: true, imported: result.clients.length, added, updated, ignoredDup, totalAfter: final.length, finalList: final };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function exportClientsToCSV(destPath) {
  try {
    const raw = db.getItem('pq5_c');
    const clients = raw ? JSON.parse(raw) : [];
    const header = ['الكود', 'الاسم', 'الهاتف', 'البريد', 'العنوان', 'اللوكيشن', 'الرقم الضريبي', 'السجل التجاري'];
    const esc = (s) => '"' + String(s || '').replace(/"/g, '""') + '"';
    const lines = [header.join(',')];
    for (const c of clients) {
      lines.push([esc(c.code), esc(c.name), esc(c.phone), esc(c.email), esc(c.address), esc(c.location), esc(c.taxNumber), esc(c.commercialRegister)].join(','));
    }
    fs.writeFileSync(destPath, '\uFEFF' + lines.join('\r\n'), 'utf8');
    return { success: true, count: clients.length, path: destPath };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function registerIpc() {
  ipcMain.handle('products:import', async (_evt, filePath, mode) => {
    let fp = filePath;
    if (!fp) {
      const { dialog, BrowserWindow } = require('electron');
      const win = BrowserWindow.getFocusedWindow();
      const result = await dialog.showOpenDialog(win, {
        title: 'استيراد المنتجات من CSV',
        filters: [{ name: 'CSV', extensions: ['csv', 'txt'] }],
        properties: ['openFile']
      });
      if (result.canceled || result.filePaths.length === 0) return { canceled: true };
      fp = result.filePaths[0];
    }
    return importFromFile(fp, mode || 'merge');
  });

  ipcMain.handle('products:export', async (_evt, customPath) => {
    let fp = customPath;
    if (!fp) {
      const { dialog, BrowserWindow } = require('electron');
      const win = BrowserWindow.getFocusedWindow();
      const result = await dialog.showSaveDialog(win, {
        title: 'تصدير المنتجات إلى CSV',
        defaultPath: 'proquote_products.csv',
        filters: [{ name: 'CSV', extensions: ['csv'] }]
      });
      if (result.canceled || !result.filePath) return { canceled: true };
      fp = result.filePath;
    }
    return exportToCSV(fp);
  });

  // تنزيل ملف CSV نموذجي معبأ بأمثلة
  ipcMain.handle('products:sample', async () => {
    const { dialog, BrowserWindow } = require('electron');
    const win = BrowserWindow.getFocusedWindow();
    const result = await dialog.showSaveDialog(win, {
      title: 'حفظ ملف المنتجات النموذجي',
      defaultPath: 'proquote_products_template.csv',
      filters: [{ name: 'CSV', extensions: ['csv'] }]
    });
    if (result.canceled || !result.filePath) return { canceled: true };
    const rows = [
      ['الكود', 'الاسم', 'الوصف', 'السعر', 'الوحدة', 'الرابط', 'رمز الجمرك', 'تكويد'],
      ['PRD-001', 'كرسي مكتبي', 'كرسي ergonomic جلد طبيعي', '450', 'قطعة', 'https://example.com/p1', '9401.71.00', 'EGS-001'],
      ['PRD-002', 'طاولة اجتماعات', 'طاولة خشب MDF 180×90', '1200', 'قطعة', '', '9403.30.00', 'EGS-002'],
      ['PRD-003', 'سجاد رول', 'سجاد مقاوم للحريق - بالمتر', '85', 'متر', '', '5703.30.00', 'EGS-003'],
      ['PRD-004', 'ستائر توب', 'قماش قطني - بالتوب', '3200', 'يوم', '', '6303.90.00', 'EGS-004']
    ];
    const esc = (s) => '"' + String(s).replace(/"/g, '""') + '"';
    const content = '\uFEFF' + rows.map(r => r.map(esc).join(',')).join('\r\n');
    try {
      fs.writeFileSync(result.filePath, content, 'utf8');
      return { success: true, path: result.filePath };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ===== العملاء =====
  ipcMain.handle('clients:import', async (_evt, filePath, mode) => {
    let fp = filePath;
    if (!fp) {
      const { dialog, BrowserWindow } = require('electron');
      const win = BrowserWindow.getFocusedWindow();
      const result = await dialog.showOpenDialog(win, {
        title: 'استيراد العملاء من CSV',
        filters: [{ name: 'CSV', extensions: ['csv', 'txt'] }],
        properties: ['openFile']
      });
      if (result.canceled || result.filePaths.length === 0) return { canceled: true };
      fp = result.filePaths[0];
    }
    return importClientsFromFile(fp, mode || 'merge');
  });

  ipcMain.handle('clients:export', async (_evt, customPath) => {
    let fp = customPath;
    if (!fp) {
      const { dialog, BrowserWindow } = require('electron');
      const win = BrowserWindow.getFocusedWindow();
      const result = await dialog.showSaveDialog(win, {
        title: 'تصدير العملاء إلى CSV',
        defaultPath: 'proquote_clients.csv',
        filters: [{ name: 'CSV', extensions: ['csv'] }]
      });
      if (result.canceled || !result.filePath) return { canceled: true };
      fp = result.filePath;
    }
    return exportClientsToCSV(fp);
  });

  // تنزيل ملف CSV نموذجي للعملاء
  ipcMain.handle('clients:sample', async () => {
    const { dialog, BrowserWindow } = require('electron');
    const win = BrowserWindow.getFocusedWindow();
    const result = await dialog.showSaveDialog(win, {
      title: 'حفظ ملف العملاء النموذجي',
      defaultPath: 'proquote_clients_template.csv',
      filters: [{ name: 'CSV', extensions: ['csv'] }]
    });
    if (result.canceled || !result.filePath) return { canceled: true };
    const rows = [
      ['الكود', 'الاسم', 'الهاتف', 'البريد', 'العنوان', 'اللوكيشن', 'الرقم الضريبي', 'السجل التجاري'],
      ['', 'شركة النور للتجارة', '01012345678', 'info@alnoor.com', 'القاهرة - مدينة نصر', '30.05, 31.23', '100-200-300', '123456'],
      ['', 'مؤسسة الفجر', '01198765432', 'alfagr@gmail.com', 'الجيزة - الدقي', 'https://maps.app.goo.gl/xyz', '', '']
    ];
    const esc = (s) => '"' + String(s).replace(/"/g, '""') + '"';
    const content = '\uFEFF' + rows.map(r => r.map(esc).join(',')).join('\r\n');
    try {
      fs.writeFileSync(result.filePath, content, 'utf8');
      return { success: true, path: result.filePath };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
}

module.exports = { parseCSV, rowsToProducts, importFromFile, exportToCSV, registerIpc, importClientsFromFile, exportClientsToCSV };
