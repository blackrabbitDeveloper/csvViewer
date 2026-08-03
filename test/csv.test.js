import test from 'node:test';
import assert from 'node:assert/strict';
import { compareCells, detectDelimiter, encodeCSV, filterRows, inferColumnType, matchesFilter, normalizeTable, parseCSV } from '../js/csv.js';

test('detects common delimiters', () => {
  assert.equal(detectDelimiter('a,b,c\n1,2,3'), ',');
  assert.equal(detectDelimiter('a\tb\tc\n1\t2\t3'), '\t');
  assert.equal(detectDelimiter('a;b;c\n1;2;3'), ';');
});
test('parses quoted delimiters, line breaks and escaped quotes', () => {
  assert.deepEqual(parseCSV('name,note\r\nRabbit,"hello,\n""world"""'), [['name', 'note'], ['Rabbit', 'hello,\n"world"']]);
});
test('normalizes duplicate and missing headers and uneven rows', () => {
  assert.deepEqual(normalizeTable([['id', 'id', ''], ['1']]), { headers: ['id', 'id (2)', 'Column 3'], rows: [['1', '', '']] });
});
test('encodes values safely and sorts numbers naturally', () => {
  assert.equal(encodeCSV(['a'], [['x,y'], ['say "hi"']]), 'a\r\n"x,y"\r\n"say ""hi"""');
  assert.ok(compareCells('2', '10') < 0);
});
test('infers numeric, date and text columns', () => {
  const rows = [['1,200', '2026-08-01', '서울'], ['950', '2026-08-02', '부산']];
  assert.equal(inferColumnType(rows, 0), 'number');
  assert.equal(inferColumnType(rows, 1), 'date');
  assert.equal(inferColumnType(rows, 2), 'text');
});
test('matches type-aware filters', () => {
  const row = ['Black Rabbit', '1,250', '2026-08-03', ''];
  assert.equal(matchesFilter(row, { column: 0, type: 'text', operator: 'contains', value: 'rabbit' }), true);
  assert.equal(matchesFilter(row, { column: 1, type: 'number', operator: 'between', value: '1000', value2: '1300' }), true);
  assert.equal(matchesFilter(row, { column: 2, type: 'date', operator: 'after', value: '2026-08-01' }), true);
  assert.equal(matchesFilter(row, { column: 3, type: 'text', operator: 'empty' }), true);
});
test('combines multiple filters with AND', () => {
  const rows = [['서울', '15'], ['서울', '5'], ['부산', '20']];
  const filters = [{ column: 0, type: 'text', operator: 'eq', value: '서울' }, { column: 1, type: 'number', operator: 'gte', value: '10' }];
  assert.deepEqual(filterRows(rows, filters), [['서울', '15']]);
});
