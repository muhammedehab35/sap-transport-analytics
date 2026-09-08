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
