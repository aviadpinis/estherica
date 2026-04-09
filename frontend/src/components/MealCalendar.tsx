import { formatDatePair, formatWeekdayShort, getLocalTodayIso } from "../lib/date"
import { getBabyTone } from "../lib/baby"
import type { BabyTone, MealDay } from "../lib/types"

type CalendarMode = "intake" | "admin" | "public"

interface MealCalendarProps {
  startDate: string
  days: MealDay[]
  babyType: BabyTone | null
  mode: CalendarMode
  selectedDayId?: number | null
  ownedDayIds?: number[]
  selectionMap?: Record<number, boolean>
  onToggleNeeded?: (day: MealDay) => void
  onSelectDay?: (day: MealDay) => void
}

interface CalendarCell {
  iso: string
  day: MealDay | null
  isWeekend: boolean
}

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

function buildCells(startDate: string, days: MealDay[]) {
  const dayMap = new Map(days.map((day) => [day.date, day]))
  const start = parseIsoDate(startDate)
  const cells: CalendarCell[] = []
  const maxOffset = Math.max(
    13,
    ...days.map((day) => {
      const current = parseIsoDate(day.date)
      return Math.round((current.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
    }),
  )

  for (let offset = 0; offset <= maxOffset; offset += 1) {
    const current = new Date(start)
    current.setDate(start.getDate() + offset)
    const iso = formatIsoDate(current)
    const weekday = current.getDay()
    cells.push({
      iso,
      day: dayMap.get(iso) ?? null,
      isWeekend: weekday === 5 || weekday === 6,
    })
  }

  return {
    rows: Array.from({ length: Math.ceil(cells.length / 7) }, (_, index) => cells.slice(index * 7, (index + 1) * 7)),
    extraDays: days.filter((day) => !cells.some((cell) => cell.iso === day.date)),
  }
}

function getCellState(
  cell: CalendarCell,
  mode: CalendarMode,
  selectionMap: Record<number, boolean> | undefined,
  todayIso: string,
) {
  if (cell.isWeekend) {
    return "weekend"
  }

  if (!cell.day) {
    return "missing"
  }

  if (cell.day.date < todayIso) {
    return cell.day.status === "assigned" ? "completed" : "past"
  }

  if (mode === "intake") {
    return selectionMap?.[cell.day.id] === false ? "not-needed" : "open"
  }

  if (cell.day.status === "assigned") {
    return "assigned"
  }

  if (cell.day.status === "not_needed") {
    return "not-needed"
  }

  return "open"
}

export function MealCalendar({
  startDate,
  days,
  babyType,
  mode,
  selectedDayId = null,
  ownedDayIds = [],
  selectionMap,
  onToggleNeeded,
  onSelectDay,
}: MealCalendarProps) {
  const { rows, extraDays } = buildCells(startDate, days)
  const tone = getBabyTone(babyType)
  const todayIso = getLocalTodayIso()

  function renderCell(cell: CalendarCell) {
    const labels = formatDatePair(cell.iso)
    const weekday = formatWeekdayShort(cell.iso)
    const state = getCellState(cell, mode, selectionMap, todayIso)
    const isSelected = selectedDayId != null && cell.day?.id === selectedDayId
    const className = [
      "calendar-card",
      `calendar-card--${tone}`,
      `calendar-card--${state}`,
      isSelected ? "calendar-card--selected" : "",
    ]
      .filter(Boolean)
      .join(" ")

    const volunteerName = mode !== "intake" ? cell.day?.signup?.volunteer_name : null
    const isOwnedByCurrentVolunteer = mode === "public" && Boolean(cell.day && ownedDayIds.includes(cell.day.id))
    const interactive =
      cell.day &&
      !cell.isWeekend &&
      ((mode === "intake" && onToggleNeeded) ||
        (mode === "public" && state === "open" && onSelectDay) ||
        (mode === "admin" && onSelectDay))

    const body = (
      <>
        <div className="calendar-card__header">
          <span className="calendar-card__weekday">{weekday}</span>
          <span className="calendar-card__short">{labels.short}</span>
        </div>
        <div className="calendar-card__body">
          <strong>{labels.hebrew}</strong>
          <p>{labels.english}</p>
        </div>
        <div className="calendar-card__footer">
          {cell.isWeekend ? <span>שישי / שבת</span> : null}
          {!cell.isWeekend && !cell.day ? <span>לא פעיל</span> : null}
          {state === "past" ? <span>לא רלוונטי</span> : null}
          {state === "completed" ? <span>פינקנו</span> : null}
          {mode === "intake" && cell.day ? (
            <span>{selectionMap?.[cell.day.id] === false ? "לא צריך" : "צריך ארוחה"}</span>
          ) : null}
          {mode !== "intake" && state === "open" ? <span>פנוי</span> : null}
          {mode !== "intake" && state === "not-needed" ? <span>לא צריך</span> : null}
          {state === "assigned" ? <span>תפוס</span> : null}
        </div>
        {volunteerName ? (
          <div className="calendar-card__signup">
            {volunteerName}
            {isOwnedByCurrentVolunteer ? " · ההשתבצות שלך" : ""}
          </div>
        ) : null}
      </>
    )

    if (!interactive) {
      return (
        <div key={cell.iso} className={className}>
          {body}
        </div>
      )
    }

    return (
      <button
        key={cell.iso}
        type="button"
        className={className}
        onClick={() => {
          if (!cell.day) {
            return
          }

          if (mode === "intake") {
            onToggleNeeded?.(cell.day)
            return
          }

          onSelectDay?.(cell.day)
        }}
      >
        {body}
      </button>
    )
  }

  return (
    <section className={`calendar-board calendar-board--${tone}`}>
      <div className="calendar-board__scroller">
        {rows.map((row, index) => (
          <div key={index} className="calendar-row">
            {row.map(renderCell)}
          </div>
        ))}
      </div>

      {extraDays.length ? (
        <div className="calendar-extra-days">
          <h5>ימים נוספים</h5>
          <div className="calendar-extra-days__grid">
            {extraDays.map((day) =>
              renderCell({
                iso: day.date,
                day,
                isWeekend: false,
              }),
            )}
          </div>
        </div>
      ) : null}
    </section>
  )
}
