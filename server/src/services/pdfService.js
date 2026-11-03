// Turns a daily report (from reportService) into a PDF file (Buffer).
// We use the library "pdfmake". Fonts: DejaVu Sans, because it supports
// Latin and Cyrillic letters (product names may be in Russian).

const path = require('path');
const { PAYMENT_LABELS } = require('./reportService');

// pdfmake 0.2.x exports the printer class directly. The second line is a fallback for other layouts.
let PdfPrinter = require('pdfmake');

if (typeof PdfPrinter !== 'function') {
  PdfPrinter = require('pdfmake/src/printer');
}

const FONT_DIR = path.join(__dirname, '..', '..', 'fonts');

const fonts = {
  DejaVu: {
    normal: path.join(FONT_DIR, 'DejaVuSans.ttf'),
    bold: path.join(FONT_DIR, 'DejaVuSans-Bold.ttf'),
    italics: path.join(FONT_DIR, 'DejaVuSans.ttf'),
    bolditalics: path.join(FONT_DIR, 'DejaVuSans-Bold.ttf'),
  },
};

// 1234567 -> "1 234 567"
function money(value) {
  return String(Math.round(Number(value) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function sectionTitle(text) {
  return { text, style: 'sectionTitle', margin: [0, 14, 0, 4] };
}

// Builds a table block. "columns" = [{ title, width, value: (row) => text, align }]
function buildTable(columns, rows) {
  if (rows.length === 0) {
    return { text: "Ma'lumot yo'q", italics: true, color: '#666666', margin: [0, 0, 0, 4] };
  }

  const headerRow = columns.map((column) => ({
    text: column.title,
    style: 'tableHeader',
    alignment: column.align || 'left',
  }));

  const bodyRows = rows.map((row) =>
    columns.map((column) => ({
      text: String(column.value(row)),
      alignment: column.align || 'left',
    }))
  );

  return {
    table: {
      headerRows: 1,
      widths: columns.map((column) => column.width),
      body: [headerRow, ...bodyRows],
    },
    layout: {
      fillColor: (rowIndex) => (rowIndex === 0 ? '#e4e6e8' : null),
      hLineColor: () => '#c4c8cc',
      vLineColor: () => '#c4c8cc',
    },
    fontSize: 7.5,
  };
}

function summaryLine(label, value) {
  return [{ text: label }, { text: value, alignment: 'right', bold: true }];
}

function buildSummary(report) {
  const s = report.summary;

  if (report.scope === 'global') {
    return { text: "O'zgarishlar soni: " + s.auditCount, margin: [0, 6, 0, 0] };
  }

  const body = [
    summaryLine('Sotuvlar soni', String(s.salesCount)),
    summaryLine('Sotuvlar summasi', money(s.salesTotal) + " so'm"),
    summaryLine('Berilgan chegirmalar', money(s.discountTotal) + " so'm"),
    summaryLine('Nasiyaga berilgan', money(s.newDebt) + " so'm"),
    summaryLine('Qaytarishlar', s.returnsCount + ' ta, ' + money(s.refundTotal) + " so'm"),
    summaryLine('Kirim (xarid)', s.purchaseCount + ' ta, ' + money(s.purchaseTotal) + " so'm"),
    summaryLine("Qarz to'lovlari", money(s.debtPaymentsTotal) + " so'm"),
    summaryLine('Kassa (naqd)', money(s.netByMethod.cash) + " so'm"),
    summaryLine('Kassa (karta)', money(s.netByMethod.card) + " so'm"),
    summaryLine("Kassa (o'tkazma)", money(s.netByMethod.transfer) + " so'm"),
  ];

  return {
    table: { widths: [200, 140], body },
    layout: 'lightHorizontalLines',
    fontSize: 9,
    margin: [0, 6, 0, 0],
  };
}

function buildDocDefinition(report) {
  const title =
    report.scope === 'global'
      ? "Kunlik hisobot: umumiy o'zgarishlar"
      : 'Kunlik hisobot: ' + report.branch.name;

  const content = [
    { text: title, style: 'title' },
    { text: 'Sana: ' + report.date, margin: [0, 2, 0, 0] },
    buildSummary(report),
  ];

  if (report.scope === 'branch') {
    content.push(sectionTitle('Sotuvlar'));
    content.push(
      buildTable(
        [
          { title: 'Vaqt', width: 40, value: (r) => r.time },
          { title: 'Raqam', width: 55, value: (r) => r.number },
          { title: 'Kassir', width: 55, value: (r) => r.cashier },
          { title: 'Mijoz', width: 55, value: (r) => r.customer },
          { title: 'Mahsulotlar', width: '*', value: (r) => r.items },
          { title: 'Chegirma', width: 40, align: 'right', value: (r) => money(r.discount) },
          { title: 'Jami', width: 50, align: 'right', value: (r) => money(r.total) },
          { title: "To'lov", width: 60, value: (r) => r.payments },
        ],
        report.sales
      )
    );

    content.push(sectionTitle('Qaytarishlar'));
    content.push(
      buildTable(
        [
          { title: 'Vaqt', width: 40, value: (r) => r.time },
          { title: 'Raqam', width: 55, value: (r) => r.number },
          { title: 'Sotuv', width: 55, value: (r) => r.saleNumber },
          { title: 'Xodim', width: 55, value: (r) => r.user },
          { title: 'Mahsulotlar', width: '*', value: (r) => r.items },
          { title: 'Summa', width: 50, align: 'right', value: (r) => money(r.refundAmount) },
          { title: 'Qarzdan', width: 45, align: 'right', value: (r) => money(r.debtReduced) },
          { title: 'Qaytarildi', width: 50, align: 'right', value: (r) => money(r.paidOut) + ' ' + r.paidOutMethod },
          { title: 'Sabab', width: 70, value: (r) => r.reason },
        ],
        report.returns
      )
    );

    content.push(sectionTitle('Kirimlar (qabul qilingan tovar)'));
    content.push(
      buildTable(
        [
          { title: 'Vaqt', width: 40, value: (r) => r.time },
          { title: 'Raqam', width: 60, value: (r) => r.number },
          { title: 'Yetkazib beruvchi', width: 80, value: (r) => r.supplier },
          { title: 'Xodim', width: 60, value: (r) => r.user },
          { title: 'Mahsulotlar', width: '*', value: (r) => r.items },
          { title: 'Summa', width: 60, align: 'right', value: (r) => money(r.totalCost) },
        ],
        report.purchases
      )
    );

    content.push(sectionTitle("Filiallararo ko'chirish"));
    content.push(
      buildTable(
        [
          { title: 'Vaqt', width: 40, value: (r) => r.time },
          { title: 'Raqam', width: 50, value: (r) => r.number },
          { title: 'Turi', width: 40, value: (r) => r.direction },
          { title: 'Qayerdan', width: 70, value: (r) => r.from },
          { title: 'Qayerga', width: 70, value: (r) => r.to },
          { title: 'Xodim', width: 60, value: (r) => r.user },
          { title: 'Mahsulotlar', width: '*', value: (r) => r.items },
        ],
        report.transfers
      )
    );

    content.push(sectionTitle("Qarz to'lovlari"));
    content.push(
      buildTable(
        [
          { title: 'Vaqt', width: 40, value: (r) => r.time },
          { title: 'Mijoz', width: '*', value: (r) => r.customer },
          { title: 'Summa', width: 70, align: 'right', value: (r) => money(r.amount) },
          { title: 'Usul', width: 60, value: (r) => r.method },
          { title: 'Xodim', width: 80, value: (r) => r.user },
          { title: 'Izoh', width: 100, value: (r) => r.note },
        ],
        report.debtPayments
      )
    );

    content.push(sectionTitle('Qoldiq harakatlari'));
    content.push(
      buildTable(
        [
          { title: 'Vaqt', width: 40, value: (r) => r.time },
          { title: 'Turi', width: 70, value: (r) => r.type },
          { title: 'Mahsulot', width: '*', value: (r) => r.product },
          { title: 'Partiya', width: 50, value: (r) => r.batchNumber },
          { title: 'Miqdor', width: 45, align: 'right', value: (r) => r.quantity },
          { title: 'Hujjat', width: 60, value: (r) => r.refNumber },
          { title: 'Xodim', width: 60, value: (r) => r.user },
          { title: 'Izoh', width: 80, value: (r) => r.note },
        ],
        report.movements
      )
    );
  }

  content.push(sectionTitle("Ma'lumotlardagi o'zgarishlar"));
  content.push(
    buildTable(
      [
        { title: 'Vaqt', width: 40, value: (r) => r.time },
        { title: 'Xodim', width: 80, value: (r) => r.user },
        { title: 'Amal', width: 55, value: (r) => r.action },
        { title: "Bo'lim", width: 70, value: (r) => r.entity },
        { title: 'Nomi', width: 100, value: (r) => r.label },
        { title: "O'zgarish", width: '*', value: (r) => r.changes },
      ],
      report.audit
    )
  );

  return {
    pageSize: 'A4',
    pageOrientation: 'landscape',
    pageMargins: [28, 28, 28, 36],
    defaultStyle: { font: 'DejaVu', fontSize: 9 },
    styles: {
      title: { fontSize: 16, bold: true },
      sectionTitle: { fontSize: 11, bold: true },
      tableHeader: { bold: true },
    },
    footer: (currentPage, pageCount) => ({
      text: currentPage + ' / ' + pageCount,
      alignment: 'center',
      fontSize: 8,
      color: '#666666',
    }),
    content,
  };
}

// Returns a Promise that gives a Buffer with the PDF bytes
function createReportPdf(report) {
  return new Promise((resolve, reject) => {
    try {
      const printer = new PdfPrinter(fonts);
      const pdfDocument = printer.createPdfKitDocument(buildDocDefinition(report));
      const chunks = [];

      pdfDocument.on('data', (chunk) => chunks.push(chunk));
      pdfDocument.on('end', () => resolve(Buffer.concat(chunks)));
      pdfDocument.on('error', reject);

      pdfDocument.end();
    } catch (error) {
      reject(error);
    }
  });
}

// File name like "Asosiy-filial_2026-11-01.pdf"
function reportFileName(report) {
  const base = report.scope === 'global' ? 'umumiy' : report.branch.name.replace(/[^\w\-]+/g, '-');
  return base + '_' + report.date + '.pdf';
}

module.exports = { createReportPdf, reportFileName, money, PAYMENT_LABELS };
