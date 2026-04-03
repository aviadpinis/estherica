from __future__ import annotations

import enum
from datetime import date, datetime

from sqlalchemy import Date, DateTime, Enum, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

from app.core.encryption import EncryptedValue


class Base(DeclarativeBase):
    pass


class Admin(Base):
    __tablename__ = "admins"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    full_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    email: Mapped[str] = mapped_column(String(160), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class MealTrainStatus(str, enum.Enum):
    draft = "draft"
    published = "published"
    completed = "completed"


class BabyType(str, enum.Enum):
    boy = "boy"
    girl = "girl"


class MealDayStatus(str, enum.Enum):
    open = "open"
    assigned = "assigned"
    not_needed = "not_needed"


class SignupStatus(str, enum.Enum):
    active = "active"
    cancelled = "cancelled"


class MealTrain(Base):
    __tablename__ = "meal_trains"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    family_title: Mapped[str] = mapped_column(EncryptedValue(), nullable=False)
    mother_name: Mapped[str | None] = mapped_column(EncryptedValue(), nullable=True)
    contact_phone: Mapped[str | None] = mapped_column(EncryptedValue(), nullable=True)
    baby_type: Mapped[BabyType | None] = mapped_column(Enum(BabyType), nullable=True)
    status: Mapped[MealTrainStatus] = mapped_column(
        Enum(MealTrainStatus),
        default=MealTrainStatus.draft,
        nullable=False,
    )
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    timezone: Mapped[str] = mapped_column(String(64), default="Asia/Jerusalem", nullable=False)
    default_delivery_time: Mapped[str] = mapped_column(String(5), nullable=False)
    reminder_time: Mapped[str] = mapped_column(String(5), nullable=False)
    gift_delivered: Mapped[bool] = mapped_column(default=False, nullable=False)
    intake_token: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    public_token: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    intake_form: Mapped[IntakeForm | None] = relationship(
        back_populates="meal_train",
        cascade="all, delete-orphan",
        uselist=False,
    )
    days: Mapped[list[MealDay]] = relationship(
        back_populates="meal_train",
        cascade="all, delete-orphan",
        order_by="MealDay.date",
    )


class IntakeForm(Base):
    __tablename__ = "intake_forms"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    meal_train_id: Mapped[int] = mapped_column(ForeignKey("meal_trains.id"), unique=True, nullable=False)
    address: Mapped[str] = mapped_column(EncryptedValue(), nullable=False)
    household_size: Mapped[str | None] = mapped_column(EncryptedValue(), nullable=True)
    children_ages: Mapped[str | None] = mapped_column(EncryptedValue(), nullable=True)
    special_requirements: Mapped[str | None] = mapped_column(EncryptedValue(), nullable=True)
    kashrut: Mapped[str | None] = mapped_column(EncryptedValue(), nullable=True)
    contact_phone: Mapped[str] = mapped_column(EncryptedValue(), nullable=False)
    home_phone: Mapped[str | None] = mapped_column(EncryptedValue(), nullable=True)
    backup_phone: Mapped[str | None] = mapped_column(EncryptedValue(), nullable=True)
    delivery_deadline: Mapped[str | None] = mapped_column(EncryptedValue(), nullable=True)
    general_notes: Mapped[str | None] = mapped_column(EncryptedValue(), nullable=True)
    submitted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    meal_train: Mapped[MealTrain] = relationship(back_populates="intake_form")


class MealDay(Base):
    __tablename__ = "meal_days"
    __table_args__ = (UniqueConstraint("meal_train_id", "date", name="uq_meal_day_per_train"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    meal_train_id: Mapped[int] = mapped_column(ForeignKey("meal_trains.id"), nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[MealDayStatus] = mapped_column(
        Enum(MealDayStatus), default=MealDayStatus.open, nullable=False
    )
    is_default: Mapped[bool] = mapped_column(default=True, nullable=False)
    delivery_deadline: Mapped[str] = mapped_column(String(5), nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, nullable=False)
    admin_note: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    meal_train: Mapped[MealTrain] = relationship(back_populates="days")
    signup: Mapped[Signup | None] = relationship(
        back_populates="meal_day",
        cascade="all, delete-orphan",
        uselist=False,
    )


class Signup(Base):
    __tablename__ = "signups"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    meal_day_id: Mapped[int] = mapped_column(ForeignKey("meal_days.id"), unique=True, nullable=False)
    volunteer_key: Mapped[str | None] = mapped_column(String(64), nullable=True)
    volunteer_name: Mapped[str] = mapped_column(String(120), nullable=False)
    phone: Mapped[str] = mapped_column(String(40), nullable=False)
    email: Mapped[str] = mapped_column(String(160), nullable=False)
    meal_type: Mapped[str | None] = mapped_column(String(40), nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[SignupStatus] = mapped_column(
        Enum(SignupStatus), default=SignupStatus.active, nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    meal_day: Mapped[MealDay] = relationship(back_populates="signup")
