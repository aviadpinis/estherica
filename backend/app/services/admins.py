from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.entities import Admin
from app.services.auth import hash_password


def ensure_bootstrap_admin(db: Session) -> None:
    settings = get_settings()
    admin = db.query(Admin).filter(Admin.email == settings.admin_email).first()
    password_hash = hash_password(settings.admin_password)

    if admin is None:
        db.add(
            Admin(
                full_name="מנהלת ראשית",
                email=settings.admin_email,
                password_hash=password_hash,
            )
        )
        db.commit()
        return

    admin.password_hash = password_hash
    if not admin.full_name:
        admin.full_name = "מנהלת ראשית"
    db.commit()
