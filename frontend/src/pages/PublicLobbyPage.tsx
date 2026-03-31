import { useQuery } from "@tanstack/react-query"
import { Link } from "react-router-dom"

import { BrandMark } from "../components/BrandMark"
import { apiRequest, ApiError } from "../lib/api"
import { getBabyCopy } from "../lib/baby"
import { formatDatePair } from "../lib/date"
import type { PublicLobbyTrain } from "../lib/types"

export function PublicLobbyPage() {
  const lobbyQuery = useQuery({
    queryKey: ["public-lobby"],
    queryFn: () => apiRequest<PublicLobbyTrain[]>("/api/public/lobby"),
  })

  return (
    <div className="page-shell public-lobby">
      <header className="topbar public-topbar">
        <div className="toolbar-actions">
          <Link to="/birth-notice" className="button button--primary">
            ילדתי
          </Link>
          <Link to="/admin/login" className="button button--ghost">
            כניסת מנהלת
          </Link>
        </div>
        <Link to="/" className="topbar__brand">
          <BrandMark compact />
        </Link>
      </header>

      <main className="page-shell__body">
        <section className="hero-card">
          <p className="eyebrow">לובי הקהילה</p>
          <h2>כאן רואים מי צריכה פינוק עכשיו</h2>
          <p>
            יולדות חדשות שמחכות להשתבצות, וגם יולדות שכבר התמלאו אבל הפרויקט שלהן
            עדיין פעיל בשבועיים הקרובים.
          </p>
        </section>

        {lobbyQuery.error ? (
          <p className="feedback feedback--error">
            {(lobbyQuery.error as ApiError).message}
          </p>
        ) : null}

        <section className="panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">יולדות פעילות</p>
              <h3>לוחות פתוחים ופרויקטים פעילים</h3>
            </div>
            <p className="muted">הכרטיסים עם ימים פנויים מופיעים ראשונים.</p>
          </div>

          {lobbyQuery.isLoading ? <p className="muted">טוען את הלוחות...</p> : null}

          {lobbyQuery.data?.length ? (
            <div className="lobby-grid">
              {lobbyQuery.data.map((train) => {
                const babyCopy = getBabyCopy(train.baby_type)
                const nextOpenLabel = train.next_open_date ? formatDatePair(train.next_open_date).short : null
                const endLabel = train.end_date ? formatDatePair(train.end_date).short : null
                const isOpen = train.open_days > 0

                return (
                  <article
                    key={train.public_token}
                    className={`lobby-card lobby-card--${train.baby_type ?? "neutral"}`}
                  >
                    <div className="lobby-card__header">
                      <p className="eyebrow">מפנקות את {train.family_title}</p>
                      <span className={`status ${isOpen ? "status--open" : "status--completed"}`}>
                        {isOpen ? "פתוח להרשמה" : "פעיל ומלא"}
                      </span>
                    </div>

                    <div className="lobby-card__body">
                      <h3>מזל טוב {babyCopy.blessing}</h3>
                      {isOpen ? (
                        <p className="muted">
                          {train.open_days} ימים פנויים
                          {nextOpenLabel ? ` · הקרוב ביותר ${nextOpenLabel}` : ""}
                        </p>
                      ) : (
                        <p className="muted">
                          כל הימים נתפסו, אבל ממשיכים לפנק
                          {endLabel ? ` עד ${endLabel}` : ""}.
                        </p>
                      )}
                      <p className="muted">
                        התחלה: {formatDatePair(train.start_date).short}
                        {endLabel ? ` · סיום: ${endLabel}` : ""}
                      </p>
                    </div>

                    <Link className="button button--ghost" to={`/t/${train.public_token}`}>
                      {isOpen ? "להשתבץ" : "לצפייה בלוח"}
                    </Link>
                  </article>
                )
              })}
            </div>
          ) : (
            <div className="empty-state">
              <h3>כרגע אין יולדות פעילות בלובי</h3>
              <p className="muted">
                אם ילדת, אפשר לפתוח כאן בעצמך את טופס היולדת ולעדכן את המנהלות.
              </p>
              <Link to="/birth-notice" className="button button--primary">
                ילדתי
              </Link>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
