import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useRef, useState, type CSSProperties } from "react"
import { useForm } from "react-hook-form"
import { Navigate } from "react-router-dom"
import { z } from "zod"

import { MealCalendar } from "../components/MealCalendar"
import { PageShell } from "../components/PageShell"
import { apiRequest, ApiError } from "../lib/api"
import { useAuth } from "../lib/auth"
import { getBabyCopy } from "../lib/baby"
import { formatDatePair, getLocalTodayIso } from "../lib/date"
import type {
  AdminAccount,
  AdminOverview,
  BabyType,
  MealDay,
  MealTrainDetail,
  MealTrainSummary,
} from "../lib/types"

const babyTypeSchema = z.enum(["boy", "girl"]).or(z.literal(""))

const createTrainSchema = z.object({
  family_title: z.string().min(2, "צריך כותרת"),
  mother_name: z.string().optional(),
  contact_phone: z.string().optional(),
  baby_type: babyTypeSchema,
  is_twins: z.boolean(),
  start_date: z.string().min(1, "צריך תאריך התחלה"),
  default_delivery_time: z.string().regex(/^\d{2}:\d{2}$/),
  reminder_time: z.string().regex(/^\d{2}:\d{2}$/),
})

const editTrainSchema = z.object({
  family_title: z.string().min(2, "צריך כותרת"),
  mother_name: z.string().optional(),
  contact_phone: z.string().optional(),
  baby_type: babyTypeSchema,
  is_twins: z.boolean(),
  default_delivery_time: z.string().regex(/^\d{2}:\d{2}$/),
  reminder_time: z.string().regex(/^\d{2}:\d{2}$/),
  lobby_visible: z.boolean().optional(),
})

const addDaySchema = z.object({
  date: z.string().min(1, "צריך תאריך"),
  delivery_deadline: z.string().regex(/^\d{2}:\d{2}$/),
  admin_note: z.string().optional(),
})

const createAdminSchema = z.object({
  full_name: z.string().optional(),
  email: z.string().email("צריך אימייל תקין"),
  password: z.string().min(8, "צריך סיסמה של לפחות 8 תווים"),
})

type CreateTrainValues = z.infer<typeof createTrainSchema>
type EditTrainValues = z.infer<typeof editTrainSchema>
type AddDayValues = z.infer<typeof addDaySchema>
type CreateAdminValues = z.infer<typeof createAdminSchema>

type AdminTab = "cases" | "stats" | "new" | "admins"
type CaseDetailTab = "summary" | "links" | "calendar" | "details"
type ConfirmAction = "gift" | "visibility" | "delete"

interface DayDraft {
  status: MealDay["status"]
  delivery_deadline: string
  admin_note: string
}

interface TabOption {
  id: AdminTab
  label: string
}

const adminTabs: TabOption[] = [
  { id: "cases", label: "יולדות" },
  { id: "new", label: "יולדת חדשה" },
  { id: "stats", label: "סטטיסטיקה" },
  { id: "admins", label: "מנהלות" },
]

const caseDetailTabs: Array<{ id: CaseDetailTab; label: string }> = [
  { id: "summary", label: "סיכום" },
  { id: "links", label: "קישורים" },
  { id: "calendar", label: "לוח" },
  { id: "details", label: "עריכת פרטים" },
]

function buildPublicLink(token: string) {
  return `${window.location.origin}/t/${token}`
}

function buildIntakeLink(token: string) {
  return `${window.location.origin}/intake/${token}`
}

function normalizeWhatsAppPhone(phone: string | null | undefined) {
  if (!phone) {
    return null
  }

  let digits = phone.trim().replace(/[^\d+]/g, "")
  if (!digits) {
    return null
  }

  if (digits.startsWith("+")) {
    digits = digits.slice(1)
  }

  if (digits.startsWith("00")) {
    digits = digits.slice(2)
  }

  if (digits.startsWith("0")) {
    digits = `972${digits.slice(1)}`
  }

  if (!/^\d{8,15}$/.test(digits)) {
    return null
  }

  return digits
}

function buildWhatsAppLink(message: string, phone?: string | null) {
  const normalizedPhone = normalizeWhatsAppPhone(phone)
  if (normalizedPhone) {
    return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`
  }

  return `https://wa.me/?text=${encodeURIComponent(message)}`
}

function buildIntakeShareMessage(train: MealTrainDetail) {
  return `היי, מזל טוב!\nכדי לפתוח את הלוח שלך, מלאי בבקשה את השאלון כאן:\n${buildIntakeLink(train.intake_token)}`
}

function buildSignupShareMessage(train: MealTrainDetail) {
  const babyCopy = getBabyCopy(train.baby_type, train.is_twins)
  return `מפנקות את ${train.family_title}\nמזל טוב ${babyCopy.blessing}\nלהשתבצות לארוחה:\n${buildPublicLink(train.public_token)}`
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M20 11.9C20 16.3 16.4 19.9 12 19.9C10.7 19.9 9.4 19.6 8.3 19L4.5 20L5.6 16.4C4.9 15.1 4.6 13.7 4.6 12.2C4.6 7.8 8.2 4.2 12.6 4.2C17 4.2 20.6 7.8 20.6 12.2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9.4 8.8C9.7 8.1 10 8 10.3 8C10.5 8 10.8 8 11 8.1C11.2 8.1 11.4 8.2 11.5 8.5C11.7 8.9 12 9.9 12 10C12.1 10.2 12 10.4 11.9 10.5C11.8 10.7 11.6 10.9 11.5 11C11.4 11.1 11.2 11.3 11.4 11.6C11.6 11.9 12.1 12.8 12.9 13.5C13.9 14.3 14.7 14.6 15 14.8C15.3 14.9 15.5 14.9 15.7 14.7C15.9 14.5 16.5 13.8 16.7 13.5C16.9 13.3 17 13.2 17.3 13.3C17.5 13.4 18.8 14 19 14.1C19.2 14.2 19.4 14.3 19.4 14.5C19.4 14.7 19.2 15.7 18.5 16.3C17.8 16.8 16.8 17 15.8 16.7C14.8 16.4 13.4 15.9 12 14.7C10.3 13.3 9.2 11.6 8.9 10.9C8.6 10.2 8.9 9.6 9.4 8.8Z"
        fill="currentColor"
      />
    </svg>
  )
}

function GiftIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
      <path d="M12 4V20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M4 9H20V20H4V9Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M4 9H20" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 9H8.6C7.16 9 6 7.84 6 6.4C6 4.97 7.16 3.8 8.6 3.8C10.93 3.8 12 6.2 12 7.4V9Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M12 9H15.4C16.84 9 18 7.84 18 6.4C18 4.97 16.84 3.8 15.4 3.8C13.07 3.8 12 6.2 12 7.4V9Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function VisibilityIcon({ hidden }: { hidden: boolean }) {
  if (hidden) {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
        <path
          d="M3 3L21 21"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <path
          d="M10.6 6.18C11.06 6.06 11.52 6 12 6C17.4 6 21 12 21 12C20.34 13.24 19.43 14.33 18.35 15.22"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M14.12 14.12C13.57 14.67 12.81 15 12 15C10.34 15 9 13.66 9 12C9 11.19 9.33 10.43 9.88 9.88"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M6.11 6.11C4.11 7.3 2.66 9.3 1.99 10.56C1.73 11.05 1.73 11.62 1.99 12.11C3 14.01 6.39 18 12 18C13.73 18 15.26 17.62 16.6 16.99"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
      <path
        d="M1.99 12.11C1.73 11.62 1.73 11.05 1.99 10.56C3 8.66 6.39 4.67 12 4.67C17.61 4.67 21 8.66 22.01 10.56C22.27 11.05 22.27 11.62 22.01 12.11C21 14.01 17.61 18 12 18C6.39 18 3 14.01 1.99 12.11Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="11.33" r="3" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
      <path d="M4 7H20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path
        d="M7 7V18C7 19.1 7.9 20 9 20H15C16.1 20 17 19.1 17 18V7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M10 11V16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M14 11V16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path
        d="M9 4H15L16 7H8L9 4Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ShareIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none">
      <path
        d="M15 8L19 4M19 4H15M19 4V8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10 6H8C6.34 6 5 7.34 5 9V16C5 17.66 6.34 19 8 19H15C16.66 19 18 17.66 18 16V14"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 12L19 5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}

function getInitialNotificationPermission() {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported" as const
  }

  return window.Notification.permission
}

function getRiskCopy(train: MealTrainSummary) {
  if (train.is_archived) {
    return "הסתיים"
  }

  if (train.urgent_open_days > 0) {
    return `${train.urgent_open_days} ימים דחופים`
  }

  if (train.open_days > 0) {
    return `${train.open_days} ימים פתוחים`
  }

  return "מלא"
}

function getRiskPriority(train: MealTrainSummary) {
  if (train.risk_level === "risk") {
    return 0
  }

  if (train.risk_level === "watch") {
    return 1
  }

  if (train.risk_level === "healthy") {
    return 2
  }

  return 3
}

function getTrainStatusLabel(status: MealTrainSummary["status"] | MealTrainDetail["status"]) {
  if (status === "published") {
    return "פעיל"
  }

  if (status === "completed") {
    return "הסתיים"
  }

  return "טיוטה"
}

function getTrainTone(train: MealTrainSummary) {
  if (train.risk_level === "risk") {
    return "danger" as const
  }

  if (train.risk_level === "watch") {
    return "warning" as const
  }

  return "success" as const
}

function sortTrainSummaries(trains: MealTrainSummary[]) {
  return trains.slice().sort((left, right) => {
    const riskDelta = getRiskPriority(left) - getRiskPriority(right)
    if (riskDelta !== 0) {
      return riskDelta
    }

    const urgentDelta = right.urgent_open_days - left.urgent_open_days
    if (urgentDelta !== 0) {
      return urgentDelta
    }

    const openDelta = right.open_days - left.open_days
    if (openDelta !== 0) {
      return openDelta
    }

    return left.family_title.localeCompare(right.family_title, "he")
  })
}

function getTrainCardTone(train: Pick<MealTrainSummary, "baby_type"> | Pick<MealTrainDetail, "baby_type">) {
  return train.baby_type ?? "neutral"
}

function getResolvedDays(totalDays: number, openDays: number) {
  return Math.max(0, totalDays - openDays)
}

function ProgressDonut({
  assignedDays,
  totalDays,
  tone = "neutral",
  compact = false,
}: {
  assignedDays: number
  totalDays: number
  tone?: "neutral" | "success" | "warning" | "danger"
  compact?: boolean
}) {
  const percent = totalDays ? Math.round((assignedDays / totalDays) * 100) : 0
  const className = ["progress-donut", `progress-donut--${tone}`, compact ? "progress-donut--compact" : ""]
    .filter(Boolean)
    .join(" ")

  return (
    <div
      className={className}
      style={{ "--progress": `${percent}%` } as CSSProperties}
      aria-label={`אחוז מילוי ${percent}`}
    >
      <div className="progress-donut__center">
        <strong>{percent}%</strong>
        <span>
          {assignedDays}/{totalDays}
        </span>
      </div>
    </div>
  )
}

function CalendarBreakdownChart({
  openDays,
  assignedDays,
  notNeededDays,
}: {
  openDays: number
  assignedDays: number
  notNeededDays: number
}) {
  const total = openDays + assignedDays + notNeededDays
  const openPercent = total ? Math.round((openDays / total) * 100) : 0
  const assignedPercent = total ? Math.round((assignedDays / total) * 100) : 0
  const notNeededPercent = Math.max(0, 100 - openPercent - assignedPercent)

  return (
    <div className="calendar-breakdown">
      <div
        className="calendar-breakdown__chart"
        style={
          {
            "--slice-open": `${openPercent}%`,
            "--slice-assigned": `${assignedPercent}%`,
            "--slice-not-needed": `${notNeededPercent}%`,
          } as CSSProperties
        }
        aria-label={`מתוך ${total} ימים: ${openDays} נשארו, ${assignedDays} נסגרו, ${notNeededDays} לא צריך`}
      >
        <div className="calendar-breakdown__center">
          <strong>{total}</strong>
          <span>ימים</span>
        </div>
      </div>
      <div className="calendar-breakdown__legend">
        <div className="calendar-breakdown__item">
          <span className="calendar-breakdown__swatch calendar-breakdown__swatch--open" />
          <span>נשארו: {openDays}</span>
        </div>
        <div className="calendar-breakdown__item">
          <span className="calendar-breakdown__swatch calendar-breakdown__swatch--assigned" />
          <span>נסגרו: {assignedDays}</span>
        </div>
        <div className="calendar-breakdown__item">
          <span className="calendar-breakdown__swatch calendar-breakdown__swatch--not-needed" />
          <span>לא צריך: {notNeededDays}</span>
        </div>
      </div>
    </div>
  )
}

export function AdminDashboardPage() {
  const { token, logout } = useAuth()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<AdminTab>("cases")
  const [activeCaseTab, setActiveCaseTab] = useState<CaseDetailTab>("summary")
  const [selectedTrainId, setSelectedTrainId] = useState<number | null>(null)
  const [selectedDayId, setSelectedDayId] = useState<number | null>(null)
  const [dayDrafts, setDayDrafts] = useState<Record<number, DayDraft>>({})
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [notificationPermission, setNotificationPermission] = useState(getInitialNotificationPermission)
  const intakeStateRef = useRef<Record<number, boolean>>({})

  const createForm = useForm<CreateTrainValues>({
    resolver: zodResolver(createTrainSchema),
    defaultValues: {
      family_title: "",
      mother_name: "",
      contact_phone: "",
      baby_type: "",
      is_twins: false,
      start_date: new Date().toISOString().slice(0, 10),
      default_delivery_time: "18:00",
      reminder_time: "09:00",
    },
  })

  const editForm = useForm<EditTrainValues>({
    resolver: zodResolver(editTrainSchema),
    defaultValues: {
      family_title: "",
      mother_name: "",
      contact_phone: "",
      baby_type: "",
      is_twins: false,
      default_delivery_time: "18:00",
      reminder_time: "09:00",
    },
  })

  const addDayForm = useForm<AddDayValues>({
    resolver: zodResolver(addDaySchema),
    defaultValues: {
      date: "",
      delivery_deadline: "18:00",
      admin_note: "",
    },
  })

  const createAdminForm = useForm<CreateAdminValues>({
    resolver: zodResolver(createAdminSchema),
    defaultValues: {
      full_name: "",
      email: "",
      password: "",
    },
  })

  const trainsQuery = useQuery({
    queryKey: ["meal-trains"],
    queryFn: () => apiRequest<MealTrainSummary[]>("/api/admin/meal-trains", {}, token),
    enabled: Boolean(token),
    refetchInterval: 15000,
  })

  const adminsQuery = useQuery({
    queryKey: ["admins"],
    queryFn: () => apiRequest<AdminAccount[]>("/api/admin/auth/admins", {}, token),
    enabled: Boolean(token),
  })

  const overviewQuery = useQuery({
    queryKey: ["admin-overview"],
    queryFn: () => apiRequest<AdminOverview>("/api/admin/overview", {}, token),
    enabled: Boolean(token),
    refetchInterval: 15000,
  })

  const selectedTrainQuery = useQuery({
    queryKey: ["meal-train", selectedTrainId],
    queryFn: () => apiRequest<MealTrainDetail>(`/api/admin/meal-trains/${selectedTrainId}`, {}, token),
    enabled: Boolean(token && selectedTrainId),
    refetchInterval: 15000,
  })

  useEffect(() => {
    if (!trainsQuery.data?.length) {
      setSelectedTrainId(null)
      return
    }

    const preferredTrain = trainsQuery.data.find((train) => !train.is_archived) ?? trainsQuery.data[0]

    if (!selectedTrainId) {
      setSelectedTrainId(preferredTrain.id)
      return
    }

    const stillExists = trainsQuery.data.some((train) => train.id === selectedTrainId)
    if (!stillExists) {
      setSelectedTrainId(preferredTrain.id)
    }
  }, [selectedTrainId, trainsQuery.data])

  useEffect(() => {
    if (!trainsQuery.data) {
      return
    }

    const nextState: Record<number, boolean> = {}
    trainsQuery.data.forEach((train) => {
      const previous = intakeStateRef.current[train.id]
      nextState[train.id] = train.intake_submitted

      if (previous === undefined) {
        return
      }

      if (!previous && train.intake_submitted) {
        setFeedback(`השאלון של ${train.family_title} הושלם, והלוח נפתח אוטומטית להשתבצות.`)
        if (notificationPermission === "granted") {
          new Notification("שאלון חדש הושלם", {
            body: `${train.family_title} מילאה את השאלון. אפשר כבר לשתף את לוח ההשתבצות.`,
          })
        }
      }
    })

    intakeStateRef.current = nextState
  }, [notificationPermission, trainsQuery.data])

  useEffect(() => {
    if (!selectedTrainQuery.data) {
      return
    }

    const train = selectedTrainQuery.data
    editForm.reset({
      family_title: train.family_title,
      mother_name: train.mother_name ?? "",
      contact_phone: train.contact_phone ?? "",
      baby_type: train.baby_type ?? "",
      is_twins: train.is_twins,
      default_delivery_time: train.default_delivery_time,
      reminder_time: train.reminder_time,
    })

    addDayForm.reset({
      date: "",
      delivery_deadline: train.default_delivery_time,
      admin_note: "",
    })

    const nextDrafts: Record<number, DayDraft> = {}
    train.days.forEach((day) => {
      nextDrafts[day.id] = {
        status: day.status,
        delivery_deadline: day.delivery_deadline,
        admin_note: day.admin_note ?? "",
      }
    })
    setDayDrafts(nextDrafts)

    if (selectedDayId && !train.days.some((day) => day.id === selectedDayId)) {
      setSelectedDayId(null)
    }
  }, [addDayForm, editForm, selectedDayId, selectedTrainQuery.data])

  const createMutation = useMutation({
    mutationFn: (values: CreateTrainValues) =>
      apiRequest<MealTrainDetail>(
        "/api/admin/meal-trains",
        {
          method: "POST",
          body: JSON.stringify({
            ...values,
            contact_phone: values.contact_phone || null,
            baby_type: values.baby_type || null,
          }),
        },
        token,
      ),
    onSuccess: (created) => {
      setFeedback("המקרה נפתח. נשאר רק לשלוח ליולדת את קישור השאלון.")
      createForm.reset({
        family_title: "",
        mother_name: "",
        contact_phone: "",
        baby_type: "",
        is_twins: false,
        start_date: new Date().toISOString().slice(0, 10),
        default_delivery_time: "18:00",
        reminder_time: "09:00",
      })
      queryClient.invalidateQueries({ queryKey: ["meal-trains"] })
      queryClient.invalidateQueries({ queryKey: ["admin-overview"] })
      queryClient.setQueryData(["meal-train", created.id], created)
      setSelectedTrainId(created.id)
      setSelectedDayId(null)
      setActiveCaseTab("summary")
      setActiveTab("cases")
    },
  })

  const updateTrainMutation = useMutation({
    mutationFn: (values: EditTrainValues) =>
      apiRequest<MealTrainDetail>(
        `/api/admin/meal-trains/${selectedTrainId}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            ...values,
            contact_phone: values.contact_phone || null,
            baby_type: values.baby_type || null,
          }),
        },
        token,
      ),
    onSuccess: (updated) => {
      setFeedback("פרטי המקרה עודכנו.")
      setConfirmAction(null)
      queryClient.invalidateQueries({ queryKey: ["meal-trains"] })
      queryClient.invalidateQueries({ queryKey: ["admin-overview"] })
      queryClient.setQueryData(["meal-train", updated.id], updated)
    },
  })

  const addDayMutation = useMutation({
    mutationFn: (values: AddDayValues) =>
      apiRequest<MealTrainDetail>(
        `/api/admin/meal-trains/${selectedTrainId}/days`,
        {
          method: "POST",
          body: JSON.stringify(values),
        },
        token,
      ),
    onSuccess: (updated) => {
      setFeedback("יום חדש נוסף ללוח.")
      queryClient.invalidateQueries({ queryKey: ["meal-trains"] })
      queryClient.invalidateQueries({ queryKey: ["admin-overview"] })
      queryClient.setQueryData(["meal-train", updated.id], updated)
      addDayForm.reset({
        date: "",
        delivery_deadline: updated.default_delivery_time,
        admin_note: "",
      })
    },
  })

  const updateDayMutation = useMutation({
    mutationFn: ({ dayId, values }: { dayId: number; values: DayDraft }) =>
      apiRequest<MealDay>(
        `/api/admin/meal-days/${dayId}`,
        {
          method: "PATCH",
          body: JSON.stringify(values),
        },
        token,
      ),
    onSuccess: (_, variables) => {
      setFeedback("היום עודכן.")
      queryClient.invalidateQueries({ queryKey: ["meal-trains"] })
      queryClient.invalidateQueries({ queryKey: ["admin-overview"] })
      queryClient.invalidateQueries({ queryKey: ["meal-train", selectedTrainId] })
      setDayDrafts((current) => ({
        ...current,
        [variables.dayId]: variables.values,
      }))
      setSelectedDayId(null)
    },
  })

  const updateGiftMutation = useMutation({
    mutationFn: (giftDelivered: boolean) =>
      apiRequest<MealTrainDetail>(
        `/api/admin/meal-trains/${selectedTrainId}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            gift_delivered: giftDelivered,
          }),
        },
        token,
      ),
    onSuccess: (updated) => {
      setFeedback(updated.gift_delivered ? "השי סומן כנמסר." : "סימון השי בוטל.")
      setConfirmAction(null)
      queryClient.invalidateQueries({ queryKey: ["meal-trains"] })
      queryClient.invalidateQueries({ queryKey: ["meal-train", selectedTrainId] })
      queryClient.setQueryData(["meal-train", updated.id], updated)
    },
  })

  const deleteTrainMutation = useMutation({
    mutationFn: (trainId: number) =>
      apiRequest<void>(
        `/api/admin/meal-trains/${trainId}`,
        {
          method: "DELETE",
        },
        token,
      ),
    onSuccess: (_, trainId) => {
      const cachedTrains = queryClient.getQueryData<MealTrainSummary[]>(["meal-trains"]) ?? []
      const nextTrain =
        sortTrainSummaries(cachedTrains.filter((train) => !train.is_archived && train.id !== trainId))[0] ??
        cachedTrains.find((train) => train.id !== trainId) ??
        null

      setFeedback("היולדת נמחקה. עברנו למקרה הבא.")
      setConfirmAction(null)
      queryClient.invalidateQueries({ queryKey: ["meal-trains"] })
      queryClient.invalidateQueries({ queryKey: ["admin-overview"] })
      queryClient.removeQueries({ queryKey: ["meal-train", trainId] })
      setSelectedTrainId(nextTrain?.id ?? null)
      setSelectedDayId(null)
      setActiveCaseTab("summary")
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" })
      }
    },
  })

  const createAdminMutation = useMutation({
    mutationFn: (values: CreateAdminValues) =>
      apiRequest<AdminAccount>(
        "/api/admin/auth/admins",
        {
          method: "POST",
          body: JSON.stringify(values),
        },
        token,
      ),
    onSuccess: () => {
      setFeedback("המנהלת נוספה בהצלחה.")
      createAdminForm.reset({
        full_name: "",
        email: "",
        password: "",
      })
      queryClient.invalidateQueries({ queryKey: ["admins"] })
      setActiveTab("admins")
    },
  })

  async function requestNotifications() {
    if (typeof window === "undefined" || !("Notification" in window)) {
      return
    }

    const permission = await window.Notification.requestPermission()
    setNotificationPermission(permission)
  }

  async function shareForVolunteers(train: MealTrainDetail) {
    const shareUrl = buildPublicLink(train.public_token)
    const shareText = buildSignupShareMessage(train)

    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: `מפנקות את ${train.family_title}`,
          text: shareText,
          url: shareUrl,
        })
        return
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return
        }
      }
    }

    window.open(
      buildWhatsAppLink(shareText),
      "_blank",
      "noopener,noreferrer",
    )
  }

  function openTrain(trainId: number, nextTab: AdminTab = "cases") {
    setSelectedTrainId(trainId)
    setSelectedDayId(null)
    setConfirmAction(null)
    setActiveCaseTab("summary")
    setActiveTab(nextTab)
  }

  if (!token) {
    return <Navigate to="/admin/login" replace />
  }

  const selectedTrain = selectedTrainQuery.data
  const selectedDay = selectedTrain?.days.find((day) => day.id === selectedDayId) ?? null
  const selectedDraft = selectedDay ? dayDrafts[selectedDay.id] : null
  const selectedTrainSummary = trainsQuery.data?.find((train) => train.id === selectedTrainId) ?? null
  const babyCopy = getBabyCopy(selectedTrain?.baby_type, selectedTrain?.is_twins)
  const activeTrains = sortTrainSummaries(trainsQuery.data?.filter((train) => !train.is_archived) ?? [])
  const archivedTrains = trainsQuery.data?.filter((train) => train.is_archived) ?? []
  const totalTrackedDays = activeTrains.reduce((total, train) => total + train.total_days, 0)
  const totalResolvedDays = activeTrains.reduce((total, train) => total + getResolvedDays(train.total_days, train.open_days), 0)
  const totalFillRate = totalTrackedDays > 0 ? Math.round((totalResolvedDays / totalTrackedDays) * 100) : 0
  const selectedTrainEndDate =
    selectedTrain?.days.reduce<string | null>(
      (latest, day) => (!latest || day.date > latest ? day.date : latest),
      null,
    ) ?? null
  const selectedTrainIsArchived =
    selectedTrainEndDate != null && selectedTrainEndDate < getLocalTodayIso()
  const selectedTrainNotNeededDays = selectedTrain?.days.filter((day) => day.status === "not_needed").length ?? 0

  const errorMessage =
    (createMutation.error as ApiError | null)?.message ||
    (createAdminMutation.error as ApiError | null)?.message ||
    (updateTrainMutation.error as ApiError | null)?.message ||
    (addDayMutation.error as ApiError | null)?.message ||
    (updateDayMutation.error as ApiError | null)?.message ||
    (updateGiftMutation.error as ApiError | null)?.message ||
    (deleteTrainMutation.error as ApiError | null)?.message ||
    (trainsQuery.error as ApiError | null)?.message ||
    (selectedTrainQuery.error as ApiError | null)?.message ||
    (adminsQuery.error as ApiError | null)?.message ||
    (overviewQuery.error as ApiError | null)?.message

  const selectedDayLabels = selectedDay ? formatDatePair(selectedDay.date) : null
  const isSignupReady = selectedTrain?.status === "published"
  const shareableMotherPhone = selectedTrain?.intake_form?.contact_phone ?? selectedTrain?.contact_phone ?? null
  const confirmActionConfig =
    selectedTrain && confirmAction
      ? {
          gift: {
            title: selectedTrain.gift_delivered ? "לבטל את סימון השי?" : "לסמן שהשי נמסר?",
            description: selectedTrain.gift_delivered
              ? `המערכת תסמן שהשי של ${selectedTrain.family_title} עדיין לא נמסר.`
              : `המערכת תסמן שהשי של ${selectedTrain.family_title} כבר נמסר.`,
            confirmLabel: selectedTrain.gift_delivered ? "ביטול סימון" : "סימון שי נמסר",
            tone: "secondary" as const,
            onConfirm: () => updateGiftMutation.mutate(!selectedTrain.gift_delivered),
          },
          visibility: {
            title: selectedTrain.lobby_visible ? "להסתיר את היולדת מהלובי?" : "להחזיר את היולדת ללובי?",
            description: selectedTrain.lobby_visible
              ? `היולדת תרד מהלובי הציבורי, אבל קישורים שכבר נשלחו ימשיכו לעבוד.`
              : `היולדת תחזור להופיע בלובי הציבורי ובאזור של עוד נשים שצריכות פינוק.`,
            confirmLabel: selectedTrain.lobby_visible ? "הסתרה מהלובי" : "החזרה ללובי",
            tone: "secondary" as const,
            onConfirm: () =>
              updateTrainMutation.mutate({
                family_title: selectedTrain.family_title,
                mother_name: selectedTrain.mother_name ?? "",
                contact_phone: selectedTrain.contact_phone ?? "",
                baby_type: selectedTrain.baby_type ?? "",
                is_twins: selectedTrain.is_twins,
                default_delivery_time: selectedTrain.default_delivery_time,
                reminder_time: selectedTrain.reminder_time,
                lobby_visible: !selectedTrain.lobby_visible,
              }),
          },
          delete: {
            title: "למחוק את היולדת?",
            description: `המחיקה של ${selectedTrain.family_title} תסיר את הלוח, השאלון וכל ההשתבצויות שלה. אי אפשר לשחזר אחר כך.`,
            confirmLabel: "מחיקת יולדת",
            tone: "danger" as const,
            onConfirm: () => deleteTrainMutation.mutate(selectedTrain.id),
          },
        }[confirmAction]
      : null

  return (
    <PageShell
      hideIntro
      tone={selectedTrain?.baby_type ?? null}
      actions={
        <div className="toolbar-actions">
          {notificationPermission !== "unsupported" ? (
            <button className="button button--ghost" type="button" onClick={requestNotifications}>
              הפעלת התראות
            </button>
          ) : null}
          <button className="button button--ghost" onClick={logout} type="button">
            יציאה
          </button>
        </div>
      }
    >
      {feedback ? <p className="feedback feedback--success">{feedback}</p> : null}
      {errorMessage ? <p className="feedback feedback--error">{errorMessage}</p> : null}

      <section className="admin-tabs" aria-label="ניווט מסך מנהלות">
        {adminTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`admin-tabs__button ${activeTab === tab.id ? "admin-tabs__button--active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </section>

      {activeTab === "cases" ? (
        <section className="admin-cases-layout">
          <section className="panel case-carousel-panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">יולדות פעילות</p>
                <h4>בחירת יולדת בגרירה</h4>
              </div>
              <span className="muted">{activeTrains.length} פעילות</span>
            </div>

            {trainsQuery.isLoading ? <p className="muted">טוען מקרים...</p> : null}
            {!activeTrains.length && !trainsQuery.isLoading ? <p className="muted">אין כרגע מקרים פעילים.</p> : null}

            {activeTrains.length ? (
              <div className="lobby-carousel train-carousel">
                <div className="lobby-carousel__track">
                  {activeTrains.map((train) => (
                    <button
                      key={train.id}
                      className={`train-card train-card--carousel train-card--${getTrainCardTone(train)} ${selectedTrainId === train.id ? "train-card--active" : ""}`}
                      onClick={() => openTrain(train.id)}
                      type="button"
                    >
                      <div className="train-card__top">
                        <div className="train-card__summary">
                          <strong>{train.family_title}</strong>
                          <span className={`status status--${train.status}`}>{getTrainStatusLabel(train.status)}</span>
                        </div>
                        <ProgressDonut
                          assignedDays={getResolvedDays(train.total_days, train.open_days)}
                          totalDays={train.total_days}
                          compact
                          tone={getTrainTone(train)}
                        />
                      </div>
                      <p>
                        {train.mother_name || "ממתין לשם יולדת"} · {getBabyCopy(train.baby_type, train.is_twins).shortBlessing}
                      </p>
                      <small>
                        {train.intake_submitted ? "השאלון מולא" : "ממתין לשאלון"} · {getRiskCopy(train)}
                        {!train.lobby_visible ? " · מוסתרת מהלובי" : ""}
                      </small>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {archivedTrains.length ? (
              <>
                <div className="sidebar-divider" />
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">ארכיון</p>
                    <h4>יולדות שהסתיימו</h4>
                  </div>
                  <span className="muted">{archivedTrains.length}</span>
                </div>

                <div className="lobby-carousel train-carousel train-carousel--archive">
                  <div className="lobby-carousel__track">
                    {archivedTrains.map((train) => (
                      <button
                        key={train.id}
                        className={`train-card train-card--carousel train-card--${getTrainCardTone(train)} ${selectedTrainId === train.id ? "train-card--active" : ""}`}
                        onClick={() => openTrain(train.id)}
                        type="button"
                      >
                        <div className="train-card__top">
                          <div className="train-card__summary">
                            <strong>{train.family_title}</strong>
                            <span className="status status--completed">הסתיים</span>
                          </div>
                          <ProgressDonut
                            assignedDays={getResolvedDays(train.total_days, train.open_days)}
                            totalDays={train.total_days}
                            compact
                            tone="neutral"
                          />
                        </div>
                        <p>
                          {train.mother_name || "ללא שם"} · {getBabyCopy(train.baby_type, train.is_twins).shortBlessing}
                        </p>
                        <small>{train.end_date ? `הסתיים ב-${formatDatePair(train.end_date).short}` : "הסתיים"}</small>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            ) : null}
          </section>

          <section className="panel admin-main">
            {selectedTrainQuery.isLoading ? <p className="muted">טוען את פרטי המקרה...</p> : null}
            {!selectedTrain && !selectedTrainQuery.isLoading ? (
              <div className="empty-state">
                <h4>אין עדיין מקרה נבחר</h4>
                <p className="muted">בחרי יולדת מהרשימה כדי לראות את מצב השאלון, היולדת והלוח.</p>
              </div>
            ) : null}

            {selectedTrain ? (
              <>
                <div className="admin-main__header">
                  <div>
                    <p className="eyebrow">מקרה #{selectedTrain.id}</p>
                    <h3>{selectedTrain.family_title}</h3>
                    <div className="detail-badges">
                      <span className={`status status--${selectedTrain.status}`}>{getTrainStatusLabel(selectedTrain.status)}</span>
                      <span
                        className={`detail-badge ${
                          selectedTrain.intake_form ? "detail-badge--success" : "detail-badge--warning"
                        }`}
                      >
                        {selectedTrain.intake_form ? "השאלון מולא" : "ממתין לשאלון"}
                      </span>
                      {selectedTrainSummary ? (
                        <span
                          className={`detail-badge ${
                            selectedTrainSummary.urgent_open_days > 0 ? "detail-badge--danger" : "detail-badge--neutral"
                          }`}
                        >
                          {getRiskCopy(selectedTrainSummary)}
                        </span>
                      ) : null}
                      {!selectedTrain.lobby_visible ? (
                        <span className="detail-badge detail-badge--neutral">מוסתרת מהלובי</span>
                      ) : null}
                      {selectedTrain.gift_delivered ? <span className="detail-badge detail-badge--success">השי נמסר</span> : null}
                    </div>
                    <p className="muted">
                      {selectedTrain.intake_form
                        ? `השאלון הושלם. ${babyCopy.blessing}.`
                        : "ממתין למילוי השאלון מצד היולדת."}
                    </p>
                    {selectedTrainEndDate ? (
                      <p className="muted">
                        {selectedTrainIsArchived
                          ? `המקרה נמצא בארכיון. הסתיים ב-${formatDatePair(selectedTrainEndDate).hebrew}.`
                          : `הלוח פעיל עד ${formatDatePair(selectedTrainEndDate).hebrew}.`}
                      </p>
                    ) : null}
                  </div>

                  <div className="admin-main__actions">
                    <div className="icon-action-row" aria-label="פעולות מהירות ליולדת">
                      <button
                        className={`icon-action-button ${selectedTrain.gift_delivered ? "icon-action-button--success" : ""}`}
                        type="button"
                        title={selectedTrain.gift_delivered ? "ביטול סימון שי" : "סימון שי נמסר"}
                        aria-label={selectedTrain.gift_delivered ? "ביטול סימון שי" : "סימון שי נמסר"}
                        disabled={updateGiftMutation.isPending}
                        onClick={() => setConfirmAction("gift")}
                      >
                        <GiftIcon />
                      </button>
                      <button
                        className={`icon-action-button ${!selectedTrain.lobby_visible ? "icon-action-button--warning" : ""}`}
                        type="button"
                        title={selectedTrain.lobby_visible ? "הסתרה מהלובי" : "החזרה ללובי"}
                        aria-label={selectedTrain.lobby_visible ? "הסתרה מהלובי" : "החזרה ללובי"}
                        disabled={updateTrainMutation.isPending}
                        onClick={() => setConfirmAction("visibility")}
                      >
                        <VisibilityIcon hidden={!selectedTrain.lobby_visible} />
                      </button>
                      <button
                        className="icon-action-button icon-action-button--danger"
                        type="button"
                        title="מחיקת יולדת"
                        aria-label="מחיקת יולדת"
                        disabled={deleteTrainMutation.isPending}
                        onClick={() => setConfirmAction("delete")}
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </div>
                </div>

                <section className="section-tabs" aria-label="ניווט מקרה">
                  {caseDetailTabs.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      className={`section-tabs__button ${activeCaseTab === tab.id ? "section-tabs__button--active" : ""}`}
                      onClick={() => setActiveCaseTab(tab.id)}
                    >
                      {tab.label}
                    </button>
                  ))}
                </section>

                {activeCaseTab === "summary" ? (
                  <section className="info-grid">
                    <article className="info-card">
                      <h4>מצב השאלון</h4>
                      <div className="detail-list">
                        <p>
                          <strong>סטטוס:</strong> {selectedTrain.intake_form ? "מולא בהצלחה" : "ממתין למילוי"}
                        </p>
                        <p>
                          <strong>פלאפון לשיחה עם היולדת:</strong> {shareableMotherPhone || "לא הוזן עדיין"}
                        </p>
                        <p>
                          <strong>לובי ציבורי:</strong> {selectedTrain.lobby_visible ? "מופיעה בלובי" : "מוסתרת מהלובי"}
                        </p>
                        <p className="muted">
                          {isSignupReady
                            ? "קישורי השיתוף מחכים בטאב קישורים."
                            : "אחרי שהיולדת תמלא את השאלון, יופיע בטאב קישורים גם שיתוף למבשלות."}
                        </p>
                      </div>
                    </article>

                    <article className="info-card">
                      <h4>מצב היולדת</h4>
                      {selectedTrain.intake_form ? (
                        <div className="detail-list">
                          <p>
                            <strong>שם:</strong> {selectedTrain.mother_name || "לא נרשם"}
                          </p>
                          <p>
                            <strong>מה נולד:</strong> {getBabyCopy(selectedTrain.baby_type, selectedTrain.is_twins).label}
                          </p>
                          <p>
                            <strong>כתובת:</strong> {selectedTrain.intake_form.address}
                          </p>
                          <p>
                            <strong>פלאפון של היולדת:</strong> {selectedTrain.intake_form.contact_phone}
                          </p>
                          <p>
                            <strong>טלפון בבית:</strong> {selectedTrain.intake_form.home_phone || "לא נרשם"}
                          </p>
                          <p>
                            <strong>כשרות:</strong> {selectedTrain.intake_form.kashrut || "לא צוינה"}
                          </p>
                          <p>
                            <strong>דרישות מיוחדות:</strong> {selectedTrain.intake_form.special_requirements || "אין"}
                          </p>
                        </div>
                      ) : (
                        <div className="detail-list">
                          <p className="muted">ברגע שהיולדת תמלא את השאלון, כאן יופיעו כל הפרטים הרלוונטיים.</p>
                          <p>
                            <strong>פלאפון ראשוני:</strong> {selectedTrain.contact_phone || "לא נרשם"}
                          </p>
                        </div>
                      )}
                    </article>

                    <article className="info-card">
                      <h4>מצב הלוח</h4>
                      <CalendarBreakdownChart
                        openDays={selectedTrainSummary?.open_days ?? 0}
                        assignedDays={selectedTrainSummary?.assigned_days ?? 0}
                        notNeededDays={selectedTrainNotNeededDays}
                      />
                      <div className="detail-list">
                        <p>
                          <strong>פינוקים שנשארו:</strong> {selectedTrainSummary?.open_days ?? 0}
                        </p>
                        <p>
                          <strong>פינוקים שנסגרו:</strong> {selectedTrainSummary?.assigned_days ?? 0}
                        </p>
                        <p>
                          <strong>ימים שלא צריך:</strong> {selectedTrainNotNeededDays}
                        </p>
                        <p>
                          <strong>ימים דחופים:</strong> {selectedTrainSummary?.urgent_open_days ?? 0}
                        </p>
                      </div>
                    </article>

                  </section>
                ) : null}

                {activeCaseTab === "links" ? (
                  <article className="info-card">
                    <h4>קישורים ושיתוף</h4>
                    <div className="detail-list">
                      <p className="muted">כאן שולחים רק את מה שצריך כרגע, בלי העתקות וקישורים ארוכים.</p>
                    </div>
                    <div className="form-actions form-actions--split">
                      <button
                        className="button button--ghost button--share-action"
                        type="button"
                        onClick={() => {
                          window.open(
                            buildWhatsAppLink(buildIntakeShareMessage(selectedTrain), shareableMotherPhone),
                            "_blank",
                            "noopener,noreferrer",
                          )
                        }}
                      >
                        <WhatsAppIcon className="button__icon button__icon--whatsapp" />
                        {shareableMotherPhone ? "פתיחת שיחה עם היולדת" : "שיתוף ליולדת"}
                      </button>
                      <button
                        className="button button--ghost button--share-action"
                        type="button"
                        disabled={!isSignupReady}
                        onClick={async () => {
                          if (!isSignupReady) {
                            return
                          }
                          await shareForVolunteers(selectedTrain)
                        }}
                      >
                        <ShareIcon className="button__icon button__icon--share" />
                        {isSignupReady ? "שיתוף למבשלות" : "ממתין למילוי שאלון"}
                      </button>
                    </div>
                  </article>
                ) : null}

                {activeCaseTab === "calendar" ? (
                  <article className="panel panel--nested">
                    <div className="section-heading">
                      <div>
                        <p className="eyebrow">לוח הארוחות</p>
                        <h4>לחיצה על יום פותחת חלון עריכה</h4>
                      </div>
                      <p className="muted">כאן רואים רק את הלוח והימים הפעילים של היולדת.</p>
                    </div>

                    <MealCalendar
                      startDate={selectedTrain.start_date}
                      days={selectedTrain.days}
                      babyType={selectedTrain.baby_type as BabyType | null}
                      mode="admin"
                      selectedDayId={selectedDayId}
                      onSelectDay={(day) => {
                        setActiveCaseTab("calendar")
                        setSelectedDayId(day.id)
                      }}
                    />

                    <form
                      className="inline-form inline-form--calendar"
                      onSubmit={addDayForm.handleSubmit((values) => addDayMutation.mutate(values))}
                    >
                      <input type="date" {...addDayForm.register("date")} />
                      <input type="time" {...addDayForm.register("delivery_deadline")} />
                      <input type="text" placeholder="הערה למנהלת" {...addDayForm.register("admin_note")} />
                      <button className="button button--secondary" type="submit" disabled={addDayMutation.isPending}>
                        {addDayMutation.isPending ? "מוסיפה..." : "הוספת יום"}
                      </button>
                    </form>
                  </article>
                ) : null}

                {activeCaseTab === "details" ? (
                  <article className="info-card">
                    <h4>עריכת פרטי המקרה</h4>
                    <form className="form-grid" onSubmit={editForm.handleSubmit((values) => updateTrainMutation.mutate(values))}>
                      <label className="field">
                        <span>כותרת</span>
                        <input {...editForm.register("family_title")} />
                      </label>

                      <div className="field-row">
                        <label className="field">
                          <span>שם היולדת</span>
                          <input {...editForm.register("mother_name")} />
                        </label>
                        <label className="field">
                          <span>פלאפון יולדת</span>
                          <input {...editForm.register("contact_phone")} placeholder="050..." />
                        </label>
                      </div>

                      <div className="field-row">
                        <label className="field">
                          <span>מה נולד</span>
                          <select {...editForm.register("baby_type")}>
                            <option value="">לא נבחר</option>
                            <option value="boy">בן</option>
                            <option value="girl">בת</option>
                          </select>
                        </label>
                      </div>

                      <label className="checkbox-field">
                        <input type="checkbox" {...editForm.register("is_twins")} />
                        <span>מדובר בתאומים / תאומות</span>
                        <small>המערכת תפתח אוטומטית לוח ל־3 שבועות.</small>
                      </label>

                      <div className="field-row field-row--tight">
                        <label className="field">
                          <span>שעת הבאת אוכל</span>
                          <input type="time" {...editForm.register("default_delivery_time")} />
                        </label>
                        <label className="field">
                          <span>שעת תזכורת</span>
                          <input type="time" {...editForm.register("reminder_time")} />
                        </label>
                      </div>

                      <button className="button button--secondary" type="submit" disabled={updateTrainMutation.isPending}>
                        {updateTrainMutation.isPending ? "שומרת..." : "שמירת פרטי מקרה"}
                      </button>
                    </form>
                  </article>
                ) : null}
              </>
            ) : null}
          </section>
        </section>
      ) : null}

      {activeTab === "stats" ? (
        <>
          {overviewQuery.data ? (
            <>
              <section className="panel-grid panel-grid--stats">
                <article className="panel stat-card">
                  <p className="eyebrow">מקרים פעילים</p>
                  <strong className="stat-card__value">{overviewQuery.data.active_train_count}</strong>
                  <p className="muted">יולדות עם לוח שעדיין פעיל כרגע.</p>
                </article>

                <article className="panel stat-card">
                  <p className="eyebrow">ימים פתוחים</p>
                  <strong className="stat-card__value">{overviewQuery.data.total_open_days}</strong>
                  <p className="muted">מתוכם {overviewQuery.data.urgent_open_days} דחופים לימים הקרובים.</p>
                </article>

                <article className="panel stat-card">
                  <p className="eyebrow">ארוחות סגורות</p>
                  <strong className="stat-card__value">{overviewQuery.data.total_assigned_days}</strong>
                  <p className="muted">ימים שכבר שובצו בהצלחה למבשלות.</p>
                </article>

                <article className="panel stat-card stat-card--with-donut">
                  <div>
                    <p className="eyebrow">מילוי כולל</p>
                    <strong className="stat-card__value">{totalFillRate}%</strong>
                    <p className="muted">כמה מתוך כל הימים הפעילים כבר טופלו או שכבר עברו.</p>
                  </div>
                  <ProgressDonut
                    assignedDays={totalResolvedDays}
                    totalDays={totalTrackedDays}
                    tone={overviewQuery.data.urgent_open_days > 0 ? "warning" : "success"}
                  />
                </article>
              </section>

              <section className="info-grid">
                <article className="info-card">
                  <div className="section-heading">
                    <div>
                      <p className="eyebrow">דורש תשומת לב</p>
                      <h4>איפה עלול להיות חסר בימים הקרובים</h4>
                    </div>
                  </div>

                  {overviewQuery.data.attention_trains.length ? (
                    <div className="attention-list">
                      {overviewQuery.data.attention_trains.map((train) => (
                        <button
                          key={train.train_id}
                          className={`attention-item ${train.urgent_open_days > 0 ? "attention-item--urgent" : ""}`}
                          onClick={() => openTrain(train.train_id)}
                          type="button"
                        >
                          <div className="attention-item__content">
                            <strong>{train.family_title}</strong>
                            <p className="muted">
                              {train.urgent_open_days > 0 ? `${train.urgent_open_days} ימים דחופים` : `${train.open_days} ימים פתוחים`}
                              {train.next_open_date ? ` · הקרוב: ${formatDatePair(train.next_open_date).short}` : ""}
                            </p>
                          </div>
                          <span className="attention-item__metric">{Math.round(train.completion_rate)}%</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="muted">כרגע אין מקרים פתוחים שדורשים תשומת לב מיוחדת.</p>
                  )}
                </article>

                <article className="info-card">
                  <div className="section-heading">
                    <div>
                      <p className="eyebrow">מעקב יומי</p>
                      <h4>מי מבשלת למי בימים הקרובים</h4>
                    </div>
                  </div>

                  {overviewQuery.data.upcoming_assignments.length ? (
                    <div className="assignment-list">
                      {overviewQuery.data.upcoming_assignments.map((assignment) => (
                        <article key={`${assignment.family_title}-${assignment.date}-${assignment.phone}`} className="assignment-card">
                          <div>
                            <strong>{assignment.volunteer_name}</strong>
                            <p className="muted">
                              {assignment.family_title}
                              {assignment.mother_name ? ` · ${assignment.mother_name}` : ""}
                            </p>
                          </div>
                          <div className="assignment-card__meta">
                            <span>{formatDatePair(assignment.date).short}</span>
                            <span>עד {assignment.delivery_deadline}</span>
                            {assignment.meal_type ? <span>{assignment.meal_type}</span> : null}
                            <span>{assignment.phone}</span>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className="muted">עדיין אין שיבוצים קרובים למעקב.</p>
                  )}
                </article>

                <article className="info-card">
                  <div className="section-heading">
                    <div>
                      <p className="eyebrow">מבשלות מובילות</p>
                      <h4>כמה פעמים כל מבשלת נרשמה</h4>
                    </div>
                  </div>

                  {overviewQuery.data.volunteer_stats.length ? (
                    <div className="leaderboard-list">
                      {overviewQuery.data.volunteer_stats.map((volunteer, index) => (
                        <article key={volunteer.volunteer_key || `${volunteer.volunteer_name}-${index}`} className="leaderboard-item">
                          <div className="leaderboard-item__rank">{index + 1}</div>
                          <div className="leaderboard-item__content">
                            <strong>{volunteer.volunteer_name}</strong>
                            <p className="muted">
                              {volunteer.total_signups} בישולים סה"כ · {volunteer.active_signups} פעילים כרגע
                            </p>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className="muted">ברגע שיצטברו השתבצויות תופיע כאן סטטיסטיקת מבשלות.</p>
                  )}
                </article>
              </section>
            </>
          ) : (
            <section className="panel">
              <p className="muted">טוען סטטיסטיקות...</p>
            </section>
          )}
        </>
      ) : null}

      {activeTab === "new" ? (
        <section className="info-grid">
          <article className="panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">פתיחת מקרה</p>
                <h3>יוצרת קישור אישי ליולדת</h3>
              </div>
            </div>

            <form className="form-grid" onSubmit={createForm.handleSubmit((values) => createMutation.mutate(values))}>
              <label className="field">
                <span>כותרת</span>
                <input {...createForm.register("family_title")} placeholder="משפחת כהן" />
                {createForm.formState.errors.family_title ? (
                  <small>{createForm.formState.errors.family_title.message}</small>
                ) : null}
              </label>

              <div className="field-row">
                <label className="field">
                  <span>שם היולדת</span>
                  <input {...createForm.register("mother_name")} placeholder="אופציונלי" />
                </label>
                <label className="field">
                  <span>פלאפון יולדת</span>
                  <input {...createForm.register("contact_phone")} placeholder="050..." />
                </label>
              </div>

              <div className="field-row">
                <label className="field">
                  <span>מה נולד</span>
                  <select {...createForm.register("baby_type")}>
                    <option value="">היולדת תמלא</option>
                    <option value="boy">בן</option>
                    <option value="girl">בת</option>
                  </select>
                </label>
              </div>

              <label className="checkbox-field">
                <input type="checkbox" {...createForm.register("is_twins")} />
                <span>מדובר בתאומים / תאומות</span>
                <small>במקרה כזה ייפתח אוטומטית לוח ל־3 שבועות.</small>
              </label>

              <label className="field">
                <span>תאריך התחלה</span>
                <input type="date" {...createForm.register("start_date")} />
              </label>

              <div className="field-row field-row--tight">
                <label className="field">
                  <span>שעת הבאת אוכל</span>
                  <input type="time" {...createForm.register("default_delivery_time")} />
                </label>
                <label className="field">
                  <span>שעת תזכורת</span>
                  <input type="time" {...createForm.register("reminder_time")} />
                </label>
              </div>

              <button className="button button--primary" type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? "פותחת..." : "פתיחת מקרה"}
              </button>
            </form>
          </article>

          <article className="panel">
            <div className="detail-stack">
              <div>
                <p className="eyebrow">איך זה עובד</p>
                <h3>שלבים קצרים וברורים</h3>
              </div>
              <p className="muted">1. פותחים מקרה חדש. 2. אם יש פלאפון, פותחים מיד שיחה עם היולדת בוואטסאפ. 3. אחרי שהשאלון הושלם משתפים את לוח ההשתבצות למבשלות.</p>
              <p className="muted">אם את רוצה לעבור למקרה קיים ולעדכן יום מסוים, זה נמצא בטאב "יולדות".</p>
            </div>
          </article>
        </section>
      ) : null}

      {activeTab === "admins" ? (
        <section className="info-grid">
          <article className="panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">מנהלות קיימות</p>
                <h3>מי מחוברת למערכת</h3>
              </div>
            </div>

            <div className="train-list">
              {adminsQuery.isLoading ? <p className="muted">טוען מנהלות...</p> : null}
              {adminsQuery.data?.map((admin) => (
                <article key={admin.id} className="train-card">
                  <strong>{admin.full_name || "ללא שם"}</strong>
                  <small>{admin.email}</small>
                </article>
              ))}
            </div>
          </article>

          <article className="panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">הוספת מנהלת</p>
                <h3>מסך נפרד לניהול הרשאות</h3>
              </div>
            </div>

            <form
              className="form-grid"
              onSubmit={createAdminForm.handleSubmit((values) => createAdminMutation.mutate(values))}
            >
              <label className="field">
                <span>שם מנהלת</span>
                <input {...createAdminForm.register("full_name")} placeholder="אופציונלי" />
              </label>
              <label className="field">
                <span>אימייל מנהלת</span>
                <input type="email" {...createAdminForm.register("email")} />
                {createAdminForm.formState.errors.email ? (
                  <small>{createAdminForm.formState.errors.email.message}</small>
                ) : null}
              </label>
              <label className="field">
                <span>סיסמה ראשונית</span>
                <input type="password" {...createAdminForm.register("password")} />
                {createAdminForm.formState.errors.password ? (
                  <small>{createAdminForm.formState.errors.password.message}</small>
                ) : null}
              </label>

              <button className="button button--secondary" type="submit" disabled={createAdminMutation.isPending}>
                {createAdminMutation.isPending ? "שומרת..." : "הוספת מנהלת"}
              </button>
            </form>
          </article>
        </section>
      ) : null}

      {confirmActionConfig ? (
        <div className="dialog-backdrop" onClick={() => setConfirmAction(null)}>
          <section
            className="dialog-card dialog-card--confirm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-train-action-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="dialog-card__header">
              <div>
                <p className="eyebrow">אישור פעולה</p>
                <h4 id="confirm-train-action-title">{confirmActionConfig.title}</h4>
              </div>
              <button className="button button--ghost" type="button" onClick={() => setConfirmAction(null)}>
                ביטול
              </button>
            </div>

            <p className="muted">{confirmActionConfig.description}</p>

            <div className="dialog-card__actions">
              <button
                className={`button ${confirmActionConfig.tone === "danger" ? "button--danger" : "button--secondary"}`}
                type="button"
                disabled={
                  updateGiftMutation.isPending || updateTrainMutation.isPending || deleteTrainMutation.isPending
                }
                onClick={confirmActionConfig.onConfirm}
              >
                {updateGiftMutation.isPending || updateTrainMutation.isPending || deleteTrainMutation.isPending
                  ? "שומרת..."
                  : confirmActionConfig.confirmLabel}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {selectedDay && selectedDraft ? (
        <div className="dialog-backdrop" onClick={() => setSelectedDayId(null)}>
          <section
            className="dialog-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="day-dialog-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="dialog-card__header">
              <div>
                <p className="eyebrow">עריכת יום</p>
                <h4 id="day-dialog-title">{selectedDayLabels?.hebrew}</h4>
                <p className="muted">{selectedDayLabels?.english}</p>
              </div>
              <button className="button button--ghost" type="button" onClick={() => setSelectedDayId(null)}>
                סגירה
              </button>
            </div>

            {selectedDay.signup ? (
              <div className="signup-preview">
                <p>
                  <strong>{selectedDay.signup.volunteer_name}</strong>
                </p>
                <p>{selectedDay.signup.phone}</p>
                {selectedDay.signup.meal_type ? <p>{selectedDay.signup.meal_type}</p> : null}
                {selectedDay.signup.note ? <p>{selectedDay.signup.note}</p> : null}
                <p className="muted">אם תשני את היום ל"פנוי" או ל"לא צריך", ההרשמה תבוטל אוטומטית.</p>
              </div>
            ) : (
              <p className="muted">עדיין אין מבשלת רשומה ליום הזה.</p>
            )}

            <div className="form-grid">
              <div className="field-row">
                <label className="field">
                  <span>סטטוס</span>
                  <select
                    value={selectedDraft.status}
                    onChange={(event) =>
                      setDayDrafts((current) => ({
                        ...current,
                        [selectedDay.id]: {
                          ...selectedDraft,
                          status: event.target.value as MealDay["status"],
                        },
                      }))
                    }
                  >
                    <option value="open">פנוי</option>
                    <option value="assigned">תפוס</option>
                    <option value="not_needed">לא צריך</option>
                  </select>
                </label>

                <label className="field">
                  <span>שעת יעד</span>
                  <input
                    type="time"
                    value={selectedDraft.delivery_deadline}
                    onChange={(event) =>
                      setDayDrafts((current) => ({
                        ...current,
                        [selectedDay.id]: {
                          ...selectedDraft,
                          delivery_deadline: event.target.value,
                        },
                      }))
                    }
                  />
                </label>
              </div>

              <label className="field field--full">
                <span>הערה למנהלת</span>
                <input
                  type="text"
                  value={selectedDraft.admin_note}
                  onChange={(event) =>
                    setDayDrafts((current) => ({
                      ...current,
                      [selectedDay.id]: {
                        ...selectedDraft,
                        admin_note: event.target.value,
                      },
                    }))
                  }
                />
              </label>
            </div>

            <div className="dialog-card__actions">
              <button
                className="button button--secondary"
                type="button"
                disabled={updateDayMutation.isPending}
                onClick={() =>
                  updateDayMutation.mutate({
                    dayId: selectedDay.id,
                    values: selectedDraft,
                  })
                }
              >
                {updateDayMutation.isPending ? "שומרת..." : "שמירת יום"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </PageShell>
  )
}
