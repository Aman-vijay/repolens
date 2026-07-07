# FastAPI App

A simple FastAPI application demonstrating REST API patterns.

## Setup

```bash
pip install -r requirements.txt
uvicorn main:app --reload
```

## Endpoints

- `GET /` - Root endpoint
- `GET /health` - Health check
- `POST /users/` - Create a user
- `GET /users/{id}` - Get a user by ID
