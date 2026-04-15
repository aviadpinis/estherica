from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.services.meal_trains import validate_schedule_window


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
    is_twins: bool
    status: str
    birth_date: date
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
    is_twins: bool
    status: str
    birth_date: date
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
    is_twins: bool = False
    birth_date: date
    start_date: date
    default_delivery_time: str
    reminder_time: str

    @model_validator(mode="after")
    def validate_schedule_dates(self) -> "MealTrainCreate":
        validate_schedule_window(self.birth_date, self.start_date)
        return self


class MealTrainUpdate(BaseModel):
    family_title: str | None = None
    mother_name: str | None = None
    contact_phone: str | None = None
    baby_type: str | None = None
    is_twins: bool | None = None
    birth_date: date | None = None
    start_date: date | None = None
    default_delivery_time: str | None = None
    reminder_time: str | None = None
    household_size: str | None = None
    children_ages: str | None = None
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
    day_id: int | None = None
    date: date
    needed: bool


class IntakeSubmission(BaseModel):
    mother_name: str | None = None
    baby_type: str | None = None
    is_twins: bool = False
    birth_date: date
    start_date: date
    address: str
    household_size: str = Field(min_length=1)
    children_ages: str = Field(min_length=1)
    special_requirements: str | None = None
    kashrut: str | None = None
    contact_phone: str
    home_phone: str | None = None
    backup_phone: str | None = None
    delivery_deadline: str | None = None
    general_notes: str | None = None
    day_choices: list[IntakeDayChoice]

    @field_validator("household_size", "children_ages")
    @classmethod
    def validate_required_text(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("חובה למלא")
        return cleaned

    @model_validator(mode="after")
    def validate_schedule_dates(self) -> "IntakeSubmission":
        validate_schedule_window(self.birth_date, self.start_date)
        return self


class PublicIntakeResponse(BaseModel):
    family_title: str
    mother_name: str | None
    contact_phone: str | None
    baby_type: str | None
    is_twins: bool
    status: str
    public_token: str
    birth_date: date
    start_date: date
    default_delivery_time: str
    reminder_time: str
    days: list[MealDayResponse]


class PublicMealTrainSuggestion(BaseModel):
    family_title: str
    baby_type: str | None
    is_twins: bool
    public_token: str
    open_days: int
    next_open_date: date | None


class PublicLobbyTrainResponse(BaseModel):
    family_title: str
    baby_type: str | None
    is_twins: bool
    public_token: str
    start_date: date
    end_date: date | None
    open_days: int
    assigned_days: int
    next_open_date: date | None
    stage: str


class PublicLobbyResponse(BaseModel):
    active_trains: list[PublicLobbyTrainResponse]
    recent_trains: list[PublicLobbyTrainResponse]


class PublicVolunteerSignupsLookup(BaseModel):
    volunteer_key: str | None = None
    phone: str | None = None


class PublicVolunteerSignupResponse(BaseModel):
    family_title: str
    baby_type: str | None
    is_twins: bool
    public_token: str
    date: date
    delivery_deadline: str
    address: str | None = None


class PublicMealTrainResponse(BaseModel):
    family_title: str
    mother_name: str | None
    baby_type: str | None
    is_twins: bool
    birth_date: date
    start_date: date
    default_delivery_time: str
    reminder_time: str
    address: str | None
    household_size: str | None
    children_ages: str | None
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
    is_twins: bool = False
    volunteer_name: str
    phone: str
    meal_type: str | None
    delivery_deadline: str
    address: str | None = None
    household_size: str | None = None
    children_ages: str | None = None
    kashrut: str | None = None
    special_requirements: str | None = None
    contact_phone: str | None = None


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
    today_reminders: list[AdminUpcomingAssignment]
    volunteer_stats: list[AdminVolunteerStats]
    attention_trains: list[AdminAttentionTrain]


class PublicBirthNoticeCreate(BaseModel):
    family_name: str
    mother_name: str | None = None
    baby_type: str | None = None
    is_twins: bool = False
    birth_date: date
    start_date: date

    @model_validator(mode="after")
    def validate_schedule_dates(self) -> "PublicBirthNoticeCreate":
        validate_schedule_window(self.birth_date, self.start_date)
        return self


class PublicBirthNoticeCreateResponse(BaseModel):
    intake_token: str
    family_title: str


class SmsReminderClaimRequest(BaseModel):
    device_id: str = Field(min_length=2, max_length=120)
    for_date: date | None = None


class SmsReminderDispatchResponse(BaseModel):
    dispatch_id: int
    meal_day_id: int
    scheduled_for: date
    delivery_deadline: str
    volunteer_name: str
    volunteer_phone: str
    family_title: str
    mother_name: str | None
    address: str | None
    kashrut: str | None
    special_requirements: str | None
    contact_phone: str | None
    household_size: str | None
    children_ages: str | None
    message_text: str


class SmsReminderClaimResponse(BaseModel):
    for_date: date
    dispatches: list[SmsReminderDispatchResponse]


class SmsReminderReportItem(BaseModel):
    dispatch_id: int
    status: str
    provider_message_id: str | None = None
    failure_reason: str | None = None
    reported_at: datetime | None = None

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: str) -> str:
        normalized = value.strip().lower()
        if normalized not in {"sent", "failed"}:
            raise ValueError("status must be sent or failed")
        return normalized


class SmsReminderReportRequest(BaseModel):
    device_id: str = Field(min_length=2, max_length=120)
    results: list[SmsReminderReportItem]


class SmsReminderReportResponse(BaseModel):
    updated: int
    sent: int
    failed: int
