"""Test configuration with Testcontainers for real Postgres + Redis integration tests."""
import asyncio
import uuid
from typing import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from repolens_db import Base, User
from unittest.mock import patch, AsyncMock, MagicMock


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="session")
async def postgres_container():
    import os
    if os.environ.get("TEST_DATABASE_URL"):
        yield None
        return

    from testcontainers.postgres import PostgresContainer
    try:
        postgres = PostgresContainer("postgres:16-alpine")
        postgres.start()
        yield postgres
        postgres.stop()
    except Exception as e:
        raise RuntimeError(
            "\n[RepoLens Test Runner Error]\n"
            "Docker is not running and the TEST_DATABASE_URL environment variable is not set.\n"
            "To run integration tests without Docker, please:\n"
            "  1. Create a dedicated test database in your Neon console (e.g., 'neondb_test').\n"
            "  2. Set the TEST_DATABASE_URL environment variable pointing to this test database.\n"
            "     Example: TEST_DATABASE_URL=postgresql+asyncpg://neondb_owner:pass@ep-host.neon.tech/neondb_test?sslmode=require\n"
            "  WARNING: The test suite runs drop_all at the end, so NEVER set TEST_DATABASE_URL to your main development database."
        ) from e


@pytest_asyncio.fixture(scope="session")
async def db_url(postgres_container):
    import os
    test_url = os.environ.get("TEST_DATABASE_URL")
    if test_url:
        yield test_url
    else:
        yield postgres_container.get_connection_url().replace("postgres://", "postgresql+asyncpg://")


@pytest_asyncio.fixture(scope="session")
async def db_engine(db_url):
    from sqlalchemy.engine import make_url
    from sqlalchemy.pool import NullPool
    import os

    os.environ["DATABASE_URL"] = db_url

    url = make_url(db_url)
    if url.query:
        url = url.difference_update_query(set(url.query.keys()))

    connect_args = {}
    if "postgres" in url.drivername or "psycopg" in url.drivername:
        connect_args = {"ssl": "require"}

    engine = create_async_engine(
        url,
        pool_pre_ping=True,
        connect_args=connect_args,
        poolclass=NullPool
    )
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture(scope="session")
async def db_tables(db_engine):
    async with db_engine.begin() as conn:
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with db_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture(scope="session")
async def db_session_factory(db_engine, db_tables):
    factory = async_sessionmaker(db_engine, class_=AsyncSession, expire_on_commit=False)
    yield factory


@pytest_asyncio.fixture
async def db_session(db_session_factory) -> AsyncGenerator[AsyncSession, None]:
    async with db_session_factory() as session:
        yield session


@pytest_asyncio.fixture
async def fake_redis():
    import fakeredis.aioredis
    yield fakeredis.aioredis.FakeRedis()


@pytest_asyncio.fixture
async def client(db_session_factory, fake_redis) -> AsyncGenerator[AsyncClient, None]:
    from app.main import fastapi_app
    from app.deps import get_db_session
    from unittest.mock import AsyncMock, patch

    async def override_get_db():
        async with db_session_factory() as session:
            yield session

    app = fastapi_app

    app.dependency_overrides[get_db_session] = override_get_db

    mock_pool = AsyncMock()
    with patch("app.services.queue.get_arq_pool", return_value=mock_pool):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            yield ac

    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def authenticated_client(
    client: AsyncClient, db_session: AsyncSession
) -> AsyncClient:
    import uuid as uuid_lib
    from repolens_db import User
    from sqlalchemy import select

    # Avoid duplicate key value violates unique constraint ix_users_clerk_user_id
    result = await db_session.execute(select(User).where(User.clerk_user_id == "test_clerk_user_123"))
    user = result.scalar_one_or_none()
    if not user:
        user = User(
            id=uuid_lib.uuid4(),
            clerk_user_id="test_clerk_user_123",
            email="test@example.com",
            is_superuser=False,
        )
        db_session.add(user)
        await db_session.commit()
        await db_session.refresh(user)

    client.headers["Authorization"] = "Bearer test_token"

    with patch("app.deps._get_clerk_client") as mock_clerk:
        mock_state = MagicMock()
        mock_state.is_signed_in = True
        mock_state.payload = {"sub": "test_clerk_user_123", "email": "test@example.com"}
        mock_state.reason = "test"

        mock_clerk.return_value.authenticate_request.return_value = mock_state
        yield client


@pytest_asyncio.fixture
async def superuser_client(
    client: AsyncClient, db_session: AsyncSession
) -> AsyncClient:
    import uuid as uuid_lib
    from repolens_db import User
    from sqlalchemy import select

    # Avoid duplicate key value violates unique constraint ix_users_clerk_user_id
    result = await db_session.execute(select(User).where(User.clerk_user_id == "test_superuser_123"))
    user = result.scalar_one_or_none()
    if not user:
        user = User(
            id=uuid_lib.uuid4(),
            clerk_user_id="test_superuser_123",
            email="super@example.com",
            is_superuser=True,
        )
        db_session.add(user)
        await db_session.commit()
        await db_session.refresh(user)

    client.headers["Authorization"] = "Bearer test_superuser_token"

    with patch("app.deps._get_clerk_client") as mock_clerk:
        mock_state = MagicMock()
        mock_state.is_signed_in = True
        mock_state.payload = {"sub": "test_superuser_123", "email": "super@example.com"}
        mock_state.reason = "test"

        mock_clerk.return_value.authenticate_request.return_value = mock_state
        yield client


@pytest.fixture
def sample_user(db_session: AsyncSession) -> User:
    import uuid as uuid_lib
    from repolens_db import User

    user = User(
        id=uuid_lib.uuid4(),
        clerk_user_id=f"test_user_{uuid_lib.uuid4().hex[:8]}",
        email="user@example.com",
        is_superuser=False,
    )
    db_session.add(user)
    return user
