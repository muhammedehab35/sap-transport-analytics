# Chatbot IA (RAG) pour le site SAP Transport Management Analytics Dashboard

Date : 2026-09-08

## Contexte

Le site web du projet (React + Vite, hébergé statiquement sur GitHub Pages via `gh-pages`,
routage `HashRouter`) présente le projet PFE "SAP Transport Management Analytics Dashboard"
et intègre le tableau de bord Power BI. On ajoute une nouvelle fonctionnalité personnelle :
un chatbot IA capable de répondre à des questions sur les données réelles de transport,
basé sur OpenAI (embeddings + chat) et Pinecone (base vectorielle).

Cette fonctionnalité ne fait pas partie du cahier des charges initial d'Avaxia (6 phases déjà
soutenues) ; elle sera néanmoins documentée dans le rapport et la présentation Canva une fois
implémentée et validée.

## Objectif

Un visiteur du site (jury, recruteur, ou l'utilisateur elle-même) peut poser une question en
langage naturel sur les transports SAP exportés (ex. "quel est le taux d'échec en juillet ?",
"montre-moi les transports à risque élevé de NAFTI", "quel est le statut du transport
VE0K900139 ?") et recevoir une réponse générée par GPT, strictement basée sur les données
réelles indexées — pas de contenu du rapport, pas de méthodologie, uniquement les données
chiffrées de transport/KPI.

## Portée (scope)

**Inclus :**
- Indexation vectorielle des données CSV exportées : `ZTR_TRANSPORT`/`ZTR_OBJECTS` (fiches par
  transport) et `ZTR_KPI` (résumés mensuels agrégés).
- Backend Express minimal exposant `POST /api/chat`.
- Widget de chat flottant intégré au site React, visible sur toutes les pages.
- Garde-fous de base : rate limiting, CORS restreint, longueur de question limitée.

**Exclus (hors scope de cette itération) :**
- Contenu du rapport LaTeX ou du site (méthodologie, bugs corrigés, architecture) — le chatbot
  ne répond pas à ces questions-là.
- Connexion en direct à SAP (les données sont les exports CSV déjà utilisés pour Power BI, pas
  un flux temps réel).
- Authentification utilisateur ou historique de conversation persistant.
- Mise à jour automatique de l'index à chaque changement de données (ré-ingestion manuelle).

## Architecture

```
React (site GitHub Pages)          Backend Express (Render, gratuit)         Services
┌────────────────────┐             ┌───────────────────────────┐
│ ChatWidget.jsx      │  POST      │ POST /api/chat            │   OpenAI embeddings API
│ (bulle flottante,   │ ─────────► │  1. embed la question      │──────────────────►
│  visible sur toutes │  /api/chat │  2. query Pinecone (top-K) │
│  les pages)         │ ◄───────── │  3. GPT + contexte récupéré│   OpenAI chat completions
└────────────────────┘   réponse   │  4. renvoie la réponse     │──────────────────►
                                     └───────────────────────────┘
                                                  │
                                                  ▼
                                          Pinecone (1 index)
                                     namespace "transports" +
                                     namespace "kpi_monthly"
```

Les clés API OpenAI et Pinecone résident **uniquement** dans les variables d'environnement du
backend Express (Render). Elles ne sont jamais exposées au code frontend/navigateur.

## Composants

### 1. Script d'ingestion (`ingest.js`, backend, exécution manuelle)

- Lit `ZTR_TRANSPORT.csv` + `ZTR_OBJECTS.csv` (mêmes exports que ceux utilisés pour Power BI).
- Pour chaque transport, construit une fiche texte : numéro, propriétaire, statut, délai,
  score et niveau de risque, dates d'import, objets associés.
- Génère l'embedding OpenAI (`text-embedding-3-small`) de chaque fiche.
- Upsert dans Pinecone, namespace `transports`, avec métadonnées structurées (numéro de
  transport, statut, niveau de risque, mois) pour permettre un filtrage complémentaire.
- Lit `ZTR_KPI.csv`, construit un résumé texte par mois (nombre de transports, taux d'échec,
  délai moyen), embed, upsert dans le namespace `kpi_monthly`.
- Ré-exécuté manuellement si les CSV sont ré-exportés depuis SAP.

### 2. Backend Express (`server.js` + route `/api/chat`)

- `POST /api/chat` reçoit `{ question: string }`.
- Valide la longueur de la question (ex. max 300 caractères) et applique un rate limit
  (ex. 10 requêtes/minute/IP via `express-rate-limit`).
- Embed la question (même modèle que l'ingestion).
- Interroge Pinecone sur les deux namespaces (top 5 résultats de chacun).
- Construit un prompt système strict : "Réponds uniquement à partir du contexte fourni
  ci-dessous (données réelles de transports SAP). Si l'information n'y figure pas, dis que tu
  ne sais pas. Ne réponds jamais sur d'autres sujets."
- Appelle l'API Chat Completions OpenAI (`gpt-4o-mini` ou équivalent économique) avec le
  contexte récupéré + la question.
- Renvoie `{ answer: string }`.
- CORS restreint à l'origine du site GitHub Pages.

### 3. Widget frontend (`ChatWidget.jsx`)

- Bulle flottante en bas à droite, présente sur toutes les pages (montée dans `App.jsx`, au
  même niveau que `Header`/`Footer`).
- État local : liste de messages, champ de saisie, indicateur de chargement.
- Appelle `POST <URL_BACKEND>/api/chat` au clic sur "Envoyer".
- Message d'attente explicite pour le premier appel après inactivité du backend ("le premier
  message peut prendre quelques dizaines de secondes, le serveur se réveille") — le plan gratuit
  Render met le service en veille après inactivité (cold start).
- Style visuel aligné sur le thème sombre existant du site (mêmes couleurs d'accent que le
  dashboard Power BI).

## Déploiement

- **Backend** : nouveau dossier `chatbot-backend/` à la racine du dépôt git existant
  (`sap-transport-analytics/website`, déjà lié à `github.com/.../sap-transport-analytics`),
  déployé sur Render (plan gratuit, Node/Express, "Root Directory" pointé sur ce sous-dossier).
  Variables d'environnement : `OPENAI_API_KEY`, `PINECONE_API_KEY`, `PINECONE_INDEX`,
  `ALLOWED_ORIGIN`.
- **Frontend** : reste sur GitHub Pages, aucun changement de pipeline de déploiement existant
  (`npm run deploy` via `gh-pages`) — juste un nouveau composant et une variable d'environnement
  Vite (`VITE_CHATBOT_API_URL`) pointant vers le backend Render.

## Sécurité et coûts

- Clés API jamais exposées côté client.
- Rate limiting par IP pour limiter l'abus (le site est public).
- Prompt système contraignant strictement le périmètre de réponse (évite les questions hors
  sujet qui gaspilleraient des appels OpenAI).
- Modèle d'embedding et de chat économiques (`text-embedding-3-small`, `gpt-4o-mini`) pour
  limiter les coûts, cohérent avec un usage de démonstration/portfolio plutôt que production à
  grande échelle.

## Tests

- Script d'ingestion : vérifier le nombre de vecteurs upsertés correspond au nombre de lignes
  CSV (transports + mois KPI).
- Backend : tester `/api/chat` avec une question chiffrée précise (ex. "combien de transports
  en échec en juillet ?") et vérifier que la réponse correspond aux données réelles de
  `ZTR_KPI.csv` pour ce mois.
- Backend : tester une question hors périmètre (ex. "quelle est la capitale de la France ?")
  et vérifier que le chatbot refuse de répondre, conformément au prompt système.
- Frontend : test manuel dans le navigateur (widget visible sur Home et Dashboard, envoi/
  réception de messages, affichage du message de cold start).

## Documentation post-implémentation

Une fois la fonctionnalité validée sur le site réel, une section sera ajoutée au rapport LaTeX
(nouvelle sous-section ou annexe) et un slide dédié sera ajouté au Canva, décrivant
l'architecture RAG et les choix techniques (OpenAI, Pinecone, backend Express).
