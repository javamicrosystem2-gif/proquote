// Français — ProQuote Messages (fr)
window.registerLang && window.registerLang('fr', {
  app: { name: "ProQuote", subtitle: "Système de Devis", version: "Édition Professionnelle v5.3" },
  nav: {
    main: "Principal", management: "Gestion", system: "Système",
    dash: "Tableau de bord", quotes: "Devis", tech: "Offre Technique",
    receipt: "Bon de Réception", custom: "Doc Personnalisé", full: "Intégré",
    clients: "Clients", products: "Produits", documents: "Documents", settings: "Paramètres"
  },
  page: {
    dash: { title: "Tableau de bord", sub: "Aperçu" },
    quotes: { title: "Devis", sub: "Gérer les devis" },
    clients: { title: "Clients", sub: "Gérer les clients" },
    products: { title: "Produits", sub: "Gérer les produits" },
    tech: { title: "Offre Technique", sub: "Afficher les produits avec quantités, sans prix" },
    receipt: { title: "Bon de Réception", sub: "Liste d'articles reçus avec colonnes personnalisables" },
    custom: { title: "Doc Personnalisé", sub: "Lettres, procuration, avis, correspondance" },
    full: { title: "Intégré", sub: "Générer 3 documents (technique + réception + procuration) à partir d'un devis" },
    documents: { title: "Documents", sub: "Gérer fichiers et documents (registre commerce, carte fiscale...)" },
    settings: { title: "Paramètres", sub: "Personnaliser l'application" }
  },
  btn: {
    new: "Nouveau", newQuote: "Nouveau Devis", save: "Enregistrer", savePreview: "Enregistrer & Aperçu",
    cancel: "Annuler", close: "Fermer", delete: "Supprimer", edit: "Modifier", copy: "Copier",
    view: "Aperçu", export: "Exporter", import: "Importer", backup: "Sauvegarde", restore: "Restaurer",
    activate: "Activer", print: "Imprimer", pdf: "PDF", whatsapp: "WhatsApp", email: "Email",
    add: "Article", addProduct: "Ajouter Produit", addItem: "Article", addColumn: "Colonne Suppl.",
    all: "Tous", upload: "Télécharger Doc", newFolder: "Nouveau Dossier", generate: "Générer les Trois",
    yes: "Oui", no: "Non", ok: "OK", reset: "Tout Supprimer"
  },
  label: {
    search: "Rechercher...", searchClient: "Rechercher client...", searchProduct: "Rechercher produit...",
    client: "Client", offer: "Offre", details: "Détails", items: "Articles", columns: "Paramètres Colonnes",
    quoteNo: "Devis N°", date: "Date", validUntil: "Valable jusqu'au", status: "Statut",
    currency: "Devise", subject: "Sujet", name: "Nom", email: "Email", phone: "Téléphone",
    address: "Adresse", taxNumber: "N° Fiscal", commercialRegister: "Registre Commerce",
    productName: "Nom du Produit", productCode: "Code Produit", description: "Description",
    price: "Prix", unit: "Unité", url: "Lien (QR)", qty: "Qté", total: "Total",
    subtotal: "Sous-total", discount: "Remise %", tax: "Taxe", notes: "Notes",
    extraInfo: "Info Suppl.", folder: "Dossier", file: "Document"
  },
  status: { draft: "Brouillon", sent: "Envoyé", approved: "Approuvé", rejected: "Rejeté" },
  empty: {
    noQuotes: "Aucun devis", noResults: "Aucun résultat", noClients: "Aucun client",
    noProducts: "Aucun produit", noTech: "Aucune offre technique", noReceipt: "Aucun bon de réception",
    noCustom: "Aucun document personnalisé", noDocuments: "Aucun document",
    noFilesInFolder: "Aucun document dans ce dossier",
    emptyProducts: "Créez un produit pour l'ajouter aux devis"
  },
  stats: { totalQuotes: "Total Devis", sent: "Envoyés", approved: "Approuvés", total: "Total", conversionRate: "Taux de Conversion", recentQuotes: "Devis Récents" },
  modal: {
    newQuote: "Nouveau Devis", editQuote: "Modifier: ", newClient: "Nouveau Client", editClient: "Modifier",
    newProduct: "Nouveau Produit", editProduct: "Modifier", newTech: "Nouvelle Offre Technique", editTech: "Modifier: ",
    newReceipt: "Nouveau Bon de Réception", editReceipt: "Modifier: ", newCustom: "Nouveau Doc Personnalisé", editCustom: "Modifier: ",
    newFolder: "Nouveau Dossier", renameFolder: "Nouveau nom du dossier:", uploadDoc: "Télécharger Document",
    shareDoc: "Partager Document", confirm: "Confirmer", confirmDelete: "Toutes les données seront remplacées. Êtes-vous sûr?",
    addColumn: "Ajouter Colonne", columnName: "Nom Colonne", isPriceCol: "Colonne prix (numérique)"
  },
  toast: {
    saved: "Enregistré", created: "Créé", updated: "Modifié", deleted: "Supprimé",
    exported: "Exporté", imported: "Importé", copied: "Copié",
    needClientName: "Entrez le nom du client", needClientName2: "Entrez d'abord le nom du client",
    needItem: "Ajoutez un article", needItem2: "Ajoutez d'abord un article", needName: "Entrez un nom",
    needProductName: "Entrez le nom du produit", needFolderName: "Entrez le nom du dossier",
    needColumnName: "Entrez le nom de la colonne", needContent: "Entrez le contenu",
    needFile: "Choisissez d'abord un fichier", fileTooBig: "Fichier trop volumineux", invalidFile: "Fichier invalide",
    columnAdded: "Colonne ajoutée", templateSelected: "Sélectionné: ", docCreated: "Créé",
    backupCreated: "Sauvegarde enregistrée", backupRestored: "Restauré",
    invalidKey: "Clé invalide", activated: "Activation réussie! Merci d'avoir acheté ProQuote.",
    logoUploaded: "Logo téléchargé", logoRemoved: "Logo supprimé",
    folderCreated: "Dossier créé", folderRenamed: "Renommé", folderDeleted: "Dossier et contenu supprimés",
    docUploaded: "Document téléchargé", docDownloaded: "Document téléchargé", docShared: "Document téléchargé et WhatsApp ouvert",
    generating: "Génération PDF...", pdfReady: "Téléchargé", genTech: "Offre technique créée à partir du devis",
    genReceipt: "Bon de réception créé", genAuth: "Procuration créée", genAll: "Trois documents générés à partir du devis"
  },
  print: {
    quotation: "QUOTATION", customer: "Client", recipient: "Destinataire / Client",
    offerInfo: "Offre", receiptInfo: "Réception", date: "Date", validity: "Validité", subject: "Sujet",
    code: "Code", item: "Article", items: "Articles", description: "Description", qty: "Qté",
    price: "Prix", total: "Total", subtotal: "Sous-total", discount: "Remise", tax: "Taxe",
    notes: "Notes", conditions: "Termes & Conditions", customerSign: "Signature Client",
    companySign: "Signature Société", recipientSign: "Destinataire", responsibleSign: "Responsable",
    signerLabel: "Signature", extraInfo: "Info Suppl.", target: "À: ",
    taxShort: "TVA", crShort: "RC",
    tech: "Offre Technique", receipt: "Bon de Réception", authorization: "Procuration"
  },
  license: {
    trial: "Version d'Essai", activated: "Activé", expired: "Expiré",
    daysLeft: "{n} jours restants", clickToActivate: "Cliquez pour activer", clickForDetails: "Cliquez pour détails",
    title: "Activation de Licence", deviceId: "ID Appareil (montrez au vendeur)",
    key: "Clé de Licence", deviceIdHint: "Envoyez l'ID appareil au vendeur pour obtenir une clé liée à votre appareil. Chaque clé fonctionne sur un seul appareil.",
    verifying: "Vérification...", enterKey: "Entrez la clé de licence",
    wrongDevice: "Cette clé est liée à un autre appareil", keyExpired: "Cette clé a expiré",
    keyInvalid: "Échec du déchiffrement — clé invalide", enterDeviceId: "Entrez l'ID appareil",
    enterDeviceIdHint: "ID appareil invalide (lettres et chiffres anglais uniquement)"
  },
  tier: { basic: "Basique", professional: "Professionnelle", enterprise: "Entreprise", trial: "Essai" },
  settings: {
    company: "Société", terms: "Termes", docs: "Documents", templates: "Modèles", general: "Général",
    language: "Langue", languageHint: "Choisissez la langue de l'interface. L'application se mettra à jour instantanément.",
    logo: "Logo Société", uploadLogo: "Cliquez pour télécharger le logo", logoHint: "PNG, JPG, SVG — 2 Mo",
    logoSize: "Taille Logo", logoAlign: "Alignement Logo", logoLayout: "Disposition Logo (ligne unique)",
    companyInfo: "Informations Société", quotationHeading: "Titre du Devis",
    headingText: "Texte", headingColor: "Couleur Police (vide = défaut du modèle)", headingSize: "Taille Police (0 = défaut)",
    termsConditions: "Termes & Conditions", showTerms: "Afficher", termsEditHint: "Modifiez titres et textes. Laissez vide pour masquer.",
    layout: "Disposition", bars: "Barres", oneCol: "Une Colonne", twoCols: "Deux Colonnes", threeCols: "Trois Colonnes",
    withBars: "Avec Barres", withoutBars: "Sans",
    numberingPrefixes: "Préfixes de Numérotation & Titres", quotePrefix: "Préfixe Devis",
    techPrefix: "Préfixe Technique", customPrefix: "Préfixe Personnalisé", receiptPrefix: "Préfixe Réception",
    authPrefix: "Préfixe Procuration", techTitle: "Titre Technique", receiptTitle: "Titre Réception",
    authTitle: "Titre Procuration", showCodeTech: "Afficher code produit dans offre technique", showQRTech: "Afficher QR dans offre technique",
    signerData: "Données Signataire par Défaut", signerName: "Nom Signataire", signerTitle: "Titre Signataire",
    receiptTemplate: "Modèle de Réception", receiptTemplateHint: "Utilisez [Nom Société] et [Nom Destinataire] pour remplacement auto.",
    receiptItemsSection: "Section Réception (avec articles)", receiptItemsHint: "Paramètres par défaut pour la section réception autonome.",
    receiptExtraTitle: "Titre Réception", authTemplate: "Modèle Procuration",
    columnsDefaults: "Paramètres Colonnes par Défaut", columnsHint: "Appliqués lors de la création de nouveaux devis ou offres techniques.",
    showCodeQuote: "Afficher code dans devis", showQRQuote: "Afficher QR dans devis",
    showCodeTechDef: "Afficher code dans offre technique", showQRTechDef: "Afficher QR dans offre technique",
    extraColsQuote: "Colonnes suppl. par défaut pour devis (séparées par virgule)", extraColsTech: "Colonnes suppl. par défaut pour offre technique",
    chooseTemplate: "Choisir Modèle", templateHint: "Chaque modèle a des séparateurs et couleurs différents.",
    fonts: "Polices", headingFont: "Police Titres", bodyFont: "Police Texte", headingSize: "Taille Titres", bodySize: "Taille Texte",
    offerSettings: "Paramètres Offre", defaultCurrency: "Devise par Défaut", taxPercent: "Taxe %",
    validityDays: "Validité (jours)", numberPrefix: "Préfixe Numéro",
    deleteAll: "Tout Supprimer", confirmDeleteAll: "Supprimer définitivement toutes les données?",
    sizeSmall: "Petit 40px", sizeMedium: "Moyen 60px", sizeLarge: "Grand 80px", sizeXLarge: "Très Grand 110px", sizeHuge: "Énorme 140px",
    right: "Droite", left: "Gauche", center: "Centre"
  },
  terms: {
    pay: "Conditions de Paiement", payBody: "Le client s'engage à payer le montant dans les 30 jours suivant l'approbation.",
    del: "Conditions de Livraison", delBody: "Livraison sous 15-20 jours ouvrables après confirmation.",
    war: "Conditions de Garantie", warBody: "Garantie d'un an à partir de la livraison contre défauts de fabrication.",
    ret: "Conditions de Retour", retBody: "Retours non acceptés après 7 jours suivant la livraison.",
    dim: "Dimensions & Spécifications", dimBody: "Dimensions approximatives dans les normes acceptées (±5%).",
    col: "Couleurs & Finitions", colBody: "La couleur finale peut différer de celle affichée à l'écran.",
    gen: "Notes Générales", genBody: "Offre valable pour la période de validité. Prix hors livraison."
  },
  templates: {
    classic: { name: "Classique", desc: "Sarcelle — séparateur ligne unique" },
    elegant: { name: "Élégant", desc: "Or — séparateur double foncé" },
    modern: { name: "Moderne", desc: "Bleu — séparateur dégradé" },
    minimal: { name: "Minimal", desc: "Noir & blanc — séparateur pointillé" },
    warm: { name: "Chaleureux", desc: "Terre — séparateur épais" },
    corporate: { name: "Corporate", desc: "Marine — séparateur triple" },
    creative: { name: "Créatif", desc: "Dégradé coloré — séparateur arc" },
    formal: { name: "Formel", desc: "Vert foncé — séparateur lignes parallèles" },
    t34: { name: "T34 Or", desc: "Or & marine — séparateur losange" }
  },
  units: { piece: "Pièce", kilo: "Kilo", meter: "Mètre", liter: "Litre", hour: "Heure", day: "Jour", month: "Mois", service: "Service" },
  documents: {
    deleteProtection: "Pour supprimer un fichier ou document, entrez le mot de passe: 0000 — avis de prudence pour protéger vos données.",
    shareHint: "Le document sera téléchargé d'abord, puis WhatsApp/Email s'ouvrira pour le joindre manuellement.",
    selectClient: "Sélectionner Client (optionnel — remplit le numéro)", withoutClient: "-- Aucun --",
    whatsappNumber: "Numéro WhatsApp (avec indicatif pays)", shareMsg: "Message Joint", msgPlaceholder: "Texte du message..."
  },
  full: {
    howToTitle: "Mode d'Emploi",
    howToBody: "Sélectionnez un devis dans la liste ci-dessous et l'offre technique, le bon de réception (avec articles), et la procuration seront générés automatiquement avec les mêmes données client et produits, tous liés par un numéro de lot commun.",
    derivedDocs: "Documents Dérivés", generateNow: "Générer les Trois Maintenant"
  },
  menu: { file: "Fichier", edit: "Édition", view: "Affichage", help: "Aide", newQuote: "Nouveau Devis (Ctrl+N)", exit: "Quitter", reload: "Recharger", fullscreen: "Plein écran", devTools: "Outils Développeur", about: "À propos de ProQuote", checkUpdates: "Vérifier Mises à Jour" },
  misc: { optional: "optionnel", none: "—", or: "ou", fillDots: ".................................", signatureLine: "..........................................." }
});
;(function(){var m=window.__I18N_MESSAGES['fr'];if(!m)return;m.nav=m.nav||{};m.page=m.page||{};m.nav.adm='Administration';m.nav.rcpt='Reçus';m.nav.emp='Employés';m.nav.ei='Facture électronique';m.nav.sub='Abonnements';m.page.adm={title:'Administration',sub:'Utilisateurs et rôles'};m.page.rcpt={title:'Reçus de caisse',sub:'Bordereaux de caisse'};m.page.emp={title:'Employés',sub:'Registre des employés'};m.page.ei={title:'Facture électronique',sub:'Factures fiscales — ETA Égypte'};m.page.sub={title:'Abonnements',sub:'Forfaits mensuels et annuels'};window.registerLang&&window.registerLang('fr',m)})();
