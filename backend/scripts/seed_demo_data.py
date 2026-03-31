from __future__ import annotations

import sys
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from pathlib import Path

from sqlalchemy import text
from sqlalchemy.orm import joinedload


PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.db.session import SessionLocal
from app.main import ensure_schema
from app.models.entities import BabyType, IntakeForm, MealDay, MealDayStatus, MealTrain, MealTrainStatus, Signup
from app.services.admins import ensure_bootstrap_admin
from app.services.meal_trains import DEFAULT_DELIVERY_TIME, DEFAULT_REMINDER_TIME, build_default_days, generate_token


DEMO_MARKER = "(דמו)"
MEAL_TYPES = [
    "מרק וקציצות",
    "פשטידה וסלט",
    "עוף ואורז",
    "לזניה",
    "קציצות ברוטב",
    "פסטה לילדים",
]
NOTES = [
    "אעדכן לפני שאני יוצאת.",
    "אפשר להשאיר ליד הדלת.",
    "מביאה גם משהו קטן לילדים.",
    "מגיעה סביב 18:00.",
]


@dataclass(frozen=True)
class VolunteerProfile:
    key: str
    name: str
    phone: str
    email: str


@dataclass(frozen=True)
class TrainSpec:
    family_title: str
    mother_name: str
    baby_type: BabyType
    start_offset_days: int
    address: str
    household_size: str
    children_ages: str
    special_requirements: str
    kashrut: str
    contact_phone: str
    home_phone: str
    backup_phone: str
    general_notes: str
    published: bool
    gift_delivered: bool
    assignments: list[tuple[int, int]]
    open_day_indexes: list[int]


VOLUNTEERS: list[VolunteerProfile] = [
    VolunteerProfile("demo-vol-001", "איילת", "050-300-1001", "demo01@estherica.local"),
    VolunteerProfile("demo-vol-002", "מוריה", "050-300-1002", "demo02@estherica.local"),
    VolunteerProfile("demo-vol-003", "שירה", "050-300-1003", "demo03@estherica.local"),
    VolunteerProfile("demo-vol-004", "הודיה", "050-300-1004", "demo04@estherica.local"),
    VolunteerProfile("demo-vol-005", "נועה", "050-300-1005", "demo05@estherica.local"),
    VolunteerProfile("demo-vol-006", "יעל", "050-300-1006", "demo06@estherica.local"),
    VolunteerProfile("demo-vol-007", "חנה", "050-300-1007", "demo07@estherica.local"),
    VolunteerProfile("demo-vol-008", "תמר", "050-300-1008", "demo08@estherica.local"),
    VolunteerProfile("demo-vol-009", "אביטל", "050-300-1009", "demo09@estherica.local"),
    VolunteerProfile("demo-vol-010", "דנה", "050-300-1010", "demo10@estherica.local"),
    VolunteerProfile("demo-vol-011", "אודל", "050-300-1011", "demo11@estherica.local"),
    VolunteerProfile("demo-vol-012", "רונית", "050-300-1012", "demo12@estherica.local"),
    VolunteerProfile("demo-vol-013", "סיגל", "050-300-1013", "demo13@estherica.local"),
    VolunteerProfile("demo-vol-014", "מיכל", "050-300-1014", "demo14@estherica.local"),
    VolunteerProfile("demo-vol-015", "טליה", "050-300-1015", "demo15@estherica.local"),
    VolunteerProfile("demo-vol-016", "ניצן", "050-300-1016", "demo16@estherica.local"),
    VolunteerProfile("demo-vol-017", "רותם", "050-300-1017", "demo17@estherica.local"),
    VolunteerProfile("demo-vol-018", "אפרת", "050-300-1018", "demo18@estherica.local"),
    VolunteerProfile("demo-vol-019", "שרון", "050-300-1019", "demo19@estherica.local"),
    VolunteerProfile("demo-vol-020", "עדן", "050-300-1020", "demo20@estherica.local"),
    VolunteerProfile("demo-vol-021", "הילה", "050-300-1021", "demo21@estherica.local"),
    VolunteerProfile("demo-vol-022", "נגה", "050-300-1022", "demo22@estherica.local"),
    VolunteerProfile("demo-vol-023", "ספיר", "050-300-1023", "demo23@estherica.local"),
    VolunteerProfile("demo-vol-024", "עדי", "050-300-1024", "demo24@estherica.local"),
    VolunteerProfile("demo-vol-025", "סתיו", "050-300-1025", "demo25@estherica.local"),
]


TRAIN_SPECS: list[TrainSpec] = [
    TrainSpec(
        family_title=f"משפחת כהן {DEMO_MARKER}",
        mother_name="רחלי",
        baby_type=BabyType.boy,
        start_offset_days=-4,
        address="רחוב הרימון 12, פינוק ליולדת",
        household_size="6",
        children_ages="8, 5, 2",
        special_requirements="בלי חריף, עדיף מנה שמתאימה גם לילדים.",
        kashrut="כשרות רגילה",
        contact_phone="050-700-1101",
        home_phone="02-500-1101",
        backup_phone="050-700-1199",
        general_notes="אפשר להשאיר ליד הדלת ולעדכן בטלפון.",
        published=True,
        gift_delivered=True,
        assignments=[(index, index) for index in range(10)],
        open_day_indexes=[],
    ),
    TrainSpec(
        family_title=f"משפחת לוי {DEMO_MARKER}",
        mother_name="הדר",
        baby_type=BabyType.girl,
        start_offset_days=-2,
        address="רחוב האלון 5, פינוק ליולדת",
        household_size="5",
        children_ages="6, 4",
        special_requirements="עדיף ללא בצל חי.",
        kashrut="מהדרין",
        contact_phone="050-700-1201",
        home_phone="02-500-1201",
        backup_phone="050-700-1299",
        general_notes="נוח לקבל אחרי שהילדים חוזרים מהמסגרות.",
        published=True,
        gift_delivered=False,
        assignments=[
            (0, 10),
            (1, 11),
            (2, 12),
            (4, 13),
            (5, 14),
            (6, 15),
            (7, 16),
            (8, 17),
            (9, 18),
        ],
        open_day_indexes=[3],
    ),
    TrainSpec(
        family_title=f"משפחת אזולאי {DEMO_MARKER}",
        mother_name="שני",
        baby_type=BabyType.boy,
        start_offset_days=-1,
        address="רחוב השקד 9, פינוק ליולדת",
        household_size="7",
        children_ages="9, 7, 3, תינוק",
        special_requirements="להימנע מפטריות. אם אפשר, לצרף גם משהו קל לילדים.",
        kashrut="כשרות רגילה",
        contact_phone="050-700-1301",
        home_phone="02-500-1301",
        backup_phone="050-700-1399",
        general_notes="יש כלב קטן בחצר, עדיף לעדכן לפני ההגעה.",
        published=True,
        gift_delivered=False,
        assignments=[
            (0, 19),
            (1, 20),
            (2, 21),
            (3, 22),
            (4, 23),
            (6, 24),
            (7, 2),
            (8, 5),
            (9, 8),
        ],
        open_day_indexes=[5],
    ),
    TrainSpec(
        family_title=f"משפחת מזרחי {DEMO_MARKER}",
        mother_name="יסכה",
        baby_type=BabyType.girl,
        start_offset_days=1,
        address="רחוב התאנה 18, פינוק ליולדת",
        household_size="4",
        children_ages="5, 1",
        special_requirements="עדיף ארוחה חלבית או פרווה.",
        kashrut="מהדרין",
        contact_phone="050-700-1401",
        home_phone="02-500-1401",
        backup_phone="050-700-1499",
        general_notes="עדיין לא מילאה את השאלון, נשמר כדמו לטיוטה.",
        published=False,
        gift_delivered=False,
        assignments=[],
        open_day_indexes=[],
    ),
]


def clear_previous_demo_trains() -> int:
    with SessionLocal() as db:
        demo_trains = [
            train
            for train in db.query(MealTrain)
            .options(joinedload(MealTrain.days).joinedload(MealDay.signup), joinedload(MealTrain.intake_form))
            .all()
            if train.family_title and DEMO_MARKER in train.family_title
        ]

        for train in demo_trains:
            db.delete(train)

        db.commit()
        return len(demo_trains)


def cleanup_orphaned_rows() -> None:
    with SessionLocal() as db:
        db.execute(
            text(
                """
                DELETE FROM signups
                WHERE meal_day_id NOT IN (SELECT id FROM meal_days)
                """
            )
        )
        db.execute(
            text(
                """
                DELETE FROM meal_days
                WHERE meal_train_id NOT IN (SELECT id FROM meal_trains)
                """
            )
        )
        db.execute(
            text(
                """
                DELETE FROM intake_forms
                WHERE meal_train_id NOT IN (SELECT id FROM meal_trains)
                """
            )
        )
        db.commit()


def build_intake_form(spec: TrainSpec) -> IntakeForm:
    return IntakeForm(
        address=spec.address,
        household_size=spec.household_size,
        children_ages=spec.children_ages,
        special_requirements=spec.special_requirements,
        kashrut=spec.kashrut,
        contact_phone=spec.contact_phone,
        home_phone=spec.home_phone,
        backup_phone=spec.backup_phone,
        delivery_deadline=DEFAULT_DELIVERY_TIME,
        general_notes=spec.general_notes,
    )


def assign_demo_signups(train: MealTrain, assignments: list[tuple[int, int]]) -> None:
    for order, (day_index, volunteer_index) in enumerate(assignments):
        volunteer = VOLUNTEERS[volunteer_index]
        day = train.days[day_index]
        day.status = MealDayStatus.assigned
        day.admin_note = "שובצה מבשלת בדמו"
        day.signup = Signup(
            volunteer_key=volunteer.key,
            volunteer_name=volunteer.name,
            phone=volunteer.phone,
            email=volunteer.email,
            meal_type=MEAL_TYPES[order % len(MEAL_TYPES)],
            note=NOTES[order % len(NOTES)],
        )


def seed_demo_data() -> dict[str, int]:
    ensure_schema()

    with SessionLocal() as db:
        ensure_bootstrap_admin(db)

    cleanup_orphaned_rows()
    removed_count = clear_previous_demo_trains()
    today = date.today()
    created_count = 0
    signup_count = 0

    with SessionLocal() as db:
        for spec in TRAIN_SPECS:
            start_date = today + timedelta(days=spec.start_offset_days)
            train = MealTrain(
                family_title=spec.family_title,
                mother_name=spec.mother_name,
                baby_type=spec.baby_type,
                status=MealTrainStatus.published if spec.published else MealTrainStatus.draft,
                start_date=start_date,
                default_delivery_time=DEFAULT_DELIVERY_TIME,
                reminder_time=DEFAULT_REMINDER_TIME,
                gift_delivered=spec.gift_delivered,
                intake_token=generate_token(),
                public_token=generate_token(),
                published_at=datetime.now(UTC) - timedelta(days=max(0, abs(spec.start_offset_days)))
                if spec.published
                else None,
            )
            train.days = build_default_days(start_date, DEFAULT_DELIVERY_TIME)

            if spec.published:
                train.intake_form = build_intake_form(spec)

            db.add(train)
            db.flush()

            for day_index in spec.open_day_indexes:
                day = train.days[day_index]
                day.status = MealDayStatus.open
                day.admin_note = "עדיין צריך שיבוץ"

            assign_demo_signups(train, spec.assignments)
            created_count += 1
            signup_count += len(spec.assignments)

        db.commit()

    return {
        "removed": removed_count,
        "created": created_count,
        "signups": signup_count,
        "volunteers": len(VOLUNTEERS),
    }


def main() -> None:
    summary = seed_demo_data()
    print("Demo data seeded successfully.")
    print(f"Removed demo trains: {summary['removed']}")
    print(f"Created demo trains: {summary['created']}")
    print(f"Created signups: {summary['signups']}")
    print(f"Volunteer profiles represented: {summary['volunteers']}")


if __name__ == "__main__":
    main()
