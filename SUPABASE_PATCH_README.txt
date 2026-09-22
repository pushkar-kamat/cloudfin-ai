CloudFin AI V2 - Supabase Auth Patch

1. Put CloudFin-Supabase-Auth.patch in the root of your cloudfin-ai-v2 project.
2. From that project root, run:
   git apply --check CloudFin-Supabase-Auth.patch
   git apply CloudFin-Supabase-Auth.patch
3. You already installed @supabase/supabase-js. Remove the old Cognito package:
   cd frontend
   npm uninstall amazon-cognito-identity-js
4. Create frontend/.env:
   VITE_SUPABASE_URL=<your Supabase URL>
   VITE_SUPABASE_PUBLISHABLE_KEY=<your publishable key>
   VITE_API_URL=http://127.0.0.1:8000
5. Create backend/.env:
   GEMINI_API_KEY=<your Gemini key>
   GEMINI_MODEL=gemini-2.5-flash-lite
   SUPABASE_URL=<same Supabase URL>
   SUPABASE_PUBLISHABLE_KEY=<same publishable key>
   ADMIN_EMAILS=<the email you will use as CloudFin administrator>
   FRONTEND_URL=http://localhost:5173,http://127.0.0.1:5173
6. Restart backend and frontend.
