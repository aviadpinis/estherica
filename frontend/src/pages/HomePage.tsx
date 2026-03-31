import { Link } from "react-router-dom"

import { BrandMark } from "../components/BrandMark"

const steps = [
  {
    title: "מנהלת פותחת מקרה חדש",
    body: "המערכת יוצרת קישור אישי ליולדת ורשימת ימים לשבועיים בלי שישי ושבת.",
  },
  {
    title: "היולדת ממלאת פעם אחת",
    body: "כתובת, טלפונים, כשרויות, דרישות מיוחדות וסימון באילו ימים צריך ארוחה.",
  },
  {
    title: "הקהילה משתבצת בקישור ציבורי",
    body: "אין רישום ואין login למשתבצות. הן פשוט בוחרות יום, משאירות פרטים וזהו.",
  },
]

export function HomePage() {
  return (
    <div className="landing">
      <section className="landing__hero">
        <BrandMark />
        <div className="landing__copy">
          <p className="eyebrow">פינוק ליולדת, בלי טבלאות ידניות</p>
          <h2>ניהול קל של יולדות, ימים, והשתבצויות בקהילה</h2>
          <p>
            ה-MVP בנוי סביב שלושה מסכים ברורים: מנהלת, טופס יולדת, והשתבצות
            ציבורית. אין login ליולדת ואין login למשתבצות.
          </p>
          <div className="landing__actions">
            <Link to="/admin/login" className="button button--primary">
              כניסת מנהלת
            </Link>
          </div>
        </div>
      </section>

      <section className="panel-grid">
        {steps.map((step, index) => (
          <article key={step.title} className="panel panel--step">
            <span className="step-index">0{index + 1}</span>
            <h3>{step.title}</h3>
            <p>{step.body}</p>
          </article>
        ))}
      </section>
    </div>
  )
}

