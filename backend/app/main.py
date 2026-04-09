from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text

from app.api.admin import router as admin_router
from app.api.auth import router as auth_router
from app.api.health import router as health_router
from app.api.public import router as public_router
from app.core.config import get_settings
from app.core.encryption import encrypt_existing_rows
from app.db.session import SessionLocal, engine
from app.models.entities import Base
from app.services.admins import ensure_bootstrap_admin


settings = get_settings()
app = FastAPI(title=settings.app_name)


def ensure_schema() -> None:
    Base.metadata.create_all(bind=engine)
    inspector = inspect(engine)

    if "meal_trains" in inspector.get_table_names():
        columns = {column["name"] for column in inspector.get_columns("meal_trains")}
        if "baby_type" not in columns:
            with engine.begin() as connection:
                connection.execute(text("ALTER TABLE meal_trains ADD COLUMN baby_type VARCHAR(16)"))
        if "gift_delivered" not in columns:
            with engine.begin() as connection:
                connection.execute(text("ALTER TABLE meal_trains ADD COLUMN gift_delivered BOOLEAN DEFAULT 0 NOT NULL"))
        if "lobby_visible" not in columns:
            with engine.begin() as connection:
                connection.execute(text("ALTER TABLE meal_trains ADD COLUMN lobby_visible BOOLEAN DEFAULT 1 NOT NULL"))
        if "contact_phone" not in columns:
            with engine.begin() as connection:
                connection.execute(text("ALTER TABLE meal_trains ADD COLUMN contact_phone TEXT"))

    if "signups" in inspector.get_table_names():
        columns = {column["name"] for column in inspector.get_columns("signups")}
        if "volunteer_key" not in columns:
            with engine.begin() as connection:
                connection.execute(text("ALTER TABLE signups ADD COLUMN volunteer_key VARCHAR(64)"))

    if "intake_forms" in inspector.get_table_names():
        columns = {column["name"] for column in inspector.get_columns("intake_forms")}
        if "home_phone" not in columns:
            with engine.begin() as connection:
                connection.execute(text("ALTER TABLE intake_forms ADD COLUMN home_phone TEXT"))

    encrypt_existing_rows(engine)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    ensure_schema()
    db = SessionLocal()
    try:
        ensure_bootstrap_admin(db)
    finally:
        db.close()


app.include_router(health_router)
app.include_router(auth_router)
app.include_router(admin_router)
app.include_router(public_router)
