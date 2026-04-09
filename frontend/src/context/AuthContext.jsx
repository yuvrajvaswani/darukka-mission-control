import { createContext, useContext, useEffect, useState } from 'react'
import { authApi } from '../api/auth'
import { useAuthStore } from '../store/authStore'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const { accessToken, setTokens, setUser, logout, user } = useAuthStore()
  const [loading, setLoading] = useState(true)

  // On mount, silently re-hydrate user profile from token stored in localStorage
  useEffect(() => {
    if (!accessToken) {
      setLoading(false)
      return
    }
    // Safety net: never stay on loading screen more than 10s even if backend is down
    const timeout = setTimeout(() => {
      logout()
      setLoading(false)
    }, 10000)

    authApi
      .me()
      .then(({ data }) => setUser(data))
      .catch(() => logout())
      .finally(() => {
        clearTimeout(timeout)
        setLoading(false)
      })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const login = async (email, password) => {
    const { data } = await authApi.login({ email, password })
    setTokens(data.access_token, data.refresh_token)
    const { data: me } = await authApi.me()
    setUser(me)
    return me
  }

  const register = async (email, password, fullName) => {
    await authApi.register({ email, password, full_name: fullName })
    return login(email, password)
  }

  const signOut = () => {
    logout()
  }

  return (
    <AuthContext.Provider
      value={{ user, loading, login, register, signOut, isAuthenticated: !!accessToken }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
