import 'dotenv/config'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { parseCsv } from './lib/csv.js'
import { buildTransportDocument, buildMonthlyKpiDocuments } from './lib/documents.js'
import { embedTexts } from './lib/openaiClient.js'
import { ensureIndex } from './lib/pineconeClient.js'

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data')
const BATCH_SIZE = 50

async function loadCsv(filename) {
  const filePath = path.join(DATA_DIR, filename)
  const text = await readFile(filePath, 'utf-8')
  return parseCsv(text)
}

function chunk(array, size) {
  const chunks = []
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size))
  }
  return chunks
}

async function upsertDocuments(index, namespace, documents) {
  for (const batch of chunk(documents, BATCH_SIZE)) {
    const embeddings = await embedTexts(batch.map((doc) => doc.text))
    const vectors = batch.map((doc, i) => ({
      id: doc.id,
      values: embeddings[i],
      metadata: { ...doc.metadata, text: doc.text },
    }))
    await index.namespace(namespace).upsert(vectors)
    console.log(`  upserted ${vectors.length} vectors into "${namespace}"`)
  }
}

async function main() {
  console.log('Reading CSV exports from', DATA_DIR)
  const transports = await loadCsv('ZTR_TRANSPORT.csv')
  const objects = await loadCsv('ZTR_OBJECTS.csv')
  console.log(`Loaded ${transports.length} transports, ${objects.length} objects`)

  const objectsByTransport = new Map()
  for (const obj of objects) {
    const list = objectsByTransport.get(obj.TR_NUMBER) || []
    list.push(obj)
    objectsByTransport.set(obj.TR_NUMBER, list)
  }

  const transportDocs = transports.map((transport) => ({
    id: `transport-${transport.TR_NUMBER}`,
    text: buildTransportDocument(transport, objectsByTransport.get(transport.TR_NUMBER) || []),
    metadata: {
      tr_number: transport.TR_NUMBER,
      status: transport.STATUS,
      risk_level: transport.RISK_LEVEL,
    },
  }))

  const kpiDocs = buildMonthlyKpiDocuments(transports).map((doc) => ({
    id: doc.id,
    text: doc.text,
    metadata: { month: doc.month },
  }))

  console.log(`Built ${transportDocs.length} transport documents, ${kpiDocs.length} monthly KPI documents`)

  const indexName = process.env.PINECONE_INDEX
  if (!indexName) throw new Error('PINECONE_INDEX is not set')
  const index = await ensureIndex(indexName)

  console.log('Upserting transport documents...')
  await upsertDocuments(index, 'transports', transportDocs)

  console.log('Upserting monthly KPI documents...')
  await upsertDocuments(index, 'kpi_monthly', kpiDocs)

  console.log('Ingestion complete.')
}

main().catch((error) => {
  console.error('Ingestion failed:', error)
  process.exit(1)
})
