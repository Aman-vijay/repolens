import asyncio
import os
import asyncpg
from urllib.parse import urlparse

async def main():
    # Load database URL from environment or fallback to user's Neon connection
    url = os.environ.get("DATABASE_URL")
    if not url:
        url = "postgresql+asyncpg://neondb_owner:npg_zFn0Sc6BCPGh@ep-purple-boat-at9dg4rq-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
    
    # Standardize connection string for asyncpg
    url = url.replace("postgresql+asyncpg://", "postgresql://")
    parsed = urlparse(url)
    
    # Connect to the default database to execute CREATE DATABASE
    print("Connecting to Neon database server...")
    conn = await asyncpg.connect(
        user=parsed.username,
        password=parsed.password,
        host=parsed.hostname,
        port=parsed.port or 5432,
        database="neondb",
        ssl="require"
    )
    
    try:
        # Check if database exists
        exists = await conn.fetchval("SELECT 1 FROM pg_database WHERE datname = 'neondb_test'")
        if exists:
            print("Database 'neondb_test' already exists.")
        else:
            print("Creating database 'neondb_test'...")
            await conn.execute("CREATE DATABASE neondb_test")
            print("Database 'neondb_test' created successfully.")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(main())
