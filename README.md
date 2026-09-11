# StudyNest — Render Edition

Private college resource sharing with personal tasks. Each member creates an
account using your invite code. Shared files are visible to members, while
tasks are isolated by account.

## Deploy on Render

1. Extract this ZIP and upload the folder to a new GitHub repository.
2. In Render, choose **New > Blueprint** and connect that repository.
3. Render reads render.yaml and creates a free Node web service.
4. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from your Supabase project.
5. When prompted for INVITE_CODE, enter a private code such as
   NEST-ABHI-2026. Share it only with friends who should join.
6. Click **Apply** and wait for the deployment to become Live.
7. Open the generated .onrender.com URL and create your first account using
   the same invite code.

SESSION_SECRET is generated automatically. Accounts, sessions, private tasks
and file metadata use Supabase Postgres. PDFs use the private
studynest-files Supabase Storage bucket.

## Free hosting

The Blueprint uses Render Free and has no persistent disk. Supabase Free stores
the durable data and uploaded files. Free-tier usage limits still apply.

## Limits and security

- Maximum upload size: 25 MB.
- Allowed: PDF, Word, PowerPoint, Excel, text, PNG and JPEG.
- Passwords use Node scrypt hashing.
- Sessions use secure, HTTP-only cookies in production.
- Keep INVITE_CODE and SESSION_SECRET private.

## Local test

Use Node.js 22, run npm install and then npm start. Open localhost port 3000.
The local default invite code is STUDYNEST-DEMO; set your own INVITE_CODE
before real use.
