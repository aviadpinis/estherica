from datetime import UTC, date, datetime
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.core.config import get_settings
from app.db.session import get_db
from app.models.entities import BabyType, IntakeForm, MealDay, MealDayStatus, MealTrain, MealTrainStatus, Signup
from app.schemas.meal_trains import (
    IntakeSubmission,
    MealDayResponse,
    PublicBirthNoticeCreate,
    PublicBirthNoticeCreateResponse,
    PublicIntakeResponse,
    PublicLobbyTrainResponse,
    PublicMealTrainResponse,
    PublicMealTrainSuggestion,
    SignupCancelRequest,
    SignupCreate,
    SignupResponse,
)
from app.services.meal_trains import (
    DEFAULT_DELIVERY_TIME,
    DEFAULT_REMINDER_TIME,
    build_default_days,
    generate_token,
)


router = APIRouter(prefix="/api/public", tags=["public"])


def _today_in_project_timezone() -> date:
    settings = get_settings()
    try:
        return datetime.now(ZoneInfo(settings.timezone)).date()
    except Exception:
        return date.today()


def _normalize_family_title(family_name: str) -> str:
    cleaned = family_name.strip()
    if cleaned.startswith("משפחת"):
        return cleaned
    return f"משפחת {cleaned}"


def _future_day_buckets(train: MealTrain) -> tuple[list[MealDay], list[MealDay]]:
    today = _today_in_project_timezone()
    future_days = [day for day in train.days if day.date >= today]
    open_days = [day for day in future_days if day.status == MealDayStatus.open]
    return future_days, open_days


def _get_train_by_intake_token(db: Session, token: str) -> MealTrain:
    train = (
        db.query(MealTrain)
        .options(joinedload(MealTrain.days).joinedload(MealDay.signup), joinedload(MealTrain.intake_form))
        .filter(MealTrain.intake_token == token)
        .first()
    )
    if train is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Intake link not found.")
    return train


def _get_train_by_public_token(db: Session, token: str) -> MealTrain:
    train = (
        db.query(MealTrain)
        .options(joinedload(MealTrain.days).joinedload(MealDay.signup), joinedload(MealTrain.intake_form))
        .filter(MealTrain.public_token == token)
        .first()
    )
    if train is None or train.status != MealTrainStatus.published:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Public page not found.")
    return train


def _build_related_trains(db: Session, current_train_id: int) -> list[PublicMealTrainSuggestion]:
    trains = (
        db.query(MealTrain)
        .options(joinedload(MealTrain.days))
        .filter(MealTrain.status == MealTrainStatus.published, MealTrain.id != current_train_id)
        .order_by(MealTrain.published_at.desc(), MealTrain.created_at.desc())
        .all()
    )

    suggestions: list[PublicMealTrainSuggestion] = []
    for train in trains:
        _, open_days = _future_day_buckets(train)
        open_days = sorted(open_days, key=lambda day: day.date)
        if not open_days:
            continue

        suggestions.append(
            PublicMealTrainSuggestion(
                family_title=train.family_title,
                baby_type=train.baby_type.value if train.baby_type else None,
                public_token=train.public_token,
                open_days=len(open_days),
                next_open_date=open_days[0].date,
            )
        )

        if len(suggestions) == 4:
            break

    return suggestions


def _build_lobby_train(train: MealTrain) -> PublicLobbyTrainResponse | None:
    future_days, open_days = _future_day_buckets(train)
    visible_days = [day for day in future_days if day.status in (MealDayStatus.open, MealDayStatus.assigned)]
    if not visible_days:
        return None

    assigned_days = [day for day in visible_days if day.status == MealDayStatus.assigned]
    end_date = max((day.date for day in visible_days), default=None)
    next_open_day = min((day.date for day in open_days), default=None)

    return PublicLobbyTrainResponse(
        family_title=train.family_title,
        baby_type=train.baby_type.value if train.baby_type else None,
        public_token=train.public_token,
        start_date=train.start_date,
        end_date=end_date,
        open_days=len(open_days),
        assigned_days=len(assigned_days),
        next_open_date=next_open_day,
        stage="needs_signups" if open_days else "ongoing",
    )


@router.get("/intake/{token}", response_model=PublicIntakeResponse)
def get_intake_form(token: str, db: Session = Depends(get_db)) -> PublicIntakeResponse:
    train = _get_train_by_intake_token(db, token)
    return PublicIntakeResponse(
        family_title=train.family_title,
        mother_name=train.mother_name,
        baby_type=train.baby_type.value if train.baby_type else None,
        status=train.status.value,
        public_token=train.public_token,
        start_date=train.start_date,
        default_delivery_time=train.default_delivery_time,
        reminder_time=train.reminder_time,
        days=[MealDayResponse.model_validate(day) for day in train.days],
    )


@router.post("/intake/{token}", response_model=PublicIntakeResponse)
def submit_intake_form(
    token: str,
    payload: IntakeSubmission,
    db: Session = Depends(get_db),
) -> PublicIntakeResponse:
    train = _get_train_by_intake_token(db, token)

    if payload.mother_name:
        train.mother_name = payload.mother_name
    if payload.baby_type:
        train.baby_type = BabyType(payload.baby_type)

    if train.intake_form is None:
        intake_form = IntakeForm(
            meal_train_id=train.id,
            address=payload.address,
            household_size=payload.household_size,
            children_ages=payload.children_ages,
            special_requirements=payload.special_requirements,
            kashrut=payload.kashrut,
            contact_phone=payload.contact_phone,
            home_phone=payload.home_phone,
            backup_phone=payload.backup_phone,
            delivery_deadline=payload.delivery_deadline,
            general_notes=payload.general_notes,
        )
        db.add(intake_form)
    else:
        intake_form = train.intake_form
        intake_form.address = payload.address
        intake_form.household_size = payload.household_size
        intake_form.children_ages = payload.children_ages
        intake_form.special_requirements = payload.special_requirements
        intake_form.kashrut = payload.kashrut
        intake_form.contact_phone = payload.contact_phone
        intake_form.home_phone = payload.home_phone
        intake_form.backup_phone = payload.backup_phone
        intake_form.delivery_deadline = payload.delivery_deadline
        intake_form.general_notes = payload.general_notes

    choice_map = {choice.day_id: choice.needed for choice in payload.day_choices}
    for day in train.days:
        if day.id not in choice_map or day.status == MealDayStatus.assigned:
            continue
        day.status = MealDayStatus.open if choice_map[day.id] else MealDayStatus.not_needed
        if payload.delivery_deadline:
            day.delivery_deadline = payload.delivery_deadline

    if train.status != MealTrainStatus.published:
        train.status = MealTrainStatus.published
        if train.published_at is None:
            train.published_at = datetime.now(UTC)

    db.commit()
    db.refresh(train)
    return PublicIntakeResponse(
        family_title=train.family_title,
        mother_name=train.mother_name,
        baby_type=train.baby_type.value if train.baby_type else None,
        status=train.status.value,
        public_token=train.public_token,
        start_date=train.start_date,
        default_delivery_time=train.default_delivery_time,
        reminder_time=train.reminder_time,
        days=[MealDayResponse.model_validate(day) for day in train.days],
    )


@router.get("/trains/{public_token}", response_model=PublicMealTrainResponse)
def get_public_meal_train(public_token: str, db: Session = Depends(get_db)) -> PublicMealTrainResponse:
    train = _get_train_by_public_token(db, public_token)
    intake = train.intake_form
    return PublicMealTrainResponse(
        family_title=train.family_title,
        mother_name=train.mother_name,
        baby_type=train.baby_type.value if train.baby_type else None,
        start_date=train.start_date,
        default_delivery_time=intake.delivery_deadline if intake and intake.delivery_deadline else train.default_delivery_time,
        reminder_time=train.reminder_time,
        address=intake.address if intake else None,
        special_requirements=intake.special_requirements if intake else None,
        kashrut=intake.kashrut if intake else None,
        contact_phone=intake.contact_phone if intake else None,
        days=[MealDayResponse.model_validate(day) for day in train.days],
        related_trains=_build_related_trains(db, train.id),
    )


@router.get("/lobby", response_model=list[PublicLobbyTrainResponse])
def get_public_lobby(db: Session = Depends(get_db)) -> list[PublicLobbyTrainResponse]:
    trains = (
        db.query(MealTrain)
        .options(joinedload(MealTrain.days))
        .filter(MealTrain.status == MealTrainStatus.published)
        .order_by(MealTrain.published_at.desc(), MealTrain.created_at.desc())
        .all()
    )

    lobby_trains = [entry for train in trains if (entry := _build_lobby_train(train)) is not None]
    lobby_trains.sort(
        key=lambda train: (
            0 if train.open_days > 0 else 1,
            train.next_open_date or train.end_date or train.start_date,
        )
    )
    return lobby_trains


@router.post("/birth-notices", response_model=PublicBirthNoticeCreateResponse, status_code=status.HTTP_201_CREATED)
def create_birth_notice(
    payload: PublicBirthNoticeCreate,
    db: Session = Depends(get_db),
) -> PublicBirthNoticeCreateResponse:
    try:
        baby_type = BabyType(payload.baby_type)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid baby type.") from exc

    train = MealTrain(
        family_title=_normalize_family_title(payload.family_name),
        mother_name=payload.mother_name,
        baby_type=baby_type,
        start_date=payload.start_date,
        default_delivery_time=DEFAULT_DELIVERY_TIME,
        reminder_time=DEFAULT_REMINDER_TIME,
        intake_token=generate_token(),
        public_token=generate_token(),
        status=MealTrainStatus.draft,
    )
    train.days = build_default_days(payload.start_date, DEFAULT_DELIVERY_TIME)
    db.add(train)
    db.commit()
    db.refresh(train)

    return PublicBirthNoticeCreateResponse(
        intake_token=train.intake_token,
        family_title=train.family_title,
    )


@router.post("/meal-days/{day_id}/signup", response_model=SignupResponse, status_code=status.HTTP_201_CREATED)
def create_signup(day_id: int, payload: SignupCreate, db: Session = Depends(get_db)) -> SignupResponse:
    meal_day = (
        db.query(MealDay)
        .options(joinedload(MealDay.signup), joinedload(MealDay.meal_train).joinedload(MealTrain.intake_form))
        .filter(MealDay.id == day_id)
        .first()
    )
    if meal_day is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Day not found.")
    if meal_day.meal_train.status != MealTrainStatus.published:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This meal train is not published yet.")
    if meal_day.status != MealDayStatus.open:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This day is no longer available.")
    if meal_day.signup is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This day is already assigned.")

    signup = Signup(
        meal_day_id=meal_day.id,
        volunteer_key=payload.volunteer_key,
        volunteer_name=payload.volunteer_name,
        phone=payload.phone,
        email=payload.email or "",
        meal_type=payload.meal_type,
        note=payload.note,
    )
    db.add(signup)
    meal_day.status = MealDayStatus.assigned
    db.commit()
    db.refresh(signup)
    return SignupResponse.model_validate(signup)


@router.post("/meal-days/{day_id}/cancel", response_model=MealDayResponse)
def cancel_signup(day_id: int, payload: SignupCancelRequest, db: Session = Depends(get_db)) -> MealDayResponse:
    meal_day = (
        db.query(MealDay)
        .options(joinedload(MealDay.signup), joinedload(MealDay.meal_train))
        .filter(MealDay.id == day_id)
        .first()
    )
    if meal_day is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Day not found.")
    if meal_day.signup is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="אין הרשמה פעילה ליום הזה.")

    signup = meal_day.signup
    key_matches = bool(payload.volunteer_key and signup.volunteer_key == payload.volunteer_key)
    phone_matches = bool(payload.phone and signup.phone == payload.phone)
    if not key_matches and not phone_matches:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="אי אפשר לבטל הרשמה שלא שייכת אלייך.")

    db.delete(signup)
    meal_day.status = MealDayStatus.open
    db.commit()
    db.refresh(meal_day)
    return MealDayResponse.model_validate(meal_day)
