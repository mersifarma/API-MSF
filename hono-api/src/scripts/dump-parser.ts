/**
 * Parser untuk mysqldump file (legacy MariaDB → JS rows).
 *
 * Format yang di-handle:
 *   INSERT INTO `table` (`col1`, `col2`, ...) VALUES
 *     (val1, val2, ...),
 *     (val1, val2, ...),
 *     ...;
 *
 * Quirks:
 *   - Identifier backticks dihilangkan saat ekstrak nama kolom.
 *   - String literal pakai MySQL-style escape: \\, \', \", \n, \r, \t, \0, dan '' (doubled).
 *   - `NULL` keyword (case-insensitive) → JS null.
 *   - `'0000-00-00'` dan `'0000-00-00 00:00:00'` → JS null (Postgres reject these).
 *   - Multi-INSERT dalam satu file di-handle (mysqldump chunk).
 *   - `LOCK TABLES`, `UNLOCK TABLES`, `/*!40000 ...` di-skip otomatis (di luar INSERT block).
 *
 * Bukan tujuan: parse CREATE TABLE, ALTER TABLE, atau DDL lain. Hanya extract data rows.
 */

export type Row = Record<string, unknown>;

export interface ParseResult {
  /** Nama tabel dari INSERT INTO `name` (single — kalau multi-INSERT di file yang sama, semua harus untuk tabel yang sama). */
  table: string;
  /** Daftar nama kolom sesuai urutan di INSERT INTO header. */
  columns: string[];
  /** Total rows yang di-parse dari semua INSERT statements di file. */
  rows: Row[];
}

const ZERO_DATE_PATTERN = /^0000-00-00( 00:00:00(\.\d+)?)?$/;

/**
 * Parse satu file dump menjadi list of rows.
 *
 * @param content Isi file `.sql` (full read, bukan stream — OK untuk file <100 MB)
 * @returns table name, column list, dan parsed rows
 */
export function parseDump(content: string): ParseResult {
  let tableName = '';
  let columns: string[] = [];
  const allRows: Row[] = [];

  // Iterate over all INSERT INTO ... VALUES occurrences (mysqldump may chunk).
  // Pakai while-loop dengan index sehingga bisa lanjut dari posisi terakhir.
  let cursor = 0;
  const HEADER_RE = /INSERT INTO `([^`]+)` \(([^)]+)\) VALUES/g;

  while (cursor < content.length) {
    HEADER_RE.lastIndex = cursor;
    const headerMatch = HEADER_RE.exec(content);
    if (!headerMatch) break;

    const matchedTable = headerMatch[1];
    const matchedCols = headerMatch[2].split(',').map((c) => c.trim().replace(/^`|`$/g, ''));

    if (!tableName) {
      tableName = matchedTable;
      columns = matchedCols;
    } else if (tableName !== matchedTable) {
      throw new Error(
        `Dump file mixes tables: started with "${tableName}", encountered "${matchedTable}"`,
      );
    }
    // Asumsi: kolom konsisten antar chunk INSERT (mysqldump selalu emit header sama).

    // Mulai parse tuples setelah `VALUES`.
    const i = headerMatch.index + headerMatch[0].length;
    const { rows, nextIndex } = parseTuples(content, i, columns.length);
    allRows.push(...rows);
    cursor = nextIndex;
  }

  if (!tableName) {
    throw new Error('No INSERT INTO statement found in dump');
  }

  // Map array values to column-keyed objects, applying zero-date → null transform.
  const rows: Row[] = allRows.map((arr) => {
    const row: Row = {};
    columns.forEach((col, idx) => {
      const val = (arr as unknown as unknown[])[idx];
      row[col] = typeof val === 'string' && ZERO_DATE_PATTERN.test(val) ? null : val;
    });
    return row;
  });

  return { table: tableName, columns, rows };
}

/**
 * Parse VALUES section setelah `INSERT INTO ... VALUES`.
 *
 * Returns array of tuples (each tuple = array of cell values) dan index akhir
 * (posisi setelah `;`).
 */
function parseTuples(
  content: string,
  start: number,
  expectedColCount: number,
): { rows: Row[]; nextIndex: number } {
  const rows: Row[] = [];
  let i = start;

  while (i < content.length) {
    // Skip whitespace + comments (single-line `--` and inline `/* */`).
    i = skipWhitespaceAndComments(content, i);

    const ch = content[i];
    if (ch === ';') return { rows, nextIndex: i + 1 };
    if (ch === ',') {
      i++;
      continue;
    }
    if (ch !== '(') {
      throw new Error(
        `Unexpected char '${ch}' at offset ${i} (expected '(', ',', or ';'). Context: "${content.substring(Math.max(0, i - 20), i + 20)}"`,
      );
    }

    i++; // consume '('
    const tuple: unknown[] = [];

    while (i < content.length) {
      i = skipWhitespaceAndComments(content, i);
      if (content[i] === ')') {
        i++;
        break;
      }
      if (content[i] === ',') {
        i++;
        continue;
      }
      const { value, nextIndex } = parseValue(content, i);
      tuple.push(value);
      i = nextIndex;
    }

    if (tuple.length !== expectedColCount) {
      throw new Error(
        `Tuple length mismatch: expected ${expectedColCount}, got ${tuple.length}. Context: "${content.substring(Math.max(0, i - 40), i)}"`,
      );
    }
    rows.push(tuple as unknown as Row);
  }

  return { rows, nextIndex: i };
}

function skipWhitespaceAndComments(content: string, i: number): number {
  while (i < content.length) {
    const ch = content[i];
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
      i++;
      continue;
    }
    // Single-line comment: '-- ...' until newline.
    if (ch === '-' && content[i + 1] === '-') {
      while (i < content.length && content[i] !== '\n') i++;
      continue;
    }
    // Block comment: /* ... */
    if (ch === '/' && content[i + 1] === '*') {
      i += 2;
      while (i < content.length && !(content[i] === '*' && content[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
    break;
  }
  return i;
}

function parseValue(content: string, start: number): { value: unknown; nextIndex: number } {
  const ch = content[start];

  // String literal
  if (ch === "'") {
    let i = start + 1;
    let str = '';
    while (i < content.length) {
      const c = content[i];
      if (c === '\\') {
        const next = content[i + 1];
        switch (next) {
          case 'n':
            str += '\n';
            break;
          case 'r':
            str += '\r';
            break;
          case 't':
            str += '\t';
            break;
          case '0':
            str += '\0';
            break;
          case 'Z':
            str += '\x1a';
            break;
          case '\\':
            str += '\\';
            break;
          case "'":
            str += "'";
            break;
          case '"':
            str += '"';
            break;
          default:
            // Unknown escape: keep next char as-is (MySQL behavior).
            str += next ?? '';
        }
        i += 2;
      } else if (c === "'") {
        // Possible end OR doubled '' = literal '
        if (content[i + 1] === "'") {
          str += "'";
          i += 2;
        } else {
          return { value: str, nextIndex: i + 1 };
        }
      } else {
        str += c;
        i++;
      }
    }
    throw new Error(`Unterminated string starting at offset ${start}`);
  }

  // NULL keyword (case-insensitive)
  const upper4 = content.substring(start, start + 4).toUpperCase();
  if (upper4 === 'NULL') {
    return { value: null, nextIndex: start + 4 };
  }

  // Numeric literal — read until terminator (',' or ')')
  let i = start;
  while (
    i < content.length &&
    content[i] !== ',' &&
    content[i] !== ')' &&
    content[i] !== ' ' &&
    content[i] !== '\t' &&
    content[i] !== '\n' &&
    content[i] !== '\r'
  ) {
    i++;
  }
  const raw = content.substring(start, i).trim();
  if (raw === '') {
    throw new Error(`Empty value at offset ${start}`);
  }
  // Don't convert here — let the orchestrator coerce based on column type.
  // Why: phone-number-like strings (e.g. '085725374881') would lose leading zero.
  // For unquoted numerics, Number() conversion is safe; for quoted strings we kept them as strings already.
  const asNumber = Number(raw);
  return {
    value: Number.isFinite(asNumber) && /^-?\d+(\.\d+)?$/.test(raw) ? asNumber : raw,
    nextIndex: i,
  };
}
