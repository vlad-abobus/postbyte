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

Uploads are stored in the `image_blobs` PostgreSQL table by default and served from `http://localhost:5000/uploads/<file>`. This also works on hosts with ephemeral disks (Vercel). If Cloudinary is configured, new images are uploaded there instead.

## Environment variables

- `DATABASE_URL`: PostgreSQL SQLAlchemy URL  
  Example: `postgresql+psycopg://postgres:postgres@localhost:5432/postbytecl`
- `UPLOADS_DIR`: legacy/local upload folder (default `uploads`); new images are stored in PostgreSQL unless Cloudinary is enabled
- `MAX_UPLOAD_BYTES`: max upload size in bytes (default 5MB)
- `CORS_ORIGINS`: comma-separated origins allowed to call `/api/*` (default `http://localhost:3000`)
- `ADMIN_KEY`: if set, required for:
  - `GET /api/reports` (header `X-Admin-Key`)
  - `DELETE /api/boards/.../posts/...` (header `X-Admin-Key`)
- Cloudinary (optional, offloads image storage from PostgreSQL; falls back to the DB on upload errors):
  - `CLOUDINARY_CLOUD_NAME`
  - `CLOUDINARY_API_KEY`
  - `CLOUDINARY_API_SECRET`
  - `CLOUDINARY_FOLDER` (optional, default `postbytecl`)

## Create an admin

```powershell
$env:DATABASE_URL="postgresql://..."
python -m backend.create_admin --username vlad_adm --password "change-me" --email vlad_adm@postbyte.local
```

The script creates the user or updates the existing one. Omit `--password` to be prompted securely.

## Render production start command

Use this start command in Render web service:

```bash
gunicorn backend.app:app --bind 0.0.0.0:$PORT --workers 2 --threads 4 --timeout 120
```

For full stack (API + frontend), use the root `render.yaml` blueprint.

