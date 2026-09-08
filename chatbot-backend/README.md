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
