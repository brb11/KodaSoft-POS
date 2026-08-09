export type Locale = 'en' | 'ar';
export const locales: Locale[] = ['en', 'ar'];

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
    heroBadge: 'Cloud POS for Saudi retail',
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
    heroBadge: 'نقطة بيع سحابية لتجارة التجزئة في السعودية',
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
