// Hand-rolled rather than a library dependency — matching this codebase's existing preference
// for a small dependency-light utility over a package for something this bounded (e.g.
// reports/utils/csv.util.ts's own writer, mobile's hand-rolled `Result<T>`). Parses a
// double-quote-escaped CSV (RFC 4180: a field containing a comma, quote, or newline is wrapped in
// `"..."`, with `""` for a literal quote) into an array of header-keyed row objects — the header
// row's own values become the object keys, matching how a real student-import CSV's first row
// would name its columns (fullName, dob, guardianEmail, ...).
export function parseCsv(text: string): Array<Record<string, string>> {
  const rows = parseRows(text);
  if (rows.length === 0) return [];
  const [header, ...dataRows] = rows;
  return dataRows
    .filter((row) => row.some((cell) => cell.trim() !== '')) // skip fully-blank trailing lines
    .map((row) => {
      const record: Record<string, string> = {};
      header.forEach((key, i) => {
        record[key.trim()] = (row[i] ?? '').trim();
      });
      return record;
    });
}

function parseRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  // Normalize line endings once up front so the state machine below only has to reason about
  // '\n' — a raw '\r' inside a quoted field is treated as literal content either way.
  const normalized = text.replace(/\r\n/g, '\n');

  for (let i = 0; i < normalized.length; i++) {
    const char = normalized[i];
    if (inQuotes) {
      if (char === '"') {
        if (normalized[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }
  // Final field/row — a file without a trailing newline would otherwise lose its last row.
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}
