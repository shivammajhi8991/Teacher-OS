// Hand-rolled rather than a library dependency — CSV serialization is genuinely simple (unlike
// PDF layout, which does warrant `pdfkit`), matching this codebase's existing preference for a
// small dependency-light utility over a package for something this bounded (e.g. mobile's
// hand-rolled `Result<T>`, docs/05 §5.1).
export function toCsv(
  headers: string[],
  rows: Array<Array<string | number>>,
): Buffer {
  const escape = (value: string | number): string => {
    const str = String(value);
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };
  const lines = [headers, ...rows].map((row) => row.map(escape).join(','));
  return Buffer.from(lines.join('\r\n'), 'utf-8');
}
