import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { Link } from "react-router-dom"

import { BrandMark } from "../components/BrandMark"
import { apiRequest, ApiError } from "../lib/api"
import { getBabyCopy, getBabyTone } from "../lib/baby"
import { formatDatePair } from "../lib/date"
import type { PublicLobbyTrain, PublicVolunteerSignup } from "../lib/types"
import { readVolunteerProfile } from "../lib/volunteerProfile"

export function PublicLobbyPage() {
  const [volunteerProfile] = useState(() => readVolunteerProfile())
  const lobbyQuery = useQuery({
    queryKey: ["public-lobby"],
    queryFn: () => apiRequest<PublicLobbyTrain[]>("/api/public/lobby"),
  })
  const volunteerSignupsQuery = useQuery({
    queryKey: ["public-volunteer-signups", volunteerProfile.volunteerKey, volunteerProfile.phone],
    queryFn: () =>
      apiRequest<PublicVolunteerSignup[]>("/api/public/volunteer-signups", {
        method: "POST",
        body: JSON.stringify({
          volunteer_key: volunteerProfile.volunteerKey,
          phone: volunteerProfile.phone || null,
        }),
      }),
    enabled: Boolean(volunteerProfile.volunteerKey || volunteerProfile.phone),
  })
  const trains = lobbyQuery.data ?? []
  const volunteerSignups = volunteerSignupsQuery.data ?? []

  return (
    <div className="page-shell public-lobby">
      <header className="topbar public-topbar">
        <div className="toolbar-actions">
          <Link to="/birth-notice" className="button button--primary">
            ילדתי
          </Link>
          <Link to="/admin/login" className="button button--ghost">
            כניסה
          </Link>
        </div>
        <Link to="/" className="topbar__brand">
          <BrandMark compact />
        </Link>
      </header>

      <main className="page-shell__body">
        {lobbyQuery.error ? (
          <p className="feedback feedback--error">
            {(lobbyQuery.error as ApiError).message}
          </p>
        ) : null}
        {volunteerSignupsQuery.error ? (
          <p className="feedback feedback--error">
            {(volunteerSignupsQuery.error as ApiError).message}
          </p>
        ) : null}

        {volunteerSignupsQuery.isLoading ? <p className="muted">טוען את הפינוקים שלי...</p> : null}

        {volunteerSignups.length ? (
          <section className="panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">הפינוקים שלי</p>
                <h3>היולדות שהשתבצתי אליהן</h3>
              </div>
              <p className="muted">{volunteerSignups.length} פינוק{volunteerSignups.length > 1 ? "ים" : ""} קרובים</p>
            </div>

            <div className="lobby-carousel">
              <div className="lobby-carousel__track">
                {volunteerSignups.map((signup) => (
                  <article
                    key={`${signup.public_token}-${signup.date}-${signup.delivery_deadline}`}
                    className={`lobby-card lobby-card--${getBabyTone(signup.baby_type, signup.is_twins)} lobby-card--assignment`}
                  >
                    <div className="lobby-card__header">
                      <p className="eyebrow">מפנקות את {signup.family_title}</p>
                      <span className="status status--completed">את רשומה</span>
                    </div>

                    <div className="lobby-card__body">
                      <h3>{formatDatePair(signup.date).hebrew}</h3>
                      <p className="muted">להביא עד {signup.delivery_deadline}</p>
                      <p className="muted">{signup.address || "הכתובת תופיע בתוך הלוח"}</p>
                    </div>

                    <Link className="button button--ghost" to={`/t/${signup.public_token}`}>
                      לצפייה בפרטים
                    </Link>
                  </article>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        <section className="panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">יולדות</p>
              <h3>בא לך להשתבץ לפינוק?</h3>
            </div>
            <p className="muted">לא נדרש להתחבר בשביל להשתבץ.</p>
          </div>

          {lobbyQuery.isLoading ? <p className="muted">טוען...</p> : null}

          {trains.length ? (
            <div className="lobby-carousel">
              <div className="lobby-carousel__track">
                {trains.map((train) => {
                  const babyCopy = getBabyCopy(train.baby_type, train.is_twins)
                  const nextOpenLabel = train.next_open_date ? formatDatePair(train.next_open_date).short : null
                  const endLabel = train.end_date ? formatDatePair(train.end_date).short : null
                  const isOpen = train.open_days > 0

                  return (
                    <article
                      key={train.public_token}
                      className={`lobby-card lobby-card--${getBabyTone(train.baby_type, train.is_twins)}`}
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
                            מלא כרגע
                            {endLabel ? ` · עד ${endLabel}` : ""}.
                          </p>
                        )}
                        <p className="muted">{formatDatePair(train.start_date).short}</p>
                      </div>

                      <Link className="button button--ghost" to={`/t/${train.public_token}`}>
                        {isOpen ? "להשתבץ" : "לצפייה בלוח"}
                      </Link>
                    </article>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="empty-state">
              <h3>כרגע אין יולדות פעילות בלובי</h3>
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
