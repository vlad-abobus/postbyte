import os
import time
from time import sleep
import click
from flask.cli import with_appcontext
from sqlalchemy.exc import OperationalError

from backend.app import create_app, _ensure_default_boards, _run_schema_migrations_if_needed
from backend.db import db

# Create the app instance used by the CLI. This intentionally does not run
# schema creation on import — the CLI will handle that with retries.
app = create_app()


@click.command("init-db")
@with_appcontext
def init_db_command():
    """Wait for DB and initialize schema (safe for deployments)."""
    timeout = int(os.getenv("DB_INIT_TIMEOUT", "60"))
    start = time.time()
    while True:
        try:
            db.create_all()
            # Ensure default rows and migrations are applied.
            try:
                _ensure_default_boards()
            except Exception:
                # Non-fatal: keep going if defaults can't be applied.
                pass
            try:
                _run_schema_migrations_if_needed()
            except Exception:
                # Non-fatal: migrations are best-effort here.
                pass
            click.echo("Database initialized")
            return
        except OperationalError as e:
            if time.time() - start > timeout:
                raise click.ClickException(f"Timed out waiting for DB: {e}")
            click.echo("Database not ready, retrying in 2s...", err=True)
            sleep(2)


# Register the CLI command so `flask init-db` works.
app.cli.add_command(init_db_command)
