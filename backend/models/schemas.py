from pydantic import BaseModel
from typing import Optional, List, Any
from datetime import datetime


# ============ Auth ============

class LoginRequest(BaseModel):
    username: str
    password: str


class UserResponse(BaseModel):
    id: str
    username: str
    name: str
    role: str


class LoginResponse(BaseModel):
    token: str
    user: UserResponse


class CreateUserRequest(BaseModel):
    username: str
    display_name: str
    password: str
    role: str = "staff"


class UpdateUserRequest(BaseModel):
    username: Optional[str] = None
    display_name: Optional[str] = None
    password: Optional[str] = None
    role: Optional[str] = None


# ============ Forms ============

class FormData(BaseModel):
    id: str
    consignerType: str
    consignerName: str = ""
    consignerNumber: Optional[str] = None
    consignerAddress: Optional[str] = None
    consignerPhone: Optional[str] = None
    consignerEmail: Optional[str] = None
    intakeMode: Optional[str] = None
    status: str = "draft"
    items: List[Any] = []
    enabledFields: Optional[dict] = None
    signatureData: Optional[str] = None
    initials1: Optional[str] = None
    initials2: Optional[str] = None
    initials3: Optional[str] = None
    signatureDate: Optional[str] = None
    acceptedBy: Optional[str] = None
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None
    signedAt: Optional[str] = None


class SyncOperation(BaseModel):
    type: str  # CREATE, UPDATE, DELETE
    payload: dict


class SyncPushRequest(BaseModel):
    operations: List[SyncOperation]


class SyncPushResult(BaseModel):
    type: str
    id: str
    success: bool
    error: Optional[str] = None


class SyncPullResponse(BaseModel):
    forms: List[dict]
    deleted_ids: List[str]
    server_time: str


# ============ Consigners ============

class ConsignerData(BaseModel):
    consignerNumber: Optional[str] = None
    name: str
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None


# ============ Email (kept from existing) ============

class EmailAttachment(BaseModel):
    filename: str
    content: str


class EmailRequest(BaseModel):
    to_email: str
    to_name: Optional[str] = None
    from_email: str
    from_name: Optional[str] = "Consigned By Design"
    subject: str
    message: str
    attachments: Optional[List[EmailAttachment]] = None
    api_key: str
