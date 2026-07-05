import re
from typing import Literal

INTENT_TYPE = Literal["semantic", "text", "file", "snapshot"]

# Match alphanumeric with dots/slashes/dashes ending in code extension or config file names
FILE_PATTERN = re.compile(
    r'^(?:[a-zA-Z0-9_\-\.\/]+)?(?:'
    r'package\.json|pyproject\.toml|cargo\.toml|go\.mod|dockerfile|docker-compose\.yml|'
    r'[a-zA-Z0-9_\-]+\.[a-zA-Z0-9]+'
    r')$',
    re.IGNORECASE
)

# Alphanumeric with underscores/camelCase (no spaces, punctuation, or special chars)
IDENTIFIER_PATTERN = re.compile(r'^[a-zA-Z_][a-zA-Z0-9_]*$')

def route_query_intent(query: str) -> INTENT_TYPE:
    """Pre-LLM Lightweight Intent Router.
    
    Categorizes queries into search strategies based on pattern heuristics
    to optimize token usage and latency.
    """
    trimmed = query.strip()
    
    # 1. Check for File Path patterns
    if FILE_PATTERN.match(trimmed):
        return "file"
        
    # 2. Check for exact identifier keywords
    if IDENTIFIER_PATTERN.match(trimmed):
        # Exception: common general terms shouldn't go to exact search if too generic
        # but for M6 this is a pragmatic heuristic
        return "text"
        
    # 3. Check if they are asking about high level architecture/tech stack
    lower_query = trimmed.lower()
    if any(keyword in lower_query for keyword in ["tech stack", "framework", "architecture style", "executive summary", "overview", "what does this project do"]):
        return "snapshot"
        
    # 4. Fallback to Semantic
    return "semantic"
