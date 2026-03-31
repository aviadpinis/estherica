# Estherica

מערכת קהילתית לניהול "פינוק ליולדת" עם:

- מסך מנהלת
- טופס יולדת אישי
- עמוד השתבצות ציבורי
- backend ב-FastAPI
- frontend ב-React + Vite

## הרצה מקומית

### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

ה-frontend ירוץ על `http://localhost:5173` וה-backend על `http://localhost:8000`.

## כניסת מנהלת ב-MVP

ברירת המחדל ב-`.env.example`:

- אימייל: `admin@estherica.local`
- סיסמה: `change-me`

כדאי לשנות לפני שימוש אמיתי.

## פריסה חינמית מומלצת

הדרך הכי פשוטה ויציבה לפרוס את המערכת בחינם:

- `frontend` כפרויקט Vercel אחד
- `backend` כפרויקט Vercel שני
- `Postgres` חינמי ב-Neon

### למה לא SQLite בפריסה?

בפיתוח מקומי המערכת עובדת עם SQLite, אבל בפריסה על Vercel צריך בסיס נתונים חיצוני ומתמשך.

### 1. יצירת בסיס נתונים חינמי ב-Neon

1. פותחים פרויקט חדש ב-Neon.
2. מעתיקים את ה-connection string.
3. משנים אותו לפורמט של SQLAlchemy:

```text
postgresql+psycopg://USER:PASSWORD@HOST/DBNAME?sslmode=require
```

### 2. פריסת ה-backend ב-Vercel

1. ב-Vercel לוחצים `Add New Project`.
2. בוחרים את הריפו הזה.
3. מגדירים `Root Directory` ל-`backend`.
4. Framework Preset: `Other`.
5. מוסיפים Environment Variables:

```text
DATABASE_URL=postgresql+psycopg://...
ADMIN_EMAIL=...
ADMIN_PASSWORD=...
JWT_SECRET=...
ENCRYPTION_KEY=...
ALLOWED_ORIGINS=https://YOUR-FRONTEND.vercel.app
```

ה-entrypoint כבר מוכן דרך `backend/server.py`.

### 3. פריסת ה-frontend ב-Vercel

1. יוצרים פרויקט נוסף מאותו ריפו.
2. מגדירים `Root Directory` ל-`frontend`.
3. Framework Preset: `Vite`.
4. מוסיפים Environment Variable:

```text
VITE_API_BASE_URL=https://YOUR-BACKEND.vercel.app
```

### 4. אחרי הפריסה

אם כתובת ה-frontend השתנתה, מעדכנים גם ב-backend:

```text
ALLOWED_ORIGINS=https://YOUR-FRONTEND.vercel.app
```

ואז עושים Redeploy ל-backend.
