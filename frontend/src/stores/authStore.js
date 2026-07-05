import { create } from "zustand"
import { getMe } from "../api/auth.js"

const useAuthStore = create((set) => ({
  user: null,
  token: localStorage.getItem("token") || null,
  loading: !!localStorage.getItem("token"),

  loginUser: (userData, authToken) => {
    localStorage.setItem("token", authToken)
    set({ token: authToken, user: userData, loading: false })
  },

  logoutUser: () => {
    localStorage.removeItem("token")
    set({ token: null, user: null, loading: false })
  },

  checkAuth: async () => {
    const token = localStorage.getItem("token")
    if (!token) {
      set({ loading: false })
      return
    }
    try {
      const res = await getMe()
      set({ user: res.data.user, loading: false })
    } catch {
      localStorage.removeItem("token")
      set({ token: null, user: null, loading: false })
    }
  }
}))

export default useAuthStore
