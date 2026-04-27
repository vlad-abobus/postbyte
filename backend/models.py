from __future__ import annotations

from datetime import datetime, timezone

from .db import db


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    email = db.Column(db.String(320), unique=True, nullable=False, index=True)
    username = db.Column(db.String(32), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), nullable=False, default="user")
    bio = db.Column(db.Text, nullable=False, default="")
    photo_url = db.Column(db.Text, nullable=False, default="")
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)

    def to_public_dict(self, *, include_email: bool = False) -> dict:
        return {
            "uid": str(self.id),
            "email": self.email if include_email else "",
            "role": self.role,
            "displayName": self.username,
            "photoURL": self.photo_url or "",
            "bio": self.bio or "",
            "createdAt": self.created_at.isoformat(),
        }


class Board(db.Model):
    __tablename__ = "boards"

    id = db.Column(db.String(32), primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    description = db.Column(db.String(500), nullable=False)
    category = db.Column(db.String(100), nullable=False)
    rules = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)

    threads = db.relationship("Thread", back_populates="board", cascade="all, delete-orphan")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "category": self.category,
            "rules": self.rules,
            "createdAt": self.created_at.isoformat(),
        }


class Thread(db.Model):
    __tablename__ = "threads"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    board_id = db.Column(db.String(32), db.ForeignKey("boards.id"), nullable=False, index=True)
    title = db.Column(db.String(300), nullable=False, default="")
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)
    last_bump = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow, index=True)
    is_archived = db.Column(db.Boolean, nullable=False, default=False)
    is_pinned = db.Column(db.Boolean, nullable=False, default=False)
    is_locked = db.Column(db.Boolean, nullable=False, default=False)
    reply_count = db.Column(db.Integer, nullable=False, default=0)
    image_count = db.Column(db.Integer, nullable=False, default=0)

    board = db.relationship("Board", back_populates="threads")
    posts = db.relationship("Post", back_populates="thread", cascade="all, delete-orphan")

    def to_dict(self) -> dict:
        return {
            "id": str(self.id),
            "boardId": self.board_id,
            "title": self.title,
            "createdAt": self.created_at.isoformat(),
            "lastBump": self.last_bump.isoformat(),
            "isArchived": self.is_archived,
            "isPinned": self.is_pinned,
            "isLocked": self.is_locked,
            "replyCount": self.reply_count,
            "imageCount": self.image_count,
        }


class Post(db.Model):
    __tablename__ = "posts"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    board_id = db.Column(db.String(32), db.ForeignKey("boards.id"), nullable=False, index=True)
    thread_id = db.Column(db.Integer, db.ForeignKey("threads.id"), nullable=False, index=True)
    author_user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True, index=True)
    author_name = db.Column(db.String(100), nullable=False, default="Anonymous")
    content = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow, index=True)
    is_op = db.Column(db.Boolean, nullable=False, default=False)

    image_url = db.Column(db.Text, nullable=True)
    image_filename = db.Column(db.String(500), nullable=True)
    image_size = db.Column(db.Integer, nullable=True)
    image_width = db.Column(db.Integer, nullable=True)
    image_height = db.Column(db.Integer, nullable=True)

    ip = db.Column(db.String(64), nullable=True)

    thread = db.relationship("Thread", back_populates="posts")
    author_user = db.relationship("User")

    def to_dict(self) -> dict:
        image = None
        if self.image_url:
            image = {
                "url": self.image_url,
                "filename": self.image_filename or "",
                "width": self.image_width or 0,
                "height": self.image_height or 0,
                "size": self.image_size or 0,
            }

        author_uid = str(self.author_user_id) if self.author_user_id else None
        author_role = self.author_user.role if self.author_user else None

        return {
            "id": str(self.id),
            "threadId": str(self.thread_id),
            "boardId": self.board_id,
            "authorName": self.author_name,
            "authorUid": author_uid,
            "authorRole": author_role,
            "content": self.content,
            "createdAt": self.created_at.isoformat(),
            "image": image,
            "ip": self.ip,
            "isOp": self.is_op,
        }


class Report(db.Model):
    __tablename__ = "reports"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    board_id = db.Column(db.String(32), nullable=False, index=True)
    thread_id = db.Column(db.Integer, nullable=False, index=True)
    post_id = db.Column(db.Integer, nullable=False, index=True)
    reason = db.Column(db.Text, nullable=False)
    status = db.Column(db.String(20), nullable=False, default="pending")
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow, index=True)

    def to_dict(self) -> dict:
        return {
            "id": str(self.id),
            "boardId": self.board_id,
            "threadId": str(self.thread_id),
            "postId": str(self.post_id),
            "reason": self.reason,
            "status": self.status,
            "createdAt": self.created_at.isoformat(),
        }


class IpBan(db.Model):
    __tablename__ = "ip_bans"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    ip = db.Column(db.String(64), nullable=False, index=True)
    reason = db.Column(db.Text, nullable=False, default="")
    expires_at = db.Column(db.DateTime(timezone=True), nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow, index=True)
    created_by_user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    active = db.Column(db.Boolean, nullable=False, default=True, index=True)

    created_by_user = db.relationship("User")

    def to_dict(self) -> dict:
        return {
            "id": str(self.id),
            "ip": self.ip,
            "reason": self.reason,
            "expiresAt": self.expires_at.isoformat() if self.expires_at else None,
            "createdAt": self.created_at.isoformat(),
            "createdBy": str(self.created_by_user_id) if self.created_by_user_id else None,
            "active": self.active,
            "type": "ban",
        }


class IpMute(db.Model):
    __tablename__ = "ip_mutes"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    ip = db.Column(db.String(64), nullable=False, index=True)
    reason = db.Column(db.Text, nullable=False, default="")
    expires_at = db.Column(db.DateTime(timezone=True), nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow, index=True)
    created_by_user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    active = db.Column(db.Boolean, nullable=False, default=True, index=True)

    created_by_user = db.relationship("User")

    def to_dict(self) -> dict:
        return {
            "id": str(self.id),
            "ip": self.ip,
            "reason": self.reason,
            "expiresAt": self.expires_at.isoformat() if self.expires_at else None,
            "createdAt": self.created_at.isoformat(),
            "createdBy": str(self.created_by_user_id) if self.created_by_user_id else None,
            "active": self.active,
            "type": "mute",
        }

