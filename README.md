# CloudFin AI V2

**Lightweight Enterprise Financial Policy RAG**

CloudFin AI V2 evolves the original Financial RAG concept into a dynamic but deployment-friendly application. It keeps the parts that make an enterprise RAG system useful—secure users, document ingestion, retrieval, grounded generation, source attribution, administration and diagnostics—without requiring a local embedding model, PyTorch, Qdrant, LangChain, Docker or PostgreSQL for the MVP.

## Final hosting architecture

- **Frontend:** React + Vite on **Vercel**
- **Backend:** FastAPI + Python on **Render**
- **Authentication:** Supabase Auth
- **LLM:** Groq primary with Gemini fallback
- **Retrieval:** Hybrid word + character TF-IDF with cosine similarity
- **Core knowledge:** Repository-backed Markdown policies
- **Dynamic knowledge:** Admin uploads of PDF, DOCX, TXT, Markdown and Excel
- **Conversation persistence:** Browser localStorage
- **Cache:** Small in-memory TTL cache

```text
User
  |
  v
Vercel - React/Vite
  |  Cognito JWT
  v
Render - FastAPI
  |
  +--> Hybrid TF-IDF Retriever
  |        |
  |        +--> Core policy corpus (Git repository)
  |        +--> Runtime admin uploads (temporary on Render Free)
  |
  +--> Groq/Gemini grounded generation with automatic failover
  |
  +--> Answer + sources + section/page/excerpt
```

## What changed from the emergency demo

1. The one-file backend has been split into small modules.
2. Retrieval now combines **word TF-IDF** and **character TF-IDF**.
3. Retrieval includes title/section boosts for financial policy terms.
4. Admins can upload **PDF, DOCX, TXT, MD and Excel** files and immediately re-index them.
5. Runtime documents can be removed without redeploying the app.
6. Sources now include document, section, page where available, excerpt and relevance.
7. Admins get a **Retrieval Lab** to inspect the top retrieved chunks before an LLM is called.
8. The chat sends a small recent history window for follow-up questions.
9. Repeated questions can use a lightweight in-memory TTL cache.
10. Conversations support search, rename, pin, archive and delete in localStorage.
11. LLM routing is environment-configurable, with Groq/Gemini failover and a lightweight circuit breaker.
12. Vercel SPA routing and Render deployment configuration are included.

## Important Render Free limitation

The project deliberately treats admin uploads as **runtime/demo knowledge**. Render Free web services use an ephemeral filesystem, so uploaded files can be lost when an instance restarts, redeploys or spins down. The nine repository policies always return after a restart because they are part of the Git deployment.

This is intentional for the lightweight MVP. A later persistence upgrade can add S3-compatible object storage without changing the retrieval pipeline.

## Project structure

```text
cloudfin-ai-v2/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── auth.py
│   │   ├── schemas.py
│   │   ├── routes/
│   │   │   ├── health.py
│   │   │   ├── chat.py
│   │   │   └── admin.py
│   │   ├── rag/
│   │   │   ├── loaders.py
│   │   │   ├── chunker.py
│   │   │   ├── knowledge_base.py
│   │   │   └── pipeline.py
│   │   └── services/
│   │       ├── gemini.py
│   │       └── cache.py
│   ├── runtime_uploads/
│   ├── main.py
│   ├── requirements.txt
│   └── .env.example
├── knowledge/
├── frontend/
│   ├── src/
│   ├── vercel.json
│   ├── package.json
│   └── .env.example
├── render.yaml
└── README.md
```

## Local setup

### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate       # macOS/Linux
# Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
```

Fill `backend/.env`:

```env
GEMINI_API_KEY=your_key
GEMINI_MODEL=gemini-2.5-flash-lite
COGNITO_ISSUER=https://cognito-idp.REGION.amazonaws.com/POOL_ID
COGNITO_CLIENT_ID=your_app_client_id
FRONTEND_URL=http://localhost:5173,http://127.0.0.1:5173
```

Run:

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The old demo command also works:

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Check:

- `http://localhost:8000/health`
- `http://localhost:8000/docs`

### Frontend

```bash
cd frontend
npm install
cp .env.example .env
```

Fill `frontend/.env`:

```env
VITE_COGNITO_ISSUER=https://cognito-idp.REGION.amazonaws.com/POOL_ID
VITE_COGNITO_CLIENT_ID=your_app_client_id
VITE_API_URL=http://localhost:8000
```

Run:

```bash
npm run dev
```

## Deploy backend to Render

Fast path: connect the GitHub repository to Render and create a **Web Service**.

- Root directory: `backend`
- Runtime: Python
- Build command: `pip install -r requirements.txt`
- Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- Health check: `/health`

Environment variables:

```text
GEMINI_API_KEY
GEMINI_MODEL=gemini-2.5-flash-lite
COGNITO_ISSUER
COGNITO_CLIENT_ID
FRONTEND_URL=https://YOUR-VERCEL-DOMAIN.vercel.app
```

The repository also includes `render.yaml` for a Blueprint-style setup.

## Deploy frontend to Vercel

Import the same GitHub repository into Vercel.

- Root directory: `frontend`
- Framework preset: Vite
- Build command: `npm run build`
- Output directory: `dist`

Environment variables:

```text
VITE_COGNITO_ISSUER
VITE_COGNITO_CLIENT_ID
VITE_API_URL=https://YOUR-RENDER-SERVICE.onrender.com
```

`frontend/vercel.json` adds the SPA fallback needed for direct visits to `/app`, `/admin`, `/signin`, and related React routes.

### Production CORS order

After Vercel gives the final frontend URL, update the Render variable:

```text
FRONTEND_URL=https://YOUR-VERCEL-DOMAIN.vercel.app
```

Then redeploy/restart the backend once so the production origin is accepted.

## Admin workflow

An administrator in the Cognito `admin` group can:

1. Open **Admin console**.
2. View document/chunk/cache status.
3. Upload PDF, DOCX, TXT, Markdown or Excel.
4. The backend extracts text, chunks it and rebuilds the hybrid TF-IDF index.
5. Open **Retrieval Lab** and test what chunks match a query.
6. Return to chat and ask a question about the newly uploaded policy.
7. Delete runtime documents and re-index.

This is the recommended dynamic RAG demonstration for the project viva.

## Viva-friendly configuration

Important values are centralized in `backend/app/config.py` and can also be changed using environment variables:

```text
TOP_K
MIN_RELEVANCE
WORD_TFIDF_WEIGHT
CHAR_TFIDF_WEIGHT
CHUNK_SIZE
CHUNK_OVERLAP
MAX_HISTORY_MESSAGES
CACHE_TTL_SECONDS
MAX_UPLOAD_MB
```

This makes common manual viva changes small and easy to explain.

## Current lightweight dependencies

The backend intentionally avoids the heavy original stack. It does **not** require:

- PyTorch
- Sentence Transformers
- Qdrant
- LangChain
- Docker
- PostgreSQL
- GPU inference

The ingestion layer stays lightweight: `PyMuPDF` for PDF, `python-docx` for DOCX, and `openpyxl`/`xlrd` for Excel. Pandas is not required.

## Recommended next development batch

After this V2 foundation is running locally and on hosting, the next improvements should be:

1. Optional persistent object storage adapter for uploaded documents.
2. Better retrieval evaluation with a small question/answer test set.
3. Admin audit/activity records if required by the final report.
4. Final architecture diagrams and viva change exercises.
