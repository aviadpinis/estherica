import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation } from "@tanstack/react-query"
import { useForm, useWatch } from "react-hook-form"
import { Link, useNavigate } from "react-router-dom"
import { z } from "zod"

import { PageShell } from "../components/PageShell"
import { apiRequest, ApiError } from "../lib/api"
import { getLocalTodayIso } from "../lib/date"
import type { BabyType, PublicBirthNoticeResponse } from "../lib/types"

const birthNoticeSchema = z.object({
  family_name: z.string().min(2, "צריך שם משפחה"),
  mother_name: z.string().min(2, "צריך שם יולדת"),
  baby_type: z.enum(["boy", "girl"], {
    error: "צריך לבחור מה נולד",
  }),
  is_twins: z.boolean(),
  start_date: z.string().min(1, "צריך תאריך התחלה"),
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
      start_date: getLocalTodayIso(),
    },
  })

  const babyType = useWatch({
    control: form.control,
    name: "baby_type",
  }) as BabyType | undefined

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
      tone={babyType ?? null}
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
            <div className="baby-type-picker__options">
              <label className={`baby-type-option ${babyType === "boy" ? "baby-type-option--selected" : ""}`}>
                <input type="radio" value="boy" {...form.register("baby_type")} />
                <span>בן</span>
              </label>
              <label className={`baby-type-option ${babyType === "girl" ? "baby-type-option--selected" : ""}`}>
                <input type="radio" value="girl" {...form.register("baby_type")} />
                <span>בת</span>
              </label>
            </div>
            {form.formState.errors.baby_type ? <small>{form.formState.errors.baby_type.message}</small> : null}
          </fieldset>

          <label className="checkbox-field">
            <input type="checkbox" {...form.register("is_twins")} />
            <span>מדובר בתאומים / תאומות</span>
            <small>במקרה כזה המערכת תפתח אוטומטית לוח ל־3 שבועות.</small>
          </label>

          <label className="field">
            <span>ממתי לפתוח את הלוח</span>
            <input type="date" {...form.register("start_date")} />
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
