import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseCsv, formatSapDate } from '../src/lib/csv.js'

test('parseCsv parses semicolon-delimited rows into objects', () => {
  const csv = 'TR_NUMBER;OWNER;STATUS\nA30K000618;SAP;WARNING\nA30K002401;SAP;FAILED'
  const rows = parseCsv(csv)
  assert.equal(rows.length, 2)
  assert.deepEqual(rows[0], { TR_NUMBER: 'A30K000618', OWNER: 'SAP', STATUS: 'WARNING' })
  assert.deepEqual(rows[1], { TR_NUMBER: 'A30K002401', OWNER: 'SAP', STATUS: 'FAILED' })
})

test('parseCsv returns an empty array for empty input', () => {
  assert.deepEqual(parseCsv(''), [])
})

test('parseCsv handles Windows line endings', () => {
  const csv = 'A;B\r\n1;2\r\n'
  assert.deepEqual(parseCsv(csv), [{ A: '1', B: '2' }])
})

test('formatSapDate converts YYYYMMDD into YYYY-MM-DD', () => {
  assert.equal(formatSapDate('19951124'), '1995-11-24')
})

test('formatSapDate returns the input unchanged when malformed', () => {
  assert.equal(formatSapDate(''), '')
  assert.equal(formatSapDate('2026'), '2026')
})
