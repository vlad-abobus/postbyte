from __future__ import annotations

import base64
import hashlib
import io
import ipaddress
import os
import re
import secrets
import socket
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlparse
from urllib.request import Request as UrlRequest, urlopen

from sqlalchemy import inspect

try:
    import cloudinary
    import cloudinary.uploader
except Exception:
    cloudinary = None
from dotenv import load_dotenv
from flask import (
    Flask,
    Response,
    abort,
    current_app,
    jsonify,
    request,
    send_from_directory,
    session,
    stream_with_context,
)
from flask_cors import CORS
from PIL import Image, ImageFile
from werkzeug.exceptions import HTTPException, RequestEntityTooLarge
from werkzeug.security import check_password_hash, generate_password_hash
from werkzeug.utils import secure_filename

if __package__:
    # Package import (local dev, gunicorn backend.app:app, Render).
    from .db import db
    from .models import (
        Board,
        ImageBlob,
        IpBan,
        IpMute,
        Post,
        Report,
        Thread,
        UploadChunk,
        UploadSession,
        User,
    )
else:
    # Top-level import (Vercel entrypoint app:app with root=backend/).
    from db import db
    from models import (
        Board,
        ImageBlob,
        IpBan,
        IpMute,
        Post,
        Report,
        Thread,
        UploadChunk,
        UploadSession,
        User,
    )


def create_app() -> Flask:
    load_dotenv()

    app = Flask(__name__)
    app.config["JSON_SORT_KEYS"] = False

    # Vercel Functions reject request bodies above 4.5 MB before Flask runs, so
    # the per-request limit must stay below that. Bigger images are uploaded in
    # chunks (see /api/uploads/chunked/*).
    max_upload_bytes = 4 * 1024 * 1024
    max_upload_bytes_raw = os.getenv("MAX_UPLOAD_BYTES")
    if max_upload_bytes_raw:
        try:
            max_upload_bytes = int(max_upload_bytes_raw)
        except ValueError:
            app.logger.warning(
                "Invalid MAX_UPLOAD_BYTES=%r; using %s bytes",
                max_upload_bytes_raw,
                max_upload_bytes,
            )
    app.config["MAX_CONTENT_LENGTH"] = max_upload_bytes

    max_image_bytes = 15 * 1024 * 1024
    max_image_bytes_raw = os.getenv("MAX_IMAGE_BYTES")
    if max_image_bytes_raw:
        try:
            max_image_bytes = int(max_image_bytes_raw)
        except ValueError:
            app.logger.warning(
                "Invalid MAX_IMAGE_BYTES=%r; using %s bytes",
                max_image_bytes_raw,
                max_image_bytes,
            )

    upload_chunk_bytes = 3 * 1024 * 1024
    upload_chunk_bytes_raw = os.getenv("UPLOAD_CHUNK_BYTES")
    if upload_chunk_bytes_raw:
        try:
            upload_chunk_bytes = int(upload_chunk_bytes_raw)
        except ValueError:
            app.logger.warning(
                "Invalid UPLOAD_CHUNK_BYTES=%r; using %s bytes",
                upload_chunk_bytes_raw,
                upload_chunk_bytes,
            )
    # A chunk request includes headers/multipart-free overhead, so leave room
    # under Flask's per-request limit.
    if upload_chunk_bytes >= max_upload_bytes:
        upload_chunk_bytes = max(256 * 1024, max_upload_bytes - 256 * 1024)
    app.config["MAX_IMAGE_BYTES"] = max_image_bytes
    app.config["UPLOAD_CHUNK_BYTES"] = upload_chunk_bytes

    # A random SECRET_KEY per process breaks sessions on serverless platforms:
    # login succeeds on one instance, but /api/auth/me on another instance
    # cannot decode the cookie and returns {"user": null}. If SECRET_KEY is not
    # configured, derive a stable key from DATABASE_URL so all instances share
    # it. Setting SECRET_KEY explicitly is still recommended.
    secret_key = (os.getenv("SECRET_KEY") or "").strip()
    secret_key_source = "set"
    if not secret_key:
        seed = (os.getenv("DATABASE_URL") or "postbytecl-local-dev").strip()
        secret_key = hashlib.sha256(f"postbytecl-session:{seed}".encode("utf-8")).hexdigest()
        secret_key_source = "derived"
    app.config["SECRET_KEY"] = secret_key
    app.config["SESSION_COOKIE_HTTPONLY"] = True

    database_url = (os.getenv("DATABASE_URL") or "").strip().strip('"').strip("'")
    if not database_url:
        database_url = "postgresql+psycopg://postgres:postgres@localhost:5432/postbytecl"
    elif database_url.startswith("postgres://"):
        # Some providers still expose the old scheme; SQLAlchemy expects postgresql://.
        database_url = "postgresql://" + database_url[len("postgres://") :]
    app.config["SQLALCHEMY_DATABASE_URI"] = database_url
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

    # Vercel's filesystem is read-only except /tmp. Default there so startup
    # doesn't crash if UPLOADS_DIR is not configured. Uploads are persisted in
    # PostgreSQL (or Cloudinary when configured), so /tmp is only a legacy
    # fallback for files written by older deployments.
    default_uploads_dir = "/tmp/uploads" if os.getenv("VERCEL") else "uploads"
    uploads_dir_raw = os.getenv("UPLOADS_DIR") or default_uploads_dir
    uploads_dir = Path(uploads_dir_raw).resolve()
    try:
        uploads_dir.mkdir(parents=True, exist_ok=True)
    except OSError:
        # On some hosts (e.g. misconfigured Render service without a mounted disk),
        # absolute paths like /var/data may be unavailable. Fallback to local uploads.
        fallback_uploads_dir = (
            Path("/tmp/uploads")
            if os.getenv("VERCEL")
            else (Path(__file__).resolve().parent.parent / "uploads").resolve()
        )
        fallback_uploads_dir.mkdir(parents=True, exist_ok=True)
        uploads_dir = fallback_uploads_dir
    app.config["UPLOADS_DIR"] = str(uploads_dir)

    cloud_name = os.getenv("CLOUDINARY_CLOUD_NAME")
    cloud_api_key = os.getenv("CLOUDINARY_API_KEY")
    cloud_api_secret = os.getenv("CLOUDINARY_API_SECRET")
    app.config["CLOUDINARY_ENABLED"] = bool(cloudinary and cloud_name and cloud_api_key and cloud_api_secret)
    app.config["CLOUDINARY_FOLDER"] = os.getenv("CLOUDINARY_FOLDER", "postbytecl")
    if app.config["CLOUDINARY_ENABLED"]:
        cloudinary.config(
            cloud_name=cloud_name,
            api_key=cloud_api_key,
            api_secret=cloud_api_secret,
            secure=True,
        )

    cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
    parsed_cors_origins = [o.strip() for o in cors_origins if o.strip()]

    print(
        "[postbyte] startup: "
        f"vercel={bool(os.getenv('VERCEL'))} "
        f"database_url={'set' if os.getenv('DATABASE_URL') else 'missing'} "
        f"secret_key={secret_key_source} "
        f"max_upload_bytes={app.config['MAX_CONTENT_LENGTH']} "
        f"max_image_bytes={app.config['MAX_IMAGE_BYTES']} "
        f"upload_chunk_bytes={app.config['UPLOAD_CHUNK_BYTES']} "
        f"uploads_dir={app.config['UPLOADS_DIR']} "
        f"cloudinary={'on' if app.config['CLOUDINARY_ENABLED'] else 'off'} "
        f"image_storage={'cloudinary' if app.config['CLOUDINARY_ENABLED'] else 'database'} "
        f"cors_origins={parsed_cors_origins}",
        flush=True,
    )
    if secret_key_source == "derived":
        print(
            "[postbyte] warning: SECRET_KEY is not set; using a stable fallback "
            "derived from DATABASE_URL. Set SECRET_KEY in production.",
            flush=True,
        )

    # Captcha/session auth relies on browser cookies. For cross-origin frontend/api
    # deployments (e.g. separate Render domains), SameSite=None + Secure is required.
    has_non_local_origin = any(
        not (
            origin.startswith("http://localhost")
            or origin.startswith("https://localhost")
            or origin.startswith("http://127.0.0.1")
            or origin.startswith("https://127.0.0.1")
        )
        for origin in parsed_cors_origins
    )
    default_samesite = "None" if has_non_local_origin else "Lax"
    samesite = (os.getenv("SESSION_COOKIE_SAMESITE") or default_samesite).strip()
    if samesite.lower() == "none":
        samesite = "None"
    app.config["SESSION_COOKIE_SAMESITE"] = samesite

    secure_env = os.getenv("SESSION_COOKIE_SECURE")
    if secure_env is None:
        app.config["SESSION_COOKIE_SECURE"] = samesite == "None"
    else:
        app.config["SESSION_COOKIE_SECURE"] = secure_env.strip().lower() in {"1", "true", "yes", "on"}

    CORS(
        app,
        resources={r"/api/*": {"origins": parsed_cors_origins}},
        supports_credentials=True,
    )

    db.init_app(app)

    with app.app_context():
        try:
            db.create_all()
            _ensure_default_boards()
            _run_schema_migrations_if_needed()
        except Exception:
            app.logger.exception(
                "Database initialization failed. Check DATABASE_URL, Neon connectivity, and SSL settings."
            )
            raise

    @app.errorhandler(HTTPException)
    def handle_http_exception(e: HTTPException):
        # Make all /api/* errors return JSON (frontend expects JSON).
        if request.path.startswith("/api/"):
            return jsonify({"error": e.description or e.name, "status": e.code}), e.code
        return e

    @app.errorhandler(RequestEntityTooLarge)
    def handle_request_entity_too_large(e: RequestEntityTooLarge):
        # Flask raises this when MAX_CONTENT_LENGTH is exceeded. On Vercel,
        # requests above 4.5 MB are rejected before Flask runs, but this covers
        # the local/Render path and files just above our per-request limit.
        if request.path.startswith("/api/"):
            description = (e.description or "").strip()
            if not description or description == RequestEntityTooLarge.description:
                limit_mb = max(1, int(app.config["MAX_CONTENT_LENGTH"]) // (1024 * 1024))
                description = (
                    f"Request is too large. Maximum is {limit_mb} MB per request."
                )
            return jsonify({"error": description, "status": 413}), 413
        return e

    @app.after_request
    def disable_cache_for_auth(response):
        # Auth state depends on the session cookie. Never let a browser or edge
        # cache reuse a stale {"user": null} response after login.
        if (
            request.path.startswith(("/api/auth/", "/api/admin/", "/api/reports"))
            or request.path == "/api/captcha"
        ):
            response.headers["Cache-Control"] = "no-store"
        return response

    def _captcha_new() -> dict:
        chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
        text = "".join(secrets.choice(chars) for _ in range(5))
        captcha_id = secrets.token_urlsafe(16)
        # Keep only one active captcha in session to avoid cookie growth issues.
        session["captcha"] = {"id": captcha_id, "text": text, "exp": time.time() + 300}
        return {"id": captcha_id, "text": text}

    def _captcha_render_png(text: str) -> bytes:
        width, height = 140, 44
        img = Image.new("RGB", (width, height), (242, 244, 230))
        # draw minimal using PIL without fonts dependency: use default bitmap font via ImageDraw
        from PIL import ImageDraw  # local import

        draw = ImageDraw.Draw(img)
        # noise lines
        for _ in range(6):
            draw.line(
                (
                    secrets.randbelow(width),
                    secrets.randbelow(height),
                    secrets.randbelow(width),
                    secrets.randbelow(height),
                ),
                fill=(40, 70, 40),
                width=1,
            )
        # text
        x = 14
        for ch in text:
            y = 12 + secrets.randbelow(10) - 5
            draw.text((x, y), ch, fill=(27, 58, 27))
            x += 22
        # border
        draw.rectangle((0, 0, width - 1, height - 1), outline=(142, 164, 127), width=2)
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        return buf.getvalue()

    def _captcha_verify(captcha_id: str, answer: str) -> bool:
        item = session.get("captcha")
        if not isinstance(item, dict):
            return False
        if str(item.get("id", "")) != captcha_id:
            return False
        if not item:
            return False
        if float(item.get("exp", 0)) < time.time():
            session.pop("captcha", None)
            return False
        ok = (answer or "").strip().upper() == str(item.get("text", "")).upper()
        # one-time use
        session.pop("captcha", None)
        return ok

    def _current_user() -> User | None:
        uid = session.get("user_id")
        if not uid:
            return None
        return User.query.get(int(uid))

    def _require_login() -> User:
        u = _current_user()
        if not u:
            abort(401, description="Not authenticated")
        return u

    def _is_staff(user: User | None) -> bool:
        return bool(user and (user.role or "").strip().lower() in {"admin", "moderator"})

    def _require_admin_session() -> User:
        u = _require_login()
        if not _is_staff(u):
            abort(403, description="Admin access required")
        return u

    def _require_admin_access() -> User | None:
        u = _current_user()
        if _is_staff(u):
            return u
        _require_admin_key()
        return None

    def _rate_limit(action: str, min_interval_sec: int) -> None:
        """
        Basic anti-spam throttling per browser session.
        """
        now = time.time()
        limits = session.get("rate_limits") or {}
        if not isinstance(limits, dict):
            limits = {}
        last = float(limits.get(action, 0))
        if now - last < min_interval_sec:
            retry = int(min_interval_sec - (now - last)) + 1
            abort(429, description=f"Too many requests. Try again in ~{retry}s.")
        limits[action] = now
        session["rate_limits"] = limits

    @app.get("/api/captcha")
    def get_captcha():
        c = _captcha_new()
        png = _captcha_render_png(c["text"])
        data_url = "data:image/png;base64," + base64.b64encode(png).decode("ascii")
        return jsonify({"captchaId": c["id"], "image": data_url})

    @app.get("/api/auth/me")
    def auth_me():
        u = _current_user()
        return jsonify({"user": (u.to_public_dict(include_email=True) if u else None)})

    @app.post("/api/auth/logout")
    def auth_logout():
        session.pop("user_id", None)
        return jsonify({"ok": True})

    @app.post("/api/auth/register")
    def auth_register():
        data = request.get_json(silent=True) or {}
        email = (data.get("email") or "").strip().lower()
        username = (data.get("username") or "").strip()
        password = data.get("password") or ""
        captcha_id = (data.get("captchaId") or "").strip()
        captcha_answer = (data.get("captchaAnswer") or "").strip()

        if not _captcha_verify(captcha_id, captcha_answer):
            abort(400, description="Invalid captcha")

        if not email or "@" not in email or len(email) > 320:
            abort(400, description="Invalid email")
        # Allow Latin/Cyrillic letters, numbers, underscore, dash, dot.
        if not re.fullmatch(r"[\w.\-]{3,32}", username, flags=re.UNICODE):
            abort(400, description="Username: 3-32 chars (letters/numbers/_/./-)")
        if len(password) < 6:
            abort(400, description="Password must be at least 6 characters")

        if User.query.filter_by(email=email).first():
            abort(400, description="Email already registered")
        if User.query.filter_by(username=username).first():
            abort(400, description="Username already taken")

        u = User(
            email=email,
            username=username,
            password_hash=generate_password_hash(password),
            role="user",
        )
        db.session.add(u)
        db.session.commit()
        session["user_id"] = u.id
        return jsonify({"user": u.to_public_dict(include_email=True)})

    @app.post("/api/auth/login")
    def auth_login():
        data = request.get_json(silent=True) or {}
        login = (data.get("login") or "").strip()
        password = data.get("password") or ""
        captcha_id = (data.get("captchaId") or "").strip()
        captcha_answer = (data.get("captchaAnswer") or "").strip()

        if not _captcha_verify(captcha_id, captcha_answer):
            abort(400, description="Invalid captcha")

        u = None
        if "@" in login:
            u = User.query.filter_by(email=login.lower()).first()
        else:
            u = User.query.filter_by(username=login).first()

        if not u or not check_password_hash(u.password_hash, password):
            abort(400, description="Invalid credentials")

        session["user_id"] = u.id
        return jsonify({"user": u.to_public_dict(include_email=True)})

    @app.get("/api/users/<uid>")
    def get_user(uid: str):
        u = User.query.get(int(uid))
        if not u:
            abort(404, description="User not found")
        viewer = _current_user()
        return jsonify({"user": u.to_public_dict(include_email=(viewer is not None and viewer.id == u.id))})

    @app.patch("/api/users/me")
    def patch_me():
        u = _require_login()
        _rate_limit("profile_edit", 10)
        data = request.get_json(silent=True) or {}
        display_name = data.get("displayName")
        bio = data.get("bio")
        photo_url = data.get("photoURL")

        if display_name is not None:
            new_name = str(display_name).strip()
            if not re.fullmatch(r"[\w.\- ]{3,32}", new_name, flags=re.UNICODE):
                abort(400, description="Display name: 3-32 chars (letters/numbers/space/_/./-)")
            existing = User.query.filter_by(username=new_name).first()
            if existing and existing.id != u.id:
                abort(400, description="Display name is already taken")
            u.username = new_name

        if bio is not None:
            u.bio = str(bio)[:2000]
        if photo_url is not None:
            u.photo_url = str(photo_url)[:2000]
        db.session.commit()
        return jsonify({"user": u.to_public_dict(include_email=True)})

    @app.post("/api/users/me/avatar")
    def upload_my_avatar():
        u = _require_login()
        _rate_limit("avatar_upload", 20)
        uploaded = _handle_image_upload()
        u.photo_url = uploaded["url"]
        db.session.commit()
        return jsonify({"user": u.to_public_dict(include_email=True)})

    @app.get("/api/users/<uid>/posts")
    def list_user_posts(uid: str):
        u = User.query.get(int(uid))
        if not u:
            abort(404, description="User not found")
        posts = (
            Post.query.filter_by(author_user_id=u.id)
            .order_by(Post.created_at.desc())
            .limit(200)
            .all()
        )
        return jsonify([p.to_dict() for p in posts])

    @app.get("/api/admin/users")
    def admin_list_users():
        _require_admin_access()
        users = User.query.order_by(User.created_at.desc()).limit(200).all()
        return jsonify([u.to_public_dict(include_email=True) for u in users])

    @app.get("/api/admin/posts")
    def admin_list_posts():
        _require_admin_access()
        posts = Post.query.order_by(Post.created_at.desc()).limit(100).all()
        return jsonify([p.to_dict() for p in posts])

    @app.patch("/api/admin/users/<uid>/role")
    def admin_set_user_role(uid: str):
        actor = _require_admin_session()
        data = request.get_json(silent=True) or {}
        role = str(data.get("role") or "").strip().lower()
        if role not in {"admin", "moderator", "user"}:
            abort(400, description="role must be admin/moderator/user")
        target = User.query.get(int(uid))
        if not target:
            abort(404, description="User not found")
        # prevent accidental self-demotion for last admin style scenarios
        if actor.id == target.id and role == "user":
            abort(400, description="You cannot demote yourself to user")
        target.role = role
        db.session.commit()
        return jsonify({"user": target.to_public_dict(include_email=True)})

    @app.get("/api/admin/ip-actions")
    def admin_list_ip_actions():
        _require_admin_access()
        now = datetime.now(timezone.utc)
        bans = IpBan.query.order_by(IpBan.created_at.desc()).limit(200).all()
        mutes = IpMute.query.order_by(IpMute.created_at.desc()).limit(200).all()
        items: list[dict] = []
        for b in bans:
            item = b.to_dict()
            if b.expires_at and b.expires_at < now:
                item["active"] = False
            items.append(item)
        for m in mutes:
            item = m.to_dict()
            if m.expires_at and m.expires_at < now:
                item["active"] = False
            items.append(item)
        items.sort(key=lambda x: x.get("createdAt", ""), reverse=True)
        return jsonify(items[:300])

    @app.post("/api/admin/ip-actions")
    def admin_create_ip_action():
        actor = _require_admin_session()
        data = request.get_json(silent=True) or {}
        action_type = str(data.get("type") or "").strip().lower()
        ip = str(data.get("ip") or "").strip()
        reason = str(data.get("reason") or "").strip()
        duration_hours = data.get("durationHours")
        if action_type not in {"ban", "mute"}:
            abort(400, description="type must be ban/mute")
        if not ip:
            abort(400, description="ip is required")
        expires_at = None
        if duration_hours is not None and str(duration_hours).strip() != "":
            try:
                hours = float(duration_hours)
            except Exception:
                abort(400, description="durationHours must be numeric")
            if hours > 0:
                expires_at = datetime.now(timezone.utc) + timedelta(hours=hours)
        if action_type == "ban":
            obj = IpBan(ip=ip, reason=reason, expires_at=expires_at, created_by_user_id=actor.id, active=True)
        else:
            obj = IpMute(ip=ip, reason=reason, expires_at=expires_at, created_by_user_id=actor.id, active=True)
        db.session.add(obj)
        db.session.commit()
        return jsonify({"item": obj.to_dict()})

    @app.delete("/api/admin/ip-actions/<action_type>/<action_id>")
    def admin_disable_ip_action(action_type: str, action_id: str):
        _require_admin_session()
        action_type = action_type.strip().lower()
        model = IpBan if action_type == "ban" else IpMute if action_type == "mute" else None
        if model is None:
            abort(400, description="type must be ban/mute")
        item = model.query.get(int(action_id))
        if not item:
            abort(404, description="Action not found")
        item.active = False
        db.session.commit()
        return jsonify({"ok": True})

    @app.post("/api/admin/ip-actions/clear")
    def admin_clear_ip_actions():
        _require_admin_session()
        data = request.get_json(silent=True) or {}
        ip = str(data.get("ip") or "").strip()
        action_type = str(data.get("type") or "").strip().lower()
        if not ip:
            abort(400, description="ip is required")
        if action_type not in {"", "ban", "mute"}:
            abort(400, description="type must be ban/mute")

        changed = 0
        if action_type in {"", "ban"}:
            changed += (
                IpBan.query.filter_by(ip=ip, active=True)
                .update({"active": False}, synchronize_session=False)
            )
        if action_type in {"", "mute"}:
            changed += (
                IpMute.query.filter_by(ip=ip, active=True)
                .update({"active": False}, synchronize_session=False)
            )
        db.session.commit()
        return jsonify({"ok": True, "changed": int(changed)})

    @app.get("/api/health")
    def health():
        return jsonify({"ok": True, "time": datetime.now(timezone.utc).isoformat()})

    @app.get("/api/boards")
    def list_boards():
        boards = Board.query.order_by(Board.id.asc()).all()
        return jsonify([b.to_dict() for b in boards])

    @app.get("/api/boards/<board_id>")
    def get_board(board_id: str):
        b = Board.query.get(board_id)
        if not b:
            return jsonify(None)
        return jsonify(b.to_dict())

    @app.get("/api/boards/<board_id>/threads")
    def list_threads(board_id: str):
        _require_board(board_id)
        threads = (
            Thread.query.filter_by(board_id=board_id)
            .order_by(Thread.is_pinned.desc(), Thread.last_bump.desc())
            .all()
        )
        return jsonify([t.to_dict() for t in threads])

    @app.get("/api/boards/<board_id>/threads/<thread_id>")
    def get_thread(board_id: str, thread_id: str):
        t = _require_thread(board_id, thread_id)
        return jsonify(t.to_dict())

    @app.get("/api/boards/<board_id>/threads/<thread_id>/posts")
    def list_posts(board_id: str, thread_id: str):
        t = _require_thread(board_id, thread_id)
        posts = (
            Post.query.filter_by(board_id=board_id, thread_id=t.id)
            .order_by(Post.created_at.asc())
            .all()
        )
        return jsonify([p.to_dict() for p in posts])

    @app.post("/api/boards/<board_id>/threads")
    def create_thread(board_id: str):
        _require_board(board_id)
        _rate_limit("post_thread", 8)
        client_ip = _client_ip()
        _enforce_ip_restrictions(client_ip, for_posting=True)
        data = request.get_json(silent=True) or {}

        title = (data.get("title") or "").strip()
        author_name = (data.get("authorName") or "").strip()
        content = (data.get("content") or "").strip()
        image = data.get("image") or None
        current_user = _current_user()
        author_user_id: int | None = None

        if not content and not (isinstance(image, dict) and image.get("url")):
            abort(400, description="content or image is required")

        if not author_name:
            if current_user:
                author_name = current_user.username
                author_user_id = current_user.id
            else:
                author_name = "Anonymous"
        elif author_name.strip().lower() in {"anon", "anonymous", "анон"}:
            author_name = "Anonymous"

        t = Thread(board_id=board_id, title=title)
        db.session.add(t)
        db.session.flush()

        p = _create_post(
            board_id=board_id,
            thread_id=t.id,
            author_name=author_name,
            content=content,
            is_op=True,
            image=image,
            ip=client_ip,
            author_user_id=author_user_id,
        )
        db.session.add(p)

        if image:
            t.image_count = 1

        t.reply_count = 0
        t.last_bump = datetime.now(timezone.utc)
        db.session.commit()

        return jsonify(str(t.id))

    @app.post("/api/boards/<board_id>/threads/<thread_id>/posts")
    def create_reply(board_id: str, thread_id: str):
        t = _require_thread(board_id, thread_id)
        if t.is_locked:
            abort(400, description="Thread is locked")
        _rate_limit("post_reply", 6)
        client_ip = _client_ip()
        _enforce_ip_restrictions(client_ip, for_posting=True)

        data = request.get_json(silent=True) or {}
        author_name = (data.get("authorName") or "").strip()
        content = (data.get("content") or "").strip()
        image = data.get("image") or None
        current_user = _current_user()
        author_user_id: int | None = None

        if not content and not (isinstance(image, dict) and image.get("url")):
            abort(400, description="content or image is required")

        if not author_name:
            if current_user:
                author_name = current_user.username
                author_user_id = current_user.id
            else:
                author_name = "Anonymous"
        elif author_name.strip().lower() in {"anon", "anonymous", "анон"}:
            author_name = "Anonymous"

        p = _create_post(
            board_id=board_id,
            thread_id=t.id,
            author_name=author_name,
            content=content,
            is_op=False,
            image=image,
            ip=client_ip,
            author_user_id=author_user_id,
        )
        db.session.add(p)

        t.reply_count += 1
        if image:
            t.image_count += 1
        t.last_bump = datetime.now(timezone.utc)
        db.session.commit()
        return jsonify({"ok": True})

    @app.post("/api/reports")
    def create_report():
        _enforce_ip_restrictions(_client_ip(), for_posting=False)
        _rate_limit("report_post", 5)
        data = request.get_json(silent=True) or {}
        board_id = (data.get("boardId") or "").strip()
        thread_id = str(data.get("threadId") or "").strip()
        post_id = str(data.get("postId") or "").strip()
        reason = (data.get("reason") or "").strip()[:500]

        if not (board_id and thread_id and post_id and reason):
            abort(400, description="boardId, threadId, postId, reason are required")

        t = _require_thread(board_id, thread_id)
        try:
            post_id_int = int(post_id)
        except (TypeError, ValueError):
            abort(404, description="Post not found")

        p = Post.query.filter_by(board_id=board_id, thread_id=t.id, id=post_id_int).first()
        if not p:
            abort(404, description="Post not found")

        actor = _current_user()
        if actor and p.author_user_id and actor.id == p.author_user_id:
            abort(400, description="Нельзя пожаловаться на собственное сообщение")

        r = Report(
            board_id=board_id,
            thread_id=t.id,
            post_id=p.id,
            reason=reason,
            status="pending",
        )
        db.session.add(r)
        db.session.commit()
        return jsonify({"ok": True, "id": str(r.id)})

    @app.get("/api/reports")
    def list_reports():
        _require_admin_access()
        reports = Report.query.order_by(Report.created_at.desc()).limit(200).all()
        post_ids = {r.post_id for r in reports}
        posts_by_id = (
            {p.id: p.to_dict() for p in Post.query.filter(Post.id.in_(post_ids)).all()}
            if post_ids
            else {}
        )
        items = []
        for r in reports:
            item = r.to_dict()
            item["post"] = posts_by_id.get(r.post_id)
            items.append(item)
        return jsonify(items)

    @app.patch("/api/reports/<report_id>")
    def update_report_status(report_id: str):
        _require_admin_access()
        try:
            report_id_int = int(report_id)
        except (TypeError, ValueError):
            abort(404, description="Report not found")
        r = Report.query.get(report_id_int)
        if not r:
            abort(404, description="Report not found")
        data = request.get_json(silent=True) or {}
        status = str(data.get("status") or "resolved").strip().lower()
        if status not in {"pending", "resolved"}:
            abort(400, description="status must be pending or resolved")
        r.status = status
        db.session.commit()
        item = r.to_dict()
        p = Post.query.get(r.post_id)
        item["post"] = p.to_dict() if p else None
        return jsonify({"report": item})

    @app.delete("/api/boards/<board_id>/threads/<thread_id>/posts/<post_id>")
    def delete_post(board_id: str, thread_id: str, post_id: str):
        actor = _current_user()
        has_admin_access = _is_staff(actor) or _has_valid_admin_key()
        t = _require_thread(board_id, thread_id)
        try:
            post_id_int = int(post_id)
        except (TypeError, ValueError):
            abort(404, description="Post not found")
        p = Post.query.filter_by(board_id=board_id, thread_id=t.id, id=post_id_int).first()
        if not p:
            return jsonify({"ok": True, "deletedThread": False})
        is_post_owner = bool(actor and p.author_user_id and actor.id == p.author_user_id)
        if not (has_admin_access or is_post_owner):
            abort(403, description="You can delete only your own posts")

        if p.is_op:
            image_urls = [post.image_url for post in t.posts]
            Report.query.filter_by(board_id=board_id, thread_id=t.id).update(
                {"status": "resolved"}, synchronize_session=False
            )
            db.session.delete(t)
            db.session.commit()
            _cleanup_image_blobs(image_urls)
            return jsonify({"ok": True, "deletedThread": True})

        deleted_image_url = p.image_url
        Report.query.filter_by(board_id=board_id, thread_id=t.id, post_id=p.id).update(
            {"status": "resolved"}, synchronize_session=False
        )
        db.session.delete(p)
        t.reply_count = max(0, t.reply_count - 1)
        if p.image_url:
            t.image_count = max(0, t.image_count - 1)
        db.session.commit()
        _cleanup_image_blobs([deleted_image_url])
        return jsonify({"ok": True, "deletedThread": False})

    @app.get("/api/media-proxy")
    def media_proxy():
        """
        Fetch an external http(s) image/GIF so the browser-side NSFW detector
        can inspect frames even when the remote host omits CORS headers.
        """
        _rate_limit("media_proxy", 2)
        raw_url = (request.args.get("url") or "").strip()
        if not raw_url:
            abort(400, description="url is required")
        parsed = urlparse(raw_url)
        if parsed.scheme not in {"http", "https"} or not parsed.hostname:
            abort(400, description="Invalid URL")

        # SSRF protection: reject private, loopback, link-local, and reserved IPs.
        try:
            addr_infos = socket.getaddrinfo(parsed.hostname, parsed.port or (443 if parsed.scheme == "https" else 80))
        except socket.gaierror:
            abort(400, description="Cannot resolve media host")
        for info in addr_infos:
            ip_str = info[4][0]
            ip_obj = ipaddress.ip_address(ip_str)
            if (
                ip_obj.is_private
                or ip_obj.is_loopback
                or ip_obj.is_link_local
                or ip_obj.is_multicast
                or ip_obj.is_reserved
                or ip_obj.is_unspecified
            ):
                abort(400, description="Disallowed media host")

        max_bytes = min(current_app.config["MAX_CONTENT_LENGTH"], 4 * 1024 * 1024)
        req = UrlRequest(
            raw_url,
            headers={"User-Agent": "PostByte-NSFW-Proxy/1.0", "Accept": "image/*,*/*;q=0.5"},
        )
        try:
            with urlopen(req, timeout=8) as upstream:
                content_type = (upstream.headers.get("Content-Type") or "").split(";", 1)[0].strip().lower()
                if not content_type.startswith("image/"):
                    abort(400, description="URL does not point to an image or GIF")
                data = upstream.read(max_bytes + 1)
        except HTTPException:
            raise
        except Exception:
            abort(502, description="Failed to fetch remote media")

        if len(data) > max_bytes:
            abort(413, description="Remote media is too large to inspect")

        response = Response(data, mimetype=content_type)
        response.headers["Cache-Control"] = "private, max-age=300"
        response.headers["X-Content-Type-Options"] = "nosniff"
        return response

    @app.post("/api/uploads")
    def upload_image():
        return jsonify(_handle_image_upload())

    @app.post("/api/uploads/chunked/init")
    def upload_chunked_init():
        data = request.get_json(silent=True) or {}
        filename = str(data.get("filename") or "").strip()
        content_type = str(data.get("contentType") or "").strip()
        try:
            total_size = int(data.get("size"))
        except (TypeError, ValueError):
            abort(400, description="size is required")

        ext = _resolve_image_ext(filename, content_type)
        if not ext:
            abort(400, description="Only image uploads are allowed (PNG, JPG, GIF, WebP)")
        if total_size <= 0:
            abort(400, description="size is required")
        if total_size > current_app.config["MAX_IMAGE_BYTES"]:
            limit_mb = current_app.config["MAX_IMAGE_BYTES"] // (1024 * 1024)
            abort(413, description=f"Image is too large. Maximum is {limit_mb} MB.")

        _cleanup_stale_uploads()
        upload_id = secrets.token_urlsafe(18)
        db.session.add(
            UploadSession(
                id=upload_id,
                filename=filename[:255],
                content_type=(content_type or "application/octet-stream")[:100],
                total_size=total_size,
            )
        )
        db.session.commit()
        return jsonify(
            {
                "uploadId": upload_id,
                "chunkSize": current_app.config["UPLOAD_CHUNK_BYTES"],
            }
        )

    @app.post("/api/uploads/chunked/<upload_id>/<int:index>")
    def upload_chunk(upload_id: str, index: int):
        upload = db.session.get(UploadSession, upload_id)
        if not upload:
            abort(404, description="Upload session not found")

        chunk_size = current_app.config["UPLOAD_CHUNK_BYTES"]
        expected_chunks = (upload.total_size + chunk_size - 1) // chunk_size
        if index < 0 or index >= expected_chunks:
            abort(400, description="Invalid chunk index")

        raw = request.get_data(cache=False)
        if not raw:
            abort(400, description="Empty chunk")
        expected_len = min(chunk_size, upload.total_size - index * chunk_size)
        if len(raw) != expected_len:
            abort(400, description="Invalid chunk size")

        chunk = UploadChunk.query.filter_by(upload_id=upload_id, idx=index).first()
        if chunk:
            chunk.data = raw
            chunk.size = len(raw)
        else:
            db.session.add(
                UploadChunk(upload_id=upload_id, idx=index, data=raw, size=len(raw))
            )
        db.session.commit()
        return jsonify({"ok": True, "index": index, "received": len(raw)})

    @app.post("/api/uploads/chunked/<upload_id>/complete")
    def upload_chunked_complete(upload_id: str):
        upload = db.session.get(UploadSession, upload_id)
        if not upload:
            abort(404, description="Upload session not found")

        chunks = (
            UploadChunk.query.filter_by(upload_id=upload_id)
            .order_by(UploadChunk.idx.asc())
            .all()
        )
        chunk_size = current_app.config["UPLOAD_CHUNK_BYTES"]
        expected_chunks = (upload.total_size + chunk_size - 1) // chunk_size
        if len(chunks) != expected_chunks:
            abort(400, description="Upload is incomplete")
        if sum(int(chunk.size or 0) for chunk in chunks) != upload.total_size:
            abort(400, description="Upload is incomplete")

        raw = b"".join(bytes(chunk.data) for chunk in chunks)
        result = _store_image_bytes(raw, upload.filename, upload.content_type)

        UploadChunk.query.filter_by(upload_id=upload_id).delete(synchronize_session=False)
        db.session.delete(upload)
        db.session.commit()
        return jsonify(result)

    @app.delete("/api/uploads/chunked/<upload_id>")
    def upload_chunked_cancel(upload_id: str):
        UploadChunk.query.filter_by(upload_id=upload_id).delete(synchronize_session=False)
        UploadSession.query.filter_by(id=upload_id).delete(synchronize_session=False)
        db.session.commit()
        return jsonify({"ok": True})

    @app.get("/uploads/<path:filename>")
    def serve_upload(filename: str):
        blob = ImageBlob.query.filter_by(filename=filename).first()
        if blob:
            data = bytes(blob.data)
            content_type = blob.content_type or "application/octet-stream"
            cache_headers = {
                "Cache-Control": "public, max-age=31536000, immutable",
                "X-Content-Type-Options": "nosniff",
            }
            # Vercel limits non-streamed function responses to 4.5 MB. Large
            # images are streamed without Content-Length to stay under it.
            if len(data) <= current_app.config["MAX_CONTENT_LENGTH"]:
                response = Response(data, mimetype=content_type)
                response.headers["Content-Length"] = str(len(data))
                for key, value in cache_headers.items():
                    response.headers[key] = value
                return response

            def generate():
                for offset in range(0, len(data), 256 * 1024):
                    yield data[offset : offset + 256 * 1024]

            response = Response(stream_with_context(generate()), mimetype=content_type)
            for key, value in cache_headers.items():
                response.headers[key] = value
            return response
        # Legacy/local files that still exist on disk (Render disk, local dev).
        return send_from_directory(app.config["UPLOADS_DIR"], filename)

    return app


def _run_schema_migrations_if_needed() -> None:
    # Tiny runtime migration layer without Alembic:
    # add missing columns for older DBs to prevent startup/runtime failures.
    engine = db.engine
    inspector = inspect(engine)
    dialect_name = engine.dialect.name

    def _column_exists(table: str, col: str) -> bool:
        try:
            columns = inspector.get_columns(table)
        except Exception:
            return False
        return any(c.get("name") == col for c in columns)

    board_created_at_default = (
        "CURRENT_TIMESTAMP" if dialect_name == "sqlite" else "TIMEZONE('utc', NOW())"
    )

    with engine.begin() as conn:
        for table, col, ddl_sqlite, ddl_postgres in [
            (
                "boards",
                "category",
                "ALTER TABLE boards ADD COLUMN category TEXT NOT NULL DEFAULT 'Boards'",
                "ALTER TABLE boards ADD COLUMN category VARCHAR(100) NOT NULL DEFAULT 'Boards'",
            ),
            (
                "boards",
                "rules",
                "ALTER TABLE boards ADD COLUMN rules TEXT",
                "ALTER TABLE boards ADD COLUMN rules TEXT",
            ),
            (
                "boards",
                "created_at",
                f"ALTER TABLE boards ADD COLUMN created_at DATETIME NOT NULL DEFAULT {board_created_at_default}",
                f"ALTER TABLE boards ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT {board_created_at_default}",
            ),
        ]:
            if not _column_exists(table, col):
                conn.exec_driver_sql(ddl_sqlite if dialect_name == "sqlite" else ddl_postgres)

        # Keep current rows consistent for old databases.
        conn.exec_driver_sql("UPDATE boards SET category='Boards' WHERE category IS NULL OR category=''")

        if _column_exists("boards", "created_at"):
            conn.exec_driver_sql("UPDATE boards SET created_at=CURRENT_TIMESTAMP WHERE created_at IS NULL")

        for table, col, ddl in [
            ("users", "bio", "ALTER TABLE users ADD COLUMN bio TEXT NOT NULL DEFAULT ''"),
            ("users", "photo_url", "ALTER TABLE users ADD COLUMN photo_url TEXT NOT NULL DEFAULT ''"),
            ("posts", "author_user_id", "ALTER TABLE posts ADD COLUMN author_user_id INTEGER"),
        ]:
            if not _column_exists(table, col):
                conn.exec_driver_sql(ddl)

        # Consolidate legacy board ids into `help` and keep related data.
        has_miku = conn.exec_driver_sql("SELECT 1 FROM boards WHERE id='miku' LIMIT 1").fetchone() is not None
        has_nfsw = conn.exec_driver_sql("SELECT 1 FROM boards WHERE id='nfsw' LIMIT 1").fetchone() is not None
        has_help = conn.exec_driver_sql("SELECT 1 FROM boards WHERE id='help' LIMIT 1").fetchone() is not None

        if has_miku and not has_help and not has_nfsw:
            conn.exec_driver_sql("UPDATE boards SET id='help' WHERE id='miku'")
            conn.exec_driver_sql("UPDATE threads SET board_id='help' WHERE board_id='miku'")
            conn.exec_driver_sql("UPDATE posts SET board_id='help' WHERE board_id='miku'")
            conn.exec_driver_sql("UPDATE reports SET board_id='help' WHERE board_id='miku'")
        else:
            if has_miku:
                conn.exec_driver_sql("UPDATE threads SET board_id='help' WHERE board_id='miku'")
                conn.exec_driver_sql("UPDATE posts SET board_id='help' WHERE board_id='miku'")
                conn.exec_driver_sql("UPDATE reports SET board_id='help' WHERE board_id='miku'")
                conn.exec_driver_sql("DELETE FROM boards WHERE id='miku'")
            if has_nfsw:
                conn.exec_driver_sql("UPDATE threads SET board_id='help' WHERE board_id='nfsw'")
                conn.exec_driver_sql("UPDATE posts SET board_id='help' WHERE board_id='nfsw'")
                conn.exec_driver_sql("UPDATE reports SET board_id='help' WHERE board_id='nfsw'")
                conn.exec_driver_sql("DELETE FROM boards WHERE id='nfsw'")


_IMAGE_CONTENT_TYPES = {
    "PNG": "image/png",
    "JPEG": "image/jpeg",
    "GIF": "image/gif",
    "WEBP": "image/webp",
}
_IMAGE_EXTENSIONS = {
    "PNG": ".png",
    "JPEG": ".jpg",
    "GIF": ".gif",
    "WEBP": ".webp",
}
_IMAGE_MIME_TO_EXT = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/gif": ".gif",
    "image/webp": ".webp",
}
_ALLOWED_IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".gif", ".webp"}


def _resolve_image_ext(filename: str | None, content_type: str | None = None) -> str | None:
    ext = Path((filename or "").strip()).suffix.lower()
    if ext in _ALLOWED_IMAGE_EXTS:
        return ext
    mime = (content_type or "").split(";", 1)[0].strip().lower()
    return _IMAGE_MIME_TO_EXT.get(mime)


def _upload_filename_from_url(url: str | None) -> str | None:
    if not url:
        return None
    path = urlparse(str(url)).path
    prefix = "/uploads/"
    if not path.startswith(prefix):
        return None
    filename = path[len(prefix) :]
    if not filename or "/" in filename:
        return None
    return filename


def _cleanup_image_blobs(urls) -> None:
    """Delete DB-stored images that are no longer referenced by any post."""
    candidates = {name for name in (_upload_filename_from_url(url) for url in urls) if name}
    if not candidates:
        return
    try:
        remaining = {
            name
            for (url,) in Post.query.filter(Post.image_url.contains("/uploads/"))
            .with_entities(Post.image_url)
            .all()
            if (name := _upload_filename_from_url(url)) in candidates
        }
        for name in candidates - remaining:
            ImageBlob.query.filter_by(filename=name).delete(synchronize_session=False)
        db.session.commit()
    except Exception:
        db.session.rollback()
        current_app.logger.exception("Failed to clean up unused image blobs")


def _cleanup_stale_uploads(max_age_hours: int = 2) -> None:
    """Drop abandoned chunked uploads so their chunks don't fill the DB."""
    cutoff = datetime.now(timezone.utc) - timedelta(hours=max_age_hours)
    try:
        stale_ids = [
            row[0]
            for row in db.session.query(UploadSession.id)
            .filter(UploadSession.created_at < cutoff)
            .all()
        ]
        if not stale_ids:
            return
        UploadChunk.query.filter(UploadChunk.upload_id.in_(stale_ids)).delete(
            synchronize_session=False
        )
        UploadSession.query.filter(UploadSession.id.in_(stale_ids)).delete(
            synchronize_session=False
        )
        db.session.commit()
    except Exception:
        db.session.rollback()
        current_app.logger.exception("Failed to clean up stale upload sessions")


def _handle_image_upload() -> dict:
    if "file" not in request.files:
        abort(400, description="file is required")
    file = request.files["file"]
    if not file.filename:
        abort(400, description="file is required")
    raw = file.read()
    if not raw:
        abort(400, description="file is required")
    return _store_image_bytes(raw, file.filename, file.mimetype)


def _probe_image_metadata(raw: bytes) -> tuple[int, int, str]:
    """Validate uploaded image bytes and return (width, height, format)."""
    try:
        # verify() checks integrity without decoding the whole image; reopen to
        # read dimensions/format because the verified object is unusable.
        with Image.open(io.BytesIO(raw)) as probe:
            probe.verify()
        with Image.open(io.BytesIO(raw)) as img:
            width, height = img.size
            image_format = (img.format or "").upper()
            if image_format in _IMAGE_CONTENT_TYPES and width > 0 and height > 0:
                return width, height, image_format
    except Exception:
        pass

    # Some real-world animated GIFs (e.g. from Tenor/Discord/Telegram) have
    # minor trailing bytes or truncated final frames that fail strict verify()
    # while playing cleanly in every browser. Allow them if Pillow can still
    # read the GIF header and valid dimensions.
    if raw[:6] in {b"GIF87a", b"GIF89a"}:
        prev_truncated = ImageFile.LOAD_TRUNCATED_IMAGES
        try:
            ImageFile.LOAD_TRUNCATED_IMAGES = True
            with Image.open(io.BytesIO(raw)) as img:
                width, height = img.size
                image_format = (img.format or "").upper()
                if image_format == "GIF" and width > 0 and height > 0:
                    return width, height, "GIF"
        except Exception:
            pass
        finally:
            ImageFile.LOAD_TRUNCATED_IMAGES = prev_truncated

    abort(400, description="Invalid image")


def _store_image_bytes(
    raw: bytes,
    original_name: str,
    declared_content_type: str | None = None,
) -> dict:
    if not raw:
        abort(400, description="file is required")

    ext = _resolve_image_ext(original_name, declared_content_type)
    if not ext:
        abort(400, description="Only image uploads are allowed (PNG, JPG, GIF, WebP)")

    width, height, image_format = _probe_image_metadata(raw)
    content_type = _IMAGE_CONTENT_TYPES[image_format]
    stored_ext = _IMAGE_EXTENSIONS[image_format]

    # secure_filename() strips non-ASCII names (e.g. Cyrillic), so keep the
    # validated extension as a fallback for Cloudinary's display filename.
    safe = secure_filename(original_name or "") or ""
    if not Path(safe).suffix:
        safe = f"upload{stored_ext}"
    display_name = (original_name or "").strip() or f"image{stored_ext}"
    if not Path(display_name).suffix:
        display_name = f"{display_name}{stored_ext}"

    if current_app.config.get("CLOUDINARY_ENABLED"):
        try:
            uploaded = cloudinary.uploader.upload(
                io.BytesIO(raw),
                filename=safe,
                folder=current_app.config.get("CLOUDINARY_FOLDER", "postbytecl"),
                resource_type="image",
                use_filename=True,
                unique_filename=True,
                overwrite=False,
            )
            url = str(uploaded.get("secure_url") or uploaded.get("url") or "")
            if url:
                return {
                    "url": url,
                    "filename": display_name,
                    "size": int(uploaded.get("bytes") or len(raw)),
                    "width": int(uploaded.get("width") or width),
                    "height": int(uploaded.get("height") or height),
                }
            current_app.logger.warning(
                "Cloudinary upload returned no URL; storing image in the database instead"
            )
        except Exception:
            current_app.logger.exception(
                "Cloudinary upload failed; storing image in the database instead"
            )

    token = secrets.token_hex(8)
    stored_name = f"{int(datetime.now(timezone.utc).timestamp())}_{token}{stored_ext}"
    blob = ImageBlob(
        filename=stored_name,
        content_type=content_type,
        data=raw,
        size=len(raw),
        width=width,
        height=height,
    )
    try:
        db.session.add(blob)
        db.session.commit()
    except Exception:
        db.session.rollback()
        current_app.logger.exception("Failed to store uploaded image in the database")
        abort(500, description="Image storage failed")

    return {
        "url": f"/uploads/{stored_name}",
        "filename": display_name,
        "size": len(raw),
        "width": width,
        "height": height,
    }


def _ensure_default_boards() -> None:
    """
    Keep the instance aligned with the desired board list.

    Note: removing boards will cascade-delete their threads/posts due to model relationships.
    """
    desired = [
        {
            "id": "help",
            "name": "Help",
            "description": "Срочная помощь по всем вопросам.",
            "category": "Boards",
        },
        {
            "id": "meme",
            "name": "Meme",
            "description": "Мемы, картинки, пасты.",
            "category": "Boards",
        },
        {
            "id": "talk",
            "name": "Общалка (talk)",
            "description": "Свободное общение обо всём.",
            "category": "Boards",
        },
    ]

    desired_by_id = {b["id"]: b for b in desired}
    desired_ids = set(desired_by_id.keys())

    existing = Board.query.all()
    existing_ids = {b.id for b in existing}

    # Delete boards that are not desired anymore.
    for b in existing:
        if b.id not in desired_ids:
            db.session.delete(b)

    # Upsert desired boards.
    for bid, data in desired_by_id.items():
        b = Board.query.get(bid)
        if not b:
            db.session.add(Board(**data))
        else:
            b.name = data["name"]
            b.description = data["description"]
            b.category = data["category"]

    db.session.commit()


def _require_board(board_id: str) -> Board:
    b = Board.query.get(board_id)
    if not b:
        abort(404, description="Board not found")
    return b


def _require_thread(board_id: str, thread_id: str) -> Thread:
    _require_board(board_id)
    try:
        thread_id_int = int(thread_id)
    except (TypeError, ValueError):
        abort(404, description="Thread not found")
    t = Thread.query.filter_by(board_id=board_id, id=thread_id_int).first()
    if not t:
        abort(404, description="Thread not found")
    return t


def _sanitize_image_url(raw_url: str) -> str:
    url = raw_url.strip()
    if not url:
        return ""
    if url.startswith("/uploads/"):
        return url
    parsed = urlparse(url)
    if parsed.scheme in {"http", "https"} and parsed.netloc:
        return url
    abort(400, description="Invalid image URL")


def _create_post(
    *,
    board_id: str,
    thread_id: int,
    author_name: str,
    content: str,
    is_op: bool,
    image: dict | None,
    ip: str | None,
    author_user_id: int | None = None,
) -> Post:
    p = Post(
        board_id=board_id,
        thread_id=thread_id,
        author_user_id=author_user_id,
        author_name=author_name,
        content=content,
        is_op=is_op,
        ip=ip,
    )
    if image and isinstance(image, dict) and image.get("url"):
        p.image_url = _sanitize_image_url(str(image.get("url")))
        p.image_filename = str(image.get("filename") or "")[:500]
        p.image_size = int(image.get("size") or 0)
        p.image_width = int(image.get("width") or 0)
        p.image_height = int(image.get("height") or 0)
    return p


def _require_admin_key() -> None:
    if not _has_valid_admin_key():
        abort(403, description="Forbidden")


def _has_valid_admin_key() -> bool:
    expected = os.getenv("ADMIN_KEY")
    if not expected:
        return False
    got = request.headers.get("X-Admin-Key")
    return got == expected


def _client_ip() -> str | None:
    xf = request.headers.get("X-Forwarded-For")
    if xf:
        return xf.split(",")[0].strip()
    return request.remote_addr


def _enforce_ip_restrictions(ip: str | None, *, for_posting: bool) -> None:
    if not ip:
        return
    now = datetime.now(timezone.utc)
    active_ban = (
        IpBan.query.filter_by(ip=ip, active=True)
        .order_by(IpBan.created_at.desc())
        .first()
    )
    if active_ban:
        if active_ban.expires_at and active_ban.expires_at < now:
            active_ban.active = False
            db.session.commit()
        else:
            abort(403, description="Your IP is banned")
    if not for_posting:
        return
    active_mute = (
        IpMute.query.filter_by(ip=ip, active=True)
        .order_by(IpMute.created_at.desc())
        .first()
    )
    if active_mute:
        if active_mute.expires_at and active_mute.expires_at < now:
            active_mute.active = False
            db.session.commit()
        else:
            abort(403, description="Your IP is muted")


app = create_app()

