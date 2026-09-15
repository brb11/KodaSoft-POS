export type Locale = 'en' | 'ar';
// Arabic is the primary language; English is the secondary.
export const locales: Locale[] = ['ar', 'en'];

type DictNode = string | Record<string, unknown>;

export const dict: Record<Locale, DictNode> = {
  en: {
    // nav
    navFeatures: 'Features',
    navPricing: 'Pricing',
    navFaq: 'FAQ',
    login: 'Log in',
    startFree: 'Start free trial',

    // hero
    heroBadge: 'Cloud POS for modern retail',
    heroTitle1: 'Your store,',
    heroTitleAccent: 'selling smarter',
    heroSubtitle:
      'KodaSoft-POS is a cloud point-of-sale with ZATCA-ready e-invoicing, multi-branch management, offline mode, and real-time reports — up and running in minutes.',
    ctaStart: 'Start free trial',
    ctaPricing: 'View pricing',
    trustLine: '14-day free trial · No credit card required · Cancel anytime',

    // stats
    statOrders: 'Orders processed',
    statProducts: 'Products tracked',
    statBranches: 'Branches managed',
    statUsers: 'Staff users',

    // features
    featuresTitle: 'Everything your business needs',
    featuresSubtitle:
      'From the counter to the back office, KodaSoft-POS keeps every sale, branch, and report in sync.',
    featZatca: 'ZATCA e-Invoicing',
    featZatcaDesc: 'Simplified tax invoices with QR codes, built for ZATCA compliance.',
    featOffline: 'Offline Mode',
    featOfflineDesc: 'Keep selling when the internet drops — sales sync automatically when you reconnect.',
    featMultiBranch: 'Multi-Branch',
    featMultiBranchDesc: 'Run branches, shift handovers, and consolidated reports from one place.',
    featReports: 'Real-Time Reports',
    featReportsDesc: 'Sales, profit, and inventory reports update the moment you sell.',
    featUsers: 'Role-Based Access',
    featUsersDesc: 'Owner, manager, and cashier roles with PIN login and a full audit trail.',
    featInventory: 'Inventory Control',
    featInventoryDesc: 'Stock levels, barcodes, and low-stock alerts keep your shelves full.',

    // pricing
    pricingTitle: 'Simple, transparent pricing',
    pricingSubtitle: 'Start with a 14-day free trial of any plan and upgrade as you grow.',
    perMonth: '/mo',
    perYear: '/yr',
    saveYearly: 'Save 2 months',
    billingMonthly: 'Monthly',
    billingYearly: 'Yearly',
    currency: 'SAR',
    popular: 'Most popular',
    startPlan: 'Start free trial',
    contactSales: 'Contact sales',
    planStarter: 'Starter',
    planPro: 'Professional',
    planEnterprise: 'Enterprise',
    limitUsers: '{n} users',
    limitBranches: '{n} branches',
    limitProducts: '{n} products',
    unlimited: 'Unlimited',
    featOfflineLbl: 'Offline Mode',
    featAdvancedReportsLbl: 'Advanced Reports',
    featMultiBranchLbl: 'Multi-Branch',
    featZatcaLbl: 'ZATCA e-Invoicing',
    planCta: 'Choose {plan}',

    // FAQ
    faqTitle: 'Frequently asked questions',
    faq1q: 'Is there really a free trial?',
    faq1a:
      'Yes. Every new account gets a 14-day free trial of your chosen plan — no credit card required.',
    faq2q: 'What does the 14-day trial include?',
    faq2a:
      'Trial accounts get full access to your chosen plan with no limits, including ZATCA e-invoicing.',
    faq3q: 'Is ZATCA e-invoicing included?',
    faq3a:
      'ZATCA-compliant simplified tax invoices with QR codes are included from the Starter plan and up.',
    faq4q: 'Can I change plans later?',
    faq4a:
      'Anytime, from your settings. Upgrades apply immediately; downgrades are checked against your current usage.',
    faq5q: 'Does offline mode work on every plan?',
    faq5a:
      'Offline mode is available on Professional and Enterprise plans, so sales continue even without internet.',

    // CTA banner
    ctaTitle: 'Ready to move your store to KodaSoft-POS?',
    ctaSubtitle: 'Set up your first branch in minutes — no credit card required.',
    ctaButton: 'Start free trial',

    // docs
    navDocs: 'User Guide',
    docs: {
      title: 'User Guide',
      subtitle:
        'A complete walkthrough of KodaSoft-POS — from your first login to daily sales, reports, shifts, and ZATCA e-invoicing.',
      toc: 'On this page',
      screenshotLabel: 'Screenshot',
      clickToZoom: 'Click to enlarge',
      zoomIn: 'Zoom in',
      zoomOut: 'Zoom out',
      resetZoom: 'Reset zoom',
      closeZoom: 'Close',
      gettingStarted: {
        title: 'Getting started',
        s1t: 'Create your account',
        s1d: 'Open KodaSoft-POS and click "Start free trial". Enter your email and password to sign up. A 14-day free trial starts automatically — no credit card required. Your account is created as the Owner of your store.',
        s2t: 'Create your first branch',
        s2d: 'From settings or the branch selector, create your first branch (e.g., "Main Branch"). You need at least one branch before you can add products or take sales. You can add more branches later.',
        s3t: 'Add your first products',
        s3d: 'Open Products and click "Add product". Enter a name, optional SKU and barcode, cost and selling price, initial quantity, and a category. Scan barcodes at checkout to find items instantly.',
        s4t: 'Open a shift and take a sale',
        s4d: 'Open the Sales screen, start a shift, add items, and complete the sale. A ZATCA-ready e-invoice receipt is generated automatically, and your stock and reports update the moment the sale is completed.',
      },
      dashboard: {
        title: 'Dashboard & navigation',
        p1: 'The app is split into clear sections shown in the sidebar: Sales, Products, Reports, Customers, Suppliers, Purchases, Expenses, and Settings. The header always shows your current branch and lets you switch between branches.',
        p2: 'Most staff work from the Sales screen. Everything else is available to managers and owners.',
        p3: 'The navigation adapts to your role: cashiers see the Sales and Products screens, while managers and owners get the full menu including Reports, Users, Suppliers, and Settings.',
      },
      products: {
        title: 'Managing products',
        p1: 'Add products with a name, category, optional SKU and barcode, cost price, selling price, and initial stock. Use barcode scanning to add items to a sale in one step.',
        p2: 'Stock levels update automatically after every sale, purchase, or stock adjustment. You can adjust stock in or out and get low-stock alerts before an item runs out.',
        p3: 'Products can be deactivated when they are taken out of use — they stay in your records and reports but are hidden from the checkout, and you can reactivate them anytime.',
        p4: 'Group products into categories (e.g., Drinks, Groceries) to keep the checkout and reports clean. Categories also power your inventory reports.',
        p5: 'For products sold in different packaging, set up variants and selling units (carton, pack, piece…). Each unit has its own price and conversion factor, and stock is always tracked in the base unit.',
      },
      sales: {
        title: 'Sales & checkout',
        p1: 'Search products by name or scan their barcode to add them to the sale. Adjust quantities, apply discounts, and record the customer before completing the sale.',
        p2: 'Choose a payment method — cash, card, or a mix — then complete the sale. A tax invoice with a ZATCA QR code is generated automatically for the receipt.',
        p3: 'If a customer buys on credit, record the sale on the customer and it appears in their debt balance, which you can settle later from Customers.',
        p4: 'Hold a sale and continue with the next customer, then resume it later. Every completed sale generates a receipt you can print, showing the ZATCA QR code.',
      },
      customers: {
        title: 'Customers & debts',
        p1: 'Keep a customer list so credit sales (debts) are tracked to the right person.',
        p2: 'View each customer\'s total debt and payment history on their account. Record payments to settle debts, and open the customer\'s statement to see their full history and remaining balance.',
        p3: 'Refunds on credit sales also appear in the statement and are reflected in the debt balance.',
      },
      purchases: {
        title: 'Purchases & suppliers',
        p1: 'Record purchases from suppliers so stock and costs stay accurate. The purchase cost is used to calculate your profit in reports.',
        p2: 'Maintain a supplier list with contact details and your purchase history with each one.',
        p3: 'Add purchase invoices line by line with quantities, unit prices, and discounts. Stock is added automatically, and invoices remain editable until they are paid.',
      },
      expenses: {
        title: 'Expenses',
        p1: 'Record business expenses such as rent, utilities, or supplies, optionally linking them to a branch. Each expense appears in the expense reports for the period in which it was recorded.',
      },
      branches: {
        title: 'Branches',
        p1: 'Run multiple branches from one account. Each branch has its own products, stock, shifts, and sales, while reports can be viewed per branch or consolidated across all branches.',
        p2: 'Switch between branches from the header at any time. Cashiers only see the branch they are assigned to.',
      },
      shifts: {
        title: 'Shifts',
        p1: 'Use shifts to protect your cash. A cashier opens a shift, takes sales, and closes the shift when done. At closing, the system counts the expected cash and flags any difference so nothing goes missing.',
      },
      users: {
        title: 'Users, roles & PIN',
        p1: 'Create staff accounts with a role — Owner, Manager, or Cashier. Owners and managers manage products, reports, and settings; cashiers focus on sales.',
        p2: 'Staff can log in with a PIN. All sales, closings, and changes are attributed to the logged-in user, giving you a full audit trail.',
        p3: 'Deactivate staff accounts to revoke access instantly, and reset a PIN when a team member changes. Owners can also issue cash withdrawals that are recorded against the drawer.',
      },
      reports: {
        title: 'Reports',
        p1: 'Reports cover sales, profit and loss, inventory, and expenses. Filter by date range and branch. Figures update in real time so your decisions are based on current data.',
        p2: 'Dedicated tabs break performance down further: Sales, VAT, Invoices, Payments, Inventory, Shifts, Debts, and Expenses. Export any report to Excel for your accountant, or print the current view directly.',
      },
      offline: {
        title: 'Offline mode',
        p1: 'On Professional and Enterprise plans you can keep selling even when the internet drops. Sales are recorded locally and synchronize automatically when the connection returns.',
        p2: 'An indicator shows the sync state, and a queue of offline sales empties automatically in the background — no extra step for your cashiers.',
      },
      zatca: {
        title: 'ZATCA e-invoicing',
        p1: 'Simplified tax invoices are generated automatically at checkout, with a built-in QR code for ZATCA compliance. Your tax invoice number, dates, and amounts are handled for you.',
        p2: 'Configure your ZATCA settings once — branch name, tax number, and tax rate — and every receipt is generated correctly from then on. The VAT report tracks collected tax for your ZATCA filing.',
      },
      settings: {
        title: 'Settings & subscription',
        p1: 'In Settings you can update your store information, see your current plan and renewal date, and change your display language.',
        p2: 'Plans and renewals are managed by your administrator. If your subscription is about to expire or you need a plan change, contact your administrator.',
      },
      help: {
        title: 'Need help?',
        p1: 'If you get stuck, contact our support team and we will help you get back up and running.',
        whatsapp: 'Chat with us on WhatsApp',
      },
    },

    // footer
    footerTagline: 'Cloud POS and ZATCA-ready invoicing for modern retail.',
    footerProduct: 'Product',
    footerCompany: 'Company',
    footerRights: 'All rights reserved.',
  },
  ar: {
    // nav
    navFeatures: 'المميزات',
    navPricing: 'الباقات والأسعار',
    navFaq: 'الأسئلة الشائعة',
    login: 'تسجيل الدخول',
    startFree: 'ابدأ الفترة التجريبية',

    // hero
    heroBadge: 'نقطة بيع سحابية لتجارة التجزئة الحديثة',
    heroTitle1: 'متجرك،',
    heroTitleAccent: 'يبيع بذكاء أكبر',
    heroSubtitle:
      'KodaSoft-POS هو نظام نقاط بيع سحابي مع فاتورة إلكترونية جاهزة لزاتكا، وإدارة فروع متعددة، ووضع عمل دون اتصال، وتقارير لحظية — جاهز خلال دقائق.',
    ctaStart: 'ابدأ الفترة التجريبية',
    ctaPricing: 'عرض الباقات',
    trustLine: 'فترة تجريبية 14 يوماً · بدون بطاقة ائتمانية · إلغاء في أي وقت',

    // stats
    statOrders: 'طلب مكتمل',
    statProducts: 'منتج متتبع',
    statBranches: 'فرع مُدار',
    statUsers: 'مستخدم',

    // features
    featuresTitle: 'كل ما يحتاجه عملك',
    featuresSubtitle:
      'من الكاشير إلى المكتب الخلفي، يُبقي KodaSoft-POS كل مبيعاتك وفروعك وتقاريرك متزامنة.',
    featZatca: 'الفاتورة الإلكترونية (زاتكا)',
    featZatcaDesc: 'فواتير ضريبية مبسطة مع رموز QR، جاهزة للتوافق مع زاتكا.',
    featOffline: 'وضع العمل دون اتصال',
    featOfflineDesc: 'واصل البيع حتى عند انقطاع الإنترنت — تُزامن المبيعات تلقائياً عند العودة.',
    featMultiBranch: 'فروع متعددة',
    featMultiBranchDesc: 'أدر فروعك وتسليم الورديات وتقارير موحدة من مكان واحد.',
    featReports: 'تقارير لحظية',
    featReportsDesc: 'تحدَّث تقارير المبيعات والأرباح والمخزون لحظة إتمام البيع.',
    featUsers: 'صلاحيات حسب الدور',
    featUsersDesc: 'أدوار للمالك والمدير والكاشير مع دخول برمز PIN وسجل تدقيق كامل.',
    featInventory: 'التحكم بالمخزون',
    featInventoryDesc: 'مستويات المخزون والباركود وتنبيهات نفاد الكمية تُبقي رفوفك ممتلئة.',

    // pricing
    pricingTitle: 'أسعار بسيطة وواضحة',
    pricingSubtitle: 'ابدأ بفترة تجريبية مجانية 14 يوماً على أي باقة ورقِّ لاحقاً مع نمو عملك.',
    perMonth: '/شهرياً',
    perYear: '/سنوياً',
    saveYearly: 'وفّر شهرين',
    billingMonthly: 'شهري',
    billingYearly: 'سنوي',
    currency: 'ر.س',
    popular: 'الأكثر شيوعاً',
    startPlan: 'ابدأ الفترة التجريبية',
    contactSales: 'تواصل مع المبيعات',
    planStarter: 'مبتدئة',
    planPro: 'احترافية',
    planEnterprise: 'مؤسسات',
    limitUsers: '{n} مستخدم',
    limitBranches: '{n} فرع',
    limitProducts: '{n} منتج',
    unlimited: 'غير محدود',
    featOfflineLbl: 'وضع العمل دون اتصال',
    featAdvancedReportsLbl: 'تقارير متقدمة',
    featMultiBranchLbl: 'فروع متعددة',
    featZatcaLbl: 'الفاتورة الإلكترونية (زاتكا)',
    planCta: 'اختر {plan}',

    // FAQ
    faqTitle: 'الأسئلة الشائعة',
    faq1q: 'هل توجد فعلاً فترة تجريبية مجانية؟',
    faq1a: 'نعم. كل حساب جديد يحصل على فترة تجريبية مجانية 14 يوماً على الباقة التي تختارها — بدون بطاقة ائتمانية.',
    faq2q: 'ماذا تتضمن الفترة التجريبية؟',
    faq2a: 'حسابات التجربة تحصل على وصول كامل للباقة التي تختارها دون حدود، بما فيها الفاتورة الإلكترونية (زاتكا).',
    faq3q: 'هل تشمل الخدمة الفاتورة الإلكترونية (زاتكا)؟',
    faq3a: 'الفواتير الضريبية المبسطة المتوافقة مع زاتكا مع رموز QR متاحة من باقة المبتدئة فما فوق.',
    faq4q: 'هل يمكنني تغيير الباقة لاحقاً؟',
    faq4a: 'في أي وقت من إعداداتك. تُطبَّق الترقية فوراً، وتُفحص التخفيضات مقابل استخدامك الحالي.',
    faq5q: 'هل يعمل وضع عدم الاتصال في كل الباقات؟',
    faq5a: 'وضع العمل دون اتصال متاح في باقتي الاحترافية والمؤسسات، لتستمر المبيعات حتى بدون إنترنت.',

    // CTA banner
    ctaTitle: 'جاهز لنقل متجرك إلى KodaSoft-POS؟',
    ctaSubtitle: 'أنشئ أول فرع لك خلال دقائق — بدون بطاقة ائتمانية.',
    ctaButton: 'ابدأ الفترة التجريبية',

    // docs
    navDocs: 'دليل الاستخدام',
    docs: {
      title: 'دليل الاستخدام',
      subtitle:
        'دليل شامل لاستخدام KodaSoft-POS — من تسجيل الدخول الأول إلى المبيعات اليومية والتقارير والورديات والفاتورة الإلكترونية (زاتكا).',
      toc: 'في هذه الصفحة',
      screenshotLabel: 'لقطة شاشة',
      clickToZoom: 'اضغط لتكبير الصورة',
      zoomIn: 'تكبير',
      zoomOut: 'تصغير',
      resetZoom: 'إعادة الضبط',
      closeZoom: 'إغلاق',
      gettingStarted: {
        title: 'البدء',
        s1t: 'أنشئ حسابك',
        s1d: 'افتح KodaSoft-POS واضغط على "ابدأ الفترة التجريبية". أدخل بريدك الإلكتروني وكلمة المرور للتسجيل. تبدأ الفترة التجريبية المجانية (14 يوماً) تلقائياً — بدون بطاقة ائتمانية. يُنشأ حسابك بدور المالك لمتجرك.',
        s2t: 'أنشئ أول فرع لديك',
        s2d: 'من الإعدادات أو قائمة الفروع، أنشئ أول فرع (مثل: "الفرع الرئيسي"). تحتاج إلى فرع واحد على الأقل قبل أن تتمكن من إضافة المنتجات أو إجراء المبيعات. يمكنك إضافة فروع أخرى لاحقاً.',
        s3t: 'أضف أول منتجاتك',
        s3d: 'افتح صفحة المنتجات واضغط على "إضافة منتج". أدخل الاسم، ورمز SKU والباركود اختيارياً، وسعر التكلفة وسعر البيع، والكمية الابتدائية، والفئة. امسح الباركود أثناء البيع للعثور على المنتجات فوراً.',
        s4t: 'افتح وردية وأتمم عملية بيع',
        s4d: 'افتح شاشة المبيعات، ابدأ الوردية، أضف المنتجات، وأكمل البيع. تُنشأ فاتورة إلكترونية جاهزة لزاتكا تلقائياً، وتُحدَّث مخزونك وتقاريرك لحظة إتمام البيع.',
      },
      dashboard: {
        title: 'لوحة التحكم والتنقل',
        p1: 'ينقسم التطبيق إلى أقسام واضحة تظهر في الشريط الجانبي: المبيعات، المنتجات، التقارير، العملاء، الموردون، المشتريات، المصروفات، والإعدادات. يعرض الشريط العلوي فرعك الحالي دائماً ويتيح لك التبديل بين الفروع.',
        p2: 'يعمل معظم الموظفين من شاشة المبيعات. أما باقي الأقسام فهي متاحة للمدراء والمالكين.',
        p3: 'تتكيّف القائمة مع دورك: يرى الكاشير شاشتي المبيعات والمنتجات، بينما يحصل المدراء والمالكون على القائمة الكاملة بما فيها التقارير والمستخدمون والموردون والإعدادات.',
      },
      products: {
        title: 'إدارة المنتجات',
        p1: 'أضف المنتجات مع الاسم والفئة ورمز SKU والباركود اختيارياً وسعر التكلفة وسعر البيع والمخزون الابتدائي. استخدم مسح الباركود لإضافة المنتجات إلى الفاتورة في خطوة واحدة.',
        p2: 'تتحدَّث مستويات المخزون تلقائياً بعد كل عملية بيع أو شراء أو تسوية مخزون. يمكنك تعديل المخزون (إضافة أو خصم) بسرعة، وستصلك تنبيهات نفاد الكمية قبل أن تنفد أصنافك.',
        p3: 'يمكن إلغاء تفعيل المنتجات عند توقف استخدامها — تبقى في سجلاتك وتقاريرك لكنها تختفي من شاشة البيع، ويمكنك إعادة تفعيلها في أي وقت.',
        p4: 'جمّع المنتجات في فئات (مثل: مشروبات، مواد غذائية) للحفاظ على واجهة بيع وتقارير مرتبة. تدعم الفئات أيضاً تقارير المخزون.',
        p5: 'للمنتجات التي تُباع بعبوات مختلفة، أضف الخيارات ووحدات البيع (كرتون، كيس، قطعة…). لكل وحدة سعرها ومعامل التحويل الخاص بها، ويُتتبع المخزون دائماً بالوحدة الأساسية.',
      },
      sales: {
        title: 'المبيعات والخروج',
        p1: 'ابحث عن المنتجات بالاسم أو امسح الباركود لإضافتها إلى الفاتورة. عدّل الكميات وطبّق الخصومات وسجّل العميل قبل إتمام البيع.',
        p2: 'اختر طريقة الدفع — نقداً أو بطاقة أو مزيجاً منهما — ثم أكمل البيع. تُنشأ فاتورة ضريبية مع رمز QR خاص بزاتكا تلقائياً للإيصال.',
        p3: 'إذا اشترى العميل بالأجل، سجّل البيع على العميل وسيظهر في رصيد ديونه، ويمكنك تحصيله لاحقاً من صفحة العملاء.',
        p4: 'أمسك الفاتورة مؤقتاً وواعد عميلاً آخر، ثم أكملها لاحقاً. يُنشأ إيصال لكل بيع مكتمل يمكنك طباعته ويحتوي على رمز QR الخاص بزاتكا.',
      },
      customers: {
        title: 'العملاء والديون',
        p1: 'احتفظ بقائمة العملاء ليتم تتبّع المبيعات الآجلة (الديون) إلى الشخص الصحيح.',
        p2: 'اعرض إجمالي ديون كل عميل وسجل مدفوعاته في حسابه. سجّل المدفوعات لتسوية الديون، وافتح كشف حساب العميل لعرض تاريخه الكامل والرصيد المتبقي.',
        p3: 'تظهر استردادات المبيعات الآجلة أيضاً في الكشف وتنعكس على رصيد الدين.',
      },
purchases: {
        title: 'المشتريات والموردون',
        p1: 'سجّل المشتريات من الموردين لتبقى الكميات والتكاليف دقيقة. تُستخدم تكلفة الشراء لحساب أرباحك في التقارير.',
        p2: 'احتفظ بقائمة موردين تغطي بيانات التواصل وسجل مشترياتك مع كل مورد.',
        p3: 'أضف فواتير الشراء سطراً بسطر مع الكميات وأسعار الوحدة والخصومات. تُضاف الكمية إلى المخزون تلقائياً، وتبقى الفواتير قابلة للتعديل حتى الدفع.',
      },
      expenses: {
        title: 'المصروفات',
        p1: 'سجّل مصروفات العمل مثل الإيجار والكهرباء واللوازم، واربطها بفرع اختيارياً. يظهر كل مصروف في تقارير المصروفات للفترة التي سُجّل فيها.',
      },
branches: {
        title: 'الفروع',
        p1: 'أدر أكثر من فرع من حساب واحد. لكل فرع منتجاته ومخزونه ومحاسبة أوردته ومبيعاته، ويمكن عرض التقارير لكل فرع أو مجمّعة عبر جميع الفروع.',
        p2: 'بدّل بين الفروع من الشريط العلوي في أي وقت. يرى الكاشير الفرع المعيّن إليه فقط.',
      },
      shifts: {
        title: 'الورديات',
        p1: 'استخدم الورديات لحماية النقدية. يفتح الكاشير الوردية، ويجري المبيعات، ويغلق الوردية عند الانتهاء. عند الإغلاق يحسب النظام النقدية المتوقعة ويشير إلى أي فرق حتى لا يضيع شيء.',
      },
      users: {
        title: 'المستخدمون والأدوار ورمز PIN',
        p1: 'أنشئ حسابات الموظفين مع الدور المناسب — مالك أو مدير أو كاشير. يدير المالكون والمدراء المنتجات والتقارير والإعدادات؛ بينما يركّز الكاشير على المبيعات.',
        p2: 'يمكن للموظفين تسجيل الدخول برمز PIN. تُنسب جميع المبيعات والإغلاقات والتعديلات إلى المستخدم المُسجّل، مما يتيح لك سجل تدقيق كاملاً.',
        p3: 'ألغِ تفعيل حساب أي موظف لسحب صلاحياته فوراً، وأعد ضبط رمز PIN عند تغيّر الفريق. يمكن للمالك أيضاً إجراء سحوبات نقدية تُسجَّل على الدرج.',
      },
reports: {
        title: 'التقارير',
        p1: 'تغطي التقارير المبيعات والأرباح والخسائر والمخزون والمصروفات. صفِّ حسب نطاق التاريخ والفرع. تتحدث الأرقام لحظياً لتكون قراراتك مبنية على بيانات حديثة.',
        p2: 'تبوّبات مخصصة تفصّل الأداء أكثر: المبيعات، الضريبة، الفواتير، المدفوعات، المخزون، الأوردات، الديون، والمصروفات. صدّر أي تقرير إلى Excel لمحاسبك، أو اطبع العرض الحالي مباشرة.',
      },
      offline: {
        title: 'وضع العمل دون اتصال',
        p1: 'في باقتي الاحترافية والمؤسسات يمكنك مواصلة البيع حتى عند انقطاع الإنترنت. تُسجَّل المبيعات محلياً وتُزامن تلقائياً عند عودة الاتصال.',
        p2: 'يظهر مؤشر لحالة المزامنة، وتفرغ قائمة مبيعات دون اتصال تلقائياً في الخلفية — دون أي خطوة إضافية على الكاشير.',
      },
zatca: {
        title: 'فوترة زاتكا الإلكترونية',
        p1: 'تُنشأ الفواتير الضريبية المبسطة تلقائياً عند إتمام البيع، مع رمز QR مدمج للتوافق مع زاتكا. تُدار أرقام فواتيرك وتواريخها ومبالغها عنك.',
        p2: 'اضبط إعدادات زاتكا مرة واحدة — اسم الفرع والرقم الضريبي ونسبة الضريبة — وسيُنشأ كل إيصال بشكل صحيح بعدها. يتتبع تقرير الضريبة ما تم تحصيله لتقديمك لزاتكا.',
      },
      settings: {
        title: 'الإعدادات والاشتراك',
        p1: 'من الإعدادات يمكنك تحديث بيانات متجرك وعرض باقتك الحالية وتاريخ التجديد وتغيير لغة العرض.',
        p2: 'تتم إدارة الباقات والتجديدات بواسطة المسؤول. إذا كانت باقتك على وشك الانتهاء أو كنت بحاجة إلى تغيير الباقة، تواصل مع المسؤول.',
      },
      help: {
        title: 'تحتاج مساعدة؟',
        p1: 'إذا واجهتك أي مشكلة، تواصل مع فريق الدعم وسنساعدك في العودة إلى العمل.',
        whatsapp: 'تواصل معنا عبر واتساب',
      },
    },

    // footer
    footerTagline: 'نقاط بيع سحابية وفواتير إلكترونية جاهزة لزاتكا لتجارة التجزئة الحديثة.',
    footerProduct: 'المنتج',
    footerCompany: 'الشركة',
    footerRights: 'جميع الحقوق محفوظة.',
  },
};

export function t(locale: Locale, key: string, vars?: Record<string, string | number>): string {
  const node = key.split('.').reduce<unknown>((acc, part) => {
    if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[part];
    return undefined;
  }, dict[locale]);
  if (typeof node !== 'string') return key;
  if (!vars) return node;
  return node.replace(/\{(\w+)\}/g, (_, name: string) =>
    name in vars ? String(vars[name]) : `{${name}}`
  );
}
