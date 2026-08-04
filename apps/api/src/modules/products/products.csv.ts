export function serializeCSV(header: string[], rows: Array<Record<string, unknown>>): string {
  const escape = (v: unknown): string => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [header.join(',')];
  for (const row of rows) {
    lines.push(header.map((h) => escape(row[h])).join(','));
  }
  return lines.join('\r\n');
}

export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  const s = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (c !== '\r') {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export function csvRowsToObjects(text: string): Array<Record<string, string>> {
  const rows = parseCSV(text);
  if (rows.length === 0) return [];
  const header = rows[0].map((h) => h.trim());
  const objects: Array<Record<string, string>> = [];
  for (let i = 1; i < rows.length; i++) {
    const raw = rows[i];
    if (raw.length === 1 && raw[0].trim() === '') continue;
    const obj: Record<string, string> = {};
    header.forEach((h, idx) => {
      if (h) obj[h] = (raw[idx] ?? '').trim();
    });
    objects.push(obj);
  }
  return objects;
}

export function field(row: Record<string, string>, name: string): string {
  if (name in row) return row[name];
  const lower = name.toLowerCase();
  const key = Object.keys(row).find((k) => k.toLowerCase() === lower);
  return key ? row[key] : '';
}
