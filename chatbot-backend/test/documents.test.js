import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildTransportDocument, buildMonthlyKpiDocuments, buildGlobalSummaryDocument } from '../src/lib/documents.js'

test('buildTransportDocument includes key transport fields and its objects', () => {
  const transport = {
    TR_NUMBER: 'A30K000618', OWNER: 'SAP', STATUS: 'WARNING', DELAY: '5',
    RISK_SCORE: '35', RISK_LEVEL: 'MEDIUM', CREATION_DATE: '19951124',
    IMPORT_DEV_DATE: '19951124', IMPORT_QA_DATE: '19951126', IMPORT_PRD_DATE: '19951129',
  }
  const objects = [{ OBJ_TYPE: 'MERG', OBJ_NAME: 'X', RISK_LEVEL: 'LOW', RISK_SCORE: '5' }]
  const doc = buildTransportDocument(transport, objects)
  assert.match(doc, /Transport A30K000618/)
  assert.match(doc, /Statut : WARNING/)
  assert.match(doc, /MERG X \(risque LOW, score 5\)/)
})

test('buildTransportDocument handles a transport with no objects', () => {
  const transport = {
    TR_NUMBER: 'X', OWNER: 'SAP', STATUS: 'SUCCESS', DELAY: '1',
    RISK_SCORE: '5', RISK_LEVEL: 'LOW', CREATION_DATE: '20260101',
    IMPORT_DEV_DATE: '20260101', IMPORT_QA_DATE: '20260102', IMPORT_PRD_DATE: '20260103',
  }
  const doc = buildTransportDocument(transport, [])
  assert.match(doc, /aucun objet enregistré/)
})

test('buildMonthlyKpiDocuments aggregates transports by creation month', () => {
  const transports = [
    { CREATION_DATE: '20260701', STATUS: 'SUCCESS', DELAY: '2', RISK_LEVEL: 'LOW' },
    { CREATION_DATE: '20260715', STATUS: 'FAILED', DELAY: '10', RISK_LEVEL: 'HIGH' },
    { CREATION_DATE: '20260801', STATUS: 'SUCCESS', DELAY: '4', RISK_LEVEL: 'MEDIUM' },
  ]
  const docs = buildMonthlyKpiDocuments(transports)
  assert.equal(docs.length, 2)
  const july = docs.find((doc) => doc.month === '202607')
  assert.match(july.text, /Nombre de transports : 2/)
  assert.match(july.text, /Taux d'échec : 50%/)
  assert.match(july.text, /Délai moyen : 6 jours/)
  assert.equal(july.id, 'kpi-202607')
})

test('buildMonthlyKpiDocuments skips rows with no creation date', () => {
  const docs = buildMonthlyKpiDocuments([{ CREATION_DATE: '', STATUS: 'SUCCESS', DELAY: '1', RISK_LEVEL: 'LOW' }])
  assert.equal(docs.length, 0)
})

test('buildGlobalSummaryDocument aggregates across all transports, all months', () => {
  const transports = [
    { CREATION_DATE: '20260701', STATUS: 'SUCCESS', DELAY: '2', RISK_LEVEL: 'LOW' },
    { CREATION_DATE: '20260715', STATUS: 'FAILED', DELAY: '10', RISK_LEVEL: 'HIGH' },
    { CREATION_DATE: '20260801', STATUS: 'FAILED', DELAY: '4', RISK_LEVEL: 'MEDIUM' },
  ]
  const doc = buildGlobalSummaryDocument(transports)
  assert.equal(doc.id, 'kpi-global')
  assert.match(doc.text, /Nombre total de transports : 3/)
  assert.match(doc.text, /Transports en échec \(FAILED\) au total : 2/)
  assert.match(doc.text, /Nombre de mois distincts couverts : 2/)
})
