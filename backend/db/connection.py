import os
import asyncpg
import bcrypt
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

pool: asyncpg.Pool | None = None


async def get_pool() -> asyncpg.Pool:
    global pool
    if pool is None:
        raise RuntimeError("Database pool not initialized")
    return pool


async def init_db():
    """Initialize the database connection pool, run schema, and seed admin."""
    global pool
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL environment variable is required")

    pool = await asyncpg.create_pool(database_url, min_size=2, max_size=10)

    # Run schema
    schema_path = Path(__file__).parent / "schema.sql"
    schema_sql = schema_path.read_text()
    async with pool.acquire() as conn:
        await conn.execute(schema_sql)

    logger.info("Database schema initialized")

    # Seed admin
    await seed_admin()


async def seed_admin():
    """Create the sysadmin account from environment variables if it doesn't exist."""
    admin_username = os.getenv("ADMIN_USERNAME")
    admin_password = os.getenv("ADMIN_PASSWORD")

    if not all([admin_username, admin_password]):
        logger.warning("ADMIN_USERNAME, ADMIN_PASSWORD not all set - skipping admin seed")
        return

    async with pool.acquire() as conn:
        existing = await conn.fetchrow("SELECT id FROM users WHERE username = $1", admin_username)
        if existing:
            logger.info("Admin account already exists")
            return

        password_hash = bcrypt.hashpw(admin_password.encode(), bcrypt.gensalt()).decode()
        await conn.execute(
            """INSERT INTO users (username, display_name, password_hash, role)
               VALUES ($1, $2, $3, 'admin')""",
            admin_username, admin_username, password_hash,
        )
        logger.info(f"Admin account created: {admin_username}")


async def close_db():
    """Close the database connection pool."""
    global pool
    if pool:
        await pool.close()
        pool = None
        logger.info("Database pool closed")
