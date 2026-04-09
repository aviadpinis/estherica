export const MAX_SCHEDULE_START_OFFSET_DAYS = 8

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

export function getLatestScheduleStartDate(birthDate: string) {
  const latestDate = parseIsoDate(birthDate)
  latestDate.setDate(latestDate.getDate() + MAX_SCHEDULE_START_OFFSET_DAYS)
  return formatIsoDate(latestDate)
}

export function getEarliestScheduleStartDate(birthDate: string) {
  const earliestDate = parseIsoDate(birthDate)
  earliestDate.setDate(earliestDate.getDate() + 1)
  return formatIsoDate(earliestDate)
}

export function isWeekendScheduleDate(value: string) {
  const date = parseIsoDate(value)
  return date.getDay() === 5 || date.getDay() === 6
}

export function getDefaultScheduleStartDate(birthDate: string) {
  const minDate = getEarliestScheduleStartDate(birthDate)
  const maxDate = getLatestScheduleStartDate(birthDate)
  let nextDate = minDate
  while (isWeekendScheduleDate(nextDate) && nextDate <= maxDate) {
    const advancedDate = parseIsoDate(nextDate)
    advancedDate.setDate(advancedDate.getDate() + 1)
    nextDate = formatIsoDate(advancedDate)
  }
  return nextDate <= maxDate ? nextDate : minDate
}

export function getLastAllowedScheduleStartDate(birthDate: string) {
  const minDate = getEarliestScheduleStartDate(birthDate)
  let nextDate = getLatestScheduleStartDate(birthDate)
  while (isWeekendScheduleDate(nextDate) && nextDate >= minDate) {
    const previousDate = parseIsoDate(nextDate)
    previousDate.setDate(previousDate.getDate() - 1)
    nextDate = formatIsoDate(previousDate)
  }
  return nextDate >= minDate ? nextDate : getDefaultScheduleStartDate(birthDate)
}

export function clampScheduleStartDate(birthDate: string, startDate: string) {
  if (!birthDate) {
    return startDate
  }

  const minDate = getEarliestScheduleStartDate(birthDate)
  const maxDate = getLatestScheduleStartDate(birthDate)
  if (!startDate || startDate < minDate) {
    return getDefaultScheduleStartDate(birthDate)
  }
  if (startDate > maxDate) {
    return getLastAllowedScheduleStartDate(birthDate)
  }
  return startDate
}

export function getScheduleWindowError(birthDate: string, startDate: string) {
  if (!birthDate || !startDate) {
    return null
  }

  const minDate = getEarliestScheduleStartDate(birthDate)
  const maxDate = getLatestScheduleStartDate(birthDate)
  if (startDate < minDate || startDate > maxDate) {
    return "אפשר לבחור פתיחת לוח מהיום שאחרי הלידה ועד 8 ימים אחריה"
  }
  if (isWeekendScheduleDate(startDate)) {
    return "לא ניתן לפתוח את הלוח בשישי או שבת"
  }
  return null
}
