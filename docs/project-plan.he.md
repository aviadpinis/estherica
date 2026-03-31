# Estherica: תוכנית מוצר וארכיטקטורה

## מטרה

המוצר נועד להחליף את תהליך ה-Google Sheet הידני במערכת קטנה, פשוטה, ומסודרת:

- מנהלת פותחת יולדת חדשה.
- נוצר ליולדת קישור אישי.
- היולדת ממלאת פרטים ובוחרת באילו ימים צריך ארוחה.
- המערכת יוצרת אוטומטית טבלת ימים לשבועיים בלבד, בלי שישי ושבת.
- המנהלת יכולה להוסיף או להוריד ימים.
- נשים מהיישוב מקבלות קישור ציבורי ומשתבצות.
- המערכת שולחת תזכורות.
- הכל מנוהל ממסך אחד, גם עבור כמה יולדות במקביל.

## החלטה מרכזית

### לא להשתמש ב-Google Drive כמקור האמת

לשימוש חד-פעמי Google Sheet באמת מרגיש פשוט, אבל ברגע שיש:

- כמה יולדות במקביל
- קישורים ציבוריים
- מניעת כפילויות
- תזכורות
- עריכת ימים
- פרטיות של כתובת וטלפון

הוא נהיה מקור לבלגן.

### ההמלצה

המערכת עצמה תהיה מקור האמת:

- `React` ל-client
- `FastAPI` ל-backend
- `PostgreSQL` קטן ופשוט לנתונים

ו-Google Sheets יהיה רק אופציה עתידית לייצוא או סנכרון קריאה בלבד.

## זרימת המוצר

### 1. פתיחת מקרה חדש

המנהלת פותחת "יולדת חדשה" ומזינה:

- כותרת או שם משפחה
- תאריך התחלה
- שעת יעד להבאת ארוחה
- שעת תזכורת

מיד אחר כך המערכת יוצרת:

- `meal_train`
- קישור אישי ליולדת
- קישור ציבורי שישמש בהמשך
- רשימת ימים ראשונית ל-14 ימים קלנדריים, בלי שישי ושבת

### 2. מילוי טופס יולדת

היולדת תקבל קישור אישי, בלי login, ותמלא:

- כתובת
- נפשות
- גילאי הילדים
- דרישות מיוחדות
- כשרויות
- טלפון יולדת או מי שבבית
- עד איזו שעה להביא ארוחה
- הערות חופשיות

בנוסף, היא תראה את רשימת הימים שנוצרו ותוכל לסמן לכל יום:

- צריך
- לא צריך

זה עדיף על שאלה פתוחה של "אם יש ימים שלא תהיו", כי כך מקבלים תוצאה ברורה ומידית.

### 3. בדיקה ופרסום על ידי המנהלת

לאחר שליחת הטופס:

- המנהלת רואה את כל הפרטים
- יכולה להסיר יום
- יכולה להוסיף יום
- יכולה לשנות יום ל"לא צריך"
- יכולה לשנות שעה ליום מסוים
- יכולה לפרסם את הקישור הציבורי

### 4. השתבצות ציבורית

נשים מהיישוב ייכנסו לקישור הציבורי ויראו:

- כותרת
- הערות רלוונטיות
- כשרות / דרישות מיוחדות
- שעת הגעה רצויה
- ימי ההשתבצות

לכל יום יופיע:

- תאריך בעברית
- תאריך באנגלית
- יום בשבוע
- סטטוס: פנוי / תפוס / לא צריך

על יום פנוי המשתבצת תמלא:

- שם
- טלפון
- אימייל
- חלבי / בשרי
- הערה

### 5. תזכורות

ביום הרלוונטי המערכת תשלח:

- מייל תזכורת למשתבצת
- אופציונלית מייל עדכון למנהלת

ב-MVP עדיף מייל בלבד. WhatsApp אוטומטי נשמור לשלב מתקדם.

## למה לא להתחיל עם WhatsApp אוטומטי

ל-MVP חינמי ולא-מסחרי, WhatsApp API מוסיף:

- onboarding עסקי
- תבניות
- עלויות
- מורכבות תפעולית

לכן עדיף:

- שיתוף קישורים ידני בוואטסאפ
- תזכורות אוטומטיות במייל

## דרישות MVP

- ניהול כמה יולדות במקביל
- login רק למנהלת
- טופס ציבורי ליולדת
- קישור ציבורי להשתבצות
- יצירת ימים אוטומטית לשבועיים בלבד
- החרגת שישי ושבת כברירת מחדל
- אפשרות למנהלת להוסיף ולהוריד ימים
- מניעת הרשמה כפולה לאותו יום
- תצוגת תאריך בעברית ובאנגלית
- תזכורות אוטומטיות
- מסך ניהול עם סטטוסים

## מסכים עיקריים

### מסך מנהלת

- התחברות
- רשימת כל המקרים
- סטטוס לכל מקרה: `draft`, `published`, `completed`
- פתיחת מקרה חדש
- עריכת פרטי יולדת
- עריכת ימים
- העתקת קישורים
- צפייה בהשתבצויות

### מסך טופס יולדת

- מותאם מובייל
- טופס קצר וברור
- רשימת ימים עם מתג צריך/לא צריך
- הודעת הצלחה

### מסך השתבצות ציבורי

- כותרת נעימה
- רשימת ימים זמינים
- טופס מהיר להשתבצות
- הודעת הצלחה
- חסימת כפילויות בזמן אמת

## מבנה נתונים מוצע

### `admins`

- `id`
- `name`
- `email`
- `password_hash`
- `created_at`

### `meal_trains`

- `id`
- `family_title`
- `mother_name`
- `status`
- `start_date`
- `timezone`
- `default_delivery_time`
- `reminder_time`
- `intake_token`
- `public_token`
- `published_at`
- `created_at`
- `updated_at`

### `intake_forms`

- `id`
- `meal_train_id`
- `address`
- `household_size`
- `children_ages`
- `special_requirements`
- `kashrut`
- `contact_phone`
- `backup_phone`
- `delivery_deadline`
- `general_notes`
- `submitted_at`

### `meal_days`

- `id`
- `meal_train_id`
- `date`
- `status`
- `is_default`
- `delivery_deadline`
- `display_order`
- `admin_note`
- `created_at`

### `signups`

- `id`
- `meal_day_id`
- `volunteer_name`
- `phone`
- `email`
- `meal_type`
- `note`
- `status`
- `created_at`
- `cancelled_at`

### `notifications`

- `id`
- `meal_train_id`
- `meal_day_id`
- `signup_id`
- `channel`
- `template_key`
- `scheduled_for`
- `sent_at`
- `status`
- `provider_message_id`
- `error_message`

## חוקי מערכת

### יצירת ימים

ברירת מחדל:

- 14 ימים קלנדריים מהתאריך שנבחר
- בלי שישי ושבת
- רק הימים שנופלים בתוך החלון

### גמישות למנהלת

אחרי היצירה האוטומטית המנהלת יכולה:

- למחוק יום
- להוסיף יום
- לשנות שעת יעד ליום מסוים
- להפוך יום ל"לא צריך"
- להחזיר יום ל"פתוח"

### מניעת כפילויות

יום אחד יכול להכיל השתבצות פעילה אחת בלבד.

את זה צריך לאכוף גם ב-API וגם ברמת בסיס הנתונים.

### פרטיות

המלצה:

- בקישור הציבורי לא לחשוף יותר מדי מראש
- כתובת מלאה וטלפונים להציג רק אחרי השתבצות או רק בדף האישור

## ארכיטקטורה טכנית

### Frontend

- `React`
- `Vite`
- `React Router`
- `React Hook Form`
- `Zod`
- `TanStack Query`

לא צריך Redux ולא צריך Next.js.

### Backend

- `FastAPI`
- `SQLModel` או `SQLAlchemy`
- `Alembic`
- `Pydantic`

שכבות פשוטות:

- auth
- meal trains
- intake
- signups
- reminders
- notifications

### Database

- `PostgreSQL`

גם אם המערכת קטנה, PostgreSQL עדיף על SQLite לפריסה בענן ולמניעת בעיות נעילה.

## מבנה ריפו מומלץ

```text
estherica/
  backend/
    app/
      api/
      core/
      db/
      models/
      schemas/
      services/
      repositories/
      tasks/
      main.py
    alembic/
    requirements.txt
  frontend/
    src/
      app/
      api/
      pages/
      features/
        admin/
        intake/
        volunteer/
      components/
      lib/
      styles/
    package.json
  docs/
    project-plan.he.md
    system-architecture.excalidraw
```

## API מוצע

### Admin

- `POST /api/admin/auth/login`
- `GET /api/admin/me`
- `GET /api/admin/meal-trains`
- `POST /api/admin/meal-trains`
- `GET /api/admin/meal-trains/{id}`
- `PATCH /api/admin/meal-trains/{id}`
- `POST /api/admin/meal-trains/{id}/publish`

### ימים

- `POST /api/admin/meal-trains/{id}/days`
- `PATCH /api/admin/meal-days/{day_id}`
- `DELETE /api/admin/meal-days/{day_id}`

### Public intake

- `GET /api/public/intake/{token}`
- `POST /api/public/intake/{token}`

### Public signup

- `GET /api/public/trains/{public_token}`
- `POST /api/public/meal-days/{day_id}/signup`

### פנימי

- `POST /api/internal/reminders/dispatch`

ה-endpoint הפנימי ייקרא רק דרך cron עם secret.

## תזכורות

הגישה הפשוטה הנכונה:

1. שומרים לכל השתבצות מתי התזכורת צריכה לצאת.
2. cron רץ כמה פעמים ביום.
3. הוא מזמן endpoint פנימי.
4. ה-backend שולח את המיילים הדרושים.
5. ה-DB שומר היסטוריה של נשלח / נכשל.

אין צורך ב-MVP ב:

- Redis
- Celery
- RabbitMQ

## פריסה חינמית מומלצת

### ההרכב המומלץ

- Frontend: `Vercel Hobby`
- Backend: `Google Cloud Run`
- Database: `Neon Free`
- Email: `Resend Free`
- Scheduler: `GitHub Actions`

### למה זה מתאים

#### Vercel

- פשוט מאוד ל-React
- חיבור טוב ל-GitHub
- נוח ל-preview deployments

#### Cloud Run

- מתאים ל-FastAPI ב-Docker
- יש free tier
- לא צריך לנהל שרת

#### Neon

- Postgres מנוהל
- free tier מספיק ל-MVP קטן
- scale to zero

#### Resend

- API פשוט
- נוח מאוד למיילים טרנזקציוניים

#### GitHub Actions

- cron קל
- לא צריך עוד שירות רק בשביל reminder dispatch

## מה לא מומלץ ב-MVP

- לא לבנות את Google Sheets כמערכת הראשית
- לא להתחיל עם WhatsApp API
- לא להוסיף הרשמות משתמשים לכל המשתבצות
- לא להוסיף queue כבדה
- לא לבנות הרשאות מורכבות

## החלטות UX

### תאריכים בעברית ובאנגלית

נשמור תאריך אחד ב-DB ונציג אותו לפי locale:

- עברית: `יום שני, 14.04.2026`
- אנגלית: `Monday, 14.04.2026`

### מובייל קודם

כי רוב השימוש יהיה דרך הטלפון.

### מינימום חיכוך

- ליולדת אין login
- למשתבצת אין login
- רק למנהלת יש login

## שלבי מימוש מומלצים

### שלב 1

- backend בסיסי
- DB
- admin login
- יצירת מקרה חדש

### שלב 2

- טופס יולדת
- יצירת ימים
- שמירת תשובות

### שלב 3

- עמוד השתבצות ציבורי
- תפיסת יום
- חסימת כפילויות

### שלב 4

- מסך ניהול מלא
- עריכת ימים
- פרסום
- ביטול השתבצויות

### שלב 5

- תזכורות אוטומטיות
- לוג שליחה

### שלב 6

- Google Sheets export
- WhatsApp integration
- polishing

## המלצה סופית

ל-MVP כדאי לבנות מערכת עצמאית ופשוטה:

- source of truth ב-DB
- קישורים ציבוריים עם token
- admin אחד או מעט admins
- תזכורות במייל
- WhatsApp ידני לשיתוף

זה יהיה הרבה יותר יציב ונקי מאשר לנסות להפוך Google Sheet למוצר.

## מקורות תשתית שנבדקו

- Vercel pricing: https://vercel.com/pricing
- Google Cloud Run pricing: https://cloud.google.com/run/pricing
- Neon pricing: https://neon.com/pricing
- Resend pricing: https://resend.com/pricing
- GitHub Actions billing: https://docs.github.com/en/billing/concepts/product-billing/github-actions
