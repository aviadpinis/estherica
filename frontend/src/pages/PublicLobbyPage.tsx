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
  const trains = lobbyQuery.data ?? []
  const carouselTrains = trains.length > 1 ? [...trains, ...trains] : trains

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
        {lobbyQuery.error ? (
          <p className="feedback feedback--error">
            {(lobbyQuery.error as ApiError).message}
          </p>
        ) : null}

        <section className="panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">יולדות</p>
              <h3>להשתבץ לפינוק</h3>
            </div>
          </div>

          {lobbyQuery.isLoading ? <p className="muted">טוען את הלוחות...</p> : null}

          {trains.length ? (
            <div className="lobby-carousel">
              <div className="lobby-carousel__track">
                {carouselTrains.map((train, index) => {
                const babyCopy = getBabyCopy(train.baby_type)
                const nextOpenLabel = train.next_open_date ? formatDatePair(train.next_open_date).short : null
                const endLabel = train.end_date ? formatDatePair(train.end_date).short : null
                const isOpen = train.open_days > 0

                return (
                  <article
                    key={`${train.public_token}-${index}`}
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
