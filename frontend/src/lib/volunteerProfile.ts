const storageKey = "estherica-volunteer-profile"

export interface VolunteerProfile {
  volunteerKey: string
  volunteerName: string
  phone: string
}

function createVolunteerKey() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }

  return `vol-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export function readVolunteerProfile(): VolunteerProfile {
  if (typeof window === "undefined") {
    return {
      volunteerKey: createVolunteerKey(),
      volunteerName: "",
      phone: "",
    }
  }

  const raw = window.localStorage.getItem(storageKey)
  if (!raw) {
    const initialProfile = {
      volunteerKey: createVolunteerKey(),
      volunteerName: "",
      phone: "",
    }
    window.localStorage.setItem(storageKey, JSON.stringify(initialProfile))
    return initialProfile
  }

  try {
    const parsed = JSON.parse(raw) as Partial<VolunteerProfile>
    const nextProfile = {
      volunteerKey: parsed.volunteerKey || createVolunteerKey(),
      volunteerName: parsed.volunteerName || "",
      phone: parsed.phone || "",
    }
    window.localStorage.setItem(storageKey, JSON.stringify(nextProfile))
    return nextProfile
  } catch {
    const resetProfile = {
      volunteerKey: createVolunteerKey(),
      volunteerName: "",
      phone: "",
    }
    window.localStorage.setItem(storageKey, JSON.stringify(resetProfile))
    return resetProfile
  }
}

export function saveVolunteerProfile(profile: VolunteerProfile) {
  if (typeof window === "undefined") {
    return
  }

  window.localStorage.setItem(storageKey, JSON.stringify(profile))
}
