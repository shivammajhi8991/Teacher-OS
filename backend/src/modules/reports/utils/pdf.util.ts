// `import PDFDocument from 'pdfkit'` type-checks (tsconfig sets `allowSyntheticDefaultImports`)
// but is a REAL RUNTIME BUG: that flag only relaxes the type checker, it doesn't add the
// `esModuleInterop` helper that would make a default import actually resolve pdfkit's `export =`
// (a plain CJS `module.exports = PDFDocument`, per @types/pdfkit) — caught live by this file's
// own test suite (`TypeError: pdfkit_1.default is not a constructor`), which would have thrown
// the exact same error against the real running server the first time anyone requested a PDF
// report; `tsc`/`nest build` never execute the module, so neither ever surfaces this. The
// `import ... = require(...)` form is the correct, interop-safe way to import a CJS `export =`
// module regardless of `esModuleInterop`.
import PDFDocument = require('pdfkit');

export interface PdfColumn {
  header: string;
  width: number;
}

export interface PdfTableOptions {
  title: string;
  generatedAt: Date;
  columns: PdfColumn[];
  rows: Array<Array<string | number>>;
  /** Plain lines rendered after the table — e.g. a totals summary. */
  footerLines?: string[];
}

const ROW_HEIGHT = 18;
const HEADER_FONT_SIZE = 9;
const BODY_FONT_SIZE = 9;

// A hand-rolled table rather than pdfkit's own table helper — this pass targets a pdfkit version
// where that API's shape isn't something this environment can visually verify (no way to render
// and inspect a PDF here), so a manual, easy-to-reason-about column layout is the safer choice.
// Explicitly resets `doc.y` after each row (rather than relying on `text()`'s own cursor
// advancement) so placing several columns on one row at different `x` positions can't drift.
export function renderPdfTable(opts: PdfTableOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const startX = doc.page.margins.left;
    const bottomLimit = doc.page.height - doc.page.margins.bottom;

    const drawHeader = () => {
      doc
        .fontSize(16)
        .font('Helvetica-Bold')
        .fillColor('#000')
        .text(opts.title);
      doc
        .fontSize(9)
        .font('Helvetica')
        .fillColor('#555')
        .text(`Generated ${opts.generatedAt.toISOString()}`);
      doc.moveDown();
      doc.fillColor('#000');
      drawColumnHeader();
    };

    const drawColumnHeader = () => {
      const y = doc.y;
      let x = startX;
      doc.font('Helvetica-Bold').fontSize(HEADER_FONT_SIZE);
      for (const col of opts.columns) {
        doc.text(col.header, x, y, { width: col.width, lineBreak: false });
        x += col.width;
      }
      doc
        .moveTo(startX, y + ROW_HEIGHT - 4)
        .lineTo(x, y + ROW_HEIGHT - 4)
        .strokeColor('#ccc')
        .stroke();
      doc.y = y + ROW_HEIGHT;
    };

    const ensureSpace = () => {
      if (doc.y + ROW_HEIGHT > bottomLimit) {
        doc.addPage();
        drawColumnHeader();
      }
    };

    const drawRow = (values: Array<string | number>) => {
      ensureSpace();
      const y = doc.y;
      let x = startX;
      doc.font('Helvetica').fontSize(BODY_FONT_SIZE);
      for (let i = 0; i < opts.columns.length; i++) {
        doc.text(String(values[i] ?? ''), x, y, {
          width: opts.columns[i].width,
          lineBreak: false,
        });
        x += opts.columns[i].width;
      }
      doc.y = y + ROW_HEIGHT;
    };

    drawHeader();
    if (opts.rows.length === 0) {
      doc
        .font('Helvetica-Oblique')
        .fontSize(BODY_FONT_SIZE)
        .text('No data for this range.');
    }
    for (const row of opts.rows) drawRow(row);

    if (opts.footerLines?.length) {
      doc.moveDown();
      doc.font('Helvetica-Bold').fontSize(BODY_FONT_SIZE);
      for (const line of opts.footerLines) {
        ensureSpace();
        doc.text(line, startX, doc.y);
      }
    }

    doc.end();
  });
}

// A simple, non-tabular snapshot layout for the student profile report — headings + key/value
// lines rather than a table, since this report is one record, not many rows.
export interface PdfSectionLine {
  label: string;
  value: string;
}

export interface PdfSection {
  heading: string;
  lines: PdfSectionLine[];
}

export function renderPdfProfile(
  title: string,
  generatedAt: Date,
  sections: PdfSection[],
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(18).font('Helvetica-Bold').text(title);
    doc
      .fontSize(9)
      .font('Helvetica')
      .fillColor('#555')
      .text(`Generated ${generatedAt.toISOString()}`);
    doc.fillColor('#000');

    for (const section of sections) {
      doc.moveDown();
      doc.fontSize(13).font('Helvetica-Bold').text(section.heading);
      doc.moveDown(0.3);
      doc.fontSize(10).font('Helvetica');
      for (const line of section.lines) {
        doc.text(`${line.label}: ${line.value}`);
      }
    }

    doc.end();
  });
}
