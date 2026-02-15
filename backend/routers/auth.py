import bcrypt
from fastapi import APIRouter, Depends, HTTPException, status
from db.connection import get_pool
from middleware.auth import create_token, get_current_user
from models.schemas import LoginRequest, LoginResponse, UserResponse

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
async def login(request: LoginRequest):
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT id, username, display_name, password_hash, role FROM users WHERE username = $1",
            request.username,
        )

    if not row:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    if not bcrypt.checkpw(request.password.encode(), row["password_hash"].encode()):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    token = create_token(str(row["id"]), row["role"])

    return LoginResponse(
        token=token,
        user=UserResponse(
            id=str(row["id"]),
            username=row["username"],
            name=row["display_name"],
            role=row["role"],
        ),
    )


@router.get("/me", response_model=UserResponse)
async def get_me(user: dict = Depends(get_current_user)):
    return UserResponse(
        id=user["id"],
        username=user["username"],
        name=user["name"],
        role=user["role"],
    )
