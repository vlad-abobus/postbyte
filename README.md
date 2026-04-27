<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run locally (Flask backend + React frontend)

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/d40ed0e6-ff13-4d66-87ae-21cb1fdcf560

## Frontend (React)

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. (Optional) Set `VITE_API_BASE` in `.env.local`:
   - `VITE_API_BASE=http://localhost:5000`
3. Run the frontend:
   `npm run dev`

## Backend (Flask)

See `backend/README.md`.

## Deploy on Render

This repo is preconfigured for Render Blueprint deploy with two services:

- `postbytecl-api` (Flask API + uploads + SQLite on persistent disk)
- `postbytecl-web` (React static site)

### One-click Blueprint flow

1. Push this project to GitHub.
2. In Render, choose **New + -> Blueprint**.
3. Select your repository. Render will detect `render.yaml`.
4. Create services.

### Important after deploy

- Update `CORS_ORIGINS` on `postbytecl-api` to your actual frontend URL if the generated domain differs.
- Update `VITE_API_BASE` on `postbytecl-web` to your actual backend URL if needed.
- Trigger redeploy of the static site after changing `VITE_API_BASE`.

### Persisted data

- Database path: `/var/data/postbyte.db`
- Uploads path: `/var/data/uploads`
- Persistent disk is declared in `render.yaml` (`postbytecl-data`).
