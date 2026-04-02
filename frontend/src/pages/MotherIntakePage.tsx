import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { Link, useParams } from "react-router-dom"
import { z } from "zod"

import { MealCalendar } from "../components/MealCalendar"
import { PageShell } from "../components/PageShell"
import { apiRequest, ApiError } from "../lib/api"
import { getBabyCopy } from "../lib/baby"
import type { MealDay, PublicIntakeData } from "../lib/types"

type IntakeTab = "details" | "calendar"

const intakeSchema = z.object({
  baby_type: z.enum(["boy", "girl"], {
    error: "צריך לבחור מה נולד",
  }),
  mother_name: z.string().optional(),
  address: z.string().min(2, "כתובת חובה"),
  household_size: z.string().optional(),
  children_ages: z.string().optional(),
  special_requirements: z.string().optional(),
  kashrut: z.string().optional(),
  contact_phone: z.string().min(7, "טלפון חובה"),
  home_phone: z.string().optional(),
  backup_phone: z.string().optional(),
  delivery_deadline: z.string().regex(/^\d{2}:\d{2}$/),
  general_notes: z.string().optional(),
  day_choices: z.array(
    z.object({
      day_id: z.number(),
      needed: z.boolean(),
    }),
  ),
})

type IntakeValues = z.infer<typeof intakeSchema>

export function MotherIntakePage() {
  const { token = "" } = useParams()
  const [showThankYou, setShowThankYou] = useState(false)
  const [submittedPublicToken, setSubmittedPublicToken] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<IntakeTab>("details")

  const intakeQuery = useQuery({
    queryKey: ["public-intake", token],
    queryFn: () => apiRequest<PublicIntakeData>(`/api/public/intake/${token}`),
    enabled: Boolean(token),
  })

  const {
    register,
    handleSubmit,
    reset,
    watch,
    getValues,
    setValue,
    formState: { errors },
  } = useForm<IntakeValues>({
    resolver: zodResolver(intakeSchema),
    defaultValues: {
      baby_type: undefined,
      mother_name: "",
      address: "",
      household_size: "",
      children_ages: "",
      special_requirements: "",
      kashrut: "",
      contact_phone: "",
      home_phone: "",
      backup_phone: "",
      delivery_deadline: "18:00",
      general_notes: "",
      day_choices: [],
    },
  })

  useEffect(() => {
    if (!intakeQuery.data) {
      return
    }

    reset({
      baby_type: intakeQuery.data.baby_type ?? undefined,
      mother_name: intakeQuery.data.mother_name ?? "",
      address: "",
      household_size: "",
      children_ages: "",
      special_requirements: "",
      kashrut: "",
      contact_phone: "",
      home_phone: "",
      backup_phone: "",
      delivery_deadline: intakeQuery.data.default_delivery_time,
      general_notes: "",
      day_choices: intakeQuery.data.days.map((day) => ({
        day_id: day.id,
        needed: day.status !== "not_needed",
      })),
    })
  }, [intakeQuery.data, reset])

  const submitMutation = useMutation({
    mutationFn: (values: IntakeValues) =>
      apiRequest<PublicIntakeData>(`/api/public/intake/${token}`, {
        method: "POST",
        body: JSON.stringify(values),
      }),
    onSuccess: (response) => {
      setSubmittedPublicToken(response.public_token)
      setShowThankYou(true)
    },
  })

  const babyType = watch("baby_type")
  const babyCopy = getBabyCopy(babyType)
  const dayChoices = watch("day_choices") ?? []
  const selectionMap = Object.fromEntries(dayChoices.map((choice) => [choice.day_id, choice.needed]))

  function toggleNeeded(day: MealDay) {
    const nextChoices = getValues("day_choices").map((choice) =>
      choice.day_id === day.id ? { ...choice, needed: !choice.needed } : choice,
    )
    setValue("day_choices", nextChoices, { shouldDirty: true, shouldValidate: true })
  }

  return (
    <PageShell
      title="טופס יולדת"
      subtitle="מלאי את הפרטים, סמני באילו ימים צריך ארוחה, ואנחנו נעביר את הלוח למבשלות."
      tone={babyType}
    >
      <section className="panel panel--form">
        {intakeQuery.isLoading ? <p className="muted">טוען את הטופס...</p> : null}
        {intakeQuery.error ? (
          <p className="feedback feedback--error">
            {(intakeQuery.error as ApiError).message}
          </p>
        ) : null}

        {showThankYou ? (
          <section className="thank-you-card">
            <p className="eyebrow">הטופס נקלט בהצלחה</p>
            <h3>תודה רבה, הלוח פתוח למבשלות</h3>
            <p>
              קיבלנו את כל הפרטים שלך, והלוח נפתח אוטומטית לשיתוף ולהשתבצות.
            </p>
            <div className="form-actions form-actions--split">
              {submittedPublicToken ? (
                <Link className="button button--primary" to={`/t/${submittedPublicToken}`}>
                  מעבר ללוח ההשתבצות
                </Link>
              ) : null}
              <button
                className="button button--ghost"
                type="button"
                onClick={() => setShowThankYou(false)}
              >
                חזרה לטופס
              </button>
            </div>
          </section>
        ) : null}

        {intakeQuery.data && !showThankYou ? (
          <form className="form-grid" onSubmit={handleSubmit((values) => submitMutation.mutate(values))}>
            <section className="section-tabs section-tabs--two" aria-label="ניווט טופס יולדת">
              <button
                className={`section-tabs__button ${activeTab === "details" ? "section-tabs__button--active" : ""}`}
                type="button"
                onClick={() => setActiveTab("details")}
              >
                פרטים
              </button>
              <button
                className={`section-tabs__button ${activeTab === "calendar" ? "section-tabs__button--active" : ""}`}
                type="button"
                onClick={() => setActiveTab("calendar")}
              >
                לוח הימים
              </button>
            </section>

            {activeTab === "details" ? (
              <>
                <fieldset className="baby-type-picker">
                  <legend>מה נולד?</legend>
                  <div className="baby-type-picker__options baby-type-picker__options--compact">
                    <label className={`baby-type-option ${babyType === "boy" ? "baby-type-option--selected" : ""}`}>
                      <input type="radio" value="boy" {...register("baby_type")} />
                      <span>בן</span>
                    </label>
                    <label className={`baby-type-option ${babyType === "girl" ? "baby-type-option--selected" : ""}`}>
                      <input type="radio" value="girl" {...register("baby_type")} />
                      <span>בת</span>
                    </label>
                  </div>
                  {errors.baby_type ? <small>{errors.baby_type.message}</small> : null}
                </fieldset>

                <label className="field">
                  <span>שם היולדת</span>
                  <input {...register("mother_name")} />
                </label>
                <label className="field field--full">
                  <span>כתובת</span>
                  <input {...register("address")} />
                  {errors.address ? <small>{errors.address.message}</small> : null}
                </label>
                <div className="field-row field-row--keep">
                  <label className="field">
                    <span>נפשות</span>
                    <input {...register("household_size")} />
                  </label>
                  <label className="field">
                    <span>גילאי הילדים</span>
                    <input {...register("children_ages")} />
                  </label>
                </div>
                <div className="field-row field-row--keep">
                  <label className="field">
                    <span>כשרויות</span>
                    <input {...register("kashrut")} />
                  </label>
                  <label className="field">
                    <span>פלאפון של היולדת</span>
                    <input {...register("contact_phone")} />
                    {errors.contact_phone ? <small>{errors.contact_phone.message}</small> : null}
                  </label>
                </div>
                <div className="field-row field-row--keep">
                  <label className="field">
                    <span>טלפון בבית</span>
                    <input {...register("home_phone")} />
                  </label>
                  <label className="field">
                    <span>טלפון נוסף - לא חובה</span>
                    <input {...register("backup_phone")} />
                  </label>
                </div>
                <div className="field-row field-row--keep">
                  <label className="field">
                    <span>עד איזו שעה להביא ארוחה</span>
                    <input type="time" {...register("delivery_deadline")} />
                  </label>
                  <div className="field field--spacer" aria-hidden="true" />
                </div>
                <label className="field field--full">
                  <span>דרישות מיוחדות</span>
                  <textarea rows={3} {...register("special_requirements")} />
                </label>
                <label className="field field--full">
                  <span>הערות כלליות</span>
                  <textarea rows={3} {...register("general_notes")} />
                </label>

                <div className="form-actions form-actions--split">
                  <button className="button button--ghost" type="button" onClick={() => setActiveTab("calendar")}>
                    מעבר ללוח הימים
                  </button>
                </div>
              </>
            ) : null}

            {activeTab === "calendar" ? (
              <>
                <section className="calendar-section">
                  <div className="section-heading">
                    <div>
                      <h4>לוח הארוחות</h4>
                      <p>
                        {babyCopy.blessing}. לחצי על יום כדי לבטל או להחזיר אותו.
                      </p>
                    </div>
                  </div>

                  <MealCalendar
                    startDate={intakeQuery.data.start_date}
                    days={intakeQuery.data.days}
                    babyType={babyType}
                    mode="intake"
                    selectionMap={selectionMap}
                    onToggleNeeded={toggleNeeded}
                  />
                </section>

                {submitMutation.error ? (
                  <p className="feedback feedback--error">
                    {(submitMutation.error as ApiError).message}
                  </p>
                ) : null}

                <div className="form-actions form-actions--split">
                  <button className="button button--ghost" type="button" onClick={() => setActiveTab("details")}>
                    חזרה לפרטים
                  </button>
                  <button className="button button--primary" type="submit" disabled={submitMutation.isPending}>
                    {submitMutation.isPending ? "שומר..." : "שליחת השאלון"}
                  </button>
                </div>
              </>
            ) : null}
          </form>
        ) : null}
      </section>
    </PageShell>
  )
}
