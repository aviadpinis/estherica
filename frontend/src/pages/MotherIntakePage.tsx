import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { Link, useParams } from "react-router-dom"
import { z } from "zod"

import { MealCalendar } from "../components/MealCalendar"
import { PageShell } from "../components/PageShell"
import { apiRequest, ApiError } from "../lib/api"
import { getBabyCopy, getBirthChoice, getTwinsChoice, resolveBirthSelection, type BirthChoice, type TwinsChoice } from "../lib/baby"
import { getLocalTodayIso } from "../lib/date"
import {
  clampScheduleStartDate,
  getDefaultScheduleStartDate,
  getEarliestScheduleStartDate,
  getLatestScheduleStartDate,
  getScheduleWindowError,
  isWeekendScheduleDate,
} from "../lib/scheduleWindow"
import type { BabyTone, MealDay, PublicIntakeData } from "../lib/types"

type IntakeTab = "details" | "calendar"
const TWO_WEEKS_DAYS = 14
const THREE_WEEKS_DAYS = 21

const intakeSchema = z.object({
  baby_type: z.enum(["boy", "girl"]).optional(),
  is_twins: z.boolean(),
  mother_name: z.string().optional(),
  birth_date: z.string().min(1, "צריך תאריך לידה"),
  start_date: z.string().min(1, "צריך לבחור ממתי לפתוח את הלוח"),
  address: z.string().min(2, "כתובת חובה"),
  household_size: z.string().trim().min(1, "צריך למלא נפשות"),
  children_ages: z.string().trim().min(1, "צריך למלא גילאי הילדים"),
  special_requirements: z.string().optional(),
  kashrut: z.string().optional(),
  contact_phone: z.string().min(7, "טלפון חובה"),
  home_phone: z.string().optional(),
  backup_phone: z.string().optional(),
  delivery_deadline: z.string().regex(/^\d{2}:\d{2}$/),
  general_notes: z.string().optional(),
  day_choices: z.array(
    z.object({
      day_id: z.number().optional(),
      date: z.string().min(1),
      needed: z.boolean(),
    }),
  ),
}).superRefine((values, ctx) => {
  if (!values.is_twins && !values.baby_type) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["baby_type"],
      message: "צריך לבחור מה נולד",
    })
  }

  const scheduleError = getScheduleWindowError(values.birth_date, values.start_date)
  if (scheduleError) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["start_date"],
      message: scheduleError,
    })
  }
})

type IntakeValues = z.infer<typeof intakeSchema>

function parseIsoDate(value: string) {
  const [year, month, day] = value.split("-").map(Number)
  return new Date(year, month - 1, day)
}

function formatIsoDate(date: Date) {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, "0")
  const day = `${date.getDate()}`.padStart(2, "0")
  return `${year}-${month}-${day}`
}

function buildEditableDays(
  startDate: string,
  baseDays: MealDay[],
  deliveryDeadline: string,
  isTwins: boolean,
) {
  const baseDayMap = new Map(baseDays.map((day) => [day.date, day]))
  const visibleDays: MealDay[] = []
  const totalDays = isTwins ? THREE_WEEKS_DAYS : TWO_WEEKS_DAYS

  for (let offset = 0; offset < totalDays; offset += 1) {
    const current = parseIsoDate(startDate)
    current.setDate(current.getDate() + offset)
    if (current.getDay() === 5 || current.getDay() === 6) {
      continue
    }

    const iso = formatIsoDate(current)
    const existingDay = baseDayMap.get(iso)
    if (existingDay) {
      visibleDays.push(existingDay)
      continue
    }

    visibleDays.push({
      id: -(offset + 1),
      date: iso,
      status: "open",
      is_default: true,
      delivery_deadline: deliveryDeadline,
      display_order: visibleDays.length + 1,
      admin_note: null,
      signup: null,
    })
  }

  const includedDates = new Set(visibleDays.map((day) => day.date))
  const extraExistingDays = baseDays.filter(
    (day) => !includedDates.has(day.date) && (!day.is_default || day.signup != null || day.status === "assigned"),
  )

  return [...visibleDays, ...extraExistingDays].sort((left, right) => left.date.localeCompare(right.date))
}

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
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<IntakeValues>({
    resolver: zodResolver(intakeSchema),
    defaultValues: {
      baby_type: undefined,
      is_twins: false,
      mother_name: "",
      birth_date: "",
      start_date: "",
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
    register("baby_type")
    register("is_twins")
  }, [register])

  useEffect(() => {
    if (!intakeQuery.data) {
      return
    }

    reset({
      baby_type: intakeQuery.data.baby_type ?? undefined,
      is_twins: intakeQuery.data.is_twins ?? false,
      mother_name: intakeQuery.data.mother_name ?? "",
      birth_date: intakeQuery.data.birth_date,
      start_date: intakeQuery.data.start_date,
      address: "",
      household_size: "",
      children_ages: "",
      special_requirements: "",
      kashrut: "",
      contact_phone: intakeQuery.data.contact_phone ?? "",
      home_phone: "",
      backup_phone: "",
      delivery_deadline: intakeQuery.data.default_delivery_time,
      general_notes: "",
      day_choices: intakeQuery.data.days.map((day) => ({
        day_id: day.id,
        date: day.date,
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
  const isTwins = watch("is_twins")
  const birthDate = watch("birth_date")
  const startDate = watch("start_date")
  const todayIso = getLocalTodayIso()
  const birthChoice = getBirthChoice(babyType, isTwins)
  const twinsChoice = getTwinsChoice(babyType, isTwins)
  const displayTone: BabyTone | null = isTwins && !babyType ? "mixed" : babyType ?? null
  const babyCopy = getBabyCopy(babyType, isTwins)
  const dayChoices = watch("day_choices") ?? []
  const displayDays = intakeQuery.data
    ? buildEditableDays(
        startDate || intakeQuery.data.start_date,
        intakeQuery.data.days,
        watch("delivery_deadline") || intakeQuery.data.default_delivery_time,
        isTwins,
      )
    : []

  useEffect(() => {
    if (!displayDays.length) {
      return
    }

    const currentChoices = getValues("day_choices")
    const currentChoiceMap = new Map(currentChoices.map((choice) => [choice.date, choice]))
    const nextChoices = displayDays.map((day) => ({
      day_id: day.id > 0 ? day.id : undefined,
      date: day.date,
      needed: currentChoiceMap.get(day.date)?.needed ?? day.status !== "not_needed",
    }))

    const currentSignature = JSON.stringify(currentChoices.map(({ date, needed }) => ({ date, needed })))
    const nextSignature = JSON.stringify(nextChoices.map(({ date, needed }) => ({ date, needed })))
    if (currentSignature !== nextSignature) {
      setValue("day_choices", nextChoices, { shouldValidate: true })
    }
  }, [displayDays, getValues, setValue])

  useEffect(() => {
    if (!birthDate) {
      return
    }

    const nextStartDate = clampScheduleStartDate(birthDate, startDate)
    if (nextStartDate !== startDate) {
      setValue("start_date", nextStartDate, { shouldDirty: true, shouldValidate: true })
    }
  }, [birthDate, setValue, startDate])

  const selectionByDate = Object.fromEntries(dayChoices.map((choice) => [choice.date, choice.needed]))
  const selectionMap = Object.fromEntries(displayDays.map((day) => [day.id, selectionByDate[day.date] ?? true]))
  const birthDateField = register("birth_date")
  const startDateField = register("start_date")

  function toggleNeeded(day: MealDay) {
    const nextChoices = getValues("day_choices").map((choice) =>
      choice.date === day.date ? { ...choice, needed: !choice.needed } : choice,
    )
    setValue("day_choices", nextChoices, { shouldDirty: true, shouldValidate: true })
  }

  function handleBirthChoice(choice: BirthChoice) {
    const next = resolveBirthSelection(choice, twinsChoice)
    setValue("is_twins", next.isTwins, { shouldDirty: true, shouldValidate: true })
    setValue("baby_type", next.babyType ?? undefined, { shouldDirty: true, shouldValidate: true })
  }

  function handleTwinsChoice(choice: TwinsChoice) {
    const next = resolveBirthSelection("twins", choice)
    setValue("is_twins", true, { shouldDirty: true, shouldValidate: true })
    setValue("baby_type", next.babyType ?? undefined, { shouldDirty: true, shouldValidate: true })
  }

  function handleBirthDateChange(nextBirthDate: string) {
    setValue("birth_date", nextBirthDate, { shouldDirty: true, shouldValidate: true })
    const nextStartDate = clampScheduleStartDate(nextBirthDate, startDate)
    if (nextStartDate !== startDate) {
      setValue("start_date", nextStartDate || getDefaultScheduleStartDate(nextBirthDate), {
        shouldDirty: true,
        shouldValidate: true,
      })
    }
  }

  function handleStartDateChange(nextStartDate: string) {
    if (!nextStartDate) {
      setValue("start_date", "", { shouldDirty: true, shouldValidate: true })
      return
    }

    if (isWeekendScheduleDate(nextStartDate)) {
      setError("start_date", {
        type: "manual",
        message: "לא ניתן לבחור שישי או שבת לפתיחת הלוח",
      })
      return
    }

    clearErrors("start_date")
    setValue("start_date", nextStartDate, { shouldDirty: true, shouldValidate: true })
  }

  function handleFormSubmit(values: IntakeValues) {
    const neededDays = values.day_choices.filter((choice) => choice.needed).length
    if (values.day_choices.length > 0 && neededDays === 0) {
      const confirmed = window.confirm("כל הימים מסומנים כרגע 'לא צריך'. לשלוח ככה את השאלון?")
      if (!confirmed) {
        setActiveTab("calendar")
        return
      }
    }

    submitMutation.mutate(values)
  }

  return (
    <PageShell
      title="טופס יולדת"
      subtitle="מלאי את הפרטים וסמני באילו ימים צריך ארוחה."
      tone={displayTone}
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
          <form className="form-grid" onSubmit={handleSubmit(handleFormSubmit)}>
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
                  <div className="baby-type-picker__options baby-type-picker__options--triple">
                    <label className={`baby-type-option ${birthChoice === "boy" ? "baby-type-option--selected" : ""}`}>
                      <input
                        type="radio"
                        checked={birthChoice === "boy"}
                        onChange={() => handleBirthChoice("boy")}
                      />
                      <span>בן</span>
                    </label>
                    <label className={`baby-type-option ${birthChoice === "girl" ? "baby-type-option--selected" : ""}`}>
                      <input
                        type="radio"
                        checked={birthChoice === "girl"}
                        onChange={() => handleBirthChoice("girl")}
                      />
                      <span>בת</span>
                    </label>
                    <label className={`baby-type-option ${birthChoice === "twins" ? "baby-type-option--selected" : ""}`}>
                      <input
                        type="radio"
                        checked={birthChoice === "twins"}
                        onChange={() => handleBirthChoice("twins")}
                      />
                      <span>תאומים</span>
                    </label>
                  </div>
                  {errors.baby_type ? <small>{errors.baby_type.message}</small> : null}
                  {birthChoice === "twins" ? (
                    <div className="baby-type-picker__options baby-type-picker__options--triple">
                      <label className={`baby-type-option ${twinsChoice === "boys" ? "baby-type-option--selected" : ""}`}>
                        <input type="radio" checked={twinsChoice === "boys"} onChange={() => handleTwinsChoice("boys")} />
                        <span>בנים</span>
                      </label>
                      <label className={`baby-type-option ${twinsChoice === "girls" ? "baby-type-option--selected" : ""}`}>
                        <input type="radio" checked={twinsChoice === "girls"} onChange={() => handleTwinsChoice("girls")} />
                        <span>בנות</span>
                      </label>
                      <label className={`baby-type-option ${twinsChoice === "mixed" ? "baby-type-option--selected" : ""}`}>
                        <input type="radio" checked={twinsChoice === "mixed"} onChange={() => handleTwinsChoice("mixed")} />
                        <span>בן ובת</span>
                      </label>
                    </div>
                  ) : null}
                </fieldset>

                <label className="field">
                  <span>שם היולדת</span>
                  <input {...register("mother_name")} />
                </label>
                <div className="field-row field-row--keep">
                  <label className="field">
                    <span>תאריך הלידה</span>
                    <input
                      type="date"
                      name={birthDateField.name}
                      ref={birthDateField.ref}
                      onBlur={birthDateField.onBlur}
                      value={birthDate || ""}
                      max={todayIso}
                      onChange={(event) => handleBirthDateChange(event.target.value)}
                    />
                    {errors.birth_date ? <small>{errors.birth_date.message}</small> : null}
                  </label>
                  <label className="field">
                    <span>ממתי לפתוח את הלוח</span>
                    <input
                      type="date"
                      name={startDateField.name}
                      ref={startDateField.ref}
                      onBlur={startDateField.onBlur}
                      value={startDate || ""}
                      min={birthDate ? getEarliestScheduleStartDate(birthDate) : undefined}
                      max={birthDate ? getLatestScheduleStartDate(birthDate) : undefined}
                      onChange={(event) => handleStartDateChange(event.target.value)}
                    />
                    {errors.start_date ? <small>{errors.start_date.message}</small> : null}
                  </label>
                </div>
                <label className="field field--full">
                  <span>כתובת</span>
                  <input {...register("address")} />
                  {errors.address ? <small>{errors.address.message}</small> : null}
                </label>
                <div className="field-row field-row--keep">
                  <label className="field">
                    <span>נפשות</span>
                    <input {...register("household_size")} />
                    {errors.household_size ? <small>{errors.household_size.message}</small> : null}
                  </label>
                  <label className="field">
                    <span>גילאי הילדים</span>
                    <input {...register("children_ages")} />
                    {errors.children_ages ? <small>{errors.children_ages.message}</small> : null}
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
                  days={displayDays}
                  babyType={displayTone}
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
