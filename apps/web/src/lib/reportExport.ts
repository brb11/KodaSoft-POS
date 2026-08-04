import * as XLSX from 'xlsx';
import { api } from './api';
import { localizedName, paymentMethodLabel, useLanguageStore, type Translations } from '../stores/languageStore';
import { toQuery, type ReportFilters } from '../app/dashboard/reports/ReportFilters';
export type ReportKey = 'sales' | 'vat' | 'invoices' | 'payments' | 'inventory' | 'shifts';
export type ExportFormat = 'csv' | 'excel' | 'pdf';

export const REPORT_KEYS: ReportKey[] = ['sales', 'vat', 'invoices', 'payments', 'inventory', 'shifts'];

export interface ReportSection {
  title?: string;
  headers?: string[];
  rows?: string[][];
  pairs?: [string, string][];
}

export interface ReportFile {
  filename: string;
  title: string;
  sections: ReportSection[];
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function reportTitle(t: Translations, key: ReportKey): string {
  const map: Record<ReportKey, keyof Translations> = {
    sales: 'reportSales',
    vat: 'reportVat',
    invoices: 'reportInvoices',
    payments: 'reportPayments',
    inventory: 'reportInventory',
    shifts: 'reportShifts',
  };
  return t[map[key]] as string;
}

function fmtDate(d?: string | null): string {
  if (!d) return '';
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? '' : dt.toLocaleString();
}

function money(t: Translations, v: number | string | null | undefined): string {
  return `${t.currency} ${Number(v ?? 0).toLocaleString()}`;
}

function movementLabel(t: Translations, type: string): string {
  const map: Record<string, keyof Translations> = {
    sale: 'mvSale',
    purchase: 'mvPurchase',
    adjustment: 'mvAdjustment',
    wastage: 'mvWastage',
    return: 'mvReturn',
  };
  return t[map[type] || 'mvOther'] as string;
}

export function reportFilename(key: ReportKey): string {
  return `casheer-${key}-report`;
}

// ─── Build sections ────────────────────────────────────────────────────────

export function reportToSections(key: ReportKey, t: Translations, data: any): ReportSection[] {
  const sections: ReportSection[] = [];

  switch (key) {
    case 'sales': {
      const s = data?.summary;
      if (s) {
        sections.push({
          pairs: [
            [t.totalRevenue, money(t, s.revenue)],
            [t.ordersCount, String(s.orders)],
            [t.itemsSold, String(s.items)],
            [t.vatCollected, money(t, s.tax)],
            [t.vatDiscounts, money(t, s.discount)],
            [t.avgOrderValue, money(t, s.avgOrderValue)],
          ],
        });
      }
      if (data?.breakdown?.length) {
        sections.push({
          title: t.breakdown,
          headers: [t.nameCol, t.ordersCount, t.itemsSold, t.totalRevenue],
          rows: (data.breakdown as any[]).map((b) => [localizedName(b.name, b.nameAr) || b.name, String(b.orders), String(b.items), money(t, b.revenue)]),
        });
      }
      if (data?.series?.length) {
        sections.push({
          title: t.series,
          headers: [t.dateCol, t.totalRevenue, t.ordersCount],
          rows: (data.series as any[]).map((p) => [p.label || p.date, money(t, p.revenue), String(p.orders)]),
        });
      }
      break;
    }

    case 'vat': {
      sections.push({
        pairs: [
          [t.vatBeforeTax, money(t, data?.totalBeforeTax)],
          [t.vatDiscounts, money(t, data?.totalDiscount)],
          [t.vatCollected, money(t, data?.totalVat)],
          [t.vatAfterTax, money(t, data?.totalAfterTax)],
          [t.vatOnDiscounts, money(t, data?.taxOnDiscounts)],
          [t.vatReturnsSubtotal, money(t, data?.returnsSubtotal)],
          [t.vatReturns, money(t, data?.returnsTotal)],
          [t.vatReturnsTax, money(t, data?.returnsVat)],
          [t.vatNetDue, money(t, data?.netVatDue)],
          [t.vatEffectiveRate, `${data?.effectiveRate ?? 0}%`],
        ],
      });
      break;
    }

    case 'invoices': {
      sections.push({
        pairs: [
          [t.invoicesTotal, String(data?.total ?? 0)],
          [t.invoicesTax, String(data?.taxInvoices ?? 0)],
          [t.invoicesSimplified, String(data?.simplifiedInvoices ?? 0)],
          [t.invoicesCompleted, String(data?.completed ?? 0)],
          [t.invoicesCancelled, String(data?.voided ?? 0)],
          [t.invoicesReturned, String(data?.returned ?? 0)],
          [t.invoicesIncomplete, String(data?.incomplete ?? 0)],
          [t.invoicesSuspended, String(data?.suspended ?? 0)],
        ],
      });
      sections.push({
        pairs: [
          [t.invoicesValue, money(t, data?.totalValue)],
          [t.invoicesTaxValue, money(t, data?.totalTax)],
          [t.vatDiscounts, money(t, data?.totalDiscount)],
        ],
      });
      break;
    }

    case 'payments': {
      sections.push({
        headers: [t.payMethod, t.payCount, t.payAmount, t.payShare],
        rows: [
          ...(data?.rows ?? []).map((r: any) => [paymentMethodLabel(r.method), String(r.count), money(t, r.total), `${r.pct}%`]),
          [t.payGrandTotal, '', money(t, data?.grandTotal), ''],
        ],
      });
      break;
    }

    case 'inventory': {
      const totals = data?.totals;
      sections.push({
        pairs: [
          [t.invCurrentStock, String(totals?.itemCount ?? 0)],
          [t.invTotalUnits, String(totals?.totalUnits ?? 0)],
          [t.invTotalValue, money(t, totals?.totalValue)],
          [t.invLowStock, String(data?.lowStock?.length ?? 0)],
          [t.invExpired, String(data?.expired?.length ?? 0)],
          [t.invWastage, String(data?.wastage ?? 0)],
        ],
      });
      if (data?.currentStock?.length) {
        sections.push({
          title: t.breakdown,
          headers: [t.invProduct, t.invQuantity, t.invThreshold, t.invExpiryDate, t.statusCol, t.invTotalValue],
          rows: (data.currentStock as any[]).map((s) => [
            localizedName(s.name, s.nameAr) || s.name,
            String(s.quantity),
            String(s.lowStockThreshold),
            s.expiryDate ? new Date(s.expiryDate).toLocaleDateString() : '',
            s.isExpired ? t.invExpired : s.isLow ? t.invLowStock : t.active,
            money(t, s.stockValue),
          ]),
        });
      }
      if (data?.movements?.length) {
        sections.push({
          title: t.invMovements,
          headers: [t.nameCol, t.invQuantity, t.ordersCount],
          rows: (data.movements as any[]).map((m) => [movementLabel(t, m.type), String(m.quantity), String(m.count)]),
        });
      }
      break;
    }

    case 'shifts': {
      sections.push({
        headers: [
          t.shiftCashier, t.shiftBranch, t.shiftOpenedAt, t.shiftClosedAt,
          t.statusCol, t.shiftOpeningCash, t.shiftCashSales, t.shiftCardSales,
          t.shiftTotalSales, t.shiftReturns, t.shiftExpenses, t.shiftWithdrawals,
          t.shiftExpectedCash, t.shiftClosingCash, t.shiftDifference, t.shiftOrders,
        ],
        rows: (data?.rows ?? []).map((s: any) => [
          s.cashier, s.branchName, fmtDate(s.openedAt), fmtDate(s.closedAt),
          s.status === 'CLOSED' ? t.shiftClosed : t.shiftOpen,
          money(t, s.openingCash), money(t, s.cashSales), money(t, s.cardSales),
          money(t, s.totalSales), money(t, s.refunds), money(t, s.expenses),
          money(t, s.withdrawals),
          s.expectedCash != null ? money(t, s.expectedCash) : '',
          s.closingCash != null ? money(t, s.closingCash) : '',
          s.difference != null ? money(t, s.difference) : '',
          String(s.orderCount),
        ]),
      });
      break;
    }
  }

  return sections;
}

export function buildReportFile(key: ReportKey, t: Translations, data: any): ReportFile {
  return { filename: reportFilename(key), title: reportTitle(t, key), sections: reportToSections(key, t, data) };
}

export async function fetchReportData(key: ReportKey, filters: ReportFilters): Promise<any> {
  const extra: Record<string, string> = key === 'sales' ? { groupBy: 'branch' } : {};
  const res = await api.get(`/reports/${key}${toQuery(filters, extra)}`);
  return res.data?.data;
}

// ─── CSV ───────────────────────────────────────────────────────────────────

function flattenSections(sections: ReportSection[]): string[][] {
  const rows: string[][] = [];
  for (const s of sections) {
    if (s.title) { rows.push([s.title]); rows.push([]); }
    if (s.pairs) for (const [k, v] of s.pairs) rows.push([k, v]);
    if (s.headers && s.rows) { rows.push(s.headers); rows.push(...s.rows); }
    rows.push([]);
  }
  return rows;
}

function csvCell(v: string): string {
  if (/[",\r\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

function toCsv(rows: string[][]): string {
  return '\uFEFF' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadCsv(filename: string, rows: string[][]): void {
  downloadBlob(new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8;' }), filename);
}

function downloadCombinedCsv(files: ReportFile[]): void {
  const rows: string[][] = [];
  for (const f of files) {
    rows.push([f.title]); rows.push([]);
    rows.push(...flattenSections(f.sections)); rows.push([]);
  }
  downloadCsv('casheer-all-reports.csv', rows);
}

// ─── Excel ─────────────────────────────────────────────────────────────────

function sheetName(title: string): string {
  return title.replace(/[\[\]:*?/\\]/g, '').slice(0, 31) || 'Report';
}

function downloadExcel(files: ReportFile[], combined: boolean): void {
  if (combined) {
    const wb = XLSX.utils.book_new();
    for (const f of files) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(flattenSections(f.sections)), sheetName(f.title));
    }
    XLSX.writeFile(wb, 'casheer-all-reports.xlsx');
    return;
  }
  for (const f of files) {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(flattenSections(f.sections)), sheetName(f.title));
    XLSX.writeFile(wb, `${f.filename}.xlsx`);
  }
}

// ─── PDF via Browser Print (Perfect Arabic RTL) ────────────────────────────

function buildHtmlSection(s: ReportSection, rtl: boolean): string {
  let html = '';
  if (s.title) {
    html += `<h3 class="section-title">${s.title}</h3>`;
  }
  if (s.pairs && s.pairs.length > 0) {
    html += `<table class="pairs-table">`;
    for (const [k, v] of s.pairs) {
      html += `<tr><td class="pair-key">${k}</td><td class="pair-val">${v}</td></tr>`;
    }
    html += `</table>`;
  }
  if (s.headers && s.rows) {
    html += `<table class="data-table">`;
    html += `<thead><tr>${s.headers.map((h) => `<th>${h}</th>`).join('')}</tr></thead>`;
    html += `<tbody>`;
    for (const row of s.rows) {
      html += `<tr>${row.map((cell) => `<td>${cell}</td>`).join('')}</tr>`;
    }
    html += `</tbody></table>`;
  }
  return html;
}

function buildHtmlReport(files: ReportFile[], meta: string): string {
  const { language, t } = useLanguageStore.getState();
  const rtl = language === 'ar';
  const dir = rtl ? 'rtl' : 'ltr';
  const font = rtl
    ? `@import url('https://fonts.googleapis.com/css2?family=Almarai:wght@400;700;800&display=swap');`
    : `@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap');`;
  const fontFamily = rtl ? `'Almarai', Arial` : `'Plus Jakarta Sans', Arial`;

  const reportsHtml = files.map((f, i) => `
    ${i > 0 ? '<div class="page-break"></div>' : ''}
    <div class="report-block">
      <div class="report-header">
        <div class="report-header-top">
          <h2 class="report-title">${f.title}</h2>
          <span class="report-meta">${meta}</span>
        </div>
        <div class="header-line"></div>
      </div>
      ${f.sections.map((s) => buildHtmlSection(s, rtl)).join('<div class="section-gap"></div>')}
    </div>
  `).join('');

  return `<!DOCTYPE html>
<html dir="${dir}" lang="${rtl ? 'ar' : 'en'}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${t.exportReports} - KodaSoft-POS</title>
  <style>
    ${font}
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: ${fontFamily}, sans-serif;
      direction: ${dir};
      color: #1e293b;
      background: #ffffff;
      font-size: 10pt;
      line-height: 1.5;
    }
    .page {
      padding: 28pt 32pt;
    }
    /* ── Page header (logo + brand) ── */
    .brand-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-bottom: 14pt;
      border-bottom: 2pt solid #0891b2;
      margin-bottom: 22pt;
    }
    .brand-name {
      font-size: 16pt;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.5px;
    }
    .brand-name span { color: #06b6d4; }
    .brand-sub {
      font-size: 7pt;
      color: #64748b;
      font-weight: 700;
      letter-spacing: 1px;
      text-transform: uppercase;
    }
    .export-meta-top {
      font-size: 8pt;
      color: #64748b;
      text-align: ${rtl ? 'left' : 'right'};
    }
    /* ── Report block ── */
    .report-block { margin-bottom: 32pt; }
    .report-header-top {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      margin-bottom: 6pt;
    }
    .report-title {
      font-size: 14pt;
      font-weight: 800;
      color: #0f172a;
    }
    .report-meta {
      font-size: 8pt;
      color: #94a3b8;
    }
    .header-line {
      height: 2pt;
      background: linear-gradient(to right, #06b6d4, #3b82f6);
      border-radius: 2pt;
      margin-bottom: 14pt;
    }
    .section-title {
      font-size: 10pt;
      font-weight: 700;
      color: #1e40af;
      margin: 12pt 0 6pt;
      padding-${rtl ? 'right' : 'left'}: 8pt;
      border-${rtl ? 'right' : 'left'}: 3pt solid #06b6d4;
    }
    .section-gap { height: 10pt; }
    /* ── Pairs table (key-value) ── */
    .pairs-table {
      width: 100%;
      max-width: 420pt;
      border-collapse: collapse;
      margin-bottom: 8pt;
      font-size: 9.5pt;
    }
    .pairs-table td {
      padding: 4pt 8pt;
      border-bottom: 0.5pt solid #e2e8f0;
      vertical-align: top;
    }
    .pair-key {
      color: #64748b;
      font-weight: 600;
      width: 55%;
    }
    .pair-val {
      color: #0f172a;
      font-weight: 700;
      text-align: ${rtl ? 'left' : 'right'};
    }
    /* ── Data table ── */
    .data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 8.5pt;
      margin-top: 6pt;
    }
    .data-table thead tr {
      background: #0891b2;
      color: #ffffff;
    }
    .data-table thead th {
      padding: 5pt 7pt;
      font-weight: 700;
      text-align: ${rtl ? 'right' : 'left'};
      font-size: 8pt;
      letter-spacing: 0.3px;
    }
    .data-table tbody tr:nth-child(even) { background: #f1f5f9; }
    .data-table tbody tr:hover { background: #e0f2fe; }
    .data-table tbody td {
      padding: 4.5pt 7pt;
      border-bottom: 0.5pt solid #cbd5e1;
      color: #334155;
      text-align: ${rtl ? 'right' : 'left'};
    }
    /* ── Page break ── */
    .page-break { page-break-before: always; padding-top: 28pt; }
    /* ── Print settings ── */
    @media print {
      body { padding: 0; }
      .page { padding: 20pt 24pt; }
      .page-break { page-break-before: always; }
      @page { margin: 15mm 12mm; size: A4; }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="brand-header">
      <div>
        <div class="brand-name">KodaSoft-POS</div>
        <div class="brand-sub">KodaSoft Enterprise</div>
      </div>
      <div class="export-meta-top">${meta}</div>
    </div>
    ${reportsHtml}
  </div>
  <script>
    window.onload = function() {
      setTimeout(function() { window.print(); }, 600);
    };
  <\/script>
</body>
</html>`;
}

function printAsHtml(files: ReportFile[], meta: string): void {
  const html = buildHtmlReport(files, meta);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank', 'width=900,height=700');
  if (win) {
    win.focus();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  } else {
    // fallback: download html file
    downloadBlob(blob, 'casheer-report.html');
    URL.revokeObjectURL(url);
  }
}

// ─── Main entry ────────────────────────────────────────────────────────────

export async function downloadFiles(files: ReportFile[], format: ExportFormat, combined: boolean, meta: string): Promise<void> {
  if (format === 'csv') {
    if (combined) {
      downloadCombinedCsv(files);
    } else {
      for (const f of files) {
        downloadCsv(`${f.filename}.csv`, flattenSections(f.sections));
        await delay(400);
      }
    }
  } else if (format === 'excel') {
    downloadExcel(files, combined);
  } else {
    // PDF: use browser print for perfect Arabic RTL
    printAsHtml(files, meta);
  }
}
