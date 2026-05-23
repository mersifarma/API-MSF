import { describe, expect, it } from 'bun:test';
import { parseDump } from '../../src/scripts/dump-parser';

describe('parseDump', () => {
  it('parses a basic single-INSERT dump', () => {
    const sql = `
DROP TABLE IF EXISTS \`foo\`;
CREATE TABLE \`foo\` ( \`id\` int(11), \`name\` varchar(50) );
LOCK TABLES \`foo\` WRITE;
INSERT INTO \`foo\` (\`id\`, \`name\`) VALUES
  (1, 'Alice'),
  (2, 'Bob');
UNLOCK TABLES;
`;
    const { table, columns, rows } = parseDump(sql);
    expect(table).toBe('foo');
    expect(columns).toEqual(['id', 'name']);
    expect(rows).toEqual([
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
    ]);
  });

  it('handles NULL keyword', () => {
    const sql = `
INSERT INTO \`foo\` (\`id\`, \`note\`) VALUES
  (1, NULL),
  (2, 'has note');
`;
    const { rows } = parseDump(sql);
    expect(rows).toEqual([
      { id: 1, note: null },
      { id: 2, note: 'has note' },
    ]);
  });

  it('handles MySQL escape sequences in strings', () => {
    const sql = `
INSERT INTO \`foo\` (\`id\`, \`val\`) VALUES
  (1, 'O\\'Brien'),
  (2, 'line1\\nline2'),
  (3, 'back\\\\slash');
`;
    const { rows } = parseDump(sql);
    expect(rows[0].val).toBe("O'Brien");
    expect(rows[1].val).toBe('line1\nline2');
    expect(rows[2].val).toBe('back\\slash');
  });

  it('converts 0000-00-00 dates to null', () => {
    const sql = `
INSERT INTO \`foo\` (\`id\`, \`tgl\`, \`ts\`) VALUES
  (1, '0000-00-00', '0000-00-00 00:00:00'),
  (2, '2026-01-15', '2026-01-15 10:30:00');
`;
    const { rows } = parseDump(sql);
    expect(rows[0]).toEqual({ id: 1, tgl: null, ts: null });
    expect(rows[1]).toEqual({ id: 2, tgl: '2026-01-15', ts: '2026-01-15 10:30:00' });
  });

  it('preserves quoted numeric strings (phone numbers with leading zero)', () => {
    const sql = `
INSERT INTO \`foo\` (\`id\`, \`phone\`) VALUES
  (1, '085725374881');
`;
    const { rows } = parseDump(sql);
    // Parser must NOT lose the leading zero — coercion is orchestrator's job.
    expect(rows[0].phone).toBe('085725374881');
  });

  it('handles multi-INSERT chunked dump', () => {
    const sql = `
INSERT INTO \`foo\` (\`id\`, \`name\`) VALUES
  (1, 'Alice'),
  (2, 'Bob');
INSERT INTO \`foo\` (\`id\`, \`name\`) VALUES
  (3, 'Carol');
`;
    const { rows } = parseDump(sql);
    expect(rows.length).toBe(3);
    expect(rows.map((r) => r.id)).toEqual([1, 2, 3]);
  });

  it('rejects mixed-table dumps', () => {
    const sql = `
INSERT INTO \`foo\` (\`id\`) VALUES (1);
INSERT INTO \`bar\` (\`id\`) VALUES (1);
`;
    expect(() => parseDump(sql)).toThrow(/mixes tables/);
  });

  it("handles doubled single quotes as literal apostrophe", () => {
    const sql = `INSERT INTO \`foo\` (\`val\`) VALUES ('it''s fine');`;
    const { rows } = parseDump(sql);
    expect(rows[0].val).toBe("it's fine");
  });

  it('handles negative numbers and decimals', () => {
    const sql = `INSERT INTO \`foo\` (\`a\`, \`b\`) VALUES (-5, 3.14);`;
    const { rows } = parseDump(sql);
    expect(rows[0]).toEqual({ a: -5, b: 3.14 });
  });

  it('handles real legacy fragment with bcrypt $2y$ hash', () => {
    const sql = `
INSERT INTO \`users\` (\`id\`, \`name\`, \`password\`, \`created_at\`) VALUES
  ('2', 'Bella Maulana Yusup', '$2y$12$zfkqiRBX2.4YZMyc56jZLuGGNzgo7SJRbk2Iuh0GDsnaiJWqvUXGO', '0000-00-00 00:00:00');
`;
    const { rows } = parseDump(sql);
    expect(rows[0]).toEqual({
      id: '2', // string — orchestrator coerces based on column type
      name: 'Bella Maulana Yusup',
      password: '$2y$12$zfkqiRBX2.4YZMyc56jZLuGGNzgo7SJRbk2Iuh0GDsnaiJWqvUXGO',
      created_at: null,
    });
  });
});
