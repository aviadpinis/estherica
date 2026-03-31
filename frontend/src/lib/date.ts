const hebrewFormatter = new Intl.DateTimeFormat("he-IL", {
  weekday: "long",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})

const englishFormatter = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})

const shortDateFormatter = new Intl.DateTimeFormat("he-IL", {
  month: "2-digit",
  day: "2-digit",
})

const hebrewWeekdayShortFormatter = new Intl.DateTimeFormat("he-IL", {
  weekday: "short",
})

export function getLocalTodayIso() {
  const now = new Date()
  const year = now.getFullYear()
  const month = `${now.getMonth() + 1}`.padStart(2, "0")
  const day = `${now.getDate()}`.padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function formatDatePair(value: string) {
  const date = new Date(`${value}T12:00:00`)
  return {
    hebrew: hebrewFormatter.format(date),
    english: englishFormatter.format(date),
    short: shortDateFormatter.format(date),
  }
}

export function formatDateTimeLabel(value: string) {
  return value.replace(":", ":")
}

export function formatWeekdayShort(value: string) {
  const date = new Date(`${value}T12:00:00`)
  return hebrewWeekdayShortFormatter.format(date)
}
