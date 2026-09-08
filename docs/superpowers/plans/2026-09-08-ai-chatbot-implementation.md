# Chatbot IA (RAG) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a floating chatbot to the SAP Transport Management Analytics website that answers visitor questions using only the real transport/KPI CSV data, via OpenAI + Pinecone.

**Architecture:** A new `chatbot-backend/` Express service (deployed separately on Render) owns the OpenAI/Pinecone API keys. A one-time `ingest.js` script reads the existing `ZTR_TRANSPORT.csv`/`ZTR_OBJECTS.csv` exports, builds a text "fiche" per transport plus a computed monthly KPI summary per month, embeds them, and upserts them into two Pinecone namespaces. The Express server exposes `POST /api/chat`, which embeds the visitor's question, retrieves the closest matches from both namespaces, and asks OpenAI to answer strictly from that retrieved context. A new `ChatWidget.jsx` component (floating bubble, mounted in `App.jsx`) talks to this backend over HTTP.

**Tech Stack:** Node.js + Express, `openai` SDK (`text-embedding-3-small`, `gpt-4o-mini`), `@pinecone-database/pinecone`, `express-rate-limit`, `cors`, `dotenv`. Frontend: React 19 (existing site), plain CSS using the site's existing CSS variables. Tests: built-in `node:test`.

**Reference:** Design spec at `docs/superpowers/specs/2026-09-08-ai-chatbot-design.md`.

**Known CSV schemas (source of truth for all code below):**
- `ZTR_TRANSPORT.csv` (`;`-delimited): `TR_NUMBER;OWNER;CREATION_DATE;IMPORT_DEV_DATE;IMPORT_QA_DATE;IMPORT_PRD_DATE;STATUS;DELAY;RISK_SCORE;RISK_LEVEL` — dates as `YYYYMMDD`.
- `ZTR_OBJECTS.csv` (`;`-delimited): `TR_NUMBER;OBJ_TYPE;OBJ_NAME;RISK_LEVEL;RISK_SCORE`.
- There is no `ZTR_KPI.csv` export available locally — monthly KPI summaries are **computed** from `ZTR_TRANSPORT.csv` by the ingestion script (grouping by `CREATION_DATE` month), the same way the Power BI DAX measures already do it.

---

## Task 1: Backend project scaffold

**Files:**
- Create: `chatbot-backend/package.json`
- Create: `chatbot-backend/.env.example`
- Create: `chatbot-backend/.gitignore`
- Create: `chatbot-backend/data/.gitkeep`
- Create: `chatbot-backend/README.md`
- Modify: `.gitignore:11` (repo root, add `.env` patterns)

- [ ] **Step 1: Create the backend folder and package.json**

Create `chatbot-backend/package.json`:

```json
{
  "name": "chatbot-backend",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "start": "node src/server.js",
    "ingest": "node src/ingest.js",
    "test": "node --test test/"
  },
  "dependencies": {
    "@pinecone-database/pinecone": "^3.0.3",
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.21.1",
    "express-rate-limit": "^7.4.1",
    "openai": "^4.73.0"
  }
}
```

- [ ] **Step 2: Create the env example file**

Create `chatbot-backend/.env.example`:

```
OPENAI_API_KEY=sk-...
PINECONE_API_KEY=...
PINECONE_INDEX=sap-transport-chatbot
# The site's GitHub Pages URL, e.g. https://<your-username>.github.io/sap-transport-analytics
ALLOWED_ORIGIN=
PORT=3000
```

- [ ] **Step 3: Create the backend .gitignore**

Create `chatbot-backend/.gitignore`:

```
node_modules
.env
data/*.csv
```

- [ ] **Step 4: Create the data folder placeholder**

Create `chatbot-backend/data/.gitkeep` (empty file). This folder is where the two CSV
exports get copied before running ingestion (Task 8) — the CSVs themselves are gitignored
by Step 3.

- [ ] **Step 5: Create a short backend README**

Create `chatbot-backend/README.md`:

```markdown
# Chatbot backend

Express API that answers questions about SAP transport/KPI data, using OpenAI (embeddings +
chat) and Pinecone (vector search). See `docs/superpowers/specs/2026-09-08-ai-chatbot-design.md`
at the repo root for the full design.

## Local setup

1. `npm install`
2. Copy `.env.example` to `.env` and fill in your real API keys.
3. Copy `ZTR_TRANSPORT.csv` and `ZTR_OBJECTS.csv` into `data/`.
4. `npm run ingest` — builds the Pinecone index and uploads the data (run once, or again
   whenever the CSVs are re-exported from SAP).
5. `npm start` — runs the API on `http://localhost:3000`.
6. `npm test` — runs the unit tests (no API keys needed).
```

- [ ] **Step 6: Ignore local env files at the repo root too**

In `.gitignore` (repo root), after line 13 (`*.local`), add:

```
.env
.env.production
```

- [ ] **Step 7: Install dependencies**

Run: `cd chatbot-backend && npm install`
Expected: `node_modules/` created, `package-lock.json` created, no errors.

- [ ] **Step 8: Commit**

```bash
git add chatbot-backend/package.json chatbot-backend/package-lock.json chatbot-backend/.env.example chatbot-backend/.gitignore chatbot-backend/data/.gitkeep chatbot-backend/README.md .gitignore
git commit -m "chore: scaffold chatbot-backend project"
```

---

## Task 2: CSV parsing utility

**Files:**
- Create: `chatbot-backend/src/lib/csv.js`
- Test: `chatbot-backend/test/csv.test.js`

- [ ] **Step 1: Write the failing tests**

Create `chatbot-backend/test/csv.test.js`:

```js
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd chatbot-backend && npm test`
Expected: FAIL — `Cannot find module '../src/lib/csv.js'`

- [ ] **Step 3: Write the implementation**

Create `chatbot-backend/src/lib/csv.js`:

```js
export function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((line) => line.length > 0)
  if (lines.length === 0) return []
  const headers = lines[0].split(';')
  return lines.slice(1).map((line) => {
    const values = line.split(';')
    const row = {}
    headers.forEach((header, index) => {
      row[header] = values[index]
    })
    return row
  })
}

export function formatSapDate(yyyymmdd) {
  if (!yyyymmdd || yyyymmdd.length !== 8) return yyyymmdd
  const year = yyyymmdd.slice(0, 4)
  const month = yyyymmdd.slice(4, 6)
  const day = yyyymmdd.slice(6, 8)
  return `${year}-${month}-${day}`
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd chatbot-backend && npm test`
Expected: PASS — 5 tests passing

- [ ] **Step 5: Commit**

```bash
git add chatbot-backend/src/lib/csv.js chatbot-backend/test/csv.test.js
git commit -m "feat(chatbot-backend): add CSV parsing utility"
```

---

## Task 3: Document-building utilities (transport fiches + monthly KPI summaries)

**Files:**
- Create: `chatbot-backend/src/lib/documents.js`
- Test: `chatbot-backend/test/documents.test.js`

- [ ] **Step 1: Write the failing tests**

Create `chatbot-backend/test/documents.test.js`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildTransportDocument, buildMonthlyKpiDocuments } from '../src/lib/documents.js'

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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd chatbot-backend && npm test`
Expected: FAIL — `Cannot find module '../src/lib/documents.js'`

- [ ] **Step 3: Write the implementation**

Create `chatbot-backend/src/lib/documents.js`:

```js
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

export function buildMonthlyKpiDocuments(transports) {
  const byMonth = new Map()

  for (const transport of transports) {
    const month = transport.CREATION_DATE ? transport.CREATION_DATE.slice(0, 6) : ''
    if (month.length !== 6) continue
    if (!byMonth.has(month)) byMonth.set(month, [])
    byMonth.get(month).push(transport)
  }

  return Array.from(byMonth.entries()).map(([month, rows]) => {
    const total = rows.length
    const failed = rows.filter((row) => row.STATUS === 'FAILED').length
    const failureRate = total > 0 ? Math.round((failed / total) * 1000) / 10 : 0
    const avgDelay = total > 0
      ? Math.round((rows.reduce((sum, row) => sum + Number(row.DELAY || 0), 0) / total) * 10) / 10
      : 0
    const highRisk = rows.filter((row) => row.RISK_LEVEL === 'HIGH').length
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd chatbot-backend && npm test`
Expected: PASS — 9 tests passing total (5 from Task 2 + 4 here)

- [ ] **Step 5: Commit**

```bash
git add chatbot-backend/src/lib/documents.js chatbot-backend/test/documents.test.js
git commit -m "feat(chatbot-backend): add transport/KPI document builders"
```

---

## Task 4: OpenAI client wrapper

**Files:**
- Create: `chatbot-backend/src/lib/openaiClient.js`

No automated tests here — this module only wraps network calls to the OpenAI API, which
requires a real API key and costs money per call. It's exercised manually in Task 8/9.

- [ ] **Step 1: Write the implementation**

Create `chatbot-backend/src/lib/openaiClient.js`:

```js
import OpenAI from 'openai'

export const EMBEDDING_MODEL = 'text-embedding-3-small'
export const EMBEDDING_DIMENSION = 1536
const CHAT_MODEL = 'gpt-4o-mini'

let client

function getClient() {
  if (!client) {
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  }
  return client
}

export async function embedText(text) {
  const response = await getClient().embeddings.create({
    model: EMBEDDING_MODEL,
    input: text,
  })
  return response.data[0].embedding
}

export async function embedTexts(texts) {
  const response = await getClient().embeddings.create({
    model: EMBEDDING_MODEL,
    input: texts,
  })
  return response.data.map((item) => item.embedding)
}

const SYSTEM_PROMPT = [
  "Tu es l'assistant du tableau de bord SAP Transport Management Analytics.",
  'Réponds UNIQUEMENT à partir du contexte fourni ci-dessous, qui contient des données',
  "réelles de transports SAP et des résumés mensuels de KPI. Si l'information demandée",
  "n'apparaît pas dans le contexte, réponds explicitement que tu ne disposes pas de cette",
  'information. Ne réponds à aucune question hors de ce périmètre (pas de méthodologie de',
  'projet, pas de sujet général). Réponds en français, de façon concise.',
].join(' ')

export async function answerQuestion(question, contextText) {
  const response = await getClient().chat.completions.create({
    model: CHAT_MODEL,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `Contexte :\n${contextText}\n\nQuestion : ${question}` },
    ],
    temperature: 0.2,
  })

  return response.choices[0].message.content
}
```

- [ ] **Step 2: Commit**

```bash
git add chatbot-backend/src/lib/openaiClient.js
git commit -m "feat(chatbot-backend): add OpenAI embeddings/chat client"
```

---

## Task 5: Pinecone client wrapper

**Files:**
- Create: `chatbot-backend/src/lib/pineconeClient.js`

No automated tests — wraps network calls to Pinecone, requires a real API key. Exercised
manually in Task 8/9.

- [ ] **Step 1: Write the implementation**

Create `chatbot-backend/src/lib/pineconeClient.js`:

```js
import { Pinecone } from '@pinecone-database/pinecone'
import { EMBEDDING_DIMENSION } from './openaiClient.js'

let client

function getClient() {
  if (!client) {
    client = new Pinecone({ apiKey: process.env.PINECONE_API_KEY })
  }
  return client
}

export async function ensureIndex(indexName) {
  const pinecone = getClient()
  const existing = await pinecone.listIndexes()
  const alreadyExists = existing.indexes?.some((index) => index.name === indexName)

  if (!alreadyExists) {
    console.log(`Creating Pinecone index "${indexName}"...`)
    await pinecone.createIndex({
      name: indexName,
      dimension: EMBEDDING_DIMENSION,
      metric: 'cosine',
      spec: { serverless: { cloud: 'aws', region: 'us-east-1' } },
      waitUntilReady: true,
    })
  }

  return pinecone.index(indexName)
}

export function getIndex(indexName) {
  return getClient().index(indexName)
}
```

**Note:** the vector count on the free Pinecone plan is limited by pod/serverless quota,
but a few thousand transport rows fit comfortably within the free serverless tier used here.

- [ ] **Step 2: Commit**

```bash
git add chatbot-backend/src/lib/pineconeClient.js
git commit -m "feat(chatbot-backend): add Pinecone client with auto index creation"
```

---

## Task 6: Ingestion script

**Files:**
- Create: `chatbot-backend/src/ingest.js`

- [ ] **Step 1: Write the implementation**

Create `chatbot-backend/src/ingest.js`:

```js
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
```

Note the `metadata: { ...doc.metadata, text: doc.text }` in `upsertDocuments` — Pinecone
only returns whatever is stored in a vector's `metadata`, so the fiche/summary text itself
must be duplicated into metadata to be retrievable at query time (Task 7 reads it back via
`match.metadata.text`).

- [ ] **Step 2: Commit**

```bash
git add chatbot-backend/src/ingest.js
git commit -m "feat(chatbot-backend): add CSV-to-Pinecone ingestion script"
```

---

## Task 7: Express server (`/api/chat`, `/api/health`)

**Files:**
- Create: `chatbot-backend/src/server.js`

- [ ] **Step 1: Write the implementation**

Create `chatbot-backend/src/server.js`:

```js
import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import { embedText, answerQuestion } from './lib/openaiClient.js'
import { getIndex } from './lib/pineconeClient.js'

const app = express()
app.use(express.json())

const allowedOrigin = process.env.ALLOWED_ORIGIN
app.use(cors({ origin: allowedOrigin ? allowedOrigin.split(',') : '*' }))

const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de questions, réessayez dans une minute.' },
})

const MAX_QUESTION_LENGTH = 300

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' })
})

app.post('/api/chat', chatLimiter, async (req, res) => {
  const question = typeof req.body?.question === 'string' ? req.body.question.trim() : ''

  if (!question) {
    return res.status(400).json({ error: 'La question est vide.' })
  }
  if (question.length > MAX_QUESTION_LENGTH) {
    return res.status(400).json({ error: `La question dépasse ${MAX_QUESTION_LENGTH} caractères.` })
  }

  try {
    const indexName = process.env.PINECONE_INDEX
    const index = getIndex(indexName)
    const queryVector = await embedText(question)

    const [transportResults, kpiResults] = await Promise.all([
      index.namespace('transports').query({ vector: queryVector, topK: 5, includeMetadata: true }),
      index.namespace('kpi_monthly').query({ vector: queryVector, topK: 5, includeMetadata: true }),
    ])

    const contextText = [...transportResults.matches, ...kpiResults.matches]
      .map((match) => match.metadata?.text)
      .filter(Boolean)
      .join('\n\n')

    const answer = await answerQuestion(question, contextText || '(aucune donnée trouvée)')
    res.json({ answer })
  } catch (error) {
    console.error('Chat error:', error)
    res.status(500).json({ error: 'Une erreur est survenue, réessayez.' })
  }
})

const port = process.env.PORT || 3000
app.listen(port, () => {
  console.log(`Chatbot backend listening on port ${port}`)
})
```

- [ ] **Step 2: Commit**

```bash
git add chatbot-backend/src/server.js
git commit -m "feat(chatbot-backend): add /api/chat and /api/health routes"
```

---

## Task 8: Run ingestion for real (manual, needs real API keys)

**Files:** none (operational task)

- [ ] **Step 1: Fill in real credentials**

Copy `chatbot-backend/.env.example` to `chatbot-backend/.env` and fill in your real
`OPENAI_API_KEY` and `PINECONE_API_KEY` (leave `PINECONE_INDEX=sap-transport-chatbot` and
`PORT=3000` as-is; `ALLOWED_ORIGIN` isn't needed for this step).

- [ ] **Step 2: Copy the CSV exports into the backend's data folder**

Copy `ZTR_TRANSPORT.csv` and `ZTR_OBJECTS.csv` (currently at
`c:\Users\MO_EHAB\Desktop\hind\`) into `chatbot-backend/data/`.

- [ ] **Step 3: Run the ingestion script**

Run: `cd chatbot-backend && npm run ingest`
Expected: console output showing the index being created (first run only), then batches of
`upserted N vectors into "transports"` and `upserted N vectors into "kpi_monthly"`, ending
with `Ingestion complete.`

- [ ] **Step 4: Verify in the Pinecone console**

Open the Pinecone console, select the `sap-transport-chatbot` index, and confirm the
`transports` and `kpi_monthly` namespaces each show a non-zero vector count matching the
console output from Step 3.

---

## Task 9: Manual local test of the backend

**Files:** none (operational task)

- [ ] **Step 1: Start the server**

Run: `cd chatbot-backend && npm start`
Expected: `Chatbot backend listening on port 3000`

- [ ] **Step 2: Test the health route**

Run (in a second terminal): `curl http://localhost:3000/api/health`
Expected: `{"status":"ok"}`

- [ ] **Step 3: Test a real question grounded in the data**

Run: `curl -X POST http://localhost:3000/api/chat -H "Content-Type: application/json" -d "{\"question\": \"Combien de transports ont échoué en 1996 ?\"}"`
Expected: JSON `{"answer": "..."}` whose text is consistent with the FAILED counts you can
see directly in `ZTR_TRANSPORT.csv` for rows with `CREATION_DATE` starting `1996`.

- [ ] **Step 4: Test an out-of-scope question is refused**

Run: `curl -X POST http://localhost:3000/api/chat -H "Content-Type: application/json" -d "{\"question\": \"Quelle est la capitale de la France ?\"}"`
Expected: JSON `{"answer": "..."}` whose text says it doesn't have that information /
that this is outside its scope — not an actual answer about France.

- [ ] **Step 5: Test the rate limit**

Run the Step 3 curl command 11 times in a row (quickly).
Expected: the 11th response is `{"error":"Trop de questions, réessayez dans une minute."}`
with HTTP status 429.

---

## Task 10: Deploy the backend to Render

**Files:** none (operational task)

- [ ] **Step 1: Push the backend to GitHub**

```bash
cd chatbot-backend/..
git push origin main
```

- [ ] **Step 2: Create the Render web service**

In the Render dashboard: New → Web Service → connect the
`github.com/muhammedehab35/sap-transport-analytics` repository. Set:
- **Root Directory:** `chatbot-backend`
- **Build Command:** `npm install`
- **Start Command:** `npm start`
- **Instance Type:** Free

- [ ] **Step 3: Set environment variables on Render**

In the service's Environment tab, add `OPENAI_API_KEY`, `PINECONE_API_KEY`,
`PINECONE_INDEX=sap-transport-chatbot`, and `ALLOWED_ORIGIN` set to your site's GitHub Pages
URL (e.g. `https://muhammedehab35.github.io`).

- [ ] **Step 4: Deploy and verify**

Trigger the deploy, wait for it to go live, then run:
`curl https://<your-render-service>.onrender.com/api/health`
Expected: `{"status":"ok"}`

- [ ] **Step 5: Note the backend URL**

Write down the Render service URL (e.g. `https://sap-chatbot-backend.onrender.com`) — it's
needed as `VITE_CHATBOT_API_URL` in Task 12.

---

## Task 11: Frontend ChatWidget component

**Files:**
- Create: `src/components/ChatWidget.jsx`
- Create: `src/components/ChatWidget.css`

- [ ] **Step 1: Write the component**

Create `src/components/ChatWidget.jsx`:

```jsx
import { useState, useRef, useEffect } from 'react'
import './ChatWidget.css'

const API_URL = import.meta.env.VITE_CHATBOT_API_URL

function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Bonjour ! Posez-moi une question sur les transports SAP (statuts, risques, KPI mensuels).' },
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showColdStartHint, setShowColdStartHint] = useState(false)
  const listRef = useRef(null)

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [messages, isOpen])

  async function sendMessage() {
    const question = input.trim()
    if (!question || isLoading) return

    setMessages((prev) => [...prev, { role: 'user', text: question }])
    setInput('')
    setIsLoading(true)

    const coldStartTimer = setTimeout(() => setShowColdStartHint(true), 4000)

    try {
      const response = await fetch(`${API_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      })
      const data = await response.json()
      const text = response.ok ? data.answer : (data.error || 'Une erreur est survenue.')
      setMessages((prev) => [...prev, { role: 'assistant', text }])
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', text: 'Impossible de contacter le serveur. Réessayez plus tard.' }])
    } finally {
      clearTimeout(coldStartTimer)
      setShowColdStartHint(false)
      setIsLoading(false)
    }
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="chat-widget">
      {isOpen && (
        <div className="chat-panel">
          <div className="chat-panel-header">
            <span>Assistant transports</span>
            <button onClick={() => setIsOpen(false)} aria-label="Fermer">×</button>
          </div>
          <div className="chat-panel-messages" ref={listRef}>
            {messages.map((message, index) => (
              <div key={index} className={`chat-message chat-message-${message.role}`}>
                {message.text}
              </div>
            ))}
            {isLoading && (
              <div className="chat-message chat-message-assistant chat-message-loading">
                {showColdStartHint
                  ? "Le serveur se réveille, ça peut prendre jusqu'à une minute..."
                  : '...'}
              </div>
            )}
          </div>
          <div className="chat-panel-input">
            <input
              type="text"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Posez votre question..."
              disabled={isLoading}
            />
            <button onClick={sendMessage} disabled={isLoading || !input.trim()}>
              Envoyer
            </button>
          </div>
        </div>
      )}
      <button className="chat-bubble" onClick={() => setIsOpen((prev) => !prev)} aria-label="Ouvrir l'assistant">
        {isOpen ? '×' : '💬'}
      </button>
    </div>
  )
}

export default ChatWidget
```

- [ ] **Step 2: Write the stylesheet**

Create `src/components/ChatWidget.css`:

```css
.chat-widget {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 50;
}

.chat-bubble {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  border: none;
  background: var(--accent);
  color: #10233a;
  font-size: 1.4rem;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.4);
}

.chat-panel {
  width: 320px;
  height: 420px;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  display: flex;
  flex-direction: column;
  margin-bottom: 12px;
  overflow: hidden;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
}

.chat-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: var(--bg-alt);
  border-bottom: 1px solid var(--border);
  font-weight: 600;
}

.chat-panel-header button {
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 1.2rem;
  cursor: pointer;
}

.chat-panel-messages {
  flex: 1;
  overflow-y: auto;
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.chat-message {
  max-width: 85%;
  padding: 8px 12px;
  border-radius: var(--radius);
  font-size: 0.9rem;
  white-space: pre-wrap;
}

.chat-message-assistant {
  align-self: flex-start;
  background: var(--bg-alt);
  color: var(--text);
}

.chat-message-user {
  align-self: flex-end;
  background: var(--accent);
  color: #10233a;
}

.chat-message-loading {
  color: var(--text-muted);
  font-style: italic;
}

.chat-panel-input {
  display: flex;
  border-top: 1px solid var(--border);
}

.chat-panel-input input {
  flex: 1;
  padding: 10px 12px;
  background: var(--bg);
  border: none;
  color: var(--text);
  font-size: 0.9rem;
}

.chat-panel-input input:focus {
  outline: none;
}

.chat-panel-input button {
  padding: 0 16px;
  border: none;
  background: var(--accent);
  color: #10233a;
  font-weight: 600;
  cursor: pointer;
}

.chat-panel-input button:disabled {
  opacity: 0.5;
  cursor: default;
}

@media (max-width: 640px) {
  .chat-panel {
    width: calc(100vw - 32px);
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/ChatWidget.jsx src/components/ChatWidget.css
git commit -m "feat: add ChatWidget component"
```

---

## Task 12: Wire the widget into the app + configure the API URL

**Files:**
- Modify: `src/App.jsx`
- Create: `.env.example` (website root)

- [ ] **Step 1: Mount the widget in App.jsx**

In `src/App.jsx`, add the import and render `<ChatWidget />` after `<Footer />`:

```jsx
import { Routes, Route } from 'react-router-dom'
import Header from './components/Header.jsx'
import Home from './pages/Home.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Footer from './components/Footer.jsx'
import ChatWidget from './components/ChatWidget.jsx'

function App() {
  return (
    <>
      <Header />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/dashboard" element={<Dashboard />} />
      </Routes>
      <Footer />
      <ChatWidget />
    </>
  )
}

export default App
```

- [ ] **Step 2: Add the website-root env example**

Create `.env.example` (in `sap-transport-analytics/website/`, next to `package.json`):

```
# URL of the deployed chatbot-backend (Task 10), no trailing slash
VITE_CHATBOT_API_URL=https://sap-chatbot-backend.onrender.com
```

- [ ] **Step 3: Create your local env file for testing**

Copy `.env.example` to `.env.local` and set `VITE_CHATBOT_API_URL` to
`http://localhost:3000` (the backend from Task 9, still running).

- [ ] **Step 4: Commit**

```bash
git add src/App.jsx .env.example
git commit -m "feat: mount ChatWidget in the app"
```

(`.env.local` is not committed — it's already covered by the `*.local` rule in `.gitignore`.)

---

## Task 13: Manual end-to-end test (local)

**Files:** none (operational task)

- [ ] **Step 1: Start both servers**

Terminal 1: `cd chatbot-backend && npm start`
Terminal 2: `cd sap-transport-analytics/website && npm run dev`

- [ ] **Step 2: Open the site and try the widget**

Open the printed `localhost` URL in a browser. Confirm the chat bubble appears bottom-right
on both the Home and Dashboard pages. Click it, ask "Combien de transports au total ?", and
confirm a relevant answer appears within a few seconds (no cold-start hint expected since
the local backend is already warm).

- [ ] **Step 3: Confirm scope enforcement**

Ask "Explique-moi le bug de la clé primaire dans ZTR_OBJECTS" (report content, out of this
chatbot's scope). Confirm the widget replies that it doesn't have that information, rather
than answering from general knowledge.

---

## Task 14: Deploy the updated site

**Files:** none (operational task)

- [ ] **Step 1: Create the production env file**

Create `.env.production` (website root, gitignored per Task 1 Step 6) with:
```
VITE_CHATBOT_API_URL=https://<your-render-service>.onrender.com
```
using the real Render URL noted in Task 10 Step 5.

- [ ] **Step 2: Build and deploy**

Run: `cd sap-transport-analytics/website && npm run deploy`
Expected: `vite build` runs (picking up `.env.production`), then `gh-pages -d dist` publishes
to GitHub Pages, ending with a "Published" message.

- [ ] **Step 3: Verify on the live site**

Open the live GitHub Pages URL, click the chat bubble, and ask a real question. Confirm you
get an answer (the very first request may take up to ~50s due to Render free-tier cold
start — this is expected, matches the widget's own hint text).
