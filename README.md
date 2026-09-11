# StudyNest — Render Edition

Private college resource sharing with personal tasks. Each member creates an
account using your invite code. Shared files are visible to members, while
tasks are isolated by account.

## Deploy on Render

1. Extract this ZIP and upload the folder to a new GitHub repository.
2. In Render, choose **New > Blueprint** and connect that repository.
3. Render reads render.yaml and creates one Node web service with a 1 GB
   persistent disk mounted at /var/data.
4. When prompted for INVITE_CODE, enter a private code such as
   NEST-ABHI-2026. Share it only with friends who should join.
5. Click **Apply** and wait for the deployment to become Live.
6. Open the generated .onrender.com URL and create your first account using
   the same invite code.

SESSION_SECRET is generated automatically. Tasks, accounts, sessions and file
metadata use SQLite. Uploaded files are stored under /var/data/uploads.

## Important pricing note

Render Persistent Disks are available on paid services. The included Blueprint
uses the lowest paid starter web-service plan because the free filesystem is
ephemeral and would delete uploaded PDFs after restarts. If you remove the disk
and change the plan to free, the app can run for testing but its saved data is
not reliable.

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
