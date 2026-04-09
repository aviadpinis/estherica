import { createContext, useContext, useState, type ReactNode } from "react"

import type { AuthResponse } from "./types"

interface StoredAuth {
  token: string
  email: string
  fullName: string | null
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

const AuthContext = createContext<AuthContextValue | null>(null)

function readStoredAuth(): StoredAuth | null {
  if (typeof window === "undefined") {
    return null
  }

  const raw = window.localStorage.getItem(storageKey)
  if (!raw) {
    return null
  }

  try {
    return JSON.parse(raw) as StoredAuth
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

  function login(payload: AuthResponse) {
    const nextState: StoredAuth = {
      token: payload.access_token,
      email: payload.admin.email,
      fullName: payload.admin.full_name,
    }
    window.localStorage.setItem(storageKey, JSON.stringify(nextState))
    window.localStorage.setItem(lastEmailKey, nextState.email)
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
