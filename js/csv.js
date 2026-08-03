export function detectDelimiter(text) {
  const candidates = [',', '\t', ';', '|'];
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim()).slice(0, 12);
  let best = { delimiter: ',', score: -Infinity };
  for (const delimiter of candidates) {
    const counts = lines.map((line) => countOutsideQuotes(line, delimiter));
    const positive = counts.filter(Boolean);
    if (!positive.length) continue;
    const mode = positive.sort((a, b) => positive.filter((n) => n === b).length - positive.filter((n) => n === a).length)[0];
    const score = positive.filter((n) => n === mode).length * 10 + mode - (lines.length - positive.length) * 5;
    if (score > best.score) best = { delimiter, score };
  }
  return best.delimiter;
}

function countOutsideQuotes(line, delimiter) {
  let count = 0; let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    if (line[i] === '"') {
      if (quoted && line[i + 1] === '"') i += 1;
      else quoted = !quoted;
    } else if (!quoted && line[i] === delimiter) count += 1;
  }
  return count;
}

export function parseCSV(text, delimiter = detectDelimiter(text)) {
  const rows = []; let row = []; let field = ''; let quoted = false;
  const source = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') { field += '"'; i += 1; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"' && field === '') quoted = true;
    else if (char === delimiter) { row.push(field); field = ''; }
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && source[i + 1] === '\n') i += 1;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += char;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  while (rows.length && rows.at(-1).every((cell) => cell === '')) rows.pop();
  return rows;
}

export function normalizeTable(rows, firstRowHeader = true) {
  if (!rows.length) return { headers: [], rows: [] };
  const width = Math.max(...rows.map((row) => row.length));
  const rawHeaders = firstRowHeader ? rows[0] : Array.from({ length: width }, (_, i) => `Column ${i + 1}`);
  const seen = new Map();
  const headers = Array.from({ length: width }, (_, i) => {
    const base = String(rawHeaders[i] ?? '').trim() || `Column ${i + 1}`;
    const count = (seen.get(base) || 0) + 1; seen.set(base, count);
    return count === 1 ? base : `${base} (${count})`;
  });
  const data = (firstRowHeader ? rows.slice(1) : rows).map((row) => Array.from({ length: width }, (_, i) => row[i] ?? ''));
  return { headers, rows: data };
}

export function encodeCSV(headers, rows, delimiter = ',') {
  const quote = (value) => {
    const text = String(value ?? '');
    return text.includes(delimiter) || /["\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  return [headers, ...rows].map((row) => row.map(quote).join(delimiter)).join('\r\n');
}

export function compareCells(a, b) {
  const left = String(a).trim(); const right = String(b).trim();
  if (left === right) return 0;
  const ln = Number(left.replaceAll(',', '')); const rn = Number(right.replaceAll(',', ''));
  if (left && right && Number.isFinite(ln) && Number.isFinite(rn)) return ln - rn;
  return left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' });
}
