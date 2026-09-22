# CloudFin AI V2 Deployment Checklist

## Before GitHub push

- [ ] `backend/.env` is NOT committed.
- [ ] `frontend/.env` is NOT committed.
- [ ] `backend/runtime_uploads/` contains only `.gitkeep`.
- [ ] Backend starts locally and `/health` returns `healthy`.
- [ ] Frontend can sign in with Cognito.
- [ ] A normal user can use `/chat`.
- [ ] Admin Cognito user belongs to group `admin`.
- [ ] Admin can open `/admin`.

## Render backend

- [ ] Root Directory = `backend`
- [ ] Build = `pip install -r requirements.txt`
- [ ] Start = `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- [ ] Health Check Path = `/health`
- [ ] `GEMINI_API_KEY` configured
- [ ] `GEMINI_MODEL` configured
- [ ] `COGNITO_ISSUER` configured
- [ ] `COGNITO_CLIENT_ID` configured
- [ ] `FRONTEND_URL` configured after Vercel URL is known

## Vercel frontend

- [ ] Root Directory = `frontend`
- [ ] Framework = Vite
- [ ] Build = `npm run build`
- [ ] Output = `dist`
- [ ] `VITE_COGNITO_ISSUER` configured
- [ ] `VITE_COGNITO_CLIENT_ID` configured
- [ ] `VITE_API_URL` points to Render HTTPS URL

## Production smoke test

- [ ] Open `/signin` directly.
- [ ] Sign in.
- [ ] Open `/app` directly after refresh.
- [ ] Ask a core KYC question.
- [ ] Check source cards.
- [ ] Open Admin.
- [ ] Upload a small TXT/PDF/Excel policy.
- [ ] Use Retrieval Lab on the uploaded policy.
- [ ] Ask the chat about the uploaded policy.
- [ ] Delete the runtime policy.
