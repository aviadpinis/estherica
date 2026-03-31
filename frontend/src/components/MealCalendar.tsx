import { formatDatePair, formatWeekdayShort } from "../lib/date"
import { getBabyTone } from "../lib/baby"
import type { BabyType, MealDay } from "../lib/types"

type CalendarMode = "intake" | "admin" | "public"

interface MealCalendarProps {
  startDate: string
  days: MealDay[]
  babyType: BabyType | null
  mode: CalendarMode
  selectedDayId?: number | null
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

  for (let offset = 0; offset < 14; offset += 1) {
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
    rows: [cells.slice(0, 7), cells.slice(7, 14)],
    extraDays: days.filter((day) => !cells.some((cell) => cell.iso === day.date)),
  }
}

function getCellState(
  cell: CalendarCell,
  mode: CalendarMode,
  selectionMap: Record<number, boolean> | undefined,
) {
  if (cell.isWeekend) {
    return "weekend"
  }

  if (!cell.day) {
    return "missing"
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
  selectionMap,
  onToggleNeeded,
  onSelectDay,
}: MealCalendarProps) {
  const { rows, extraDays } = buildCells(startDate, days)
  const tone = getBabyTone(babyType)

  function renderCell(cell: CalendarCell) {
    const labels = formatDatePair(cell.iso)
    const weekday = formatWeekdayShort(cell.iso)
    const state = getCellState(cell, mode, selectionMap)
    const isSelected = selectedDayId != null && cell.day?.id === selectedDayId
    const className = [
      "calendar-card",
      `calendar-card--${tone}`,
      `calendar-card--${state}`,
      isSelected ? "calendar-card--selected" : "",
    ]
      .filter(Boolean)
      .join(" ")

    const volunteerName = mode === "admin" ? cell.day?.signup?.volunteer_name : null
    const interactive =
      cell.day &&
      !cell.isWeekend &&
      ((mode === "intake" && onToggleNeeded) ||
        (mode === "public" && cell.day.status === "open" && onSelectDay) ||
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
          {mode === "intake" && cell.day ? (
            <span>{selectionMap?.[cell.day.id] === false ? "לא צריך" : "צריך ארוחה"}</span>
          ) : null}
          {mode !== "intake" && cell.day?.status === "open" ? <span>פנוי</span> : null}
          {mode !== "intake" && cell.day?.status === "not_needed" ? <span>לא צריך</span> : null}
          {cell.day?.status === "assigned" ? <span>תפוס</span> : null}
        </div>
        {volunteerName ? <div className="calendar-card__signup">{volunteerName}</div> : null}
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
