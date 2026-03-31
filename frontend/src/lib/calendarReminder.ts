import { getBabyCopy } from "./baby"
import type { BabyType } from "./types"

interface CalendarReminderInput {
  familyTitle: string
  babyType: BabyType | null
  date: string
  reminderTime: string
  deliveryDeadline: string
  address?: string | null
  contactPhone?: string | null
  kashrut?: string | null
  specialRequirements?: string | null
  volunteerName: string
  mealType?: string
  note?: string
}

function combineLocalDateTime(date: string, time: string) {
  return new Date(`${date}T${time}:00`)
}

function toUtcStamp(date: Date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")
}

function escapeIcsText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;")
}

function buildEventWindow(date: string, reminderTime: string, deliveryDeadline: string) {
  const start = combineLocalDateTime(date, reminderTime)
  let end = combineLocalDateTime(date, deliveryDeadline)

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    const fallbackStart = combineLocalDateTime(date, deliveryDeadline)
    return {
      start: fallbackStart,
      end: new Date(fallbackStart.getTime() + 60 * 60 * 1000),
    }
  }

  if (end <= start) {
    end = new Date(start.getTime() + 60 * 60 * 1000)
  }

  return { start, end }
}

function buildDescription(input: CalendarReminderInput) {
  const babyCopy = getBabyCopy(input.babyType)
  const lines = [
    `פינוק ליולדת - ${input.familyTitle}`,
    `מזל טוב ${babyCopy.blessing}`,
    `שם המבשלת: ${input.volunteerName}`,
  ]

  if (input.address) {
    lines.push(`כתובת: ${input.address}`)
  }

  if (input.contactPhone) {
    lines.push(`טלפון קשר: ${input.contactPhone}`)
  }

  if (input.kashrut) {
    lines.push(`כשרות: ${input.kashrut}`)
  }

  if (input.specialRequirements) {
    lines.push(`דרישות מיוחדות: ${input.specialRequirements}`)
  }

  if (input.mealType) {
    lines.push(`סוג ארוחה: ${input.mealType}`)
  }

  if (input.note) {
    lines.push(`הערה: ${input.note}`)
  }

  return lines.join("\n")
}

export function downloadCalendarReminder(input: CalendarReminderInput) {
  const { start, end } = buildEventWindow(input.date, input.reminderTime, input.deliveryDeadline)
  const description = buildDescription(input)
  const fileName = `estherica-reminder-${input.date}.ics`
  const content = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Estherica//Meal Train Reminder//HE",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${input.date}-${Date.now()}@estherica.local`,
    `DTSTAMP:${toUtcStamp(new Date())}`,
    `DTSTART:${toUtcStamp(start)}`,
    `DTEND:${toUtcStamp(end)}`,
    `SUMMARY:${escapeIcsText(`פינוק ליולדת - ${input.familyTitle}`)}`,
    `DESCRIPTION:${escapeIcsText(description)}`,
    `LOCATION:${escapeIcsText(input.address || "כתובת תימסר על ידי המנהלת")}`,
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    "TRIGGER:-PT30M",
    `DESCRIPTION:${escapeIcsText("תזכורת להכין ארוחה ליולדת")}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n")

  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" })
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = fileName
  link.click()
  window.setTimeout(() => window.URL.revokeObjectURL(url), 1000)
}

export function buildGoogleCalendarUrl(input: CalendarReminderInput) {
  const { start, end } = buildEventWindow(input.date, input.reminderTime, input.deliveryDeadline)
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `פינוק ליולדת - ${input.familyTitle}`,
    details: buildDescription(input),
    location: input.address || "כתובת תימסר על ידי המנהלת",
    dates: `${toUtcStamp(start)}/${toUtcStamp(end)}`,
  })

  return `https://calendar.google.com/calendar/render?${params.toString()}`
}
