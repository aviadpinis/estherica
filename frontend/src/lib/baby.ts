import type { BabyTone, BabyType } from "./types"

export type BirthChoice = "boy" | "girl" | "twins"
export type TwinsChoice = "boys" | "girls" | "mixed"

export function getBirthChoice(babyType: BabyType | null | undefined, isTwins = false): BirthChoice | null {
  if (isTwins) {
    return "twins"
  }

  if (babyType === "boy") {
    return "boy"
  }

  if (babyType === "girl") {
    return "girl"
  }

  return null
}

export function getTwinsChoice(babyType: BabyType | null | undefined, isTwins = false): TwinsChoice | null {
  if (!isTwins) {
    return null
  }

  if (babyType === "boy") {
    return "boys"
  }

  if (babyType === "girl") {
    return "girls"
  }

  return "mixed"
}

export function resolveBirthSelection(choice: BirthChoice | null, twinsChoice: TwinsChoice | null) {
  if (choice === "boy") {
    return { babyType: "boy" as const, isTwins: false }
  }

  if (choice === "girl") {
    return { babyType: "girl" as const, isTwins: false }
  }

  if (choice === "twins") {
    if (twinsChoice === "boys") {
      return { babyType: "boy" as const, isTwins: true }
    }

    if (twinsChoice === "girls") {
      return { babyType: "girl" as const, isTwins: true }
    }

    return { babyType: null, isTwins: true }
  }

  return { babyType: null, isTwins: false }
}

export function getBabyTone(babyType: BabyTone | null | undefined, isTwins = false) {
  if (babyType === "mixed" || (isTwins && !babyType)) {
    return "mixed"
  }

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
      label: "בן ובת",
      blessing: "להולדת בן ובת",
      shortBlessing: "בן ובת",
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
