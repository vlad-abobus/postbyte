from __future__ import annotations

import base64
import io
import os
import re
import secrets
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

from sqlalchemy import inspect

try:
    import cloudinary
    import cloudinary.uploader
except Exception:
    cloudinary = None
from dotenv import load_dotenv
from flask import Flask, abort, current_app, jsonify, request, send_from_directory, session
from flask_cors import CORS
from PIL import Image
from werkzeug.exceptions import HTTPException
from werkzeug.security import check_password_hash, generate_password_hash
from werkzeug.utils import secure_filename

from .db import db
from .models import Board, IpBan, IpMute, Post, Report, Thread, User


def create_app() -> Flask:
    load_dotenv()

    app = Flask(__name__)
    app.config["JSON_SORT_KEYS"] = False
    app.config["MAX_CONTENT_LENGTH"] = int(os.getenv("MAX_UPLOAD_BYTES", str(5 * 1024 * 1024)))
    app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", secrets.token_hex(32))
    app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
    app.config["SESSION_COOKIE_HTTPONLY"] = True

    database_url = (os.getenv("DATABASE_URL") or "").strip()
    if not database_url:
        database_url = "postgresql+psycopg://postgres:postgres@localhost:5432/postbytecl"
    elif database_url.startswith("postgres://"):
        # Some providers still expose the old scheme; SQLAlchemy expects postgresql://.
        database_url = "postgresql://" + database_url[len("postgres://") :]
    app.config["SQLALCHEMY_DATABASE_URI"] = database_url
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

    uploads_dir_raw = os.getenv("UPLOADS_DIR", "uploads")
    uploads_dir = Path(uploads_dir_raw).resolve()
    try:
        uploads_dir.mkdir(parents=True, exist_ok=True)
    except OSError:
        # On some hosts (e.g. misconfigured Render service without a mounted disk),
        # absolute paths like /var/data may be unavailable. Fallback to local uploads.
        fallback_uploads_dir = (Path(__file__).resolve().parent.parent / "uploads").resolve()
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
    CORS(
        app,
        resources={r"/api/*": {"origins": [o.strip() for o in cors_origins if o.strip()]}},
        supports_credentials=True,
    )

    db.init_app(app)

    with app.app_context():
        db.create_all()
        _ensure_default_boards()
        _run_schema_migrations_if_needed()

    @app.errorhandler(HTTPException)
    def handle_http_exception(e: HTTPException):
        # Make all /api/* errors return JSON (frontend expects JSON).
        if request.path.startswith("/api/"):
            return jsonify({"error": e.description or e.name, "status": e.code}), e.code
        return e

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

    def _require_admin_session() -> User:
        u = _require_login()
        if u.role not in {"admin", "moderator"}:
            abort(403, description="Admin access required")
        return u

    def _require_admin_access() -> User | None:
        u = _current_user()
        if u and u.role in {"admin", "moderator"}:
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

        if not content:
            abort(400, description="content is required")

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

        if not content:
            abort(400, description="content is required")

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
        data = request.get_json(silent=True) or {}
        board_id = (data.get("boardId") or "").strip()
        thread_id = str(data.get("threadId") or "").strip()
        post_id = str(data.get("postId") or "").strip()
        reason = (data.get("reason") or "").strip()

        if not (board_id and thread_id and post_id and reason):
            abort(400, description="boardId, threadId, postId, reason are required")

        _require_thread(board_id, thread_id)
        r = Report(
            board_id=board_id,
            thread_id=int(thread_id),
            post_id=int(post_id),
            reason=reason,
            status="pending",
        )
        db.session.add(r)
        db.session.commit()
        return jsonify({"ok": True})

    @app.get("/api/reports")
    def list_reports():
        _require_admin_access()
        reports = Report.query.order_by(Report.created_at.desc()).all()
        return jsonify([r.to_dict() for r in reports])

    @app.delete("/api/boards/<board_id>/threads/<thread_id>/posts/<post_id>")
    def delete_post(board_id: str, thread_id: str, post_id: str):
        actor = _current_user()
        has_admin_access = bool(actor and actor.role in {"admin", "moderator"}) or _has_valid_admin_key()
        t = _require_thread(board_id, thread_id)
        p = Post.query.filter_by(board_id=board_id, thread_id=t.id, id=int(post_id)).first()
        if not p:
            return jsonify({"ok": True})
        is_post_owner = bool(actor and p.author_user_id and actor.id == p.author_user_id)
        if not (has_admin_access or is_post_owner):
            abort(403, description="You can delete only your own posts")

        if p.is_op:
            db.session.delete(t)
            db.session.commit()
            return jsonify({"ok": True})

        db.session.delete(p)
        t.reply_count = max(0, t.reply_count - 1)
        if p.image_url:
            t.image_count = max(0, t.image_count - 1)
        db.session.commit()
        return jsonify({"ok": True})

    @app.post("/api/uploads")
    def upload_image():
        return jsonify(_handle_image_upload())

    @app.get("/uploads/<path:filename>")
    def serve_upload(filename: str):
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
            cols = {row[1] for row in conn.exec_driver_sql(f"PRAGMA table_info({table})").fetchall()}
            if col not in cols:
                conn.exec_driver_sql(ddl)

        # Rename board id `miku` -> `nfsw` and keep related data.
        has_miku = conn.exec_driver_sql("SELECT 1 FROM boards WHERE id='miku' LIMIT 1").fetchone() is not None
        has_nfsw = conn.exec_driver_sql("SELECT 1 FROM boards WHERE id='nfsw' LIMIT 1").fetchone() is not None
        if has_miku and not has_nfsw:
            conn.exec_driver_sql("UPDATE boards SET id='nfsw' WHERE id='miku'")
            conn.exec_driver_sql("UPDATE threads SET board_id='nfsw' WHERE board_id='miku'")
            conn.exec_driver_sql("UPDATE posts SET board_id='nfsw' WHERE board_id='miku'")
            conn.exec_driver_sql("UPDATE reports SET board_id='nfsw' WHERE board_id='miku'")
        elif has_miku and has_nfsw:
            # If both exist, migrate references then drop old board row.
            conn.exec_driver_sql("UPDATE threads SET board_id='nfsw' WHERE board_id='miku'")
            conn.exec_driver_sql("UPDATE posts SET board_id='nfsw' WHERE board_id='miku'")
            conn.exec_driver_sql("UPDATE reports SET board_id='nfsw' WHERE board_id='miku'")
            conn.exec_driver_sql("DELETE FROM boards WHERE id='miku'")


def _handle_image_upload() -> dict:
    if "file" not in request.files:
        abort(400, description="file is required")
    file = request.files["file"]
    if not file.filename:
        abort(400, description="file is required")

    original_name = file.filename
    safe = secure_filename(original_name) or "upload"
    ext = Path(safe).suffix.lower()
    if ext not in {".png", ".jpg", ".jpeg", ".gif", ".webp"}:
        abort(400, description="Only image uploads are allowed")

    if current_app.config.get("CLOUDINARY_ENABLED"):
        # Validate that payload is actually an image before forwarding to Cloudinary.
        try:
            with Image.open(file.stream) as img:
                local_width, local_height = img.size
        except Exception:
            abort(400, description="Invalid image")
        finally:
            try:
                file.stream.seek(0)
            except Exception:
                pass

        try:
            uploaded = cloudinary.uploader.upload(
                file,
                folder=current_app.config.get("CLOUDINARY_FOLDER", "postbytecl"),
                resource_type="image",
                use_filename=True,
                unique_filename=True,
                overwrite=False,
            )
        except Exception:
            abort(500, description="Cloudinary upload failed")

        return {
            "url": str(uploaded.get("secure_url") or uploaded.get("url") or ""),
            "filename": original_name,
            "size": int(uploaded.get("bytes") or 0),
            "width": int(uploaded.get("width") or local_width),
            "height": int(uploaded.get("height") or local_height),
        }

    token = secrets.token_hex(8)
    stored_name = f"{int(datetime.now(timezone.utc).timestamp())}_{token}{ext}"
    stored_path = Path(current_app.config["UPLOADS_DIR"]) / stored_name
    file.save(stored_path)

    width = height = 0
    try:
        with Image.open(stored_path) as img:
            width, height = img.size
    except Exception:
        stored_path.unlink(missing_ok=True)
        abort(400, description="Invalid image")

    size = stored_path.stat().st_size
    public_url = f"/uploads/{stored_name}"
    return {
        "url": public_url,
        "filename": original_name,
        "size": size,
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
            "id": "nfsw",
            "name": "NFSW",
            "description": "18+; здесь все картинки под спойлером.",
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
    t = Thread.query.filter_by(board_id=board_id, id=int(thread_id)).first()
    if not t:
        abort(404, description="Thread not found")
    return t


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
        p.image_url = str(image.get("url"))
        p.image_filename = str(image.get("filename") or "")
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

