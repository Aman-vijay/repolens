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


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="session")
async def postgres_container():
    from testcontainers.postgres import PostgresContainer

    postgres = PostgresContainer("postgres:16-alpine")
    postgres.start()
    yield postgres
    postgres.stop()


@pytest_asyncio.fixture(scope="session")
async def db_url(postgres_container):
    yield postgres_container.get_connection_url().replace("postgres://", "postgresql+asyncpg://")


@pytest_asyncio.fixture(scope="session")
async def db_engine(db_url):
    from repolens_db.engine import _build_url, get_engine
    import os

    os.environ["DATABASE_URL"] = db_url

    engine = create_async_engine(db_url, pool_pre_ping=True)
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture(scope="session")
async def db_tables(db_engine):
    async with db_engine.begin() as conn:
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
    from unittest.mock import patch

    async def override_get_db():
        async with db_session_factory() as session:
            yield session

    app = fastapi_app

    app.dependency_overrides[get_db_session] = override_get_db

    with patch("app.services.queue.get_redis") as mock_redis:
        mock_redis.return_value = fake_redis
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

    with pytest.mock.patch("app.deps._get_clerk_client") as mock_clerk:
        from clerk_backend_api.security.types import AuthenticateRequestResult

        mock_state = AuthenticateRequestResult(
            is_signed_in=True,
            payload={"sub": "test_clerk_user_123", "email": "test@example.com"},
            reason="test",
        )
        mock_clerk.return_value.authenticate_request.return_value = mock_state
        yield client


@pytest_asyncio.fixture
async def superuser_client(
    client: AsyncClient, db_session: AsyncSession
) -> AsyncClient:
    import uuid as uuid_lib
    from repolens_db import User

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

    with pytest.mock.patch("app.deps._get_clerk_client") as mock_clerk:
        from clerk_backend_api.security.types import AuthenticateRequestResult

        mock_state = AuthenticateRequestResult(
            is_signed_in=True,
            payload={"sub": "test_superuser_123", "email": "super@example.com"},
            reason="test",
        )
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
