from datetime import UTC, date, datetime
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.api.dependencies import get_current_admin
from app.core.config import get_settings
from app.db.session import get_db
from app.models.entities import Admin, BabyType, MealDay, MealDayStatus, MealTrain, MealTrainStatus, Signup
from app.schemas.meal_trains import (
    AdminAttentionTrain,
    AdminOverviewResponse,
    AdminUpcomingAssignment,
    AdminVolunteerStats,
    MealDayCreate,
    MealDayResponse,
    MealDayUpdate,
    MealTrainCreate,
    MealTrainDetail,
    MealTrainSummary,
    MealTrainUpdate,
)
from app.services.meal_trains import build_default_days, generate_token


router = APIRouter(prefix="/api/admin", tags=["admin"])


def _today_in_project_timezone() -> date:
    settings = get_settings()
    try:
        return datetime.now(ZoneInfo(settings.timezone)).date()
    except Exception:
        return date.today()


def _build_summary(train: MealTrain) -> MealTrainSummary:
    open_days = 0
    assigned_days = 0
    today = _today_in_project_timezone()
    urgent_until = today.fromordinal(today.toordinal() + 3)
    urgent_open_days = 0
    for day in train.days:
        if day.status == MealDayStatus.open and day.date >= today:
            open_days += 1
            if day.date <= urgent_until:
                urgent_open_days += 1
        if day.status == MealDayStatus.assigned:
            assigned_days += 1

    end_date = max((day.date for day in train.days), default=None)
    is_archived = end_date is not None and end_date < today
    completion_rate = (assigned_days / len(train.days) * 100) if train.days else 0
    if is_archived:
        risk_level = "archived"
    elif urgent_open_days > 0:
        risk_level = "risk"
    elif open_days > 0:
        risk_level = "watch"
    else:
        risk_level = "healthy"

    return MealTrainSummary(
        id=train.id,
        family_title=train.family_title,
        mother_name=train.mother_name,
        contact_phone=train.contact_phone,
        baby_type=train.baby_type.value if train.baby_type else None,
        status=train.status.value,
        start_date=train.start_date,
        default_delivery_time=train.default_delivery_time,
        reminder_time=train.reminder_time,
        gift_delivered=train.gift_delivered,
        lobby_visible=train.lobby_visible,
        intake_token=train.intake_token,
        public_token=train.public_token,
        created_at=train.created_at,
        intake_submitted=train.intake_form is not None,
        intake_submitted_at=train.intake_form.submitted_at if train.intake_form else None,
        total_days=len(train.days),
        open_days=open_days,
        assigned_days=assigned_days,
        end_date=end_date,
        is_archived=is_archived,
        urgent_open_days=urgent_open_days,
        completion_rate=round(completion_rate, 1),
        risk_level=risk_level,
    )


def _build_detail(train: MealTrain) -> MealTrainDetail:
    return MealTrainDetail(
        id=train.id,
        family_title=train.family_title,
        mother_name=train.mother_name,
        contact_phone=train.contact_phone,
        baby_type=train.baby_type.value if train.baby_type else None,
        status=train.status.value,
        start_date=train.start_date,
        default_delivery_time=train.default_delivery_time,
        reminder_time=train.reminder_time,
        gift_delivered=train.gift_delivered,
        lobby_visible=train.lobby_visible,
        timezone=train.timezone,
        intake_token=train.intake_token,
        public_token=train.public_token,
        published_at=train.published_at,
        created_at=train.created_at,
        updated_at=train.updated_at,
        intake_form=train.intake_form,
        days=[MealDayResponse.model_validate(day) for day in train.days],
    )


def _get_next_open_date(train: MealTrain, today: date) -> date | None:
    return min(
        (day.date for day in train.days if day.status == MealDayStatus.open and day.date >= today),
        default=None,
    )


def _get_train_or_404(db: Session, train_id: int) -> MealTrain:
    train = (
        db.query(MealTrain)
        .options(
            joinedload(MealTrain.days).joinedload(MealDay.signup),
            joinedload(MealTrain.intake_form),
        )
        .filter(MealTrain.id == train_id)
        .first()
    )
    if train is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meal train not found.")
    return train


@router.get("/meal-trains", response_model=list[MealTrainSummary])
def list_meal_trains(
    _: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db),
) -> list[MealTrainSummary]:
    trains = (
        db.query(MealTrain)
        .options(joinedload(MealTrain.days), joinedload(MealTrain.intake_form))
        .order_by(MealTrain.created_at.desc())
        .all()
    )
    return [_build_summary(train) for train in trains]


@router.get("/overview", response_model=AdminOverviewResponse)
def get_admin_overview(
    _: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db),
) -> AdminOverviewResponse:
    trains = (
        db.query(MealTrain)
        .options(joinedload(MealTrain.days).joinedload(MealDay.signup))
        .order_by(MealTrain.created_at.desc())
        .all()
    )

    summaries = [_build_summary(train) for train in trains]
    summary_by_id = {summary.id: summary for summary in summaries}
    today = _today_in_project_timezone()
    upcoming_assignments: list[AdminUpcomingAssignment] = []
    volunteer_bucket: dict[str, AdminVolunteerStats] = {}
    attention_trains: list[AdminAttentionTrain] = []

    for train in trains:
        summary = summary_by_id[train.id]
        next_open_date = _get_next_open_date(train, today)
        if not summary.is_archived and summary.open_days > 0:
            attention_trains.append(
                AdminAttentionTrain(
                    train_id=train.id,
                    family_title=train.family_title,
                    mother_name=train.mother_name,
                    baby_type=train.baby_type.value if train.baby_type else None,
                    open_days=summary.open_days,
                    urgent_open_days=summary.urgent_open_days,
                    next_open_date=next_open_date,
                    completion_rate=summary.completion_rate,
                )
            )

        for day in train.days:
            signup = day.signup
            if signup is None:
                continue

            if day.date >= today:
                upcoming_assignments.append(
                    AdminUpcomingAssignment(
                        date=day.date,
                        family_title=train.family_title,
                        mother_name=train.mother_name,
                        baby_type=train.baby_type.value if train.baby_type else None,
                        volunteer_name=signup.volunteer_name,
                        phone=signup.phone,
                        meal_type=signup.meal_type,
                        delivery_deadline=day.delivery_deadline,
                    )
                )

            bucket_key = signup.volunteer_key or f"legacy::{signup.volunteer_name}::{signup.phone}"
            entry = volunteer_bucket.get(bucket_key)
            if entry is None:
                volunteer_bucket[bucket_key] = AdminVolunteerStats(
                    volunteer_key=signup.volunteer_key,
                    volunteer_name=signup.volunteer_name,
                    total_signups=1,
                    active_signups=1 if day.date >= today else 0,
                    last_signup_at=signup.created_at,
                )
                continue

            entry.total_signups += 1
            if day.date >= today:
                entry.active_signups += 1
            if entry.last_signup_at is None or (signup.created_at and signup.created_at > entry.last_signup_at):
                entry.last_signup_at = signup.created_at
            if len(signup.volunteer_name) > len(entry.volunteer_name):
                entry.volunteer_name = signup.volunteer_name

    upcoming_assignments.sort(key=lambda item: (item.date, item.delivery_deadline, item.family_title))
    attention_trains.sort(
        key=lambda item: (
            0 if item.urgent_open_days > 0 else 1,
            item.next_open_date or date.max,
            -item.urgent_open_days,
            -item.open_days,
            item.completion_rate,
            item.family_title,
        )
    )
    volunteer_stats = sorted(
        volunteer_bucket.values(),
        key=lambda item: (-item.total_signups, -item.active_signups, item.volunteer_name),
    )

    return AdminOverviewResponse(
        active_train_count=sum(1 for summary in summaries if not summary.is_archived),
        archived_train_count=sum(1 for summary in summaries if summary.is_archived),
        total_open_days=sum(summary.open_days for summary in summaries if not summary.is_archived),
        urgent_open_days=sum(summary.urgent_open_days for summary in summaries if not summary.is_archived),
        total_assigned_days=sum(summary.assigned_days for summary in summaries if not summary.is_archived),
        upcoming_assignments=upcoming_assignments[:12],
        volunteer_stats=volunteer_stats[:8],
        attention_trains=attention_trains[:6],
    )


@router.post("/meal-trains", response_model=MealTrainDetail, status_code=status.HTTP_201_CREATED)
def create_meal_train(
    payload: MealTrainCreate,
    _: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db),
) -> MealTrainDetail:
    train = MealTrain(
        family_title=payload.family_title,
        mother_name=payload.mother_name,
        contact_phone=payload.contact_phone,
        baby_type=BabyType(payload.baby_type) if payload.baby_type else None,
        start_date=payload.start_date,
        default_delivery_time=payload.default_delivery_time,
        reminder_time=payload.reminder_time,
        intake_token=generate_token(12),
        public_token=generate_token(8),
    )
    train.days = build_default_days(payload.start_date, payload.default_delivery_time)
    db.add(train)
    db.commit()
    db.refresh(train)
    return _build_detail(_get_train_or_404(db, train.id))


@router.get("/meal-trains/{train_id}", response_model=MealTrainDetail)
def get_meal_train(
    train_id: int,
    _: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db),
) -> MealTrainDetail:
    return _build_detail(_get_train_or_404(db, train_id))


@router.patch("/meal-trains/{train_id}", response_model=MealTrainDetail)
def update_meal_train(
    train_id: int,
    payload: MealTrainUpdate,
    _: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db),
) -> MealTrainDetail:
    train = _get_train_or_404(db, train_id)
    updates = payload.model_dump(exclude_unset=True)

    if "status" in updates:
        try:
            train.status = MealTrainStatus(updates["status"])
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid status.") from exc

    if "baby_type" in updates:
        train.baby_type = BabyType(updates["baby_type"]) if updates["baby_type"] else None

    for field in ("family_title", "mother_name", "contact_phone", "default_delivery_time", "reminder_time", "gift_delivered"):
        if field in updates:
            setattr(train, field, updates[field])

    if "lobby_visible" in updates:
        train.lobby_visible = updates["lobby_visible"]

    db.commit()
    return _build_detail(_get_train_or_404(db, train_id))


@router.post("/meal-trains/{train_id}/publish", response_model=MealTrainDetail)
def publish_meal_train(
    train_id: int,
    _: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db),
) -> MealTrainDetail:
    train = _get_train_or_404(db, train_id)
    train.status = MealTrainStatus.published
    train.published_at = datetime.now(UTC)
    db.commit()
    return _build_detail(_get_train_or_404(db, train_id))


@router.delete("/meal-trains/{train_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_meal_train(
    train_id: int,
    _: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db),
) -> None:
    train = _get_train_or_404(db, train_id)
    db.delete(train)
    db.commit()


@router.post("/meal-trains/{train_id}/days", response_model=MealTrainDetail, status_code=status.HTTP_201_CREATED)
def add_meal_day(
    train_id: int,
    payload: MealDayCreate,
    _: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db),
) -> MealTrainDetail:
    train = _get_train_or_404(db, train_id)
    exists = db.query(MealDay).filter(MealDay.meal_train_id == train_id, MealDay.date == payload.date).first()
    if exists is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This day already exists.")

    try:
        status_value = MealDayStatus(payload.status)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid day status.") from exc

    next_order = max((day.display_order for day in train.days), default=0) + 1
    meal_day = MealDay(
        meal_train_id=train_id,
        date=payload.date,
        status=status_value,
        is_default=False,
        delivery_deadline=payload.delivery_deadline or train.default_delivery_time,
        display_order=next_order,
        admin_note=payload.admin_note,
    )
    db.add(meal_day)
    db.commit()
    return _build_detail(_get_train_or_404(db, train_id))


@router.patch("/meal-days/{day_id}", response_model=MealDayResponse)
def update_meal_day(
    day_id: int,
    payload: MealDayUpdate,
    _: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db),
) -> MealDayResponse:
    meal_day = db.query(MealDay).options(joinedload(MealDay.signup)).filter(MealDay.id == day_id).first()
    if meal_day is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Day not found.")

    updates = payload.model_dump(exclude_unset=True)
    if "status" in updates:
        try:
            meal_day.status = MealDayStatus(updates["status"])
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid day status.") from exc
        if meal_day.status != MealDayStatus.assigned and meal_day.signup is not None:
            db.delete(meal_day.signup)

    for field in ("delivery_deadline", "admin_note"):
        if field in updates:
            setattr(meal_day, field, updates[field])

    db.commit()
    db.refresh(meal_day)
    return MealDayResponse.model_validate(meal_day)


@router.delete("/meal-days/{day_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_meal_day(
    day_id: int,
    _: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db),
) -> None:
    meal_day = db.query(MealDay).filter(MealDay.id == day_id).first()
    if meal_day is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Day not found.")

    db.delete(meal_day)
    db.commit()
