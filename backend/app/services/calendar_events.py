from __future__ import annotations

from datetime import date

from sqlalchemy.orm import Session

from app.models.entities import GlobalCalendarEvent, MealDay, MealDayStatus, MealTrain
from app.schemas.meal_trains import GlobalCalendarEventResponse, MealDayResponse, SignupResponse


def load_global_events_for_dates(db: Session, dates: set[date]) -> dict[date, GlobalCalendarEvent]:
    if not dates:
        return {}

    events = db.query(GlobalCalendarEvent).filter(GlobalCalendarEvent.date.in_(dates)).all()
    return {event.date: event for event in events}


def load_global_events_for_train(db: Session, train: MealTrain) -> dict[date, GlobalCalendarEvent]:
    return load_global_events_for_dates(db, {day.date for day in train.days})


def get_effective_meal_day_status(day: MealDay, event: GlobalCalendarEvent | None) -> MealDayStatus:
    if event and event.blocks_meals and day.status == MealDayStatus.open:
        return MealDayStatus.not_needed
    return day.status


def build_global_event_response(event: GlobalCalendarEvent) -> GlobalCalendarEventResponse:
    return GlobalCalendarEventResponse(
        id=event.id,
        date=event.date,
        title=event.title,
        note=event.note,
        blocks_meals=event.blocks_meals,
        created_by=event.created_by,
        created_at=event.created_at,
        updated_at=event.updated_at,
    )


def build_meal_day_response(day: MealDay, event: GlobalCalendarEvent | None = None) -> MealDayResponse:
    return MealDayResponse(
        id=day.id,
        date=day.date,
        status=get_effective_meal_day_status(day, event).value,
        is_default=day.is_default,
        delivery_deadline=day.delivery_deadline,
        display_order=day.display_order,
        admin_note=day.admin_note,
        signup=SignupResponse.model_validate(day.signup) if day.signup else None,
        global_event=build_global_event_response(event) if event else None,
    )
