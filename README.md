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
