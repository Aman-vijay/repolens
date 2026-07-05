"""Embedding service — generate embeddings via OpenAI text-embedding-3-small.

Called by the ARQ worker after chunking. Batches chunks to minimize API calls
(OpenAI supports up to 2048 inputs per embeddings request).
"""
import os

import structlog
from openai import OpenAI

logger = structlog.get_logger()

EMBEDDING_MODEL = "text-embedding-3-small"
EMBEDDING_DIM = 1536
MAX_BATCH_SIZE = 100


def _get_client() -> OpenAI:
    return OpenAI(api_key=os.environ.get("OPENAI_API_KEY", ""))


def embed_texts(texts: list[str]) -> list[list[float]]:
    """Generate embeddings for a list of texts. Returns list of float vectors."""
    if not texts:
        return []

    client = _get_client()
    all_embeddings: list[list[float]] = []

    for i in range(0, len(texts), MAX_BATCH_SIZE):
        batch = texts[i:i + MAX_BATCH_SIZE]
        resp = client.embeddings.create(
            model=EMBEDDING_MODEL,
            input=batch,
        )
        all_embeddings.extend([d.embedding for d in resp.data])
        logger.info(
            "embed_batch",
            batch_index=i // MAX_BATCH_SIZE,
            batch_size=len(batch),
        )

    return all_embeddings


def embed_query(query: str) -> list[float]:
    """Generate embedding for a single search query."""
    client = _get_client()
    resp = client.embeddings.create(
        model=EMBEDDING_MODEL,
        input=query,
    )
    return resp.data[0].embedding