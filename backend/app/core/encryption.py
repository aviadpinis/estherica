from __future__ import annotations

from functools import lru_cache

from cryptography.fernet import Fernet, InvalidToken
from sqlalchemy import Engine, Text, inspect, text
from sqlalchemy.types import TypeDecorator

from app.core.config import get_settings


ENCRYPTED_PREFIX = "enc::"
SENSITIVE_COLUMNS: dict[str, tuple[str, ...]] = {
    "meal_trains": ("family_title", "mother_name", "contact_phone"),
    "intake_forms": (
        "address",
        "household_size",
        "children_ages",
        "special_requirements",
        "kashrut",
        "contact_phone",
        "home_phone",
        "backup_phone",
        "delivery_deadline",
        "general_notes",
    ),
}


@lru_cache(maxsize=1)
def _get_fernet() -> Fernet:
    key = get_settings().encryption_key.encode("utf-8")
    return Fernet(key)


def is_encrypted_value(value: str | None) -> bool:
    return isinstance(value, str) and value.startswith(ENCRYPTED_PREFIX)


def encrypt_text(value: str | None) -> str | None:
    if value is None or value == "":
        return value
    if is_encrypted_value(value):
        return value
    token = _get_fernet().encrypt(value.encode("utf-8")).decode("utf-8")
    return f"{ENCRYPTED_PREFIX}{token}"


def decrypt_text(value: str | None) -> str | None:
    if value is None or value == "":
        return value
    if not is_encrypted_value(value):
        return value

    try:
        token = value[len(ENCRYPTED_PREFIX) :]
        return _get_fernet().decrypt(token.encode("utf-8")).decode("utf-8")
    except InvalidToken:
        return value


class EncryptedValue(TypeDecorator):
    impl = Text
    cache_ok = True

    def process_bind_param(self, value: str | None, dialect) -> str | None:
        return encrypt_text(value)

    def process_result_value(self, value: str | None, dialect) -> str | None:
        return decrypt_text(value)


def encrypt_existing_rows(engine: Engine) -> None:
    with engine.begin() as connection:
        inspector = inspect(connection)
        existing_tables = set(inspector.get_table_names())

        for table_name, columns in SENSITIVE_COLUMNS.items():
            if table_name not in existing_tables:
                continue

            existing_columns = {
                column["name"]
                for column in inspector.get_columns(table_name)
            }
            selected_columns = [column for column in columns if column in existing_columns]
            if not selected_columns:
                continue

            query = text(f"SELECT id, {', '.join(selected_columns)} FROM {table_name}")
            rows = connection.execute(query).mappings().all()
            for row in rows:
                updates = {
                    column: encrypt_text(row[column])
                    for column in selected_columns
                    if isinstance(row[column], str) and row[column] and not is_encrypted_value(row[column])
                }
                if not updates:
                    continue

                updates["id"] = row["id"]
                assignments = ", ".join(f"{column} = :{column}" for column in updates if column != "id")
                connection.execute(
                    text(f"UPDATE {table_name} SET {assignments} WHERE id = :id"),
                    updates,
                )
