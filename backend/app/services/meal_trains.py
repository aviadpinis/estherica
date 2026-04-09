from __future__ import annotations

import secrets
import string
from datetime import UTC, date, datetime, timedelta

from app.models.entities import MealDay, MealDayStatus, MealTrain, MealTrainStatus

DEFAULT_DELIVERY_TIME = "18:00"
DEFAULT_REMINDER_TIME = "09:00"
TOKEN_ALPHABET = string.ascii_letters + string.digits
DEFAULT_DURATION_DAYS = 14
TWINS_DURATION_DAYS = 21
MAX_SCHEDULE_START_OFFSET_DAYS = 8


def generate_token(length: int = 12) -> str:
    return "".join(secrets.choice(TOKEN_ALPHABET) for _ in range(length))


def get_schedule_length(is_twins: bool) -> int:
    return TWINS_DURATION_DAYS if is_twins else DEFAULT_DURATION_DAYS


def get_latest_schedule_start_date(birth_date: date) -> date:
    return birth_date + timedelta(days=MAX_SCHEDULE_START_OFFSET_DAYS)


def get_earliest_schedule_start_date(birth_date: date) -> date:
    return birth_date + timedelta(days=1)


def validate_schedule_window(birth_date: date, start_date: date) -> None:
    earliest_start = get_earliest_schedule_start_date(birth_date)
    latest_start = get_latest_schedule_start_date(birth_date)
    if start_date < earliest_start or start_date > latest_start:
        raise ValueError("תאריך פתיחת הלוח צריך להיות מהיום שאחרי הלידה ועד 8 ימים אחריה.")
    if start_date.weekday() in (4, 5):
        raise ValueError("לא ניתן לפתוח את הלוח בשישי או שבת.")


def build_schedule_dates(start_date: date, is_twins: bool) -> list[date]:
    dates: list[date] = []
    for offset in range(get_schedule_length(is_twins)):
        current_date = start_date + timedelta(days=offset)
        if current_date.weekday() in (4, 5):
            continue
        dates.append(current_date)
    return dates


def build_default_days(start_date: date, delivery_deadline: str, is_twins: bool = False) -> list[MealDay]:
    days: list[MealDay] = []
    for display_order, current_date in enumerate(build_schedule_dates(start_date, is_twins), start=1):
        days.append(
            MealDay(
                date=current_date,
                status=MealDayStatus.open,
                is_default=True,
                delivery_deadline=delivery_deadline,
                display_order=display_order,
            )
        )
    return days


def sync_default_days(train: MealTrain, delivery_deadline: str | None = None) -> None:
    deadline = delivery_deadline or train.default_delivery_time
    target_dates = build_schedule_dates(train.start_date, train.is_twins)
    target_date_set = set(target_dates)
    existing_by_date = {day.date: day for day in train.days}

    for target_date in target_dates:
        if target_date in existing_by_date:
            day = existing_by_date[target_date]
            if day.is_default and day.status != MealDayStatus.assigned:
                day.delivery_deadline = deadline
            continue

        train.days.append(
            MealDay(
                date=target_date,
                status=MealDayStatus.open,
                is_default=True,
                delivery_deadline=deadline,
                display_order=0,
            )
        )

    removable_days = [
        day
        for day in train.days
        if day.is_default and day.date not in target_date_set and day.signup is None and day.status != MealDayStatus.assigned
    ]
    for day in removable_days:
        train.days.remove(day)

    for display_order, day in enumerate(sorted(train.days, key=lambda item: item.date), start=1):
        day.display_order = display_order


def publish_train(train: MealTrain) -> None:
    train.status = MealTrainStatus.published
    train.published_at = datetime.now(UTC)
