from fastapi import APIRouter, Depends, Query
from db.connection import get_pool
from middleware.auth import get_current_user
from models.schemas import ConsignerData

router = APIRouter(prefix="/api/consigners", tags=["consigners"])


def consigner_row_to_dict(row) -> dict:
    return {
        "id": str(row["id"]),
        "consignerNumber": row["number"],
        "name": row["name"],
        "address": row["address"],
        "phone": row["phone"],
        "email": row["email"],
        "createdAt": row["created_at"].isoformat() if row["created_at"] else None,
        "updatedAt": row["updated_at"].isoformat() if row["updated_at"] else None,
    }


@router.get("")
async def list_consigners(user: dict = Depends(get_current_user)):
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch("SELECT * FROM consigners ORDER BY name")
    return [consigner_row_to_dict(r) for r in rows]


@router.post("", status_code=201)
async def save_consigner(request: ConsignerData, user: dict = Depends(get_current_user)):
    """Create or update a consigner. Upserts by consigner number if provided."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        if request.consignerNumber:
            existing = await conn.fetchrow(
                "SELECT id FROM consigners WHERE number = $1", request.consignerNumber
            )
            if existing:
                await conn.execute(
                    """UPDATE consigners SET name = $1, address = $2, phone = $3, email = $4
                       WHERE number = $5""",
                    request.name, request.address, request.phone, request.email,
                    request.consignerNumber,
                )
                return {"success": True, "action": "updated"}

        await conn.execute(
            """INSERT INTO consigners (name, number, address, phone, email)
               VALUES ($1, $2, $3, $4, $5)""",
            request.name, request.consignerNumber, request.address, request.phone, request.email,
        )
    return {"success": True, "action": "created"}


@router.get("/search")
async def search_consigners(
    q: str = Query(..., min_length=1),
    user: dict = Depends(get_current_user),
):
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """SELECT * FROM consigners
               WHERE name ILIKE $1 OR number ILIKE $1
               ORDER BY name LIMIT 20""",
            f"%{q}%",
        )
    return [consigner_row_to_dict(r) for r in rows]


@router.get("/lookup")
async def lookup_consigner(
    number: str = Query(default=None),
    name: str = Query(default=None),
    user: dict = Depends(get_current_user),
):
    pool = await get_pool()
    async with pool.acquire() as conn:
        if number:
            row = await conn.fetchrow("SELECT * FROM consigners WHERE number = $1", number)
        elif name:
            row = await conn.fetchrow(
                "SELECT * FROM consigners WHERE name ILIKE $1 LIMIT 1", f"{name}%"
            )
        else:
            return None

    if row:
        return consigner_row_to_dict(row)
    return None


@router.delete("", status_code=204)
async def delete_all_consigners(user: dict = Depends(get_current_user)):
    """Factory reset - delete all consigners."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute("DELETE FROM consigners")
