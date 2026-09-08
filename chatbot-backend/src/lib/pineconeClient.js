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
