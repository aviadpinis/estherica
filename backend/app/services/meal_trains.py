from __future__ import annotations

import secrets
from datetime import UTC, date, datetime, timedelta

from app.models.entities import MealDay, MealDayStatus, MealTrain, MealTrainStatus

DEFAULT_DELIVERY_TIME = "18:00"
DEFAULT_REMINDER_TIME = "09:00"


def generate_token() -> str:
    return secrets.token_urlsafe(18)


def build_default_days(start_date: date, delivery_deadline: str) -> list[MealDay]:
    days: list[MealDay] = []
    display_order = 1
    for offset in range(14):
        current_date = start_date + timedelta(days=offset)
        if current_date.weekday() in (4, 5):
            continue
        days.append(
            MealDay(
                date=current_date,
                status=MealDayStatus.open,
                is_default=True,
                delivery_deadline=delivery_deadline,
                display_order=display_order,
            )
        )
        display_order += 1
    return days


def publish_train(train: MealTrain) -> None:
    train.status = MealTrainStatus.published
    train.published_at = datetime.now(UTC)
