"""API routes for users."""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()


class UserCreate(BaseModel):
    name: str
    email: str


class UserResponse(BaseModel):
    id: int
    name: str
    email: str


users_db = {}


@router.post("/users/", response_model=UserResponse)
async def create_user(user: UserCreate):
    for u in users_db.values():
        if u.email == user.email:
            raise HTTPException(status_code=400, detail="Email already registered")
    user_id = len(users_db) + 1
    users_db[user_id] = {"id": user_id, "name": user.name, "email": user.email}
    return users_db[user_id]


@router.get("/users/{user_id}", response_model=UserResponse)
async def get_user(user_id: int):
    if user_id not in users_db:
        raise HTTPException(status_code=404, detail="User not found")
    return users_db[user_id]
