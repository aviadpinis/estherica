export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "")

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
  token?: string | null,
): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set("Content-Type", "application/json")
  if (token) {
    headers.set("Authorization", `Bearer ${token}`)
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers,
  })

  if (response.status === 204) {
    return undefined as T
  }

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const detail =
      typeof payload.detail === "string"
        ? payload.detail
        : "משהו לא עבד. נסי שוב."
    throw new ApiError(detail, response.status)
  }

  return payload as T
}

