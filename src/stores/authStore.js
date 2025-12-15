import { writable } from 'svelte/store'
import { apiFetch } from '../lib/api'

const TOKEN_KEY = 'qb_auth_token_v1'

const validateUsername = (username) => {
  const normalized = username.trim()
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(normalized)) {
    throw new Error('Username must be 3–20 characters (letters, numbers, underscore).')
  }
  return normalized
}

const validatePassword = (password) => {
  if ((password ?? '').length < 6) {
    throw new Error('Password must be at least 6 characters.')
  }
  return password
}

const createAuthStore = () => {
  const { subscribe, set, update } = writable({
    user: null,
    token: localStorage.getItem(TOKEN_KEY) || null,
    ready: false,
  })

  const saveToken = (token) => {
    if (!token) {
      localStorage.removeItem(TOKEN_KEY)
      return
    }
    localStorage.setItem(TOKEN_KEY, token)
  }

  const init = async () => {
    const token = localStorage.getItem(TOKEN_KEY)
    if (!token) {
      set({ user: null, token: null, ready: true })
      return
    }
    try {
      const data = await apiFetch('/api/me', { token })
      set({ user: data.user, token, ready: true })
    } catch {
      saveToken(null)
      set({ user: null, token: null, ready: true })
    }
  }

  // kick off init at module load
  void init()

  const updateProfile = async ({ username, avatarDataUrl } = {}) => {
    let u = null
    if (typeof username === 'string' && username.trim().length > 0) {
      u = validateUsername(username)
    }

    const payload = {}
    if (u) payload.username = u
    if (avatarDataUrl) payload.avatarDataUrl = avatarDataUrl

    const token = localStorage.getItem(TOKEN_KEY)
    if (!token) throw new Error('Not logged in.')

    const data = await apiFetch('/api/profile', { method: 'PATCH', token, body: payload })
    if (data?.token) {
      saveToken(data.token)
      set({ user: data.user, token: data.token, ready: true })
    } else if (data?.user) {
      set({ user: data.user, token, ready: true })
    }
    return data
  }

  return {
    subscribe,

    signup: async (username, password, avatarDataUrl) => {
      const u = validateUsername(username)
      const p = validatePassword(password)
      if (!avatarDataUrl) {
        throw new Error('Avatar is required.')
      }
      const data = await apiFetch('/api/signup', { method: 'POST', body: { username: u, password: p, avatarDataUrl } })
      saveToken(data.token)
      set({ user: data.user, token: data.token, ready: true })
    },

    login: async (username, password) => {
      const u = validateUsername(username)
      const p = validatePassword(password)
      const data = await apiFetch('/api/login', { method: 'POST', body: { username: u, password: p } })
      saveToken(data.token)
      set({ user: data.user, token: data.token, ready: true })
    },

    logout: () => {
      saveToken(null)
      set({ user: null, token: null, ready: true })
    },

    updateProfile,

    rename: async (newUsername) => updateProfile({ username: newUsername }),
  }
}

export const auth = createAuthStore()


