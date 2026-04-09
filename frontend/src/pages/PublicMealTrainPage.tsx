import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { Link, useParams } from "react-router-dom"
import { z } from "zod"

import { BrandMark } from "../components/BrandMark"
import { MealCalendar } from "../components/MealCalendar"
import { PageShell } from "../components/PageShell"
import { apiRequest, ApiError } from "../lib/api"
import { getBabyCopy, getBabyTone } from "../lib/baby"
import { buildGoogleCalendarUrl, downloadCalendarReminder } from "../lib/calendarReminder"
import { formatDatePair, getLocalTodayIso } from "../lib/date"
import type { BabyTone, MealDay, PublicMealTrainData, Signup } from "../lib/types"
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
  const selectedDayLabels = selectedDay ? formatDatePair(selectedDay.date) : null
  const ownSignups =
    trainQuery.data?.days.filter((day) =>
      signupBelongsToVolunteer(day, volunteerProfile.volunteerKey, volunteerProfile.phone) &&
      day.date >= getLocalTodayIso(),
    ) ?? []
  const babyCopy = getBabyCopy(trainQuery.data?.baby_type, trainQuery.data?.is_twins)
  const displayTone: BabyTone | null =
    trainQuery.data?.is_twins && !trainQuery.data?.baby_type ? "mixed" : trainQuery.data?.baby_type ?? null
  const pageTitle = trainQuery.data ? `מפנקות את ${trainQuery.data.family_title}` : "השתבצות לארוחות"
  const pageSubtitle = `מזל טוב ${babyCopy.blessing}`
  const hasOpenDays =
    trainQuery.data?.days.some((day) => day.status === "open" && day.date >= getLocalTodayIso()) ?? false
  const calendarUrl =
    trainQuery.data && completedSignup
      ? buildGoogleCalendarUrl({
          familyTitle: trainQuery.data.family_title,
          babyType: trainQuery.data.baby_type,
          isTwins: trainQuery.data.is_twins,
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
      tone={displayTone}
      hideIntro
      hideBrandInTopbar
    >
      <section className="public-train-page">
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
            <section className={`public-train-hero public-train-hero--${getBabyTone(trainQuery.data.baby_type, trainQuery.data.is_twins)}`}>
              <div className="public-train-hero__headline">
                <div className="public-train-hero__copy">
                  <h1>{pageTitle}</h1>
                  <p>{pageSubtitle}</p>
                </div>
                <Link to="/" className="public-train-hero__brand" aria-label="חזרה ללובי">
                  <BrandMark compact />
                </Link>
              </div>

              <div className="public-train-hero__details">
                <p>
                  <strong>כתובת:</strong> {trainQuery.data.address || "תעודכן במידת הצורך"}
                </p>
                <p>
                  <strong>כשרות:</strong> {trainQuery.data.kashrut || "לא צוינה"}
                </p>
                <p>
                  <strong>נפשות:</strong> {trainQuery.data.household_size || "לא צוין"},{" "}
                  <strong>גילאי הילדים:</strong> {trainQuery.data.children_ages || "לא צוינו"}
                </p>
                <p>
                  <strong>שעת הבאה רצויה:</strong> {trainQuery.data.default_delivery_time}
                </p>
                <p>
                  <strong>פלאפון ליצירת קשר:</strong> {trainQuery.data.contact_phone || "יעודכן בהמשך"}
                </p>
                {trainQuery.data.special_requirements ? (
                  <p>
                    <strong>דרישות מיוחדות:</strong> {trainQuery.data.special_requirements}
                  </p>
                ) : null}
              </div>
            </section>

            <section className="public-calendar-block">
              <p className="calendar-panel__title">
                {hasOpenDays ? "לחצי על יום פנוי כדי להשתבץ" : "כרגע אין ימים פנויים בלוח"}
              </p>
              <MealCalendar
                startDate={trainQuery.data.start_date}
                days={trainQuery.data.days}
                babyType={displayTone}
                mode="public"
                selectedDayId={selectedDayId}
                ownedDayIds={ownSignups.map((day) => day.id)}
                onSelectDay={(day) => {
                  if (day.status === "open") {
                    setSelectedDayId(day.id)
                    setSuccessMessage(null)
                    setCompletedSignup(null)
                  }
                }}
              />

              {ownSignups.length ? (
                <div className="calendar-panel__actions">
                  {ownSignups.map((day) => (
                    <button
                      key={day.id}
                      className="button button--ghost"
                      type="button"
                      disabled={cancelMutation.isPending}
                      onClick={() => cancelMutation.mutate(day.id)}
                    >
                      ביטול הרשמה ל־{formatDatePair(day.date).short}
                    </button>
                  ))}
                </div>
              ) : null}
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
                        isTwins: trainQuery.data.is_twins,
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
          </>
        ) : null}
      </section>

      {selectedDay ? (
        <div className="dialog-backdrop" onClick={() => setSelectedDayId(null)}>
          <section
            className="dialog-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="public-signup-dialog-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="dialog-card__header">
              <div>
                <p className="eyebrow">השתבצות חדשה</p>
                <h4 id="public-signup-dialog-title">{selectedDayLabels?.hebrew}</h4>
                <p className="muted">
                  {selectedDayLabels?.english} · הבאת ארוחה עד {selectedDay.delivery_deadline}
                </p>
              </div>
              <button className="button button--ghost" type="button" onClick={() => setSelectedDayId(null)}>
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

              <div className="dialog-card__actions">
                <button className="button button--primary" type="submit" disabled={signupMutation.isPending}>
                  {signupMutation.isPending ? "שומר..." : "אישור השתבצות"}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}

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
                  className={`related-train-card related-train-card--${getBabyTone(relatedTrain.baby_type, relatedTrain.is_twins)}`}
                >
                <div className="related-train-card__content">
                  <p className="eyebrow">מפנקות את {relatedTrain.family_title}</p>
                  <h4>מזל טוב {getBabyCopy(relatedTrain.baby_type, relatedTrain.is_twins).blessing}</h4>
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
