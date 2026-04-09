import type { BabyType } from "./types"

export function getBabyTone(babyType: BabyType | null | undefined) {
  if (babyType === "boy") {
    return "boy"
  }

  if (babyType === "girl") {
    return "girl"
  }

  return "neutral"
}

export function getBabyCopy(babyType: BabyType | null | undefined, isTwins = false) {
  if (isTwins) {
    if (babyType === "boy") {
      return {
        label: "תאומים",
        blessing: "להולדת התאומים",
        shortBlessing: "התאומים",
      }
    }

    if (babyType === "girl") {
      return {
        label: "תאומות",
        blessing: "להולדת התאומות",
        shortBlessing: "התאומות",
      }
    }

    return {
      label: "תאומים",
      blessing: "להולדת התאומים/ות",
      shortBlessing: "התאומים/ות",
    }
  }

  if (babyType === "boy") {
    return {
      label: "בן",
      blessing: "להולדת הבן",
      shortBlessing: "הבן",
    }
  }

  if (babyType === "girl") {
    return {
      label: "בת",
      blessing: "להולדת הבת",
      shortBlessing: "הבת",
    }
  }

  return {
    label: "לא נבחר",
    blessing: "להולדת התינוק/ת",
    shortBlessing: "התינוק/ת",
  }
}
