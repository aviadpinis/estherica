from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_admin
from app.db.session import get_db
from app.models.entities import Admin
from app.schemas.auth import AdminCreateRequest, AdminIdentity, AdminLoginRequest, AdminResponse, AuthTokenResponse
from app.services.auth import create_access_token, hash_password, verify_password


router = APIRouter(prefix="/api/admin/auth", tags=["admin-auth"])


@router.post("/login", response_model=AuthTokenResponse)
def login(payload: AdminLoginRequest, db: Session = Depends(get_db)) -> AuthTokenResponse:
    email = payload.email.strip().lower()
    admin = db.query(Admin).filter(Admin.email == email).first()
    if admin is None or not verify_password(payload.password, admin.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email or password is incorrect.",
        )

    token = create_access_token(admin.email)
    identity = AdminIdentity(id=admin.id, email=admin.email, full_name=admin.full_name)
    return AuthTokenResponse(access_token=token, admin=identity)


@router.get("/me", response_model=AdminIdentity)
def me(admin: Admin = Depends(get_current_admin)) -> AdminIdentity:
    return AdminIdentity(id=admin.id, email=admin.email, full_name=admin.full_name)


@router.get("/admins", response_model=list[AdminResponse])
def list_admins(
    _: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db),
) -> list[AdminResponse]:
    admins = db.query(Admin).order_by(Admin.created_at.asc()).all()
    return [AdminResponse(id=admin.id, email=admin.email, full_name=admin.full_name) for admin in admins]


@router.post("/admins", response_model=AdminResponse, status_code=status.HTTP_201_CREATED)
def create_admin(
    payload: AdminCreateRequest,
    _: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db),
) -> AdminResponse:
    email = payload.email.strip().lower()
    full_name = payload.full_name.strip() if payload.full_name else None
    existing = db.query(Admin).filter(Admin.email == email).first()
    if existing is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Admin email already exists.")

    admin = Admin(
        full_name=full_name or None,
        email=email,
        password_hash=hash_password(payload.password),
    )
    db.add(admin)
    db.commit()
    db.refresh(admin)
    return AdminResponse(id=admin.id, email=admin.email, full_name=admin.full_name)
