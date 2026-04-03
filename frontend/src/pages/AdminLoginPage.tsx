import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { Link, useNavigate } from "react-router-dom"
import { z } from "zod"

import { PageShell } from "../components/PageShell"
import { apiRequest, ApiError } from "../lib/api"
import { useAuth } from "../lib/auth"
import type { AuthResponse } from "../lib/types"

const loginSchema = z.object({
  email: z.string().email("צריך להזין אימייל תקין"),
  password: z.string().min(1, "צריך להזין סיסמה"),
})

type LoginFormValues = z.infer<typeof loginSchema>

export function AdminLoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "admin@estherica.local",
      password: "change-me",
    },
  })

  const loginMutation = useMutation({
    mutationFn: (values: LoginFormValues) =>
      apiRequest<AuthResponse>("/api/admin/auth/login", {
        method: "POST",
        body: JSON.stringify(values),
      }),
    onSuccess: (payload) => {
      login(payload)
      navigate("/admin")
    },
  })

  return (
    <PageShell
      title="כניסה"
      subtitle="לא נדרש להתחבר בשביל להשתבץ. הכניסה כאן מיועדת רק למנהלות."
      actions={
        <Link to="/" className="button button--ghost">
          חזרה לאתר
        </Link>
      }
    >
      <section className="panel panel--form">
        <form className="form-grid" onSubmit={handleSubmit((values) => loginMutation.mutate(values))}>
          <label className="field">
            <span>אימייל מנהלת</span>
            <input type="email" {...register("email")} />
            {errors.email ? <small>{errors.email.message}</small> : null}
          </label>

          <label className="field">
            <span>סיסמה</span>
            <input type="password" {...register("password")} />
            {errors.password ? <small>{errors.password.message}</small> : null}
          </label>

          {loginMutation.error ? (
            <p className="feedback feedback--error">
              {(loginMutation.error as ApiError).message}
            </p>
          ) : null}

          <button className="button button--primary" type="submit" disabled={loginMutation.isPending}>
            {loginMutation.isPending ? "נכנסת..." : "כניסה למערכת"}
          </button>
        </form>
      </section>
    </PageShell>
  )
}
