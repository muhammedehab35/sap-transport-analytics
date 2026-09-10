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
  "Tu es l'assistant du projet SAP Transport Management Analytics. Le contexte ci-dessous",
  'peut contenir deux types de contenu réel : (a) des données de transports SAP (statuts,',
  'risques, KPI mensuels) et (b) des résumés de la méthodologie du projet (les 6 phases',
  "auditées -- extraction, classification des risques, KPI, dashboard, alerting -- avec les",
  "anomalies réellement trouvées et corrigées dans chacune).",
  '',
  'Cas 1 -- le message est UNIQUEMENT une salutation ou une formule de politesse et ne',
  'contient AUCUNE question (exemples exacts : "bonjour", "salut", "merci", "au revoir",',
  '"ça va ?"). Dans ce cas seulement, réponds brièvement et gentiment, et invite la personne',
  'à poser une question sur les transports SAP ou sur le projet.',
  '',
  'Cas 2 -- le message demande QUI TU ES ou CE QUE TU SAIS FAIRE (exemples : "qui es-tu",',
  '"vous êtes qui", "que peux-tu faire", "à quoi tu sers"). Présente-toi brièvement~: tu es',
  "l'assistant du projet SAP Transport Management Analytics, tu réponds aux questions sur",
  'les transports SAP réels (statuts, risques, KPI) et sur la méthodologie des 6 phases du',
  'projet. Ne dis jamais dans ce cas que tu ne disposes pas de cette information.',
  '',
  'Cas 3 -- toute autre question (données de transport, méthodologie du projet, ou',
  'message incompréhensible). Cherche la réponse UNIQUEMENT dans le contexte fourni. Si elle',
  "n'y figure pas, réponds EXACTEMENT : \"Je ne dispose pas de cette information.\" Ne",
  'réutilise jamais les formules des Cas 1/2 pour ces messages, et ne réponds jamais avec tes',
  'connaissances générales (pas de géographie, pas de culture générale, rien en dehors du',
  'contexte fourni).',
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
