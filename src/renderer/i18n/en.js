// English — ProQuote Messages (en)
window.registerLang && window.registerLang('en', {
  app: { name: "ProQuote", subtitle: "Quotation System", version: "Professional Edition v5.3" },
  nav: {
    main: "Main", management: "Management", system: "System",
    dash: "Dashboard", quotes: "Quotations", tech: "Technical Offer",
    receipt: "Receipt List", custom: "Custom Doc", full: "Integrated",
    clients: "Clients", products: "Products", documents: "Documents", settings: "Settings"
  },
  page: {
    dash: { title: "Dashboard", sub: "Overview" },
    quotes: { title: "Quotations", sub: "Manage quotations" },
    clients: { title: "Clients", sub: "Manage clients" },
    products: { title: "Products", sub: "Manage products" },
    tech: { title: "Technical Offer", sub: "Show products with quantities, no prices" },
    receipt: { title: "Receipt List", sub: "Received items list with customizable columns" },
    custom: { title: "Custom Doc", sub: "Letters, authorization, notice, correspondence" },
    full: { title: "Integrated", sub: "Generate 3 documents (technical + receipt + authorization) from one quote" },
    documents: { title: "Documents", sub: "Manage files and documents (commercial register, tax card...)" },
    settings: { title: "Settings", sub: "Customize the application" }
  },
  btn: {
    new: "New", newQuote: "New Quote", save: "Save", savePreview: "Save & Preview",
    cancel: "Cancel", close: "Close", delete: "Delete", edit: "Edit", copy: "Copy",
    view: "Preview", export: "Export", import: "Import", backup: "Backup", restore: "Restore",
    activate: "Activate", print: "Print", pdf: "PDF", whatsapp: "WhatsApp", email: "Email",
    add: "Item", addProduct: "Add Product", addItem: "Item", addColumn: "Extra Column",
    all: "All", upload: "Upload Document", newFolder: "New Folder", generate: "Generate All Three",
    yes: "Yes", no: "No", ok: "OK", reset: "Delete All"
  },
  label: {
    search: "Search...", searchClient: "Search client...", searchProduct: "Search product...",
    client: "Client", offer: "Offer", details: "Details", items: "Items", columns: "Column Settings",
    quoteNo: "Quote No.", date: "Date", validUntil: "Valid Until", status: "Status",
    currency: "Currency", subject: "Subject", name: "Name", email: "Email", phone: "Phone",
    address: "Address", taxNumber: "Tax Number", commercialRegister: "Commercial Register",
    productName: "Product Name", productCode: "Product Code", description: "Description",
    price: "Price", unit: "Unit", url: "Link (QR)", qty: "Qty", total: "Total",
    subtotal: "Subtotal", discount: "Discount %", tax: "Tax", notes: "Notes",
    extraInfo: "Extra Info", folder: "Folder", file: "Document"
  },
  status: { draft: "Draft", sent: "Sent", approved: "Approved", rejected: "Rejected" },
  empty: {
    noQuotes: "No quotations", noResults: "No results", noClients: "No clients",
    noProducts: "No products", noTech: "No technical offers", noReceipt: "No receipt lists",
    noCustom: "No custom documents", noDocuments: "No documents yet",
    noFilesInFolder: "No documents in this folder",
    emptyProducts: "Create a product to add it to quotations"
  },
  stats: { totalQuotes: "Total Quotes", sent: "Sent", approved: "Approved", total: "Total", conversionRate: "Conversion Rate", recentQuotes: "Recent Quotes" },
  modal: {
    newQuote: "New Quotation", editQuote: "Edit: ", newClient: "New Client", editClient: "Edit",
    newProduct: "New Product", editProduct: "Edit", newTech: "New Technical Offer", editTech: "Edit: ",
    newReceipt: "New Receipt List", editReceipt: "Edit: ", newCustom: "New Custom Doc", editCustom: "Edit: ",
    newFolder: "New Folder", renameFolder: "New folder name:", uploadDoc: "Upload Document",
    shareDoc: "Share Document", confirm: "Confirm", confirmDelete: "All data will be replaced. Are you sure?",
    addColumn: "Add Column", columnName: "Column Name", isPriceCol: "Price column (numeric)"
  },
  toast: {
    saved: "Saved", created: "Created", updated: "Updated", deleted: "Deleted",
    exported: "Exported", imported: "Imported", copied: "Copied",
    needClientName: "Enter client name", needClientName2: "Enter client name first",
    needItem: "Add an item", needItem2: "Add an item first", needName: "Enter a name",
    needProductName: "Enter product name", needFolderName: "Enter folder name",
    needColumnName: "Enter column name", needContent: "Enter content",
    needFile: "Choose a file first", fileTooBig: "File too large", invalidFile: "Invalid file",
    columnAdded: "Column added", templateSelected: "Selected: ", docCreated: "Created",
    backupCreated: "Backup saved", backupRestored: "Restored",
    invalidKey: "Invalid key", activated: "Activated successfully! Thank you for purchasing ProQuote.",
    logoUploaded: "Logo uploaded", logoRemoved: "Logo removed",
    folderCreated: "Folder created", folderRenamed: "Renamed", folderDeleted: "Folder and contents deleted",
    docUploaded: "Document uploaded", docDownloaded: "Document downloaded", docShared: "Document downloaded and WhatsApp opened",
    generating: "Generating PDF...", pdfReady: "Downloaded", genTech: "Technical offer created from quote",
    genReceipt: "Receipt list created", genAuth: "Authorization created", genAll: "Three documents generated from quote"
  },
  print: {
    quotation: "QUOTATION", customer: "Customer", recipient: "Recipient / Customer",
    offerInfo: "Offer", receiptInfo: "Receipt", date: "Date", validity: "Validity", subject: "Subject",
    code: "Code", item: "Item", items: "Items", description: "Description", qty: "Qty",
    price: "Price", total: "Total", subtotal: "Subtotal", discount: "Discount", tax: "Tax",
    notes: "Notes", conditions: "Terms & Conditions", customerSign: "Customer Signature",
    companySign: "Company Signature", recipientSign: "Recipient", responsibleSign: "Responsible",
    signerLabel: "Signature", extraInfo: "Extra Info", target: "To: ",
    taxShort: "VAT", crShort: "CR",
    tech: "Technical Offer", receipt: "Receipt List", authorization: "Authorization"
  },
  license: {
    trial: "Trial Version", activated: "Activated", expired: "Expired",
    daysLeft: "{n} days left", clickToActivate: "Click to activate", clickForDetails: "Click for details",
    title: "License Activation", deviceId: "Device ID (show to vendor)",
    key: "License Key", deviceIdHint: "Send the device ID above to the vendor to get a key bound to your device. Each key works on one device only.",
    verifying: "Verifying...", enterKey: "Enter license key",
    wrongDevice: "This key is bound to another device", keyExpired: "This key has expired",
    keyInvalid: "Decryption failed — invalid key", enterDeviceId: "Enter device ID",
    enterDeviceIdHint: "Invalid device ID (English letters and digits only)"
  },
  tier: { basic: "Basic", professional: "Professional", enterprise: "Enterprise", trial: "Trial" },
  settings: {
    company: "Company", terms: "Terms", docs: "Documents", templates: "Templates", general: "General",
    language: "Language", languageHint: "Choose interface language. The app will update instantly.",
    logo: "Company Logo", uploadLogo: "Click to upload logo", logoHint: "PNG, JPG, SVG — 2MB",
    logoSize: "Logo Size", logoAlign: "Logo Alignment", logoLayout: "Logo Layout (single row)",
    companyInfo: "Company Information", quotationHeading: "Quotation Heading",
    headingText: "Text", headingColor: "Font Color (leave empty for template default)", headingSize: "Font Size (0 = default)",
    termsConditions: "Terms & Conditions", showTerms: "Show", termsEditHint: "Edit titles and texts. Leave empty to hide.",
    layout: "Layout", bars: "Bars", oneCol: "One Column", twoCols: "Two Columns", threeCols: "Three Columns",
    withBars: "With Bars", withoutBars: "Without",
    numberingPrefixes: "Numbering Prefixes & Titles", quotePrefix: "Quote Prefix",
    techPrefix: "Technical Prefix", customPrefix: "Custom Prefix", receiptPrefix: "Receipt Prefix",
    authPrefix: "Authorization Prefix", techTitle: "Technical Title", receiptTitle: "Receipt Title",
    authTitle: "Authorization Title", showCodeTech: "Show product code in technical offer", showQRTech: "Show QR in technical offer",
    signerData: "Default Signer Data", signerName: "Signer Name", signerTitle: "Signer Title",
    receiptTemplate: "Receipt Template", receiptTemplateHint: "Use [Company Name] and [Target Name] for auto-replacement on preview.",
    receiptItemsSection: "Receipt Section (with items)", receiptItemsHint: "Default settings for the standalone receipt section — applied when creating new receipts.",
    receiptExtraTitle: "Receipt Title", authTemplate: "Authorization Template",
    columnsDefaults: "Default Column Settings", columnsHint: "Applied when creating new quotations or technical offers. Can be customized per document later.",
    showCodeQuote: "Show code in quote", showQRQuote: "Show QR in quote",
    showCodeTechDef: "Show code in technical offer", showQRTechDef: "Show QR in technical offer",
    extraColsQuote: "Default extra columns for quote (comma-separated)", extraColsTech: "Default extra columns for technical offer (comma-separated)",
    chooseTemplate: "Choose Template", templateHint: "Each template has different dividers and colors between sections.",
    fonts: "Fonts", headingFont: "Heading Font", bodyFont: "Body Font", headingSize: "Heading Size", bodySize: "Body Size",
    offerSettings: "Offer Settings", defaultCurrency: "Default Currency", taxPercent: "Tax %",
    validityDays: "Validity (days)", numberPrefix: "Number Prefix",
    deleteAll: "Delete All", confirmDeleteAll: "Delete all data permanently?",
    sizeSmall: "Small 40px", sizeMedium: "Medium 60px", sizeLarge: "Large 80px", sizeXLarge: "X-Large 110px", sizeHuge: "Huge 140px",
    right: "Right", left: "Left", center: "Center"
  },
  terms: {
    pay: "Payment Terms", payBody: "The customer is committed to pay the amount within 30 days from the approval date.",
    del: "Delivery Terms", delBody: "Delivery within 15-20 business days from order confirmation.",
    war: "Warranty Terms", warBody: "One year warranty from delivery against manufacturing defects.",
    ret: "Return Terms", retBody: "Returns not accepted after 7 days from delivery.",
    dim: "Dimensions & Specs", dimBody: "Dimensions are approximate within accepted standards (±5%).",
    col: "Colors & Finishes", colBody: "Final color may differ from what appears on screen.",
    gen: "General Notes", genBody: "Offer valid for the validity period. Prices do not include shipping."
  },
  templates: {
    classic: { name: "Classic", desc: "Teal — single line divider" },
    elegant: { name: "Elegant", desc: "Gold — dark double divider" },
    modern: { name: "Modern", desc: "Blue — gradient divider" },
    minimal: { name: "Minimal", desc: "Black & white — dotted divider" },
    warm: { name: "Warm", desc: "Earth — thick divider" },
    corporate: { name: "Corporate", desc: "Navy — triple divider" },
    creative: { name: "Creative", desc: "Colorful gradient — arc divider" },
    formal: { name: "Formal", desc: "Dark green — parallel lines divider" },
    t34: { name: "T34 Gold", desc: "Gold & navy — diamond divider" }
  },
  units: { piece: "Piece", kilo: "Kilo", meter: "Meter", liter: "Liter", hour: "Hour", day: "Day", month: "Month", service: "Service" },
  documents: {
    deleteProtection: "To delete any file or document you must enter the password: 0000 — a cautionary notice to protect your data.",
    shareHint: "The document will be downloaded first, then WhatsApp/Email will open to attach it manually.",
    selectClient: "Select Client (optional — auto-fills number)", withoutClient: "-- None --",
    whatsappNumber: "WhatsApp Number (with country code)", shareMsg: "Attached Message", msgPlaceholder: "Message text..."
  },
  full: {
    howToTitle: "How It Works",
    howToBody: "Select a quotation from the list below and the technical offer, receipt list (with items), and authorization will be generated automatically with the same client and product data, all linked by a shared batch number.",
    derivedDocs: "Derived Documents", generateNow: "Generate All Three Now"
  },
  menu: { file: "File", edit: "Edit", view: "View", help: "Help", newQuote: "New Quote (Ctrl+N)", exit: "Exit", reload: "Reload", fullscreen: "Fullscreen", devTools: "Developer Tools", about: "About ProQuote", checkUpdates: "Check for Updates" },
  misc: { optional: "optional", none: "—", or: "or", fillDots: ".................................", signatureLine: "..........................................." }
});

// ===== إضافات التحديث 7.0 (أقسام جديدة) =====
(function(){var m=window.__I18N_MESSAGES&&window.__I18N_MESSAGES['en'];if(!m)return;Object.assign(m.nav||(m.nav={}),{"samples":"Samples","supply":"Supply Orders","returns":"Returns","tenders":"Tenders","shipping":"Delivery & Shipping","finance":"Finance","payments":"Payments","receivables":"Receivables","warehouse":"Warehouse"});Object.assign(m.page||(m.page={}),{"samples":{"title":"Samples","sub":"Track samples sent to clients"},"supply":{"title":"Supply Orders","sub":"Orders and payments"},"returns":{"title":"Returns","sub":"Manage returned goods"},"tenders":{"title":"Tenders & Contracts","sub":"Tenders, bonds and guarantees"},"shipping":{"title":"Delivery & Shipping","sub":"Shipments and couriers"},"payments":{"title":"Payments","sub":"Outgoing payments"},"receivables":{"title":"Receivables","sub":"Open receivables"},"warehouse":{"title":"Warehouse","sub":"Stocks, items and movements"}});window.registerLang&&window.registerLang('en',m)})();

// ===== إضافات التحديث 8.0 =====
(function(){var m=window.__I18N_MESSAGES&&window.__I18N_MESSAGES['en'];if(!m)return;Object.assign(m.nav||(m.nav={}),{"auth":"Authorizations","io":"In / Out","mfg":"Manufacturing","notes":"Notes"});Object.assign(m.page||(m.page={}),{"auth":{"title":"Authorizations","sub":"All authorizations and types"},"io":{"title":"In / Out","sub":"Receive and deliver log"},"mfg":{"title":"Manufacturing","sub":"Work orders and costs"},"notes":{"title":"Notes","sub":"Reminders and tasks"}});window.registerLang&&window.registerLang('en',m)})();
;(function(){var m=window.__I18N_MESSAGES['en'];if(!m)return;m.nav=m.nav||{};m.page=m.page||{};m.nav.adm='Administration';m.nav.rcpt='Cash Receipts';m.nav.emp='Employees';m.nav.ei='E-Invoice';m.nav.sub='Subscriptions';m.page.adm={title:'Administration',sub:'Users, permissions & roles'};m.page.rcpt={title:'Cash Receipts',sub:'Cash receipt vouchers'};m.page.emp={title:'Employees',sub:'Employee registry & cards'};m.page.ei={title:'E-Invoice',sub:'Tax invoices — Egypt ETA & global taxes'};m.page.sub={title:'Subscriptions',sub:'Monthly & yearly plans'};window.registerLang&&window.registerLang('en',m)})();
