from datetime import date, datetime

from pydantic import BaseModel, ConfigDict


class SignupResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    volunteer_key: str | None = None
    volunteer_name: str
    phone: str
    email: str | None = None
    meal_type: str | None
    note: str | None
    status: str
    created_at: datetime


class MealDayResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    date: date
    status: str
    is_default: bool
    delivery_deadline: str
    display_order: int
    admin_note: str | None
    signup: SignupResponse | None = None


class IntakeFormResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    address: str
    household_size: str | None
    children_ages: str | None
    special_requirements: str | None
    kashrut: str | None
    contact_phone: str
    home_phone: str | None
    backup_phone: str | None
    delivery_deadline: str | None
    general_notes: str | None
    submitted_at: datetime


class MealTrainSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    family_title: str
    mother_name: str | None
    contact_phone: str | None
    baby_type: str | None
    status: str
    start_date: date
    default_delivery_time: str
    reminder_time: str
    gift_delivered: bool
    lobby_visible: bool
    intake_token: str
    public_token: str
    created_at: datetime
    intake_submitted: bool
    intake_submitted_at: datetime | None
    total_days: int
    open_days: int
    assigned_days: int
    end_date: date | None
    is_archived: bool
    urgent_open_days: int
    completion_rate: float
    risk_level: str


class MealTrainDetail(BaseModel):
    id: int
    family_title: str
    mother_name: str | None
    contact_phone: str | None
    baby_type: str | None
    status: str
    start_date: date
    default_delivery_time: str
    reminder_time: str
    gift_delivered: bool
    lobby_visible: bool
    timezone: str
    intake_token: str
    public_token: str
    published_at: datetime | None
    created_at: datetime
    updated_at: datetime
    intake_form: IntakeFormResponse | None
    days: list[MealDayResponse]


class MealTrainCreate(BaseModel):
    family_title: str
    mother_name: str | None = None
    contact_phone: str | None = None
    baby_type: str | None = None
    start_date: date
    default_delivery_time: str
    reminder_time: str


class MealTrainUpdate(BaseModel):
    family_title: str | None = None
    mother_name: str | None = None
    contact_phone: str | None = None
    baby_type: str | None = None
    default_delivery_time: str | None = None
    reminder_time: str | None = None
    gift_delivered: bool | None = None
    lobby_visible: bool | None = None
    status: str | None = None


class MealDayCreate(BaseModel):
    date: date
    delivery_deadline: str | None = None
    admin_note: str | None = None
    status: str = "open"


class MealDayUpdate(BaseModel):
    delivery_deadline: str | None = None
    admin_note: str | None = None
    status: str | None = None


class IntakeDayChoice(BaseModel):
    day_id: int
    needed: bool


class IntakeSubmission(BaseModel):
    mother_name: str | None = None
    baby_type: str | None = None
    address: str
    household_size: str | None = None
    children_ages: str | None = None
    special_requirements: str | None = None
    kashrut: str | None = None
    contact_phone: str
    home_phone: str | None = None
    backup_phone: str | None = None
    delivery_deadline: str | None = None
    general_notes: str | None = None
    day_choices: list[IntakeDayChoice]


class PublicIntakeResponse(BaseModel):
    family_title: str
    mother_name: str | None
    contact_phone: str | None
    baby_type: str | None
    status: str
    public_token: str
    start_date: date
    default_delivery_time: str
    reminder_time: str
    days: list[MealDayResponse]


class PublicMealTrainSuggestion(BaseModel):
    family_title: str
    baby_type: str | None
    public_token: str
    open_days: int
    next_open_date: date | None


class PublicLobbyTrainResponse(BaseModel):
    family_title: str
    baby_type: str | None
    public_token: str
    start_date: date
    end_date: date | None
    open_days: int
    assigned_days: int
    next_open_date: date | None
    stage: str


class PublicVolunteerSignupsLookup(BaseModel):
    volunteer_key: str | None = None
    phone: str | None = None


class PublicVolunteerSignupResponse(BaseModel):
    family_title: str
    baby_type: str | None
    public_token: str
    date: date
    delivery_deadline: str
    address: str | None = None


class PublicMealTrainResponse(BaseModel):
    family_title: str
    mother_name: str | None
    baby_type: str | None
    start_date: date
    default_delivery_time: str
    reminder_time: str
    address: str | None
    special_requirements: str | None
    kashrut: str | None
    contact_phone: str | None
    days: list[MealDayResponse]
    related_trains: list[PublicMealTrainSuggestion]


class SignupCreate(BaseModel):
    volunteer_key: str | None = None
    volunteer_name: str
    phone: str
    email: str | None = None
    meal_type: str | None = None
    note: str | None = None


class SignupCancelRequest(BaseModel):
    volunteer_key: str | None = None
    phone: str | None = None


class AdminUpcomingAssignment(BaseModel):
    date: date
    family_title: str
    mother_name: str | None
    baby_type: str | None
    volunteer_name: str
    phone: str
    meal_type: str | None
    delivery_deadline: str


class AdminVolunteerStats(BaseModel):
    volunteer_key: str | None
    volunteer_name: str
    total_signups: int
    active_signups: int
    last_signup_at: datetime | None


class AdminAttentionTrain(BaseModel):
    train_id: int
    family_title: str
    mother_name: str | None
    baby_type: str | None
    open_days: int
    urgent_open_days: int
    next_open_date: date | None
    completion_rate: float


class AdminOverviewResponse(BaseModel):
    active_train_count: int
    archived_train_count: int
    total_open_days: int
    urgent_open_days: int
    total_assigned_days: int
    upcoming_assignments: list[AdminUpcomingAssignment]
    volunteer_stats: list[AdminVolunteerStats]
    attention_trains: list[AdminAttentionTrain]


class PublicBirthNoticeCreate(BaseModel):
    family_name: str
    mother_name: str | None = None
    baby_type: str
    start_date: date


class PublicBirthNoticeCreateResponse(BaseModel):
    intake_token: str
    family_title: str
