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

    rename: (newUsername) => {
      // Real accounts: changing username requires a server endpoint; keep as a no-op for now.
      // (We keep this function so existing callers don't crash.)
      validateUsername(newUsername)
      throw new Error('Renaming is not implemented for online accounts.')
    }
  }
}

export const auth = createAuthStore()


