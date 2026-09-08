import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import { embedText, answerQuestion } from './lib/openaiClient.js'
import { getIndex } from './lib/pineconeClient.js'
import { GLOBAL_SUMMARY_ID } from './lib/documents.js'

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

    const [transportResults, kpiResults, globalFetch] = await Promise.all([
      index.namespace('transports').query({ vector: queryVector, topK: 5, includeMetadata: true }),
      index.namespace('kpi_monthly').query({ vector: queryVector, topK: 5, includeMetadata: true }),
      index.namespace('kpi_monthly').fetch([GLOBAL_SUMMARY_ID]),
    ])

    const globalText = globalFetch.records?.[GLOBAL_SUMMARY_ID]?.metadata?.text

    const contextText = [
      globalText,
      ...transportResults.matches.map((match) => match.metadata?.text),
      ...kpiResults.matches.map((match) => match.metadata?.text),
    ]
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
