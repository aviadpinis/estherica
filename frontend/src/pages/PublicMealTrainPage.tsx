import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { Link, useParams } from "react-router-dom"
import { z } from "zod"

import { MealCalendar } from "../components/MealCalendar"
import { PageShell } from "../components/PageShell"
import { apiRequest, ApiError } from "../lib/api"
import { getBabyCopy } from "../lib/baby"
import { buildGoogleCalendarUrl, downloadCalendarReminder } from "../lib/calendarReminder"
import { formatDatePair, getLocalTodayIso } from "../lib/date"
import type { MealDay, PublicMealTrainData, Signup } from "../lib/types"
import { readVolunteerProfile, saveVolunteerProfile } from "../lib/volunteerProfile"

const signupSchema = z.object({
  volunteer_name: z.string().min(2, "צריך שם"),
  phone: z.string().min(7, "צריך טלפון"),
  meal_type: z.string().optional(),
  note: z.string().optional(),
})

type SignupValues = z.infer<typeof signupSchema>

interface CompletedSignup {
  dayDate: string
  deliveryDeadline: string
  volunteerName: string
  mealType?: string
  note?: string
}

function signupBelongsToVolunteer(day: MealDay, volunteerKey: string, phone: string) {
  if (!day.signup) {
    return false
  }

  if (day.signup.volunteer_key && day.signup.volunteer_key === volunteerKey) {
    return true
  }

  return Boolean(phone && day.signup.phone === phone)
}

export function PublicMealTrainPage() {
  const { publicToken = "" } = useParams()
  return <PublicMealTrainContent key={publicToken} publicToken={publicToken} />
}

function PublicMealTrainContent({ publicToken }: { publicToken: string }) {
  const queryClient = useQueryClient()
  const [selectedDayId, setSelectedDayId] = useState<number | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [completedSignup, setCompletedSignup] = useState<CompletedSignup | null>(null)
  const [volunteerProfile] = useState(() => readVolunteerProfile())

  const trainQuery = useQuery({
    queryKey: ["public-train", publicToken],
    queryFn: () => apiRequest<PublicMealTrainData>(`/api/public/trains/${publicToken}`),
    enabled: Boolean(publicToken),
  })

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      volunteer_name: volunteerProfile.volunteerName,
      phone: volunteerProfile.phone,
      meal_type: "",
      note: "",
    },
  })

  const signupMutation = useMutation({
    mutationFn: (values: SignupValues) =>
      apiRequest<Signup>(
        `/api/public/meal-days/${selectedDayId}/signup`,
        {
          method: "POST",
          body: JSON.stringify({
            ...values,
            volunteer_key: volunteerProfile.volunteerKey,
          }),
        },
      ),
    onSuccess: (_signup, values) => {
      const chosenDay = trainQuery.data?.days.find((day) => day.id === selectedDayId)
      if (chosenDay) {
        setCompletedSignup({
          dayDate: chosenDay.date,
          deliveryDeadline: chosenDay.delivery_deadline,
          volunteerName: values.volunteer_name,
          mealType: values.meal_type,
          note: values.note,
        })
      }
      saveVolunteerProfile({
        volunteerKey: volunteerProfile.volunteerKey,
        volunteerName: values.volunteer_name,
        phone: values.phone,
      })
      reset({
        volunteer_name: values.volunteer_name,
        phone: values.phone,
        meal_type: "",
        note: "",
      })
      setSuccessMessage("ההשתבצות נשמרה בהצלחה.")
      setSelectedDayId(null)
      queryClient.invalidateQueries({ queryKey: ["public-train", publicToken] })
    },
  })

  const cancelMutation = useMutation({
    mutationFn: (dayId: number) =>
      apiRequest<MealDay>(`/api/public/meal-days/${dayId}/cancel`, {
        method: "POST",
        body: JSON.stringify({
          volunteer_key: volunteerProfile.volunteerKey,
          phone: volunteerProfile.phone,
        }),
      }),
    onSuccess: (_, dayId) => {
      setSuccessMessage("ההרשמה בוטלה והיום חזר להיות פנוי.")
      if (completedSignup && trainQuery.data?.days.find((day) => day.id === dayId)?.date === completedSignup.dayDate) {
        setCompletedSignup(null)
      }
      setSelectedDayId(null)
      queryClient.invalidateQueries({ queryKey: ["public-train", publicToken] })
    },
  })

  const selectedDay = trainQuery.data?.days.find((day) => day.id === selectedDayId) ?? null
  const ownSignups =
    trainQuery.data?.days.filter((day) =>
      signupBelongsToVolunteer(day, volunteerProfile.volunteerKey, volunteerProfile.phone),
    ) ?? []
  const babyCopy = getBabyCopy(trainQuery.data?.baby_type)
  const pageTitle = trainQuery.data ? `מפנקות את ${trainQuery.data.family_title}` : "השתבצות לארוחות"
  const pageSubtitle = `מזל טוב ${babyCopy.blessing}`
  const hasOpenDays =
    trainQuery.data?.days.some((day) => day.status === "open" && day.date >= getLocalTodayIso()) ?? false
  const calendarUrl =
    trainQuery.data && completedSignup
      ? buildGoogleCalendarUrl({
          familyTitle: trainQuery.data.family_title,
          babyType: trainQuery.data.baby_type,
          date: completedSignup.dayDate,
          reminderTime: trainQuery.data.reminder_time,
          deliveryDeadline: completedSignup.deliveryDeadline,
          address: trainQuery.data.address,
          contactPhone: trainQuery.data.contact_phone,
          kashrut: trainQuery.data.kashrut,
          specialRequirements: trainQuery.data.special_requirements,
          volunteerName: completedSignup.volunteerName,
          mealType: completedSignup.mealType,
          note: completedSignup.note,
        })
      : null

  return (
    <PageShell
      title={pageTitle}
      subtitle={pageSubtitle}
      tone={trainQuery.data?.baby_type ?? null}
    >
      <section className="panel panel--form">
        {trainQuery.isLoading ? <p className="muted">טוען את הלוח...</p> : null}
        {trainQuery.error ? (
          <p className="feedback feedback--error">
            {(trainQuery.error as ApiError).message}
          </p>
        ) : null}
        {successMessage ? (
          <p className="feedback feedback--success">{successMessage}</p>
        ) : null}

        {trainQuery.data ? (
          <>
            <div className="community-header">
              <div>
                <p className="eyebrow">{pageTitle}</p>
                <h3>{pageSubtitle}</h3>
                <p className="muted">{trainQuery.data.address || "כתובת תעודכן במידת הצורך"}</p>
              </div>
              <div className="detail-stack">
                <p>
                  <strong>כשרות:</strong> {trainQuery.data.kashrut || "לא צוינה"}
                </p>
                <p>
                  <strong>שעת הבאה רצויה:</strong> {trainQuery.data.default_delivery_time}
                </p>
                <p>
                  <strong>טלפון קשר:</strong> {trainQuery.data.contact_phone || "יעודכן בהמשך"}
                </p>
              </div>
            </div>

            {trainQuery.data.special_requirements ? (
              <div className="notice-card">
                <strong>דרישות מיוחדות</strong>
                <p>{trainQuery.data.special_requirements}</p>
              </div>
            ) : null}

            {ownSignups.length ? (
              <section className="panel panel--nested">
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">ההשתבצויות שלי</p>
                    <h4>את כבר רשומה לימים הבאים</h4>
                  </div>
                </div>

                <div className="registration-list">
                  {ownSignups.map((day) => (
                    <article key={day.id} className="registration-card">
                      <div>
                        <strong>{formatDatePair(day.date).hebrew}</strong>
                        <p className="muted">הבאת ארוחה עד {day.delivery_deadline}</p>
                      </div>
                      <button
                        className="button button--ghost"
                        type="button"
                        disabled={cancelMutation.isPending}
                        onClick={() => cancelMutation.mutate(day.id)}
                      >
                        {cancelMutation.isPending ? "מבטלת..." : "ביטול הרשמה"}
                      </button>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}

            <section className="calendar-section">
              <MealCalendar
                startDate={trainQuery.data.start_date}
                days={trainQuery.data.days}
                babyType={trainQuery.data.baby_type}
                mode="public"
                selectedDayId={selectedDayId}
                onSelectDay={(day) => {
                  if (day.status === "open") {
                    setSelectedDayId(day.id)
                    setSuccessMessage(null)
                    setCompletedSignup(null)
                  }
                }}
              />
            </section>

            {completedSignup ? (
              <section className="reminder-card">
                <div>
                  <p className="eyebrow">תזכורת אישית</p>
                  <h4>רוצה שנשמור לך את זה גם ביומן?</h4>
                  <p className="muted">
                    אפשר להוסיף עכשיו תזכורת ליום {formatDatePair(completedSignup.dayDate).hebrew} כדי לא
                    לשכוח להכין את הארוחה בזמן.
                  </p>
                </div>
                <div className="reminder-card__actions">
                  <button
                    className="button button--primary"
                    type="button"
                    onClick={() => {
                      if (!trainQuery.data) {
                        return
                      }

                      downloadCalendarReminder({
                        familyTitle: trainQuery.data.family_title,
                        babyType: trainQuery.data.baby_type,
                        date: completedSignup.dayDate,
                        reminderTime: trainQuery.data.reminder_time,
                        deliveryDeadline: completedSignup.deliveryDeadline,
                        address: trainQuery.data.address,
                        contactPhone: trainQuery.data.contact_phone,
                        kashrut: trainQuery.data.kashrut,
                        specialRequirements: trainQuery.data.special_requirements,
                        volunteerName: completedSignup.volunteerName,
                        mealType: completedSignup.mealType,
                        note: completedSignup.note,
                      })
                    }}
                  >
                    הוסיפי ליומן
                  </button>
                  {calendarUrl ? (
                    <a className="button button--ghost" href={calendarUrl} target="_blank" rel="noreferrer">
                      פתיחה ב-Google Calendar
                    </a>
                  ) : null}
                </div>
              </section>
            ) : null}

            {selectedDay ? (
              <section className="panel panel--nested">
                <div className="section-heading">
                  <div>
                    <h4>השתבצות ליום הנבחר</h4>
                    <p>
                      {formatDatePair(selectedDay.date).hebrew} · הבאת ארוחה עד {selectedDay.delivery_deadline}
                    </p>
                  </div>
                  <button
                    className="button button--ghost"
                    type="button"
                    onClick={() => setSelectedDayId(null)}
                  >
                    סגירה
                  </button>
                </div>

                <form className="form-grid" onSubmit={handleSubmit((values) => signupMutation.mutate(values))}>
                  <div className="field-row">
                    <label className="field">
                      <span>שם מלא</span>
                      <input {...register("volunteer_name")} />
                      {errors.volunteer_name ? <small>{errors.volunteer_name.message}</small> : null}
                    </label>
                    <label className="field">
                      <span>טלפון</span>
                      <input {...register("phone")} />
                    {errors.phone ? <small>{errors.phone.message}</small> : null}
                  </label>
                </div>
                  <div className="field-row">
                    <label className="field">
                      <span>חלבי / בשרי</span>
                      <input {...register("meal_type")} placeholder="אופציונלי" />
                    </label>
                    <label className="field">
                      <span>הערה</span>
                      <input {...register("note")} placeholder="אופציונלי" />
                    </label>
                  </div>

                  {signupMutation.error ? (
                    <p className="feedback feedback--error">
                      {(signupMutation.error as ApiError).message}
                    </p>
                  ) : null}

                  <button className="button button--primary" type="submit" disabled={signupMutation.isPending}>
                    {signupMutation.isPending ? "שומר..." : "אישור השתבצות"}
                  </button>
                </form>
              </section>
            ) : null}
          </>
        ) : null}
      </section>

      {!hasOpenDays && trainQuery.data?.related_trains.length ? (
        <section className="panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">עוד נשים שצריכות פינוק</p>
              <h3>אם כבר נכנסת, אולי תוכלי לעזור גם בעוד מקום</h3>
            </div>
            <p className="muted">מוצגות כאן רק טבלאות פעילות עם ימים פנויים.</p>
          </div>

          <div className="related-trains-grid">
            {trainQuery.data.related_trains.map((relatedTrain) => (
              <article
                key={relatedTrain.public_token}
                className={`related-train-card related-train-card--${relatedTrain.baby_type ?? "neutral"}`}
              >
                <div className="related-train-card__content">
                  <p className="eyebrow">מפנקות את {relatedTrain.family_title}</p>
                  <h4>מזל טוב {getBabyCopy(relatedTrain.baby_type).blessing}</h4>
                  <p className="muted">
                    {relatedTrain.open_days} ימים פנויים
                    {relatedTrain.next_open_date
                      ? ` · הקרוב ביותר: ${formatDatePair(relatedTrain.next_open_date).short}`
                      : ""}
                  </p>
                </div>
                <Link className="button button--ghost" to={`/t/${relatedTrain.public_token}`}>
                  פתיחת הטבלה
                </Link>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </PageShell>
  )
}
