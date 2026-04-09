import { createContext, useContext, useState, type ReactNode } from "react"
import { useEffect } from "react"

import type { AuthResponse } from "./types"

interface StoredAuth {
  token: string
  email: string
  fullName: string | null
  expiresAt: number
}

interface AuthContextValue {
  token: string | null
  adminEmail: string | null
  adminFullName: string | null
  login: (payload: AuthResponse) => void
  logout: () => void
}

const storageKey = "estherica-admin-auth"
const lastEmailKey = "estherica-admin-last-email"
const sessionDurationMs = 20 * 60 * 1000
const refreshThresholdMs = 60 * 1000

const AuthContext = createContext<AuthContextValue | null>(null)

function getNextExpiry() {
  return Date.now() + sessionDurationMs
}

function readStoredAuth(): StoredAuth | null {
  if (typeof window === "undefined") {
    return null
  }

  const raw = window.localStorage.getItem(storageKey)
  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw) as StoredAuth
    if (!parsed.expiresAt || parsed.expiresAt <= Date.now()) {
      window.localStorage.removeItem(storageKey)
      return null
    }
    return parsed
  } catch {
    window.localStorage.removeItem(storageKey)
    return null
  }
}

export function readLastAdminEmail() {
  if (typeof window === "undefined") {
    return ""
  }

  const fromLastEmail = window.localStorage.getItem(lastEmailKey)
  if (fromLastEmail) {
    return fromLastEmail
  }

  const storedAuth = readStoredAuth()
  return storedAuth?.email ?? ""
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const initialState = readStoredAuth()
  const [token, setToken] = useState<string | null>(initialState?.token ?? null)
  const [adminEmail, setAdminEmail] = useState<string | null>(initialState?.email ?? null)
  const [adminFullName, setAdminFullName] = useState<string | null>(initialState?.fullName ?? null)

  function persistSession(currentToken: string, currentEmail: string, currentFullName: string | null) {
    const nextState: StoredAuth = {
      token: currentToken,
      email: currentEmail,
      fullName: currentFullName,
      expiresAt: getNextExpiry(),
    }
    window.localStorage.setItem(storageKey, JSON.stringify(nextState))
    window.localStorage.setItem(lastEmailKey, currentEmail)
    return nextState
  }

  function login(payload: AuthResponse) {
    const nextState = persistSession(payload.access_token, payload.admin.email, payload.admin.full_name)
    setToken(nextState.token)
    setAdminEmail(nextState.email)
    setAdminFullName(nextState.fullName)
  }

  function logout() {
    window.localStorage.removeItem(storageKey)
    setToken(null)
    setAdminEmail(null)
    setAdminFullName(null)
  }

  useEffect(() => {
    if (typeof window === "undefined" || !token || !adminEmail) {
      return
    }

    let lastRefresh = Date.now()

    const refreshSession = () => {
      if (Date.now() - lastRefresh < refreshThresholdMs) {
        return
      }
      persistSession(token, adminEmail, adminFullName)
      lastRefresh = Date.now()
    }

    const checkExpiration = () => {
      const stored = readStoredAuth()
      if (!stored) {
        logout()
      }
    }

    const intervalId = window.setInterval(checkExpiration, 30_000)
    const events: Array<keyof WindowEventMap> = ["pointerdown", "keydown", "mousemove", "touchstart", "scroll"]

    events.forEach((eventName) => {
      window.addEventListener(eventName, refreshSession, { passive: true })
    })

    return () => {
      window.clearInterval(intervalId)
      events.forEach((eventName) => {
        window.removeEventListener(eventName, refreshSession)
      })
    }
  }, [adminEmail, adminFullName, token])

  return (
    <AuthContext.Provider value={{ token, adminEmail, adminFullName, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) {
    throw new Error("useAuth must be used within AuthProvider")
  }
  return value
}
