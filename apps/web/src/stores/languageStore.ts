import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Language = 'ar' | 'en';

export interface Translations {
  // Navigation & Common
  currency: string;
  posTerminal: string;
  adminDashboard: string;
  products: string;
  categories: string;
  inventoryStock: string;
  staffUsers: string;
  branches: string;
  reports: string;
  reportsTitle: string;
  reportsDesc: string;
  logout: string;
  searchPlaceholder: string;
  noProducts: string;
  loading: string;
  save: string;
  cancel: string;
  active: string;
  inactive: string;
  status: string;
  actions: string;
  name: string;
  email: string;
  role: string;
  branch: string;
  location: string;
  contact: string;
  addNew: string;

  // Layout
  kodaSoftAdmin: string;
  enterprisePosHeader: string;

  // Login
  loginTitle: string;
  loginSubtitle: string;
  emailPassword: string;
  quickPin: string;
  emailAddress: string;
  password: string;
  signIn: string;
  authenticating: string;
  enterPin: string;
  openTerminal: string;
  verifyingPin: string;
  poweredBy: string;
  loginFailed: string;
  invalidPin: string;

  // POS
  currentOrder: string;
  clear: string;
  cartEmpty: string;
  subtotal: string;
  vat: string;
  totalAmount: string;
  payCash: string;
  payCard: string;
  payMada: string;
  payVisa: string;
  payMastercard: string;
  payApplePay: string;
  payStcPay: string;
  payBankTransfer: string;
  orderCompleted: string;
  offlineMode: string;
  pending: string;
  endShift: string;
  openShift: string;
  confirmCloseShift: string;
  openingCashAmount: string;
  closingCashAmount: string;
  openingCashDesc: string;
  closingCashDesc: string;
  kodaSoftSoftware: string;
  cashier: string;
  offlinePending: string;
  allItems: string;
  loadingCatalog: string;
  skuPrefix: string;
  failedToProcessShift: string;
  openRegisterShift: string;
  endCloseShift: string;

  // POS: Order History & Refunds
  orderHistory: string;
  orderHistoryDesc: string;
  searchOrder: string;
  customerCol: string;
  orderDate: string;
  orderTotal: string;
  refundOrder: string;
  voidOrder: string;
  refundReason: string;
  refundReasonPlaceholder: string;
  confirmRefund: string;
  confirmVoid: string;
  confirmRefundMsg: string;
  confirmVoidMsg: string;
  refundSuccess: string;
  refundFailed: string;
  voidSuccess: string;
  voidFailed: string;
  orderFailed: string;
  insufficientStock: string;
  cannotRefund: string;
  cannotVoid: string;
  noOrdersFound: string;
  loadingOrders: string;
  statusCompleted: string;
  statusVoided: string;
  statusRefunded: string;
  statusPending: string;
  statusAll: string;
  processing: string;
  noBranchAssigned: string;
  viewDetails: string;
  invoiceDetails: string;
  discountLabel: string;
  notesLabel: string;
  paymentCol: string;
  selectCustomer: string;
  addCustomer: string;
  customerName: string;
  customerPhone: string;
  partialRefund: string;
  fullRefund: string;
  refundQuantity: string;
  itemsToRefund: string;
  soldCol: string;
  refundedCol: string;
  noItemsSelected: string;
  orderDetails: string;
  printReceipt: string;
  refundedAmount: string;
  netTotal: string;
  zatcaInvoice: string;
  invoiceUuid: string;
  invoiceHash: string;

  // Dashboard & Reports
  totalRevenue: string;
  totalOrders: string;
  itemsSold: string;
  paymentsBreakdown: string;
  revenueLast7Days: string;
  top5Products: string;
  unitsSold: string;
  avgOrderValue: string;
  fromLastWeek: string;
  cash: string;
  card: string;
  noSalesData: string;
  loadingReports: string;

  // Reports: common
  period: string;
  periodToday: string;
  periodWeek: string;
  periodMonth: string;
  periodYear: string;
  periodAll: string;
  periodCustom: string;
  fromDate: string;
  toDate: string;
  allBranches: string;
  apply: string;
  noData: string;
  revenue: string;
  ordersCount: string;
  refresh: string;

  // Reports: export
  export: string;
  exportReports: string;
  exportAll: string;
  exportSelected: string;
  exportSeparateFiles: string;
  exportCombinedFile: string;
  selectReportsToExport: string;
  exportFormat: string;
  exportLayout: string;
  exporting: string;
  exportDone: string;
  exportFailed: string;
  exportedOn: string;
  exportPrint: string;
  nameCol: string;
  dateCol: string;
  statusCol: string;
  breakdown: string;
  series: string;

  // Reports: sales
  reportSales: string;
  reportSalesDesc: string;
  groupBy: string;
  groupNone: string;
  groupBranch: string;
  groupCashier: string;
  groupCustomer: string;
  groupProduct: string;
  groupCategory: string;
  groupPayment: string;
  revenueOverPeriod: string;
  walkInCustomer: string;

  // Reports: VAT
  reportVat: string;
  reportVatDesc: string;
  vatBeforeTax: string;
  vatCollected: string;
  vatAfterTax: string;
  vatDiscounts: string;
  vatOnDiscounts: string;
  vatReturns: string;
  vatReturnsSubtotal: string;
  vatReturnsTax: string;
  vatNetDue: string;
  vatEffectiveRate: string;

  // Reports: invoices
  reportInvoices: string;
  reportInvoicesDesc: string;
  invoicesTotal: string;
  invoicesTax: string;
  invoicesSimplified: string;
  invoicesCancelled: string;
  invoicesReturned: string;
  invoicesIncomplete: string;
  invoicesSuspended: string;
  invoicesCompleted: string;
  invoicesValue: string;
  invoicesTaxValue: string;

  // Reports: payments
  reportPayments: string;
  reportPaymentsDesc: string;
  payMethod: string;
  payCount: string;
  payAmount: string;
  payShare: string;
  payGrandTotal: string;

  // Reports: inventory
  reportInventory: string;
  reportInventoryDesc: string;
  invCurrentStock: string;
  invLowStock: string;
  invExpired: string;
  invMovements: string;
  invWastage: string;
  invTotalUnits: string;
  invTotalValue: string;
  invExpiryDate: string;
  invQuantity: string;
  invThreshold: string;
  invProduct: string;
  invNoExpired: string;
  invNoLow: string;
  mvSale: string;
  mvPurchase: string;
  mvAdjustment: string;
  mvWastage: string;
  mvReturn: string;
  mvOther: string;

  // Reports: shifts
  reportShifts: string;
  reportShiftsDesc: string;
  shiftOpenedAt: string;
  shiftClosedAt: string;
  shiftCashier: string;
  shiftBranch: string;
  shiftOpeningCash: string;
  shiftClosingCash: string;
  shiftExpectedCash: string;
  shiftDifference: string;
  shiftCashSales: string;
  shiftCardSales: string;
  shiftTotalSales: string;
  shiftReturns: string;
  shiftExpenses: string;
  shiftWithdrawals: string;
  shiftOrders: string;
  shiftOpen: string;
  shiftClosed: string;
  noShifts: string;

  // Products Management
  productsManagement: string;
  productsDesc: string;
  addNewProduct: string;
  importProducts: string;
  exportProducts: string;
  importCreated: string;
  importUpdated: string;
  importSkipped: string;
  importFailed: string;
  filterProducts: string;
  productName: string;
  categoryCol: string;
  sku: string;
  skuBarcode: string;
  price: string;
  cost: string;
  noProductsFoundCreate: string;
  uncategorized: string;
  editProduct: string;
  createProduct: string;
  productNameEn: string;
  productNameAr: string;
  typeCol: string;
  retail: string;
  fnb: string;
  barcode: string;
  priceLabel: string;
  costLabel: string;
  saveProduct: string;
  saving: string;
  deactivateProductConfirm: string;
  failedSaveProduct: string;
  selectCategory: string;
  productNamePlaceholder: string;
  productNameArPlaceholder: string;
  skuPlaceholder: string;
  barcodePlaceholder: string;
  pricePlaceholder: string;
  costPlaceholder: string;

  // Categories Management
  categoriesManagement: string;
  categoriesDesc: string;
  addCategory: string;
  sort: string;
  categoryName: string;
  slug: string;
  loadingCategories: string;
  noCategories: string;
  editCategory: string;
  createCategory: string;
  categoryNameEn: string;
  categoryNameAr: string;
  sortOrder: string;
  saveCategory: string;
  deactivateCategoryConfirm: string;
  failedSaveCategory: string;
  categoryNamePlaceholder: string;
  categoryNameArPlaceholder: string;

  // Inventory
  inventoryTitle: string;
  inventoryDesc: string;
  stockQuantity: string;
  alertThreshold: string;
  stockStatus: string;
  loadingInventory: string;
  noInventory: string;
  lowStock: string;
  inStock: string;
  adjustStock: string;
  selectProduct: string;
  selectBranch: string;
  adjustmentType: string;
  increaseStock: string;
  decreaseStock: string;
  adjustmentQuantity: string;
  adjustmentReason: string;
  adjustmentReasonPlaceholder: string;
  confirmAdjust: string;
  adjustSuccess: string;
  adjustFailed: string;
  adjustmentHistory: string;
  adjustmentHistoryDesc: string;
  adjustedQuantity: string;
  adjustedBy: string;
  noAdjustments: string;
  currentStock: string;

  // Users Management
  usersTitle: string;
  usersDesc: string;
  addUser: string;
  loadingUsers: string;
  editUser: string;
  createUser: string;
  fullName: string;
  loginPin: string;
  newPasswordOptional: string;
  newPinOptional: string;
  saveUser: string;
  failedSaveUser: string;
  cashierRole: string;
  managerRole: string;
  ownerRole: string;
  deleteUser: string;
  confirmDeleteUser: string;
  confirmDeleteUserMsg: string;
  deleteUserSuccess: string;
  deleteUserFailed: string;

  // Customers Management
  customers: string;
  customersTitle: string;
  customersDesc: string;
  editCustomer: string;
  createCustomer: string;
  customerEmail: string;
  customerAddress: string;
  customerNotes: string;
  searchCustomers: string;
  loadingCustomers: string;
  noCustomers: string;
  saveCustomer: string;
  deleteCustomer: string;
  confirmDeleteCustomer: string;
  confirmDeleteCustomerMsg: string;
  deleteCustomerSuccess: string;
  deleteCustomerFailed: string;
  failedSaveCustomer: string;

  // Branches Management
  branchesTitle: string;
  branchesDesc: string;
  addBranch: string;
  loadingBranches: string;
  locationLabel: string;
  contactLabel: string;
  staff: string;
  orders: string;
  editBranch: string;
  newBranch: string;
  branchName: string;
  addressLocation: string;
  failedSaveBranch: string;
  deleteBranch: string;
  confirmDeleteBranch: string;
  confirmDeleteBranchMsg: string;
  deleteBranchSuccess: string;
  deleteBranchFailed: string;

  // Receipt
  enterprisePos: string;
  taxRegistration: string;
  orderNumber: string;
  date: string;
  cashierLabel: string;
  itemCol: string;
  qtyCol: string;
  totalCol: string;
  subtotalCol: string;
  vatCol: string;
  totalColValue: string;
  paidBy: string;
  change: string;
  keepReceipt: string;
  thankYou: string;
  eachUnit: string;

  // Registration / Onboarding
  registerTitle: string;
  registerSubtitle: string;
  storeNameLabel: string;
  storeNamePlaceholder: string;
  ownerNameLabel: string;
  ownerNamePlaceholder: string;
  phoneLabel: string;
  branchNameLabel: string;
  branchNamePlaceholder: string;
  createAccount: string;
  creatingAccount: string;
  haveAccount: string;
  signInNow: string;
  passwordMinHint: string;
  newHere: string;
  startFreeTrial: string;

  // SaaS Operator Console
  saasConsole: string;
  saasOverview: string;
  saasTenants: string;
  saasLogout: string;
  saasTotalTenants: string;
  saasActiveTenants: string;
  saasSuspendedTenants: string;
  saasTotalUsers: string;
  saasTotalOrders: string;
  saasTotalRevenue: string;
  saasTodayOrders: string;
  saasTodayRevenue: string;
  saasMRR: string;
  saasPerMonth: string;
  saasSubscriptions: string;
  saasTenant: string;
  saasPlan: string;
  saasStatus: string;
  saasCreated: string;
  saasUsers: string;
  saasBranches: string;
  saasOrdersCount: string;
  saasRevenue: string;
  saasActions: string;
  saasActivate: string;
  saasSuspend: string;
  saasUpgrade: string;
  saasDowngrade: string;
  saasDetail: string;
  saasBack: string;
  saasRecentOrders: string;
  saasNoTenants: string;
  saasLoading: string;
  saasUpdated: string;
  saasUpdateFailed: string;
  saasStarter: string;
  saasPro: string;
  saasEnterprise: string;
  saasTrial: string;
  saasActiveSub: string;
  saasPastDue: string;
  saasCancelled: string;
  saasMemberSince: string;

  // Settings / Plan & Billing
  settingsTitle: string;
  settingsDesc: string;
  storeInformation: string;
  storeInfoDesc: string;
  storeNameField: string;
  vatNumberField: string;
  receiptFooterField: string;
  saveSettings: string;
  settingsSaved: string;
  settingsSaveFailed: string;
  planBilling: string;
  planBillingDesc: string;
  currentPlanLabel: string;
  trialEndsOn: string;
  renewsOn: string;
  usageLabel: string;
  usersUsage: string;
  branchesUsage: string;
  productsUsage: string;
  unlimited: string;
  featuresLabel: string;
  choosePlanDesc: string;
  planChangeSuccess: string;
  planChangeFailed: string;
  confirmPlanChange: string;
  planLoading: string;
  changePlan: string;
  currentPlanBadge: string;
  paywallTitle: string;
  paywallDesc: string;
  paywallPastDue: string;
  paywallTrialEnded: string;
  paywallGoBilling: string;
  paywallLogout: string;
  signupPlanTitle: string;
  signupPlanDesc: string;
  signupTrialNote: string;
  renewTitle: string;
  renewDesc: string;
  renewNow: string;
  renewing: string;
  renewSuccess: string;
  renewFailed: string;
}

export function translate(
  template: string,
  params: Record<string, string | number> = {}
): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => String(params[key] ?? ''));
}

const translations: Record<Language, Translations> = {
  ar: {
    // Navigation & Common
    posTerminal: 'نقطة البيع (POS)',
    currency: 'ر.س',
    adminDashboard: 'لوحة التحكم',
    products: 'المنتجات',
    categories: 'التصنيفات',
    inventoryStock: 'المخزون والكميات',
    staffUsers: 'الموظفين والمستخدمين',
    branches: 'الفروع',
    reports: 'التقارير والتحليلات',
    reportsTitle: 'التقارير والتحليلات',
    reportsDesc: 'تتبع الإيرادات والطلبات وأفضل المنتجات مبيعاً',
    logout: 'تسجيل الخروج',
    searchPlaceholder: 'ابحث عن منتج بالاسم، SKU، أو امسح البارشود...',
    noProducts: 'لا توجد منتجات مطابقة',
    loading: 'جاري التحميل...',
    save: 'حفظ',
    cancel: 'إلغاء',
    active: 'نشط',
    inactive: 'غير نشط',
    status: 'الحالة',
    actions: 'الإجراءات',
    name: 'الاسم',
    email: 'البريد الإلكتروني',
    role: 'الصلاحية',
    branch: 'الفرع',
    location: 'الموقع / العنوان',
    contact: 'رقم التواصل',
    addNew: 'إضافة جديد',

    // Layout
    kodaSoftAdmin: 'إدارة كوداسوفت',
    enterprisePosHeader: 'نقاط البيع المؤسسي كوداسوفت',

    // Login
    loginTitle: 'نظام KodaSoft-POS لنقاط البيع',
    loginSubtitle: 'حلول نقاط البيع للمؤسسات',
    emailPassword: 'البريد الإلكتروني وكلمة المرور',
    quickPin: 'دخول سريع بالرقم السري',
    emailAddress: 'البريد الإلكتروني',
    password: 'كلمة المرور',
    signIn: 'تسجيل الدخول',
    authenticating: 'جاري التحقق...',
    enterPin: 'أدخل الرقم السري المكون من 4 أرقام',
    openTerminal: 'فتح شاشة البيع',
    verifyingPin: 'جاري التحقق من الرقم السري...',
    poweredBy: 'مدعوم من حلول كوداسوفت البرمجية',
    loginFailed: 'فشل تسجيل الدخول. يرجى التحقق من البيانات.',
    invalidPin: 'الرقم السري غير صحيح.',

    // POS
    currentOrder: 'الطلب الحالي',
    clear: 'مسح السلة',
    cartEmpty: 'السلة فارغة حالياً',
    subtotal: 'المجموع الفرعي',
    vat: 'ضريبة القيمة المضافة (15%)',
    totalAmount: 'الإجمالي النهائي',
    payCash: 'دفع نقدي (كاش)',
    payCard: 'دفع بالبطاقة (شبكة)',
    payMada: 'مدى',
    payVisa: 'فيزا',
    payMastercard: 'ماستركارد',
    payApplePay: 'أبل باي',
    payStcPay: 'إس تي سي باي',
    payBankTransfer: 'تحويل بنكي',
    orderCompleted: 'تم إكمال الطلب بنجاح!',
    offlineMode: 'وضع العمل دون إنترنت',
    pending: 'معلق',
    endShift: 'إغلاق الوردية',
    openShift: 'فتح وردية جديدة',
    confirmCloseShift: 'تأكيد إغلاق الوردية',
    openingCashAmount: 'مبلغ الصندوق الأولي (العهدة)',
    closingCashAmount: 'المبلغ الفعلي في الصندوق عند الإغلاق',
    openingCashDesc: 'يرجى إدخال مبلغ السيولة الأولي في الصندوق لبدء عمليات البيع.',
    closingCashDesc: 'يرجى أدخال المبلغ النردي الفعلي الموجود في الصندوق لحساب العهدة.',
    kodaSoftSoftware: 'برمجيات كوداسوفت',
    cashier: 'الكاشير',
    offlinePending: 'وضع العمل دون إنترنت ({count} في الانتظار)',
    allItems: 'كل المنتجات',
    loadingCatalog: 'جاري تحميل قائمة المنتجات...',
    skuPrefix: 'الرمز:',
    failedToProcessShift: 'فشل معالجة الوردية',
    openRegisterShift: 'فتح وردية جديدة',
    endCloseShift: 'إغلاق الوردية',

    // POS: Order History & Refunds
    orderHistory: 'سجل الطلبات والمرتجعات',
    orderHistoryDesc: 'عرض الطلبات السابقة وإرجاعها أو إلغاؤها',
    searchOrder: 'ابحث برقم الطلب أو اسم العميل...',
    customerCol: 'العميل',
    orderDate: 'تاريخ الطلب',
    orderTotal: 'إجمالي الطلب',
    refundOrder: 'إرجاع الفاتورة',
    voidOrder: 'إلغاء الطلب',
    refundReason: 'سبب الإرجاع',
    refundReasonPlaceholder: 'اكتب سبب الإرجاع (اختياري)',
    confirmRefund: 'تأكيد الإرجاع',
    confirmVoid: 'تأكيد الإلغاء',
    confirmRefundMsg: 'هل أنت متأكد من إرجاع هذا الطلب؟ سيتم إضافة الكميات إلى المخزون وإلغاء الدفعات.',
    confirmVoidMsg: 'هل أنت متأكد من إلغاء هذا الطلب؟ سيتم إضافة الكميات إلى المخزون.',
    refundSuccess: 'تم إرجاع الطلب بنجاح',
    refundFailed: 'فشل إرجاع الطلب',
    voidSuccess: 'تم إلغاء الطلب بنجاح',
    voidFailed: 'فشل إلغاء الطلب',
    orderFailed: 'فشل إكمال الطلب',
    insufficientStock: 'المخزون غير كافٍ لإكمال الطلب',
    cannotRefund: 'لا يمكن إرجاع هذا الطلب',
    cannotVoid: 'لا يمكن إلغاء هذا الطلب',
    noOrdersFound: 'لا توجد طلبات مطابقة',
    loadingOrders: 'جاري تحميل الطلبات...',
    statusCompleted: 'مكتمل',
    statusVoided: 'ملغي',
    statusRefunded: 'مرتجع',
    statusPending: 'معلق',
    statusAll: 'الكل',
    processing: 'جاري المعالجة...',
    noBranchAssigned: 'لم يتم تحديد فرع لهذا المستخدم',
    viewDetails: 'تفاصيل الفاتورة',
    invoiceDetails: 'تفاصيل الفاتورة',
    discountLabel: 'الخصم',
    notesLabel: 'الملاحظات',
    paymentCol: 'الدفع',
    selectCustomer: 'تحديد العميل',
    addCustomer: 'إضافة عميل جديد',
    customerName: 'اسم العميل',
    customerPhone: 'رقم الجوال',
    partialRefund: 'إرجاع جزئي',
    fullRefund: 'إرجاع كامل',
    refundQuantity: 'الكمية المراد إرجاعها',
    itemsToRefund: 'الأصناف المراد إرجاعها',
    soldCol: 'المباع',
    refundedCol: 'المرتجع',
    noItemsSelected: 'يرجى تحديد كمية صنف واحد على الأقل للإرجاع',
    orderDetails: 'تفاصيل الفاتورة',
    printReceipt: 'طباعة الإيصال',
    refundedAmount: 'المبلغ المرتجع',
    netTotal: 'الصافي',
    zatcaInvoice: 'فاتورة إلكترونية',
    invoiceUuid: 'معرّف الفاتورة',
    invoiceHash: 'تجزئة الفاتورة',

    // Dashboard & Reports
    totalRevenue: 'إجمالي المبيعات',
    totalOrders: 'إجمالي الطلبات',
    itemsSold: 'القطع المباعة',
    paymentsBreakdown: 'تفصيل طرق الدفع',
    revenueLast7Days: 'المبيعات (آخر 7 أيام)',
    top5Products: 'أفضل 5 منتجات مبيعاً',
    unitsSold: 'قطعة مباعة',
    avgOrderValue: 'متوسط قيمة الطلب:',
    fromLastWeek: '+12% عن الأسبوع الماضي',
    cash: 'نقدي',
    card: 'بطاقة',
    noSalesData: 'لا توجد بيانات مبيعات بعد.',
    loadingReports: 'جاري تحميل بيانات التقارير...',

    // Reports: common
    period: 'الفترة',
    periodToday: 'اليوم',
    periodWeek: 'الأسبوع',
    periodMonth: 'الشهر',
    periodYear: 'السنة',
    periodAll: 'كل الفترات',
    periodCustom: 'فترة مخصصة',
    fromDate: 'من تاريخ',
    toDate: 'إلى تاريخ',
    allBranches: 'كل الفروع',
    apply: 'تطبيق',
    noData: 'لا توجد بيانات',
    revenue: 'الإيرادات',
    ordersCount: 'الطلبات',
    refresh: 'تحديث',

    // Reports: export
    export: 'تصدير',
    exportReports: 'تصدير التقارير',
    exportAll: 'تصدير الكل',
    exportSelected: 'تصدير المحدد',
    exportSeparateFiles: 'ملفات منفصلة (كل تقرير في ملف)',
    exportCombinedFile: 'ملف واحد مجمّع',
    selectReportsToExport: 'اختر التقارير التي تريد تصديرها',
    exportFormat: 'صيغة التصدير',
    exportLayout: 'تخطيط التصدير',
    exporting: 'جارٍ التصدير...',
    exportDone: 'تم تصدير التقارير بنجاح',
    exportFailed: 'فشل التصدير، حاول مرة أخرى',
    exportedOn: 'تم الإنشاء في',
    exportPrint: 'طباعة / PDF',
    nameCol: 'الاسم',
    dateCol: 'التاريخ',
    statusCol: 'الحالة',
    breakdown: 'التفصيل',
    series: 'السلسلة الزمنية',

    // Reports: sales
    reportSales: 'تقرير المبيعات',
    reportSalesDesc: 'متابعة الإيرادات والطلبات والمنتجات المباعة وتقسيمها حسب الفرع أو الكاشير أو العميل أو المنتج.',
    groupBy: 'تقسيم حسب',
    groupNone: 'بدون تقسيم',
    groupBranch: 'حسب الفرع',
    groupCashier: 'حسب الكاشير',
    groupCustomer: 'حسب العميل',
    groupProduct: 'حسب المنتج',
    groupCategory: 'حسب التصنيف',
    groupPayment: 'حسب طريقة الدفع',
    revenueOverPeriod: 'الإيرادات خلال الفترة',
    walkInCustomer: 'عميل (مباشر)',

    // Reports: VAT
    reportVat: 'تقرير الضريبة (VAT)',
    reportVatDesc: 'احسب ضريبة القيمة المضافة المستحقة على المبيعات والخصومات والمرتجعات خلال الفترة.',
    vatBeforeTax: 'إجمالي المبيعات قبل الضريبة',
    vatCollected: 'إجمالي الضريبة',
    vatAfterTax: 'إجمالي المبيعات بعد الضريبة',
    vatDiscounts: 'الخصومات',
    vatOnDiscounts: 'الضريبة على الخصومات',
    vatReturns: 'المرتجعات',
    vatReturnsSubtotal: 'قيمة المرتجعات (قبل الضريبة)',
    vatReturnsTax: 'ضريبة المرتجعات',
    vatNetDue: 'صافي الضريبة المستحقة',
    vatEffectiveRate: 'نسبة الضريبة الفعلية',

    // Reports: invoices
    reportInvoices: 'تقرير الفواتير',
    reportInvoicesDesc: 'استعراض عدد وقيمة الفواتير الضريبية والمبسطة والملغاة والمرتجعة وغيرها.',
    invoicesTotal: 'عدد الفواتير',
    invoicesTax: 'فواتير ضريبية',
    invoicesSimplified: 'فواتير مبسطة',
    invoicesCancelled: 'فواتير ملغاة',
    invoicesReturned: 'فواتير مرتجعة',
    invoicesIncomplete: 'فواتير غير مكتملة',
    invoicesSuspended: 'فواتير معلقة',
    invoicesCompleted: 'فواتير مكتملة',
    invoicesValue: 'قيمة الفواتير',
    invoicesTaxValue: 'قيمة الضريبة',

    // Reports: payments
    reportPayments: 'تقرير طرق الدفع',
    reportPaymentsDesc: 'توزيع المبيعات حسب طريقة الدفع مع عدد العمليات ونسبة كل طريقة.',
    payMethod: 'طريقة الدفع',
    payCount: 'عدد العمليات',
    payAmount: 'إجمالي المبلغ',
    payShare: 'النسبة',
    payGrandTotal: 'الإجمالي الكلي',

    // Reports: inventory
    reportInventory: 'تقرير المخزون',
    reportInventoryDesc: 'متابعة الكميات الحالية والمنخفضة والمنتهية الصلاحية وحركة المخزون.',
    invCurrentStock: 'المخزون الحالي',
    invLowStock: 'منتجات منخفضة المخزون',
    invExpired: 'منتجات منتهية الصلاحية',
    invMovements: 'حركة المخزون',
    invWastage: 'الهالك',
    invTotalUnits: 'إجمالي الوحدات',
    invTotalValue: 'قيمة المخزون',
    invExpiryDate: 'تاريخ الانتهاء',
    invQuantity: 'الكمية',
    invThreshold: 'حد التنبيه',
    invProduct: 'المنتج',
    invNoExpired: 'لا توجد منتجات منتهية الصلاحية',
    invNoLow: 'لا توجد منتجات منخفضة المخزون',
    mvSale: 'مبيعات',
    mvPurchase: 'مشتريات / توريد',
    mvAdjustment: 'تسوية / جرد',
    mvWastage: 'هالك',
    mvReturn: 'مرتجعات',
    mvOther: 'أخرى',

    // Reports: shifts
    reportShifts: 'تقرير الورديات',
    reportShiftsDesc: 'تفاصيل كل وردية: المبيعات النقدية وشبكة، المصروفات، والسحوبات وفرق العهدة.',
    shiftOpenedAt: 'وقت الفتح',
    shiftClosedAt: 'وقت الإغلاق',
    shiftCashier: 'الكاشير',
    shiftBranch: 'الفرع',
    shiftOpeningCash: 'النقد عند البداية',
    shiftClosingCash: 'النقد عند النهاية',
    shiftExpectedCash: 'النقد المتوقع',
    shiftDifference: 'الفرق',
    shiftCashSales: 'المبيعات النقدية',
    shiftCardSales: 'مبيعات الشبكة',
    shiftTotalSales: 'إجمالي المبيعات',
    shiftReturns: 'المرتجعات',
    shiftExpenses: 'المصروفات',
    shiftWithdrawals: 'السحوبات',
    shiftOrders: 'الطلبات',
    shiftOpen: 'مفتوحة',
    shiftClosed: 'مغلقة',
    noShifts: 'لا توجد ورديات في هذه الفترة',

    // Products Management
    productsManagement: 'إدارة المنتجات',
    productsDesc: 'إنشاء وتحديث وإدارة عناصر الكتالوج',
    addNewProduct: 'إضافة منتج جديد',
    importProducts: 'استيراد المنتجات',
    exportProducts: 'تصدير المنتجات',
    importCreated: 'تم الإنشاء',
    importUpdated: 'تم التحديث',
    importSkipped: 'تم التخطي',
    importFailed: 'فشل الاستيراد',
    filterProducts: 'تصفية حسب اسم المنتج، الرمز، أو الباركود...',
    productName: 'اسم المنتج',
    categoryCol: 'التصنيف',
    sku: 'الرمز',
    skuBarcode: 'الرمز / الباركود',
    price: 'السعر',
    cost: 'التكلفة',
    noProductsFoundCreate: 'لا توجد منتجات. اضغط "إضافة منتج جديد" للإنشاء.',
    uncategorized: 'بدون تصنيف',
    editProduct: 'تعديل المنتج',
    createProduct: 'إنشاء منتج جديد',
    productNameEn: 'اسم المنتج (إنجليزي)',
    productNameAr: 'اسم المنتج (عربي)',
    typeCol: 'النوع',
    retail: 'تجزئة',
    fnb: 'أغذية ومشروبات (F&B)',
    barcode: 'الباركود',
    priceLabel: 'السعر ($)',
    costLabel: 'التكلفة ($)',
    saveProduct: 'حفظ المنتج',
    saving: 'جاري الحفظ...',
    deactivateProductConfirm: 'هل أنت متأكد من إلغاء تفعيل هذا المنتج؟',
    failedSaveProduct: 'فشل حفظ المنتج',
    selectCategory: '-- اختر التصنيف --',
    productNamePlaceholder: 'مثال: لاتيه',
    productNameArPlaceholder: 'مثال: لاتيه',
    skuPlaceholder: 'BEV-003',
    barcodePlaceholder: '600000000004',
    pricePlaceholder: '5.00',
    costPlaceholder: '1.50',

    // Categories Management
    categoriesManagement: 'إدارة التصنيفات',
    categoriesDesc: 'تنظيم المنتجات في تصنيفات القائمة',
    addCategory: 'إضافة تصنيف',
    sort: 'الترتيب',
    categoryName: 'اسم التصنيف',
    slug: 'الرابط المختصر',
    loadingCategories: 'جاري تحميل التصنيفات...',
    noCategories: 'لا توجد تصنيفات.',
    editCategory: 'تعديل التصنيف',
    createCategory: 'إنشاء تصنيف',
    categoryNameEn: 'اسم التصنيف (إنجليزي)',
    categoryNameAr: 'اسم التصنيف (عربي)',
    sortOrder: 'ترتيب العرض',
    saveCategory: 'حفظ التصنيف',
    deactivateCategoryConfirm: 'هل أنت متأكد من إلغاء تفعيل هذا التصنيف؟',
    failedSaveCategory: 'فشل حفظ التصنيف',
    categoryNamePlaceholder: 'مثال: حلويات',
    categoryNameArPlaceholder: 'مثال: حلويات',

    // Inventory
    inventoryTitle: 'المخزون ومستويات الكميات',
    inventoryDesc: 'متابعة كميات المخزون والتنبيهات عند انخفاضه',
    stockQuantity: 'الكمية المتوفرة',
    alertThreshold: 'حد التنبيه',
    stockStatus: 'حالة المخزون',
    loadingInventory: 'جاري تحميل بيانات المخزون...',
    noInventory: 'لا توجد سجلات مخزون.',
    lowStock: 'مخزون منخفض',
    inStock: 'متوفر',
    adjustStock: 'تسوية المخزون',
    selectProduct: 'اختر المنتج',
    selectBranch: 'اختر الفرع',
    adjustmentType: 'نوع التسوية',
    increaseStock: 'زيادة',
    decreaseStock: 'نقصان',
    adjustmentQuantity: 'الكمية',
    adjustmentReason: 'السبب / ملاحظة (اختياري)',
    adjustmentReasonPlaceholder: 'مثال: جرد شهر نهاية الفترة',
    confirmAdjust: 'تأكيد التسوية',
    adjustSuccess: 'تم تسوية المخزون بنجاح',
    adjustFailed: 'فشلت تسوية المخزون',
    adjustmentHistory: 'سجل تسويات المخزون',
    adjustmentHistoryDesc: 'آخر عمليات تسوية وتعديل الكميات',
    adjustedQuantity: 'الكمية المسجلة',
    adjustedBy: 'بواسطة',
    noAdjustments: 'لا توجد تسويات بعد',
    currentStock: 'الكمية الحالية',

    // Users Management
    usersTitle: 'إدارة الموظفين والمستخدمين',
    usersDesc: 'إدارة الكاشير والمديرين وصلاحيات الوصول للنظام',
    addUser: 'إضافة مستخدم',
    loadingUsers: 'جاري تحميل المستخدمين...',
    editUser: 'تعديل المستخدم',
    createUser: 'إنشاء مستخدم جديد',
    fullName: 'الاسم الكامل',
    loginPin: 'الرقم السري للدخول (4 أرقام)',
    newPasswordOptional: 'كلمة مرور جديدة (اختياري)',
    newPinOptional: 'رقم سري جديد (اختياري، 4 أرقام)',
    saveUser: 'حفظ المستخدم',
    failedSaveUser: 'فشل حفظ المستخدم',
    cashierRole: 'كاشير',
    managerRole: 'مدير',
    ownerRole: 'مالك',
    deleteUser: 'حذف المستخدم',
    confirmDeleteUser: 'تأكيد حذف المستخدم',
    confirmDeleteUserMsg: 'هل أنت متأكد من حذف المستخدم "{name}"؟ لا يمكن التراجع عن هذا الإجراء.',
    deleteUserSuccess: 'تم حذف المستخدم بنجاح',
    deleteUserFailed: 'فشل حذف المستخدم، لديه سجل عمليات أو حدث خطأ',

    // Customers Management
    customers: 'العملاء',
    customersTitle: 'إدارة العملاء',
    customersDesc: 'إنشاء وتحديث وإدارة بيانات العملاء',
    editCustomer: 'تعديل العميل',
    createCustomer: 'إنشاء عميل جديد',
    customerEmail: 'البريد الإلكتروني',
    customerAddress: 'العنوان',
    customerNotes: 'ملاحظات',
    searchCustomers: 'ابحث بالاسم، الجوال، أو البريد...',
    loadingCustomers: 'جاري تحميل العملاء...',
    noCustomers: 'لا يوجد عملاء بعد. اضغط "إضافة عميل" للإنشاء.',
    saveCustomer: 'حفظ العميل',
    deleteCustomer: 'حذف العميل',
    confirmDeleteCustomer: 'تأكيد حذف العميل',
    confirmDeleteCustomerMsg: 'هل أنت متأكد من حذف العميل "{name}"؟ لا يمكن التراجع عن هذا الإجراء.',
    deleteCustomerSuccess: 'تم حذف العميل بنجاح',
    deleteCustomerFailed: 'فشل حذف العميل، لديه طلبات أو حدث خطأ',
    failedSaveCustomer: 'فشل حفظ العميل',

    // Branches Management
    branchesTitle: 'إعدادات الفروع',
    branchesDesc: 'إدارة مواقع المتاجر والموارد المخصصة',
    addBranch: 'إضافة فرع',
    loadingBranches: 'جاري تحميل الفروع...',
    locationLabel: 'الموقع:',
    contactLabel: 'رقم التواصل:',
    staff: 'موظف',
    orders: 'طلب',
    editBranch: 'تعديل الفرع',
    newBranch: 'فرع جديد',
    branchName: 'اسم الفرع',
    addressLocation: 'العنوان / الموقع',
    failedSaveBranch: 'فشل حفظ الفرع',
    deleteBranch: 'حذف الفرع',
    confirmDeleteBranch: 'تأكيد حذف الفرع',
    confirmDeleteBranchMsg: 'هل أنت متأكد من حذف الفرع "{name}"؟ لا يمكن التراجع عن هذا الإجراء.',
    deleteBranchSuccess: 'تم حذف الفرع بنجاح',
    deleteBranchFailed: 'فشل حذف الفرع، الفرع مستخدم أو حدث خطأ',

    // Receipt
    enterprisePos: 'نقاط البيع المؤسسي',
    taxRegistration: 'الرقم الضريبي:',
    orderNumber: 'رقم الطلب:',
    date: 'التاريخ:',
    cashierLabel: 'الكاشير:',
    itemCol: 'الصنف',
    qtyCol: 'الكمية',
    totalCol: 'الإجمالي',
    subtotalCol: 'المجموع الفرعي:',
    vatCol: 'ضريبة القيمة المضافة (15%):',
    totalColValue: 'الإجمالي:',
    paidBy: 'مدفوع بواسطة {method}:',
    change: 'الباقي:',
    keepReceipt: 'يرجى الاحتفاظ بهذا الإيصال للسجلات.',
    thankYou: 'شكراً لزيارتكم!',
    eachUnit: 'للقطعة',

    // Registration / Onboarding
    registerTitle: 'ابدأ متجرك خلال دقيقة',
    registerSubtitle: 'أنشئ حسابك وابدأ البيع فوراً — نسخة تجريبية مجانية 14 يوماً',
    storeNameLabel: 'اسم المتجر',
    storeNamePlaceholder: 'مثال: متجر العائلة',
    ownerNameLabel: 'اسم المالك',
    ownerNamePlaceholder: 'الاسم الكامل',
    phoneLabel: 'رقم الجوال (اختياري)',
    branchNameLabel: 'اسم الفرع (اختياري)',
    branchNamePlaceholder: 'الفرع الرئيسي',
    createAccount: 'إنشاء الحساب وبدء البيع',
    creatingAccount: 'جاري إنشاء حسابك...',
    haveAccount: 'لديك حساب بالفعل؟',
    signInNow: 'سجّل الدخول',
    passwordMinHint: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل',
    newHere: 'جديد على KodaSoft-POS؟',
    startFreeTrial: 'أنشئ متجرك مجاناً',

    // SaaS Operator Console
    saasConsole: 'لوحة تحكم المنصة (SaaS)',
    saasOverview: 'نظرة عامة',
    saasTenants: 'المتاجر',
    saasLogout: 'تسجيل الخروج',
    saasTotalTenants: 'إجمالي المتاجر',
    saasActiveTenants: 'متاجر نشطة',
    saasSuspendedTenants: 'متاجر معلّقة',
    saasTotalUsers: 'إجمالي المستخدمين',
    saasTotalOrders: 'إجمالي الطلبات',
    saasTotalRevenue: 'إجمالي الإيرادات',
    saasTodayOrders: 'طلبات اليوم',
    saasTodayRevenue: 'إيرادات اليوم',
    saasMRR: 'الإيراد الشهري المتكرر (MRR)',
    saasPerMonth: 'شهرياً',
    saasSubscriptions: 'الاشتراكات',
    saasTenant: 'المتجر',
    saasPlan: 'الباقة',
    saasStatus: 'الحالة',
    saasCreated: 'تاريخ الإنشاء',
    saasUsers: 'المستخدمون',
    saasBranches: 'الفروع',
    saasOrdersCount: 'الطلبات',
    saasRevenue: 'الإيرادات',
    saasActions: 'إجراءات',
    saasActivate: 'تفعيل',
    saasSuspend: 'تعليق',
    saasUpgrade: 'ترقية الباقة',
    saasDowngrade: 'خفض الباقة',
    saasDetail: 'تفاصيل',
    saasBack: 'رجوع',
    saasRecentOrders: 'أحدث الطلبات',
    saasNoTenants: 'لا توجد متاجر مسجلة بعد',
    saasLoading: 'جاري التحميل...',
    saasUpdated: 'تم تحديث المتجر بنجاح',
    saasUpdateFailed: 'فشل تحديث المتجر',
    saasStarter: 'مبتدئة',
    saasPro: 'احترافية',
    saasEnterprise: 'مؤسسات',
    saasTrial: 'تجريبية',
    saasActiveSub: 'نشط',
    saasPastDue: 'متأخر السداد',
    saasCancelled: 'ملغى',
    saasMemberSince: 'عميل منذ',

    // Settings / Plan & Billing
    settingsTitle: 'الإعدادات',
    settingsDesc: 'إعدادات المتجر والباقة والاشتراك',
    storeInformation: 'معلومات المتجر',
    storeInfoDesc: 'تظهر هذه البيانات على الإيصالات والفواتير الضريبية',
    storeNameField: 'اسم المتجر',
    vatNumberField: 'الرقم الضريبي',
    receiptFooterField: 'نص نهاية الإيصال',
    saveSettings: 'حفظ الإعدادات',
    settingsSaved: 'تم حفظ الإعدادات بنجاح',
    settingsSaveFailed: 'فشل حفظ الإعدادات',
    planBilling: 'الباقة والفواتير',
    planBillingDesc: 'راجع خطتك الحالية والاستخدام ورقّ أو خفّض باقتك',
    currentPlanLabel: 'الباقة الحالية',
    trialEndsOn: 'تنتهي الفترة التجريبية في',
    renewsOn: 'يتجدد الاشتراك في',
    usageLabel: 'الاستخدام',
    usersUsage: 'المستخدمون',
    branchesUsage: 'الفروع',
    productsUsage: 'المنتجات',
    unlimited: 'غير محدود',
    featuresLabel: 'المميزات المتضمنة',
    choosePlanDesc: 'اختر الباقة التي تناسب عملك. يمكنك الترقية أو الخفض في أي وقت.',
    planChangeSuccess: 'تم تغيير الباقة بنجاح',
    planChangeFailed: 'فشل تغيير الباقة',
    confirmPlanChange: 'هل أنت متأكد من التبديل إلى باقة',
    planLoading: 'جاري تحميل بيانات الباقة...',
    changePlan: 'تغيير الباقة',
    currentPlanBadge: 'الباقة الحالية',

    // Subscription guard / paywall
    paywallTitle: 'الاشتراك غير نشط',
    paywallDesc: 'تم إيقاف الوصول مؤقتاً حتى يتم تجديد باقتك.',
    paywallPastDue: 'فترة اشتراكك الحالية متأخرة السداد أو ملغاة. جرّبها أو اختر باقتك.',
    paywallTrialEnded: 'انتهت الفترة التجريبية لباقتك.',
    paywallGoBilling: 'الانتقال إلى الباقة والفواتير',
    paywallLogout: 'تسجيل الخروج',

    // Plan selection & renewal
    signupPlanTitle: 'اختر باقتك',
    signupPlanDesc: 'ابدأ بفترة تجريبية 14 يوماً ثم ادفع شهرياً. يمكنك تغيير باقتك في أي وقت من الإعدادات.',
    signupTrialNote: 'فترة تجريبية 14 يوماً · بدون بطاقة ائتمانية',
    renewTitle: 'تجديد الاشتراك',
    renewDesc: 'انتهت الفترة التجريبية. جدّد باقتك للمتابعة على نفس الباقة.',
    renewNow: 'جدّد واستمر',
    renewing: 'جاري معالجة الدفع...',
    renewSuccess: 'تم تجديد الاشتراك بنجاح',
    renewFailed: 'فشل التجديد، حاول مرة أخرى',
  },
  en: {
    // Navigation & Common
    posTerminal: 'POS Terminal',
    currency: 'SAR',
    adminDashboard: 'Dashboard',
    products: 'Products',
    categories: 'Categories',
    inventoryStock: 'Inventory Stock',
    staffUsers: 'Staff & Users',
    branches: 'Branches',
    reports: 'Reports & Analytics',
    reportsTitle: 'Reports & Analytics',
    reportsDesc: 'Track revenue, orders, and top-selling items',
    logout: 'Logout',
    searchPlaceholder: 'Search products by name, SKU, or scan barcode...',
    noProducts: 'No products found',
    loading: 'Loading...',
    save: 'Save',
    cancel: 'Cancel',
    active: 'ACTIVE',
    inactive: 'INACTIVE',
    status: 'Status',
    actions: 'Actions',
    name: 'Name',
    email: 'Email',
    role: 'Role',
    branch: 'Branch',
    location: 'Location / Address',
    contact: 'Contact Phone',
    addNew: 'Add New',

    // Layout
    kodaSoftAdmin: 'KodaSoft Admin',
    enterprisePosHeader: 'KODASOFT ENTERPRISE POS',

    // Login
    loginTitle: 'KodaSoft-POS System',
    loginSubtitle: 'Enterprise Point of Sale Solutions',
    emailPassword: 'Email & Password',
    quickPin: 'Quick Cashier PIN',
    emailAddress: 'Email Address',
    password: 'Password',
    signIn: 'Sign In',
    authenticating: 'Authenticating...',
    enterPin: 'Enter 4-Digit Cashier PIN',
    openTerminal: 'Open Terminal',
    verifyingPin: 'Verifying PIN...',
    poweredBy: 'Powered by KodaSoft Software Solutions',
    loginFailed: 'Login failed. Please check credentials.',
    invalidPin: 'Invalid PIN.',

    // POS
    currentOrder: 'Current Order',
    clear: 'Clear Cart',
    cartEmpty: 'Cart is currently empty',
    subtotal: 'Subtotal',
    vat: 'VAT (15%)',
    totalAmount: 'Total Amount',
    payCash: 'Pay Cash',
    payCard: 'Pay Card',
    payMada: 'Mada',
    payVisa: 'Visa',
    payMastercard: 'MasterCard',
    payApplePay: 'Apple Pay',
    payStcPay: 'STC Pay',
    payBankTransfer: 'Bank Transfer',
    orderCompleted: 'Order Completed Successfully!',
    offlineMode: 'Offline Mode',
    pending: 'Pending',
    endShift: 'End Shift',
    openShift: 'Open Register Shift',
    confirmCloseShift: 'Confirm Close Shift',
    openingCashAmount: 'Opening Cash Amount',
    closingCashAmount: 'Closing Cash Amount (Actual Count)',
    openingCashDesc: 'Please enter the starting cash amount in the drawer to begin processing sales.',
    closingCashDesc: 'Please enter the actual physical cash counted in the drawer to blind-close this shift.',
    kodaSoftSoftware: 'KodaSoft Software',
    cashier: 'Cashier',
    offlinePending: 'Offline Mode ({count} Pending)',
    allItems: 'All Items',
    loadingCatalog: 'Loading product catalog...',
    skuPrefix: 'SKU:',
    failedToProcessShift: 'Failed to process shift',
    openRegisterShift: 'Open Register Shift',
    endCloseShift: 'End & Close Shift',

    // POS: Order History & Refunds
    orderHistory: 'Order History & Refunds',
    orderHistoryDesc: 'View past orders and process refunds or voids',
    searchOrder: 'Search by order number or customer name...',
    customerCol: 'Customer',
    orderDate: 'Order Date',
    orderTotal: 'Order Total',
    refundOrder: 'Refund Order',
    voidOrder: 'Void Order',
    refundReason: 'Refund Reason',
    refundReasonPlaceholder: 'Enter refund reason (optional)',
    confirmRefund: 'Confirm Refund',
    confirmVoid: 'Confirm Void',
    confirmRefundMsg: 'Are you sure you want to refund this order? Items will be restocked and payments cancelled.',
    confirmVoidMsg: 'Are you sure you want to void this order? Items will be restocked.',
    refundSuccess: 'Order refunded successfully',
    refundFailed: 'Failed to refund order',
    voidSuccess: 'Order voided successfully',
    voidFailed: 'Failed to void order',
    orderFailed: 'Failed to complete order',
    insufficientStock: 'Insufficient stock to complete this order',
    cannotRefund: 'This order cannot be refunded',
    cannotVoid: 'This order cannot be voided',
    noOrdersFound: 'No matching orders found',
    loadingOrders: 'Loading orders...',
    statusCompleted: 'COMPLETED',
    statusVoided: 'VOIDED',
    statusRefunded: 'REFUNDED',
    statusPending: 'PENDING',
    statusAll: 'All',
    processing: 'Processing...',
    noBranchAssigned: 'No branch assigned to this user',
    viewDetails: 'View Details',
    invoiceDetails: 'Invoice Details',
    discountLabel: 'Discount',
    notesLabel: 'Notes',
    paymentCol: 'Payment',
    selectCustomer: 'Select Customer',
    addCustomer: 'Add New Customer',
    customerName: 'Customer Name',
    customerPhone: 'Phone Number',
    partialRefund: 'Partial Refund',
    fullRefund: 'Full Refund',
    refundQuantity: 'Refund Quantity',
    itemsToRefund: 'Items to Refund',
    soldCol: 'Sold',
    refundedCol: 'Refunded',
    noItemsSelected: 'Please select a quantity for at least one item',
    orderDetails: 'Invoice Details',
    printReceipt: 'Print Receipt',
    refundedAmount: 'Refunded Amount',
    netTotal: 'Net Total',
    zatcaInvoice: 'Electronic Invoice',
    invoiceUuid: 'Invoice UUID',
    invoiceHash: 'Invoice Hash',

    // Dashboard & Reports
    totalRevenue: 'Total Revenue',
    totalOrders: 'Total Orders',
    itemsSold: 'Items Sold',
    paymentsBreakdown: 'Payments Breakdown',
    revenueLast7Days: 'Revenue (Last 7 Days)',
    top5Products: 'Top 5 Products',
    unitsSold: 'units sold',
    avgOrderValue: 'Avg order value:',
    fromLastWeek: '+12% from last week',
    cash: 'Cash',
    card: 'Card',
    noSalesData: 'No sales data yet.',
    loadingReports: 'Loading reports data...',

    // Reports: common
    period: 'Period',
    periodToday: 'Today',
    periodWeek: 'This Week',
    periodMonth: 'This Month',
    periodYear: 'This Year',
    periodAll: 'All Time',
    periodCustom: 'Custom',
    fromDate: 'From',
    toDate: 'To',
    allBranches: 'All Branches',
    apply: 'Apply',
    noData: 'No data',
    revenue: 'Revenue',
    ordersCount: 'Orders',
    refresh: 'Refresh',

    // Reports: export
    export: 'Export',
    exportReports: 'Export Reports',
    exportAll: 'Export All',
    exportSelected: 'Export Selected',
    exportSeparateFiles: 'Separate files (one per report)',
    exportCombinedFile: 'Single combined file',
    selectReportsToExport: 'Select reports to export',
    exportFormat: 'Export format',
    exportLayout: 'Export layout',
    exporting: 'Exporting...',
    exportDone: 'Reports exported successfully',
    exportFailed: 'Export failed, please try again',
    exportedOn: 'Generated on',
    exportPrint: 'Print / PDF',
    nameCol: 'Name',
    dateCol: 'Date',
    statusCol: 'Status',
    breakdown: 'Breakdown',
    series: 'Series',

    // Reports: sales
    reportSales: 'Sales Report',
    reportSalesDesc: 'Track revenue, orders, and items sold, broken down by branch, cashier, customer, or product.',
    groupBy: 'Group By',
    groupNone: 'No grouping',
    groupBranch: 'By Branch',
    groupCashier: 'By Cashier',
    groupCustomer: 'By Customer',
    groupProduct: 'By Product',
    groupCategory: 'By Category',
    groupPayment: 'By Payment Method',
    revenueOverPeriod: 'Revenue over period',
    walkInCustomer: 'Walk-in',

    // Reports: VAT
    reportVat: 'VAT Report',
    reportVatDesc: 'Compute VAT due on sales, discounts, and returns for the period.',
    vatBeforeTax: 'Total sales before tax',
    vatCollected: 'Total VAT',
    vatAfterTax: 'Total sales after tax',
    vatDiscounts: 'Discounts',
    vatOnDiscounts: 'Tax on discounts',
    vatReturns: 'Returns',
    vatReturnsSubtotal: 'Returns subtotal',
    vatReturnsTax: 'Returns tax',
    vatNetDue: 'Net VAT due',
    vatEffectiveRate: 'Effective tax rate',

    // Reports: invoices
    reportInvoices: 'Invoices Report',
    reportInvoicesDesc: 'Review the count and value of tax, simplified, cancelled, returned, and other invoices.',
    invoicesTotal: 'Total invoices',
    invoicesTax: 'Tax invoices',
    invoicesSimplified: 'Simplified invoices',
    invoicesCancelled: 'Cancelled invoices',
    invoicesReturned: 'Returned invoices',
    invoicesIncomplete: 'Incomplete invoices',
    invoicesSuspended: 'Suspended invoices',
    invoicesCompleted: 'Completed invoices',
    invoicesValue: 'Invoices value',
    invoicesTaxValue: 'Tax value',

    // Reports: payments
    reportPayments: 'Payment Methods',
    reportPaymentsDesc: 'Sales distribution by payment method with transaction counts and share per method.',
    payMethod: 'Payment method',
    payCount: 'Transactions',
    payAmount: 'Total amount',
    payShare: 'Share',
    payGrandTotal: 'Grand total',

    // Reports: inventory
    reportInventory: 'Inventory Report',
    reportInventoryDesc: 'Monitor current, low, and expired stock levels together with stock movements.',
    invCurrentStock: 'Current Stock',
    invLowStock: 'Low Stock Products',
    invExpired: 'Expired Products',
    invMovements: 'Stock Movements',
    invWastage: 'Wastage',
    invTotalUnits: 'Total units',
    invTotalValue: 'Stock value',
    invExpiryDate: 'Expiry date',
    invQuantity: 'Quantity',
    invThreshold: 'Alert threshold',
    invProduct: 'Product',
    invNoExpired: 'No expired products',
    invNoLow: 'No low stock products',
    mvSale: 'Sales',
    mvPurchase: 'Purchases / Stock in',
    mvAdjustment: 'Adjustment / Count',
    mvWastage: 'Wastage',
    mvReturn: 'Returns',
    mvOther: 'Other',

    // Reports: shifts
    reportShifts: 'Shifts Report',
    reportShiftsDesc: 'Per-shift detail: cash and card sales, expenses, withdrawals, and drawer difference.',
    shiftOpenedAt: 'Opened at',
    shiftClosedAt: 'Closed at',
    shiftCashier: 'Cashier',
    shiftBranch: 'Branch',
    shiftOpeningCash: 'Opening cash',
    shiftClosingCash: 'Closing cash',
    shiftExpectedCash: 'Expected cash',
    shiftDifference: 'Difference',
    shiftCashSales: 'Cash sales',
    shiftCardSales: 'Card / network sales',
    shiftTotalSales: 'Total sales',
    shiftReturns: 'Returns',
    shiftExpenses: 'Expenses',
    shiftWithdrawals: 'Withdrawals',
    shiftOrders: 'Orders',
    shiftOpen: 'Open',
    shiftClosed: 'Closed',
    noShifts: 'No shifts in this period',

    // Products Management
    productsManagement: 'Products Management',
    productsDesc: 'Create, update, and manage catalog items',
    addNewProduct: 'Add New Product',
    importProducts: 'Import Products',
    exportProducts: 'Export Products',
    importCreated: 'created',
    importUpdated: 'updated',
    importSkipped: 'skipped',
    importFailed: 'Import failed',
    filterProducts: 'Filter by product name, SKU, or barcode...',
    productName: 'Product Name',
    categoryCol: 'Category',
    sku: 'SKU',
    skuBarcode: 'SKU / Barcode',
    price: 'Price',
    cost: 'Cost',
    noProductsFoundCreate: 'No products found. Click "Add New Product" to create one.',
    uncategorized: 'Uncategorized',
    editProduct: 'Edit Product',
    createProduct: 'Create New Product',
    productNameEn: 'Product Name (English)',
    productNameAr: 'Product Name (Arabic)',
    typeCol: 'Type',
    retail: 'Retail',
    fnb: 'Food & Beverage (F&B)',
    barcode: 'Barcode',
    priceLabel: 'Price ($)',
    costLabel: 'Cost ($)',
    saveProduct: 'Save Product',
    saving: 'Saving...',
    deactivateProductConfirm: 'Are you sure you want to deactivate this product?',
    failedSaveProduct: 'Failed to save product',
    selectCategory: '-- Select Category --',
    productNamePlaceholder: 'e.g. Latte',
    productNameArPlaceholder: 'مثال: لاتيه',
    skuPlaceholder: 'BEV-003',
    barcodePlaceholder: '600000000004',
    pricePlaceholder: '5.00',
    costPlaceholder: '1.50',

    // Categories Management
    categoriesManagement: 'Categories Management',
    categoriesDesc: 'Organize products into menu categories',
    addCategory: 'Add Category',
    sort: 'Sort',
    categoryName: 'Category Name',
    slug: 'Slug',
    loadingCategories: 'Loading categories...',
    noCategories: 'No categories found.',
    editCategory: 'Edit Category',
    createCategory: 'Create Category',
    categoryNameEn: 'Category Name (English)',
    categoryNameAr: 'Category Name (Arabic)',
    sortOrder: 'Sort Order',
    saveCategory: 'Save Category',
    deactivateCategoryConfirm: 'Are you sure you want to deactivate this category?',
    failedSaveCategory: 'Failed to save category',
    categoryNamePlaceholder: 'e.g. Desserts',
    categoryNameArPlaceholder: 'مثال: حلويات',

    // Inventory
    inventoryTitle: 'Inventory & Stock Levels',
    inventoryDesc: 'Monitor branch stock levels and low-stock alerts',
    stockQuantity: 'Stock Quantity',
    alertThreshold: 'Alert Threshold',
    stockStatus: 'Stock Status',
    loadingInventory: 'Loading inventory data...',
    noInventory: 'No inventory records found.',
    lowStock: 'Low Stock',
    inStock: 'In Stock',
    adjustStock: 'Adjust Stock',
    selectProduct: 'Select Product',
    selectBranch: 'Select Branch',
    adjustmentType: 'Adjustment Type',
    increaseStock: 'Increase',
    decreaseStock: 'Decrease',
    adjustmentQuantity: 'Quantity',
    adjustmentReason: 'Reason / Note (optional)',
    adjustmentReasonPlaceholder: 'e.g. End-of-period stock count',
    confirmAdjust: 'Confirm Adjustment',
    adjustSuccess: 'Stock adjusted successfully',
    adjustFailed: 'Failed to adjust stock',
    adjustmentHistory: 'Stock Adjustment History',
    adjustmentHistoryDesc: 'Recent stock adjustments and quantity corrections',
    adjustedQuantity: 'Adjusted',
    adjustedBy: 'By',
    noAdjustments: 'No adjustments yet',
    currentStock: 'Current Stock',

    // Users Management
    usersTitle: 'Staff & Users Management',
    usersDesc: 'Manage cashiers, managers, and system access',
    addUser: 'Add User',
    loadingUsers: 'Loading users...',
    editUser: 'Edit User',
    createUser: 'Create New User',
    fullName: 'Full Name',
    loginPin: 'Login PIN (4-digit)',
    newPasswordOptional: 'New Password (Optional)',
    newPinOptional: 'New PIN (Optional, 4-digit)',
    saveUser: 'Save User',
    failedSaveUser: 'Failed to save user',
    cashierRole: 'CASHIER',
    managerRole: 'MANAGER',
    ownerRole: 'OWNER',
    deleteUser: 'Delete User',
    confirmDeleteUser: 'Confirm Delete User',
    confirmDeleteUserMsg: 'Are you sure you want to delete user "{name}"? This action cannot be undone.',
    deleteUserSuccess: 'User deleted successfully',
    deleteUserFailed: 'Failed to delete user, user has history or an error occurred',

    // Customers Management
    customers: 'Customers',
    customersTitle: 'Customers Management',
    customersDesc: 'Create, update, and manage customer records',
    editCustomer: 'Edit Customer',
    createCustomer: 'Create New Customer',
    customerEmail: 'Email',
    customerAddress: 'Address',
    customerNotes: 'Notes',
    searchCustomers: 'Search by name, phone, or email...',
    loadingCustomers: 'Loading customers...',
    noCustomers: 'No customers yet. Click "Add Customer" to create one.',
    saveCustomer: 'Save Customer',
    deleteCustomer: 'Delete Customer',
    confirmDeleteCustomer: 'Confirm Delete Customer',
    confirmDeleteCustomerMsg: 'Are you sure you want to delete customer "{name}"? This action cannot be undone.',
    deleteCustomerSuccess: 'Customer deleted successfully',
    deleteCustomerFailed: 'Failed to delete customer, customer has orders or an error occurred',
    failedSaveCustomer: 'Failed to save customer',

    // Branches Management
    branchesTitle: 'Branches Configuration',
    branchesDesc: 'Manage store locations and assigned resources',
    addBranch: 'Add Branch',
    loadingBranches: 'Loading branches...',
    locationLabel: 'Location:',
    contactLabel: 'Contact:',
    staff: 'Staff',
    orders: 'Orders',
    editBranch: 'Edit Branch',
    newBranch: 'New Branch',
    branchName: 'Branch Name',
    addressLocation: 'Address / Location',
    failedSaveBranch: 'Failed to save branch',
    deleteBranch: 'Delete Branch',
    confirmDeleteBranch: 'Confirm Delete Branch',
    confirmDeleteBranchMsg: 'Are you sure you want to delete branch "{name}"? This action cannot be undone.',
    deleteBranchSuccess: 'Branch deleted successfully',
    deleteBranchFailed: 'Failed to delete branch, branch is in use or an error occurred',

    // Receipt
    enterprisePos: 'Enterprise Point of Sale',
    taxRegistration: 'Tax Registration:',
    orderNumber: 'Order #:',
    date: 'Date:',
    cashierLabel: 'Cashier:',
    itemCol: 'Item',
    qtyCol: 'Qty',
    totalCol: 'Total',
    subtotalCol: 'Subtotal:',
    vatCol: 'VAT (15%):',
    totalColValue: 'Total:',
    paidBy: 'Paid by {method}:',
    change: 'Change:',
    keepReceipt: 'Please keep this receipt for your records.',
    thankYou: 'Thank you for your visit!',
    eachUnit: 'ea',

    // Registration / Onboarding
    registerTitle: 'Launch your store in minutes',
    registerSubtitle: 'Create your account and start selling instantly — 14-day free trial',
    storeNameLabel: 'Store Name',
    storeNamePlaceholder: 'e.g. Family Store',
    ownerNameLabel: 'Owner Name',
    ownerNamePlaceholder: 'Full name',
    phoneLabel: 'Phone Number (optional)',
    branchNameLabel: 'Branch Name (optional)',
    branchNamePlaceholder: 'Main Branch',
    createAccount: 'Create Account & Start Selling',
    creatingAccount: 'Creating your account...',
    haveAccount: 'Already have an account?',
    signInNow: 'Sign in',
    passwordMinHint: 'Password must be at least 8 characters',
    newHere: 'New to KodaSoft-POS?',
    startFreeTrial: 'Create your store free',

    // SaaS Operator Console
    saasConsole: 'Platform Console (SaaS)',
    saasOverview: 'Overview',
    saasTenants: 'Tenants',
    saasLogout: 'Logout',
    saasTotalTenants: 'Total Tenants',
    saasActiveTenants: 'Active Tenants',
    saasSuspendedTenants: 'Suspended Tenants',
    saasTotalUsers: 'Total Users',
    saasTotalOrders: 'Total Orders',
    saasTotalRevenue: 'Total Revenue',
    saasTodayOrders: "Today's Orders",
    saasTodayRevenue: "Today's Revenue",
    saasMRR: 'Monthly Recurring Revenue (MRR)',
    saasPerMonth: '/mo',
    saasSubscriptions: 'Subscriptions',
    saasTenant: 'Tenant',
    saasPlan: 'Plan',
    saasStatus: 'Status',
    saasCreated: 'Created',
    saasUsers: 'Users',
    saasBranches: 'Branches',
    saasOrdersCount: 'Orders',
    saasRevenue: 'Revenue',
    saasActions: 'Actions',
    saasActivate: 'Activate',
    saasSuspend: 'Suspend',
    saasUpgrade: 'Upgrade Plan',
    saasDowngrade: 'Downgrade Plan',
    saasDetail: 'Details',
    saasBack: 'Back',
    saasRecentOrders: 'Recent Orders',
    saasNoTenants: 'No tenants registered yet',
    saasLoading: 'Loading...',
    saasUpdated: 'Tenant updated successfully',
    saasUpdateFailed: 'Failed to update tenant',
    saasStarter: 'Starter',
    saasPro: 'Professional',
    saasEnterprise: 'Enterprise',
    saasTrial: 'Trial',
    saasActiveSub: 'Active',
    saasPastDue: 'Past due',
    saasCancelled: 'Cancelled',
    saasMemberSince: 'Member since',

    // Settings / Plan & Billing
    settingsTitle: 'Settings',
    settingsDesc: 'Store settings, plan, and subscription',
    storeInformation: 'Store Information',
    storeInfoDesc: 'These details appear on receipts and tax invoices',
    storeNameField: 'Store Name',
    vatNumberField: 'VAT Number',
    receiptFooterField: 'Receipt Footer',
    saveSettings: 'Save Settings',
    settingsSaved: 'Settings saved successfully',
    settingsSaveFailed: 'Failed to save settings',
    planBilling: 'Plan & Billing',
    planBillingDesc: 'Review your current plan and usage, upgrade or downgrade anytime',
    currentPlanLabel: 'Current Plan',
    trialEndsOn: 'Trial ends on',
    renewsOn: 'Subscription renews on',
    usageLabel: 'Usage',
    usersUsage: 'Users',
    branchesUsage: 'Branches',
    productsUsage: 'Products',
    unlimited: 'Unlimited',
    featuresLabel: 'Included Features',
    choosePlanDesc: 'Choose the plan that fits your business. Upgrade or downgrade anytime.',
    planChangeSuccess: 'Plan changed successfully',
    planChangeFailed: 'Failed to change plan',
    confirmPlanChange: 'Are you sure you want to switch to the',
    planLoading: 'Loading plan data...',
    changePlan: 'Change Plan',
    currentPlanBadge: 'Current Plan',

    // Subscription guard / paywall
    paywallTitle: 'Subscription Inactive',
    paywallDesc: 'Access has been temporarily disabled until your subscription is renewed.',
    paywallPastDue: 'Your subscription is past due or canceled. Renew it or choose a plan to continue.',
    paywallTrialEnded: 'Your plan trial period has ended.',
    paywallGoBilling: 'Go to Plan & Billing',
    paywallLogout: 'Log out',

    // Plan selection & renewal
    signupPlanTitle: 'Choose your plan',
    signupPlanDesc: 'Start with a 14-day free trial, then pay monthly. Change your plan anytime from settings.',
    signupTrialNote: '14-day free trial · No credit card required',
    renewTitle: 'Subscription renewal',
    renewDesc: 'Your trial has ended. Renew your plan to continue on the same plan.',
    renewNow: 'Renew & continue',
    renewing: 'Processing payment...',
    renewSuccess: 'Subscription renewed successfully',
    renewFailed: 'Renewal failed, please try again',
  },
};

interface LanguageState {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: Translations;
}

export const useLanguageStore = create<LanguageState>(
  (persist as any)(
    (set: any) => ({
      language: 'ar',
      t: translations.ar,
      setLanguage: (lang: Language) => {
        document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
        document.documentElement.lang = lang;
        set({
          language: lang,
          t: translations[lang],
        });
      },
    }),
    {
      name: 'casheer-language-pref',
      partialize: (state: any) => ({ language: state.language }),
      onRehydrateStorage: () => (state: any) => {
        if (state) {
          const lang = (state.language as Language) || 'ar';
          document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
          document.documentElement.lang = lang;
          useLanguageStore.setState({ t: translations[lang] });
        }
      },
    }
  )
);

export function localizedName(name?: string, nameAr?: string): string {
  const { language } = useLanguageStore.getState();
  if (language === 'ar' && nameAr) return nameAr;
  return name || nameAr || '';
}

export function alternateName(name?: string, nameAr?: string): string {
  const { language } = useLanguageStore.getState();
  return language === 'ar' ? name || '' : nameAr || '';
}

export function paymentMethodLabel(method?: string): string {
  const { t } = useLanguageStore.getState();
  switch (method) {
    case 'CASH': return t.payCash;
    case 'CARD': return t.payCard;
    case 'MADA': return t.payMada;
    case 'VISA': return t.payVisa;
    case 'MASTERCARD': return t.payMastercard;
    case 'APPLE_PAY': return t.payApplePay;
    case 'STC_PAY': return t.payStcPay;
    case 'BANK_TRANSFER': return t.payBankTransfer;
    default: return method || '';
  }
}
