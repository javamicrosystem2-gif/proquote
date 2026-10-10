// ============================================================
// ProQuote — Preload Script
// جسر آمن بين الواجهة (Renderer) و Node (Main)
// فقط الواجهات المصرّح بها تُكشف هنا عبر contextBridge
// ============================================================

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('proquote', {
  // ---------- معلومات التطبيق ----------
  getVersion: () => ipcRenderer.invoke('app:get-version'),
  installLang: () => ipcRenderer.invoke('app:install-lang'),
  getUserDataPath: () => ipcRenderer.invoke('app:get-user-data-path'),

  // ---------- حوارات الملفات ----------
  showSaveDialog: (options) => ipcRenderer.invoke('dialog:show-save', options),
  showOpenDialog: (options) => ipcRenderer.invoke('dialog:show-open', options),

  // ---------- التخزين الدائم (بديل localStorage) ----------
  storage: {
    getItem: (key) => ipcRenderer.invoke('storage:getItem', key),
    setItem: (key, value) => ipcRenderer.invoke('storage:setItem', key, value),
    removeItem: (key) => ipcRenderer.invoke('storage:removeItem', key),
    has: (key) => ipcRenderer.invoke('storage:has', key),
    keys: () => ipcRenderer.invoke('storage:keys'),
    clear: () => ipcRenderer.invoke('storage:clear'),
    flush: () => ipcRenderer.invoke('storage:flush'),
    stats: () => ipcRenderer.invoke('storage:stats'),
    getMeta: () => ipcRenderer.invoke('storage:getMeta')
  },

  // ---------- الشركات (تعدد الشركات بعزل كامل) ----------
  companies: {
    list: () => ipcRenderer.invoke('companies:list'),
    create: (name) => ipcRenderer.invoke('companies:create', name),
    setDefault: (id) => ipcRenderer.invoke('companies:set-default', id),
    current: () => ipcRenderer.invoke('companies:current'),
    remove: (id) => ipcRenderer.invoke('companies:delete', id)
  },

  // ---------- النسخ الاحتياطي والاستعادة ----------
  backup: {
    create: (customPath) => ipcRenderer.invoke('backup:create', customPath),
    restore: (srcPath) => ipcRenderer.invoke('backup:restore', srcPath),
    list: () => ipcRenderer.invoke('backup:list'),
    auto: () => ipcRenderer.invoke('backup:auto')
  },

  // ---------- الترحيل التلقائي ----------
  migration: {
    check: () => ipcRenderer.invoke('migration:check'),
    status: () => ipcRenderer.invoke('migration:status'),
    run: (source) => ipcRenderer.invoke('migration:run', source),
    // الاستماع لعرض الترحيل التلقائي
    onOffer: (callback) => {
      const handler = (_evt, data) => callback(data);
      ipcRenderer.on('migration:offer', handler);
      return () => ipcRenderer.removeListener('migration:offer', handler);
    }
  },

  // ---------- التصدير/الاستيراد ----------
  exportAll: () => ipcRenderer.invoke('export:all'),
  importAll: (dataObj) => ipcRenderer.invoke('import:all', dataObj),

  // ---------- ملف سيرفر المزامنة (للعميل يرفعه على سيرفره) ----------
  exportSyncServer: () => ipcRenderer.invoke('sync:export-server'),

  // ---------- الترخيص ----------
  license: {
    getState: () => ipcRenderer.invoke('license:getState'),
    isLicensed: () => ipcRenderer.invoke('license:isLicensed'),
    activate: (key) => ipcRenderer.invoke('license:activate', key),
    deviceId: () => ipcRenderer.invoke('license:deviceId'),
    hasFeature: (feature) => ipcRenderer.invoke('license:hasFeature', feature),
    getTier: () => ipcRenderer.invoke('license:getTier'),
    features: () => ipcRenderer.invoke('license:features')
  },

  // ---------- التخزين الآمن للملفات (FileStore) ----------
  files: {
    save: (name, data, type) => ipcRenderer.invoke('files:save', name, data, type),
    getMeta: (id) => ipcRenderer.invoke('files:getMeta', id),
    read: (id) => ipcRenderer.invoke('files:read', id),
    delete: (id) => ipcRenderer.invoke('files:delete', id),
    saveTo: (id, suggested) => ipcRenderer.invoke('files:saveTo', id, suggested),
    migrateDataURL: (dataURL) => ipcRenderer.invoke('files:migrateDataURL', dataURL),
    stats: () => ipcRenderer.invoke('files:stats'),
    openDir: () => ipcRenderer.invoke('files:openDir')
  },

  // ---------- التحديث التلقائي ----------
  updater: {
    check: () => ipcRenderer.invoke('updater:check'),
    download: () => ipcRenderer.invoke('updater:download'),
    install: () => ipcRenderer.invoke('updater:install'),
    status: () => ipcRenderer.invoke('updater:status'),
    onUpdateStatus: (callback) => {
      const handler = (_evt, data) => callback(data);
      ipcRenderer.on('update-status', handler);
      return () => ipcRenderer.removeListener('update-status', handler);
    }
  },

  // ---------- استيراد/تصدير المنتجات ----------
  products: {
    import: (filePath, mode) => ipcRenderer.invoke('products:import', filePath, mode),
    export: (customPath) => ipcRenderer.invoke('products:export', customPath),
    sample: () => ipcRenderer.invoke('products:sample')
  },

  // ---------- استيراد/تصدير العملاء ----------
  clients: {
    import: (filePath, mode) => ipcRenderer.invoke('clients:import', filePath, mode),
    export: (customPath) => ipcRenderer.invoke('clients:export', customPath),
    sample: () => ipcRenderer.invoke('clients:sample')
  },

  // ---------- أحداث القائمة ----------
  eiRequest: (opts) => ipcRenderer.invoke('ei:request', opts),
  eiSign: (signerPath, docJson) => ipcRenderer.invoke('ei:sign', signerPath, docJson),

  onMenuNewQuote: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('menu-new-quote', handler);
    return () => ipcRenderer.removeListener('menu-new-quote', handler);
  }
});
