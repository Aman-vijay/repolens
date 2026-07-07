"""Tests for search feature - semantic and text search."""
import pytest
import uuid
from unittest.mock import AsyncMock, patch, MagicMock

from app.services.search_engine import SemanticSearcher, TextSearcher, FileSearcher


class TestSemanticSearcher:
    """Test SemanticSearcher with mocked embeddings."""

    @pytest.mark.asyncio
    async def test_search_returns_relevant_chunks(self):
        """Test that SemanticSearcher returns relevant chunks based on query."""
        mock_db = AsyncMock()
        mock_embedding = [0.1] * 1536
        repo_id = uuid.uuid4()

        with patch("app.services.search_engine.get_query_embedding") as mock_get_emb:
            mock_get_emb.return_value = mock_embedding

            mock_chunk = MagicMock()
            mock_chunk.file_path = "test.py"
            mock_chunk.start_line = 1
            mock_chunk.end_line = 10
            mock_chunk.content = "def test_function():\n    pass"

            mock_result = MagicMock()
            mock_result.fetchall.return_value = [(mock_chunk, 0.05)]
            mock_db.execute.return_value = mock_result

            searcher = SemanticSearcher()
            results = await searcher.search(mock_db, repo_id, "test query", limit=5)

            assert len(results) == 1
            assert results[0].file_path == "test.py"


class TestTextSearcher:
    """Test TextSearcher behavior."""

    @pytest.mark.asyncio
    async def test_case_insensitive_query(self):
        """Test TextSearcher handles case-insensitive queries."""
        text_searcher = TextSearcher()
        mock_db = AsyncMock()
        repo_id = uuid.uuid4()

        mock_chunk = MagicMock()
        mock_chunk.file_path = "a.py"
        mock_chunk.start_line = 1
        mock_chunk.end_line = 5
        mock_chunk.content = "def HELLO(): pass"

        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [mock_chunk]
        mock_db.execute.return_value = mock_result

        results = await text_searcher.search(mock_db, repo_id, "hello")
        assert len(results) == 1
        assert results[0].file_path == "a.py"

    @pytest.mark.asyncio
    async def test_empty_query_returns_empty(self):
        """Test TextSearcher returns empty for empty query."""
        text_searcher = TextSearcher()
        mock_db = AsyncMock()
        repo_id = uuid.uuid4()

        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = []
        mock_db.execute.return_value = mock_result

        results = await text_searcher.search(mock_db, repo_id, "")
        assert len(results) == 0


class TestFileSearcher:
    """Test FileSearcher path matching."""

    @pytest.mark.asyncio
    async def test_exact_path_match(self):
        """Test FileSearcher returns exact path matches."""
        file_searcher = FileSearcher()
        mock_db = AsyncMock()
        repo_id = uuid.uuid4()

        mock_chunk = MagicMock()
        mock_chunk.file_path = "src/main.py"
        mock_chunk.start_line = 1
        mock_chunk.end_line = 10
        mock_chunk.content = "# main file"

        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [mock_chunk]
        mock_db.execute.return_value = mock_result

        results = await file_searcher.search(mock_db, repo_id, "src/main.py")

        assert len(results) == 1
        assert results[0].file_path == "src/main.py"

    @pytest.mark.asyncio
    async def test_glob_pattern_match(self):
        """Test FileSearcher supports pattern matches."""
        file_searcher = FileSearcher()
        mock_db = AsyncMock()
        repo_id = uuid.uuid4()

        mock_chunk1 = MagicMock()
        mock_chunk1.file_path = "src/main.py"
        mock_chunk1.start_line = 1
        mock_chunk1.end_line = 10
        mock_chunk1.content = "# main file"

        mock_chunk2 = MagicMock()
        mock_chunk2.file_path = "src/utils.py"
        mock_chunk2.start_line = 1
        mock_chunk2.end_line = 10
        mock_chunk2.content = "# utils file"

        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [mock_chunk1, mock_chunk2]
        mock_db.execute.return_value = mock_result

        results = await file_searcher.search(mock_db, repo_id, "src/")

        assert len(results) == 2
        assert results[0].file_path == "src/main.py"
        assert results[1].file_path == "src/utils.py"
