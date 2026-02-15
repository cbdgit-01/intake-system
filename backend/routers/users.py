import bcrypt
from fastapi import APIRouter, Depends, HTTPException, status
from db.connection import get_pool
from middleware.auth import require_admin
from models.schemas import CreateUserRequest, UpdateUserRequest, UserResponse

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("", response_model=list[UserResponse])
async def list_users(user: dict = Depends(require_admin)):
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT id, username, display_name, role FROM users ORDER BY created_at"
        )
    return [
        UserResponse(id=str(r["id"]), username=r["username"], name=r["display_name"], role=r["role"])
        for r in rows
    ]


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(request: CreateUserRequest, user: dict = Depends(require_admin)):
    pool = await get_pool()
    password_hash = bcrypt.hashpw(request.password.encode(), bcrypt.gensalt()).decode()

    async with pool.acquire() as conn:
        existing = await conn.fetchrow(
            "SELECT id FROM users WHERE username = $1",
            request.username,
        )
        if existing:
            raise HTTPException(status_code=400, detail="Username already exists")

        row = await conn.fetchrow(
            """INSERT INTO users (username, display_name, password_hash, role)
               VALUES ($1, $2, $3, $4)
               RETURNING id, username, display_name, role""",
            request.username, request.display_name, password_hash, request.role,
        )

    return UserResponse(
        id=str(row["id"]), username=row["username"],
        name=row["display_name"], role=row["role"],
    )


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(user_id: str, request: UpdateUserRequest, user: dict = Depends(require_admin)):
    pool = await get_pool()
    async with pool.acquire() as conn:
        existing = await conn.fetchrow("SELECT id FROM users WHERE id = $1::uuid", user_id)
        if not existing:
            raise HTTPException(status_code=404, detail="User not found")

        # Build dynamic update
        updates = []
        params = []
        param_idx = 1

        if request.username is not None:
            updates.append(f"username = ${param_idx}")
            params.append(request.username)
            param_idx += 1
        if request.display_name is not None:
            updates.append(f"display_name = ${param_idx}")
            params.append(request.display_name)
            param_idx += 1
        if request.role is not None:
            updates.append(f"role = ${param_idx}")
            params.append(request.role)
            param_idx += 1
        if request.password is not None:
            password_hash = bcrypt.hashpw(request.password.encode(), bcrypt.gensalt()).decode()
            updates.append(f"password_hash = ${param_idx}")
            params.append(password_hash)
            param_idx += 1

        if not updates:
            raise HTTPException(status_code=400, detail="No fields to update")

        params.append(user_id)
        query = f"UPDATE users SET {', '.join(updates)} WHERE id = ${param_idx}::uuid RETURNING id, username, display_name, role"
        row = await conn.fetchrow(query, *params)

    return UserResponse(
        id=str(row["id"]), username=row["username"],
        name=row["display_name"], role=row["role"],
    )


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(user_id: str, user: dict = Depends(require_admin)):
    if user_id == user["id"]:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")

    pool = await get_pool()
    async with pool.acquire() as conn:
        # Prevent deleting the last admin
        admin_count = await conn.fetchval("SELECT COUNT(*) FROM users WHERE role = 'admin'")
        target = await conn.fetchrow("SELECT role FROM users WHERE id = $1::uuid", user_id)
        if not target:
            raise HTTPException(status_code=404, detail="User not found")
        if target["role"] == "admin" and admin_count <= 1:
            raise HTTPException(status_code=400, detail="Cannot delete the last admin account")

        await conn.execute("DELETE FROM users WHERE id = $1::uuid", user_id)
