import test from 'node:test';
import assert from 'node:assert/strict';
import { compareCells, detectDelimiter, encodeCSV, normalizeTable, parseCSV } from '../js/csv.js';

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
