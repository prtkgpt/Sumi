/**
 * RFC 4180-ish CSV serializer. Quotes any field containing comma, quote,
 * newline, or carriage return; doubles internal quotes. Always emits CRLF
 * line endings — Excel's default expectation.
 */
export function toCsv(rows: Array<Record<string, unknown>>, columns: string[]): string {
  const header = columns.map(escapeCell).join(',');
  const lines = rows.map((row) =>
    columns.map((c) => escapeCell(row[c])).join(',')
  );
  return [header, ...lines].join('\r\n') + '\r\n';
}

function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = value instanceof Date ? value.toISOString() : String(value);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function csvResponse(filename: string, body: string): Response {
  return new Response(body, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${filename.replace(/"/g, '')}"`,
    },
  });
}
