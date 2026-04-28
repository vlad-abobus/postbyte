# Flask backend for PostByteCL

This replaces the Firebase (Firestore/Storage) layer with a Flask + PostgreSQL API.

## Run

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt

# optional (enables /api/reports and delete endpoints)
$env:ADMIN_KEY="change-me"

python -m flask --app backend.app run --port 5000
```

The API will be at `http://localhost:5000`.

Uploads are served from `http://localhost:5000/uploads/<file>`.

## Environment variables

- `DATABASE_URL`: PostgreSQL SQLAlchemy URL  
  Example: `postgresql+psycopg://postgres:postgres@localhost:5432/postbytecl`
- `UPLOADS_DIR`: upload folder (default `uploads`)
- `MAX_UPLOAD_BYTES`: max upload size in bytes (default 5MB)
- `CORS_ORIGINS`: comma-separated origins allowed to call `/api/*` (default `http://localhost:3000`)
- `ADMIN_KEY`: if set, required for:
  - `GET /api/reports` (header `X-Admin-Key`)
  - `DELETE /api/boards/.../posts/...` (header `X-Admin-Key`)
- Cloudinary (optional, enables cloud image storage instead of local uploads):
  - `CLOUDINARY_CLOUD_NAME`
  - `CLOUDINARY_API_KEY`
  - `CLOUDINARY_API_SECRET`
  - `CLOUDINARY_FOLDER` (optional, default `postbytecl`)

## Render production start command

Use this start command in Render web service:

```bash
gunicorn backend.app:app --bind 0.0.0.0:$PORT --workers 2 --threads 4 --timeout 120
```

For full stack (API + frontend), use the root `render.yaml` blueprint.

