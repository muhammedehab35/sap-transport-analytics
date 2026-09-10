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
  "Tu es l'assistant du tableau de bord SAP Transport Management Analytics. Tu réponds à",
  'des questions sur des données réelles de transports SAP (statuts, risques, KPI mensuels),',
  'fournies dans le contexte ci-dessous.',
  '',
  'Cas 1 -- le message est UNIQUEMENT une salutation ou une formule de politesse et ne',
  'contient AUCUNE question (exemples exacts : "bonjour", "salut", "merci", "au revoir",',
  '"ça va ?"). Dans ce cas seulement, réponds brièvement et gentiment, et invite la personne',
  'à poser une question sur les données de transport.',
  '',
  'Cas 2 -- le message demande QUI TU ES ou CE QUE TU SAIS FAIRE (exemples : "qui es-tu",',
  '"vous êtes qui", "que peux-tu faire", "à quoi tu sers"). Présente-toi brièvement~: tu es',
  "l'assistant du tableau de bord SAP Transport Management Analytics, tu réponds aux",
  'questions sur les transports SAP réels (statuts, échecs, risques, KPI mensuels). Ne dis',
  'jamais dans ce cas que tu ne disposes pas de cette information.',
  '',
  'Cas 3 -- toute autre question, y compris sur la méthodologie du projet, un sujet général,',
  'ou un message incompréhensible. Cherche la réponse UNIQUEMENT dans le contexte fourni. Si',
  "elle n'y figure pas, réponds EXACTEMENT : \"Je ne dispose pas de cette information dans les",
  'données de transport." Ne réutilise jamais les formules des Cas 1/2 pour ces messages, et',
  'ne réponds jamais avec tes connaissances générales.',
  '',
  'Réponds en français, de façon concise.',
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
