import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation } from "@tanstack/react-query"
import { useForm, useWatch } from "react-hook-form"
import { Link, useNavigate } from "react-router-dom"
import { z } from "zod"
import { useEffect } from "react"

import { PageShell } from "../components/PageShell"
import { apiRequest, ApiError } from "../lib/api"
import { getBirthChoice, getTwinsChoice, resolveBirthSelection, type BirthChoice, type TwinsChoice } from "../lib/baby"
import { getLocalTodayIso } from "../lib/date"
import {
  clampScheduleStartDate,
  getEarliestScheduleStartDate,
  getLatestScheduleStartDate,
  getScheduleWindowError,
} from "../lib/scheduleWindow"
import type { BabyTone, BabyType, PublicBirthNoticeResponse } from "../lib/types"

const birthNoticeSchema = z.object({
  family_name: z.string().min(2, "צריך שם משפחה"),
  mother_name: z.string().min(2, "צריך שם יולדת"),
  baby_type: z.enum(["boy", "girl"]).optional(),
  is_twins: z.boolean(),
  birth_date: z.string().min(1, "צריך תאריך לידה"),
  start_date: z.string().min(1, "צריך תאריך התחלה"),
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

type BirthNoticeValues = z.infer<typeof birthNoticeSchema>

export function PublicBirthNoticePage() {
  const navigate = useNavigate()
  const form = useForm<BirthNoticeValues>({
    resolver: zodResolver(birthNoticeSchema),
    defaultValues: {
      family_name: "",
      mother_name: "",
      baby_type: undefined,
      is_twins: false,
      birth_date: getLocalTodayIso(),
      start_date: getLocalTodayIso(),
    },
  })

  useEffect(() => {
    form.register("baby_type")
    form.register("is_twins")
  }, [form])

  const babyType = useWatch({
    control: form.control,
    name: "baby_type",
  }) as BabyType | undefined
  const isTwins = useWatch({
    control: form.control,
    name: "is_twins",
  })
  const birthDate = useWatch({
    control: form.control,
    name: "birth_date",
  }) as string
  const startDate = useWatch({
    control: form.control,
    name: "start_date",
  }) as string
  const birthChoice = getBirthChoice(babyType, isTwins)
  const twinsChoice = getTwinsChoice(babyType, isTwins)
  const displayTone: BabyTone | null = isTwins && !babyType ? "mixed" : babyType ?? null

  function handleBirthChoice(choice: BirthChoice) {
    const next = resolveBirthSelection(choice, twinsChoice)
    form.setValue("is_twins", next.isTwins, { shouldDirty: true, shouldValidate: true })
    form.setValue("baby_type", next.babyType ?? undefined, { shouldDirty: true, shouldValidate: true })
  }

  function handleTwinsChoice(choice: TwinsChoice) {
    const next = resolveBirthSelection("twins", choice)
    form.setValue("is_twins", true, { shouldDirty: true, shouldValidate: true })
    form.setValue("baby_type", next.babyType ?? undefined, { shouldDirty: true, shouldValidate: true })
  }

  useEffect(() => {
    if (!birthDate) {
      return
    }

    const nextStartDate = clampScheduleStartDate(birthDate, startDate)
    if (nextStartDate !== startDate) {
      form.setValue("start_date", nextStartDate, { shouldDirty: true, shouldValidate: true })
    }
  }, [birthDate, form, startDate])

  const createMutation = useMutation({
    mutationFn: (values: BirthNoticeValues) =>
      apiRequest<PublicBirthNoticeResponse>("/api/public/birth-notices", {
        method: "POST",
        body: JSON.stringify(values),
      }),
    onSuccess: (response) => {
      navigate(`/intake/${response.intake_token}`)
    },
  })

  return (
    <PageShell
      title="ילדתי"
      subtitle="מלאי כמה פרטים קצרים, ומיד נפתח לך טופס היולדת המלא בלי לחכות לקישור מהמנהלת."
      tone={displayTone}
      actions={
        <Link className="button button--ghost" to="/">
          חזרה ללובי
        </Link>
      }
    >
      <section className="panel">
        <form className="form-grid" onSubmit={form.handleSubmit((values) => createMutation.mutate(values))}>
          <label className="field">
            <span>שם המשפחה</span>
            <input {...form.register("family_name")} placeholder="כהן" />
            {form.formState.errors.family_name ? (
              <small>{form.formState.errors.family_name.message}</small>
            ) : null}
          </label>

          <label className="field">
            <span>שם היולדת</span>
            <input {...form.register("mother_name")} placeholder="שרה" />
            {form.formState.errors.mother_name ? (
              <small>{form.formState.errors.mother_name.message}</small>
            ) : null}
          </label>

          <fieldset className="baby-type-picker">
            <legend>מה נולד?</legend>
            <div className="baby-type-picker__options baby-type-picker__options--triple">
              <label className={`baby-type-option ${birthChoice === "boy" ? "baby-type-option--selected" : ""}`}>
                <input type="radio" checked={birthChoice === "boy"} onChange={() => handleBirthChoice("boy")} />
                <span>בן</span>
              </label>
              <label className={`baby-type-option ${birthChoice === "girl" ? "baby-type-option--selected" : ""}`}>
                <input type="radio" checked={birthChoice === "girl"} onChange={() => handleBirthChoice("girl")} />
                <span>בת</span>
              </label>
              <label className={`baby-type-option ${birthChoice === "twins" ? "baby-type-option--selected" : ""}`}>
                <input type="radio" checked={birthChoice === "twins"} onChange={() => handleBirthChoice("twins")} />
                <span>תאומים</span>
              </label>
            </div>
            {form.formState.errors.baby_type ? <small>{form.formState.errors.baby_type.message}</small> : null}
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
            <span>תאריך הלידה</span>
            <input type="date" max={getLocalTodayIso()} {...form.register("birth_date")} />
            {form.formState.errors.birth_date ? (
              <small>{form.formState.errors.birth_date.message}</small>
            ) : null}
          </label>

          <label className="field">
            <span>ממתי לפתוח את הלוח</span>
            <input
              type="date"
              min={birthDate ? getEarliestScheduleStartDate(birthDate) : undefined}
              max={birthDate ? getLatestScheduleStartDate(birthDate) : undefined}
              {...form.register("start_date")}
            />
            {form.formState.errors.start_date ? (
              <small>{form.formState.errors.start_date.message}</small>
            ) : null}
          </label>

          {createMutation.error ? (
            <p className="feedback feedback--error">
              {(createMutation.error as ApiError).message}
            </p>
          ) : null}

          <div className="form-actions">
            <button className="button button--primary" type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "פותחת..." : "המשך לטופס המלא"}
            </button>
            <p className="muted">
              המנהלות יקבלו את הפרטים דרך המערכת אחרי שתשלימי את הטופס המלא.
            </p>
          </div>
        </form>
      </section>
    </PageShell>
  )
}
