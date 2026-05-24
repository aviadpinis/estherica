const hebrewPartsFormatter = new Intl.DateTimeFormat("en-u-ca-hebrew", {
  day: "numeric",
  month: "long",
  year: "numeric",
})

function parseIsoDate(value: string) {
  const [year, month, day] = value.split("-").map(Number)
  return new Date(year, month - 1, day, 12, 0, 0)
}

function getHebrewDateParts(value: string) {
  const parts = hebrewPartsFormatter.formatToParts(parseIsoDate(value))
  const day = Number(parts.find((part) => part.type === "day")?.value ?? "0")
  const month = (parts.find((part) => part.type === "month")?.value ?? "").trim()
  const year = Number(parts.find((part) => part.type === "year")?.value ?? "0")
  return { day, month, year }
}

export function getJewishHolidayLabel(value: string) {
  const { day, month } = getHebrewDateParts(value)

  if (month === "Tishri") {
    if (day === 1 || day === 2) return "ראש השנה"
    if (day === 3) return "צום גדליה"
    if (day === 10) return "יום כיפור"
    if (day >= 15 && day <= 20) return day === 15 ? "סוכות" : "חול המועד סוכות"
    if (day === 21) return "הושענא רבה"
    if (day === 22) return "שמחת תורה / שמיני עצרת"
  }

  if (month === "Kislev" && day >= 25) {
    return "חנוכה"
  }

  if (month === "Tevet") {
    if (day <= 3) return "חנוכה"
    if (day === 10) return "עשרה בטבת"
  }

  if (month === "Shevat" && day === 15) {
    return "ט\"ו בשבט"
  }

  if ((month === "Adar" || month === "Adar II") && day === 14) {
    return "פורים"
  }

  if ((month === "Adar" || month === "Adar II") && day === 15) {
    return "שושן פורים"
  }

  if (month === "Nisan") {
    if (day === 14) return "ערב פסח"
    if (day === 15 || day === 21) return "פסח"
    if (day >= 16 && day <= 20) return "חול המועד פסח"
  }

  if (month === "Iyar") {
    if (day === 18) return "ל\"ג בעומר"
    if (day === 28) return "יום ירושלים"
  }

  if (month === "Sivan") {
    if (day === 6) return "שבועות"
    if (day === 7) return "אסרו חג"
  }

  if (month === "Av") {
    if (day === 9) return "תשעה באב"
    if (day === 15) return "ט\"ו באב"
  }

  return null
}

