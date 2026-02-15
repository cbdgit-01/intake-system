import json
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from db.connection import get_pool
from middleware.auth import get_current_user
from models.schemas import SyncPushRequest, SyncPushResult

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/forms", tags=["forms"])


def form_row_to_dict(row) -> dict:
    """Convert a database row to a camelCase dict matching the frontend IntakeForm type."""
    return {
        "id": str(row["id"]),
        "consignerType": row["consigner_type"],
        "consignerName": row["consigner_name"] or "",
        "consignerNumber": row["consigner_number"],
        "consignerAddress": row["consigner_address"],
        "consignerPhone": row["consigner_phone"],
        "consignerEmail": row["consigner_email"],
        "intakeMode": row["intake_mode"],
        "status": row["status"],
        "items": json.loads(row["items"]) if isinstance(row["items"], str) else (row["items"] or []),
        "enabledFields": json.loads(row["enabled_fields"]) if isinstance(row["enabled_fields"], str) else row["enabled_fields"],
        "signatureData": row["signature_data"],
        "initials1": row["initials_1"],
        "initials2": row["initials_2"],
        "initials3": row["initials_3"],
        "signatureDate": row["signature_date"],
        "acceptedBy": row["accepted_by"],
        "createdAt": row["created_at"].isoformat() if row["created_at"] else None,
        "updatedAt": row["updated_at"].isoformat() if row["updated_at"] else None,
        "signedAt": row["signed_at"].isoformat() if row["signed_at"] else None,
    }


async def upsert_form(conn, form_data: dict, user_id: str) -> str:
    """Insert or update a form. Returns the form ID."""
    form_id = form_data.get("id")
    if not form_id:
        raise ValueError("Form ID is required")

    # Parse dates
    created_at = None
    if form_data.get("createdAt"):
        try:
            created_at = datetime.fromisoformat(form_data["createdAt"].replace("Z", "+00:00"))
        except (ValueError, TypeError):
            created_at = datetime.now(timezone.utc)

    signed_at = None
    if form_data.get("signedAt"):
        try:
            signed_at = datetime.fromisoformat(form_data["signedAt"].replace("Z", "+00:00"))
        except (ValueError, TypeError):
            pass

    items = form_data.get("items", [])
    enabled_fields = form_data.get("enabledFields")

    # Convert to JSON strings for JSONB columns
    items_json = json.dumps(items) if not isinstance(items, str) else items
    enabled_fields_json = json.dumps(enabled_fields) if enabled_fields and not isinstance(enabled_fields, str) else enabled_fields

    existing = await conn.fetchrow("SELECT id FROM forms WHERE id = $1::uuid", form_id)

    if existing:
        await conn.execute(
            """UPDATE forms SET
                consigner_type = $2, consigner_name = $3, consigner_number = $4,
                consigner_address = $5, consigner_phone = $6, consigner_email = $7,
                intake_mode = $8, status = $9, items = $10::jsonb, enabled_fields = $11::jsonb,
                signature_data = $12, initials_1 = $13, initials_2 = $14, initials_3 = $15,
                signature_date = $16, accepted_by = $17, signed_at = $18
            WHERE id = $1::uuid""",
            form_id,
            form_data.get("consignerType", "new"),
            form_data.get("consignerName", ""),
            form_data.get("consignerNumber"),
            form_data.get("consignerAddress"),
            form_data.get("consignerPhone"),
            form_data.get("consignerEmail"),
            form_data.get("intakeMode"),
            form_data.get("status", "draft"),
            items_json,
            enabled_fields_json,
            form_data.get("signatureData"),
            form_data.get("initials1"),
            form_data.get("initials2"),
            form_data.get("initials3"),
            form_data.get("signatureDate"),
            form_data.get("acceptedBy"),
            signed_at,
        )
    else:
        await conn.execute(
            """INSERT INTO forms (
                id, consigner_type, consigner_name, consigner_number,
                consigner_address, consigner_phone, consigner_email,
                intake_mode, status, items, enabled_fields,
                signature_data, initials_1, initials_2, initials_3,
                signature_date, accepted_by, created_at, signed_at, created_by
            ) VALUES (
                $1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb,
                $12, $13, $14, $15, $16, $17, $18, $19, $20::uuid
            )""",
            form_id,
            form_data.get("consignerType", "new"),
            form_data.get("consignerName", ""),
            form_data.get("consignerNumber"),
            form_data.get("consignerAddress"),
            form_data.get("consignerPhone"),
            form_data.get("consignerEmail"),
            form_data.get("intakeMode"),
            form_data.get("status", "draft"),
            items_json,
            enabled_fields_json,
            form_data.get("signatureData"),
            form_data.get("initials1"),
            form_data.get("initials2"),
            form_data.get("initials3"),
            form_data.get("signatureDate"),
            form_data.get("acceptedBy"),
            created_at or datetime.now(timezone.utc),
            signed_at,
            user_id,
        )

    return form_id


@router.get("")
async def list_forms(user: dict = Depends(get_current_user)):
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch("SELECT * FROM forms ORDER BY updated_at DESC")
    return [form_row_to_dict(r) for r in rows]


@router.post("/sync/push")
async def sync_push(request: SyncPushRequest, user: dict = Depends(get_current_user)):
    """Process a batch of sync operations from the client."""
    pool = await get_pool()
    results = []

    async with pool.acquire() as conn:
        for op in request.operations:
            try:
                if op.type in ("CREATE", "UPDATE"):
                    form_id = await upsert_form(conn, op.payload, user["id"])
                    results.append(SyncPushResult(type=op.type, id=form_id, success=True))

                elif op.type == "DELETE":
                    form_id = op.payload.get("id")
                    if form_id:
                        await conn.execute("DELETE FROM forms WHERE id = $1::uuid", form_id)
                        # Track deletion for sync pull
                        await conn.execute(
                            "INSERT INTO deleted_forms (id) VALUES ($1::uuid) ON CONFLICT (id) DO NOTHING",
                            form_id,
                        )
                        results.append(SyncPushResult(type="DELETE", id=form_id, success=True))
                    else:
                        results.append(SyncPushResult(type="DELETE", id="", success=False, error="Missing form ID"))

                else:
                    results.append(SyncPushResult(type=op.type, id="", success=False, error=f"Unknown operation: {op.type}"))

            except Exception as e:
                form_id = op.payload.get("id", "")
                logger.error(f"Sync push error for {op.type} {form_id}: {e}")
                results.append(SyncPushResult(type=op.type, id=form_id, success=False, error=str(e)))

    return {"results": results}


@router.get("/sync/pull")
async def sync_pull(
    since: str = Query(default=None, description="ISO timestamp to pull changes since"),
    user: dict = Depends(get_current_user),
):
    """Pull forms modified since the given timestamp, plus deleted form IDs."""
    pool = await get_pool()
    server_time = datetime.now(timezone.utc).isoformat()

    async with pool.acquire() as conn:
        if since:
            try:
                since_dt = datetime.fromisoformat(since.replace("Z", "+00:00"))
            except ValueError:
                since_dt = datetime.min.replace(tzinfo=timezone.utc)

            rows = await conn.fetch(
                "SELECT * FROM forms WHERE updated_at > $1 ORDER BY updated_at DESC",
                since_dt,
            )
            deleted_rows = await conn.fetch(
                "SELECT id FROM deleted_forms WHERE deleted_at > $1",
                since_dt,
            )
        else:
            rows = await conn.fetch("SELECT * FROM forms ORDER BY updated_at DESC")
            deleted_rows = await conn.fetch("SELECT id FROM deleted_forms")

    forms = [form_row_to_dict(r) for r in rows]
    deleted_ids = [str(r["id"]) for r in deleted_rows]

    return {"forms": forms, "deleted_ids": deleted_ids, "server_time": server_time}


@router.delete("/{form_id}", status_code=204)
async def delete_form(form_id: str, user: dict = Depends(get_current_user)):
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute("DELETE FROM forms WHERE id = $1::uuid", form_id)
        await conn.execute(
            "INSERT INTO deleted_forms (id) VALUES ($1::uuid) ON CONFLICT (id) DO NOTHING",
            form_id,
        )


@router.delete("", status_code=204)
async def delete_all_forms(user: dict = Depends(get_current_user)):
    """Factory reset - delete all forms."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        # Track all current form IDs as deleted
        await conn.execute(
            "INSERT INTO deleted_forms (id) SELECT id FROM forms ON CONFLICT (id) DO NOTHING"
        )
        await conn.execute("DELETE FROM forms")
