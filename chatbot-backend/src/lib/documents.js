import { formatSapDate } from './csv.js'

export function buildTransportDocument(transport, objects) {
  const objectLines = objects.length > 0
    ? objects
        .map((obj) => `  - ${obj.OBJ_TYPE} ${obj.OBJ_NAME} (risque ${obj.RISK_LEVEL}, score ${obj.RISK_SCORE})`)
        .join('\n')
    : '  (aucun objet enregistré)'

  return [
    `Transport ${transport.TR_NUMBER}`,
    `Propriétaire : ${transport.OWNER}`,
    `Statut : ${transport.STATUS}`,
    `Délai : ${transport.DELAY} jours`,
    `Score de risque : ${transport.RISK_SCORE} (niveau ${transport.RISK_LEVEL})`,
    `Date de création : ${formatSapDate(transport.CREATION_DATE)}`,
    `Import DEV : ${formatSapDate(transport.IMPORT_DEV_DATE)}`,
    `Import QA : ${formatSapDate(transport.IMPORT_QA_DATE)}`,
    `Import PRD : ${formatSapDate(transport.IMPORT_PRD_DATE)}`,
    'Objets contenus :',
    objectLines,
  ].join('\n')
}

function summarizeTransports(rows) {
  const total = rows.length
  const failed = rows.filter((row) => row.STATUS === 'FAILED').length
  const failureRate = total > 0 ? Math.round((failed / total) * 1000) / 10 : 0
  const avgDelay = total > 0
    ? Math.round((rows.reduce((sum, row) => sum + Number(row.DELAY || 0), 0) / total) * 10) / 10
    : 0
  const highRisk = rows.filter((row) => row.RISK_LEVEL === 'HIGH').length
  return { total, failed, failureRate, avgDelay, highRisk }
}

export function buildMonthlyKpiDocuments(transports) {
  const byMonth = new Map()

  for (const transport of transports) {
    const month = transport.CREATION_DATE ? transport.CREATION_DATE.slice(0, 6) : ''
    if (month.length !== 6) continue
    if (!byMonth.has(month)) byMonth.set(month, [])
    byMonth.get(month).push(transport)
  }

  return Array.from(byMonth.entries()).map(([month, rows]) => {
    const { total, failed, failureRate, avgDelay, highRisk } = summarizeTransports(rows)
    const year = month.slice(0, 4)
    const monthNum = month.slice(4, 6)

    const text = [
      `Résumé mensuel ${year}-${monthNum}`,
      `Nombre de transports : ${total}`,
      `Transports en échec (FAILED) : ${failed}`,
      `Taux d'échec : ${failureRate}%`,
      `Délai moyen : ${avgDelay} jours`,
      `Transports à risque élevé (HIGH) : ${highRisk}`,
    ].join('\n')

    return { id: `kpi-${month}`, month, text }
  })
}

export function extractTransportIds(question) {
  const tokens = question.toUpperCase().match(/[A-Z0-9-]{6,}/g) || []
  return tokens.filter((token) => /[0-9]/.test(token) && /[A-Z]/.test(token))
}

export const GLOBAL_SUMMARY_ID = 'kpi-global'

export function buildGlobalSummaryDocument(transports) {
  const { total, failed, failureRate, avgDelay, highRisk } = summarizeTransports(transports)
  const monthCount = new Set(
    transports.map((row) => (row.CREATION_DATE ? row.CREATION_DATE.slice(0, 6) : '')).filter((m) => m.length === 6),
  ).size

  const text = [
    'Résumé global (tous les transports, toutes périodes confondues)',
    `Nombre total de transports : ${total}`,
    `Transports en échec (FAILED) au total : ${failed}`,
    `Taux d'échec global : ${failureRate}%`,
    `Délai moyen global : ${avgDelay} jours`,
    `Transports à risque élevé (HIGH) au total : ${highRisk}`,
    `Nombre de mois distincts couverts : ${monthCount}`,
  ].join('\n')

  return { id: GLOBAL_SUMMARY_ID, text }
}
