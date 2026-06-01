import { createContext, useContext, useState, useEffect, useMemo } from "react"
import { getMe } from "../api/auth.js"

/* eslint-disable react-refresh/only-export-components */
const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [token, setToken]     = useState(localStorage.getItem("token"))
  const [loading, setLoading] = useState(Boolean(token))

  useEffect(() => {
    if (!token) {
      return
    }

    getMe()
      .then((res) => setUser(res.data.user))
      .catch(() => {
        localStorage.removeItem("token")
        setToken(null)
        setUser(null)
      })
      .finally(() => setLoading(false))

  }, [token])

  const login = (userData, authToken) => {
    localStorage.setItem("token", authToken)
    setToken(authToken)
    setUser(userData)
  }

  const logout = () => {
    localStorage.removeItem("token")
    setToken(null)
    setUser(null)
  }

  const value = useMemo(
    () => ({ user, token, loading, login, logout }),
    [user, token, loading]
  )

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error("useAuth must be used inside AuthProvider")
  return context
}