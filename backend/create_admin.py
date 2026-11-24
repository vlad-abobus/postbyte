from __future__ import annotations

import argparse
import getpass
import os
import re
import sys


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Create or update an administrator account.",
    )
    parser.add_argument("--username", required=True, help="Login username, e.g. vlad_adm")
    parser.add_argument(
        "--password",
        default=None,
        help="Password. If omitted, the script asks for it without echoing.",
    )
    parser.add_argument(
        "--email",
        default=None,
        help="Email. Defaults to <username>@postbyte.local.",
    )
    parser.add_argument(
        "--role",
        default="admin",
        choices=["admin", "moderator", "user"],
        help="Role to assign (default: admin).",
    )
    parser.add_argument(
        "--database-url",
        default=None,
        help="Optional SQLAlchemy database URL. Overrides DATABASE_URL for this run.",
    )
    return parser.parse_args()


def main() -> int:
    args = _parse_args()

    username = args.username.strip()
    if not re.fullmatch(r"[\w.\-]{3,32}", username, flags=re.UNICODE):
        print("Error: username must be 3-32 chars (letters/numbers/_/./-)", file=sys.stderr)
        return 1

    password = args.password
    if password is None:
        password = getpass.getpass("Password: ")
        confirm = getpass.getpass("Confirm password: ")
        if password != confirm:
            print("Error: passwords do not match", file=sys.stderr)
            return 1
    if len(password) < 6:
        print("Error: password must be at least 6 characters", file=sys.stderr)
        return 1

    email = (args.email or f"{username}@postbyte.local").strip().lower()
    if "@" not in email or len(email) > 320:
        print("Error: invalid email", file=sys.stderr)
        return 1

    if args.database_url:
        os.environ["DATABASE_URL"] = args.database_url

    # Import after applying --database-url so create_app() uses the right DB.
    if __package__:
        from .app import app
        from .db import db
        from .models import User
    else:
        from app import app
        from db import db
        from models import User

    from werkzeug.security import generate_password_hash

    with app.app_context():
        by_username = User.query.filter_by(username=username).first()
        by_email = User.query.filter_by(email=email).first()
        if by_username and by_email and by_username.id != by_email.id:
            print(
                "Error: this username and email belong to different users",
                file=sys.stderr,
            )
            return 1

        user = by_username or by_email
        if user:
            user.username = username
            user.email = email
            user.password_hash = generate_password_hash(password)
            user.role = args.role
            action = "updated"
        else:
            user = User(
                email=email,
                username=username,
                password_hash=generate_password_hash(password),
                role=args.role,
            )
            db.session.add(user)
            action = "created"

        db.session.commit()
        print(
            f"{action} user: id={user.id} username={user.username} "
            f"email={user.email} role={user.role}"
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
